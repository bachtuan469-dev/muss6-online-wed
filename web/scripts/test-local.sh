#!/usr/bin/env bash
# test-local.sh — Smoke test backend mu-web o local (DB muwebtest).
# Chay: bash scripts/test-local.sh
# Reset DB ve trang thai seed moi lan chay de ket qua lap lai duoc.
set -u
cd "$(dirname "$0")/.."
LOG=scripts/server-local.log
export DATABASE_URL="${DATABASE_URL:-postgres://muweb:CHANGE_ME@127.0.0.1:5432/muwebtest}"
export MUWEB_PORT=18099
export ADMIN_LOGINS=test0
B=http://127.0.0.1:18099
PASS=0; FAIL=0
ok()   { echo "PASS: $1"; PASS=$((PASS+1)); }
bad()  { echo "FAIL: $1"; FAIL=$((FAIL+1)); }
chk()  { if eval "$2"; then ok "$1"; else bad "$1"; fi; }

# Reset DB ve seed (1 account test0 + 1 nhan vat test0Dk)
sudo -u postgres psql -q < scripts/local-test-db.sql
# Cap quyen cho role test (DB vua reset xong)
sudo -u postgres psql -q -d muwebtest -c "GRANT USAGE, CREATE ON SCHEMA data, config, web TO muwebtest, muweb" -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA data, config, web TO muwebtest, muweb" -c "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA data, config, web TO muwebtest, muweb"

pkill -f 'node server.js' 2>/dev/null; sleep 1
node server/server.js > "$LOG" 2>&1 &
SRV=$!
sleep 2
kill -0 $SRV 2>/dev/null || { echo "server khong len"; cat "$LOG"; exit 1; }

# 1. health / config / news / ranking / server-stats
H=$(curl -s $B/health)
chk "health ok" "echo '$H' | grep -q '\"ok\":true'"
CFG=$(curl -s $B/api/config)
chk "config co season + play_url" "echo '$CFG' | grep -q 'Season 6 Episode 3' && echo '$CFG' | grep -q 'mu-play'"
NEWS=$(curl -s "$B/api/news?limit=10")
chk "news 2 tin mac dinh" "[ \"\$(echo '$NEWS' | python3 -c 'import sys,json;print(len(json.load(sys.stdin)[\"news\"]))')\" = 2 ]"
RK=$(curl -s $B/api/ranking)
chk "ranking co test0Dk Lv 400" "echo '$RK' | grep -q 'test0Dk' && echo '$RK' | grep -q '\"level\":400'"
ST=$(curl -s $B/api/server-stats)
chk "server-stats: accounts=1, characters=1, online=so nguyen >=0, offline" "echo '$ST' | grep -q '\"accounts\":1' && echo '$ST' | grep -q '\"characters\":1' && echo '$ST' | grep -Eq '\"online\":[0-9]+' && echo '$ST' | grep -q '\"status\":\"offline\"'"

