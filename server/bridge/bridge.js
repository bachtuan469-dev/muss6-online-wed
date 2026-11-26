'use strict';
/**
 * Cầu nối WS<->TCP cho client web MU Lục Địa <-> OpenMU — LÁT 2a
 * (dự án muss20-web, 2026-11-20).
 *
 * Khác cầu nối cũ (~/workspace/mulucdia/server/src/bridge.js — relay
 * nguyên dạng theo ?host=&port=, KHÔNG sửa ở đây): cầu nối này là một
 * BỘ DỊCH GIAO THỨC đứng giữa client web và OpenMU:
 *
 *   Client web --WS /mu--> [bridge] --TCP--> OpenMU ConnectServer :44406
 *                                        \-> OpenMU GameServer (theo F4 03)
 *
 * Việc cầu nối làm:
 *  1. WS mở -> gửi text "open" ngay (client chỉ so 4 byte đầu — SPEC §2).
 *  2. Mở TCP tới ConnectServer OpenMU (mặc định 127.0.0.1:44406 — cổng
 *     của định nghĩa "Open Source Client", PROOF-1 §2 mục 7).
 *  3. Chân CS: gói hai chiều là PLAINTEXT (PROOF-1 §2 mục 6) -> relay
 *     nguyên dạng; đồng thời bóc khung chiều S->C để THEO DÕI gói
 *     F4 03 ConnectionInfo. Khi thấy F4 03: đóng TCP CS, mở TCP tới
 *     GameServer theo host:port trong gói (host loopback/địa chỉ local
 *     -> map về OPENMU_HOST, mặc định 127.0.0.1; giữ nguyên port),
 *     reset trạng thái mã hoá, chuyển tiếp tiếp trên CÙNG kết nối WS.
 *     (Tương thích thêm: nếu client mở WS mới với ?host=&port= trỏ
 *     thẳng một cổng GameServer — hành vi Main.js tự thêm query, xem
 *     public/index.html của stack cũ — cầu nối nối thẳng TCP tới đó
 *     và vào chân GS ngay.)
 *  4. Chân GS, chiều client->server: client web gửi HỖN HỢP hai dạng
 *     (SPEC §7.17 bản vá 2): gói C1/C2 tầng native qua XOR-filter móc
 *     xích, gói tầng managed đi RAW (F3 0D, F1 01 C1); gói C3/C4 mã hoá
 *     SimpleModulus với plaintext có thể đã/không qua XOR-filter.
 *     OpenMU thì luôn kỳ vọng dạng chuẩn S6 (PipelinedDecryptor: gỡ
 *     SimpleModulus rồi gỡ XOR32 — PROOF-1 §2 mục 19/20). Cầu nối vì
 *     vậy CHUẨN HOÁ từng gói: khôi phục plaintext (logic latch §7.17
 *     port từ gameserver.js của stack cũ — chỉ khôi phục, không route)
 *     -> DỊCH (F3 0D -> F3 00; tuỳ chọn XOR3-hoá login) -> mã hoá lại
 *     bằng MuConnection cấu hình client thật (Enc1 + XOR-filter) ->
 *     ghi TCP. Counter SimpleModulus hai phía độc lập: phía client
 *     theo inSeq của nó, phía OpenMU theo outSeq riêng của cầu nối
 *     bắt đầu từ 0 trên kết nối TCP mới.
 *  5. Chân GS, chiều server->client: OpenMU gửi đúng định dạng client
 *     nhận (C1/C2 plaintext, C3/C4 SimpleModulus không filter — bất
 *     đối xứng đã chứng minh, PROOF-1 §4) -> relay nguyên dạng.
 *
 * DỊCH F3 0D -> F3 00 (điểm lệch duy nhất PROOF-1 chốt): client web
 * không gửi F3 00 xin DS nhân vật mà gửi C1 F3 0D (payload 0x15);
 * OpenMU không có handler F3 0D (bỏ qua im lặng). Cầu nối đổi đúng 1
 * byte subcode 0x0D -> 0x00 trên PLAINTEXT, giữ nguyên payload (byte
 * 0x15 rơi vào trường Language của RequestCharacterList — vô hại,
 * PROOF-1 §2 mục 13).
 *
 * CÔNG TẮC LOGIN_XOR3 (env BRIDGE_LOGIN_XOR3=on, mặc định TẮT):
 * OpenMU luôn giải Xor3 (FC CF AB) cho 2 trường Username/Password của
 * LoginLongPassword (PROOF-1 §2 mục 11). CHƯA CHỐT client thật gửi 2
 * trường này dạng plain hay XOR3 (replay lát 1 gửi XOR3 -> OK). Nếu
 * client thật gửi plain, bật công tắc này để cầu nối XOR3-hoá trường
 * username [4..14) + password [14..34) của gói login 60B trước khi mã
 * hoá lại. Layout khác 60B: KHÔNG áp dụng + log WARN (CHƯA CHỐT
 * layout). Dù công tắc tắt, cầu nối vẫn LOG chẩn đoán: 2 trường trông
 * giống plain hay XOR3 (chỉ log dạng, KHÔNG log mật khẩu).
 *
 * Log: mọi gói hai chiều đều log (hướng, chân, độ dài, hex rút gọn 24
 * byte đầu; chiều C->S thêm plaintext + đường khôi phục), sự kiện
 * dịch/chuyển chân/latch log riêng, lỗi log đầy đủ ngữ cảnh — không
 * chặn lặng lẽ gói nào: gói không khôi phục được thì log ERROR kèm hex
 * và ĐÓNG kết nối (không đoán bừa để chuyển tiếp).
 *
 * Cấu hình qua env:
 *   BRIDGE_PORT       (mặc định 8792)
 *   BRIDGE_HOST       (mặc định 0.0.0.0)
 *   OPENMU_HOST       (mặc định 127.0.0.1) — host map cho địa chỉ local
 *   OPENMU_CS_PORT    (mặc định 44406)
 *   BRIDGE_LOGIN_XOR3 ('on' để bật; mặc định tắt)
 *
 * Chạy: `node bridge.js` (trong thư mục này; cần `npm install` trước
 * để có module 'ws'). Thư viện gói MU: import bằng đường dẫn từ
 * ~/workspace/mulucdia/server/src/packet/ (chỉ đọc, không sửa).
 */
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { WebSocketServer, WebSocket } = require('ws');

