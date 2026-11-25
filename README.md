# MU Online Web

Website + server + client cho game **MU Online** chạy trên trình duyệt
(Season 6): server **OpenMU**, client web **Babylon.js**, và **web portal**
(trang chủ, quản lý tài khoản, admin, góp ý).

Repo này chỉ chứa phần do nhóm mình làm/thêm vào. Code gốc OpenMU và
client Babylon **không** copy vào đây — xem mục [Code gốc](#code-gốc)
để lấy đúng nguồn.

> **Trạng thái đợt 1:** đã có `server/` (bridge, accounts API, script chạy
> stack, export dữ liệu) + `web/` (portal). Thư mục `client/` (source
> Babylon đã sửa) sẽ được thêm sau khi 2 bản sửa client đang chạy
> (FIX29: kiểm tra mật khẩu 3–9 ký tự; FIX30: màn hình chờ kiểu 0.97)
> hoàn thành — đừng tìm client ở đây lúc này.
>
> **FIX31 (2026-11-25):** vị trí NPC shop trả về như gốc (bỏ 2 hàng
> FIX28; NPC trùng chỉ giữ ở map thấp nhất), tỉ lệ EXP tăng gấp 10 so
> với trước, nhân vật mới khởi tạo có **2.000.000.000 Zen**. Export dữ
> liệu `server/sql/` được lấy lại sau FIX31 nên khớp với các giá trị
> mới này.

## Repo gồm những gì

```
muss6-online-wed/
├── README.md
├── .env.example          # Mẫu biến môi trường (CHỈ tên biến, KHÔNG giá trị thật)
├── server/               # Phần server
│   ├── bridge/           # Cầu nối WS<->TCP + dịch giao thức client web <-> OpenMU
│   ├── accounts/         # API đăng ký tài khoản (ghi trực tiếp vào PostgreSQL OpenMU)
│   ├── deploy/           # start-stack.sh / stop-stack.sh / stack.env.example
│   └── sql/              # Export dữ liệu: shop + vị trí NPC (lấy lại sau FIX31)
├── web/                  # Web portal (giao diện 0.97 + backend Node cho DB OpenMU)
│   ├── public/           # Trang tĩnh: index / account / admin / news
│   ├── server/           # Backend Node (server.js + openmu-accounts.js + ...)
│   ├── scripts/          # test-local.sh (smoke test) + local-test-db.sql
│   └── deploy/           # deploy.sh + mu-web.service + mu-web.nginx + setup-db.sql
└── client/               # SẮP CÓ (sau FIX29/FIX30) — source Babylon, KHÔNG kèm Data
```

## Yêu cầu trước

| Thứ | Phiên bản (đã chạy thật) | Để làm gì |
| --- | --- | --- |
| Node.js | 22+ (server live chạy 22.23.4) | Bridge, accounts API, web portal |
| PostgreSQL | 16 (live chạy 16.15) | Database của OpenMU + schema `web` của portal |
| .NET SDK | 10 (`TargetFramework` của OpenMU là `net10.0`) | Build OpenMU từ source (chỉ cần lúc build; bản publish chạy self-contained, không cần dotnet hệ thống) |
| Bun | 1.x | Build client Babylon (`npm run build` gọi `bun run ...`) |
| Một server OpenMU đang chạy | xem [Code gốc](#code-gốc) | Game server thật; repo này không kèm code OpenMU |
| Database OpenMU đã khởi tạo | OpenMU tự tạo khi chạy lần đầu | Chứa tài khoản, nhân vật, shop, NPC |

Cổng dùng trong bản live (để tham khảo, đổi được bằng biến môi trường):

| Dịch vụ | Cổng |
| --- | --- |
| OpenMU ConnectServer | 44415 (GMO) / 44416 (Open Source Client) |
| OpenMU GameServer | 45911–45916 |
| OpenMU ChatServer | 45990 |
| Bridge WS | 18793 (chỉ loopback) |
| Mặt tiền tĩnh + proxy `/mu` | 18081 (chỉ loopback) |
| Web portal | 18082 (chỉ loopback; nginx đứng trước) |
| Accounts API (đăng ký rời) | 18794 (chỉ loopback) |

Quy tắc mật khẩu (đồng bộ mọi chỗ — web + game): **3–9 ký tự**.
Game đăng nhập bằng gói `LoginShortPassword` (trường 10 byte); mật khẩu
đúng 10 ký tự bị GameServer trả `InvalidPassword` (đo thật trên game live
2026-11-25: 7 và 9 ký tự vào được, 10 ký tự fail). Web và API đăng ký
đều chặn 10 ký tự trở lên.

## Cài đặt — theo thứ tự chạy được thật

### 1. Server OpenMU

```bash
git clone https://github.com/MUnique/OpenMU.git
cd OpenMU
# Build bản publish self-contained (bản live build từ commit 97a1f34):
dotnet publish src/Startup -c Release
```

Cấu hình trong `ConnectionSettings.xml` (nằm cùng thư mục với bản build):
địa chỉ PostgreSQL, tên database (bản live dùng `muss20web`), user/mật khẩu
của role OpenMU. Khởi động OpenMU lần đầu để nó tự tạo schema + dữ liệu
mặc định, rồi mới làm các bước dưới.

> Không có sẵn server OpenMU thì dừng ở đây — bridge, accounts API và
> web portal đều cần database OpenMU đang chạy.

### 2. Bridge (server/bridge)

Cầu nối WS<->TCP đứng giữa client web và OpenMU: client mở WebSocket
tới bridge, bridge nối TCP tới ConnectServer rồi tới GameServer theo
gói `F4 03 ConnectionInfo`.

```bash
cd muss6-online-wed/server/bridge
npm install
BRIDGE_PORT=18793 BRIDGE_HOST=127.0.0.1 \
  OPENMU_HOST=127.0.0.1 OPENMU_CS_PORT=44416 \
  npm start        # node bridge.js
```

Biến môi trường (mặc định trong code là giá trị gốc PROOF-1, **nhớ ghi đè**
cho đúng với OpenMU của bạn):

| Biến | Mặc định | Bản live |
| --- | --- | --- |
| `BRIDGE_PORT` | 8792 | 18793 |
| `BRIDGE_HOST` | 0.0.0.0 | 127.0.0.1 |
| `OPENMU_HOST` | 127.0.0.1 | 127.0.0.1 |
| `OPENMU_CS_PORT` | 44406 | 44416 |
| `BRIDGE_LOGIN_XOR3` | off | off (chỉ bật khi client thật chứng minh cần) |

Kiểm tra: `node test-ws-replay.js` (`npm run test:ws`).

### 3. Accounts API (server/accounts)

API đăng ký tài khoản, ghi trực tiếp vào PostgreSQL của OpenMU
(`data."Account"`, hash BCrypt cost 11 như OpenMU tự tạo). Đây là API
đăng ký rời; **web portal đã có sẵn chức năng đăng ký** nên phần này
là tùy chọn — chỉ chạy khi cần API đăng ký riêng.

```bash
cd muss6-online-wed/server/accounts
npm install
DATABASE_URL=postgres://<user>:<password>@127.0.0.1:5432/<db> \
  npm run api    # node register-api.js, mặc định 127.0.0.1:18794
```

- `POST /register` và `POST /api/player-account/register`
  với `{loginName, password, eMail}` → `{result: 'done' | 'already_exists' | 'invalid_input' | 'unavailable'}`.
- `GET /health` → `{ok: true, service: 'openmu-register-api'}`.
- Không đặt `DATABASE_URL` thì dùng các biến `OPENMU_PG*`
  (`OPENMU_PGHOST`, `OPENMU_PGPORT`, `OPENMU_PGDATABASE`, `OPENMU_PGUSER`,
  `OPENMU_PGPASSWORD`). **Mật khẩu không có giá trị mặc định** — thiếu là
  báo lỗi rõ ràng, không lặng lẽ dùng mật khẩu mặc định.
- Tạo tài khoản bằng tay: `node create-account.js <loginName> <password> <eMail>`
  (hoặc `ACC_PW=<password> node create-account.js <loginName> <eMail>`).
- Kiểm tra: `node test-accounts.js` (`npm test`).

### 4. Dữ liệu shop + NPC (server/sql)

Các file `.sql` trong `server/sql/` là export dữ liệu đã áp trên server
live: hàng trong shop (đồ +15, Luck, Option +7, Skill, Excellent) và vị
trí NPC. Áp theo thứ tự tên file:

```bash
psql -d <db> -v ON_ERROR_STOP=1 -f server/sql/<file-shop>.sql
psql -d <db> -v ON_ERROR_STOP=1 -f server/sql/<file-npc>.sql
# Kiểm chứng lại:
psql -d <db> -f server/sql/verify-shops-applied.sql
```

### 5. Chạy cả stack bằng script (server/deploy)

```bash
cd muss6-online-wed/server
cp deploy/stack.env.example stack.env   # rồi sửa giá trị cho đúng máy bạn
bash deploy/start-stack.sh   # chờ OpenMU CS, rồi chạy bridge + mặt tiền tĩnh
bash deploy/stop-stack.sh    # dừng stack
```

`stack.env` gồm: thư mục cài đặt, cổng bridge/front, cổng CS OpenMU,
công tắc `BRIDGE_LOGIN_XOR3`, tên database. **Không commit file
`stack.env`** (chứa đường dẫn/môi trường máy bạn).

### 6. Client Babylon (SẮP CÓ — chưa có trong đợt này)

Phần này sẽ nằm ở `client/` sau khi FIX29/FIX30 xong. Quy trình cài
(kiểm chứng từ `package.json` của client) sẽ là:

```bash
git clone https://github.com/bachtuan469-dev/muss6-online-wed.git
cd muss6-online-wed/client
npm install                 # hoặc bun install (có cả package-lock.json và bun.lock)
npm run build               # vite build + copy-data + compress-assets + ...
```

- **Data game không có trong repo:** thư mục `Data/` (~450 MB),
  `Data-v097d/` và dữ liệu trong `public/` (`game-assets`, `packs`,
  `items` — ~880 MB) **phải lấy từ repo gốc**
  [Ignies/OpenMu-Client-Babylon](https://github.com/Ignies/OpenMu-Client-Babylon)
  (client này là fork của repo đó; bản live build từ commit `39bced3`).
  Build script `copy-data` sẽ copy `Data` vào `dist/`.
- Sau khi build, phục vụ thư mục `dist/` bằng web server tĩnh; cấu hình
  `server.json` (`directLogin`) + `serverlist.md` trỏ về bridge của bạn.
- **Giữ nguyên dòng credits:** client mang dòng cảm ơn
  `afrokick/muonlinejs` (điều kiện bản quyền; tool `tools/checks/credits.ts`
  kiểm tra) và file `LICENSE` gốc — không được gỡ.

### 7. Web portal (web/)

Giao diện web kiểu 0.97 (trang chủ / tài khoản / admin) + backend Node
mới viết cho database OpenMU. Có: đăng ký (không kích hoạt email),
đăng nhập web, xem tài khoản/nhân vật, đổi mật khẩu, Top Level, tin tĩnh,
thống kê server (số thật; số người online hiện `—`, không bịa), admin
(tổng quan, tài khoản, nhân vật, đặt lại mật khẩu), Góp ý (cần đăng nhập,
tiêu đề + nội dung; admin đổi trạng thái Mới → Đang xử lý → Xong).

```bash
cd muss6-online-wed/web/server
npm install
```

Backend **không đọc file `.env`** (không dùng dotenv) — đặt biến môi
trường khi chạy, hoặc dùng systemd `EnvironmentFile` khi deploy:

```bash
DATABASE_URL=postgres://muweb:<mat-khau>@127.0.0.1:5432/muss20web \
  MUWEB_PORT=18082 ADMIN_LOGINS=admin \
  npm start        # node server/server.js
```

| Biến | Ý nghĩa |
| --- | --- |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL (bắt buộc; xem `.env.example` ở gốc repo) |
| `MUWEB_PORT` | Cổng nghe (mặc định 18082) |
| `MUWEB_HOST` | Địa chỉ nghe (mặc định 127.0.0.1) |
| `ADMIN_LOGINS` | Tên đăng nhập được làm admin, cách nhau bằng dấu phẩy (mặc định `admin`) |

**Tạo schema web** (chạy 1 lần, bằng postgres superuser — backend chỉ
tự tạo bảng trong schema, không tự tạo schema):

```bash
sudo -u postgres psql -d muss20web -v ON_ERROR_STOP=1 -f web/deploy/setup-db.sql
```

**Tạo tài khoản admin đầu tiên:**

```bash
node server/create-admin.js admin
# In ra: ADMIN_LOGIN=admin + ADMIN_TEMP_PASSWORD=<mật khẩu ngẫu nhiên 9 ký tự>
# Đăng nhập web rồi ĐỔI MẬT KHẨU NGAY.
```

Đổi mật khẩu admin sau này: `node server/reset-admin-password.js admin`
(in mật khẩu ngẫu nhiên mới; hoặc truyền mật khẩu muốn đặt làm tham số
thứ 2 — xem đầu file).

**Kiểm tra:**

```bash
cd muss6-online-wed/web/server
npm test         # bash scripts/test-local.sh — smoke test 41 mục
```

Test tự reset database `muwebtest` về seed (1 tài khoản `test0` + 1 nhân
vật `test0Dk`) rồi chạy qua health/config/news/ranking, đăng ký/đăng nhập,
đổi mật khẩu, admin, góp ý, rate-limit. Cần PostgreSQL local + đặt
`DATABASE_URL` trỏ tới database test với role tối thiểu (xem đầu
`scripts/test-local.sh`).

Mở trình duyệt kiểm tra: `http://127.0.0.1:18082/health` phải trả
`{"ok":true,"service":"mu-web-portal"}`.

## Deploy production (web portal, ngắn gọn)

File mẫu trong `web/deploy/` (sửa miền `mu-web.example.com` thành miền
của bạn trước):

```bash
cd muss6-online-wed/web/deploy && sudo bash deploy.sh
```

Script này: flatten `web/server/` → `/opt/mu-web/` (giống layout live),
tạo role `muweb` + file `.env` (chmod 600) nếu chưa có, chạy
`setup-db.sql`, cài `mu-web.service` (systemd) + vhost nginx mẫu,
restart service, kiểm tra `/health`.

Chứng chỉ SSL: dùng certbot (Let's Encrypt) cho vhost nginx sau khi
trỏ DNS về server — `certbot --nginx -d mu-web.example.com`.

## API chính của web portal

| Route | Mô tả |
| --- | --- |
| `GET /health` | `{ok: true, service: 'mu-web-portal'}` |
| `GET /api/config` | Cấu hình public (season, play_url, ...) |
| `GET /api/news`, `GET /api/ranking`, `GET /api/server-stats` | Tin, Top Level, thống kê server |
| `POST /api/register` | Đăng ký `{loginName, password, eMail}` |
| `POST /api/login` | Đăng nhập web, trả token (cookie/session) |
| `GET /api/user/info`, `/api/user/account`, `/api/user/characters` | Thông tin tài khoản (cần đăng nhập) |
| `POST /api/user/change-password` | Đổi mật khẩu |
| `POST /api/feedback` | Gửi góp ý (cần đăng nhập; 5/giờ/tài khoản) |
| `GET /api/admin/*` | Admin: tổng quan, tài khoản, nhân vật, đặt lại mật khẩu, quản lý góp ý |

## Code gốc

| Phần | Nguồn |
| --- | --- |
| Server OpenMU | [MUnique/OpenMU](https://github.com/MUnique/OpenMU) (MIT) — bản live build từ commit `97a1f34` |
| Client Babylon | [Ignies/OpenMu-Client-Babylon](https://github.com/Ignies/OpenMu-Client-Babylon) — bản live build từ commit `39bced3`; giữ nguyên `LICENSE` + dòng credits `afrokick/muonlinejs` |

## Repo KHÔNG kèm theo

- Code OpenMU gốc (lấy ở link trên, tự build).
- Client Babylon: source sẽ có ở `client/` sau FIX29/FIX30; còn thư mục
  `Data`/`Data-v097d` và dữ liệu `public/` (game-assets, packs, items)
  phải lấy từ repo gốc Ignies.
- Database game: người cài phải tự có server OpenMU + database đã khởi tạo.
- Tính năng reset nhân vật: OpenMU không có sẵn hệ thống reset — chưa có
  trong bản này, sẽ thiết kế riêng sau.

## Ghi chú

- Repo chưa có file LICENSE ở gốc (các phần giữ license riêng của nguồn gốc
  của chúng — xem bảng trên).
- Mật khẩu trong mọi file mẫu đều là placeholder `CHANGE_ME` — không có
  mật khẩu thật nào trong repo.
- Tin tức trên trang chủ đang ẩn (`hidden`) trong đợt này để tập trung
  nghe góp ý; bỏ thuộc tính `hidden` trong `web/public/index.html` là hiện lại.
- Địa chỉ client game đang hardcode trong repo theo bản live
  (`PLAY_URL` trong `web/server/server.js` và nút "Chơi Ngay" trong
  `web/public/index.html`): khi deploy cho riêng bạn, đổi 2 chỗ này
  thành địa chỉ client của bạn.
