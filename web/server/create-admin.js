'use strict';
/**
 * create-admin.js — Tao tai khoan admin cho website MU.
 *
 * Dung dung duong dang ky cua OpenMU (openmu-accounts.js) nen tai khoan
 * tao ra dang nhap game + web duoc ngay. Mat khau tam sinh ngau nhien
 * (9 ky tu chu/so — gioi han game, xem server.js), CHI in ra stdout 1 lan — KHONG ghi vao file nao.
 *
 *   DATABASE_URL=postgres://muweb:<pw>@127.0.0.1:5432/muss20web node create-admin.js [loginName]
 *
 * Ma thoat: 0 = tao xong, 2 = da ton tai, 1 = loi.
 * Neu tai khoan da ton tai: KHONG in mat khau (mat khau cu khong doi).
 */
const crypto = require('crypto');
const { createPool, createAccount } = require('./openmu-accounts');

function tempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 9; i++) pw += chars[crypto.randomInt(chars.length)];
  return pw;
}

async function main() {
  const loginName = process.argv[2] || 'admin';
  const pool = createPool();
  try {
    const password = tempPassword();
    const outcome = await createAccount(pool, { loginName, password, eMail: 'admin@mu.local' });
    if (outcome.result === 'done') {
      console.log(`ADMIN_LOGIN=${loginName}`);
      console.log(`ADMIN_TEMP_PASSWORD=${password}`);
      process.exitCode = 0;
    } else if (outcome.result === 'already_exists') {
      console.error(`tai khoan ${loginName} da ton tai — khong tao moi, khong in mat khau`);
      process.exitCode = 2;
    } else {
      console.error(`khong tao duoc ${loginName}: ${outcome.field}: ${outcome.reason}`);
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`loi: ${err.message}`);
  process.exit(1);
});