const PKT = require(path.join(__dirname, '..', '..', 'mulucdia', 'server', 'src', 'packet'));
const {
  MuConnection,
  parsePackets,
  headerLen,
  defaultHasSubcode,
  removeXorFilter,
  ENC_RUNTIME_KEY,
  DEC_RUNTIME_KEY,
  DEC_KEY_FOR_ENC1,
  ENC_KEY_FOR_DEC2,
} = PKT;

// ---------------------------------------------------------------------------
// Cấu hình
// ---------------------------------------------------------------------------
const BRIDGE_PORT = Number(process.env.BRIDGE_PORT ?? 8792);
const BRIDGE_HOST = process.env.BRIDGE_HOST ?? '0.0.0.0';
const OPENMU_HOST = process.env.OPENMU_HOST ?? '127.0.0.1';
const OPENMU_CS_PORT = Number(process.env.OPENMU_CS_PORT ?? 44406);
const LOGIN_XOR3_ON = String(process.env.BRIDGE_LOGIN_XOR3 ?? 'off').toLowerCase() === 'on';
const TCP_CONNECT_TIMEOUT_MS = 10_000;
const HEX_LOG_BYTES = 24; // hex rút gọn khi log gói

// ---------------------------------------------------------------------------
// Hằng số port từ stack cũ (SPEC §7.17 / gameserver.js — chỉ là DỮ LIỆU
// bảng subcode + phân loại latch; logic route của server cũ KHÔNG dùng
// ở đây, cầu nối chỉ khôi phục plaintext).
// ---------------------------------------------------------------------------
// Tập subcode thật của các họ handler tự đọc subcode — dùng để phân
// biệt bản plain với bản đã qua XOR-filter: subcode bản filtered =
// subcode thật ^ opcode ^ TABLE[3] (C1), phép biến đổi này không ánh
// xạ các tập dưới đây vào chính nó (đã kiểm từng họ ở stack cũ; riêng
// F3 có cặp 0x00<->0x0D cùng là char-list — xử lý riêng bằng luật
// MANAGED_RAW/F3 00 bên dưới).
const XOR_FAMILY_SUBCODES = {
  0xf3: new Set([0x00, 0x01, 0x02, 0x03, 0x06, 0x0d, 0x10, 0x12, 0x15, 0x16, 0x30, 0x52]),
  0xf1: new Set([0x01, 0x02, 0x06]),
  0xf6: new Set([0x0a, 0x0b, 0x0d, 0x0f, 0x10, 0x1a, 0x1b, 0x21, 0x30, 0x31]),
  0xf7: new Set([0x01]),
  0xf8: new Set([0x01, 0x03, 0x09, 0x0b]),
  0xaf: new Set([0x01]),
  0xb2: new Set([0x00, 0x01, 0x02, 0x03]),
  0xbd: new Set([0x00, 0x03, 0x09]),
  0xbf: new Set([0x00, 0x0e, 0x20, 0x51]),
  0xd1: new Set([0x00, 0x01, 0x10]),
  0xd2: new Set([0x01, 0x03, 0x04, 0x05, 0x0a, 0x0b]),
};
// Opcode tuy có byte subcode trên dây nhưng xếp nhóm CHỈ-OPCODE cho
// mục đích latch (handler route thuần theo opcode / mơ hồ) — port từ
// XOR_LATCH_OPCODE_ONLY của gameserver.js (SPEC §7.17 bản vá 2).
const XOR_LATCH_OPCODE_ONLY = new Set([0x00, 0x01, 0x05, 0x83, 0xeb]);
// Opcode C3/C4 C->S đã biết (framing CLIENT_SUBCODE_OPCODES + các
// parser plaintext của gameserver.js: 03 checksum, 24 move item,
// 30/32/33 talk/buy/sell, 36 trade) — dùng chấm điểm khôi phục
// plaintext C3/C4 (bản filtered hay bản raw).
const KNOWN_C3_OPCODES = new Set([
  0x03, 0x0e, 0x24, 0x30, 0x32, 0x33, 0x36, 0x3f, 0x73, 0xaa, 0xb1, 0xf1, 0xf3,
]);
const XOR3 = [0xfc, 0xcf, 0xab];

// ---------------------------------------------------------------------------
// Tiện ích log
// ---------------------------------------------------------------------------
function ts() { return new Date().toISOString(); }
function log(...args) { console.log(`[bridge2a ${ts()}]`, ...args); }
function logErr(...args) { console.error(`[bridge2a ${ts()}]`, ...args); }
function shortHex(buf) {
  const b = Buffer.from(buf);
  const h = b.subarray(0, HEX_LOG_BYTES).toString('hex');
  return b.length > HEX_LOG_BYTES ? `${h}..` : h;
}
/** Gói S->C ConnectionInfo của ConnectServer: C1, F4 03, tối thiểu
 * 22 byte (4 header + 16 host + 2 port LE). */
