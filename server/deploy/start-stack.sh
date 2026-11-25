#!/usr/bin/env bash
# start-stack.sh — khởi động toàn stack muss20-web trên VPS.
# (Thuộc gói deploy lát 2a — CHƯA deploy; xem RUNBOOK.md.)
# Thứ tự: PostgreSQL (service hệ thống) -> OpenMU -> cầu nối -> mặt tiền.
# Mỗi tiến trình: log + pidfile trong $STACK_DIR/run/. Chạy lại khi đã
# chạy = báo rõ và bỏ qua thành phần đó (không khởi động trùng).
set -u

cd "$(dirname "$0")"
if [ -f ./stack.env ]; then set -a; . ./stack.env; set +a; fi

STACK_DIR="${STACK_DIR:-/opt/muss20-web}"
OPENMU_DIR="${OPENMU_DIR:-$STACK_DIR/openmu/src/Startup/bin/Release}"
DOTNET_BIN="${DOTNET_BIN:-dotnet}"
CLIENT_DIR="${CLIENT_DIR:-$STACK_DIR/client}"
BRIDGE_PORT="${BRIDGE_PORT:-18793}"
FRONT_PORT="${FRONT_PORT:-18081}"
OPENMU_HOST="${OPENMU_HOST:-127.0.0.1}"
OPENMU_CS_PORT="${OPENMU_CS_PORT:-44416}"
BRIDGE_LOGIN_XOR3="${BRIDGE_LOGIN_XOR3:-off}"

RUN_DIR="$STACK_DIR/run"
LOG_DIR="$STACK_DIR/logs"
mkdir -p "$RUN_DIR" "$LOG_DIR"

fail() { echo "[start-stack] ERROR: $*" >&2; exit 1; }

start_one() {
  # $1 = tên, $2 = pidfile, $3.. = lệnh
  local name="$1" pidfile="$2"; shift 2
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "[start-stack] $name đã chạy (pid $(cat "$pidfile")) — bỏ qua"
    return 0
  fi
  echo "[start-stack] khởi động $name ..."
  nohup "$@" >> "$LOG_DIR/$name.log" 2>&1 &
  echo $! > "$pidfile"
  sleep 1
  if kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "[start-stack] $name OK (pid $(cat "$pidfile"), log $LOG_DIR/$name.log)"
  else
    echo "[start-stack] ERROR: $name chết ngay sau khi khởi động — xem $LOG_DIR/$name.log" >&2
    tail -n 20 "$LOG_DIR/$name.log" >&2 || true
    return 1
  fi
}

# 1) PostgreSQL: stack dùng service hệ thống của VPS + DB riêng.
if command -v pg_isready >/dev/null 2>&1; then
  pg_isready -q || fail "PostgreSQL chưa sẵn sàng — kiểm tra service postgresql trên VPS (DB riêng của stack: xem RUNBOOK §2)"
else
  echo "[start-stack] WARN không có pg_isready — bỏ qua kiểm tra PostgreSQL"
fi

# 2) OpenMU. -resolveIP:loopback là CỐ Ý: ConnectionInfo luôn trả
#    127.0.0.1 vì cầu nối chạy cùng máy và tự mở TCP tới GameServer;
#    trình duyệt không bao giờ thấy địa chỉ OpenMU (xem RUNBOOK §3).
#    Lần đầu trên VPS phải có -reinit (tạo DB + tài khoản test) — script
#    này KHÔNG tự thêm -reinit; chạy tay lần đầu theo RUNBOOK §3.
[ -d "$OPENMU_DIR" ] || fail "OPENMU_DIR không tồn tại: $OPENMU_DIR"
start_one openmu "$RUN_DIR/openmu.pid" \
  env DOTNET_ROOT="$(dirname "$DOTNET_BIN")" "$DOTNET_BIN" \
  "$OPENMU_DIR/MUnique.OpenMU.Startup.dll" \
  -autostart -version:season6 -resolveIP:loopback -adminpanel:disabled -deamon \
  || fail "OpenMU không khởi động được"

# Chờ ConnectServer mở cổng (tối đa ~60s — lần đầu init lâu hơn).
echo "[start-stack] chờ OpenMU CS ở $OPENMU_HOST:$OPENMU_CS_PORT ..."
for i in $(seq 1 60); do
  if (exec 3<>"/dev/tcp/$OPENMU_HOST/$OPENMU_CS_PORT") 2>/dev/null; then
    exec 3>&- 3<&-; echo "[start-stack] OpenMU CS đã nghe sau ~${i}s"; break
  fi
  if [ "$i" = "60" ]; then fail "OpenMU CS chưa nghe sau 60s — xem $LOG_DIR/openmu.log"; fi
  sleep 1
done

# 3) Cầu nối WS<->TCP.
start_one bridge "$RUN_DIR/bridge.pid" \
  env BRIDGE_PORT="$BRIDGE_PORT" BRIDGE_HOST=127.0.0.1 \
      OPENMU_HOST="$OPENMU_HOST" OPENMU_CS_PORT="$OPENMU_CS_PORT" \
      BRIDGE_LOGIN_XOR3="$BRIDGE_LOGIN_XOR3" \
  node "$STACK_DIR/bridge/bridge.js" \
  || fail "cầu nối không khởi động được"

# 4) Mặt tiền tĩnh + proxy /mu.
[ -d "$CLIENT_DIR" ] || fail "CLIENT_DIR không tồn tại: $CLIENT_DIR"
start_one front "$RUN_DIR/front.pid" \
  env FRONT_PORT="$FRONT_PORT" FRONT_HOST=127.0.0.1 \
      BRIDGE_PORT="$BRIDGE_PORT" CLIENT_DIR="$CLIENT_DIR" \
  node "$STACK_DIR/front-proxy.js" \
  || fail "mặt tiền không khởi động được"

echo "[start-stack] XONG. Kiểm chứng: curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:$FRONT_PORT/ (kỳ vọng 200)"
echo "[start-stack] Log: $LOG_DIR/{openmu,bridge,front}.log — nginx/subdomain: xem RUNBOOK §4."
