'use strict';
/**
 * openmu-accounts.js — Module cấp tài khoản người chơi cho OpenMU.
 *
 * Ghi trực tiếp vào PostgreSQL của OpenMU, đúng schema và đúng định dạng
 * mà OpenMU tự dùng khi tạo tài khoản mẫu. Mọi khẳng định dưới đây đều có
 * nguồn trong source OpenMU (clone tại ~/workspace/muss20-web/openmu/) —
 * xem ACCOUNTS-REPORT.md để có bảng trích dẫn đầy đủ.
 *
 * Schema (đo thật từ DB local + migration gốc):
 *   - Bảng data."Account" (19 cột), khoá chính Id (uuid), chỉ mục DUY NHẤT
 *     IX_Account_LoginName trên "LoginName" (varchar(10), NOT NULL).
 *     Nguồn model: src/Persistence/EntityFramework/Extensions/ModelBuilder/
 *     AccountExtensions.cs:23 (HasIndex(LoginName).IsUnique()).
 *   - Vault: cột VaultId (uuid, FK -> data."ItemStorage"."Id", có chỉ mục
 *     duy nhất riêng). ItemStorage chỉ có 2 cột: Id (uuid), Money (int).
 *   - Mật khẩu: BCrypt. OpenMU tạo bằng BCrypt.Net.BCrypt.HashPassword(pw)
 *     KHÔNG truyền work factor (AccountInitializerBase.cs:92,
 *     VersionSeasonSix/TestAccounts) với BCrypt.Net-Next 4.0.3
 *     (src/Directory.Packages.props:7) -> hash trong DB thật có tiền tố
 *     $2a$11$ dài 60 ký tự (đo từ các tài khoản test0..test9) => cost = 11.
 *   - OpenMU kiểm mật khẩu lúc đăng nhập bằng BCrypt.Verify(password, hash)
 *     (src/Persistence/EntityFramework/AccountRepository.cs:155 và :197).
 *     Tra cứu tài khoản bằng so sánh ĐÚNG nguyên văn "LoginName" == loginName
 *     (AccountRepository.cs:149/:191) -> PostgreSQL phân biệt hoa/thường.
 *   - Trạng thái: State = 0 (AccountState.Normal, DataModel/Entities/
 *     Account.cs). Banned = 4 / TemporarilyBanned = 5 bị LoginAction chặn
 *     (GameLogic/PlayerActions/LoginAction.cs, ValidateAccountStateAsync).
 *   - Vault NULL vẫn đăng nhập/vào game được (GameServer tự tạo ItemStorage
 *     khi cần: GameLogic/PlayerActions/TalkNpcAction.cs:109,
 *     GameLogic/PlayerStorages.cs:214), nhưng module này vẫn tạo sẵn
 *     ItemStorage rỗng (Money = 0) để giống hệt đường khởi tạo của OpenMU.
 *
 * Ràng buộc đầu vào (khớp cả 3 nguồn: cột DB, gói đăng nhập, API cũ):
 *   - loginName: 3-10 ký tự chữ/số ASCII. Cột varchar(10); trường Username
 *     trong gói LoginLongPassword là Binary[10] tại offset 4
 *     (src/Network/Packets/ClientToServer/ClientToServerPackets.xml);
 *     API cũ của server Node cũng dùng /^[A-Za-z0-9]{3,10}$/
 *     (mulucdia/server/src/account.js).
 *   - password: 3-9 ký tự VÀ <= 9 byte UTF-8. Game đăng nhập bằng gói
 *     LoginShortPassword, trường Password 10 byte — mật khẩu dài đúng 10 ký
 *     tự bị GameServer trả InvalidPassword (đo thật trên game live
 *     2026-11-25: 9 ký tự Okay, 10 ký tự fail). Điều kiện byte là bổ sung
 *     của module này: server trích chuỗi UTF-8 từ đúng 10 byte trên dây,
 *     mật khẩu nhiều byte hơn sẽ bị cắt lặng lẽ và không bao giờ đăng nhập
 *     lại được bằng bản đầy đủ.
 *   - eMail: dạng user@domain.tld (cùng biểu thức của API cũ), <= 254 ký tự.
 *     Cột EMail là text NOT NULL — tài khoản mẫu của OpenMU để ''.
 *
 * Chính sách trùng tên (quyết định của module này, ghi rõ để parent xét):
 *   ngoài trùng nguyên văn (DB tự chặn bằng chỉ mục duy nhất), module còn
 *   chặn trùng KHÔNG phân biệt hoa/thường (vd. đã có "Test01" thì không
 *   cho đăng ký "test01"), vì người chơi web gõ tên đăng nhập không ổn
 *   định hoa/thường và OpenMU tra cứu phân biệt hoa/thường — hai tài khoản
 *   chỉ khác hoa/thường sẽ gây nhầm lẫn không đáng có.
 *
 * Lỗi: mọi lỗi đều được log đầy đủ ngữ cảnh (thao tác, loginName, mã lỗi
 * PostgreSQL) ra stderr rồi mới ném/trả kết quả — không nuốt lỗi.
 * KHÔNG bao giờ log mật khẩu thô hay hash đầy đủ (chỉ tiền tố $2a$11$).
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

/** Work factor BCrypt — khớp hash OpenMU tự tạo ($2a$11$, đo từ DB). */
const BCRYPT_COST = 11;

