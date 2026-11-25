'use strict';
/**
 * test-accounts.js — Kiểm chứng lát ACCOUNTS ở local (DB + HTTP API).
 *
 * Tự khởi động register-api.js trên cổng test riêng (18795), rồi kiểm:
 *   1. Đăng ký tài khoản mới qua HTTP API -> {result:'done'}.
 *   2. Dòng trong DB đúng mọi giá trị mặc định của OpenMU + hash $2a$11$
 *      dài 60 + bcrypt.compare khớp (đúng phép kiểm OpenMU dùng).
 *   3. Đăng ký trùng nguyên văn -> {result:'already_exists'}.
 *   4. Đăng ký trùng chỉ khác hoa/thường -> {result:'already_exists'}.
 *   5. Đầu vào sai (tên ngắn / tên có ký tự lạ / mật khẩu ngắn / mật khẩu
 *      21 ký tự / email sai dạng) -> 400 {result:'invalid_input'}.
 *   6. Kiểm mật khẩu sai ngoại tuyến -> không khớp.
 * Thông tin tài khoản test được ghi vào .test-account.json (chỉ local) để
 * bước kiểm chứng đăng nhập qua GameServer (replay-proof.js) dùng tiếp.
 *
 * Điều kiện: PostgreSQL local đang chạy và DB openmu tồn tại.
 * Mã thoát: 0 = mọi kiểm đều PASS, 1 = có FAIL/lỗi.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createPool, getAccountSummary, verifyPassword } = require('./openmu-accounts');

const API_PORT = Number(process.env.TEST_API_PORT || 18795);
const API_BASE = `http://127.0.0.1:${API_PORT}`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`CHECK ${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) return true;
    } catch {
      // API chưa lên — thử lại.
    }
    await sleep(300);
  }
  return false;
}

async function postRegister(payload) {
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function main() {
  const suffix = String(Math.floor(10000 + Math.random() * 89999)); // 5 chữ số
  const loginName = `web${suffix}`; // 8 ký tự chữ/số — hợp lệ
  const password = `Pw${suffix}x`; // 9 ký tự
  const eMail = `${loginName}@example.com`;
  console.log(`Tài khoản test của lát này: loginName=${loginName} eMail=${eMail} (mật khẩu chỉ ghi trong .test-account.json local)`);

  const apiChild = spawn(process.execPath, [path.join(__dirname, 'register-api.js')], {
    env: { ...process.env, REGISTER_API_PORT: String(API_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  apiChild.stdout.on('data', (d) => process.stdout.write(`[api] ${d}`));
  apiChild.stderr.on('data', (d) => process.stderr.write(`[api] ${d}`));

  const pool = createPool();
  try {
    const healthy = await waitForHealth();
    check('API khởi động + /health', healthy, healthy ? `nghe tại ${API_BASE}` : `không thấy /health sau 20s`);
    if (!healthy) throw new Error('API không lên — dừng kiểm chứng');

    // 1) Đăng ký mới
    const reg = await postRegister({ loginName, password, eMail });
    check('POST /register tài khoản mới', reg.status === 200 && reg.json && reg.json.result === 'done',
      `status=${reg.status} body=${JSON.stringify(reg.json)}`);

    // 2) Kiểm dòng DB
    const row = await getAccountSummary(pool, loginName);
    check('Dòng Account tồn tại', !!row, row ? `Id=${row.Id}` : 'không tìm thấy');
    if (row) {
      check('Hash BCrypt đúng định dạng OpenMU', /^\$2[ab]\$11\$$/.test(row.HashPrefix) && row.HashLength === 60,
        `prefix=${row.HashPrefix} length=${row.HashLength} (OpenMU tự tạo: $2a$11$; bcryptjs: $2b$11$ — chốt bằng đăng nhập GameServer)`);
      check('State = 0 (Normal)', row.State === 0, `State=${row.State}`);
      check('EMail đã lưu', row.EMail === eMail, `EMail=${row.EMail}`);
      check("SecurityCode/VaultPassword rỗng", row.SecurityCode === '' && row.VaultPassword === '',
        `SecurityCode=${JSON.stringify(row.SecurityCode)} VaultPassword=${JSON.stringify(row.VaultPassword)}`);
      check('Vault có sẵn, Money = 0', !!row.VaultId && row.VaultMoney === 0,
        `VaultId=${row.VaultId} VaultMoney=${row.VaultMoney}`);
      check('Các trường phụ đúng mặc định', row.IsVaultExtended === false && row.LanguageIsoCode === 'en'
        && row.TimeZone === 0 && row.WCoinC === 0 && row.WCoinP === 0 && row.GoblinPoints === 0
        && row.IsTemplate === false && row.IsBot === false,
        `IsVaultExtended=${row.IsVaultExtended} Lang=${row.LanguageIsoCode} TZ=${row.TimeZone} WCoinC=${row.WCoinC} WCoinP=${row.WCoinP} Goblin=${row.GoblinPoints} IsTemplate=${row.IsTemplate} IsBot=${row.IsBot}`);
    }
    const verifyOk = await verifyPassword(pool, loginName, password);
    check('bcrypt.compare mật khẩu đúng (phép kiểm của OpenMU)', verifyOk.found && verifyOk.match,
      `found=${verifyOk.found} match=${verifyOk.match}`);

    // 3) Trùng nguyên văn
    const dup = await postRegister({ loginName, password, eMail });
    check('Đăng ký trùng nguyên văn bị chặn', dup.status === 200 && dup.json && dup.json.result === 'already_exists',
      `status=${dup.status} body=${JSON.stringify(dup.json)}`);

    // 4) Trùng khác hoa/thường
    const dupCase = await postRegister({ loginName: loginName.toUpperCase(), password, eMail });
    check('Đăng ký trùng khác hoa/thường bị chặn', dupCase.status === 200 && dupCase.json && dupCase.json.result === 'already_exists',
      `status=${dupCase.status} body=${JSON.stringify(dupCase.json)}`);

    // 5) Đầu vào sai
    const invalidCases = [
      ['tên quá ngắn (2 ký tự)', { loginName: 'ab', password, eMail }],
      ['tên có ký tự lạ', { loginName: 'bad name!', password, eMail }],
      ['tên quá dài (11 ký tự)', { loginName: 'a1234567890', password, eMail }],
      ['mật khẩu quá ngắn (2 ký tự)', { loginName: 'valid01', password: 'ab', eMail }],
      ['mật khẩu quá dài (21 ký tự)', { loginName: 'valid01', password: 'x'.repeat(21), eMail }],
      ['email sai dạng', { loginName: 'valid01', password, eMail: 'not-an-email' }],
    ];
    for (const [label, payload] of invalidCases) {
      const res = await postRegister(payload);
      check(`invalid_input: ${label}`, res.status === 400 && res.json && res.json.result === 'invalid_input',
        `status=${res.status} body=${JSON.stringify(res.json)}`);
    }

    // 6) Mật khẩu sai
    const verifyBad = await verifyPassword(pool, loginName, `${password}_sai`);
    check('bcrypt.compare mật khẩu sai -> không khớp', verifyBad.found && verifyBad.match === false,
      `found=${verifyBad.found} match=${verifyBad.match}`);

    // Lưu thông tin cho bước đăng nhập qua GameServer (replay-proof.js).
    const credPath = path.join(__dirname, '.test-account.json');
    fs.writeFileSync(credPath, JSON.stringify({ loginName, password, eMail }, null, 2));
    console.log(`Đã ghi thông tin tài khoản test vào ${credPath} (chỉ local, phục vụ bước replay đăng nhập)`);
  } finally {
    apiChild.kill('SIGTERM');
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`TỔNG KẾT test-accounts: ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`[test-accounts] lỗi: ${err.stack || err.message}`);
  process.exit(1);
});
