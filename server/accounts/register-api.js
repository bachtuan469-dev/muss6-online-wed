'use strict';
/**
 * register-api.js — HTTP API đăng ký tài khoản cho OpenMU (lát ACCOUNTS).
 *
 * Tương thích hình dạng API cũ của server Node (mulucdia/server/src/
 * account.js): client chỉ đọc trường `result` trong JSON trả về.
 *   POST /register                      {loginName, password, eMail}
 *   POST /api/player-account/register   {loginName, password, eMail}
 *     -> 200 {result: 'done'}
 *     -> 200 {result: 'already_exists'}
 *     -> 400 {result: 'invalid_input', detail: '<field>: <lý do>'}
 *     -> 500 {result: 'unavailable'}     (lỗi DB — đã log đầy đủ phía server)
 *   GET  /health -> 200 {ok: true, service: 'openmu-register-api'}
 *
 * Mặc định chỉ nghe 127.0.0.1 (REGISTER_API_HOST / REGISTER_API_PORT ghi
 * đè; cổng mặc định 18794 — tránh các cổng stack đang chạy/park). Lát này
 * CHỈ chạy local để kiểm chứng; khi deploy sẽ gắn sau front-proxy theo
 * quyết định của parent.
 *
 * Chống lạm dụng ở mức tối thiểu cho lát này: giới hạn thân request 16KB,
 * timeout đọc thân 10s. Rate-limit/chống spam đăng ký hàng loạt là việc
 * của lát deploy (xem ACCOUNTS-REPORT.md mục CHƯA CHỐT).
 */

const http = require('http');
const { createPool, createAccount } = require('./openmu-accounts');

const HOST = process.env.REGISTER_API_HOST || '127.0.0.1';
const PORT = Number(process.env.REGISTER_API_PORT || 18794);
const MAX_BODY_BYTES = 16 * 1024;
const BODY_TIMEOUT_MS = 10_000;

function ts() {
  return new Date().toISOString();
}

function logInfo(...args) {
  console.log(`[${ts()}] [register-api]`, ...args);
}

function logError(...args) {
  console.error(`[${ts()}] [register-api] ERROR`, ...args);
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
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

async function handleRegister(pool, req, res, remote) {
  let raw;
  try {
    raw = await readBody(req);
  } catch (err) {
    logError(`register từ ${remote}: đọc thân lỗi kind=${err.kind || 'n/a'} message=${err.message}`);
    sendJson(res, 400, { result: 'invalid_input', detail: 'body: không đọc được thân request' });
    return;
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch (err) {
    logError(`register từ ${remote}: JSON không hợp lệ: ${err.message}; body[0..120]=${JSON.stringify(raw.slice(0, 120))}`);
    sendJson(res, 400, { result: 'invalid_input', detail: 'body: không phải JSON hợp lệ' });
    return;
  }

  let outcome;
  try {
    outcome = await createAccount(pool, body);
  } catch (err) {
    // createAccount đã log chi tiết; ở đây log thêm ngữ cảnh HTTP.
    logError(`register từ ${remote}: lỗi hạ tầng khi tạo tài khoản loginName=${JSON.stringify(body && body.loginName)}: ${err.message}`);
    sendJson(res, 500, { result: 'unavailable' });
    return;
  }

  if (outcome.result === 'done') {
    logInfo(`register từ ${remote}: done loginName=${body.loginName} accountId=${outcome.accountId}`);
    sendJson(res, 200, { result: 'done' });
  } else if (outcome.result === 'already_exists') {
    logInfo(`register từ ${remote}: already_exists loginName=${body.loginName} reason=${outcome.reason}`);
    sendJson(res, 200, { result: 'already_exists' });
  } else {
    logInfo(`register từ ${remote}: invalid_input loginName=${JSON.stringify(body && body.loginName)} field=${outcome.field}`);
    sendJson(res, 400, { result: 'invalid_input', detail: `${outcome.field}: ${outcome.reason}` });
  }
}

async function main() {
  const pool = createPool();
  // Kiểm tra kết nối ngay khi khởi động để lỗi cấu hình lộ ra sớm, rõ ràng.
  try {
    await pool.query('SELECT 1');
    logInfo('kết nối PostgreSQL OK');
  } catch (err) {
    logError(`không kết nối được PostgreSQL lúc khởi động: code=${err.code || 'n/a'} message=${err.message} — API vẫn nghe nhưng /register sẽ trả unavailable cho tới khi DB sẵn sàng`);
  }

  const server = http.createServer((req, res) => {
    const remote = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
    const url = new URL(req.url || '/', 'http://localhost');
    (async () => {
      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { ok: true, service: 'openmu-register-api' });
        return;
      }
      if (req.method === 'POST' && (url.pathname === '/register' || url.pathname === '/api/player-account/register')) {
        await handleRegister(pool, req, res, remote);
        return;
      }
      logInfo(`request không khớp route: ${req.method} ${url.pathname} từ ${remote}`);
      sendJson(res, 404, { result: 'unavailable' });
    })().catch((err) => {
      logError(`lỗi không lường trước khi xử lý ${req.method} ${req.url} từ ${remote}: ${err.stack || err.message}`);
      if (!res.headersSent) {
        sendJson(res, 500, { result: 'unavailable' });
      } else {
        res.end();
      }
    });
  });

  server.on('error', (err) => {
    logError(`HTTP server error: code=${err.code || 'n/a'} message=${err.message}`);
  });

  server.listen(PORT, HOST, () => {
    logInfo(`nghe tại http://${HOST}:${PORT} (POST /register, POST /api/player-account/register, GET /health)`);
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
