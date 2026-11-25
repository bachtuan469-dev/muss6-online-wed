'use strict';
/**
 * test-ws-replay.js — Kiểm chứng tích hợp LÁT 2a: replay luồng client
 * web MU Lục Địa QUA WebSocket của cầu nối bridge.js (thay vì TCP trực
 * tiếp như replay-proof.js của lát 1).
 *
 * Chuỗi kỳ vọng:
 *   WS nối -> nhận text "open"
 *   -> CS Hello c1040001
 *   -> F4 06 -> ServerList (3 server)
 *   -> F4 03 server 0 -> ConnectionInfo 127.0.0.1:45902 (cầu nối tự
 *      chuyển thượng nguồn CS->GS sau gói này)
 *   -> GS greeting F1 00 (version "20404")
 *   -> Login C3 F1 01 (LoginLongPassword 60B, account/password XOR3
 *      như lát 1; cầu nối để BRIDGE_LOGIN_XOR3=off) -> result 0x01
 *   -> F3 0D GỬI NGUYÊN BẢN RAW c105f30d15 (đúng dạng managed của
 *      client web) -> kỳ vọng NHẬN ĐƯỢC CharacterList nhờ cầu nối
 *      dịch 0D->00 (điểm khác biệt cốt lõi so với lát 1: nối thẳng
 *      OpenMU thì F3 0D bị bỏ qua im lặng)
 *   -> F3 03 chọn NV (gửi dạng đã XOR-filter như tầng native, qua
 *      MuConnection cấu hình client thật) -> CharacterInformation 93B
 *      + chuỗi vào world.
 *
 * ĐÂY LÀ REPLAY BẰNG SCRIPT THEO ĐẶC TẢ — KHÔNG phải client thật
 * trong trình duyệt.
 *
 * Env: BRIDGE_WS_URL (mặc định ws://127.0.0.1:8792/mu), ACC/PW
 * (test0/test0), SERVER_ID (0), SELECT_NAME (test0Dk).
 */
const path = require('path');
const WebSocket = require('ws');

const PKT = require(path.join(__dirname, '..', '..', 'mulucdia', 'server', 'src', 'packet'));
const { MuConnection, ENC_RUNTIME_KEY, DEC_RUNTIME_KEY, decryptSimpleModulus, headerLen } = PKT;

const WS_URL = process.env.BRIDGE_WS_URL || 'ws://127.0.0.1:8792/mu';
const ACCOUNT = process.env.ACC || 'test0';
const PASSWORD = process.env.PW || 'test0';
const SERVER_ID = Number(process.env.SERVER_ID || 0);
const SELECT_NAME = process.env.SELECT_NAME || 'test0Dk';

const ts = () => new Date().toISOString();
function log(...args) { console.log(`[${ts()}]`, ...args); }
function hex(buf) { return Buffer.from(buf).toString('hex'); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** Giải mã 1 gói S->C theo định dạng dây OpenMU (như replay-proof.js:
 * C1/C2 plaintext; C3/C4 SimpleModulus bằng khoá Dec2, KHÔNG gỡ
 * XOR-filter; counter giữ ở inSeqRef). */
function decodeServerPacket(wire, inSeqRef) {
  const buf = Buffer.from(wire);
  const head = buf[0];
  if (head === 0xc1 || head === 0xc2) return buf;
  if (head !== 0xc3 && head !== 0xc4) throw new Error(`head lạ 0x${head.toString(16)}`);
  const hlen = headerLen(head);
  const { counter, plaintext } = decryptSimpleModulus(buf.subarray(hlen), DEC_RUNTIME_KEY);
  if (counter !== inSeqRef.value) {
    throw new Error(`counter lệch: got ${counter}, expected ${inSeqRef.value}`);
  }
  inSeqRef.value = (inSeqRef.value + 1) & 0xff;
  const decSize = hlen + plaintext.length;
  const out = Buffer.alloc(decSize);
  out[0] = head;
  if (head === 0xc2 || head === 0xc4) { out[1] = (decSize >>> 8) & 0xff; out[2] = decSize & 0xff; } else { out[1] = decSize & 0xff; }
  plaintext.copy(out, hlen);
  return out;
}

/** Đọc gói cho tới khi gặp gói khớp `pred(plain, wire)` — client thật
 * cũng dispatch theo opcode chứ không giả định trình tự cứng (bài học
 * run 1: Hello thừa của CS + login lạnh 2,4s làm lệch nhịp các bước
 * đọc cứng). Gói bị bỏ qua được log rõ ràng (SKIP). */
async function nextMatching(queue, inSeqRef, timeoutMs, pred, desc) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const left = deadline - Date.now();
    if (left <= 0) throw new Error(`timeout chờ ${desc}`);
    const wire = await queue.next(left, desc);
    let plain = null;
    try { plain = decodeServerPacket(wire, inSeqRef); } catch (e) { log(`SKIP: gói không giải mã được khi chờ ${desc}: ${e.message} wire=${hex(wire.subarray(0, 24))}`); continue; }
    if (pred(plain, wire)) return { wire, plain };
    log(`SKIP gói lệch nhịp khi chờ ${desc}: plain=${hex(plain.subarray(0, 24))}`);
  }
}

