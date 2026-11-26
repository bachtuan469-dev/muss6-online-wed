// fake-presence.js — presence giả cho test-local: trả test0 đang online.
// Chỉ dùng ở local (test tặng thưởng chặn online). Chạy:
//   node scripts/fake-presence.js  (nghe 127.0.0.1:3003)
// GET /presence -> {"online":["test0"]}
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/presence') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ online: ['test0'] }));
  } else {
    res.writeHead(404);
    res.end();
  }
});
server.listen(3003, '127.0.0.1', () => console.log('fake presence on 127.0.0.1:3003 (test0 online)'));