function isConnectionInfo(p) {
  return p.length >= 22 && p[0] === 0xc1 && p[2] === 0xf4 && p[3] === 0x03;
}
function isPrintableField(buf) {
  // Trường cố định, đệm NUL: các byte khác NUL phải là ASCII in được.
  let seen = false;
  for (const c of buf) {
    if (c === 0) continue;
    if (c < 0x20 || c > 0x7e) return false;
    seen = true;
  }
  return seen;
}
function xor3FieldCopy(field) {
  const out = Buffer.from(field);
  for (let i = 0; i < out.length; i++) out[i] ^= XOR3[i % 3];
  return out;
}
function isLocalHost(h) {
  if (!h) return true;
  const s = String(h).trim().toLowerCase();
  return s === 'localhost' || s === '::1' || s === '0.0.0.0' || s.startsWith('127.');
}
/** Map host do client/OpenMU đưa (loopback/địa chỉ local) về OPENMU_HOST. */
function normalizeUpstreamHost(h) {
  if (isLocalHost(h)) return OPENMU_HOST;
  return String(h).trim();
}

// ---------------------------------------------------------------------------
// Bóc khung thô (chỉ theo head + size, không diễn giải subcode) — dùng
// cho chiều S->C để theo dõi F4 03 trên chân CS và log gói.
// ---------------------------------------------------------------------------
class RawFramer {
  constructor() { this.buf = Buffer.alloc(0); }
  feed(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    const out = [];
    for (;;) {
      if (this.buf.length < 2) break;
      const head = this.buf[0];
      let size = -1;
      if (head === 0xc1 || head === 0xc3) size = this.buf[1];
      else if (head === 0xc2 || head === 0xc4) {
        if (this.buf.length < 3) break;
        size = this.buf.readUInt16BE(1);
      } else {
        throw new Error(`head lạ 0x${head.toString(16)} — mất đồng bộ framing S->C, buf=${shortHex(this.buf)}`);
      }
      if (size < 2 || this.buf.length < size) break;
      out.push(Buffer.from(this.buf.subarray(0, size)));
      this.buf = this.buf.subarray(size);
    }
    return out;
  }
  get leftover() { return this.buf; }
}

// ---------------------------------------------------------------------------
// Phân loại latch cho gói C1/C2 (port packetHasSubcodeForLatch của
// gameserver.js — SPEC §7.17 bản vá 2).
// ---------------------------------------------------------------------------
function packetHasSubcodeForLatch(pkt) {
  if (!defaultHasSubcode(pkt.head, pkt.opcode)) return false;
  if (pkt.head === 0xc1 && XOR_LATCH_OPCODE_ONLY.has(pkt.opcode)) return false;
  return pkt.subcode !== null && pkt.subcode !== undefined;
}

// ---------------------------------------------------------------------------
// Tạo cầu nối
// ---------------------------------------------------------------------------
let nextConnId = 1;

