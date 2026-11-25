'use strict';
/**
 * server.js — Backend website MU (portal) cho game OpenMU + client Babylon.
 *
 * Bản đầu tối giản (user chốt 2026-11-25 ~12:34): chỉ các chức năng cốt lõi
 *   đăng ký / đăng nhập web / xem tài khoản-nhân vật / đổi mật khẩu /
 *   bảng xếp hạng / tin tức tĩnh / admin xem tổng quan + tài khoản + nhân
 *   vật (chỉ xem) + admin đặt lại mật khẩu + báo bug / góp ý (user duyệt
 *   2026-11-25 ~12:56: trang chủ, yêu cầu đăng nhập; admin xem + đổi
 *   trạng thái mới → đang xử lý → xong).
 * KHÔNG có trong bản này: kích hoạt email, quên mật khẩu, lịch sử đăng nhập,
 * reset nhân vật (bắt buộc làm sau — bàn kỹ riêng), sửa tin tức qua admin,
 * quét dupe, chặn serial, guild/party/quest, shop admin, events admin.
 *
 * GIỚI HẠN MẬT KHẨU 3–9 KÝ TỰ (đo thật trên game live 2026-11-25):
 * client Babylon + eval-driver đều đăng nhập game bằng gói
 * LoginShortPassword, trường mật khẩu 10 byte — mật khẩu dài đúng 10 ký tự
 * (không còn byte NUL kết thúc) bị GameServer trả InvalidPassword (thử 2
 * mật khẩu 10 ký tự đều fail; 7 và 9 ký tự đều Okay). Web chỉ nhận 3–9 ký
 * tự để mọi mật khẩu đăng ký qua web đều vào được game.
 *
 * Tái dùng logic tạo tài khoản của lát ACCOUNTS (openmu-accounts.js):
 * cùng validate + cùng cách ghi data."Account" (BCrypt cost 11).
 *
 * Cấu hình qua biến môi trường (file .env chmod 600 trên VPS, nạp bằng
 * systemd EnvironmentFile — KHÔNG commit secret vào repo):
 *   DATABASE_URL  — postgres://muweb:<pw>@127.0.0.1:5432/muss20web
 *   PORT          — mặc định 18082, chỉ nghe 127.0.0.1 (nginx proxy /api)
 *   ADMIN_LOGINS  — danh sách login admin, cách nhau bằng dấu phẩy (mặc định "admin")
 *
 * Bảng riêng trong DB muss20web, schema `web` (không sửa bảng OpenMU):
 *   web.sessions  — phiên đăng nhập web (token băm sha256, hạn 7 ngày)
 *   web.news      — tin tức tĩnh mặc định (seed 2 tin lần đầu chạy)
 *   web.admin_log — log thao tác admin (đặt lại mật khẩu, đổi trạng thái feedback)
 *   web.feedback  — báo bug / góp ý của người chơi (trạng thái moi → dang_xu_ly → xong)
 */

const http = require('http');
const net = require('net');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { createPool, createAccount } = require('./openmu-accounts');

const HOST = process.env.MUWEB_HOST || '127.0.0.1';
const PORT = Number(process.env.MUWEB_PORT || 18082);
const MAX_BODY_BYTES = 16 * 1024;
const BODY_TIMEOUT_MS = 10_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PLAY_URL = 'https://mu-play.103-110-33-22.nip.io/';

const ADMIN_LOGINS = new Set(
  (process.env.ADMIN_LOGINS || 'admin').split(',').map((s) => s.trim()).filter(Boolean),
);

const LOGIN_NAME_RE = /^[A-Za-z0-9]{3,10}$/;

function ts() {
  return new Date().toISOString();
}
function logInfo(...args) {
  console.log(`[${ts()}] [mu-web]`, ...args);
}
function logError(...args) {
  console.error(`[${ts()}] [mu-web] ERROR`, ...args);
}

