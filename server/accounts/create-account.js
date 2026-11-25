'use strict';
/**
 * create-account.js — CLI tạo tài khoản OpenMU thủ công (dùng cho quản trị
 * local và kiểm chứng).
 *
 *   node create-account.js <loginName> <password> <eMail>
 *   ACC_PW=<password> node create-account.js <loginName> <eMail>
 *     (đưa mật khẩu qua env để tránh lộ trong lịch sử shell / danh sách
 *     tiến trình — cách này nên dùng khi thao tác thật)
 *
 * Mã thoát: 0 = done, 2 = already_exists, 3 = invalid_input, 1 = lỗi khác.
 * Kết quả in dạng JSON một dòng ra stdout; log chi tiết ở stderr qua module.
 */

const { createPool, createAccount } = require('./openmu-accounts');

async function main() {
  const args = process.argv.slice(2);
  let loginName;
  let password;
  let eMail;
  if (process.env.ACC_PW) {
    [loginName, eMail] = args;
    password = process.env.ACC_PW;
  } else {
    [loginName, password, eMail] = args;
  }
  if (!loginName || !password || !eMail) {
    console.error('Cách dùng: node create-account.js <loginName> <password> <eMail>   |   ACC_PW=<password> node create-account.js <loginName> <eMail>');
    process.exit(3);
  }

  const pool = createPool();
  try {
    const outcome = await createAccount(pool, { loginName, password, eMail });
    console.log(JSON.stringify(outcome));
    if (outcome.result === 'done') process.exitCode = 0;
    else if (outcome.result === 'already_exists') process.exitCode = 2;
    else process.exitCode = 3;
  } catch (err) {
    console.error(`[create-account] lỗi: ${err.stack || err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