const LOGIN_NAME_RE = /^[A-Za-z0-9]{3,10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

function ts() {
  return new Date().toISOString();
}

function logInfo(...args) {
  console.log(`[${ts()}] [accounts]`, ...args);
}

function logError(...args) {
  console.error(`[${ts()}] [accounts] ERROR`, ...args);
}

/**
 * Cấu hình kết nối PostgreSQL.
 * Ưu tiên DATABASE_URL; nếu không, dùng các biến OPENMU_PG* (host
 * 127.0.0.1, db "openmu", user "postgres" theo ConnectionSettings.xml
 * của OpenMU). Mật khẩu KHÔNG có giá trị mặc định: phải đặt
 * OPENMU_PGPASSWORD (hoặc DATABASE_URL) — thiếu là báo lỗi rõ ràng
 * thay vì lặng lẽ dùng mật khẩu mặc định.
 */
function loadConfig(env = process.env) {
  if (env.DATABASE_URL) {
    return { connectionString: env.DATABASE_URL, source: 'DATABASE_URL' };
  }
  if (env.OPENMU_PGPASSWORD === undefined) {
    throw new Error('Thiếu cấu hình DB: đặt DATABASE_URL hoặc OPENMU_PGPASSWORD (xem .env.example)');
  }
  return {
    host: env.OPENMU_PGHOST || '127.0.0.1',
    port: Number(env.OPENMU_PGPORT || 5432),
    database: env.OPENMU_PGDATABASE || 'openmu',
    user: env.OPENMU_PGUSER || 'postgres',
    password: env.OPENMU_PGPASSWORD,
    source: 'OPENMU_PG*',
  };
}

function createPool(env = process.env) {
  const config = loadConfig(env);
  const pool = new Pool(config);
  pool.on('error', (err) => {
    // Lỗi ở client nhàn rỗi của pool — log rõ, không để sập tiến trình.
    logError(`pool idle client error: code=${err.code || 'n/a'} message=${err.message}`);
  });
  logInfo(`pool sẵn sàng: ${config.source}; đích=${config.connectionString ? '(connection string)' : `${config.user}@${config.host}:${config.port}/${config.database}`}`);
  return pool;
}

/**
 * Validate dữ liệu đăng ký.
 * @param {{loginName?: unknown, password?: unknown, eMail?: unknown}} input
 * @returns {{ok: true, value: {loginName: string, password: string, eMail: string}}
 *          | {ok: false, field: string, reason: string}}
 */
function validateRegistration(input) {
  if (!input || typeof input !== 'object') {
    return { ok: false, field: 'body', reason: 'body phải là object JSON {loginName, password, eMail}' };
  }
  const { loginName, password, eMail } = input;

  if (typeof loginName !== 'string' || !LOGIN_NAME_RE.test(loginName)) {
    return {
      ok: false,
      field: 'loginName',
      reason: 'loginName phải là 3-10 ký tự chữ/số ASCII (cột varchar(10) + trường gói đăng nhập Binary[10])',
    };
  }

  if (typeof password !== 'string' || password.length < 3 || password.length > 9) {
    return { ok: false, field: 'password', reason: 'password phải là 3-9 ký tự (game chỉ nhận tối đa 9 ký tự qua gói đăng nhập ngắn)' };
  }
  if (Buffer.byteLength(password, 'utf8') > 9) {
    return {
      ok: false,
      field: 'password',
      reason: 'password vượt quá 9 byte UTF-8 — sẽ bị cắt trên dây đăng nhập (trường 10 byte)',
    };
  }

  if (typeof eMail !== 'string' || eMail.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(eMail)) {
    return { ok: false, field: 'eMail', reason: 'eMail phải có dạng user@domain.tld, tối đa 254 ký tự' };
  }

  return { ok: true, value: { loginName, password, eMail } };
}

/**
 * Tạo tài khoản mới trong DB OpenMU.
 * Đầu vào phải đã qua validateRegistration (hàm này tự validate lại để
 * dùng độc lập qua CLI cũng an toàn).
 *
 * @param {import('pg').Pool} pool
 * @param {{loginName: string, password: string, eMail: string}} input
 * @returns {Promise<{result: 'done', accountId: string, vaultId: string}
 *                  | {result: 'already_exists', reason: 'exact'|'case_variant'|'unique_violation', existing?: string}
 *                  | {result: 'invalid_input', field: string, reason: string}>}
 * @throws {Error} khi lỗi hạ tầng (DB sập, v.v.) — đã log trước khi ném.
 */
async function createAccount(pool, input) {
  const validation = validateRegistration(input);
  if (!validation.ok) {
    logError(`createAccount bị chặn ở validate: field=${validation.field} reason=${validation.reason} loginName=${JSON.stringify(input && input.loginName)}`);
    return { result: 'invalid_input', field: validation.field, reason: validation.reason };
  }
  const { loginName, password, eMail } = validation.value;

  // Băm trước khi mở giao dịch (BCrypt cost 11 mất ~0.2-0.3s, không giữ
  // khoá DB trong lúc băm).
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  // Lưu ý định dạng: hash OpenMU tự tạo có tiền tố $2a$11$ (đo từ DB),
  // còn bcryptjs 3.x sinh $2b$11$. Khác biệt 2a/2b chỉ là nhãn phiên bản
  // thuật toán (2b sửa lỗi tràn dấu của bản C gốc với mật khẩu chứa byte
  // NUL); với mật khẩu ASCII thông thường, phần hash tính ra giống hệt
  // khi cùng salt, và BCrypt.Net-Next Verify chấp nhận cả hai tiền tố.
  // Tính tương thích thật được chốt bằng kiểm chứng đăng nhập qua
  // GameServer trong lát này (xem ACCOUNTS-REPORT.md) — ở đây chỉ chặn
  // các định dạng ngoài $2[ab]$11$ / khác 60 ký tự.
  if (!/^\$2[ab]\$11\$/.test(passwordHash) || passwordHash.length !== 60) {
    const err = new Error(`hash BCrypt sinh ra có định dạng lạ: prefix=${passwordHash.slice(0, 7)} length=${passwordHash.length} (kỳ vọng $2a$11$ hoặc $2b$11$, 60 ký tự)`);
    logError(`createAccount loginName=${loginName}: ${err.message}`);
    throw err;
  }

  const accountId = randomUUID();
  const vaultId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const exact = await client.query('SELECT "Id" FROM data."Account" WHERE "LoginName" = $1', [loginName]);
    if (exact.rowCount > 0) {
      await client.query('ROLLBACK');
      logInfo(`createAccount loginName=${loginName}: already_exists (trùng nguyên văn)`);
      return { result: 'already_exists', reason: 'exact' };
    }

    const caseVariant = await client.query(
      'SELECT "LoginName" FROM data."Account" WHERE lower("LoginName") = lower($1) LIMIT 1',
      [loginName],
    );
    if (caseVariant.rowCount > 0) {
      await client.query('ROLLBACK');
      logInfo(`createAccount loginName=${loginName}: already_exists (trùng không phân biệt hoa/thường với "${caseVariant.rows[0].LoginName}")`);
      return { result: 'already_exists', reason: 'case_variant', existing: caseVariant.rows[0].LoginName };
    }

    await client.query('INSERT INTO data."ItemStorage" ("Id", "Money") VALUES ($1, 0)', [vaultId]);
    await client.query(
      `INSERT INTO data."Account" (
         "Id", "VaultId", "LoginName", "PasswordHash", "SecurityCode", "EMail",
         "RegistrationDate", "State", "TimeZone", "VaultPassword", "IsVaultExtended",
         "ChatBanUntil", "IsTemplate", "LanguageIsoCode", "IsBot",
         "IsNetworkObservationActive", "GoblinPoints", "WCoinC", "WCoinP")
       VALUES ($1, $2, $3, $4, '', $5, now(), 0, 0, '', false,
               NULL, false, 'en', false, false, 0, 0, 0)`,
      [accountId, vaultId, loginName, passwordHash, eMail],
    );
    await client.query('COMMIT');
    logInfo(`createAccount loginName=${loginName}: done accountId=${accountId} vaultId=${vaultId} hashPrefix=${passwordHash.slice(0, 7)}`);
    return { result: 'done', accountId, vaultId };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logError(`createAccount loginName=${loginName}: ROLLBACK cũng lỗi: code=${rollbackErr.code || 'n/a'} message=${rollbackErr.message}`);
    }
    if (err && err.code === '23505') {
      // Đua song song: một tiến trình khác vừa chèn cùng LoginName/VaultId.
      logInfo(`createAccount loginName=${loginName}: already_exists (unique_violation constraint=${err.constraint || 'n/a'})`);
      return { result: 'already_exists', reason: 'unique_violation' };
    }
    logError(`createAccount loginName=${loginName}: lỗi DB code=${(err && err.code) || 'n/a'} message=${err && err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Đọc lại dòng tài khoản (phục vụ kiểm chứng). Trả null nếu không có.
 * Không trả PasswordHash đầy đủ — chỉ tiền tố + độ dài.
 */
async function getAccountSummary(pool, loginName) {
  const res = await pool.query(
    `SELECT a."Id", a."LoginName", a."EMail", a."State", a."SecurityCode", a."VaultPassword",
            a."VaultId", a."IsVaultExtended", a."LanguageIsoCode", a."TimeZone",
            a."WCoinC", a."WCoinP", a."GoblinPoints", a."IsTemplate", a."IsBot",
            a."RegistrationDate",
            left(a."PasswordHash", 7) AS "HashPrefix", length(a."PasswordHash") AS "HashLength",
            v."Money" AS "VaultMoney"
       FROM data."Account" a
       LEFT JOIN data."ItemStorage" v ON v."Id" = a."VaultId"
      WHERE a."LoginName" = $1`,
    [loginName],
  );
  return res.rowCount > 0 ? res.rows[0] : null;
}

/**
 * Kiểm tra mật khẩu theo đúng cách OpenMU làm (BCrypt.Verify tương đương
 * bcrypt.compare) — dùng cho kiểm chứng ngoại tuyến, không thay đăng nhập
 * qua GameServer.
 */
async function verifyPassword(pool, loginName, password) {
  const res = await pool.query('SELECT "PasswordHash" FROM data."Account" WHERE "LoginName" = $1', [loginName]);
  if (res.rowCount === 0) {
    return { found: false, match: false };
  }
  const match = await bcrypt.compare(password, res.rows[0].PasswordHash);
  return { found: true, match };
}

module.exports = {
  BCRYPT_COST,
  LOGIN_NAME_RE,
  EMAIL_RE,
  loadConfig,
  createPool,
  validateRegistration,
  createAccount,
  getAccountSummary,
  verifyPassword,
};