class PacketFramer {
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
        throw new Error(`framer: head lạ 0x${head.toString(16)} — buf=${hex(this.buf.subarray(0, 16))}`);
      }
      if (size < 2 || this.buf.length < size) break;
      out.push(Buffer.from(this.buf.subarray(0, size)));
      this.buf = this.buf.subarray(size);
    }
    return out;
  }
}

class PacketQueue {
  constructor(label) {
    this.framer = new PacketFramer();
    this.queue = [];
    this.waiters = [];
    this.label = label;
  }
  feed(chunk) {
    let pkts;
    try {
      pkts = this.framer.feed(chunk);
    } catch (e) {
      log(`${this.label} FRAMER-ERROR: ${e.message}`);
      return;
    }
    for (const p of pkts) {
      const w = this.waiters.shift();
      if (w) w(p);
      else this.queue.push(p);
    }
  }
  next(timeoutMs = 10000, what = 'gói') {
    if (this.queue.length) return Promise.resolve(this.queue.shift());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout chờ ${what} (${timeoutMs}ms)`)), timeoutMs);
      this.waiters.push((p) => { clearTimeout(timer); resolve(p); });
    });
  }
  async drain(ms = 1500) {
    await sleep(ms);
    return this.queue.splice(0);
  }
}

const XOR3 = [0xfc, 0xcf, 0xab];
function xor3Field(str, len) {
  const b = Buffer.alloc(len);
  Buffer.from(str, 'latin1').copy(b, 0, 0, Math.min(len, str.length));
  for (let i = 0; i < len; i++) b[i] ^= XOR3[i % 3];
  return b;
}
// LOGIN_FORM=xor3 (mặc định, như lát 1) | plain (trường account/password
// để nguyên văn — dùng để kiểm chứng công tắc BRIDGE_LOGIN_XOR3 của cầu
// nối: plain + switch ON phải login được; plain + switch OFF phải fail).
const LOGIN_FORM = (process.env.LOGIN_FORM || 'xor3').toLowerCase();
function buildLoginLongPassword(account, password) {
  const plain = Buffer.alloc(60);
  plain[0] = 0xc3; plain[1] = 60; plain[2] = 0xf1; plain[3] = 0x01;
  if (LOGIN_FORM === 'plain') {
    Buffer.from(account, 'latin1').copy(plain, 4, 0, 10);
    Buffer.from(password, 'latin1').copy(plain, 14, 0, 20);
  } else {
    xor3Field(account, 10).copy(plain, 4);
    xor3Field(password, 20).copy(plain, 14);
  }
  plain.writeUInt32BE((Date.now() & 0xffffffff) >>> 0, 34);
  Buffer.from('20404', 'ascii').copy(plain, 38);
  Buffer.from('k1Pk2jcET48mxL3b', 'ascii').copy(plain, 43);
  plain[59] = 0;
  return plain;
}

async function main() {
  const result = { steps: [] };
  const step = (name, ok, detail) => {
    result.steps.push({ name, ok, detail });
    log(`STEP ${ok ? 'OK ' : 'FAIL'} ${name} — ${detail}`);
  };

  log(`== Mở WebSocket tới cầu nối ${WS_URL} ==`);
  const ws = new WebSocket(WS_URL, { maxPayload: 64 * 1024 * 1024 });
  const q = new PacketQueue('WS');
  let openText = null;
  let openResolve;
  const openPromise = new Promise((r) => { openResolve = r; });
  ws.on('message', (data, isBinary) => {
    if (!isBinary) {
      const text = data.toString();
      log(`WS text frame: ${JSON.stringify(text)}`);
      if (openText === null) { openText = text; openResolve(); }
      return;
    }
    q.feed(Buffer.from(data));
  });
  ws.on('error', (e) => log(`WS ERROR: ${e.message}`));
  ws.on('close', (code) => log(`WS đóng code=${code}`));
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  await Promise.race([openPromise, sleep(5000)]);
  step('WS handshake "open"', openText === 'open', `text frame đầu = ${JSON.stringify(openText)}`);

  const send = (buf, label) => {
    log(`C->S ${label}: ${hex(buf)}`);
    ws.send(buf, { binary: true });
  };

  // ---------- Chân CS qua cầu nối ----------
  const hello = await q.next(10000, 'Hello từ ConnectServer (qua cầu nối)');
  log(`S->C CS Hello: ${hex(hello)}`);
  step('CS Hello', hello.equals(Buffer.from([0xc1, 0x04, 0x00, 0x01])), `nhận ${hex(hello)} (kỳ vọng c1040001)`);

  send(Buffer.from([0xc1, 0x04, 0xf4, 0x06]), 'F4 06 xin DS server');
  const slRes = await q.next(10000, 'ServerList F4 06');
  log(`S->C ServerList: ${hex(slRes)}`);
  let serverCount = -1; const entries = [];
  if (slRes[0] === 0xc2 && slRes[3] === 0xf4 && slRes[4] === 0x06) {
    serverCount = slRes.readUInt16BE(5);
    for (let i = 0; i < serverCount; i++) {
      const off = 7 + i * 4;
      entries.push({ code: slRes.readUInt16LE(off), load: slRes[off + 2] });
    }
  }
  step('CS F4 06 ServerList', serverCount >= 1, `count=${serverCount} entries=${JSON.stringify(entries)}`);

  const ciReq = Buffer.alloc(6);
  ciReq[0] = 0xc1; ciReq[1] = 0x06; ciReq[2] = 0xf4; ciReq[3] = 0x03;
  ciReq.writeUInt16LE(SERVER_ID, 4);
  send(ciReq, `F4 03 chọn server ${SERVER_ID}`);
  const ciRes = await q.next(10000, 'ConnectionInfo F4 03');
  log(`S->C ConnectionInfo: ${hex(ciRes)}`);
  let gsHost = null; let gsPort = -1;
  if (ciRes[2] === 0xf4 && ciRes[3] === 0x03 && ciRes.length >= 22) {
    gsHost = ciRes.subarray(4, 20).toString('utf8').replace(/\0.*$/s, '');
    gsPort = ciRes.readUInt16LE(20);
  }
  step('CS F4 03 ConnectionInfo', gsPort > 0, `host=${gsHost} port=${gsPort} (cầu nối phải đã tự chuyển thượng nguồn sang GS này)`);

  // ---------- Chân GS qua cầu nối (cùng 1 WS) ----------
  const conn = new MuConnection({ encKey: ENC_RUNTIME_KEY, decKey: DEC_RUNTIME_KEY });
  const inSeqRef = { value: 0 };

  const greetM = await nextMatching(q, inSeqRef, 10000,
    (p) => p[2] === 0xf1 && p[3] === 0x00, 'GameServerEntered F1 00 (qua cầu nối, sau SWITCH)');
  const greetWire = greetM.wire; const greetPlain = greetM.plain;
  log(`S->C GS greeting wire: ${hex(greetWire)}`);
  log(`S->C GS greeting plain: ${hex(greetPlain)}`);
  const versionSeen = greetPlain && greetPlain.length >= 12 ? greetPlain.subarray(7, 12).toString('latin1') : null;
  step('GS F1 00 GameServerEntered', !!greetPlain && greetPlain[2] === 0xf1 && greetPlain[3] === 0x00,
    `plain=${greetPlain ? hex(greetPlain) : 'null'} version=${JSON.stringify(versionSeen)}`);

  const loginPlain = buildLoginLongPassword(ACCOUNT, PASSWORD);
  log(`C->S login plain: ${hex(loginPlain)}`);
  send(conn.encryptPacket(loginPlain), 'login C3 F1 01 (wire)');
  const loginM = await nextMatching(q, inSeqRef, 15000,
    (p) => p[2] === 0xf1 && p[3] === 0x01 && p.length <= 8, 'LoginResponse F1 01');
  const loginResWire = loginM.wire; const loginRes = loginM.plain;
  log(`S->C login response wire: ${hex(loginResWire)}`);
  log(`S->C login response plain: ${hex(loginRes)}`);
  const loginCode = loginRes && loginRes.length >= 5 ? loginRes[4] : -1;
  step('GS F1 01 Login', loginCode === 0x01 || loginCode === 0x20, `resultCode=${loginCode} (0x01 = thành công)`);

  if (!(loginCode === 0x01 || loginCode === 0x20)) {
    log('Login không thành công — dừng (vẫn ghi bằng chứng).');
    ws.close();
    console.log('RESULT_JSON ' + JSON.stringify(result));
    process.exitCode = result.steps.every((s) => s.ok) ? 0 : 1;
    return;
  }

  // F3 0D NGUYÊN BẢN RAW của client web — qua cầu nối phải được dịch.
  const f30dRaw = Buffer.from([0xc1, 0x05, 0xf3, 0x0d, 0x15]);
  send(f30dRaw, 'F3 0D RAW (gói thật của client web — cầu nối phải dịch 0D->00)');
  let charListPlain = null;
  try {
    const clM = await nextMatching(q, inSeqRef, 10000,
      (p) => p[2] === 0xf3 && p[3] === 0x00, 'CharacterList F3 00 (nhờ cầu nối dịch)');
    log(`S->C char list wire: ${hex(clM.wire)}`);
    charListPlain = clM.plain;
    log(`S->C char list plain: ${hex(charListPlain)}`);
  } catch (e) {
    log(`Không nhận được CharacterList: ${e.message} — cầu nối KHÔNG dịch được F3 0D (đây là bước phân biệt với lát 1)`);
  }
  let charInfo = null;
  if (charListPlain && charListPlain[2] === 0xf3 && charListPlain[3] === 0x00) {
    const count = charListPlain[6];
    const entrySize = count > 0 ? (charListPlain.length - 8) / count : 0;
    const names = [];
    for (let i = 0; i < count; i++) {
      const off = 8 + i * entrySize;
      names.push(charListPlain.subarray(off + 1, off + 11).toString('latin1').replace(/\0.*$/s, ''));
    }
    charInfo = { count, entrySize, names };
  }
  step('GS F3 0D -> cầu nối dịch -> CharacterList', !!charInfo && charInfo.count > 0,
    charInfo ? `count=${charInfo.count} entrySize=${charInfo.entrySize} names=${JSON.stringify(charInfo.names)}` : 'không nhận/parse được CharacterList');

  // F3 03 chọn NV — gửi dạng đã lọc (tầng native) qua MuConnection.
  const selectName = charInfo && charInfo.names.includes(SELECT_NAME)
    ? SELECT_NAME
    : (charInfo ? charInfo.names[0] : SELECT_NAME);
  if (charInfo && selectName !== SELECT_NAME) {
    log(`WARN "${SELECT_NAME}" không có trong DS nhân vật — chọn tạm "${selectName}" để chạy tiếp chuỗi (ghi nhận, không coi là đạt kỳ vọng tên)`);
  }
  const sel = Buffer.alloc(14);
  sel[0] = 0xc1; sel[1] = 14; sel[2] = 0xf3; sel[3] = 0x03;
  Buffer.from(selectName, 'latin1').copy(sel, 4, 0, 10);
  log(`C->S F3 03 plain: ${hex(sel)}`);
  send(conn.encryptPacket(sel), `F3 03 chọn NV "${selectName}" (wire, đã lọc)`);
  let charInfoPkt = null;
  try {
    const infoM = await nextMatching(q, inSeqRef, 10000,
      (p) => p[2] === 0xf3 && p[3] === 0x03, 'CharacterInformation F3 03');
    log(`S->C char info wire: ${hex(infoM.wire)}`);
    charInfoPkt = infoM.plain;
    log(`S->C char info plain: ${hex(charInfoPkt)}`);
  } catch (e) {
    log(`Không nhận được CharacterInformation: ${e.message}`);
  }
  step('GS F3 03 SelectCharacter', !!charInfoPkt && charInfoPkt[2] === 0xf3 && charInfoPkt[3] === 0x03,
    `plainLen=${charInfoPkt ? charInfoPkt.length : 0} (93 = bản Extended)`);

  const rest = await q.drain(2500);
  const burstDesc = [];
  for (const p of rest) {
    let dec = null;
    try { dec = decodeServerPacket(p, inSeqRef); } catch { /* counter có thể lệch khi bỏ gói — chỉ ghi wire */ }
    const shown = dec || p;
    burstDesc.push(`head=0x${shown[0].toString(16)} op=0x${(shown[2] ?? 0).toString(16).padStart(2, '0')} sub=0x${(shown[3] ?? 0).toString(16).padStart(2, '0')} len=${p.length}${dec ? '' : ' (không giải mã)'}`);
    log(`S->C (chuỗi vào world): wire=${hex(p)} plain=${dec ? hex(dec) : 'null'}`);
  }
  step('Chuỗi vào world sau chọn NV', rest.length > 0, `${rest.length} gói: ${burstDesc.join(' | ')}`);

  ws.close();
  console.log('RESULT_JSON ' + JSON.stringify(result));
  process.exitCode = result.steps.every((s) => s.ok) ? 0 : 1;
}

main().catch((e) => {
  log(`TEST-ERROR: ${e.stack || e.message}`);
  console.log('RESULT_JSON ' + JSON.stringify({ steps: [], fatal: e.message }));
  process.exitCode = 1;
});