function createBridge(opts = {}) {
  const port = opts.port ?? BRIDGE_PORT;
  const host = opts.host ?? BRIDGE_HOST;
  const csHost = opts.csHost ?? OPENMU_HOST;
  const csPort = opts.csPort ?? OPENMU_CS_PORT;

  // Presence: connId -> loginName (lowercase) của các kết nối đã gửi gói
  // login đã giải mã qua cầu nối. Dùng để trả lời GET /presence (chỉ
  // loopback) cho portal admin — xem httpServer bên dưới và nhánh login
  // trong translatePlain. Entry bị xóa trong finish() khi kết nối đóng
  // (mọi đường đóng đều qua finish).
  const presenceLogins = new Map();

  const httpServer = http.createServer((req, res) => {
    // GET /presence — danh sách login đang online (chỉ loopback).
    // Các request khác vẫn 426 như trước (WebSocket only).
    let pathname = '';
    try { pathname = new URL(req.url || '/', 'http://bridge').pathname; } catch { /* giữ '' */ }
    if (req.method === 'GET' && pathname === '/presence') {
      const remote = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
      const isLoopback = remote === '127.0.0.1' || remote === '::1' || remote.startsWith('127.');
      if (!isLoopback) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
      }
      const logins = [...new Set(presenceLogins.values())].sort();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ logins }));
      return;
    }
    res.writeHead(426, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('MU bridge2a (OpenMU): WebSocket only, connect ws://<host>:' + port + '/mu\n');
  });
  const wss = new WebSocketServer({ server: httpServer, path: '/mu', maxPayload: 64 * 1024 * 1024 });

  wss.on('connection', (ws, req) => {
    const connId = nextConnId++;
    const startedAt = Date.now();
    let closed = false;
    let leg = 'cs'; // 'cs' | 'gs'
    let loginName = null; // login (lowercase) của kết nối này — ghi khi gói login đã giải mã đi qua, xóa trong finish()
    let upstream = null; // net.Socket hiện tại
    let upstreamReady = false;
    let pendingC2S = []; // gói C->S (object đã bóc khung) chờ trong lúc chuyển chân/chưa nối xong
    let c2sBuf = Buffer.alloc(0);
    const s2cFramer = new RawFramer();
    let bytesC2S = 0;
    let bytesS2C = 0;
    let pktsC2S = 0;
    let pktsS2C = 0;
    let translateCount = 0;

    // --- Trạng thái mã hoá chân GS (reset mỗi lần nối GS mới) ---
    let smDec = null; // MuConnection phía server: giải C3/C4 của client (decKey = khoá suy từ Enc1)
    let encConn = null; // MuConnection cấu hình client thật: mã hoá lại gửi OpenMU (Enc1 + filter)
    let xorLatch = null; // null | 'filtered' — latch XOR-filter C1/C2 (SPEC §7.17)
    const warnedAmbiguous = new Set();

    const L = (...a) => log(`#${connId}`, ...a);
    const LE = (...a) => logErr(`#${connId}`, ...a);

    function resetGsCrypto() {
      // flag8=1: decryptPacket chỉ gỡ SimpleModulus, KHÔNG gỡ filter —
      // việc chọn bản filtered/raw làm ở recoverPlainC3C4 bằng chấm điểm
      // (hai ứng viên của gameserver.js khác nhau duy nhất ở bước gỡ
      // filter sau SM, nên một lần giải SM là đủ cho cả hai).
      smDec = new MuConnection({ encKey: ENC_KEY_FOR_DEC2, decKey: DEC_KEY_FOR_ENC1, flag8: 1 });
      encConn = new MuConnection({ encKey: ENC_RUNTIME_KEY, decKey: DEC_RUNTIME_KEY, flag8: 0 });
      xorLatch = null;
      warnedAmbiguous.clear();
    }

    function finish(reason) {
      if (closed) return;
      closed = true;
      presenceLogins.delete(connId); // presence: kết nối này không còn online
      L(`CLOSE leg=${leg} reason=${reason} pkts c->s=${pktsC2S} s->c=${pktsS2C} ` +
        `bytes c->s=${bytesC2S} s->c=${bytesS2C} translated=${translateCount} duration_ms=${Date.now() - startedAt}`);
      try { if (upstream) upstream.destroy(); } catch { /* đã đóng */ }
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close(1000, 'closed');
      } catch { /* đã đóng */ }
    }

    // ---------------------------------------------------------------
    // Kết nối TCP thượng nguồn (CS hoặc GS)
    // ---------------------------------------------------------------
    function connectUpstream(targetHost, targetPort, targetLeg, onReady) {
      leg = targetLeg;
      upstreamReady = false;
      const sock = net.createConnection({ host: targetHost, port: targetPort });
      upstream = sock;
      // Chân của RIÊNG socket này (bất biến) — dùng cho log và hành vi
      // chân CS; biến `leg` dùng chung thay đổi khi SWITCH nên không
      // dùng để gán nhãn gói (bài học run 1: gói CS bị gán nhãn [gs]).
      const sockLeg = targetLeg;
      let csSawConnectionInfo = false; // chân CS: đã đóng khung ConnectionInfo
      const timer = setTimeout(() => {
        LE(`ERROR TCP connect timeout sau ${TCP_CONNECT_TIMEOUT_MS}ms tới ${targetHost}:${targetPort} (leg=${targetLeg})`);
        try { sock.destroy(new Error('TCP connect timeout')); } catch { /* ignore */ }
        if (ws.readyState === WebSocket.OPEN) ws.close(1011, 'tcp connect timeout');
        finish('tcp-connect-timeout');
      }, TCP_CONNECT_TIMEOUT_MS);

      sock.on('connect', () => {
        clearTimeout(timer);
        upstreamReady = true;
        L(`TCP CONNECTED ${targetHost}:${targetPort} leg=${targetLeg}`);
        if (targetLeg === 'gs') resetGsCrypto();
        // Gói C->S đã chờ trong lúc chuyển chân: xử lý theo chân mới.
        const queued = pendingC2S;
        pendingC2S = [];
        for (const pkt of queued) {
          try { processC2SPacket(pkt); } catch (err) { LE(`ERROR xử lý gói chờ sau chuyển chân (hex=${shortHex(pkt.raw)}): ${err.message}`); }
        }
        if (onReady) onReady();
      });

      sock.on('data', (chunk) => {
        bytesS2C += chunk.length;
        if (sockLeg === 'gs') {
          // Chân GS: relay nguyên dạng theo chunk (định dạng S->C của
          // OpenMU đã đúng định dạng client nhận — PROOF-1 §4); bóc
          // khung chỉ để log.
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(chunk, { binary: true }, (err) => {
              if (err) LE(`ERROR gửi về WS: ${err.message} (${chunk.length} byte)`);
            });
          }
          let packets;
          try {
            packets = s2cFramer.feed(chunk);
          } catch (err) {
            LE(`ERROR framing S->C leg=gs (chỉ log, relay không bị ảnh hưởng): ${err.message}`);
            return;
          }
          for (const p of packets) {
            pktsS2C += 1;
            L(`S->C [gs] len=${p.length} hex=${shortHex(p)}`);
          }
          return;
        }
        // Chân CS: ĐÓNG KHUNG TRƯỚC, chuyển tiếp TỪNG GÓI. Lý do
        // (bằng chứng run 1 + probe TCP trực tiếp): OpenMU
        // ConnectServer gửi ConnectionInfo KÈM một Hello thứ hai
        // (c1040001) trong CÙNG chunk 26 byte sau F4 03. Nếu relay
        // theo chunk, Hello thừa đó lọt vào luồng GameServer và làm
        // lệch nhịp client. Sau ConnectionInfo, mọi gói CS còn lại
        // đều bị BỎ (có log) — phiên CS đã xong.
        let packets;
        try {
          packets = s2cFramer.feed(chunk);
        } catch (err) {
          LE(`ERROR framing S->C leg=cs: ${err.message} — đóng kết nối`);
          finish('s2c-framing-error');
          return;
        }
        for (const p of packets) {
          pktsS2C += 1;
          if (csSawConnectionInfo) {
            L(`DROP S->C [cs] len=${p.length} hex=${shortHex(p)} — gói CS sau ConnectionInfo (phiên CS đã kết thúc, không chuyển vào luồng GS)`);
            continue;
          }
          L(`S->C [cs] len=${p.length} hex=${shortHex(p)}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(Buffer.from(p), { binary: true }, (err) => {
              if (err) LE(`ERROR gửi về WS: ${err.message} (${p.length} byte)`);
            });
          }
          if (isConnectionInfo(p)) {
            csSawConnectionInfo = true;
            maybeSwitchToGameServer(p);
          }
        }
      });

      sock.on('error', (err) => {
        clearTimeout(timer);
        LE(`ERROR TCP leg=${targetLeg} ${targetHost}:${targetPort}: code=${err.code || ''} message=${err.message} (connected=${upstreamReady})`);
        if (!upstreamReady) {
          if (ws.readyState === WebSocket.OPEN) ws.close(1011, `tcp connect failed: ${err.code || err.message}`);
          finish(`tcp-connect-error:${err.code || 'unknown'}`);
        } else {
          finish(`tcp-error:${err.code || 'unknown'}`);
        }
      });

      sock.on('close', (hadError) => {
        clearTimeout(timer);
        if (!closed && upstream === sock) {
          L(`TCP CLOSED leg=${targetLeg} hadError=${hadError} -> đóng WS`);
          finish(hadError ? 'tcp-closed-error' : 'tcp-closed');
        }
      });
    }

    // ---------------------------------------------------------------
    // Theo dõi F4 03 ConnectionInfo (S->C, chân CS) -> chuyển chân GS
    // ---------------------------------------------------------------
    function maybeSwitchToGameServer(p) {
      // ConnectionInfo: C1, len 22, opcode F4, subcode 03, host chuỗi
      // 16B @4, port u16 LE @20 (PROOF-1 §2 mục 5).
      if (!(p[0] === 0xc1 && p.length >= 22 && p[2] === 0xf4 && p[3] === 0x03)) return;
      const rawHost = p.subarray(4, 20).toString('latin1').replace(/\0.*$/s, '');
      const gsPort = p.readUInt16LE(20);
      const gsHost = normalizeUpstreamHost(rawHost);
      const mapped = gsHost !== rawHost ? ` (map từ "${rawHost}")` : '';
      L(`SWITCH F4 03 ConnectionInfo: đóng CS ${csHost}:${csPort}, mở GameServer ${gsHost}:${gsPort}${mapped}`);
      const old = upstream;
      // Gói C->S tới trong lúc chuyển chân được xếp hàng, xử lý sau
      // khi GS nối xong (xem connectUpstream/on 'connect').
      leg = 'gs';
      upstreamReady = false;
      if (s2cFramer.leftover.length > 0) {
        L(`WARN còn ${s2cFramer.leftover.length} byte S->C chưa đủ khung trên chân CS khi chuyển chân — bỏ (CS không gửi gì sau ConnectionInfo): hex=${shortHex(s2cFramer.leftover)}`);
        s2cFramer.buf = Buffer.alloc(0);
      }
      try { if (old) old.destroy(); } catch { /* ignore */ }
      connectUpstream(gsHost, gsPort, 'gs');
    }

    // ---------------------------------------------------------------
    // Khôi phục plaintext C1/C2 chân GS — port chiến lược §7.17 bản
    // vá 2 của gameserver.js (chỉ khác: không route, chỉ trả plaintext
    // + đường đã chọn để log).
    // ---------------------------------------------------------------
    function recoverPlainC1C2(pkt) {
      const hlen = headerLen(pkt.head);
      const raw = pkt.raw;
      const un = removeXorFilter(raw, hlen);
      // (1) Hello C1 00 01: nhận cả raw lẫn bản gỡ-filter.
      if (pkt.head === 0xc1 && pkt.opcode === 0x00 && raw.length === 4 && (raw[3] === 0x01 || un[3] === 0x01)) {
        return { plain: raw, via: 'hello-raw' };
      }
      // (2) MANAGED_RAW: luôn raw, không bao giờ latch.
      if (pkt.head === 0xc1 && pkt.opcode === 0xf1 && pkt.subcode === 0x01) {
        return { plain: raw, via: 'managed-raw F1 01' };
      }
      if (pkt.head === 0xc1 && pkt.opcode === 0xf3 && pkt.subcode === 0x0d) {
        return { plain: raw, via: 'managed-raw F3 0D' };
      }
      // (3) Gói có subcode dùng được cho latch.
      if (packetHasSubcodeForLatch(pkt)) {
        // F3 00: raw luôn (bản filtered của nó rơi vào nhánh F3 0D).
        if (pkt.head === 0xc1 && pkt.opcode === 0xf3 && pkt.subcode === 0x00) {
          return { plain: raw, via: 'F3 00 raw' };
        }
        const fam = XOR_FAMILY_SUBCODES[pkt.opcode];
        const rawSub = raw[hlen + 1];
        const unSub = un[hlen + 1];
        const validRaw = fam ? fam.has(rawSub) : null;
        const validUn = fam ? fam.has(unSub) : null;
        if (xorLatch === 'filtered') {
          if (validUn !== false) return { plain: un, via: 'gỡ-filter (đã latch)' };
          return { plain: raw, via: 'raw (đã latch nhưng bản gỡ-filter không hợp lệ)' };
        }
        if (validUn === true && validRaw === false) {
          xorLatch = 'filtered';
          L(`LATCH xor-filter: gói native qua XOR-filter (raw opcode=0x${pkt.opcode.toString(16).padStart(2, '0')} ` +
            `subcode-rác=0x${rawSub.toString(16).padStart(2, '0')} -> gỡ-filter subcode=0x${unSub.toString(16).padStart(2, '0')}) — ` +
            'từ nay gói C1/C2 được gỡ filter trước (SPEC §7.17)');
          return { plain: un, via: 'gỡ-filter (latch mới)' };
        }
        if (validRaw === true && validUn === false) return { plain: raw, via: 'raw' };
        if (validUn === true && validRaw === true) {
          return { plain: raw, via: 'raw (mơ hồ: cả hai dạng đều hợp lệ — không latch)' };
        }
        if (fam && !warnedAmbiguous.has(pkt.opcode)) {
          warnedAmbiguous.add(pkt.opcode);
          L(`WARN opcode=0x${pkt.opcode.toString(16).padStart(2, '0')}: subcode raw=0x${rawSub.toString(16).padStart(2, '0')} ` +
            `và gỡ-filter=0x${unSub.toString(16).padStart(2, '0')} đều ngoài tập subcode thật — chuyển tiếp dạng raw (cảnh báo 1 lần/kết nối cho opcode này)`);
        }
        return { plain: raw, via: 'raw (không phân biệt được)' };
      }
      // (4) Gói chỉ-opcode: không bao giờ latch.
      if (xorLatch === 'filtered') return { plain: un, via: 'gỡ-filter (đã latch, chỉ-opcode)' };
      return { plain: raw, via: 'raw (chỉ-opcode)' };
    }

    // ---------------------------------------------------------------
    // Khôi phục plaintext C3/C4 chân GS: giải SimpleModulus 1 lần
    // (không gỡ filter), rồi chọn bản raw / bản gỡ-filter bằng chấm
    // điểm (opcode đã biết + subcode hợp lệ + validator mạnh cho
    // login). Counter lệch: căn lại inSeq theo counter gói mang theo
    // rồi thử lại 1 lần (port decryptAll của gameserver.js).
    // ---------------------------------------------------------------
    function recoverPlainC3C4(raw) {
      let smPlain;
      try {
        smPlain = smDec.decryptPacket(raw);
      } catch (err) {
        const m = /unexpected packet counter: got (\d+)/.exec(err.message || '');
        if (!m) throw err;
        const prevSeq = smDec.inSeq;
        smDec.inSeq = Number(m[1]);
        try {
          smPlain = smDec.decryptPacket(raw);
          L(`WARN C3 counter lệch, đã căn inSeq ${prevSeq} -> ${smDec.inSeq} (client có thể đã gửi gói C3 khác trước)`);
        } catch (err2) {
          smDec.inSeq = prevSeq;
          throw err2;
        }
      }
      const hlen = headerLen(raw[0]);
      const opcode = smPlain[hlen];
      if (!KNOWN_C3_OPCODES.has(opcode)) {
        // Opcode không đổi bởi filter; lạ ở cả hai bản -> vẫn chuyển
        // tiếp bản raw (server quyết định), nhưng log rõ.
        L(`WARN C3/C4 opcode lạ 0x${opcode.toString(16).padStart(2, '0')} sau giải SM — chuyển tiếp bản raw, hex=${shortHex(smPlain)}`);
        return { plain: smPlain, via: 'SM raw (opcode lạ)' };
      }
      const un = removeXorFilter(smPlain, hlen);
      const hasSub = defaultHasSubcode(raw[0], opcode) || opcode === 0xf1 || opcode === 0xf3;
      if (!hasSub || smPlain.length <= hlen + 1) {
        // Không có byte subcode để phân biệt: hai bản chỉ khác nhau ở
        // payload từ byte hlen+2 — không có căn cứ chọn; lấy bản
        // filtered theo mặc định conn+8=0 đã chốt live (SPEC §8.1).
        return { plain: un, via: 'SM gỡ-filter (không subcode — mặc định live)' };
      }
      const rawSub = smPlain[hlen + 1];
      const unSub = un[hlen + 1];
      // Validator mạnh: login F1 01 — đúng bản phải có subcode 0x01;
      // bản 60B còn có version "20404" @38 + serial in được @43.
      if (opcode === 0xf1) {
        const score = (cand) => {
          let s = 0;
          if (cand[hlen + 1] === 0x01) s += 4;
          if (cand.length === 60 && cand.subarray(38, 43).toString('latin1') === '20404') s += 4;
          if (cand.length === 60 && isPrintableField(cand.subarray(43, 59))) s += 2;
          if (cand.length === 50 || cand.length === 48) s += 1;
          return s;
        };
        const sRaw = score(smPlain);
        const sUn = score(un);
        if (sUn > sRaw) return { plain: un, via: `SM gỡ-filter (login score ${sUn}>${sRaw})` };
        if (sRaw > sUn) return { plain: smPlain, via: `SM raw (login score ${sRaw}>${sUn})` };
        return { plain: un, via: 'SM gỡ-filter (login hoà điểm — mặc định live)' };
      }
      const fam = XOR_FAMILY_SUBCODES[opcode];
      const validRaw = fam ? fam.has(rawSub) : (rawSub === 0x00 || rawSub === 0x01);
      const validUn = fam ? fam.has(unSub) : (unSub === 0x00 || unSub === 0x01);
      if (validUn && !validRaw) return { plain: un, via: 'SM gỡ-filter (subcode hợp lệ)' };
      if (validRaw && !validUn) return { plain: smPlain, via: 'SM raw (subcode hợp lệ)' };
      return { plain: un, via: 'SM gỡ-filter (mơ hồ — mặc định live conn+8=0)' };
    }

    // ---------------------------------------------------------------
    // Dịch trên plaintext (chân GS)
    // ---------------------------------------------------------------
    function translatePlain(plain) {
      const events = [];
      let out = plain;
      const head = out[0];
      const hlen = headerLen(head);
      const opcode = out[hlen];
      const subcode = out.length > hlen + 1 ? out[hlen + 1] : null;
      // F3 0D -> F3 00: đổi đúng 1 byte subcode, giữ payload.
      if (head === 0xc1 && opcode === 0xf3 && subcode === 0x0d) {
        out = Buffer.from(out);
        out[hlen + 1] = 0x00;
        translateCount += 1;
        events.push(`TRANSLATE F3 0D -> F3 00 (đổi 1 byte subcode, giữ payload 0x${(out[hlen + 2] ?? 0).toString(16).padStart(2, '0')})`);
      }
      // Login F1 01: chẩn đoán dạng trường + công tắc XOR3.
      // Cả 2 biến thể đều qua đây: C3 F1 01 (60B LoginLongPassword, qua
      // SimpleModulus) và C1 F1 01 (login ngắn, managed-raw — xem
      // recoverPlainC1C2). Trường username đều ở [4..14), password
      // [14..34) (bản ngắn chỉ tới byte 24 — subarray đã cắt theo độ dài).
      if ((head === 0xc3 || head === 0xc1) && opcode === 0xf1 && subcode === 0x01) {
        const userField = out.subarray(4, 14);
        const passField = out.subarray(14, Math.min(34, out.length));
        const userPlain = isPrintableField(userField);
        const userXor3 = isPrintableField(xor3FieldCopy(userField));
        const passPlain = isPrintableField(passField);
        const passXor3 = isPrintableField(xor3FieldCopy(passField));
        const userDecoded = userXor3 ? xor3FieldCopy(userField).toString('latin1').replace(/\0.*$/s, '') : '';
        L(`LOGIN diag: len=${out.length} userField plain=${userPlain} xor3=${userXor3}` +
          `${userXor3 ? ` (xor3 giải ra account="${userDecoded}")` : ''} passField plain=${passPlain} xor3=${passXor3} ` +
          `— công tắc BRIDGE_LOGIN_XOR3=${LOGIN_XOR3_ON ? 'ON' : 'OFF'} (CHƯA CHỐT dạng thật của client — xem BRIDGE-2A-REPORT)`);
        // PRESENCE (cột Online trang admin): ghi loginName của kết nối
        // này khi gói login đã giải mã đi qua — ưu tiên dạng plain, nếu
        // không thì dạng XOR3 (xem diag trên). KHÔNG log mật khẩu.
        // Entry bị xóa trong finish() khi kết nối đóng. LƯU Ý: login sai
        // mật khẩu vẫn hiện online tới lúc client ngắt (OpenMU trả lỗi
        // rồi client tự đóng) — xem báo cáo.
        const rawName = userPlain
          ? userField.toString('latin1').replace(/\0.*$/s, '')
          : userDecoded;
        if (rawName) {
          loginName = rawName.toLowerCase();
          presenceLogins.set(connId, loginName);
          L(`PRESENCE loginName="${loginName}" (connId=${connId})`);
        }
        if (LOGIN_XOR3_ON) {
          if (out.length === 60) {
            out = Buffer.from(out);
            xor3FieldCopy(out.subarray(4, 14)).copy(out, 4);
            xor3FieldCopy(out.subarray(14, 34)).copy(out, 14);
            translateCount += 1;
            events.push('TRANSLATE login XOR3-hoá username[4..14) + password[14..34) (công tắc BRIDGE_LOGIN_XOR3=on)');
          } else {
            L(`WARN BRIDGE_LOGIN_XOR3=on nhưng gói login dài ${out.length} byte ≠ 60 (LoginLongPassword) — KHÔNG áp dụng (CHƯA CHỐT layout biến thể này)`);
          }
        }
      }
      return { plain: out, events };
    }

    // ---------------------------------------------------------------
    // Xử lý 1 gói C->S đã bóc khung
    // ---------------------------------------------------------------
    function processC2SPacket(pkt) {
      pktsC2S += 1;
      if (leg === 'cs') {
        // Chân CS: plaintext hai chiều — relay nguyên dạng.
        L(`C->S [cs] len=${pkt.raw.length} hex=${shortHex(pkt.raw)} (plaintext, relay nguyên dạng)`);
        writeUpstream(pkt.raw);
        return;
      }
      // Chân GS: khôi phục plaintext -> dịch -> mã hoá lại chuẩn OpenMU.
      let recovered;
      if (pkt.head === 0xc3 || pkt.head === 0xc4) {
        recovered = recoverPlainC3C4(pkt.raw);
      } else {
        recovered = recoverPlainC1C2(pkt);
      }
      const { plain, events } = translatePlain(recovered.plain);
      for (const ev of events) L(ev);
      const wire = encConn.encryptPacket(plain);
      L(`C->S [gs] wireLen=${pkt.raw.length} -> plain len=${plain.length} hex=${shortHex(plain)} (via: ${recovered.via}) -> upstream len=${wire.length} hex=${shortHex(wire)}`);
      writeUpstream(wire);
    }

    function writeUpstream(buf) {
      // Chỉ được gọi từ processC2SPacket khi upstreamReady=true (gói
      // đến lúc chưa sẵn sàng đã bị xếp hàng ở tầng message). Nếu vẫn
      // lọt vào đây: log ERROR rõ ràng thay vì mất gói lặng lẽ.
      if (upstream && upstreamReady && !upstream.destroyed) {
        upstream.write(buf, (err) => {
          if (err) LE(`ERROR ghi TCP leg=${leg}: ${err.message} (${buf.length} byte)`);
        });
      } else if (!closed) {
        LE(`ERROR writeUpstream khi thượng nguồn chưa sẵn sàng (leg=${leg}, ready=${upstreamReady}) — gói ${buf.length} byte bị bỏ, hex=${shortHex(buf)}`);
      }
    }

    // ---------------------------------------------------------------
    // Điểm vào kết nối WS
    // ---------------------------------------------------------------
    let url = null;
    try { url = new URL(req.url, 'ws://bridge'); } catch (err) {
      LE(`ERROR url parse thất bại: ${err.message} (url=${JSON.stringify(req.url)})`);
      ws.close(1008, 'bad url');
      return;
    }
    const qHost = url.searchParams.get('host');
    const qPort = Number(url.searchParams.get('port'));
    L(`OPEN from=${req.socket.remoteAddress} query host=${JSON.stringify(qHost)} port=${JSON.stringify(url.searchParams.get('port'))}`);

    // Gửi text "open" ngay khi WS mở (như cầu nối cũ).
    try {
      ws.send('open');
      L('SENT text "open" (handshake, gửi ngay khi WS mở)');
    } catch (err) {
      LE(`ERROR không gửi được "open": ${err.message}`);
      finish('open-send-failed');
      return;
    }

    // Quyết định chân khởi đầu:
    //  - query trỏ cổng CS (44405/44406) hoặc không có query -> chân CS
    //    tới OpenMU CS đã cấu hình (mặc định 44406).
    //  - query trỏ cổng khác -> client mở WS mới trỏ thẳng GameServer
    //    (sau F4 03) -> chân GS ngay, host local map về OPENMU_HOST.
    if (Number.isInteger(qPort) && qPort > 0 && qPort !== 44405 && qPort !== csPort) {
      L(`QUERY trỏ thẳng GameServer ${normalizeUpstreamHost(qHost)}:${qPort} — vào chân GS ngay (bỏ qua CS)`);
      connectUpstream(normalizeUpstreamHost(qHost), qPort, 'gs');
    } else {
      connectUpstream(csHost, csPort, 'cs');
    }

    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        L(`WARN nhận text frame từ client (${Buffer.byteLength(String(data))} byte) — bỏ qua, không relay: ${JSON.stringify(String(data).slice(0, 80))}`);
        return;
      }
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      bytesC2S += buf.length;
      c2sBuf = Buffer.concat([c2sBuf, buf]);
      let parsed;
      try {
        parsed = parsePackets(c2sBuf);
      } catch (err) {
        LE(`ERROR framing C->S leg=${leg}: ${err.message} — đóng kết nối (không đoán resync), buffer=${shortHex(c2sBuf)}`);
        finish('c2s-framing-error');
        return;
      }
      c2sBuf = parsed.leftover;
      for (const pkt of parsed.packets) {
        if (closed) break;
        if (!upstreamReady) {
          // Thượng nguồn chưa nối xong (lúc mở WS hoặc sau SWITCH):
          // xếp hàng gói đã bóc khung, xử lý khi 'connect' kích hoạt.
          pendingC2S.push(pkt);
          L(`QUEUE gói C->S ${pkt.raw.length} byte chờ thượng nguồn nối xong (leg=${leg}, hàng chờ=${pendingC2S.length})`);
          continue;
        }
        try {
          processC2SPacket(pkt);
        } catch (err) {
          LE(`ERROR xử lý gói C->S leg=${leg} hex=${shortHex(pkt.raw)}: ${err.message} — đóng kết nối`, err);
          finish('c2s-process-error');
          return;
        }
      }
    });

    ws.on('error', (err) => {
      LE(`ERROR WS: code=${err.code || ''} message=${err.message}`);
      finish(`ws-error:${err.code || 'unknown'}`);
    });

    ws.on('close', (code, reason) => {
      L(`WS CLOSED code=${code} reason=${reason ? reason.toString() : ''} -> đóng TCP`);
      finish(`ws-closed:${code}`);
    });
  });

  wss.on('error', (err) => logErr(`ERROR WebSocketServer: ${err.message}`));

  return new Promise((resolve, reject) => {
    httpServer.once('error', (err) => {
      logErr(`ERROR không bind được cổng ${port}: code=${err.code} message=${err.message}`);
      reject(err);
    });
    httpServer.listen(port, host, () => {
      const actual = httpServer.address().port;
      log(`LISTEN ws://${host}:${actual}/mu -> OpenMU CS ${csHost}:${csPort} (LOGIN_XOR3=${LOGIN_XOR3_ON ? 'ON' : 'OFF'})`);
      resolve({
        wss,
        httpServer,
        port: actual,
        close: () => new Promise((resClose) => {
          for (const client of wss.clients) {
            try { client.close(1000, 'closed'); } catch { /* ignore */ }
          }
          wss.close(() => httpServer.close(() => resClose()));
        }),
      });
    });
  });
}

if (require.main === module) {
  createBridge().catch((err) => {
    logErr(`FATAL: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { createBridge };