function sendJson(res, status, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...(extraHeaders || {}),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`quá ${BODY_TIMEOUT_MS}ms chưa đọc xong thân request`), { kind: 'timeout' }));
      req.destroy();
    }, BODY_TIMEOUT_MS);
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        clearTimeout(timer);
        reject(Object.assign(new Error(`thân request vượt ${MAX_BODY_BYTES} byte`), { kind: 'too_large' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function readJsonBody(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  return JSON.parse(raw);
}

/* ---------------- session ---------------- */

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(pool, accountId, ip) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query(
    'INSERT INTO web.sessions ("AccountId", "TokenHash", "ExpiresAt", "LastIp") VALUES ($1, $2, $3, $4)',
    [accountId, hashToken(token), expiresAt.toISOString(), ip || null],
  );
  return { token, expiresAt };
}

function tokenFromReq(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const cookie = req.headers.cookie || '';
  const m = /(?:^|;\s*)mu_token=([^;]+)/.exec(cookie);
  return m ? decodeURIComponent(m[1]) : '';
}

async function authAccount(pool, req) {
  const token = tokenFromReq(req);
  if (!token) return null;
  const r = await pool.query(
    `SELECT a."Id", a."LoginName", a."EMail", a."State", a."RegistrationDate"
       FROM web.sessions s JOIN data."Account" a ON a."Id" = s."AccountId"
      WHERE s."TokenHash" = $1 AND s."ExpiresAt" > now()`,
    [hashToken(token)],
  );
  if (r.rowCount === 0) return null;
  return r.rows[0];
}

function sessionCookie(token) {
  return `mu_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Secure`;
}

/* ---------------- validation ---------------- */

function validPassword(pw) {
  // Game chỉ nhận mật khẩu tối đa 9 ký tự (gói LoginShortPassword 10 byte,
  // cần 1 byte NUL kết thúc — đo thật: 9 ký tự Okay, 10 ký tự InvalidPassword).
  return typeof pw === 'string' && pw.length >= 3 && pw.length <= 9
    && Buffer.byteLength(pw, 'utf8') <= 9;
}

function validLoginName(name) {
  return typeof name === 'string' && LOGIN_NAME_RE.test(name);
}

/* ---------------- class mapping ----------------
 * Mã class cổ điển (DW 0, DK 16, Elf 32, MG 48, DL 64, SU 80, RF 96) để
 * frontend 0.97 (classAbbr/classCss) hiển thị đúng; class tiến hoá gom về
 * class gốc. Tên hiển thị ngắn: DW/DK/Elf/MG/DL/SU/RF. */

const CLASS_MAP = {
  'Dark Wizard': [0, 'DW'], 'Soul Master': [0, 'DW'], 'Grand Master': [0, 'DW'],
  'Dark Knight': [16, 'DK'], 'Blade Knight': [16, 'DK'], 'Blade Master': [16, 'DK'],
  'Fairy Elf': [32, 'Elf'], 'Muse Elf': [32, 'Elf'], 'High Elf': [32, 'Elf'],
  'Magic Gladiator': [48, 'MG'], 'Duel Master': [48, 'MG'],
  'Dark Lord': [64, 'DL'], 'Lord Emperor': [64, 'DL'],
  'Summoner': [80, 'SU'], 'Bloody Summoner': [80, 'SU'], 'Dimension Master': [80, 'SU'],
  'Rage Fighter': [96, 'RF'], 'Fist Master': [96, 'RF'],
};

function classInfo(classFull) {
  const m = CLASS_MAP[classFull];
  return m ? { code: m[0], short: m[1] } : { code: null, short: '?' };
}

const CHAR_SELECT = `
  SELECT c."Id" AS id, c."Name" AS name,
         split_part(cc."Name", '|', 1) AS class_full,
         c."Experience" AS exp, c."LevelUpPoints" AS points,
         c."CreateDate" AS created_at,
         sa."Value" AS level, COALESCE(s."Money", 0) AS zen,
         split_part(m."Name", '|', 1) AS map,
         c."PositionX" AS x, c."PositionY" AS y,
         c."AccountId" AS account_id, a."LoginName" AS account_username
    FROM data."Character" c
    JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId"
    JOIN data."StatAttribute" sa ON sa."CharacterId" = c."Id"
    JOIN config."AttributeDefinition" ad ON ad."Id" = sa."DefinitionId" AND ad."Designation" = 'Level'
    LEFT JOIN data."ItemStorage" s ON s."Id" = c."InventoryId"
    LEFT JOIN config."GameMapDefinition" m ON m."Id" = c."CurrentMapId"
    JOIN data."Account" a ON a."Id" = c."AccountId"`;

function toCharRow(r) {
  const ci = classInfo(r.class_full);
  return {
    id: r.id, name: r.name,
    class_code: ci.code, class_name: ci.short, class_full: r.class_full,
    level: Math.trunc(Number(r.level) || 0),
    exp: Number(r.exp) || 0, points: Number(r.points) || 0,
    zen: Number(r.zen) || 0, map: r.map || null, x: r.x, y: r.y,
    account_id: r.account_id, account_username: r.account_username,
    created_at: r.created_at,
  };
}

/* ---------------- rate limit (bộ nhớ, theo IP) ---------------- */

const rlBuckets = new Map(); // key -> {count, resetAt}
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  let b = rlBuckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    rlBuckets.set(key, b);
  }
  b.count += 1;
  return b.count > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of rlBuckets) if (now > b.resetAt) rlBuckets.delete(k);
}, 60_000).unref();

/* ---------------- DB init ---------------- */

const DEFAULT_NEWS = [
  {
    title_vi: 'Ra mắt website MU Online',
    title_en: 'MU Online website launched',
    body_vi: 'Chào mừng đến với MU Online (Season 6 Episode 3).\n\nĐăng ký tài khoản trên trang này, sau đó bấm "Chơi Ngay" để vào game ngay trên trình duyệt — không cần tải gì thêm, chơi được cả trên điện thoại.\n\nLưu ý: tên tài khoản 3–10 ký tự chữ/số, mật khẩu 3–9 ký tự.',
    body_en: 'Welcome to MU Online (Season 6 Episode 3).\n\nRegister an account on this page, then press "Play Now" to enter the game right in your browser — no download needed, playable on phones too.',
    category: 'update',
  },
  {
    title_vi: 'Hướng dẫn chơi trên điện thoại',
    title_en: 'How to play on your phone',
    body_vi: '1. Đăng ký tài khoản (tên 3–10 ký tự, mật khẩu 3–9 ký tự).\n2. Bấm "Chơi Ngay" — game mở trên trình duyệt, xoay ngang màn hình để chơi.\n3. Di chuyển bằng joystick trái, chạm vào quái để đánh, chạm giữ vào vật phẩm trong hành trang để xem chi tiết.\n4. Đổi mật khẩu và xem nhân vật trong mục "Quản lý tài khoản".',
    body_en: '1. Register an account (name 3–10 characters, password 3–9 characters).\n2. Press "Play Now" — the game opens in your browser; rotate your phone to landscape.\n3. Move with the left joystick, tap a monster to attack, long-press an item in your inventory for details.\n4. Change your password and view your characters under "Manage account".',
    category: 'update',
  },
];

