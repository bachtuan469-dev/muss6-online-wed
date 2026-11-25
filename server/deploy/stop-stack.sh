#!/usr/bin/env bash
# stop-stack.sh — dừng stack muss20-web trên VPS (thứ tự ngược:
# mặt tiền -> cầu nối -> OpenMU). KHÔNG đụng PostgreSQL (service hệ
# thống dùng chung) và KHÔNG xoá DB/dữ liệu — gỡ hẳn xem RUNBOOK §7.
set -u

cd "$(dirname "$0")"
if [ -f ./stack.env ]; then set -a; . ./stack.env; set +a; fi
STACK_DIR="${STACK_DIR:-/opt/muss20-web}"
RUN_DIR="$STACK_DIR/run"

stop_one() {
  local name="$1" pidfile="$RUN_DIR/$1.pid"
  if [ ! -f "$pidfile" ]; then
    echo "[stop-stack] $name: không có pidfile — coi như đã dừng"
    return 0
  fi
  local pid; pid="$(cat "$pidfile")"
  if kill -0 "$pid" 2>/dev/null; then
    echo "[stop-stack] dừng $name (pid $pid) ..."
    kill "$pid" 2>/dev/null || true
    for i in $(seq 1 10); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$pid" 2>/dev/null; then
      echo "[stop-stack] $name chưa dừng sau 10s — kill -9 (ghi rõ: ép dừng)"
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "[stop-stack] $name đã dừng"
  else
    echo "[stop-stack] $name: pid $pid không còn chạy"
  fi
  rm -f "$pidfile"
}

stop_one front
stop_one bridge
stop_one openmu
echo "[stop-stack] XONG. PostgreSQL và DB $OPENMU_DB_NAME (nếu có) vẫn nguyên — gỡ hẳn: RUNBOOK §7."
