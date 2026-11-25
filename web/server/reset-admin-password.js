'use strict';
/**
 * reset-admin-password.js — Dat lai mat khau cho 1 tai khoan (mac dinh admin).
 * Dung khi mat khau tam bi mat / can cap lai. Mat khau moi sinh ngau nhien
 * tren may chay script, CHI in ra stdout 1 lan — KHONG ghi vao file nao.
 *
 *   DATABASE_URL=... node reset-admin-password.js [loginName]
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { createPool } = require('./openmu-accounts');

async function main() {
  const loginName = process.argv[2] || 'admin';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 9; i++) pw += chars[crypto.randomInt(chars.length)];
  const hash = await bcrypt.hash(pw, 11);
  const pool = createPool();
  try {
    const r = await pool.query(
      'UPDATE data."Account" SET "PasswordHash" = $1 WHERE "LoginName" = $2',
      [hash, loginName],
    );
    if (r.rowCount === 0) {
      console.error(`khong tim thay tai khoan ${loginName}`);
      process.exitCode = 1;
      return;
    }
    await pool.query(
      'DELETE FROM web.sessions WHERE "AccountId" = (SELECT "Id" FROM data."Account" WHERE "LoginName" = $1)',
      [loginName],
    );
    console.log(`tai khoan ${loginName} da doi mat khau xong — gia tri tam de dang nhap lan dau: ${pw}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`loi: ${err.message}`);
  process.exit(1);
});
