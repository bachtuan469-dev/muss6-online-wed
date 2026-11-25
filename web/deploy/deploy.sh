#!/usr/bin/env bash
# deploy.sh — Deploy / cập nhật portal mu-web từ repo muss6-online-wed.
#
# Chạy TRÊN VPS, quyền root, từ thư mục web/deploy/ của repo đã clone:
#   cd muss6-online-wed/web/deploy && sudo bash deploy.sh
#
# Layout repo (web/server/, web/public/) được "flatten" về /opt/mu-web
# (server.js, openmu-accounts.js, ... ở ngay /opt/mu-web/, public/ là
# thư mục con) — giống layout đang chạy live.
#
# Idempotent: không ghi đè .env nếu đã có; không cài đè vhost nếu certbot
# đã sửa. Đổi tên DB / thư mục / cổng bằng biến môi trường:
#   MUWEB_DB=mydb MUWEB_DIR=/opt/mu-web MUWEB_PORT=18082 ADMIN_LOGINS=admin
set -euo pipefail

WEB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MUWEB_DIR="${MUWEB_DIR:-/opt/mu-web}"
MUWEB_DB="${MUWEB_DB:-muss20web}"
MUWEB_PORT="${MUWEB_PORT:-18082}"
ADMIN_LOGINS="${ADMIN_LOGINS:-admin}"

mkdir -p "$MUWEB_DIR/logs" "$MUWEB_DIR/run" "$MUWEB_DIR/public"

# Flatten: server/*.js + package.json -> /opt/mu-web/ ; public/* -> public/
cp "$WEB_DIR/server/server.js" "$WEB_DIR/server/openmu-accounts.js" \
   "$WEB_DIR/server/create-admin.js" "$WEB_DIR/server/reset-admin-password.js" \
   "$WEB_DIR/server/package.json" "$MUWEB_DIR/"
cp -r "$WEB_DIR/public/"* "$MUWEB_DIR/public/"

if [ ! -f "$MUWEB_DIR/.env" ]; then
  MUWEB_PW=$(openssl rand -hex 16)
  # Tạo role muweb (hex password nên an toàn để trong dấu nháy đơn)
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='muweb'" | grep -q 1; then
    sudo -u postgres psql -c "ALTER ROLE muweb WITH LOGIN PASSWORD '$MUWEB_PW'"
  else
    sudo -u postgres psql -c "CREATE ROLE muweb LOGIN PASSWORD '$MUWEB_PW'"
  fi
  sudo -u postgres psql -d "$MUWEB_DB" -v ON_ERROR_STOP=1 -f "$WEB_DIR/deploy/setup-db.sql"
  {
    echo "DATABASE_URL=postgres://muweb:${MUWEB_PW}@127.0.0.1:5432/${MUWEB_DB}"
    echo "MUWEB_PORT=${MUWEB_PORT}"
    echo "ADMIN_LOGINS=${ADMIN_LOGINS}"
  } > "$MUWEB_DIR/.env"
  chmod 600 "$MUWEB_DIR/.env"
  echo "[deploy] đã tạo role muweb + file .env (chmod 600)"
fi

cp "$WEB_DIR/deploy/mu-web.service" /etc/systemd/system/mu-web.service
systemctl daemon-reload
systemctl enable mu-web

# Quyền file: thư mục public/ phải 755 để nginx (www-data) đọc được.
chmod 755 "$MUWEB_DIR" "$MUWEB_DIR/public"
chmod 644 "$MUWEB_DIR/server.js" "$MUWEB_DIR/openmu-accounts.js" "$MUWEB_DIR/create-admin.js" "$MUWEB_DIR/reset-admin-password.js" "$MUWEB_DIR/package.json" "$MUWEB_DIR/public/"* 2>/dev/null || true

if [ ! -f /etc/nginx/sites-enabled/mu-web ]; then
  cp "$WEB_DIR/deploy/mu-web.nginx" /etc/nginx/sites-enabled/mu-web
  echo "[deploy] đã cài vhost nginx mu-web (chưa có SSL — chạy certbot sau, xem README)"
fi
nginx -t && systemctl reload nginx

systemctl restart mu-web
sleep 2
systemctl status mu-web --no-pager | head -8
curl -s "http://127.0.0.1:${MUWEB_PORT}/health" || echo "[deploy] WARN: /health không trả lời"