async function initDb(pool) {
  // Chỉ CREATE SCHEMA khi thật sự chưa có: CREATE SCHEMA IF NOT EXISTS
  // vẫn đòi quyền CREATE ON DATABASE dù schema đã tồn tại (PostgreSQL
  // kiểm tra quyền trước) nên role tối thiểu (không có quyền đó) sẽ lỗi
  // 42501 ngay lần khởi động đầu. Kiểm tra tồn tại trước thì không cần.
  const webExists = await pool.query(
    "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'web'",
  );
  if (webExists.rowCount === 0) {
    await pool.query('CREATE SCHEMA web');
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS web.sessions (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "AccountId" uuid NOT NULL,
    "TokenHash" text NOT NULL UNIQUE,
    "CreatedAt" timestamptz NOT NULL DEFAULT now(),
    "ExpiresAt" timestamptz NOT NULL,
    "LastIp" text
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS "IX_sessions_account" ON web.sessions ("AccountId")');
  await pool.query(`CREATE TABLE IF NOT EXISTS web.news (
    "Id" SERIAL PRIMARY KEY,
    "TitleVi" text NOT NULL, "TitleEn" text,
    "BodyVi" text NOT NULL, "BodyEn" text,
    "Category" text NOT NULL DEFAULT 'update',
    "Published" boolean NOT NULL DEFAULT true,
    "CreatedAt" timestamptz NOT NULL DEFAULT now()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS web.admin_log (
    "Id" SERIAL PRIMARY KEY,
    "CreatedAt" timestamptz NOT NULL DEFAULT now(),
    "AdminLogin" text NOT NULL,
    "Action" text NOT NULL,
    "AccountId" uuid,
    "TargetLogin" text,
    "Detail" text
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS web.feedback (
    "Id" uuid PRIMARY KEY,
    "AccountId" uuid NOT NULL,
    "LoginName" varchar(10) NOT NULL,
    "Title" varchar(200) NOT NULL,
    "Body" text NOT NULL,
    "Status" varchar(20) NOT NULL DEFAULT 'moi',
    "CreatedAt" timestamptz NOT NULL DEFAULT now(),
    "UpdatedAt" timestamptz NOT NULL DEFAULT now()
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS "IX_feedback_created" ON web.feedback ("CreatedAt" DESC)');
  // Seed tin tĩnh mặc định — chỉ khi bảng còn trống.
  for (const n of DEFAULT_NEWS) {
    await pool.query(
      `INSERT INTO web.news ("TitleVi", "TitleEn", "BodyVi", "BodyEn", "Category")
       SELECT $1, $2, $3, $4, $5 WHERE NOT EXISTS (SELECT 1 FROM web.news WHERE "TitleVi" = $1)`,
      [n.title_vi, n.title_en, n.body_vi, n.body_en, n.category],
    );
  }
  logInfo('schema web + seed tin tức OK');
}

/* ---------------- handlers ---------------- */

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || '';
}

async function handleRegister(pool, req, res) {
  const ip = clientIp(req);
  if (rateLimited(`reg:${ip}`, 10, 5 * 60 * 1000) || rateLimited('reg:global', 200, 60 * 1000)) {
    logError(`register từ ${ip}: bị rate-limit`);
    sendJson(res, 429, { success: false, message: 'Đăng ký quá nhiều, vui lòng thử lại sau ít phút.' });
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    logError(`register từ ${ip}: body lỗi kind=${err.kind || 'n/a'} message=${err.message}`);
    sendJson(res, 400, { success: false, message: 'Dữ liệu gửi lên không hợp lệ.' });
    return;
  }
  // Frontend 0.97 gửi {username, email, password}; API OpenMU nhận
  // {loginName, password, eMail} — chấp nhận cả hai hình dạng.
  const input = {
    loginName: body.loginName || body.username,
    password: body.password,
    eMail: body.eMail || body.email,
  };
  let outcome;
  try {
    outcome = await createAccount(pool, input);
  } catch (err) {
    logError(`register từ ${ip}: lỗi hạ tầng loginName=${JSON.stringify(input.loginName)} message=${err.message}`);
    sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
    return;
  }
  if (outcome.result === 'done') {
    const sess = await createSession(pool, outcome.accountId, ip);
    logInfo(`register từ ${ip}: done loginName=${input.loginName}`);
    sendJson(res, 200,
      { success: true, token: sess.token, user: { username: input.loginName } },
      { 'Set-Cookie': sessionCookie(sess.token) });
  } else if (outcome.result === 'already_exists') {
    sendJson(res, 200, { success: false, message: 'Tên tài khoản đã tồn tại.' });
  } else {
    sendJson(res, 400, { success: false, message: outcome.reason || 'Dữ liệu đăng ký không hợp lệ.' });
  }
}

async function handleLogin(pool, req, res) {
  const ip = clientIp(req);
  if (rateLimited(`login:${ip}`, 10, 5 * 60 * 1000) || rateLimited('login:global', 300, 60 * 1000)) {
    logError(`login từ ${ip}: bị rate-limit`);
    sendJson(res, 429, { success: false, message: 'Đăng nhập quá nhiều, vui lòng thử lại sau ít phút.' });
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    logError(`login từ ${ip}: body lỗi kind=${err.kind || 'n/a'} message=${err.message}`);
    sendJson(res, 400, { success: false, message: 'Dữ liệu gửi lên không hợp lệ.' });
    return;
  }
  const username = body.username || body.loginName;
  const password = body.password;
  const fail = () => sendJson(res, 200, { success: false, message: 'Tên tài khoản hoặc mật khẩu không đúng.' });
  if (!validLoginName(username) || typeof password !== 'string' || !password) {
    // Trả cùng thông báo chung để không lộ tài khoản có tồn tại hay không.
    fail();
    return;
  }
  let r;
  try {
    r = await pool.query('SELECT "Id", "LoginName", "PasswordHash", "State" FROM data."Account" WHERE "LoginName" = $1', [username]);
  } catch (err) {
    logError(`login từ ${ip}: lỗi DB message=${err.message}`);
    sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
    return;
  }
  if (r.rowCount === 0) { fail(); return; }
  const acc = r.rows[0];
  let ok = false;
  try {
    ok = await bcrypt.compare(password, acc.PasswordHash);
  } catch (err) {
    logError(`login từ ${ip}: bcrypt lỗi loginName=${username} message=${err.message}`);
  }
  if (!ok) { fail(); return; }
  if (acc.State === 4 || acc.State === 5) {
    logInfo(`login từ ${ip}: tài khoản bị khóa loginName=${username} state=${acc.State}`);
    sendJson(res, 200, { success: false, message: 'Tài khoản đang bị khóa, vui lòng liên hệ quản trị.' });
    return;
  }
  const sess = await createSession(pool, acc.Id, ip);
  logInfo(`login từ ${ip}: ok loginName=${username}`);
  sendJson(res, 200,
    { success: true, token: sess.token, user: { username: acc.LoginName } },
    { 'Set-Cookie': sessionCookie(sess.token) });
}

async function handleChangePassword(pool, req, res, acc) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { success: false, message: 'Dữ liệu gửi lên không hợp lệ.' });
    return;
  }
  const cur = body.current_password;
  const nw = body.new_password;
  if (!validPassword(nw)) {
    sendJson(res, 400, { success: false, message: 'Mật khẩu mới phải dài 3–9 ký tự (tối đa 9 byte — giới hạn đăng nhập game).' });
    return;
  }
  let r;
  try {
    r = await pool.query('SELECT "PasswordHash" FROM data."Account" WHERE "Id" = $1', [acc.Id]);
  } catch (err) {
    logError(`doi-mat-khau loginName=${acc.LoginName}: lỗi DB message=${err.message}`);
    sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
    return;
  }
  const ok = await bcrypt.compare(typeof cur === 'string' ? cur : '', r.rows[0].PasswordHash);
  if (!ok) {
    sendJson(res, 400, { success: false, message: 'Mật khẩu hiện tại không đúng.' });
    return;
  }
  const hash = await bcrypt.hash(nw, 11);
  try {
    await pool.query('UPDATE data."Account" SET "PasswordHash" = $1 WHERE "Id" = $2', [hash, acc.Id]);
    // Hủy các phiên khác để mật khẩu cũ không còn dùng được.
    await pool.query('DELETE FROM web.sessions WHERE "AccountId" = $1', [acc.Id]);
    // Tạo lại phiên hiện tại để người dùng không bị văng.
    const sess = await createSession(pool, acc.Id, clientIp(req));
    logInfo(`doi-mat-khau: ok loginName=${acc.LoginName}`);
    sendJson(res, 200, { success: true, message: 'Đổi mật khẩu thành công.' },
      { 'Set-Cookie': sessionCookie(sess.token) });
  } catch (err) {
    logError(`doi-mat-khau loginName=${acc.LoginName}: lỗi DB message=${err.message}`);
    sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
    return;
  }
}

function parsePagination(url) {
  let limit = Number(url.searchParams.get('limit') || 20);
  let offset = Number(url.searchParams.get('offset') || 0);
  if (!Number.isFinite(limit) || limit < 1) limit = 20;
  if (limit > 200) limit = 200;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  return { limit, offset };
}

function checkPort(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const s = net.createConnection({ host, port });
    const done = (v) => { try { s.destroy(); } catch (e) {} resolve(v); };
    s.setTimeout(timeoutMs, () => done(false));
    s.once('connect', () => done(true));
    s.once('error', () => done(false));
  });
}

/* ---------------- feedback (báo bug / góp ý) ---------------- */

const FB_STATUSES = new Set(['moi', 'dang_xu_ly', 'xong']);

function toFeedbackRow(r) {
  return {
    id: r.Id, login_name: r.LoginName,
    title: r.Title, body: r.Body, status: r.Status,
    created_at: r.CreatedAt, updated_at: r.UpdatedAt,
  };
}

async function handleFeedback(pool, req, res, acc) {
  // Chống spam: tối đa 5 góp ý / giờ / tài khoản.
  if (rateLimited(`fb:${acc.Id}`, 5, 60 * 60 * 1000)) {
    logError(`feedback từ loginName=${acc.LoginName}: bị rate-limit (5/giờ)`);
    sendJson(res, 429, { success: false, message: 'Bạn gửi quá nhiều, vui lòng thử lại sau 1 giờ.' });
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { success: false, message: 'Dữ liệu gửi lên không hợp lệ.' });
    return;
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!title || title.length > 200) {
    sendJson(res, 400, { success: false, message: 'Tiêu đề bắt buộc, tối đa 200 ký tự.' });
    return;
  }
  if (!text || text.length > 5000) {
    sendJson(res, 400, { success: false, message: 'Nội dung bắt buộc, tối đa 5000 ký tự.' });
    return;
  }
  try {
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO web.feedback ("Id", "AccountId", "LoginName", "Title", "Body", "Status") VALUES ($1, $2, $3, $4, $5, \'moi\')',
      [id, acc.Id, acc.LoginName, title, text],
    );
    logInfo(`feedback: ok loginName=${acc.LoginName} id=${id}`);
    sendJson(res, 200, { success: true, id, message: 'Đã gửi, cảm ơn bạn!' });
  } catch (err) {
    logError(`feedback loginName=${acc.LoginName}: lỗi DB message=${err.message}`);
    sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
  }
}

/* ---------------- router ---------------- */

async function route(pool, req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const path = url.pathname;
  const method = req.method;
  const ip = clientIp(req);

  if (method === 'GET' && path === '/health') {
    sendJson(res, 200, { ok: true, service: 'mu-web-portal' });
    return;
  }

  if (method === 'POST' && path === '/api/register') {
    await handleRegister(pool, req, res);
    return;
  }
  if (method === 'POST' && path === '/api/login') {
    await handleLogin(pool, req, res);
    return;
  }

  if (method === 'GET' && path === '/api/config') {
    sendJson(res, 200, {
      success: true,
      config: {
        season: 'Season 6 Episode 3',
        server_name: 'MU Online',
        servers: [{ name: 'MU Online', key: 'mu', exp: 1, drop: null }],
        play_url: PLAY_URL,
      },
    });
    return;
  }

  if (method === 'GET' && path === '/api/server-stats') {
    let status = 'offline';
    try {
      const [cs, gs] = await Promise.all([
        checkPort('127.0.0.1', 44415, 800),
        checkPort('127.0.0.1', 45911, 800),
      ]);
      status = cs && gs ? 'online' : 'offline';
    } catch (err) {
      logError(`server-stats: kiểm tra cổng lỗi message=${err.message}`);
    }
    try {
      const a = await pool.query('SELECT count(*)::int AS n FROM data."Account"');
      const c = await pool.query('SELECT count(*)::int AS n FROM data."Character"');
      // online: null — OpenMU không có API đếm người online; không bịa số.
      sendJson(res, 200, { success: true, online: null, status, accounts: a.rows[0].n, characters: c.rows[0].n });
    } catch (err) {
      logError(`server-stats: lỗi DB message=${err.message}`);
      sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
    }
    return;
  }

  if (method === 'GET' && path === '/api/news') {
    let limit = Number(url.searchParams.get('limit') || 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 10;
    if (limit > 50) limit = 50;
    try {
      const r = await pool.query(
        `SELECT "Id" AS id, "TitleVi" AS title_vi, "TitleEn" AS title_en,
                "Category" AS category, "CreatedAt" AS created_at
           FROM web.news WHERE "Published" ORDER BY "CreatedAt" DESC, "Id" DESC LIMIT $1`,
        [limit],
      );
      sendJson(res, 200, { success: true, news: r.rows });
    } catch (err) {
      logError(`news list: lỗi DB message=${err.message}`);
      sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
    }
    return;
  }

  const newsOne = /^\/api\/news\/(\d+)$/.exec(path);
  if (method === 'GET' && newsOne) {
    try {
      const r = await pool.query(
        `SELECT "Id" AS id, "TitleVi" AS title_vi, "TitleEn" AS title_en,
                "BodyVi" AS body_vi, "BodyEn" AS body_en,
                "Category" AS category, "CreatedAt" AS created_at
           FROM web.news WHERE "Id" = $1 AND "Published"`,
        [Number(newsOne[1])],
      );
      if (r.rowCount === 0) { sendJson(res, 404, { success: false, message: 'Không tìm thấy tin tức này.' }); return; }
      sendJson(res, 200, { success: true, news: r.rows[0] });
    } catch (err) {
      logError(`news one id=${newsOne[1]}: lỗi DB message=${err.message}`);
      sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
    }
    return;
  }

  if (method === 'GET' && path === '/api/ranking') {
    try {
      const r = await pool.query(
        `${CHAR_SELECT} ORDER BY sa."Value" DESC, c."Experience" DESC LIMIT 50`,
      );
      sendJson(res, 200, {
        success: true,
        ranking: r.rows.map((row) => {
          const c = toCharRow(row);
          return { char_name: c.name, class_name: c.class_name, level: c.level };
        }),
      });
    } catch (err) {
      logError(`ranking: lỗi DB message=${err.message}`);
      sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
    }
    return;
  }

  // ---- Khu vực cần đăng nhập ----
  const authed = await authAccount(pool, req).catch((err) => {
    logError(`${method} ${path}: auth lỗi DB message=${err.message}`);
    return undefined;
  });
  if (authed === undefined) {
    sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
    return;
  }
  if (method === 'GET' && (path === '/api/user/info' || path === '/api/user/account')) {
    if (!authed) {
      sendJson(res, 401, { success: false, message: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.' });
      return;
    }
    const banned = authed.State === 4 || authed.State === 5;
    if (path === '/api/user/info') {
      sendJson(res, 200, { success: true, user: { username: authed.LoginName, email: authed.EMail } });
    } else {
      sendJson(res, 200, {
        success: true,
        account: {
          username: authed.LoginName, email: authed.EMail,
          banned, created_at: authed.RegistrationDate,
        },
      });
    }
    return;
  }
  if (!authed) {
    sendJson(res, 401, { success: false, message: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.' });
    return;
  }

  if (method === 'POST' && path === '/api/user/change-password') {
    await handleChangePassword(pool, req, res, authed);
    return;
  }

  if (method === 'GET' && path === '/api/characters') {
    try {
      const r = await pool.query(`${CHAR_SELECT} WHERE c."AccountId" = $1 ORDER BY c."CharacterSlot"`, [authed.Id]);
      sendJson(res, 200, { success: true, characters: r.rows.map(toCharRow) });
    } catch (err) {
      logError(`characters loginName=${authed.LoginName}: lỗi DB message=${err.message}`);
      sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
    }
    return;
  }

  if (method === 'POST' && path === '/api/feedback') {
    await handleFeedback(pool, req, res, authed);
    return;
  }

  // ---- Khu vực admin ----
  const isAdmin = ADMIN_LOGINS.has(authed.LoginName);
  if (path.startsWith('/api/admin/')) {
    if (!isAdmin) {
      logError(`admin ${method} ${path}: loginName=${authed.LoginName} không phải admin`);
      sendJson(res, 403, { success: false, message: 'Không có quyền quản trị.' });
      return;
    }
    if (method === 'GET' && path === '/api/admin/me') {
      sendJson(res, 200, { success: true, username: authed.LoginName });
      return;
    }
    if (method === 'GET' && path === '/api/admin/overview') {
      try {
        const [a, c, na, nc, b] = await Promise.all([
          pool.query('SELECT count(*)::int AS n FROM data."Account"'),
          pool.query('SELECT count(*)::int AS n FROM data."Character"'),
          pool.query(`SELECT count(*)::int AS n FROM data."Account" WHERE "RegistrationDate" >= now() - interval '7 days'`),
          pool.query(`SELECT count(*)::int AS n FROM data."Character" WHERE "CreateDate" >= now() - interval '7 days'`),
          pool.query(`SELECT count(*)::int AS n FROM data."Account" WHERE "State" = 4`),
        ]);
        sendJson(res, 200, {
          success: true,
          accounts: a.rows[0].n, characters: c.rows[0].n,
          new_accounts_7d: na.rows[0].n, new_characters_7d: nc.rows[0].n,
          banned_accounts: b.rows[0].n,
        });
      } catch (err) {
        logError(`admin overview: lỗi DB message=${err.message}`);
        sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
      }
      return;
    }
    if (method === 'GET' && path === '/api/admin/accounts') {
      const { limit, offset } = parsePagination(url);
      const q = (url.searchParams.get('q') || '').trim();
      const email = (url.searchParams.get('email') || '').trim();
      const bannedOnly = url.searchParams.get('banned') === 'true';
      const adminOnly = url.searchParams.get('is_admin') === 'true';
      const conds = [];
      const params = [];
      if (q) { params.push(`%${q}%`); conds.push(`("LoginName" ILIKE $${params.length} OR "EMail" ILIKE $${params.length})`); }
      if (email) { params.push(`%${email}%`); conds.push(`"EMail" ILIKE $${params.length}`); }
      if (bannedOnly) conds.push('"State" = 4');
      if (adminOnly) conds.push(`"LoginName" = ANY($${params.length + 1})`);
      if (adminOnly) params.push([...ADMIN_LOGINS]);
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      try {
        const total = await pool.query(`SELECT count(*)::int AS n FROM data."Account" ${where}`, params);
        const rows = await pool.query(
          `SELECT "Id" AS id, "LoginName" AS username, "EMail" AS email,
                  ("State" = 4 OR "State" = 5) AS banned, "RegistrationDate" AS created_at
             FROM data."Account" ${where} ORDER BY "RegistrationDate" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset],
        );
        sendJson(res, 200, {
          success: true, total: total.rows[0].n,
          accounts: rows.rows.map((r) => ({ ...r, is_admin: ADMIN_LOGINS.has(r.username) })),
        });
      } catch (err) {
        logError(`admin accounts: lỗi DB message=${err.message}`);
        sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
      }
      return;
    }
    const accOne = /^\/api\/admin\/accounts\/([0-9a-f-]{36})$/.exec(path);
    if (method === 'GET' && accOne) {
      try {
        const a = await pool.query(
          `SELECT "Id" AS id, "LoginName" AS username, "EMail" AS email,
                  ("State" = 4 OR "State" = 5) AS banned, "RegistrationDate" AS created_at
             FROM data."Account" WHERE "Id" = $1`,
          [accOne[1]],
        );
        if (a.rowCount === 0) { sendJson(res, 404, { success: false, message: 'Không tìm thấy tài khoản.' }); return; }
        const chars = await pool.query(`${CHAR_SELECT} WHERE c."AccountId" = $1 ORDER BY c."CharacterSlot"`, [accOne[1]]);
        sendJson(res, 200, {
          success: true,
          account: { ...a.rows[0], is_admin: ADMIN_LOGINS.has(a.rows[0].username) },
          characters: chars.rows.map(toCharRow),
        });
      } catch (err) {
        logError(`admin account ${accOne[1]}: lỗi DB message=${err.message}`);
        sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
      }
      return;
    }
    const accReset = /^\/api\/admin\/accounts\/([0-9a-f-]{36})\/reset-password$/.exec(path);
    if (method === 'POST' && accReset) {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        sendJson(res, 400, { success: false, message: 'Dữ liệu gửi lên không hợp lệ.' });
        return;
      }
      if (!validPassword(body.new_password)) {
        sendJson(res, 400, { success: false, message: 'Mật khẩu mới phải dài 3–9 ký tự (tối đa 9 byte — giới hạn đăng nhập game).' });
        return;
      }
      try {
        const target = await pool.query('SELECT "LoginName" FROM data."Account" WHERE "Id" = $1', [accReset[1]]);
        if (target.rowCount === 0) { sendJson(res, 404, { success: false, message: 'Không tìm thấy tài khoản.' }); return; }
        if (ADMIN_LOGINS.has(target.rows[0].LoginName) && target.rows[0].LoginName !== authed.LoginName) {
          sendJson(res, 403, { success: false, message: 'Không được đặt lại mật khẩu của admin khác.' });
          return;
        }
        const hash = await bcrypt.hash(body.new_password, 11);
        await pool.query('UPDATE data."Account" SET "PasswordHash" = $1 WHERE "Id" = $2', [hash, accReset[1]]);
        await pool.query('DELETE FROM web.sessions WHERE "AccountId" = $1', [accReset[1]]);
        await pool.query(
          'INSERT INTO web.admin_log ("AdminLogin", "Action", "AccountId", "TargetLogin", "Detail") VALUES ($1, $2, $3, $4, $5)',
          [authed.LoginName, 'reset-password', accReset[1], target.rows[0].LoginName, 'admin đặt lại mật khẩu'],
        );
        logInfo(`admin reset-password: admin=${authed.LoginName} target=${target.rows[0].LoginName}`);
        sendJson(res, 200, { success: true, message: 'Đã đặt lại mật khẩu.' });
      } catch (err) {
        logError(`admin reset-password ${accReset[1]}: lỗi DB message=${err.message}`);
        sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
      }
      return;
    }
    if (method === 'GET' && path === '/api/admin/characters') {
      const { limit, offset } = parsePagination(url);
      const q = (url.searchParams.get('q') || '').trim();
      const account = (url.searchParams.get('account') || '').trim();
      const classCode = url.searchParams.get('class_code');
      const conds = [];
      const params = [];
      if (q) { params.push(`%${q}%`); conds.push(`c."Name" ILIKE $${params.length}`); }
      if (account) {
        params.push(`%${account}%`);
        conds.push(`(a."LoginName" ILIKE $${params.length} OR c."AccountId"::text = $${params.length + 1})`);
        params.push(account);
      }
      if (classCode !== null && classCode !== '') {
        const code = Number(classCode);
        const names = Object.keys(CLASS_MAP).filter((k) => CLASS_MAP[k][0] === code);
        if (names.length) {
          params.push(names);
          conds.push(`split_part(cc."Name", '|', 1) = ANY($${params.length})`);
        } else {
          conds.push('false');
        }
      }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      try {
        const total = await pool.query(`SELECT count(*)::int AS n FROM data."Character" c JOIN data."Account" a ON a."Id" = c."AccountId" JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId" ${where}`, params);
        const rows = await pool.query(
          `${CHAR_SELECT} ${where} ORDER BY sa."Value" DESC, c."Experience" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset],
        );
        sendJson(res, 200, { success: true, total: total.rows[0].n, characters: rows.rows.map(toCharRow) });
      } catch (err) {
        logError(`admin characters: lỗi DB message=${err.message}`);
        sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
      }
      return;
    }
    const charOne = /^\/api\/admin\/characters\/([0-9a-f-]{36})$/.exec(path);
    if (method === 'GET' && charOne) {
      try {
        const r = await pool.query(`${CHAR_SELECT} WHERE c."Id" = $1`, [charOne[1]]);
        if (r.rowCount === 0) { sendJson(res, 404, { success: false, message: 'Không tìm thấy nhân vật.' }); return; }
        const c = toCharRow(r.rows[0]);
        const a = await pool.query(
          `SELECT "LoginName" AS username, "EMail" AS email, ("State" = 4 OR "State" = 5) AS banned,
                  "RegistrationDate" AS created_at FROM data."Account" WHERE "Id" = $1`,
          [c.account_id],
        );
        sendJson(res, 200, { success: true, character: c, account: a.rows[0] || null });
      } catch (err) {
        logError(`admin character ${charOne[1]}: lỗi DB message=${err.message}`);
        sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
      }
      return;
    }
    if (method === 'GET' && path === '/api/admin/feedback') {
      const { limit, offset } = parsePagination(url);
      const status = (url.searchParams.get('status') || '').trim();
      const conds = [];
      const params = [];
      if (status && FB_STATUSES.has(status)) { params.push(status); conds.push(`"Status" = $${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      try {
        const total = await pool.query(`SELECT count(*)::int AS n FROM web.feedback ${where}`, params);
        const rows = await pool.query(
          `SELECT * FROM web.feedback ${where} ORDER BY "CreatedAt" DESC, "Id" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset],
        );
        sendJson(res, 200, { success: true, total: total.rows[0].n, feedback: rows.rows.map(toFeedbackRow) });
      } catch (err) {
        logError(`admin feedback list: lỗi DB message=${err.message}`);
        sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
      }
      return;
    }
    const fbOne = /^\/api\/admin\/feedback\/([0-9a-f-]{36})$/.exec(path);
    if (method === 'GET' && fbOne) {
      try {
        const r = await pool.query('SELECT * FROM web.feedback WHERE "Id" = $1', [fbOne[1]]);
        if (r.rowCount === 0) { sendJson(res, 404, { success: false, message: 'Không tìm thấy góp ý này.' }); return; }
        sendJson(res, 200, { success: true, feedback: toFeedbackRow(r.rows[0]) });
      } catch (err) {
        logError(`admin feedback ${fbOne[1]}: lỗi DB message=${err.message}`);
        sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
      }
      return;
    }
    const fbStatus = /^\/api\/admin\/feedback\/([0-9a-f-]{36})\/status$/.exec(path);
    if (method === 'POST' && fbStatus) {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        sendJson(res, 400, { success: false, message: 'Dữ liệu gửi lên không hợp lệ.' });
        return;
      }
      const status = typeof body.status === 'string' ? body.status.trim() : '';
      if (!FB_STATUSES.has(status)) {
        sendJson(res, 400, { success: false, message: 'Trạng thái phải là mới, đang xử lý hoặc xong.' });
        return;
      }
      try {
        const r = await pool.query(
          'UPDATE web.feedback SET "Status" = $1, "UpdatedAt" = now() WHERE "Id" = $2 RETURNING "LoginName"',
          [status, fbStatus[1]],
        );
        if (r.rowCount === 0) { sendJson(res, 404, { success: false, message: 'Không tìm thấy góp ý này.' }); return; }
        await pool.query(
          'INSERT INTO web.admin_log ("AdminLogin", "Action", "TargetLogin", "Detail") VALUES ($1, $2, $3, $4)',
          [authed.LoginName, 'feedback-status', r.rows[0].LoginName, `đổi trạng thái góp ý ${fbStatus[1]} → ${status}`],
        );
        logInfo(`admin feedback-status: admin=${authed.LoginName} id=${fbStatus[1]} status=${status}`);
        sendJson(res, 200, { success: true, message: 'Đã đổi trạng thái.' });
      } catch (err) {
        logError(`admin feedback-status ${fbStatus[1]}: lỗi DB message=${err.message}`);
        sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
      }
      return;
    }
  }

  logInfo(`${method} ${path} từ ${ip}: không khớp route`);
  sendJson(res, 404, { success: false, message: 'Không tìm thấy.' });
}

async function main() {
  const pool = createPool();
  try {
    await pool.query('SELECT 1');
    logInfo('kết nối PostgreSQL OK');
  } catch (err) {
    logError(`không kết nối được PostgreSQL lúc khởi động: code=${err.code || 'n/a'} message=${err.message} — API vẫn nghe nhưng các route DB sẽ trả lỗi cho tới khi DB sẵn sàng`);
  }
  try {
    await initDb(pool);
  } catch (err) {
    logError(`init schema web lỗi: code=${err.code || 'n/a'} message=${err.message} — service vẫn chạy, các route web.* sẽ lỗi cho tới khi sửa xong`);
  }
  logInfo(`admin logins: ${[...ADMIN_LOGINS].join(', ')}`);

  const server = http.createServer((req, res) => {
    (async () => {
      await route(pool, req, res);
    })().catch((err) => {
      logError(`lỗi không lường trước khi xử lý ${req.method} ${req.url} từ ${clientIp(req)}: ${err.stack || err.message}`);
      if (!res.headersSent) {
        sendJson(res, 500, { success: false, message: 'Hệ thống bận, vui lòng thử lại sau.' });
      } else {
        res.end();
      }
    });
  });
  server.on('error', (err) => {
    logError(`HTTP server error: code=${err.code || 'n/a'} message=${err.message}`);
  });
  server.listen(PORT, HOST, () => {
    logInfo(`nghe tại http://${HOST}:${PORT} (API /api/*, GET /health)`);
  });

  const shutdown = (signal) => {
    logInfo(`nhận ${signal} — đóng server + pool`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logError(`khởi động thất bại: ${err.stack || err.message}`);
  process.exit(1);
});
