#!/usr/bin/env python3
"""Patch giao dien web 0.97 -> portal MU OpenMU (ban dau toi gian).

Doc ky tung thay doi: moi phep thay deu assert dung so lan xuat hien
mong doi; sai la dung ngay, khong sua lang. Chay: python3 patch-frontend.py
Sau do tu dong trich <script> cua moi trang va chay node --check.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "public"

failures = []


def rep(path, old, new, count=1):
    p = PUB / path
    s = p.read_text(encoding="utf-8")
    n = s.count(old)
    if n != count:
        failures.append(f"{path}: expected {count}x, found {n}x :: {old[:90]!r}")
        return
    p.write_text(s.replace(old, new), encoding="utf-8")


def re_sub(path, pattern, repl, count=1):
    p = PUB / path
    s = p.read_text(encoding="utf-8")
    # Dung lambda de repl khong bi re xu ly escape (vd. \s trong JS regex).
    new, n = re.subn(pattern, lambda m: repl, s, count=0, flags=re.DOTALL)
    if n != count:
        failures.append(f"{path}: regex expected {count}x, found {n}x :: {pattern[:90]!r}")
        return
    p.write_text(new, encoding="utf-8")


# ---------------------------------------------------------------- index.html
NEW_REGISTER_HANDLER = """  /* Đăng ký: tên tài khoản + email + mật khẩu -> POST /api/register {loginName, password, eMail}.
     Không kích hoạt email: đăng ký xong nhận token và đăng nhập luôn. */
  document.getElementById('registerForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var loginName = (document.getElementById('regLogin').value || '').trim();
    var email = (document.getElementById('regEmail').value || '').trim();
    var password = document.getElementById('regPass').value || '';
    if (!/^[A-Za-z0-9]{3,10}$/.test(loginName)) { showErr('regError', t('auth.errLoginName')); return; }
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { showErr('regError', t('auth.errEmail')); return; }
    if (password.length < 3 || password.length > 9) { showErr('regError', t('auth.errPassShort')); return; }
    var password2 = document.getElementById('regPass2').value || '';
    if (password2 !== password) { showErr('regError', t('auth.errPassMismatch')); return; }
    var btn = document.getElementById('regBtn');
    var old = btn.textContent; btn.disabled = true; btn.textContent = t('auth.registering');
    showErr('regError', '');
    postJson('/api/register', { loginName: loginName, email: email, password: password })
      .then(function (data) {
        if (!data || !data.success) {
          showErr('regError', (data && data.message) || t('auth.errRegFail'));
          return;
        }
        if (!data.token) {
          showErr('regError', (data && data.message) || t('auth.errRegFail'));
          return;
        }
        var name = (data.user && data.user.username) || loginName;
        saveSession(name, data.token);
        closeModalsAndClear();
        showUser({ username: name });
        if (pendingLoginNext) { location.href = pendingLoginNext; }
      })
      .catch(function () { showErr('regError', t('auth.errConn')); })
      .finally(function () { btn.disabled = false; btn.textContent = old; });
  });"""

# Thuong hieu + link choi
rep("index.html", "<title>MU 2003 Pro</title>", "<title>MU Online — Season 6</title>")
rep("index.html", '<link rel="manifest" href="manifest.json">\n', "")
rep("index.html", '<div class="brand-center">MU 2003 PRO</div>', '<div class="brand-center">MU ONLINE</div>')
rep("index.html", '<a class="btn" href="/play" data-i18n="hero.playNow">Chơi Ngay</a>',
    '<a class="btn" href="https://mu-play.103-110-33-22.nip.io/" data-i18n="hero.playNow">Chơi Ngay</a>')
# i18n: ten tai khoan dung de dang nhap (khong phai email)
rep("index.html", "'auth.account': 'Email / Tài khoản'", "'auth.account': 'Tên tài khoản'")
rep("index.html", "'auth.account': 'Email / Account'", "'auth.account': 'Account name'")
rep("index.html", "'auth.errPassShort': 'Mật khẩu phải có tối thiểu 4 ký tự.'",
    "'auth.errPassShort': 'Mật khẩu phải dài 3–9 ký tự (game chỉ nhận tối đa 9 ký tự).'")
rep("index.html", "'auth.errPassShort': 'Password must be at least 4 characters.'",
    "'auth.errPassShort': 'Password must be 3–9 characters (the game accepts at most 9).'")
rep("index.html", '<input id="regPass" type="password" autocomplete="new-password">',
    '<input id="regPass" type="password" autocomplete="new-password" maxlength="9">')
rep("index.html", '<input id="regPass2" type="password" autocomplete="new-password">',
    '<input id="regPass2" type="password" autocomplete="new-password" maxlength="9">')
rep("index.html", "'auth.register': 'Đăng ký', 'auth.login': 'Đăng nhập',",
    "'auth.register': 'Đăng ký', 'auth.login': 'Đăng nhập', 'auth.accountName': 'Tên tài khoản', 'auth.errLoginName': 'Tên tài khoản phải là 3–10 ký tự chữ/số.',")
rep("index.html", "'auth.register': 'Register', 'auth.login': 'Log in',",
    "'auth.register': 'Register', 'auth.login': 'Log in', 'auth.accountName': 'Account name', 'auth.errLoginName': 'Account name must be 3–10 letters/digits.',")
# Ranking: Top Reset -> Top Level, bo cot Reset
rep("index.html", '<h2 data-i18n="ranking.title">Top Reset</h2>', '<h2 data-i18n="ranking.title">Top Level</h2>')
rep("index.html", "          <th data-i18n=\"ranking.resets\">Reset</th>\n", "")
rep("index.html", "<tr><td colspan=\"4\" class=\"muted\" data-i18n=\"common.loading\">Đang tải…</td></tr>",
    "<tr><td colspan=\"3\" class=\"muted\" data-i18n=\"common.loading\">Đang tải…</td></tr>")
rep("index.html", "tb.innerHTML = '<tr><td colspan=\"4\" class=\"muted\">' + esc(t('ranking.empty')) + '</td></tr>';",
    "tb.innerHTML = '<tr><td colspan=\"3\" class=\"muted\">' + esc(t('ranking.empty')) + '</td></tr>';")
rep("index.html", "        '<td class=\"num\">' + esc(r.level) + '</td><td class=\"num\">' + esc(r.resets) + '</td></tr>';",
    "        '<td class=\"num\">' + esc(r.level) + '</td></tr>';")
rep("index.html", "'ranking.title': 'Top Reset', 'ranking.char': 'Nhân vật',",
    "'ranking.title': 'Top Level', 'ranking.char': 'Nhân vật',")
rep("index.html", "'ranking.title': 'Top Reset', 'ranking.char': 'Character',",
    "'ranking.title': 'Top Level', 'ranking.char': 'Character',")
rep("index.html", "        '<tr><td colspan=\"4\" class=\"muted\">' + esc(t('common.error')) + '</td></tr>';",
    "        '<tr><td colspan=\"3\" class=\"muted\">' + esc(t('common.error')) + '</td></tr>';")
# Comment con sot ten cu trong index.html
rep("index.html", "/* Hàng trên cùng: chữ MU 2003 PRO ở giữa, nút đổi ngôn ngữ bên phải */",
    "/* Hàng trên cùng: chữ MU ONLINE ở giữa, nút đổi ngôn ngữ bên phải */")
rep("index.html", "/* Panel trái: Top Reset */", "/* Panel trái: Top Level */")
rep("index.html", "<!-- TRÁI (30%): Top Reset -->", "<!-- TRÁI (30%): Top Level -->")
rep("index.html", "/* ---------- Top Reset: /api/ranking ---------- */", "/* ---------- Top Level: /api/ranking ---------- */")
# ---- Gop y (trang chu, yeu cau dang nhap; KHONG phan loai — chi tieu de + noi dung) ----
FB_SECTION = """    <div class="feedback-block" id="feedbackBlock">
      <h2>Góp ý</h2>
      <div class="rule"><i></i></div>
      <div id="fbGuest">
        <p class="muted">Đăng nhập để gửi góp ý hoặc báo lỗi cho đội ngũ vận hành.</p>
        <button type="button" class="btn" id="fbLoginBtn">Đăng nhập / Đăng ký</button>
      </div>
      <form id="fbForm" style="display:none" novalidate>
        <label for="fbTitle">Tiêu đề</label>
        <input id="fbTitle" type="text" maxlength="200" placeholder="Tiêu đề ngắn…">
        <label for="fbBody">Nội dung</label>
        <textarea id="fbBody" rows="4" maxlength="5000" placeholder="Mô tả lỗi gặp phải hoặc ý kiến của bạn…"></textarea>
        <p class="form-err" id="fbError"></p>
        <p class="form-ok" id="fbOk"></p>
        <button type="submit" class="btn submit">Gửi</button>
      </form>
    </div>"""
rep("index.html",
    '      <div id="newsList"><p class="muted" data-i18n="common.loading">Đang tải…</p></div>\n    </div>',
    '      <div id="newsList"><p class="muted" data-i18n="common.loading">Đang tải…</p></div>\n    </div>\n' + FB_SECTION)
rep("index.html",
    "  function showGuest() {\n    document.getElementById('authGuest').style.display = '';\n    document.getElementById('authUser').style.display = 'none';\n  }",
    "  function showGuest() {\n    document.getElementById('authGuest').style.display = '';\n    document.getElementById('authUser').style.display = 'none';\n    document.getElementById('fbGuest').style.display = '';\n    document.getElementById('fbForm').style.display = 'none';\n  }")
rep("index.html",
    "  function showUser(u) {\n    document.getElementById('authGuest').style.display = 'none';\n    document.getElementById('authUser').style.display = '';\n    document.getElementById('authUsername').textContent = (u && u.username) || '';\n  }",
    "  function showUser(u) {\n    document.getElementById('authGuest').style.display = 'none';\n    document.getElementById('authUser').style.display = '';\n    document.getElementById('authUsername').textContent = (u && u.username) || '';\n    document.getElementById('fbGuest').style.display = 'none';\n    document.getElementById('fbForm').style.display = '';\n  }")
FB_JS = """  /* ---------- Góp ý (yêu cầu đăng nhập) ---------- */
  document.getElementById('fbLoginBtn').addEventListener('click', function () { openModal(loginOverlay, 'loginUser'); });
  document.getElementById('fbForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var errEl = document.getElementById('fbError');
    var okEl = document.getElementById('fbOk');
    errEl.style.display = 'none'; okEl.style.display = 'none';
    var title = (document.getElementById('fbTitle').value || '').trim();
    var body = (document.getElementById('fbBody').value || '').trim();
    if (!title) { errEl.textContent = 'Vui lòng nhập tiêu đề.'; errEl.style.display = 'block'; return; }
    if (title.length > 200) { errEl.textContent = 'Tiêu đề tối đa 200 ký tự.'; errEl.style.display = 'block'; return; }
    if (!body) { errEl.textContent = 'Vui lòng nhập nội dung.'; errEl.style.display = 'block'; return; }
    if (body.length > 5000) { errEl.textContent = 'Nội dung tối đa 5000 ký tự.'; errEl.style.display = 'block'; return; }
    var token = getToken();
    if (!token) { errEl.textContent = 'Vui lòng đăng nhập trước.'; errEl.style.display = 'block'; return; }
    fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ title: title, body: body }) })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d }; }); })
      .then(function (x) {
        if (x.data && x.data.success) {
          document.getElementById('fbTitle').value = '';
          document.getElementById('fbBody').value = '';
          okEl.textContent = 'Đã gửi, cảm ơn bạn! Đội ngũ vận hành sẽ xem và xử lý.';
          okEl.style.display = 'block';
        } else if (x.status === 429) {
          errEl.textContent = 'Bạn gửi quá nhiều, vui lòng thử lại sau 1 giờ.';
          errEl.style.display = 'block';
        } else {
          errEl.textContent = (x.data && x.data.message) || 'Gửi thất bại, vui lòng thử lại.';
          errEl.style.display = 'block';
        }
      })
      .catch(function () { errEl.textContent = 'Không kết nối được máy chủ.'; errEl.style.display = 'block'; });
  });

  /* ---------- Khởi chạy ---------- */"""
rep("index.html", "  /* ---------- Khởi chạy ---------- */", FB_JS)
# CSS toi thieu cho form gop y (o giua trang, khong phai modal)
rep("index.html",
    "  .form-ok{display:none;",
    "  .feedback-block{margin-top:22px}\n  .feedback-block label{display:block;margin:12px 0 5px;font-size:13px;color:var(--gold-dim)}\n  .feedback-block input,.feedback-block select,.feedback-block textarea{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--gold-dim);border-radius:4px;background:#0e1622;color:#e8e2d0;font:inherit;font-size:14px}\n  .feedback-block textarea{resize:vertical;min-height:90px}\n  .feedback-block .btn{margin-top:14px}\n  .form-ok{display:none;")
# ---- Admin: tab Gop y (chi loc theo trang thai, khong loc theo loai) ----
rep("admin.html", '    <button data-tab="characters"><span class="ic">🧑</span>Nhân vật</button>\n',
    '    <button data-tab="characters"><span class="ic">🧑</span>Nhân vật</button>\n    <button data-tab="feedback"><span class="ic">💬</span>Góp ý</button>\n')
rep("admin.html", "    if (name === 'characters') loadCharacters();",
    "    if (name === 'characters') loadCharacters();\n    if (name === 'feedback') loadFeedback();")
FB_SECTION_ADMIN = """  <section id="tab-feedback">
    <div class="card"><h2>Góp ý</h2>
      <div class="row">
        <select id="fb-filter-status"><option value="">Mọi trạng thái</option><option value="moi">Mới</option><option value="dang_xu_ly">Đang xử lý</option><option value="xong">Xong</option></select>
        <button class="btn" onclick="loadFeedback(0)">🔍 Tìm</button></div>
      <p class="note">Bấm vào một mục để xem chi tiết và đổi trạng thái.</p>
      <div id="fb-list"></div></div>
    <div id="fb-detail" style="display:none"></div>
  </section>"""
rep("admin.html", '    <div id="char-detail" style="display:none"></div>\n  </section>',
    '    <div id="char-detail" style="display:none"></div>\n  </section>\n\n\n\n' + FB_SECTION_ADMIN)
FB_JS_ADMIN = """  // ---- Góp ý ----
  var FB_STATUS = { moi: 'Mới', dang_xu_ly: 'Đang xử lý', xong: 'Xong' };
  async function loadFeedback(offset) {
    offset = offset || 0;
    var st = document.getElementById('fb-filter-status').value;
    var qs = '?limit=20&offset=' + offset;
    if (st) qs += '&status=' + encodeURIComponent(st);
    var r = await api('GET', '/api/admin/feedback' + qs);
    if (!r.data || !r.data.success) return;
    var h = '<p class="note">Tổng: ' + r.data.total + ' mục.</p><table><tr><th>Tiêu đề</th><th>Tài khoản</th><th>Trạng thái</th><th>Gửi lúc</th></tr>';
    (r.data.feedback || []).forEach(function (f) {
      h += '<tr class="char-row" onclick="showFeedback(\\'' + f.id + '\\')"><td>' + esc(f.title) + '</td><td>' + esc(f.login_name) + '</td><td>' + esc(FB_STATUS[f.status] || f.status) + '</td><td>' + fmtDate(f.created_at) + '</td></tr>';
    });
    if (!(r.data.feedback || []).length) h += '<tr><td colspan="4" class="note">Chưa có góp ý nào.</td></tr>';
    h += '</table>';
    document.getElementById('fb-list').innerHTML = h;
  }
  window.showFeedback = async function (id) {
    var box = document.getElementById('fb-detail');
    box.style.display = '';
    box.innerHTML = '<p class="note">Đang tải…</p>';
    var r = await api('GET', '/api/admin/feedback/' + encodeURIComponent(id));
    if (!r.data || !r.data.success) { box.innerHTML = '<p class="note">Không tải được nội dung.</p>'; return; }
    var f = r.data.feedback;
    var h = '<div class="card"><h2>' + esc(f.title) + '</h2>' +
      '<p class="note">' + esc(f.login_name) + ' · ' + fmtDate(f.created_at) + ' · Trạng thái: <b>' + esc(FB_STATUS[f.status] || f.status) + '</b></p>' +
      '<div style="white-space:pre-wrap">' + esc(f.body) + '</div>' +
      '<div class="row" style="margin-top:12px">' +
      '<button class="btn' + (f.status === 'moi' ? ' gold' : ' ghost') + '" onclick="setFeedbackStatus(\\'' + f.id + '\\', \\'moi\\')">Mới</button> ' +
      '<button class="btn' + (f.status === 'dang_xu_ly' ? ' gold' : ' ghost') + '" onclick="setFeedbackStatus(\\'' + f.id + '\\', \\'dang_xu_ly\\')">Đang xử lý</button> ' +
      '<button class="btn' + (f.status === 'xong' ? ' gold' : ' ghost') + '" onclick="setFeedbackStatus(\\'' + f.id + '\\', \\'xong\\')">Xong</button>' +
      '</div></div>';
    box.innerHTML = h;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  window.setFeedbackStatus = async function (id, status) {
    var r = await api('POST', '/api/admin/feedback/' + encodeURIComponent(id) + '/status', { status: status });
    if (r.data && r.data.success) { showMsg('Đã đổi trạng thái.'); showFeedback(id); loadFeedback(0); }
    else showMsg((r.data && r.data.message) || 'Đổi trạng thái thất bại.', false);
  };

  // ---- Overview ----"""
rep("admin.html", "  // ---- Overview ----", FB_JS_ADMIN)
# server-stats / config: online null hoac exp/drop null -> hien '—'
rep("index.html", "document.getElementById('onlineCount').textContent = fmtNum(d.online);",
    "document.getElementById('onlineCount').textContent = (d.online == null ? '—' : fmtNum(d.online));")
rep("index.html", "document.getElementById('expValue').textContent = '×' + s.exp;",
    "document.getElementById('expValue').textContent = (s.exp != null ? '×' + s.exp : '—');")
rep("index.html", "document.getElementById('dropValue').textContent = '×' + s.drop;",
    "document.getElementById('dropValue').textContent = (s.drop != null ? '×' + s.drop : '—');")
# Bo o chon do phan giai (rieng client WASM 0.97)
re_sub("index.html", r"      <div class=\"res-picker\">.*?</div>\n", "")
re_sub("index.html", r"  /\* ---------- Bộ chọn độ phân giải.*?\}\)\(\);\n", "")
# Form dang ky: them truong ten tai khoan, bo nut gui lai kich hoat
rep("index.html",
    '      <label for="regEmail">Email</label>\n      <input id="regEmail" type="email" autocomplete="email">',
    '      <label for="regLogin" data-i18n="auth.accountName">Tên tài khoản</label>\n'
    '      <input id="regLogin" type="text" autocomplete="username" maxlength="10">\n'
    '      <label for="regEmail">Email</label>\n      <input id="regEmail" type="email" autocomplete="email">')
rep("index.html", '      <p class="switch" id="resendWrap" style="display:none"><button type="button" id="resendBtn">Gửi lại thư kích hoạt</button></p>\n', "")
rep("index.html", '      <p class="form-ok" id="regOk"></p>\n', "")
rep("index.html", "document.getElementById('openRegister').addEventListener('click', function () { openModal(registerOverlay, 'regEmail'); });",
    "document.getElementById('openRegister').addEventListener('click', function () { openModal(registerOverlay, 'regLogin'); });")
# Thay handler dang ky + xoa handler gui lai kich hoat + quen mat khau
re_sub("index.html",
       r"  /\* Đăng ký: chỉ email \+ mật khẩu.*?\n  \}\);\n\n  /\* Gửi lại thư kích hoạt",
       NEW_REGISTER_HANDLER + "\n\n  /* Gửi lại thư kích hoạt")
re_sub("index.html",
       r"  /\* Gửi lại thư kích hoạt.*?\n  \}\);\n\n  /\* Quên mật khẩu",
       "\n  /* Quên mật khẩu")
re_sub("index.html",
       r"  /\* Quên mật khẩu \(028\).*?\n  \}\);\n\n  /\* ---------- Thông tin server",
       "\n  /* ---------- Thông tin server")
# Xoa modal quen mat khau + nut chuyen sang no + wiring JS
re_sub("index.html",
       r"<!-- Modal Quên mật khẩu.*?</div>\n</div>\n\n<script>",
       "\n<script>")
rep("index.html",
    "      <span>·</span>\n      <button type=\"button\" id=\"switchToForgot\">Quên mật khẩu?</button></p>",
    "</p>")
rep("index.html", "  var forgotOverlay = document.getElementById('forgotOverlay');\n", "")
rep("index.html",
    "  document.getElementById('switchToForgot').addEventListener('click', function () { openModal(forgotOverlay, 'forgotEmail'); });\n", "")
rep("index.html",
    "  document.getElementById('forgotToLogin').addEventListener('click', function () { openModal(loginOverlay, 'loginUser'); });\n", "")
rep("index.html",
    "  [loginOverlay, registerOverlay, forgotOverlay].forEach(function (ov) {",
    "  [loginOverlay, registerOverlay].forEach(function (ov) {")
rep("index.html",
    "    if (forgotOverlay) forgotOverlay.classList.remove('open');\n", "")
# Bo PWA install + banner APK Android (cua game 0.97)
re_sub("index.html", r"    <!-- PWA install \(pwa153\).*?</script>\n", "")
re_sub("index.html", r"    <!-- Android APK \(2026-11-09\).*?</script>\n", "")

# ---------------------------------------------------------------- account.html
rep("account.html", "<title>Quản lý tài khoản — MU 2003 Pro</title>", "<title>Quản lý tài khoản — MU Online</title>")
# Bo tab doi ten + doi class (chua co backend)
rep("account.html", '    <button type="button" class="tab-btn" data-tab="rename" data-i18n="tab.rename">Đổi tên nhân vật</button>\n', "")
rep("account.html", '    <button type="button" class="tab-btn" data-tab="class" data-i18n="tab.class">Đổi class</button>\n', "")
re_sub("account.html", r"  <!-- Tab 9: đổi tên nhân vật.*?</section>\n", "")
re_sub("account.html", r"  <!-- Tab 10: đổi class nhân vật.*?</section>\n", "")
# Bo lich su dang nhap khoi tab tong quan + khoi loadAll/renderAll
rep("account.html",
    '    <h2 class="subh" data-i18n="history.title">Lịch sử đăng nhập</h2>\n'
    '    <div id="loginHistory"><p class="muted" data-i18n="common.loading">Đang tải…</p></div>\n', "")
re_sub("account.html",
       r"    try \{\n      var h = await api\('GET', '/api/user/login-history'\);\n      if \(h && h\.success\) lastLogins = Array\.isArray\(h\.history\) \? h\.history : \[\];\n    \} catch \(e\) \{ /\* lịch sử lỗi thì hiện trạng thái trống \*/ \}\n",
       "")
re_sub("account.html", r"  function renderLogins\(\) \{.*?\n  \}\n\n", "")
rep("account.html", "    renderAccount(); renderChars(); renderLogins(); fillCharSelects();",
    "    renderAccount(); renderChars(); fillCharSelects();")
rep("account.html", "var lastAccount = null, lastInfo = null, lastChars = [], lastLogins = [], lastPublic = null, lastPublicName = '';",
    "var lastAccount = null, lastInfo = null, lastChars = [], lastPublic = null, lastPublicName = '';")
# Tong quan: hien ten tai khoan + email rieng (0.97 dung email lam ten)
rep("account.html",
    '      <dt data-i18n="account.emailAsName">Email (tên tài khoản)</dt>\n      <dd><b id="accEmail">—</b></dd>',
    '      <dt data-i18n="account.username">Tên tài khoản</dt>\n      <dd><b id="accUsername">—</b></dd>\n'
    '      <dt data-i18n="account.email">Email</dt>\n      <dd><b id="accEmail">—</b></dd>')
rep("account.html",
    "    document.getElementById('accEmail').textContent = a.email || a.username || t('account.noEmail');",
    "    document.getElementById('accUsername').textContent = a.username || '';\n"
    "    document.getElementById('accEmail').textContent = a.email || t('account.noEmail');")
# Doi mat khau: gioi han 3-9 ky tu (gioi han cua game OpenMU)
rep("account.html", 'minlength="4" maxlength="128"', 'minlength="3" maxlength="9"', count=3)
rep("account.html", "if (nw.length < 4 || nw.length > 128) { setFormMsg('passwordMsg', t('password.len'), false); return; }",
    "if (nw.length < 3 || nw.length > 9) { setFormMsg('passwordMsg', t('password.len'), false); return; }")
rep("account.html", "'password.note': 'Mật khẩu mới dài 4–128 ký tự.'",
    "'password.note': 'Mật khẩu mới dài 3–9 ký tự (giới hạn của game).'")
rep("account.html", "'password.len': 'Mật khẩu phải dài 4–128 ký tự.'",
    "'password.len': 'Mật khẩu phải dài 3–9 ký tự.'")
rep("account.html", "'password.note': 'The new password must be 4–128 characters.'",
    "'password.note': 'The new password must be 3–9 characters (game limit).'")
rep("account.html", "'password.len': 'Password must be 4–128 characters.'",
    "'password.len': 'Password must be 3–9 characters.'")
# The nhan vat: bo cot Reset + nut Reset, them Zen (reset la tinh nang sau, an UI)
rep("account.html",
    "      '<div><span class=\"k\">' + esc(t('chars.resets')) + ':</span> ' + fmtNum(c.resets) + '</div>';",
    "      '<div><span class=\"k\">Zen:</span> ' + fmtNum(c.zen) + '</div>';")
rep("account.html",
    "    h += '</div><div class=\"char-actions\">' +\n"
    "      '<button type=\"button\" class=\"btn gold\" data-reset=\"' + esc(c.name) + '\">' + esc(t('chars.resetBtn')) + '</button>' +\n"
    "      '</div></div>';",
    "    h += '</div></div>';")
rep("account.html",
    "    box.innerHTML = lastChars.map(charCardHTML).join('');\n"
    "    box.querySelectorAll('[data-reset]').forEach(function (b) {\n"
    "      b.addEventListener('click', function () { resetCharacter(b.getAttribute('data-reset'), b); });\n"
    "    });",
    "    box.innerHTML = lastChars.map(charCardHTML).join('');")
rep("account.html", '    <p class="form-msg" id="resetMsg"></p>\n', "")
re_sub("account.html", r"  /\* ---------- reset nhân vật \(theo mốc, 025\) ---------- \*/.*?\n  \}\n\n  /\* ---------- i18n apply",
       "  /* ---------- i18n apply")
# Class: them DL/SU/RF (ca avatar CSS lan map JS)
rep("account.html", ".avatar.mg { background: #a78bfa; }",
    ".avatar.mg { background: #a78bfa; }\n.avatar.dl { background: #ef4444; }\n.avatar.su { background: #14b8a6; }\n.avatar.rf { background: #f97316; }")
rep("account.html", "var m = { 0: 'DW', 16: 'DK', 32: 'Elf', 48: 'MG' };",
    "var m = { 0: 'DW', 16: 'DK', 32: 'Elf', 48: 'MG', 64: 'DL', 80: 'SU', 96: 'RF' };")
rep("account.html", "var m = { 0: 'dw', 16: 'dk', 32: 'elf', 48: 'mg' };",
    "var m = { 0: 'dw', 16: 'dk', 32: 'elf', 48: 'mg', 64: 'dl', 80: 'su', 96: 'rf' };")

# ---------------------------------------------------------------- news.html
rep("news.html", "<title>Tin tức — MU 2003 Pro</title>", "<title>Tin tức — MU Online</title>")
rep("news.html", "document.title = title + ' — MU 2003 Pro';", "document.title = title + ' — MU Online';")
rep("news.html", "'nav.topReset': 'Top Reset',", "'nav.topReset': 'Top Level',", count=2)
# account.html: nav 'Top Reset' -> 'Top Level' (giong news.html)
rep("account.html", "'nav.topReset': 'Top Reset',", "'nav.topReset': 'Top Level',", count=2)

# ---------------------------------------------------------------- admin.html
rep("admin.html", "<title>Quản trị MU 2003 Pro</title>", "<title>Quản trị MU Online</title>")
rep("admin.html", '<div class="sub">MU 2003 Pro — Admin</div>', '<div class="sub">MU Online — Admin</div>')
# Bo tab tin tuc + nhat ky (ban dau: tin tuc tinh, khong co sua tin; khong co audit)
rep("admin.html", '    <button data-tab="news"><span class="ic">📰</span>Tin tức</button>\n', "")
rep("admin.html", '    <button data-tab="audit"><span class="ic">📜</span>Nhật ký</button>\n', "")
re_sub("admin.html", r"  <section id=\"tab-news\">.*?</section>\n", "")
re_sub("admin.html", r"  <section id=\"tab-audit\">.*?</section>\n", "")
rep("admin.html", "    if (name === 'news') loadNews();\n", "")
rep("admin.html", "    if (name === 'audit') loadAudit();\n", "")
# Bo card canh bao / gui thong bao vao game / ngat server khoi tong quan
re_sub("admin.html",
       r"    <div class=\"card\"><h2>⚠️ Cảnh báo</h2>.*?</p></div>\n",
       "")
re_sub("admin.html",
       r"    <div class=\"card\"><h2>Gửi thông báo vào game</h2>.*?<p class=\"note\" id=\"notice-result\"></p></div>\n",
       "")
re_sub("admin.html",
       r"    <div class=\"card\"><h2>⛔ Ngắt toàn server</h2>.*?<p class=\"note\" id=\"shutdown-note\"></p></div>\n",
       "")
# Tong quan moi: chi so that (tai khoan / nhan vat / moi 7 ngay)
OLD_OVERVIEW = """  async function loadOverview() {
    var r = await api('GET', '/api/admin/overview');
    if (!r.data || !r.data.success) return;
    var d = r.data;
    document.getElementById('ov-stats').innerHTML =
      '<div class="stat"><div class="num">' + d.accounts + '</div><div class="lbl">Tài khoản</div></div>' +
      '<div class="stat"><div class="num">' + d.characters + '</div><div class="lbl">Nhân vật</div></div>' +
      '<div class="stat"><div class="num">' + d.online_sessions + '</div><div class="lbl">Đang online</div></div>' +
      '<div class="stat"><div class="num">' + (d.maintenance_mode ? 'BẬT' : 'Tắt') + '</div><div class="lbl">Bảo trì</div></div>';
    document.getElementById('ov-maint').textContent = d.maintenance_mode
      ? '⚠️ Chế độ bảo trì đang BẬT: tài khoản thường không đăng nhập / đăng ký được.'
      : 'Server đang mở bình thường.';
    refreshShutdownUI(d.maintenance_mode);
    var w = d.warnings || {};
    var online = w.online != null ? w.online : d.online_sessions;
    var dupe = w.dupe_items != null ? w.dupe_items : 0;
    var banned = w.banned_accounts != null ? w.banned_accounts : 0;
    document.getElementById('ov-warnings').innerHTML =
      '<div class="stat' + (online > 0 ? ' warn-yellow' : '') + '"><div class="num">' + online + '</div><div class="lbl">Đang online</div></div>' +
      '<div class="stat' + (dupe > 0 ? ' warn-red' : '') + '"><div class="num">' + dupe + '</div><div class="lbl">Đồ trùng serial</div></div>' +
      '<div class="stat' + (banned > 0 ? ' warn-yellow' : '') + '"><div class="num">' + banned + '</div><div class="lbl">Tài khoản bị khóa <a href="#" onclick="gotoTab(\\'accounts\\');return false;">→ Tài khoản</a></div></div>';
  }"""
NEW_OVERVIEW = """  async function loadOverview() {
    var r = await api('GET', '/api/admin/overview');
    if (!r.data || !r.data.success) return;
    var d = r.data;
    document.getElementById('ov-stats').innerHTML =
      '<div class="stat"><div class="num">' + d.accounts + '</div><div class="lbl">Tài khoản</div></div>' +
      '<div class="stat"><div class="num">' + d.characters + '</div><div class="lbl">Nhân vật</div></div>' +
      '<div class="stat"><div class="num">' + d.new_accounts_7d + '</div><div class="lbl">Tài khoản mới (7 ngày)</div></div>' +
      '<div class="stat"><div class="num">' + d.new_characters_7d + '</div><div class="lbl">Nhân vật mới (7 ngày)</div></div>';
    document.getElementById('ov-maint').textContent = 'Server đang mở bình thường.';
  }"""
rep("admin.html", OLD_OVERVIEW, NEW_OVERVIEW)
rep("admin.html", "    updateNoticeCount();\n    loadOverview();", "    loadOverview();")
# Tai khoan: bo o tim IP + ghi chu IP, them vung chi tiet
rep("admin.html", '        <input id="acc-ip" placeholder="Tìm theo IP…" style="min-width:160px">\n', "")
rep("admin.html",
    '      <p class="note">IP hiển thị = IP connect game gần nhất (last_ip); IP đăng nhập web xem trong Nhật ký (lọc event login).</p>\n', "")
rep("admin.html", "      <div id=\"acc-list\"></div></div>",
    "      <div id=\"acc-list\"></div>\n      <div id=\"acc-detail\" style=\"display:none\"></div></div>")
rep("admin.html", "    var ip = document.getElementById('acc-ip').value.trim();\n", "")
rep("admin.html", "    if (ip) qs += '&ip=' + encodeURIComponent(ip);\n", "")
rep("admin.html",
    "    var h = '<p class=\"note\">Tổng: ' + total + ' tài khoản.</p><table><tr><th>ID</th><th>Tài khoản</th><th>IP cuối</th><th>Online</th><th>Khóa</th><th>Tạo lúc</th><th>Hành động</th></tr>';",
    "    var h = '<p class=\"note\">Tổng: ' + total + ' tài khoản.</p><table><tr><th>ID</th><th>Tài khoản</th><th>Khóa</th><th>Tạo lúc</th><th>Hành động</th></tr>';")
OLD_ACC_ROW = """    (r.data.accounts || []).forEach(function (a) {
      accCache[a.id] = a;
      var accNameHtml = esc(a.email || a.username);
      if (a.is_admin) accNameHtml = '<span class="acc-admin-name">' + accNameHtml + '</span>';
      h += '<tr><td>' + a.id + '</td><td>' + accNameHtml + (a.email && a.username && a.email !== a.username ? '<br><span class="note">' + esc(a.username) + '</span>' : '') + '</td><td>' + esc(a.last_ip || '—') +
        '</td><td>' + (a.online ? '<span class="ok">Online</span>' : '—') +
        '</td><td>' + (a.banned ? '<span class="bad">Đã khóa</span>' + (a.ban_reason ? '<br><span class="note">' + esc(a.ban_reason) + '</span>' : '') + (a.ban_until ? '<br><span class="note">đến ' + fmtDate(a.ban_until) + '</span>' : ' <span class="note">(vĩnh viễn)</span>') : '—') + '</td><td>' + fmtDate(a.created_at) + '</td><td class="acc-act">' +
        (a.banned
          ? '<button class="btn ghost" onclick="accountAction(' + a.id + ',\\'unban\\')">Mở khóa</button>'
          : '<button class="btn danger" onclick="openBanForm(' + a.id + ')">Khóa</button>') + ' ' +
        (a.is_admin
          ? '<button class="btn ghost" onclick="accountAction(' + a.id + ',\\'revoke-admin\\')">Thu hồi admin</button>'
          : '<button class="btn gold" onclick="accountAction(' + a.id + ',\\'grant-admin\\')">Cấp admin</button>') +
        '<button class="btn ghost" onclick="accountAction(' + a.id + ',\\'kick\\')">Kick</button>' +
        ' <button class="btn danger" onclick="deleteAccount(' + a.id + ')">Xóa</button>' +
        '</td></tr>';
    });"""
NEW_ACC_ROW = """    (r.data.accounts || []).forEach(function (a) {
      accCache[a.id] = a;
      var accNameHtml = esc(a.username);
      if (a.is_admin) accNameHtml = '<span class="acc-admin-name">' + accNameHtml + '</span>';
      if (a.email) accNameHtml += '<br><span class="note">' + esc(a.email) + '</span>';
      h += '<tr><td title="' + esc(a.id) + '">' + esc(String(a.id).slice(0, 8)) + '</td><td>' + accNameHtml +
        '</td><td>' + (a.banned ? '<span class="bad">Đã khóa</span>' : '—') + '</td><td>' + fmtDate(a.created_at) + '</td><td class="acc-act">' +
        '<button class="btn ghost" onclick="showAccountChars(\\'' + a.id + '\\')">Nhân vật</button> ' +
        '<button class="btn gold" onclick="showResetPwForm(\\'' + a.id + '\\')">Đặt lại MK</button>' +
        '</td></tr>';
    });"""
rep("admin.html", OLD_ACC_ROW, NEW_ACC_ROW)
rep("admin.html",
    "    if (!(r.data.accounts || []).length) h += '<tr><td colspan=\"7\" class=\"note\">Không có tài khoản nào khớp bộ lọc.</td></tr>';",
    "    if (!(r.data.accounts || []).length) h += '<tr><td colspan=\"5\" class=\"note\">Không có tài khoản nào khớp bộ lọc.</td></tr>';")
# Xoa cac ham hanh dong tai khoan cua 0.97 (khoa / cap admin / kick / xoa) — ban dau khong lam
re_sub("admin.html",
       r"  window\.accountAction = async function.*?\n  \};\n  // ---- Characters ----",
       "  // ---- Characters ----")
# Them ham xem nhan vat + dat lai mat khau cua tai khoan (dung form inline san co #acc-ban-form)
NEW_ACC_FUNCS = """  window.showAccountChars = async function (id) {
    var a = accCache[id] || {};
    var box = document.getElementById('acc-detail');
    box.style.display = '';
    box.innerHTML = '<p class="note">Đang tải nhân vật…</p>';
    var r = await api('GET', '/api/admin/accounts/' + encodeURIComponent(id));
    if (!r.data || !r.data.success) { box.innerHTML = '<p class="note">Không tải được nhân vật.</p>'; return; }
    var chars = r.data.characters || [];
    var h = '<h3>Nhân vật của ' + esc(a.username || r.data.account.username) + '</h3>';
    if (!chars.length) { h += '<p class="note">Tài khoản chưa có nhân vật.</p>'; }
    else {
      h += '<table><tr><th>Nhân vật</th><th>Class</th><th>Level</th><th>Zen</th><th>Map</th><th>Tạo lúc</th></tr>';
      chars.forEach(function (c) {
        h += '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.class_name || '') + '</td><td>' + c.level + '</td><td>' + Number(c.zen || 0).toLocaleString('vi-VN') + '</td><td>' + esc(c.map || '—') + '</td><td>' + fmtDate(c.created_at) + '</td></tr>';
      });
      h += '</table>';
    }
    box.innerHTML = h;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  window.showResetPwForm = function (id) {
    var a = accCache[id] || {};
    var box = document.getElementById('acc-ban-form');
    box.style.display = 'block';
    box.innerHTML = '<h3>Đặt lại mật khẩu — ' + esc(a.username || id) + '</h3>' +
      '<div class="field"><label>Mật khẩu mới (3–9 ký tự)</label><input id="resetpw-new" type="text" placeholder="Mật khẩu mới…" style="width:100%" maxlength="9"></div>' +
      '<div class="row"><button class="btn gold" onclick="submitResetPw(\\'' + id + '\\')">Đặt lại mật khẩu</button> ' +
      '<button class="btn ghost" onclick="document.getElementById(\\'acc-ban-form\\').style.display=\\'none\\'">Hủy</button></div>' +
      '<p class="note">Mật khẩu cũ mất hiệu lực ngay; người chơi phải dùng mật khẩu mới để đăng nhập game và web.</p>';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  window.submitResetPw = async function (id) {
    var pw = (document.getElementById('resetpw-new').value || '').trim();
    if (pw.length < 3 || pw.length > 9) { showMsg('Mật khẩu mới phải dài 3–9 ký tự.', false); return; }
    if (!await confirmDlg('Đặt lại mật khẩu cho tài khoản này? Mật khẩu cũ mất hiệu lực ngay.')) return;
    var r = await api('POST', '/api/admin/accounts/' + encodeURIComponent(id) + '/reset-password', { new_password: pw });
    if (r.data && r.data.success) { showMsg(r.data.message || 'Đã đặt lại mật khẩu.'); document.getElementById('acc-ban-form').style.display = 'none'; loadAccounts(); }
    else showMsg(r.data && r.data.message || 'Đặt lại mật khẩu thất bại.', false);
  };
  window.loadAccounts = loadAccounts;"""
rep("admin.html", "  window.loadAccounts = loadAccounts;", NEW_ACC_FUNCS)
# Nhan vat admin: bo loc online, them DL/SU/RF, doi cot bang thanh Level/Zen/Map
rep("admin.html",
    '        <select id="char-online"><option value="">Online + Offline</option><option value="true">Chỉ online</option><option value="false">Chỉ offline</option></select>\n', "")
rep("admin.html",
    '<select id="char-class"><option value="">Mọi class</option><option value="0">DW</option><option value="16">DK</option><option value="32">Elf</option><option value="48">MG</option></select>',
    '<select id="char-class"><option value="">Mọi class</option><option value="0">DW</option><option value="16">DK</option><option value="32">Elf</option><option value="48">MG</option><option value="64">DL</option><option value="80">SU</option><option value="96">RF</option></select>')
rep("admin.html", "  var CLASS_NAMES = { 0: 'DW', 16: 'DK', 32: 'Elf', 48: 'MG' };",
    "  var CLASS_NAMES = { 0: 'DW', 16: 'DK', 32: 'Elf', 48: 'MG', 64: 'DL', 80: 'SU', 96: 'RF' };")
rep("admin.html", "    var online = document.getElementById('char-online').value;\n", "")
rep("admin.html", "    if (online !== '') qs += '&online=' + encodeURIComponent(online);\n", "")
rep("admin.html",
    "      '<table><tr><th>Nhân vật</th><th>Tài khoản</th><th>Class</th><th>IP</th><th>Tạo lúc</th><th>Lần cuối đăng nhập</th><th>Online</th></tr>';",
    "      '<table><tr><th>Nhân vật</th><th>Tài khoản</th><th>Class</th><th>Level</th><th>Zen</th><th>Map</th><th>Tạo lúc</th></tr>';")
OLD_CHAR_ROW = """    (r.data.characters || []).forEach(function (c) {
      charById[c.id] = c;
      h += '<tr class="char-row" onclick="openCharDetail(' + c.id + ')"><td>' + esc(c.name) + '</td><td>' + esc(c.account_username) + '</td><td>' + (CLASS_NAMES[c.class_code] != null ? CLASS_NAMES[c.class_code] : c.class_code) +
        '</td><td>' + esc(c.last_ip || (accMap && accMap[c.account_id] ? accMap[c.account_id].last_ip : null) || '—') + '</td><td>' + fmtDate(c.created_at) + '</td><td>' + fmtDate(c.last_played_at) +
        '</td><td>' + (c.online ? '<span class="ok">Online</span>' : '—') + '</td></tr>';
    });"""
NEW_CHAR_ROW = """    (r.data.characters || []).forEach(function (c) {
      charById[c.id] = c;
      h += '<tr class="char-row" onclick="openCharDetail(\\'' + c.id + '\\')"><td>' + esc(c.name) + '</td><td>' + esc(c.account_username) + '</td><td>' + (CLASS_NAMES[c.class_code] != null ? CLASS_NAMES[c.class_code] : c.class_code) +
        '</td><td>' + c.level + '</td><td>' + Number(c.zen || 0).toLocaleString('vi-VN') + '</td><td>' + esc(c.map || '—') + '</td><td>' + fmtDate(c.created_at) + '</td></tr>';
    });"""
rep("admin.html", OLD_CHAR_ROW, NEW_CHAR_ROW)
rep("admin.html",
    "    if (!(r.data.characters || []).length) h += '<tr><td colspan=\"7\" class=\"note\">Không có nhân vật nào khớp bộ lọc.</td></tr>';",
    "    if (!(r.data.characters || []).length) h += '<tr><td colspan=\"7\" class=\"note\">Không có nhân vật nào khớp bộ lọc.</td></tr>';")
# Chi tiet nhan vat: chi xem — bo card tang thuong / tui do / them do; bo cot Reset; bo trang thai online
re_sub("admin.html",
       r"      '<div class=\"card\"><div class=\"grant-head\".*?      '<div class=\"card\"><h2>Vị trí",
       "      '<div class=\"card\"><h2>Vị trí")
rep("admin.html", "        stat(c.level_up_points, 'Point') +\n        stat(c.resets, 'Reset') +\n",
    "        stat(c.points, 'Point') +\n")
rep("admin.html",
    "          (c.online ? '<span class=\"pill acc-on\"><span class=\"dot\"></span>Online</span>' : '<span class=\"pill acc-dim\">Offline</span>') +\n"
    "          (c.online && c.realm ? '<span class=\"pill acc-dim\">' + esc(c.realm) + '</span>' : '') +\n",
    "")
rep("admin.html", "        meta('Map', c.map_id == null ? '—' : esc(mapName(c.map_id))) +\n",
    "        meta('Map', c.map ? esc(c.map) : '—') +\n")
rep("admin.html", "        meta('Tọa độ', c.pos_x == null ? '—' : c.pos_x + ', ' + c.pos_y) +\n",
    "        meta('Tọa độ', c.x == null ? '—' : c.x + ', ' + c.y) +\n")
rep("admin.html", "        meta('Realm', c.online && c.realm ? esc(c.realm) : '—') +\n", "")
rep("admin.html", "        meta('Trạng thái', c.online ? 'Online' : 'Offline') +\n", "")
rep("admin.html", "        meta('Chơi lần cuối', fmtDate(c.last_played_at)) +\n", "")
rep("admin.html", "        meta('IP cuối', esc(a.last_ip || '—')) +\n", "")
rep("admin.html", "    wireGrantWizard(id, c.online);\n", "")
rep("admin.html", "'<div class=\"row\"><button class=\"btn\" onclick=\"gotoAccount(' + c.account_id + ')\">Xem trong tab Tài khoản</button></div></div>';",
    "'<div class=\"row\"><button class=\"btn\" onclick=\"gotoAccount(\\'' + c.account_id + '\\')\">Xem trong tab Tài khoản</button></div></div>';")

if failures:
    print("PATCH THAT BAI:")
    for f in failures:
        print(" -", f)
    sys.exit(1)
print("patch OK: tat ca thay doi da ap dung dung so lan")

# Kiem tra cu phap JS trong cac <script> inline
for name in ["index.html", "account.html", "admin.html", "news.html"]:
    html = (PUB / name).read_text(encoding="utf-8")
    blocks = re.findall(r"<script>(.*?)</script>", html, flags=re.DOTALL)
    for i, b in enumerate(blocks):
        tmp = ROOT / f".check-{name}-{i}.js"
        tmp.write_text(b, encoding="utf-8")
        r = subprocess.run(["node", "--check", str(tmp)], capture_output=True, text=True)
        tmp.unlink()
        if r.returncode != 0:
            print(f"JS LOI: {name} script #{i}: {r.stderr.strip()}")
            sys.exit(1)
    print(f"node --check OK: {name} ({len(blocks)} script)")
print("TAT CA JS HOP LE")