# 2. register local1 (dang 0.97: username/email/password) -> auto-login token
REG=$(curl -s -X POST $B/api/register -H 'Content-Type: application/json' -d '{"username":"local1","email":"local1@x.com","password":"pw12345"}')
TOK=$(echo "$REG" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
chk "register local1 tra token" "[ -n '$TOK' ]"
DUP=$(curl -s -X POST $B/api/register -H 'Content-Type: application/json' -d '{"username":"local1","email":"local1@x.com","password":"pw12345"}')
chk "register trung bi chan" "echo '$DUP' | grep -q 'đã tồn tại'"
BAD=$(curl -s -X POST $B/api/register -H 'Content-Type: application/json' -d '{"username":"ab","email":"x@x.com","password":"pw12345"}')
chk "register ten 2 ky tu bi chan" "echo '$BAD' | grep -q '\"success\":false' && echo '$BAD' | grep -q 'loginName'"
BAD10=$(curl -s -X POST $B/api/register -H 'Content-Type: application/json' -d '{"username":"local10","email":"l10@x.com","password":"1234567890"}')
chk "register mat khau 10 ky tu bi chan (gioi han game)" "echo '$BAD10' | grep -q '\"success\":false' && echo '$BAD10' | grep -q 'password'"
DBN=$(sudo -u postgres psql -tAc "SELECT count(*) FROM data.\"Account\" WHERE \"LoginName\"='local1'" muwebtest)
chk "DB co row local1" "[ '$DBN' = 1 ]"

# 3. login + user endpoints
LI=$(curl -s -X POST $B/api/login -H 'Content-Type: application/json' -d '{"username":"test0","password":"test0"}')
TOK0=$(echo "$LI" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
chk "login test0 tra token" "[ -n '$TOK0' ]"
WR=$(curl -s -X POST $B/api/login -H 'Content-Type: application/json' -d '{"username":"test0","password":"sai"}')
chk "login sai mat khau bi chan" "echo '$WR' | grep -q '\"success\":false'"
UI=$(curl -s $B/api/user/info -H "Authorization: Bearer $TOK0")
chk "user/info test0" "echo '$UI' | grep -q '\"username\":\"test0\"'"
UA=$(curl -s $B/api/user/account -H "Authorization: Bearer $TOK0")
chk "user/account co email" "echo '$UA' | grep -q 'test0@local'"
CH=$(curl -s $B/api/characters -H "Authorization: Bearer $TOK0")
chk "characters co test0Dk Zen 1999984000" "echo '$CH' | grep -q 'test0Dk' && echo '$CH' | grep -q '1999984000'"
UNC=$(curl -s -o /dev/null -w "%{http_code}" $B/api/user/info)
chk "user/info khong token -> HTTP 401" "[ '$UNC' = 401 ]"

# 4. change password -> login lai bang mat khau moi -> tra lai mat khau cu
CP=$(curl -s -X POST $B/api/user/change-password -H "Authorization: Bearer $TOK0" -H 'Content-Type: application/json' -d '{"current_password":"test0","new_password":"test0new"}')
chk "change-password ok" "echo '$CP' | grep -q '\"success\":true'"
LI2=$(curl -s -X POST $B/api/login -H 'Content-Type: application/json' -d '{"username":"test0","password":"test0new"}')
TOK0B=$(echo "$LI2" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
chk "login lai bang mat khau moi" "[ -n '$TOK0B' ]"
OLD=$(curl -s -X POST $B/api/login -H 'Content-Type: application/json' -d '{"username":"test0","password":"test0"}')
chk "mat khau cu khong con dung duoc" "echo '$OLD' | grep -q '\"success\":false'"
curl -s -X POST $B/api/user/change-password -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"current_password":"test0new","new_password":"test0"}' >/dev/null
# doi-mat-khau huy moi session cu (ke ca token vua dung) -> dang nhap lai lay token moi cho admin
LI4=$(curl -s -X POST $B/api/login -H 'Content-Type: application/json' -d '{"username":"test0","password":"test0"}')
TOK0B=$(echo "$LI4" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
chk "login lai sau khi tra mat khau" "[ -n '$TOK0B' ]"

# 5. admin (ADMIN_LOGINS=test0)
ME=$(curl -s $B/api/admin/me -H "Authorization: Bearer $TOK0B")
chk "admin/me test0" "echo '$ME' | grep -q '\"username\":\"test0\"'"
OV=$(curl -s $B/api/admin/overview -H "Authorization: Bearer $TOK0B")
chk "admin/overview accounts=2 characters=1" "echo '$OV' | grep -q '\"accounts\":2' && echo '$OV' | grep -q '\"characters\":1'"
AC=$(curl -s "$B/api/admin/accounts?q=local1" -H "Authorization: Bearer $TOK0B")
AID=$(echo "$AC" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['accounts'][0]['id'])" 2>/dev/null)
chk "admin/accounts tim duoc local1" "[ -n '$AID' ]"
AC1=$(curl -s "$B/api/admin/accounts/$AID" -H "Authorization: Bearer $TOK0B")
chk "admin/accounts/:id tra duoc" "echo '$AC1' | grep -q 'local1'"
NOAC=$(curl -s -o /dev/null -w "%{http_code}" $B/api/admin/overview -H "Authorization: Bearer $TOK")
chk "user thuong (local1) vao admin bi chan HTTP 403" "[ '$NOAC' = 403 ]"
RP=$(curl -s -X POST "$B/api/admin/accounts/$AID/reset-password" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"new_password":"local1new"}')
chk "admin reset-password local1 ok" "echo '$RP' | grep -q '\"success\":true'"
LI3=$(curl -s -X POST $B/api/login -H 'Content-Type: application/json' -d '{"username":"local1","password":"local1new"}')
chk "login local1 bang mat khau admin dat" "echo '$LI3' | grep -q '\"success\":true'"
ACH=$(curl -s "$B/api/admin/characters?q=test0Dk" -H "Authorization: Bearer $TOK0B")
chk "admin/characters tim test0Dk" "echo '$ACH' | grep -q 'test0Dk'"

# 6. feedback (gop y, khong phan loai)
FB1=$(curl -s -X POST $B/api/feedback -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"title":"Test gop y","body":"Noi dung test gop y"}')
FBID=$(echo "$FB1" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
chk "feedback gui duoc, tra id" "[ -n '$FBID' ]"
FBN=$(sudo -u postgres psql -tAc "SELECT count(*) FROM web.feedback WHERE \"Id\"='$FBID'" muwebtest)
chk "DB co row feedback" "[ '$FBN' = 1 ]"
FBNO=$(curl -s -o /dev/null -w "%{http_code}" -X POST $B/api/feedback -H 'Content-Type: application/json' -d '{"title":"x","body":"y"}')
chk "feedback khong token -> 401" "[ '$FBNO' = 401 ]"
FBEMPTY=$(curl -s -X POST $B/api/feedback -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"title":"","body":"y"}')
chk "feedback thieu tieu de -> 400" "echo '$FBEMPTY' | grep -q '\"success\":false'"
FBLIST=$(curl -s "$B/api/admin/feedback" -H "Authorization: Bearer $TOK0B")
chk "admin list feedback thay test gop y" "echo '$FBLIST' | grep -q 'Test gop y'"
FBONE=$(curl -s "$B/api/admin/feedback/$FBID" -H "Authorization: Bearer $TOK0B")
chk "admin xem chi tiet feedback" "echo '$FBONE' | grep -q 'Noi dung test gop y'"
FBST=$(curl -s -X POST "$B/api/admin/feedback/$FBID/status" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"status":"dang_xu_ly"}')
chk "admin doi trang thai dang_xu_ly" "echo '$FBST' | grep -q '\"success\":true'"
FBDB=$(sudo -u postgres psql -tAc "SELECT \"Status\" FROM web.feedback WHERE \"Id\"='$FBID'" muwebtest)
chk "DB status = dang_xu_ly" "[ '$FBDB' = dang_xu_ly ]"
FBBAD=$(curl -s -X POST "$B/api/admin/feedback/$FBID/status" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"status":"sai"}')
chk "admin doi trang thai sai -> 400" "echo '$FBBAD' | grep -q '\"success\":false'"
FBNOA_TOK=$(curl -s -X POST $B/api/login -H 'Content-Type: application/json' -d '{"username":"local1","password":"local1new"}' | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
FBNOA=$(curl -s -o /dev/null -w "%{http_code}" "$B/api/admin/feedback" -H "Authorization: Bearer $FBNOA_TOK")
chk "user thuong xem admin feedback -> 403" "[ '$FBNOA' = 403 ]"
for i in 2 3 4 5; do curl -s -X POST $B/api/feedback -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d "{\"title\":\"rl$i\",\"body\":\"b$i\"}" >/dev/null; done
FBRL=$(curl -s -o /dev/null -w "%{http_code}" -X POST $B/api/feedback -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"title":"rl6","body":"b6"}')
chk "feedback thu 6 trong gio -> 429" "[ '$FBRL' = 429 ]"

# 7. create-admin.js (tao admin moi)
CA=$(DATABASE_URL="$DATABASE_URL" node server/create-admin.js localadmin 2>&1)
chk "create-admin tao localadmin" "echo '$CA' | grep -q 'ADMIN_LOGIN=localadmin' && echo '$CA' | grep -q 'ADMIN_TEMP_PASSWORD='"
CA2=$(DATABASE_URL="$DATABASE_URL" node server/create-admin.js localadmin 2>&1; echo "exit=$?")
chk "create-admin trung -> exit 2, khong in mat khau" "echo '$CA2' | grep -q 'exit=2' && ! echo '$CA2' | grep -q 'ADMIN_TEMP_PASSWORD='"

# 8. tang thuong admin (give-zen / give-points / give-level)
# Nhan vat tam giftDk Lv 10 tren account test0 (tao bang SQL, sau reset DB).
sudo -u postgres psql -q -d muwebtest -c "INSERT INTO data.\"ItemStorage\" (\"Id\", \"Money\") VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 0)" \
  -c "INSERT INTO data.\"Character\" (\"Id\", \"Name\", \"CharacterClassId\", \"AccountId\", \"InventoryId\", \"CharacterSlot\", \"CreateDate\", \"Experience\", \"LevelUpPoints\", \"PositionX\", \"PositionY\", \"CurrentMapId\") VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'giftDk', '22222222-2222-2222-2222-222222222222', '88888888-8888-8888-8888-888888888888', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, now(), 0, 0, 133, 133, '44444444-4444-4444-4444-444444444444')" \
  -c "INSERT INTO data.\"StatAttribute\" (\"Id\", \"DefinitionId\", \"CharacterId\", \"Value\", \"AccountId\") VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 10, '88888888-8888-8888-8888-888888888888')"
GID=cccccccc-cccc-cccc-cccc-cccccccccccc
GP=$(curl -s -X POST "$B/api/admin/characters/$GID/give-points" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"points":50}')
chk "give-points +50 ok, tra points 50" "echo '$GP' | grep -q '\\\"success\\\":true' && echo '$GP' | grep -q '\\\"points\\\":50'"
GPDB=$(sudo -u postgres psql -tAc "SELECT \"LevelUpPoints\" FROM data.\"Character\" WHERE \"Id\"='$GID'" muwebtest)
chk "DB LevelUpPoints giftDk = 50" "[ '$GPDB' = 50 ]"
GZ=$(curl -s -X POST "$B/api/admin/characters/$GID/give-zen" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"amount":1000000}')
chk "give-zen +1000000 ok, tra zen 1000000" "echo '$GZ' | grep -q '\\\"success\\\":true' && echo '$GZ' | grep -q '\\\"zen\\\":1000000'"
GZDB=$(sudo -u postgres psql -tAc "SELECT \"Money\" FROM data.\"ItemStorage\" WHERE \"Id\"='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'" muwebtest)
chk "DB Money giftDk = 1000000" "[ '$GZDB' = 1000000 ]"
GL=$(curl -s -X PATCH "$B/api/admin/characters/$GID" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"level":25}')
chk "give-level 25 ok" "echo '$GL' | grep -q '\\\"success\\\":true' && echo '$GL' | grep -q '\\\"level\\\":25'"
GLDB=$(sudo -u postgres psql -tAc "SELECT \"Value\" FROM data.\"StatAttribute\" WHERE \"CharacterId\"='$GID'" muwebtest)
chk "DB Level giftDk = 25" "[ '$GLDB' = 25 ]"
GLC=$(curl -s -X PATCH "$B/api/admin/characters/$GID" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"level":500}')
chk "give-level 500 kep tran 400" "echo '$GLC' | grep -q '\\\"level\\\":400' && echo '$GLC' | grep -q '\\\"clamped\\\":true'"
GZC=$(curl -s -X POST "$B/api/admin/characters/$GID/give-zen" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"amount":3000000000}')
chk "give-zen vuot tran kep 2147483647" "echo '$GZC' | grep -q '\\\"zen\\\":2147483647' && echo '$GZC' | grep -q '\\\"clamped\\\":true'"
GZCDB=$(sudo -u postgres psql -tAc "SELECT \"Money\" FROM data.\"ItemStorage\" WHERE \"Id\"='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'" muwebtest)
chk "DB Money giftDk = 2147483647 sau kep" "[ '$GZCDB' = 2147483647 ]"
GP0=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/admin/characters/$GID/give-points" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"points":0}')
chk "give-points 0 -> 400" "[ '$GP0' = 400 ]"
GZN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/admin/characters/$GID/give-zen" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"amount":-5}')
chk "give-zen -5 -> 400" "[ '$GZN' = 400 ]"
GL0=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$B/api/admin/characters/$GID" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"level":0}')
chk "give-level 0 -> 400" "[ '$GL0' = 400 ]"
G404=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/admin/characters/00000000-0000-0000-0000-000000000000/give-zen" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"amount":10}')
chk "give-zen nhan vat khong ton tai -> 404" "[ '$G404' = 404 ]"
G403=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/admin/characters/$GID/give-zen" -H "Authorization: Bearer $FBNOA_TOK" -H 'Content-Type: application/json' -d '{"amount":10}')
chk "user thuong give-zen -> 403" "[ '$G403' = 403 ]"
LOGZ=$(sudo -u postgres psql -tAc "SELECT count(*) FROM web.admin_log WHERE \"Action\"='give-zen'" muwebtest)
chk "admin_log co 2 dong give-zen" "[ '$LOGZ' = 2 ]"
LOGP=$(sudo -u postgres psql -tAc "SELECT count(*) FROM web.admin_log WHERE \"Action\"='give-points'" muwebtest)
chk "admin_log co 1 dong give-points" "[ '$LOGP' = 1 ]"
LOGL=$(sudo -u postgres psql -tAc "SELECT count(*) FROM web.admin_log WHERE \"Action\"='give-level'" muwebtest)
chk "admin_log co 2 dong give-level" "[ '$LOGL' = 2 ]"
# Chan online: presence gia tra test0 online, giftDk thuoc test0 -> 403
node scripts/fake-presence.js > scripts/fake-presence.log 2>&1 &
FP=$!
sleep 1
FPC=$(curl -s http://127.0.0.1:3003/presence)
chk "fake presence len, tra test0 online" "echo '$FPC' | grep -q 'test0'"
GON=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/admin/characters/$GID/give-zen" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"amount":10}')
chk "give-zen khi online -> 403" "[ '$GON' = 403 ]"
GONB=$(curl -s -X POST "$B/api/admin/characters/$GID/give-zen" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"amount":10}')
chk "give-zen khi online tra loi co chu online" "echo '$GONB' | grep -q 'online'"
CHON=$(curl -s "$B/api/admin/characters?q=giftDk" -H "Authorization: Bearer $TOK0B")
chk "admin/characters tra online=true khi presence bao online" "echo '$CHON' | grep -q 'giftDk' && echo '$CHON' | grep -q '\\\"online\\\":true'"
kill $FP 2>/dev/null; sleep 1
GPOFF=$(curl -s -X POST "$B/api/admin/characters/$GID/give-points" -H "Authorization: Bearer $TOK0B" -H 'Content-Type: application/json' -d '{"points":1}')
chk "presence tat -> gift lai duoc (fail-open)" "echo '$GPOFF' | grep -q '\\\"success\\\":true'"
chk "admin.html co muc Tang thuong" "grep -q 'Tặng thưởng' public/admin.html && grep -q 'grant-level' public/admin.html"

kill $SRV 2>/dev/null
echo "----------------------------------------"
echo "LOCAL TEST: $PASS PASS, $FAIL FAIL"
[ "$FAIL" = 0 ]
