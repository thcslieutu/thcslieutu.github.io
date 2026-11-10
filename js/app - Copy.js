'use strict';
/* =====================================================================
   QUẢN LÝ VI PHẠM HỌC SINH  –  HTML/JS thuần + Supabase  (phiên bản 2)
   ===================================================================== */

const CFG = window.APP_CONFIG || {};
let sb = null;
const S = {
  user: null, profile: null,
  dt: [], lop: [], hs: [], loai: [], nd: [],
  dtMap: new Map(), lopMap: new Map(), hsMap: new Map(), ndMap: new Map(), stt: new Map(),
  charts: []
};

const VAI_TRO = { cho_duyet: 'Chờ duyệt', gv: 'Giáo viên', gvcn: 'GV chủ nhiệm', tpt: 'Tổng phụ trách', bgh: 'Ban giám hiệu', admin: 'Quản trị' };
const TRANG_THAI = { chua_xu_ly: 'Chưa xử lý', dang_xu_ly: 'Đang xử lý', da_xu_ly: 'Đã xử lý' };
const MUC_DO = { 1: 'Nhẹ', 2: 'Trung bình', 3: 'Nặng' };
const PHAM_VI = { hoc_sinh: 'Học sinh', lop: 'Cả lớp' };
const BIEN_PHAP = ['Nhắc nhở', 'Phê bình trước lớp', 'Viết bản tự kiểm điểm', 'Thông báo PHHS',
  'Mời PHHS đến trường', 'Lao động vệ sinh', 'Hạ mức đánh giá rèn luyện', 'Đưa ra Hội đồng kỷ luật'];
const PHUT_HUY = CFG.PHUT_DUOC_HUY || 15;
const NGAY_LUI = CFG.SO_NGAY_DUOC_LUI ?? 7;
const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/* ---------------- Tiện ích ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const boDau = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const TZ = 'Asia/Ho_Chi_Minh';
const fmtTG = d => new Date(d).toLocaleString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtGio = d => new Date(d).toLocaleString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const ngayVN = ts => new Date(ts).toLocaleDateString('en-CA', { timeZone: TZ });   // YYYY-MM-DD
const gioVN = ts => +new Date(ts).toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });
const homNay = () => ngayVN(Date.now());
const nayLocal = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16);   // YYYY-MM-DDTHH:mm giờ VN
const congNgay = (ymd, n) => { const x = new Date(ymd + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const congThang = (ymd, k) => {
  let [y, m, d] = ymd.split('-').map(Number);
  m += k; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1;
  const cuoi = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, cuoi)).padStart(2, '0')}`;
};
const diffNgay = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
const thuCua = ymd => new Date(ymd + 'T00:00:00Z').getUTCDay();
const dauTuan = ymd => congNgay(ymd, -((thuCua(ymd) + 6) % 7));
const tuNgay = d => `${d}T00:00:00+07:00`;
const denNgay = d => `${congNgay(d, 1)}T00:00:00+07:00`;
const vn = ymd => ymd ? ymd.split('-').reverse().join('/') : '';
const so = v => (+v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
const tenRieng = s => String(s).trim().split(/\s+/).pop();
const soSanhTen = (a, b) => tenRieng(a.ho_ten).localeCompare(tenRieng(b.ho_ten), 'vi') || a.ho_ten.localeCompare(b.ho_ten, 'vi');
const chuanHoaTen = s => String(s).trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi').replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toLocaleUpperCase('vi'));
const chuanHoaLop = s => String(s).trim().toUpperCase().replace(/\s+/g, '');
const khoiTu = ten => { const m = String(ten).match(/\d+/); return m ? +m[0] : null; };
const tenLop = id => S.lopMap.get(id)?.ten_lop || '';
const tenDT = id => S.dtMap.get(id)?.ten || '';
const tenND = id => S.ndMap.get(id)?.ho_ten || '';
const coDT = () => S.dt.length > 0;
const vaiTro = () => S.profile?.vai_tro;
const laBGH = () => ['bgh', 'admin'].includes(vaiTro());
const laAdmin = () => vaiTro() === 'admin';
const duocXuLy = () => ['gvcn', 'tpt', 'bgh', 'admin'].includes(vaiTro());
const tenHS = r => r.hoc_sinh_id ? r.ho_ten : 'Cả lớp';
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } }
};

/** Người đang đăng nhập có được xử lý vi phạm r không (khớp hàm co_the_xu_ly trong SQL) */
function coTheXuLy(r) {
  const vt = vaiTro();
  if (vt === 'bgh' || vt === 'admin') return true;
  if (+r.muc_do >= 3) return false;
  const l = S.lopMap.get(r.lop_id);
  if (!l) return false;
  if (vt === 'gvcn') return l.gvcn_id === S.user.id;
  if (vt === 'tpt') return !S.profile.diem_truong_id || l.diem_truong_id === S.profile.diem_truong_id;
  return false;
}

/** Nhóm lớp theo điểm trường: [[dtId|null, [lớp…]], …] */
function nhomTheoDT(ds) {
  const m = new Map(S.dt.map(d => [d.id, []]));
  m.set(null, []);
  ds.forEach(l => (m.get(l.diem_truong_id ?? null) || m.get(null)).push(l));
  return [...m].filter(([, a]) => a.length);
}
const optLop = (sel, ds = S.lop) => {
  const o = l => `<option value="${l.id}" ${String(l.id) === String(sel) ? 'selected' : ''}>${esc(l.ten_lop)}</option>`;
  if (!coDT()) return ds.map(o).join('');
  return nhomTheoDT(ds).map(([d, a]) => `<optgroup label="${esc(d ? tenDT(d) : 'Chưa xếp điểm trường')}">${a.map(o).join('')}</optgroup>`).join('');
};
const optDT = sel => S.dt.map(d => `<option value="${d.id}" ${String(d.id) === String(sel) ? 'selected' : ''}>${esc(d.ten)}</option>`).join('');
const badgeTT = tt => `<span class="tt tt-${tt}">${TRANG_THAI[tt] || tt}</span>`;
const oHS = r => r.hoc_sinh_id ? `<a href="#" data-lsu="${r.hoc_sinh_id}">${esc(r.ho_ten)}</a>` : '<span class="tag-lop">Cả lớp</span>';

function toast(msg, loai = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show ' + loai;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = ''), 3500);
}

function dichLoi(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Sai email hoặc mật khẩu.';
  if (/Email not confirmed/i.test(m)) return 'Email chưa được xác nhận. Hãy mở hộp thư và bấm liên kết xác nhận.';
  if (/User already registered/i.test(m)) return 'Email này đã được đăng ký.';
  if (/rate limit/i.test(m)) return 'Gửi quá nhiều yêu cầu. Vui lòng đợi vài phút rồi thử lại.';
  if (/row-level security|permission denied/i.test(m)) return 'Bạn không có quyền thực hiện thao tác này.';
  if (/foreign key/i.test(m)) return 'Dữ liệu đang được sử dụng ở nơi khác, không thể xóa.';
  if (/duplicate key|unique/i.test(m)) return 'Dữ liệu bị trùng (đã tồn tại).';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Mất kết nối mạng. Vui lòng thử lại.';
  return m;
}

/** Lấy toàn bộ dòng (Supabase giới hạn 1000 dòng/lần) */
async function layHet(build) {
  const out = [], size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

function xuatCSV(tenFile, header, rows) {
  const o = v => {
    let s = String(v ?? '');
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;   // chống Excel hiểu là công thức
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = '\uFEFF' + [header, ...rows].map(r => r.map(o).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = tenFile;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function moModal(html, rong = false) {
  $('#modal-body').onclick = null;
  $('#modal-body').innerHTML = html;
  $('.modal-box').classList.toggle('rong', rong);
  $('#modal').classList.remove('hidden');
}
function dongModal() { $('#modal').classList.add('hidden'); $('#modal-body').innerHTML = ''; }

const ic = p => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  nhap: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  xuly: ic('<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  thongke: ic('<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>'),
  hocsinh: ic('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  loai: ic('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>'),
  nguoidung: ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>')
};

const MENU = [
  { id: 'nhap', ten: 'Nhập vi phạm', ai: () => true },
  { id: 'xuly', ten: 'Xử lý', ai: () => true },
  { id: 'thongke', ten: 'Thống kê', ai: () => true },
  { id: 'hocsinh', ten: 'Học sinh', ai: laBGH },
  { id: 'loai', ten: 'Hình thức VP', ai: laBGH },
  { id: 'nguoidung', ten: 'Tài khoản', ai: laAdmin }
];

/* ---------------- Khởi động & đăng nhập ---------------- */
async function khoiDong() {
  $('#modal').addEventListener('click', e => {
    if (e.target.id === 'modal' || e.target.closest('[data-dong]')) dongModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) dongModal(); });

  if (!window.supabase || !CFG.SUPABASE_URL || /YOUR-PROJECT/.test(CFG.SUPABASE_URL)) {
    document.body.innerHTML = `<div class="login"><div class="card login-card"><h1>Chưa cấu hình</h1>
      <p>Mở file <code>js/config.js</code> và điền <b>SUPABASE_URL</b>, <b>SUPABASE_ANON_KEY</b> của dự án Supabase.</p>
      <p class="muted small">Xem hướng dẫn trong README.md.</p></div></div>`;
    return;
  }

  // Kết quả trả về từ liên kết xác nhận email (đọc trước khi Supabase xóa khỏi địa chỉ)
  const tham = new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1));
  const loiLink = tham.get('error_description') || tham.get('error');
  const tuLinkXacNhan = ['signup', 'email', 'invite', 'magiclink'].includes(tham.get('type'));

  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
  });
  document.title = 'Quản lý vi phạm' + (CFG.TEN_TRUONG ? ' – ' + CFG.TEN_TRUONG : '');
  $('#ten-truong').textContent = CFG.TEN_TRUONG || '';
  $('#ten-truong-login').textContent = CFG.TEN_TRUONG || '';

  ganDangNhap();
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') hienDangNhap(); });
  const { data: { session } } = await sb.auth.getSession();

  if (loiLink || tuLinkXacNhan) history.replaceState(null, '', location.pathname);
  if (session) {
    await vaoApp(session.user);
    if (tuLinkXacNhan) toast('Đã xác nhận email thành công.');
  } else {
    hienDangNhap();
    if (loiLink) {
      $('#login-err').textContent = /expired|invalid|otp/i.test(loiLink)
        ? 'Liên kết xác nhận đã hết hạn hoặc đã được dùng. Hãy thử đăng nhập; nếu chưa được, đăng ký lại hoặc báo Quản trị viên.'
        : 'Không xác nhận được email: ' + loiLink;
    } else if (tuLinkXacNhan) {
      $('#login-ok').textContent = 'Đã xác nhận email. Vui lòng đăng nhập.';
      $('#login-ok').classList.remove('hidden');
    }
  }
}

function hienDangNhap() {
  $('#khung').classList.add('hidden');
  $('#man-dang-nhap').classList.remove('hidden');
}

function ganDangNhap() {
  let dangKy = false;
  $('#lnk-dk').onclick = e => {
    e.preventDefault();
    dangKy = !dangKy;
    $('.dk').classList.toggle('hidden', !dangKy);
    $('#btn-login').textContent = dangKy ? 'Đăng ký' : 'Đăng nhập';
    e.target.textContent = dangKy ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký';
    $('#login-err').textContent = '';
    $('#login-ok').classList.add('hidden');
  };
  $('#f-dang-nhap').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, email = f.email.value.trim(), password = f.pw.value;
    $('#login-err').textContent = '';
    $('#login-ok').classList.add('hidden');
    $('#btn-login').disabled = true;
    try {
      if (dangKy) {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: {
            // Liên kết trong email xác nhận trỏ về đúng trang này (không phải localhost)
            emailRedirectTo: location.origin + location.pathname,
            data: { ho_ten: chuanHoaTen(f.ten.value || '') }
          }
        });
        if (error) throw error;
        if (!data.session) {
          $('#login-ok').textContent = 'Đã đăng ký. Hãy mở email, bấm liên kết xác nhận, sau đó đăng nhập.';
          $('#login-ok').classList.remove('hidden');
          return;
        }
        await vaoApp(data.user);
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await vaoApp(data.user);
      }
    } catch (err) {
      $('#login-err').textContent = dichLoi(err);
    } finally {
      $('#btn-login').disabled = false;
    }
  };
  $('#btn-dang-xuat').onclick = async () => { await sb.auth.signOut(); history.replaceState(null, '', location.pathname); hienDangNhap(); };
}

async function vaoApp(user) {
  S.user = user;
  const { data, error } = await sb.from('nguoi_dung').select('*').eq('id', user.id).maybeSingle();
  if (error) { toast(dichLoi(error), 'err'); return; }
  S.profile = data || { vai_tro: 'cho_duyet' };
  $('#man-dang-nhap').classList.add('hidden');
  $('#khung').classList.remove('hidden');
  $('#ten-user').innerHTML = `${esc(S.profile.ho_ten || user.email)} <span class="role">${VAI_TRO[S.profile.vai_tro] || ''}</span>`;

  if (S.profile.vai_tro === 'cho_duyet') {
    $('#nav').innerHTML = '';
    $('#noi-dung').innerHTML = `<section class="card empty-state"><h2>Tài khoản đang chờ duyệt</h2>
      <p>Tài khoản <b>${esc(user.email)}</b> đã được tạo. Vui lòng báo Quản trị viên cấp quyền, sau đó tải lại trang.</p>
      <button class="btn primary" onclick="location.reload()">Tải lại</button></section>`;
    return;
  }
  try { await taiDanhMuc(); } catch (e) { toast(dichLoi(e), 'err'); }
  dungNav();
  window.onhashchange = dieuHuong;
  dieuHuong();
}

async function taiDanhMuc() {
  const [dt, lop, hs, loai, nd] = await Promise.all([
    layHet(() => sb.from('diem_truong').select('*').order('thu_tu').order('id')),
    layHet(() => sb.from('lop').select('*').order('id')),
    layHet(() => sb.from('hoc_sinh').select('id,ho_ten,lop_id,dang_hoc').order('id')),
    layHet(() => sb.from('loai_vi_pham').select('*').order('thu_tu').order('id')),
    layHet(() => sb.from('nguoi_dung').select('id,ho_ten,email,vai_tro,diem_truong_id').order('id'))
  ]);
  lop.sort((a, b) => (a.khoi ?? 99) - (b.khoi ?? 99) || a.ten_lop.localeCompare(b.ten_lop, 'vi', { numeric: true }));
  hs.sort(soSanhTen);
  S.dt = dt; S.lop = lop; S.hs = hs; S.loai = loai; S.nd = nd;
  S.dtMap = new Map(dt.map(d => [d.id, d]));
  S.lopMap = new Map(lop.map(l => [l.id, l]));
  S.hsMap = new Map(hs.map(h => [h.id, h]));
  S.ndMap = new Map(nd.map(u => [u.id, u]));
  const toi = S.ndMap.get(S.user.id);
  if (toi) Object.assign(S.profile, toi);
  S.stt = new Map();
  const dem = {};
  for (const h of hs) {
    if (!h.dang_hoc) continue;
    dem[h.lop_id] = (dem[h.lop_id] || 0) + 1;
    S.stt.set(h.id, dem[h.lop_id]);
  }
}

function dungNav() {
  $('#nav').innerHTML = MENU.filter(m => m.ai()).map(m =>
    `<a href="#${m.id}" data-v="${m.id}">${ICON[m.id]}<span>${m.ten}</span>${m.id === 'xuly' ? '<span class="badge" id="badge-xl"></span>' : ''}</a>`).join('');
  capNhatBadge();
}

/** Số vi phạm chưa xử lý mà người dùng này được quyền xử lý */
async function capNhatBadge() {
  const b = $('#badge-xl'); if (!b) return;
  if (!duocXuLy()) { b.textContent = ''; return; }
  try {
    const ds = await layHet(() => sb.from('v_vi_pham').select('id,lop_id,muc_do').eq('trang_thai', 'chua_xu_ly').order('id'));
    const n = ds.filter(coTheXuLy).length;
    b.textContent = n ? (n > 99 ? '99+' : n) : '';
  } catch { /* bỏ qua */ }
}

const VIEWS = {};
/* Mỗi lần chuyển trang, số phiên tăng lên. Dữ liệu của trang cũ tải về muộn
   (do bấm chuyển trang nhanh) sẽ bị bỏ qua thay vì ghi vào trang mới → tránh lỗi
   "Cannot set properties of null". */
let phienTrang = 0;
const giuPhien = () => { const p = phienTrang; return () => p === phienTrang; };
function dieuHuong() {
  phienTrang++;
  let v = location.hash.slice(1) || 'nhap';
  if (!MENU.find(m => m.id === v && m.ai())) { v = 'nhap'; history.replaceState(null, '', '#nhap'); }
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.v === v));
  huyChart();
  const el = $('#noi-dung');
  el.onclick = el.oninput = el.onchange = el.onkeydown = el.onsubmit = null;
  window.scrollTo(0, 0);
  const conSong = giuPhien();
  Promise.resolve(VIEWS[v](el)).catch(e => { console.error(e); if (conSong()) toast(dichLoi(e), 'err'); });
}
function huyChart() { S.charts.forEach(c => c.destroy()); S.charts = []; }

/* =====================================================================
   1. NHẬP VI PHẠM
   ===================================================================== */
VIEWS.nhap = function (el) {
  if (!S.nhap) {
    const luu = ls.get('vp_lop');
    S.nhap = { lopId: luu === '0' ? 0 : (S.lopMap.has(+luu) ? +luu : (S.lop[0]?.id || 0)), hs: new Set(), loai: new Set() };
  }
  const N = S.nhap;
  if (N.lopId && !S.lopMap.has(N.lopId)) N.lopId = S.lop[0]?.id || 0;
  const bgh = laBGH();
  const conSong = giuPhien();

  el.innerHTML = `
  <div class="grid-nhap">
    <section class="card">
      <h2><span class="step">1</span> Chọn lớp</h2>
      <div id="ds-lop"></div>
      <h2><span class="step">2</span> Chọn học sinh <small class="muted" id="dem-hs"></small></h2>
      <p class="muted small goi-y">Muốn ghi vi phạm cho <b>cả lớp</b> thì không chọn học sinh nào.</p>
      <input id="tim-hs" class="input" placeholder="Gõ tên để lọc… (Enter: chọn người đầu tiên)" autocomplete="off">
      <div id="ds-hs" class="hs-grid"></div>
    </section>
    <section class="card sticky-col">
      <h2><span class="step">3</span> Chọn vi phạm</h2>
      <div id="ds-loai"></div>
      <div class="lbl">Thời gian vi phạm</div>
      <div class="tg-row">
        <input type="datetime-local" id="tg-vp" class="input">
        <button type="button" class="btn sm" id="tg-bay-gio">Bây giờ</button>
      </div>
      <p class="muted small" id="tg-mota"></p>
      <textarea id="ghi-chu" class="input" rows="2" placeholder="Ghi chú (không bắt buộc)"></textarea>
      <div id="tom-tat" class="tom-tat"></div>
      <p id="canh-bao" class="canh-bao small hidden"></p>
      <button id="btn-ghi" class="btn primary big" disabled>Ghi nhận</button>
      <p class="muted small">Có thể hủy trong ${PHUT_HUY} phút sau khi bấm <b>Ghi nhận</b>.</p>
      <h3>Bạn vừa ghi nhận</h3>
      <div id="gan-day"><p class="muted small">Đang tải…</p></div>
    </section>
  </div>`;

  // Chế độ chọn vi phạm: có học sinh → vi phạm của học sinh; chỉ có lớp → vi phạm của lớp
  const cheDo = () => N.hs.size ? 'hoc_sinh' : (N.lopId ? 'lop' : null);
  const dongBoLoai = () => {
    const cd = cheDo();
    for (const id of [...N.loai]) if ((S.loai.find(l => l.id === id)?.pham_vi || 'hoc_sinh') !== cd) N.loai.delete(id);
  };

  const veLop = () => {
    const chip = l => `<button type="button" class="chip ${l.id === N.lopId ? 'on' : ''}" data-lop="${l.id}">${esc(l.ten_lop)}</button>`;
    const toan = `<button type="button" class="chip ${N.lopId === 0 ? 'on' : ''}" data-lop="0">Tìm toàn trường</button>`;
    $('#ds-lop').innerHTML = coDT()
      ? `<div class="chips">${toan}</div>` + nhomTheoDT(S.lop).map(([d, a]) =>
          `<div class="nhom-lop"><div class="nhom-ten">${esc(d ? tenDT(d) : 'Chưa xếp điểm trường')}</div><div class="chips">${a.map(chip).join('')}</div></div>`).join('')
      : `<div class="chips">${toan}${S.lop.map(chip).join('')}</div>`;
  };
  const veHS = () => {
    const q = boDau($('#tim-hs').value.trim());
    if (!S.lop.length) { $('#ds-hs').innerHTML = '<p class="muted">Chưa có lớp/học sinh. Ban giám hiệu vào mục <b>Học sinh</b> để nhập danh sách.</p>'; return; }
    if (N.lopId === 0 && !q) { $('#ds-hs').innerHTML = '<p class="muted">Gõ tên để tìm học sinh trong toàn trường.</p>'; return; }
    let ds = S.hs.filter(h => h.dang_hoc && (N.lopId === 0 || h.lop_id === N.lopId));
    if (q) ds = ds.filter(h => boDau(h.ho_ten).includes(q));
    ds = ds.slice(0, 150);
    $('#ds-hs').innerHTML = ds.map(h => `<button type="button" class="hs ${N.hs.has(h.id) ? 'on' : ''}" data-hs="${h.id}">
        <span class="stt">${N.lopId === 0 ? esc(tenLop(h.lop_id)) : S.stt.get(h.id)}</span><span class="ten">${esc(h.ho_ten)}</span></button>`).join('')
      || '<p class="muted">Không có học sinh phù hợp.</p>';
  };
  const veLoai = () => {
    const ds = S.loai.filter(l => l.dang_dung);
    const cd = cheDo();
    const nhom = (pv, tieuDe, goiY) => {
      const a = ds.filter(l => (l.pham_vi || 'hoc_sinh') === pv);
      if (!a.length) return '';
      const on = cd === pv;
      return `<div class="nhom-loai ${on ? '' : 'tat'}">
        <div class="nhom-ten">${tieuDe}${on ? '' : ` <span class="goi-y-tat">— ${goiY}</span>`}</div>
        <div class="chips loai">${a.map(l => `<button type="button" class="chip md${l.muc_do || 1} ${N.loai.has(l.id) ? 'on' : ''}" data-loai="${l.id}" ${on ? '' : 'disabled'}>${esc(l.ten)}${+l.diem_tru ? ` <small>−${so(l.diem_tru)}</small>` : ''}</button>`).join('')}</div></div>`;
    };
    const lopTen = N.lopId ? tenLop(N.lopId) : '';
    $('#ds-loai').innerHTML = (
      nhom('lop', `Vi phạm của lớp${lopTen ? ' ' + esc(lopTen) : ''}`, N.lopId ? 'bỏ chọn học sinh để dùng' : 'chọn một lớp để dùng') +
      nhom('hoc_sinh', 'Vi phạm của học sinh', 'chọn học sinh để dùng')
    ) || '<p class="muted">Chưa có hình thức vi phạm.</p>';
  };
  const veTomTat = () => {
    const cd = cheDo();
    const n = cd === 'lop' ? N.loai.size : N.hs.size * N.loai.size;
    $('#dem-hs').textContent = N.hs.size ? `· đã chọn ${N.hs.size}` : '';
    $('#tom-tat').innerHTML = cd === 'lop'
      ? `<span class="tag tag-ca-lop">Cả lớp <b>${esc(tenLop(N.lopId))}</b></span>`
      : [...N.hs].map(id => S.hsMap.get(id)).filter(Boolean)
        .map(h => `<span class="tag">${esc(h.ho_ten)} <i>${esc(tenLop(h.lop_id))}</i><button type="button" data-bo="${h.id}" aria-label="Bỏ chọn">×</button></span>`).join('');
    const cb = $('#canh-bao');
    const nhieu = cd === 'hoc_sinh' && N.hs.size > 1 && N.loai.size > 1;
    cb.classList.toggle('hidden', !nhieu);
    if (nhieu) cb.textContent = `Lưu ý: mỗi học sinh trong ${N.hs.size} em đã chọn sẽ bị ghi cả ${N.loai.size} vi phạm.`;
    const b = $('#btn-ghi');
    b.disabled = !n;
    b.textContent = n
      ? (cd === 'lop' ? `Ghi nhận ${n} vi phạm cho lớp ${tenLop(N.lopId)}` : `Ghi nhận ${n} vi phạm`)
      : (cd ? 'Chọn vi phạm' : 'Chọn lớp hoặc học sinh');
  };
  const veTG = () => {
    const i = $('#tg-vp');
    i.max = nayLocal();
    if (!bgh) i.min = new Date(Date.now() - NGAY_LUI * 864e5 + 7 * 3600e3).toISOString().slice(0, 16);
    const v = i.value;
    $('#tg-bay-gio').classList.toggle('hidden', !v);
    $('#tg-mota').innerHTML = v
      ? `Vi phạm lúc <b>${v.slice(11)} ngày ${vn(v.slice(0, 10))}</b>`
      : `Để trống = lấy giờ hiện tại khi bấm Ghi nhận.${bgh ? '' : ` Có thể chọn lùi tối đa ${NGAY_LUI} ngày.`}`;
  };
  const chonHS = id => { N.hs.has(id) ? N.hs.delete(id) : N.hs.add(id); };
  const doiCheDo = () => { dongBoLoai(); veLoai(); veTomTat(); };

  async function taiGanDay() {
    const box = $('#gan-day'); if (!box) return;
    const { data, error } = await sb.from('v_vi_pham').select('id,thoi_gian,tao_luc,hoc_sinh_id,ho_ten,ten_lop,ten_vi_pham')
      .eq('nguoi_ghi', S.user.id).order('tao_luc', { ascending: false }).limit(8);
    if (!$('#gan-day')) return;
    if (error) { box.innerHTML = `<p class="err">${esc(dichLoi(error))}</p>`; return; }
    const now = Date.now();
    box.innerHTML = data.length ? `<ul class="recent">${data.map(r => `<li>
        <span class="muted">${fmtGio(r.thoi_gian)}</span>
        <span><b>${esc(tenHS(r))}</b> <i class="muted">${esc(r.ten_lop)}</i> — ${esc(r.ten_vi_pham)}</span>
        ${now - new Date(r.tao_luc) < PHUT_HUY * 60e3 ? `<button type="button" class="link" data-huy="${r.id}">Hủy</button>` : ''}</li>`).join('')}</ul>`
      : '<p class="muted small">Chưa có.</p>';
  }

  el.onclick = async e => {
    const t = e.target.closest('[data-lop],[data-hs],[data-loai],[data-bo],[data-huy],#tg-bay-gio');
    if (!t || t.disabled) return;
    const d = t.dataset;
    if (t.id === 'tg-bay-gio') {
      $('#tg-vp').value = ''; veTG();
    } else if (d.lop !== undefined) {
      N.lopId = +d.lop; ls.set('vp_lop', N.lopId);
      $('#tim-hs').value = ''; veLop(); veHS(); doiCheDo();
      if (N.lopId === 0) $('#tim-hs').focus();
    } else if (d.hs) {
      chonHS(+d.hs); t.classList.toggle('on'); doiCheDo();
    } else if (d.loai) {
      const id = +d.loai; N.loai.has(id) ? N.loai.delete(id) : N.loai.add(id);
      t.classList.toggle('on'); veTomTat();
    } else if (d.bo) {
      N.hs.delete(+d.bo); veHS(); doiCheDo();
    } else if (d.huy) {
      if (!confirm('Hủy vi phạm vừa ghi nhận?')) return;
      const { data, error } = await sb.from('vi_pham').delete().eq('id', +d.huy).select('id');
      if (error) toast(dichLoi(error), 'err');
      else if (!data.length) toast(`Không thể hủy (đã quá ${PHUT_HUY} phút).`, 'err');
      else { toast('Đã hủy.'); taiGanDay(); capNhatBadge(); }
    }
  };
  $('#tim-hs').oninput = veHS;
  $('#tim-hs').onkeydown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = $('#ds-hs [data-hs]');
      if (first) { chonHS(+first.dataset.hs); e.target.value = ''; veHS(); doiCheDo(); }
    } else if (e.key === 'Escape') { e.target.value = ''; veHS(); }
  };
  $('#tg-vp').oninput = veTG;
  $('#tg-vp').onfocus = veTG;
  el.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !$('#btn-ghi').disabled) $('#btn-ghi').click(); };

  $('#btn-ghi').onclick = async () => {
    const cd = cheDo();
    const ghiChu = $('#ghi-chu').value.trim() || null;

    // Thời gian vi phạm
    let thoiGian = null;
    const v = $('#tg-vp').value;
    if (v) {
      const t = new Date(v + ':00+07:00');
      if (isNaN(t)) { toast('Thời gian không hợp lệ.', 'err'); return; }
      if (t.getTime() > Date.now() + 60e3) { toast('Thời gian vi phạm không được ở tương lai.', 'err'); return; }
      if (!bgh && t.getTime() < Date.now() - NGAY_LUI * 864e5) { toast(`Chỉ được chọn trong ${NGAY_LUI} ngày gần đây.`, 'err'); return; }
      thoiGian = t.toISOString();
    }

    const rows = [];
    if (cd === 'lop') {
      for (const l of N.loai) rows.push({ hoc_sinh_id: null, lop_id: N.lopId, loai_id: l, ghi_chu: ghiChu, thoi_gian: thoiGian });
    } else {
      for (const h of N.hs) for (const l of N.loai) rows.push({ hoc_sinh_id: h, lop_id: S.hsMap.get(h)?.lop_id, loai_id: l, ghi_chu: ghiChu, thoi_gian: thoiGian });
    }
    if (!rows.length) return;
    const b = $('#btn-ghi'); b.disabled = true; b.textContent = 'Đang lưu…';
    const { error } = await sb.from('vi_pham').insert(rows);
    if (error) { toast(dichLoi(error), 'err'); if (conSong()) veTomTat(); return; }
    toast(`Đã ghi nhận ${rows.length} vi phạm.`);
    N.hs.clear(); N.loai.clear();
    capNhatBadge();
    if (!conSong()) return;
    $('#ghi-chu').value = ''; $('#tim-hs').value = ''; $('#tg-vp').value = '';
    veHS(); veLoai(); veTomTat(); veTG(); taiGanDay();
  };

  dongBoLoai();
  veLop(); veHS(); veLoai(); veTomTat(); veTG(); taiGanDay();
};

/* =====================================================================
   2. XỬ LÝ VI PHẠM
   ===================================================================== */
function moTaQuyenXuLy() {
  const vt = vaiTro();
  if (vt === 'bgh' || vt === 'admin') return 'Bạn được xử lý mọi vi phạm.';
  if (vt === 'gvcn') {
    const ds = S.lop.filter(l => l.gvcn_id === S.user.id).map(l => l.ten_lop);
    return ds.length ? `Bạn được xử lý vi phạm mức Nhẹ, Trung bình của lớp ${ds.join(', ')}. Vi phạm mức Nặng do Ban giám hiệu xử lý.`
      : 'Bạn chưa được giao lớp chủ nhiệm. Báo Quản trị viên để được gán lớp.';
  }
  if (vt === 'tpt') return `Bạn được xử lý vi phạm mức Nhẹ, Trung bình của ${S.profile.diem_truong_id ? 'điểm trường ' + tenDT(S.profile.diem_truong_id) : 'toàn trường'}. Vi phạm mức Nặng do Ban giám hiệu xử lý.`;
  return 'Giáo viên được xem danh sách; việc xử lý do GV chủ nhiệm, Tổng phụ trách và Ban giám hiệu thực hiện.';
}

VIEWS.xuly = async function (el) {
  const xl = duocXuLy(), bgh = laBGH();
  const F = S.locXL || (S.locXL = { tt: 'chua_xu_ly', dt: '', lop: '', md: '', tu: congNgay(homNay(), -30), den: homNay(), q: '', cuaToi: xl && !bgh });
  if (F.dt && !S.dtMap.has(+F.dt)) F.dt = '';
  let all = [], rows = [];
  const chon = new Set();

  el.innerHTML = `
  <section class="card">
    <div class="head-row">
      <h2>Xử lý vi phạm</h2>
      <div class="segs" id="segs">${['chua_xu_ly', 'dang_xu_ly', 'da_xu_ly', ''].map(k =>
        `<button type="button" class="seg ${F.tt === k ? 'on' : ''}" data-tt="${k}">${k ? TRANG_THAI[k] : 'Tất cả'} <span class="cnt" data-cnt="${k}"></span></button>`).join('')}</div>
    </div>
    <div class="filters">
      ${coDT() ? `<label>Điểm trường<select id="xl-dt" class="input"><option value="">Tất cả</option>${optDT(F.dt)}</select></label>` : ''}
      <label>Lớp<select id="xl-lop" class="input"></select></label>
      <label>Mức độ<select id="xl-md" class="input"><option value="">Tất cả</option>${[1, 2, 3].map(k => `<option value="${k}" ${String(F.md) === String(k) ? 'selected' : ''}>${MUC_DO[k]}</option>`).join('')}</select></label>
      <label>Từ ngày<input type="date" id="xl-tu" class="input" value="${F.tu}"></label>
      <label>Đến ngày<input type="date" id="xl-den" class="input" value="${F.den}"></label>
      <label class="grow">Tìm học sinh<input id="xl-q" class="input" placeholder="Nhập tên…" value="${esc(F.q)}"></label>
      <button type="button" class="btn" id="xl-csv">Xuất Excel (CSV)</button>
    </div>
    ${xl && !bgh ? `<label class="switch mb"><input type="checkbox" id="xl-cua-toi" ${F.cuaToi ? 'checked' : ''}> Chỉ hiện vi phạm tôi được xử lý</label>` : ''}
    ${xl ? `<div class="bulk hidden" id="bulk"><b id="bulk-n"></b>
      <button type="button" class="btn primary sm" data-act="bulk-xl">Xử lý các mục đã chọn</button>
      <button type="button" class="btn sm" data-act="bulk-bo">Bỏ chọn</button></div>` : ''}
    <div id="xl-bang" class="table-wrap"><p class="muted pad">Đang tải…</p></div>
    <p class="muted small">${esc(moTaQuyenXuLy())}</p>
  </section>`;

  const veOptLop = () => {
    const ds = F.dt ? S.lop.filter(l => String(l.diem_truong_id) === String(F.dt)) : S.lop;
    if (F.lop && !ds.some(l => String(l.id) === String(F.lop))) F.lop = '';
    $('#xl-lop').innerHTML = `<option value="">Tất cả lớp</option>${optLop(F.lop, ds)}`;
  };

  let lanTai = 0;
  async function tai() {
    const lan = ++lanTai, conSong = giuPhien();
    const moiNhat = () => lan === lanTai && conSong();
    F.lop = $('#xl-lop').value; F.md = $('#xl-md').value; F.tu = $('#xl-tu').value; F.den = $('#xl-den').value;
    $('#xl-bang').innerHTML = '<p class="muted pad">Đang tải…</p>';
    try {
      all = await layHet(() => {
        let q = sb.from('v_vi_pham').select('*').order('thoi_gian', { ascending: false }).order('id', { ascending: false });
        if (F.tu) q = q.gte('thoi_gian', tuNgay(F.tu));
        if (F.den) q = q.lt('thoi_gian', denNgay(F.den));
        if (F.lop) q = q.eq('lop_id', +F.lop);
        else if (F.dt) q = q.eq('diem_truong_id', +F.dt);
        if (F.md) q = q.eq('muc_do', +F.md);
        return q;
      });
    } catch (e) { if (moiNhat()) $('#xl-bang').innerHTML = `<p class="err pad">${esc(dichLoi(e))}</p>`; return; }
    if (!moiNhat()) return;   // đã chuyển trang hoặc đã đổi bộ lọc trong lúc tải
    chon.clear();
    ve();
  }

  function ve() {
    const q = boDau(F.q);
    const base = all.filter(r => (!q || boDau(tenHS(r)).includes(q)) && (!F.cuaToi || coTheXuLy(r)));
    const cnt = { chua_xu_ly: 0, dang_xu_ly: 0, da_xu_ly: 0, '': base.length };
    base.forEach(r => cnt[r.trang_thai]++);
    $$('[data-cnt]').forEach(s => (s.textContent = cnt[s.dataset.cnt]));
    rows = base.filter(r => !F.tt || r.trang_thai === F.tt);
    $('#xl-bang').innerHTML = rows.length ? `<table class="tbl">
      <thead><tr>${xl ? '<th class="w1"><input type="checkbox" id="chk-all" aria-label="Chọn tất cả"></th>' : ''}
        <th>Thời gian</th><th>Học sinh</th><th>Lớp</th><th>Vi phạm</th><th>Người ghi</th><th>Trạng thái</th><th>Biện pháp xử lý</th>${xl ? '<th></th>' : ''}</tr></thead>
      <tbody>${rows.map(r => {
        const duoc = coTheXuLy(r);
        const ghiMuon = Math.abs(new Date(r.tao_luc) - new Date(r.thoi_gian)) > 10 * 60e3;
        return `<tr class="${chon.has(r.id) ? 'sel' : ''}">
        ${xl ? `<td>${duoc ? `<input type="checkbox" data-chk="${r.id}" ${chon.has(r.id) ? 'checked' : ''}>` : ''}</td>` : ''}
        <td class="nowrap">${fmtTG(r.thoi_gian)}${ghiMuon ? `<div class="muted small">ghi lúc ${fmtGio(r.tao_luc)}</div>` : ''}</td>
        <td>${oHS(r)}</td>
        <td>${esc(r.ten_lop)}${coDT() && r.ten_diem_truong ? `<div class="muted small">${esc(r.ten_diem_truong)}</div>` : ''}</td>
        <td><span class="dot md${r.muc_do}"></span>${esc(r.ten_vi_pham)}${+r.muc_do === 3 ? ' <span class="nang">Nặng</span>' : ''}${r.ghi_chu ? `<div class="muted small">${esc(r.ghi_chu)}</div>` : ''}</td>
        <td class="small">${esc(r.ten_nguoi_ghi || '')}</td>
        <td>${badgeTT(r.trang_thai)}</td>
        <td class="small">${esc(r.bien_phap || '')}${r.thoi_gian_xu_ly ? `<div class="muted">${esc(r.ten_nguoi_xu_ly || '')} · ${fmtGio(r.thoi_gian_xu_ly)}</div>` : ''}</td>
        ${xl ? `<td>${duoc ? `<button type="button" class="btn sm" data-xl="${r.id}">Xử lý</button>` : (+r.muc_do === 3 ? '<span class="muted small nowrap">BGH xử lý</span>' : '')}</td>` : ''}
      </tr>`;
      }).join('')}</tbody></table>`
      : '<p class="muted pad">Không có vi phạm nào phù hợp.</p>';
    veBulk();
  }

  function veBulk() {
    const b = $('#bulk'); if (!b) return;
    b.classList.toggle('hidden', !chon.size);
    $('#bulk-n').textContent = `Đã chọn ${chon.size}`;
    const all2 = $('#chk-all');
    const duoc = rows.filter(coTheXuLy);
    if (all2) all2.checked = duoc.length > 0 && duoc.every(r => chon.has(r.id));
  }

  el.onclick = e => {
    const t = e.target.closest('[data-tt],[data-xl],[data-act],[data-lsu],#xl-csv');
    if (!t) return;
    if (t.dataset.tt !== undefined) {
      F.tt = t.dataset.tt;
      $$('#segs .seg').forEach(s => s.classList.toggle('on', s === t));
      chon.clear(); ve();
    } else if (t.dataset.xl) {
      moXuLy([+t.dataset.xl], all, tai);
    } else if (t.dataset.act === 'bulk-xl') {
      moXuLy([...chon], all, tai);
    } else if (t.dataset.act === 'bulk-bo') {
      chon.clear(); ve();
    } else if (t.dataset.lsu) {
      e.preventDefault(); lichSuHS(+t.dataset.lsu);
    } else if (t.id === 'xl-csv') {
      xuatCSV(`vi-pham_${F.tu}_${F.den}.csv`,
        ['Thời gian', 'Ghi lúc', 'Học sinh', 'Lớp', 'Điểm trường', 'Vi phạm', 'Áp dụng cho', 'Mức độ', 'Điểm trừ', 'Ghi chú', 'Người ghi', 'Trạng thái', 'Biện pháp', 'Người xử lý', 'Thời gian xử lý'],
        rows.map(r => [fmtTG(r.thoi_gian), fmtTG(r.tao_luc), tenHS(r), r.ten_lop, r.ten_diem_truong, r.ten_vi_pham, PHAM_VI[r.pham_vi], MUC_DO[r.muc_do], +r.diem_tru, r.ghi_chu, r.ten_nguoi_ghi,
          TRANG_THAI[r.trang_thai], r.bien_phap, r.ten_nguoi_xu_ly, r.thoi_gian_xu_ly ? fmtTG(r.thoi_gian_xu_ly) : '']));
    }
  };
  el.onchange = e => {
    const id = e.target.id;
    if (id === 'chk-all') {
      rows.filter(coTheXuLy).forEach(r => e.target.checked ? chon.add(r.id) : chon.delete(r.id)); ve();
    } else if (e.target.dataset.chk) {
      const k = +e.target.dataset.chk;
      e.target.checked ? chon.add(k) : chon.delete(k);
      e.target.closest('tr').classList.toggle('sel', e.target.checked);
      veBulk();
    } else if (id === 'xl-cua-toi') {
      F.cuaToi = e.target.checked; chon.clear(); ve();
    } else if (id === 'xl-dt') {
      F.dt = e.target.value; veOptLop(); tai();
    } else if (['xl-lop', 'xl-md', 'xl-tu', 'xl-den'].includes(id)) tai();
  };
  el.oninput = e => { if (e.target.id === 'xl-q') { F.q = e.target.value.trim(); ve(); } };

  veOptLop();
  await tai();
};

function moXuLy(ids, nguon, xong) {
  const one = ids.length === 1 ? nguon.find(r => r.id === ids[0]) : null;
  moModal(`<h2>${one ? 'Xử lý vi phạm' : `Xử lý ${ids.length} vi phạm`}</h2>
    ${one ? `<div class="info-box"><b>${esc(tenHS(one))}</b> · lớp ${esc(one.ten_lop)}<br>${esc(one.ten_vi_pham)}${+one.muc_do === 3 ? ' <span class="nang">Nặng</span>' : ''}
      <div class="muted small">${fmtTG(one.thoi_gian)}${one.ten_nguoi_ghi ? ' · ghi bởi ' + esc(one.ten_nguoi_ghi) : ''}</div>
      ${one.ghi_chu ? `<div class="small">Ghi chú: ${esc(one.ghi_chu)}</div>` : ''}</div>` : ''}
    <div class="lbl">Biện pháp xử lý <span class="muted small">(bấm để chèn nhanh)</span></div>
    <div class="chips" id="bp-chips">${BIEN_PHAP.map(b => `<button type="button" class="chip" data-bp="${esc(b)}">${esc(b)}</button>`).join('')}</div>
    <textarea id="bp-text" class="input" rows="3" placeholder="Ghi rõ biện pháp, kết quả xử lý…">${esc(one?.bien_phap || '')}</textarea>
    <div class="lbl">Trạng thái</div>
    <div class="radio-row">
      ${['da_xu_ly', 'dang_xu_ly', 'chua_xu_ly'].map(k => `<label class="radio"><input type="radio" name="tt" value="${k}" ${(one && one.trang_thai !== 'chua_xu_ly' ? one.trang_thai : 'da_xu_ly') === k ? 'checked' : ''}> ${TRANG_THAI[k]}</label>`).join('')}
    </div>
    <div class="modal-actions">
      ${one && laBGH() ? '<button type="button" class="btn danger" id="m-xoa">Xóa vi phạm</button>' : ''}
      <span class="sp"></span>
      <button type="button" class="btn" data-dong>Hủy</button>
      <button type="button" class="btn primary" id="m-luu">Lưu</button>
    </div>`);

  $('#bp-chips').onclick = e => {
    const c = e.target.closest('[data-bp]'); if (!c) return;
    const ta = $('#bp-text'), v = ta.value.trim();
    ta.value = v ? `${v}; ${c.dataset.bp}` : c.dataset.bp;
    ta.focus();
  };
  $('#m-luu').onclick = async () => {
    const tt = $('input[name=tt]:checked').value;
    const bp = $('#bp-text').value.trim() || null;
    if (tt !== 'chua_xu_ly' && !bp) { toast('Vui lòng nhập biện pháp xử lý.', 'err'); $('#bp-text').focus(); return; }
    const btnLuu = $('#m-luu'); btnLuu.disabled = true;
    const { data, error } = await sb.from('vi_pham').update({ trang_thai: tt, bien_phap: tt === 'chua_xu_ly' ? null : bp }).in('id', ids).select('id');
    btnLuu.disabled = false;
    if (error) { toast(dichLoi(error), 'err'); return; }
    if (data.length < ids.length) toast(`Chỉ cập nhật được ${data.length}/${ids.length} mục (không đủ quyền).`, 'err');
    else toast(`Đã cập nhật ${data.length} vi phạm.`);
    dongModal(); capNhatBadge(); xong && xong();
  };
  const xoa = $('#m-xoa');
  if (xoa) xoa.onclick = async () => {
    if (!confirm('Xóa vĩnh viễn vi phạm này? Thao tác không thể hoàn tác.')) return;
    const { data, error } = await sb.from('vi_pham').delete().in('id', ids).select('id');
    if (error || !data.length) { toast(error ? dichLoi(error) : 'Không xóa được (không đủ quyền).', 'err'); return; }
    toast('Đã xóa.'); dongModal(); capNhatBadge(); xong && xong();
  };
}

async function lichSuHS(id) {
  const h = S.hsMap.get(id);
  moModal(`<h2>${esc(h?.ho_ten || 'Học sinh')}</h2><p class="muted">Lớp hiện tại: ${esc(tenLop(h?.lop_id))}${h && !h.dang_hoc ? ' · đã nghỉ học' : ''}</p>
    <div id="ls-body"><p class="muted">Đang tải…</p></div>
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Đóng</button></div>`);
  const { data, error } = await sb.from('v_vi_pham').select('*').eq('hoc_sinh_id', id).order('thoi_gian', { ascending: false });
  const box = $('#ls-body'); if (!box) return;
  if (error) { box.innerHTML = `<p class="err">${esc(dichLoi(error))}</p>`; return; }
  if (!data.length) { box.innerHTML = '<p class="muted">Chưa có vi phạm nào.</p>'; return; }
  const theoLoai = {};
  data.forEach(r => (theoLoai[r.ten_vi_pham] = (theoLoai[r.ten_vi_pham] || 0) + 1));
  const diem = data.reduce((s, r) => s + (+r.diem_tru || 0), 0);
  const chua = data.filter(r => r.trang_thai !== 'da_xu_ly').length;
  const nhieuLop = new Set(data.map(r => r.lop_id)).size > 1;
  box.innerHTML = `<div class="mini-kpis"><div><b>${data.length}</b><span>vi phạm</span></div><div><b>${so(diem)}</b><span>điểm trừ</span></div><div><b>${chua}</b><span>chưa xử lý xong</span></div></div>
    <p class="small">${Object.entries(theoLoai).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span class="tag">${esc(t)} <i>×${n}</i></span>`).join(' ')}</p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Thời gian</th>${nhieuLop ? '<th>Lớp</th>' : ''}<th>Vi phạm</th><th>Trạng thái</th><th>Biện pháp</th></tr></thead>
    <tbody>${data.map(r => `<tr><td class="nowrap">${fmtTG(r.thoi_gian)}</td>${nhieuLop ? `<td>${esc(r.ten_lop)}</td>` : ''}<td>${esc(r.ten_vi_pham)}${r.ghi_chu ? `<div class="muted small">${esc(r.ghi_chu)}</div>` : ''}</td><td>${badgeTT(r.trang_thai)}</td><td class="small">${esc(r.bien_phap || '')}</td></tr>`).join('')}</tbody></table></div>`;
}

/** Chi tiết một lớp trong khoảng thời gian đang thống kê */
function chiTietLop(lopId, ds, tieuDeKy) {
  const l = S.lopMap.get(lopId);
  const a = ds.filter(r => r.lop_id === lopId);
  const tapThe = a.filter(r => !r.hoc_sinh_id);
  const m = new Map();
  a.filter(r => r.hoc_sinh_id).forEach(r => {
    const o = m.get(r.hoc_sinh_id) || { id: r.hoc_sinh_id, ten: r.ho_ten, c: 0, diem: 0 };
    o.c++; o.diem += +r.diem_tru || 0; m.set(r.hoc_sinh_id, o);
  });
  const top = [...m.values()].sort((x, y) => y.c - x.c || y.diem - x.diem);
  const theoLoai = {};
  a.forEach(r => (theoLoai[r.ten_vi_pham] = (theoLoai[r.ten_vi_pham] || 0) + 1));
  moModal(`<h2>Lớp ${esc(l?.ten_lop || '')}</h2>
    <p class="muted">${esc(tieuDeKy)}${l?.gvcn_id ? ' · GVCN: ' + esc(tenND(l.gvcn_id)) : ''}${l?.diem_truong_id ? ' · ' + esc(tenDT(l.diem_truong_id)) : ''}</p>
    <div class="mini-kpis"><div><b>${a.length}</b><span>vi phạm</span></div><div><b>${tapThe.length}</b><span>vi phạm tập thể</span></div>
      <div><b>${m.size}</b><span>học sinh vi phạm</span></div><div><b>${a.filter(r => r.trang_thai !== 'da_xu_ly').length}</b><span>chưa xử lý xong</span></div></div>
    <p class="small">${Object.entries(theoLoai).sort((x, y) => y[1] - x[1]).map(([t, n]) => `<span class="tag">${esc(t)} <i>×${n}</i></span>`).join(' ') || '<span class="muted">Không có vi phạm.</span>'}</p>
    ${top.length ? `<h3>Học sinh vi phạm</h3><div class="table-wrap"><table class="tbl"><thead><tr><th>Học sinh</th><th class="r">Số VP</th><th class="r">Điểm trừ</th></tr></thead>
      <tbody>${top.map(o => `<tr><td><a href="#" data-lsu="${o.id}">${esc(o.ten)}</a></td><td class="r">${o.c}</td><td class="r">${so(o.diem)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${tapThe.length ? `<h3>Vi phạm tập thể</h3><ul class="recent">${tapThe.map(r => `<li><span class="muted">${fmtGio(r.thoi_gian)}</span><span>${esc(r.ten_vi_pham)}</span>${badgeTT(r.trang_thai)}</li>`).join('')}</ul>` : ''}
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Đóng</button></div>`, true);
  $('#modal-body').onclick = e => { const t = e.target.closest('[data-lsu]'); if (t) { e.preventDefault(); lichSuHS(+t.dataset.lsu); } };
}

/* =====================================================================
   3. THỐNG KÊ
   ===================================================================== */
function khoangTK(p, tuyTu, tuyDen) {
  const t = homNay(), [y, m] = t.split('-').map(Number);
  const nh = m >= 8 ? y : y - 1;   // năm bắt đầu năm học (chỉ dùng cho mốc học kỳ)
  const hk1 = `${nh}-${CFG.HK1_BAT_DAU || '09-01'}`, hk2 = `${nh + 1}-${CFG.HK2_BAT_DAU || '01-16'}`, kt = `${nh + 1}-${CFG.NAM_HOC_KET_THUC || '05-31'}`;
  const tw = dauTuan(t), dauThang = t.slice(0, 8) + '01';
  const truocDo = (a, b) => { const n = diffNgay(a, b) + 1; return [congNgay(a, -n), congNgay(a, -1)]; };
  let tu, den, pTu, pDen, a, b;
  switch (p) {
    case 'tuan': tu = tw; den = congNgay(tw, 6); pTu = congNgay(tw, -7); pDen = congNgay(tw, -1); a = 'Tuần này'; b = 'Tuần trước'; break;
    case 'tuan_truoc': tu = congNgay(tw, -7); den = congNgay(tw, -1); pTu = congNgay(tw, -14); pDen = congNgay(tw, -8); a = 'Tuần trước'; b = 'Tuần trước nữa'; break;
    case 'thang': tu = dauThang; den = congNgay(congThang(dauThang, 1), -1); pTu = congThang(dauThang, -1); pDen = congNgay(dauThang, -1); a = 'Tháng này'; b = 'Tháng trước'; break;
    case 'thang_truoc': tu = congThang(dauThang, -1); den = congNgay(dauThang, -1); pTu = congThang(dauThang, -2); pDen = congNgay(tu, -1); a = 'Tháng trước'; b = 'Tháng trước nữa'; break;
    case '30': tu = congNgay(t, -29); den = t; [pTu, pDen] = truocDo(tu, den); a = '30 ngày qua'; b = '30 ngày trước đó'; break;
    case 'hk1': tu = hk1; den = congNgay(hk2, -1); pTu = congThang(hk1, -12); pDen = congNgay(congThang(hk2, -12), -1); a = 'Học kỳ I'; b = 'Học kỳ I năm trước'; break;
    case 'hk2': tu = hk2; den = kt; pTu = hk1; pDen = congNgay(hk2, -1); a = 'Học kỳ II'; b = 'Học kỳ I'; break;
    case 'nam': tu = hk1; den = kt; pTu = congThang(hk1, -12); pDen = congThang(kt, -12); a = 'Năm học này'; b = 'Năm học trước'; break;
    default:
      tu = tuyTu; den = tuyDen;
      [pTu, pDen] = tu && den && tu <= den ? truocDo(tu, den) : ['', ''];
      a = 'Kỳ đã chọn'; b = 'Kỳ liền trước';
  }
  // Kỳ đang diễn ra: chỉ tính đến hôm nay, kỳ so sánh cắt cùng số ngày cho công bằng
  if (den > t) den = t;
  if (tu && den && tu <= den && pTu) {
    const capDen = congNgay(pTu, diffNgay(tu, den));
    if (capDen < pDen) pDen = capDen;
  }
  return { tu, den, pTu, pDen, a, b };
}

function xuHuong(c, p, fmt = so) {
  const d = c - p;
  if (!d) return '<em class="flat">— không đổi</em>';
  const pct = p ? ` (${d > 0 ? '+' : ''}${Math.round(d / p * 100)}%)` : '';
  return `<em class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}${pct}</em>`;
}

function mau() {
  const cs = getComputedStyle(document.documentElement);
  const g = n => cs.getPropertyValue(n).trim();
  return {
    pri: g('--pri'), prev: g('--chart-prev'), text: g('--muted'), grid: g('--line'),
    ok: g('--ok'), warn: g('--warn'), err: g('--err'),
    bang: [g('--pri'), '#e08a2c', '#7a5bc4', '#2f9e8f', '#c4577a', '#5b8bd9', '#9a9a3a', g('--chart-prev')]
  };
}

function veChart(id, cfg) {
  if (typeof Chart === 'undefined' || !$('#' + id)) return;
  const c = mau();
  Chart.defaults.color = c.text;
  Chart.defaults.borderColor = c.grid;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  S.charts.push(new Chart($('#' + id), cfg));
}

const thoiGianTB = gio => gio < 1 ? `${Math.round(gio * 60)} phút` : gio < 48 ? `${so(gio)} giờ` : `${so(gio / 24)} ngày`;

VIEWS.thongke = async function (el) {
  const F = S.locTK || (S.locTK = { preset: 'tuan', tu: '', den: '', dt: '', lop: '' });
  if (F.dt && !S.dtMap.has(+F.dt)) F.dt = '';
  el.innerHTML = `
  <section class="card">
    <div class="filters">
      <label>Khoảng thời gian<select id="tk-preset" class="input">
        <option value="tuan">Tuần này (so với tuần trước)</option>
        <option value="tuan_truoc">Tuần trước</option>
        <option value="thang">Tháng này</option>
        <option value="thang_truoc">Tháng trước</option>
        <option value="30">30 ngày qua</option>
        <option value="hk1">Học kỳ I</option><option value="hk2">Học kỳ II</option>
        <option value="nam">Cả năm học</option><option value="tuy">Tùy chọn…</option></select></label>
      <label>Từ ngày<input type="date" id="tk-tu" class="input"></label>
      <label>Đến ngày<input type="date" id="tk-den" class="input"></label>
      ${coDT() ? `<label>Điểm trường<select id="tk-dt" class="input"><option value="">Toàn trường</option>${optDT(F.dt)}</select></label>` : ''}
      <label>Lớp<select id="tk-lop" class="input"></select></label>
    </div>
    <p class="muted small" id="tk-mota"></p>
  </section>
  <div class="kpis" id="tk-kpi"></div>
  <div id="tk-chu-y"></div>
  <div class="grid2">
    <section class="card"><h3>Diễn biến số vi phạm</h3><div class="chart-box"><canvas id="c-dien-bien"></canvas></div></section>
    <section class="card"><h3>Theo hình thức vi phạm</h3><div class="chart-box"><canvas id="c-loai"></canvas></div></section>
  </div>
  <div class="grid3">
    <section class="card"><h3>Theo nhóm vi phạm</h3><div class="chart-box sm"><canvas id="c-nhom"></canvas></div></section>
    <section class="card"><h3>Theo mức độ</h3><div class="chart-box sm"><canvas id="c-muc-do"></canvas></div></section>
    <section class="card"><h3>Tình trạng xử lý</h3><div class="chart-box sm"><canvas id="c-xu-ly"></canvas></div></section>
  </div>
  <section class="card"><h3>Vi phạm theo thứ trong tuần và buổi</h3><p class="muted small">Giúp nhận ra thời điểm cần tăng cường giám sát.</p><div class="chart-box sm"><canvas id="c-thu"></canvas></div></section>
  <section class="card hidden" id="card-dt"><div class="head-row"><h3>Theo điểm trường</h3></div>
    <div class="chart-box sm"><canvas id="c-dt"></canvas></div><div class="table-wrap" id="tk-bang-dt"></div></section>
  <section class="card"><div class="head-row"><h3>Theo lớp</h3><button type="button" class="btn sm" id="csv-lop">Xuất CSV</button></div>
    <div class="chart-box" id="box-c-lop"><canvas id="c-lop"></canvas></div>
    <p class="muted small">Bấm tên lớp để xem chi tiết. “VP / HS” = số vi phạm của học sinh chia cho sĩ số.</p>
    <div class="table-wrap" id="tk-bang-lop"></div></section>
  <section class="card"><div class="head-row"><h3>Học sinh vi phạm nhiều nhất</h3><button type="button" class="btn sm" id="csv-hs">Xuất CSV</button></div>
    <div class="table-wrap" id="tk-hs"></div></section>
  <section class="card"><h3>Theo người ghi nhận</h3><div class="table-wrap" id="tk-nguoi-ghi"></div></section>`;

  $('#tk-preset').value = F.preset;
  if (F.preset === 'tuy') { $('#tk-tu').value = F.tu; $('#tk-den').value = F.den; }

  const veOptLop = () => {
    const ds = F.dt ? S.lop.filter(l => String(l.diem_truong_id) === String(F.dt)) : S.lop;
    if (F.lop && !ds.some(l => String(l.id) === String(F.lop))) F.lop = '';
    $('#tk-lop').innerHTML = `<option value="">Tất cả lớp</option>${optLop(F.lop, ds)}`;
  };

  let bangLop = [], bangHS = [], dataCur = [], K = {};

  let lanTai = 0;
  async function tai() {
    const lan = ++lanTai, conSong = giuPhien();
    const moiNhat = () => lan === lanTai && conSong();
    F.preset = $('#tk-preset').value;
    if (F.preset !== 'tuy') { K = khoangTK(F.preset); F.tu = K.tu; F.den = K.den; $('#tk-tu').value = K.tu; $('#tk-den').value = K.den; }
    else { F.tu = $('#tk-tu').value; F.den = $('#tk-den').value; K = khoangTK('tuy', F.tu, F.den); }
    F.lop = $('#tk-lop').value;
    const { tu, den, pTu, pDen, a: nhanA, b: nhanB } = K;
    huyChart();
    if (!tu || !den || tu > den) {
      $('#tk-mota').textContent = tu && tu > homNay() ? 'Khoảng thời gian này chưa bắt đầu.' : 'Khoảng thời gian không hợp lệ.';
      $('#tk-kpi').innerHTML = '';
      return;
    }
    const n = diffNgay(tu, den) + 1;
    const pham = F.lop ? `lớp ${tenLop(+F.lop)}` : F.dt ? `điểm trường ${tenDT(+F.dt)}` : 'toàn trường';
    $('#tk-mota').innerHTML = `<b>${nhanA}</b>: ${vn(tu)} – ${vn(den)} (${n} ngày) · so với <b>${nhanB}</b>: ${vn(pTu)} – ${vn(pDen)} · Phạm vi: ${esc(pham)}`;
    $('#tk-kpi').innerHTML = '<p class="muted">Đang tải…</p>';

    const cot = 'id,thoi_gian,tao_luc,hoc_sinh_id,ho_ten,lop_id,ten_lop,diem_truong_id,loai_id,ten_vi_pham,nhom,muc_do,diem_tru,pham_vi,trang_thai,nguoi_ghi,ten_nguoi_ghi,thoi_gian_xu_ly';
    const lay = (a, b) => layHet(() => {
      let q = sb.from('v_vi_pham').select(cot).gte('thoi_gian', tuNgay(a)).lt('thoi_gian', denNgay(b)).order('id');
      if (F.lop) q = q.eq('lop_id', +F.lop);
      else if (F.dt) q = q.eq('diem_truong_id', +F.dt);
      return q;
    });
    let cur, prev;
    try { [cur, prev] = await Promise.all([lay(tu, den), lay(pTu, pDen)]); }
    catch (e) { if (moiNhat()) $('#tk-kpi').innerHTML = `<p class="err">${esc(dichLoi(e))}</p>`; return; }
    if (!moiNhat()) return;   // đã chuyển trang hoặc đã đổi bộ lọc trong lúc tải
    huyChart();
    cur.forEach(r => (r.ngay = ngayVN(r.thoi_gian)));
    prev.forEach(r => (r.ngay = ngayVN(r.thoi_gian)));
    dataCur = cur;

    const cuaHS = a => a.filter(r => r.hoc_sinh_id);
    const soHS = a => new Set(cuaHS(a).map(r => r.hoc_sinh_id)).size;
    const taiPham = a => { const m = {}; cuaHS(a).forEach(r => (m[r.hoc_sinh_id] = (m[r.hoc_sinh_id] || 0) + 1)); return Object.values(m).filter(x => x >= 2).length; };
    const diem = a => a.reduce((s, r) => s + (+r.diem_tru || 0), 0);
    const nang = a => a.filter(r => +r.muc_do === 3).length;
    const tapThe = a => a.filter(r => !r.hoc_sinh_id).length;
    const daXL = cur.filter(r => r.trang_thai === 'da_xu_ly');
    const gioXL = daXL.filter(r => r.thoi_gian_xu_ly).map(r => (new Date(r.thoi_gian_xu_ly) - new Date(r.tao_luc)) / 36e5).filter(x => x >= 0);
    const tbXL = gioXL.length ? gioXL.reduce((s, x) => s + x, 0) / gioXL.length : null;

    // KPI
    const kpi = (ten, c, p, phu = '') => `<div class="kpi"><span>${ten}</span><b>${so(c)}</b>${xuHuong(c, p)}<small>${nhanB}: ${so(p)}${phu}</small></div>`;
    $('#tk-kpi').innerHTML =
      kpi('Tổng số vi phạm', cur.length, prev.length) +
      kpi('Học sinh vi phạm', soHS(cur), soHS(prev), ` · ${taiPham(cur)} em tái phạm`) +
      kpi('Vi phạm tập thể lớp', tapThe(cur), tapThe(prev)) +
      kpi('Vi phạm mức Nặng', nang(cur), nang(prev)) +
      kpi('Tổng điểm trừ', diem(cur), diem(prev)) +
      `<div class="kpi"><span>Đã xử lý</span><b>${cur.length ? Math.round(daXL.length / cur.length * 100) : 0}%</b>
        <em class="${cur.length - daXL.length ? 'up' : 'flat'}">${cur.length - daXL.length} vi phạm chưa xong</em>
        <small>${daXL.length}/${cur.length}${tbXL != null ? ` · xử lý TB sau ${thoiGianTB(tbXL)}` : ''}</small></div>`;

    const c = mau();
    const kyNay = { label: nhanA, backgroundColor: c.pri, borderRadius: 4 };
    const kyTruoc = { label: nhanB, backgroundColor: c.prev, borderRadius: 4 };
    const legend = { legend: { position: 'bottom' } };

    // --- Cần chú ý
    const nangChua = cur.filter(r => +r.muc_do === 3 && r.trang_thai !== 'da_xu_ly').sort((x, y) => new Date(y.thoi_gian) - new Date(x.thoi_gian));
    const mHS = new Map();
    for (const r of cuaHS(cur)) {
      let o = mHS.get(r.hoc_sinh_id);
      if (!o) mHS.set(r.hoc_sinh_id, o = { id: r.hoc_sinh_id, ten: r.ho_ten, lop: r.ten_lop, c: 0, p: 0, diem: 0, chua: 0, nang: 0, loai: {} });
      o.c++; o.diem += +r.diem_tru || 0; if (r.trang_thai !== 'da_xu_ly') o.chua++; if (+r.muc_do === 3) o.nang++;
      o.loai[r.ten_vi_pham] = (o.loai[r.ten_vi_pham] || 0) + 1;
    }
    for (const r of cuaHS(prev)) { const o = mHS.get(r.hoc_sinh_id); if (o) o.p++; }
    const canTheoDoi = [...mHS.values()].filter(o => o.c >= 3 || o.nang || (o.c - o.p >= 2)).sort((x, y) => y.c - x.c || y.diem - x.diem).slice(0, 10);
    $('#tk-chu-y').innerHTML = (nangChua.length || canTheoDoi.length) ? `<section class="card chu-y"><h3>Cần chú ý</h3><div class="grid2 khong-le">
      <div><div class="nhom-ten">Vi phạm mức Nặng chưa xử lý xong (${nangChua.length})</div>
        ${nangChua.length ? `<ul class="recent">${nangChua.slice(0, 8).map(r => `<li><span class="muted">${fmtGio(r.thoi_gian)}</span><span><b>${esc(tenHS(r))}</b> <i class="muted">${esc(r.ten_lop)}</i> — ${esc(r.ten_vi_pham)}</span>${badgeTT(r.trang_thai)}</li>`).join('')}</ul>${nangChua.length > 8 ? '<p class="muted small">… xem đủ ở mục Xử lý.</p>' : ''}` : '<p class="muted small">Không có.</p>'}</div>
      <div><div class="nhom-ten">Học sinh cần theo dõi (≥3 lần, có lỗi nặng hoặc tăng nhanh)</div>
        ${canTheoDoi.length ? `<ul class="recent">${canTheoDoi.map(o => `<li><span class="muted">${esc(o.lop)}</span><span><a href="#" data-lsu="${o.id}">${esc(o.ten)}</a> — ${o.c} lần${o.nang ? `, ${o.nang} nặng` : ''}</span>${xuHuong(o.c, o.p)}</li>`).join('')}</ul>` : '<p class="muted small">Không có.</p>'}</div>
    </div></section>` : '';

    // --- Diễn biến
    const theoTuan = n > 45, buoc = theoTuan ? 7 : 1, soCot = Math.ceil(n / buoc);
    const demCot = (arr, goc) => { const a = new Array(soCot).fill(0); arr.forEach(r => { const i = Math.floor(diffNgay(goc, r.ngay) / buoc); if (i >= 0 && i < soCot) a[i]++; }); return a; };
    veChart('c-dien-bien', {
      type: 'line',
      data: {
        labels: Array.from({ length: soCot }, (_, i) => { const d = congNgay(tu, i * buoc); return (n <= 14 ? THU[thuCua(d)] + ' ' : '') + vn(d).slice(0, 5); }),
        datasets: [
          { label: nhanA, data: demCot(cur, tu), borderColor: c.pri, backgroundColor: c.pri + '22', fill: true, tension: .3, pointRadius: 3 },
          { label: nhanB, data: demCot(prev, pTu), borderColor: c.prev, borderDash: [5, 4], pointRadius: 0, tension: .3 }
        ]
      },
      options: {
        maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { title: { display: theoTuan, text: 'Tuần bắt đầu từ ngày' } } },
        plugins: legend
      }
    });

    // --- Theo hình thức
    const dem = (arr, key) => { const m = new Map(); arr.forEach(r => m.set(r[key], (m.get(r[key]) || 0) + 1)); return m; };
    const lc = dem(cur, 'ten_vi_pham'), lp = dem(prev, 'ten_vi_pham');
    const tenLoai = [...new Set([...lc.keys(), ...lp.keys()])].sort((a, b) => (lc.get(b) || 0) - (lc.get(a) || 0)).slice(0, 12);
    veChart('c-loai', {
      type: 'bar',
      data: { labels: tenLoai, datasets: [{ ...kyNay, data: tenLoai.map(t => lc.get(t) || 0) }, { ...kyTruoc, data: tenLoai.map(t => lp.get(t) || 0) }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: legend }
    });

    // --- Nhóm / mức độ / xử lý
    const banh = (id, labels, data, colors) => veChart(id, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 1 }] },
      options: { maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'right' } } }
    });
    const nc = dem(cur.map(r => ({ ...r, nhom: r.nhom || 'Khác' })), 'nhom');
    const nhomTen = [...nc.keys()].sort((a, b) => nc.get(b) - nc.get(a));
    banh('c-nhom', nhomTen.map(t => `${t} (${nc.get(t)})`), nhomTen.map(t => nc.get(t)), c.bang);
    banh('c-muc-do', [1, 2, 3].map(k => `${MUC_DO[k]} (${cur.filter(r => +r.muc_do === k).length})`), [1, 2, 3].map(k => cur.filter(r => +r.muc_do === k).length), [c.ok, c.warn, c.err]);
    banh('c-xu-ly', Object.keys(TRANG_THAI).map(k => `${TRANG_THAI[k]} (${cur.filter(r => r.trang_thai === k).length})`), Object.keys(TRANG_THAI).map(k => cur.filter(r => r.trang_thai === k).length), [c.err, c.warn, c.ok]);

    // --- Thứ trong tuần × buổi
    const thuTu = [1, 2, 3, 4, 5, 6, 0];
    const buoi = [['Sáng', h => h < 12, c.pri], ['Chiều', h => h >= 12 && h < 18, '#e08a2c'], ['Ngoài giờ', h => h >= 18, c.prev]];
    veChart('c-thu', {
      type: 'bar',
      data: {
        labels: thuTu.map(d => d === 0 ? 'Chủ nhật' : 'Thứ ' + (d + 1)),
        datasets: buoi.map(([ten, f, mauB]) => ({ label: ten, backgroundColor: mauB, borderRadius: 3, data: thuTu.map(d => cur.filter(r => thuCua(r.ngay) === d && f(gioVN(r.thoi_gian))).length) }))
      },
      options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } }, plugins: legend }
    });

    // --- Theo điểm trường
    const hienDT = coDT() && !F.dt && !F.lop;
    $('#card-dt').classList.toggle('hidden', !hienDT);
    if (hienDT) {
      const nhomDT = [...S.dt.map(d => ({ id: d.id, ten: d.ten })), { id: null, ten: 'Chưa xếp điểm trường' }];
      const bangDT = nhomDT.map(d => {
        const lops = S.lop.filter(l => (l.diem_truong_id ?? null) === d.id).map(l => l.id);
        const a = cur.filter(r => (r.diem_truong_id ?? null) === d.id), p = prev.filter(r => (r.diem_truong_id ?? null) === d.id);
        const siSo = S.hs.filter(h => h.dang_hoc && lops.includes(h.lop_id)).length;
        return { ...d, soLop: lops.length, siSo, c: a.length, p: p.length, hs: soHS(a), tt: tapThe(a), diem: diem(a), chua: a.filter(r => r.trang_thai !== 'da_xu_ly').length };
      }).filter(d => d.id !== null || d.soLop);
      veChart('c-dt', {
        type: 'bar',
        data: { labels: bangDT.map(d => d.ten), datasets: [{ ...kyNay, data: bangDT.map(d => d.c) }, { ...kyTruoc, data: bangDT.map(d => d.p) }] },
        options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: legend }
      });
      $('#tk-bang-dt').innerHTML = `<table class="tbl"><thead><tr><th>Điểm trường</th><th class="r">Số lớp</th><th class="r">Sĩ số</th><th class="r">Số VP</th><th class="r">VP / 100 HS</th><th class="r">HS vi phạm</th><th class="r">VP tập thể</th><th class="r">Điểm trừ</th><th class="r">${nhanB}</th><th>Tăng / giảm</th><th class="r">Chưa xử lý</th></tr></thead>
        <tbody>${bangDT.map(d => `<tr><td><b>${esc(d.ten)}</b></td><td class="r">${d.soLop}</td><td class="r">${d.siSo}</td><td class="r"><b>${d.c}</b></td><td class="r">${d.siSo ? so(d.c / d.siSo * 100) : '–'}</td>
          <td class="r">${d.hs}</td><td class="r">${d.tt}</td><td class="r">${so(d.diem)}</td><td class="r">${d.p}</td><td>${xuHuong(d.c, d.p)}</td><td class="r">${d.chua || ''}</td></tr>`).join('')}</tbody></table>`;
    }

    // --- Theo lớp
    const dsLop = F.lop ? S.lop.filter(l => l.id === +F.lop) : F.dt ? S.lop.filter(l => String(l.diem_truong_id) === String(F.dt)) : S.lop;
    const gc = new Map(), gp = new Map();
    cur.forEach(r => { if (!gc.has(r.lop_id)) gc.set(r.lop_id, []); gc.get(r.lop_id).push(r); });
    prev.forEach(r => gp.set(r.lop_id, (gp.get(r.lop_id) || 0) + 1));
    bangLop = dsLop.map(l => {
      const a = gc.get(l.id) || [];
      const siSo = S.hs.filter(h => h.lop_id === l.id && h.dang_hoc).length;
      const vpHS = cuaHS(a).length;
      return { id: l.id, ten: l.ten_lop, dt: tenDT(l.diem_truong_id), gvcn: tenND(l.gvcn_id), siSo, c: a.length, vpHS, tt: a.length - vpHS, p: gp.get(l.id) || 0, hs: soHS(a), diem: diem(a), chua: a.filter(r => r.trang_thai !== 'da_xu_ly').length };
    }).sort((a, b) => b.c - a.c || b.diem - a.diem || a.ten.localeCompare(b.ten, 'vi', { numeric: true }));
    const coDuLieu = bangLop.filter(r => r.c || r.p);
    $('#box-c-lop').classList.toggle('hidden', !!F.lop || !coDuLieu.length);
    if (!F.lop && coDuLieu.length) {
      const sx = [...coDuLieu].sort((a, b) => a.ten.localeCompare(b.ten, 'vi', { numeric: true }));
      veChart('c-lop', {
        type: 'bar',
        data: { labels: sx.map(r => r.ten), datasets: [
          { label: nhanA + ' – học sinh', data: sx.map(r => r.vpHS), backgroundColor: c.pri, borderRadius: 3, stack: 'nay' },
          { label: nhanA + ' – tập thể lớp', data: sx.map(r => r.tt), backgroundColor: '#e08a2c', borderRadius: 3, stack: 'nay' },
          { label: nhanB, data: sx.map(r => r.p), backgroundColor: c.prev, borderRadius: 3, stack: 'truoc' }] },
        options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } }, plugins: legend }
      });
    }
    $('#tk-bang-lop').innerHTML = `<table class="tbl"><thead><tr><th>#</th><th>Lớp</th>${coDT() ? '<th>Điểm trường</th>' : ''}<th>GVCN</th><th class="r">Sĩ số</th><th class="r">Số VP</th><th class="r">VP tập thể</th><th class="r">VP / HS</th><th class="r">HS vi phạm</th><th class="r">Điểm trừ</th><th class="r">${nhanB}</th><th>Tăng / giảm</th><th class="r">Chưa xử lý</th></tr></thead>
      <tbody>${bangLop.map((r, i) => `<tr><td>${i + 1}</td><td><a href="#" data-lop-ct="${r.id}"><b>${esc(r.ten)}</b></a></td>${coDT() ? `<td class="small">${esc(r.dt)}</td>` : ''}<td class="small">${esc(r.gvcn)}</td><td class="r">${r.siSo}</td><td class="r"><b>${r.c}</b></td><td class="r">${r.tt || ''}</td>
        <td class="r">${r.siSo ? (r.vpHS / r.siSo).toFixed(2) : '–'}</td><td class="r">${r.hs}</td><td class="r">${so(r.diem)}</td><td class="r">${r.p}</td>
        <td>${xuHuong(r.c, r.p)}</td><td class="r">${r.chua || ''}</td></tr>`).join('') || `<tr><td colspan="13" class="muted">Chưa có lớp.</td></tr>`}</tbody></table>`;

    // --- Theo học sinh
    bangHS = [...mHS.values()].sort((a, b) => b.c - a.c || b.diem - a.diem).slice(0, 50);
    bangHS.forEach(o => (o.loiChinh = Object.entries(o.loai).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, k]) => `${t} (${k})`).join(', ')));
    $('#tk-hs').innerHTML = bangHS.length ? `<table class="tbl"><thead><tr><th>#</th><th>Học sinh</th><th>Lớp</th><th class="r">Số VP</th><th class="r">Điểm trừ</th><th class="r">${nhanB}</th><th>Xu hướng</th><th>Lỗi thường gặp</th><th class="r">Chưa xử lý</th></tr></thead>
      <tbody>${bangHS.map((o, i) => `<tr><td>${i + 1}</td><td><a href="#" data-lsu="${o.id}">${esc(o.ten)}</a></td><td>${esc(o.lop)}</td><td class="r"><b>${o.c}</b></td><td class="r">${so(o.diem)}</td><td class="r">${o.p}</td>
        <td>${xuHuong(o.c, o.p)}</td><td class="small">${esc(o.loiChinh)}</td><td class="r">${o.chua || ''}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted pad">Không có học sinh vi phạm trong khoảng thời gian này. 🎉</p>';

    // --- Theo người ghi nhận
    const ng = new Map();
    cur.forEach(r => { const k = r.nguoi_ghi || '-'; const o = ng.get(k) || { ten: r.ten_nguoi_ghi || '(không rõ)', c: 0, p: 0, tt: 0 }; o.c++; if (!r.hoc_sinh_id) o.tt++; ng.set(k, o); });
    prev.forEach(r => { const o = ng.get(r.nguoi_ghi || '-'); if (o) o.p++; });
    const bangNG = [...ng.values()].sort((a, b) => b.c - a.c);
    $('#tk-nguoi-ghi').innerHTML = bangNG.length ? `<table class="tbl"><thead><tr><th>Người ghi nhận</th><th class="r">Số lượt ghi</th><th class="r">Trong đó tập thể lớp</th><th class="r">${nhanB}</th></tr></thead>
      <tbody>${bangNG.map(o => `<tr><td>${esc(o.ten)}</td><td class="r"><b>${o.c}</b></td><td class="r">${o.tt || ''}</td><td class="r">${o.p}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted pad">Chưa có.</p>';
  }

  el.onchange = e => {
    const id = e.target.id;
    if (id === 'tk-tu' || id === 'tk-den') $('#tk-preset').value = 'tuy';
    if (id === 'tk-dt') { F.dt = e.target.value; veOptLop(); }
    if (['tk-preset', 'tk-tu', 'tk-den', 'tk-dt', 'tk-lop'].includes(id)) tai();
  };
  el.onclick = e => {
    const t = e.target.closest('[data-lsu],[data-lop-ct],#csv-lop,#csv-hs'); if (!t) return;
    if (t.dataset.lsu) { e.preventDefault(); lichSuHS(+t.dataset.lsu); }
    else if (t.dataset.lopCt) { e.preventDefault(); chiTietLop(+t.dataset.lopCt, dataCur, `${K.a}: ${vn(K.tu)} – ${vn(K.den)}`); }
    else if (t.id === 'csv-lop') xuatCSV(`thong-ke-lop_${F.tu}_${F.den}.csv`,
      ['Lớp', 'Điểm trường', 'GVCN', 'Sĩ số', 'Số VP', 'VP tập thể', 'VP/HS', 'HS vi phạm', 'Điểm trừ', K.b, 'Chênh lệch', 'Chưa xử lý'],
      bangLop.map(r => [r.ten, r.dt, r.gvcn, r.siSo, r.c, r.tt, r.siSo ? +(r.vpHS / r.siSo).toFixed(2) : '', r.hs, r.diem, r.p, r.c - r.p, r.chua]));
    else if (t.id === 'csv-hs') xuatCSV(`thong-ke-hoc-sinh_${F.tu}_${F.den}.csv`,
      ['Học sinh', 'Lớp', 'Số VP', 'Điểm trừ', K.b, 'Chênh lệch', 'Lỗi thường gặp', 'Chưa xử lý'],
      bangHS.map(o => [o.ten, o.lop, o.c, o.diem, o.p, o.c - o.p, o.loiChinh, o.chua]));
  };

  veOptLop();
  await tai();
};

/* =====================================================================
   4. ĐIỂM TRƯỜNG, LỚP & HỌC SINH
   ===================================================================== */
VIEWS.hocsinh = function (el) {
  const ve = () => {
    if (!S.lopMap.has(S.hsLop)) S.hsLop = S.lop[0]?.id || 0;
    el.innerHTML = `
    <div class="grid-hs">
      <div>
        <section class="card">
          <h2>Điểm trường</h2>
          <p class="muted small">Không bắt buộc. Trường chỉ có một điểm thì để trống.</p>
          <form id="f-dt" class="row"><input class="input" name="ten" placeholder="Tên điểm trường, vd: Điểm chính" required><button class="btn">Thêm</button></form>
          <div id="hs-ds-dt" class="list"></div>
        </section>
        <section class="card">
          <h2>Lớp học</h2>
          <form id="f-lop" class="row wrap"><input class="input" name="ten" placeholder="Tên lớp, vd: 6A1" required>
            ${coDT() ? `<select class="input" name="dt"><option value="">— Điểm trường —</option>${optDT('')}</select>` : ''}
            <button class="btn primary">Thêm</button></form>
          <div id="hs-ds-lop" class="list"></div>
        </section>
      </div>
      <section class="card">
        <div class="head-row"><h2 id="hs-tieu-de">Học sinh</h2>
          <div class="row-gap"><button type="button" class="btn" id="btn-nhap-nhieu">Nhập từ Excel</button></div></div>
        <form id="f-hs" class="row"><input class="input" name="ten" placeholder="Họ tên học sinh, Enter để thêm" required autocomplete="off"><button class="btn primary">Thêm</button></form>
        <div id="hs-ds" class="table-wrap"></div>
      </section>
    </div>`;
    veDT(); veLop(); veHS();
  };

  const veDT = () => {
    $('#hs-ds-dt').innerHTML = S.dt.map(d => `<div class="list-item"><span><b>${esc(d.ten)}</b> <span class="muted small">${S.lop.filter(l => l.diem_truong_id === d.id).length} lớp</span></span>
      <span><button type="button" class="link" data-doi-dt="${d.id}">Đổi tên</button><button type="button" class="link danger" data-xoa-dt="${d.id}">Xóa</button></span></div>`).join('')
      || '<p class="muted small">Chưa có điểm trường.</p>';
  };
  const veLop = () => {
    const dem = {}; S.hs.forEach(h => { if (h.dang_hoc) dem[h.lop_id] = (dem[h.lop_id] || 0) + 1; });
    const item = l => `<div class="list-item ${l.id === S.hsLop ? 'on' : ''}" data-chon-lop="${l.id}">
      <span><b>${esc(l.ten_lop)}</b> <span class="muted small">${dem[l.id] || 0} HS${l.gvcn_id ? ' · ' + esc(tenND(l.gvcn_id)) : ''}</span></span>
      <span><button type="button" class="link" data-sua-lop="${l.id}">Sửa</button><button type="button" class="link danger" data-xoa-lop="${l.id}">Xóa</button></span></div>`;
    $('#hs-ds-lop').innerHTML = !S.lop.length
      ? '<p class="muted">Chưa có lớp nào. Thêm lớp ở trên hoặc dùng “Nhập từ Excel”.</p>'
      : coDT()
        ? nhomTheoDT(S.lop).map(([d, a]) => `<div class="nhom-ten">${esc(d ? tenDT(d) : 'Chưa xếp điểm trường')}</div>${a.map(item).join('')}`).join('')
        : S.lop.map(item).join('');
  };
  const veHS = () => {
    const ds = S.hs.filter(h => h.lop_id === S.hsLop);
    $('#hs-tieu-de').textContent = S.hsLop ? `Học sinh lớp ${tenLop(S.hsLop)} (${ds.filter(h => h.dang_hoc).length})` : 'Học sinh';
    $('#f-hs').classList.toggle('hidden', !S.hsLop);
    $('#hs-ds').innerHTML = ds.length ? `<table class="tbl"><thead><tr><th>STT</th><th>Họ và tên</th><th>Lớp</th><th>Tình trạng</th><th></th></tr></thead><tbody>
      ${ds.map(h => `<tr class="${h.dang_hoc ? '' : 'nghi'}"><td>${S.stt.get(h.id) || ''}</td>
        <td><a href="#" data-lsu="${h.id}">${esc(h.ho_ten)}</a></td>
        <td><select class="input sm" data-chuyen="${h.id}">${optLop(h.lop_id)}</select></td>
        <td><label class="switch"><input type="checkbox" data-dang-hoc="${h.id}" ${h.dang_hoc ? 'checked' : ''}> ${h.dang_hoc ? 'Đang học' : 'Đã nghỉ'}</label></td>
        <td class="nowrap"><button type="button" class="link" data-sua-hs="${h.id}">Sửa tên</button><button type="button" class="link danger" data-xoa-hs="${h.id}">Xóa</button></td></tr>`).join('')}</tbody></table>
      <p class="muted small">Chuyển lớp không ảnh hưởng vi phạm cũ: vi phạm được tính cho lớp tại thời điểm ghi nhận.</p>`
      : `<p class="muted pad">${S.hsLop ? 'Lớp chưa có học sinh.' : ''}</p>`;
  };
  const conSong = giuPhien();
  const lamMoi = async () => { await taiDanhMuc(); if (conSong()) ve(); };
  const thucHien = async (p, okMsg, loiFK) => {
    const { error } = await p;
    if (error) { toast(loiFK && /foreign key/i.test(error.message) ? loiFK : dichLoi(error), 'err'); return false; }
    if (okMsg) toast(okMsg);
    await lamMoi(); return true;
  };

  el.onsubmit = async e => {
    e.preventDefault();
    const f = e.target, ten = f.ten.value.trim(); if (!ten) return;
    if (f.id === 'f-dt') {
      const max = Math.max(0, ...S.dt.map(d => d.thu_tu || 0));
      await thucHien(sb.from('diem_truong').insert({ ten, thu_tu: max + 1 }), `Đã thêm điểm trường ${ten}.`);
    } else if (f.id === 'f-lop') {
      const t = chuanHoaLop(ten);
      const { data, error } = await sb.from('lop').insert({ ten_lop: t, khoi: khoiTu(t), diem_truong_id: f.dt?.value ? +f.dt.value : null }).select().single();
      if (error) { toast(dichLoi(error), 'err'); return; }
      S.hsLop = data.id; toast(`Đã thêm lớp ${t}.`); await lamMoi();
    } else if (f.id === 'f-hs') {
      if (await thucHien(sb.from('hoc_sinh').insert({ ho_ten: chuanHoaTen(ten), lop_id: S.hsLop }), 'Đã thêm học sinh.')) $('#f-hs [name=ten]')?.focus();
    }
  };
  el.onclick = async e => {
    const t = e.target.closest('[data-chon-lop],[data-sua-lop],[data-xoa-lop],[data-doi-dt],[data-xoa-dt],[data-sua-hs],[data-xoa-hs],[data-lsu],#btn-nhap-nhieu');
    if (!t) return;
    const d = t.dataset;
    if (d.suaLop) {
      moSuaLop(+d.suaLop, lamMoi);
    } else if (d.xoaLop) {
      const l = S.lopMap.get(+d.xoaLop), n = S.hs.filter(h => h.lop_id === l.id).length;
      if (n) { toast(`Lớp ${l.ten_lop} còn ${n} học sinh. Hãy chuyển học sinh sang lớp khác trước khi xóa.`, 'err'); return; }
      if (confirm(`Xóa lớp ${l.ten_lop}?`)) await thucHien(sb.from('lop').delete().eq('id', l.id), 'Đã xóa lớp.', `Lớp ${l.ten_lop} đã có vi phạm được ghi nhận nên không thể xóa (để giữ lịch sử).`);
    } else if (d.doiDt) {
      const dt = S.dtMap.get(+d.doiDt), moi = prompt('Tên điểm trường mới:', dt.ten);
      if (moi && moi.trim() && moi.trim() !== dt.ten) await thucHien(sb.from('diem_truong').update({ ten: moi.trim() }).eq('id', dt.id), 'Đã đổi tên.');
    } else if (d.xoaDt) {
      const dt = S.dtMap.get(+d.xoaDt), n = S.lop.filter(l => l.diem_truong_id === dt.id).length;
      if (confirm(`Xóa điểm trường ${dt.ten}?${n ? `\n\n${n} lớp của điểm trường này sẽ chuyển thành “chưa xếp điểm trường” (không mất dữ liệu).` : ''}`))
        await thucHien(sb.from('diem_truong').delete().eq('id', dt.id), 'Đã xóa điểm trường.', 'Điểm trường đang được giao cho Tổng phụ trách. Vào mục Tài khoản đổi phân công trước khi xóa.');
    } else if (d.chonLop) {
      S.hsLop = +d.chonLop; veLop(); veHS();
    } else if (d.suaHs) {
      const h = S.hsMap.get(+d.suaHs), moi = prompt('Họ tên mới:', h.ho_ten);
      if (moi && moi.trim()) await thucHien(sb.from('hoc_sinh').update({ ho_ten: chuanHoaTen(moi) }).eq('id', h.id), 'Đã sửa.');
    } else if (d.xoaHs) {
      const h = S.hsMap.get(+d.xoaHs);
      if (confirm(`Xóa học sinh ${h.ho_ten}?`))
        await thucHien(sb.from('hoc_sinh').delete().eq('id', h.id), 'Đã xóa.', `${h.ho_ten} đã có vi phạm nên không thể xóa (để giữ lịch sử). Nếu học sinh nghỉ học hoặc chuyển trường, hãy bỏ chọn “Đang học”.`);
    } else if (d.lsu) {
      e.preventDefault(); lichSuHS(+d.lsu);
    } else if (t.id === 'btn-nhap-nhieu') moNhapExcel(lamMoi);
  };
  el.onchange = async e => {
    const d = e.target.dataset;
    if (d.chuyen) await thucHien(sb.from('hoc_sinh').update({ lop_id: +e.target.value }).eq('id', +d.chuyen), `Đã chuyển sang lớp ${tenLop(+e.target.value)}.`);
    else if (d.dangHoc) await thucHien(sb.from('hoc_sinh').update({ dang_hoc: e.target.checked }).eq('id', +d.dangHoc));
  };
  ve();
};

function moSuaLop(id, xong) {
  const l = S.lopMap.get(id);
  const dsGV = S.nd.filter(u => u.vai_tro === 'gvcn' || u.id === l.gvcn_id).sort((a, b) => String(a.ho_ten).localeCompare(String(b.ho_ten), 'vi'));
  moModal(`<h2>Sửa lớp ${esc(l.ten_lop)}</h2>
    <label class="lbl">Tên lớp<input class="input" id="sl-ten" value="${esc(l.ten_lop)}"></label>
    ${coDT() ? `<label class="lbl">Điểm trường<select class="input" id="sl-dt"><option value="">— Chưa xếp —</option>${optDT(l.diem_truong_id)}</select></label>` : ''}
    <label class="lbl">Giáo viên chủ nhiệm<select class="input" id="sl-gvcn"><option value="">— Chưa phân công —</option>
      ${dsGV.map(u => `<option value="${u.id}" ${u.id === l.gvcn_id ? 'selected' : ''}>${esc(u.ho_ten || u.email)}${u.vai_tro !== 'gvcn' ? ` (${VAI_TRO[u.vai_tro]})` : ''}</option>`).join('')}</select></label>
    <p class="muted small">Danh sách chỉ gồm tài khoản có vai trò <b>GV chủ nhiệm</b>. Quản trị viên cấp vai trò này ở mục Tài khoản.</p>
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Hủy</button><button type="button" class="btn primary" id="sl-luu">Lưu</button></div>`);
  $('#sl-luu').onclick = async () => {
    const ten = chuanHoaLop($('#sl-ten').value);
    if (!ten) { toast('Nhập tên lớp.', 'err'); return; }
    const row = { ten_lop: ten, khoi: khoiTu(ten), gvcn_id: $('#sl-gvcn').value || null };
    if ($('#sl-dt')) row.diem_truong_id = $('#sl-dt').value ? +$('#sl-dt').value : null;
    const { error } = await sb.from('lop').update(row).eq('id', id);
    if (error) { toast(dichLoi(error), 'err'); return; }
    toast('Đã lưu.'); dongModal(); await xong();
  };
}

function phanTichDanhSach(text, lopMacDinh) {
  const out = [], loi = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    let cols = line.split(/\t|;/).map(s => s.trim()).filter(Boolean);
    if (!cols.length) return;
    if (/^(stt|ho\s*(va\s*)?ten|ho ten)$/i.test(boDau(cols[0])) || /ho\s*(va\s*)?ten/.test(boDau(cols[1] || ''))) return; // dòng tiêu đề
    if (/^\d+$/.test(cols[0]) && cols.length >= 2) cols = cols.slice(1);   // bỏ cột STT
    const ten = cols[0], lop = cols[1] || lopMacDinh;
    if (!ten || !lop || /^\d+$/.test(ten) || !/^\d+[A-Z0-9]*$/i.test(chuanHoaLop(lop))) { loi.push(i + 1); return; }
    out.push({ ten: chuanHoaTen(ten), lop: chuanHoaLop(lop) });
  });
  return { out, loi };
}

function moNhapExcel(xong) {
  const lopMD = tenLop(S.hsLop);
  moModal(`<h2>Nhập học sinh từ Excel</h2>
    <p class="small">Trong Excel, bôi đen 2 cột <b>Họ tên</b> và <b>Lớp</b> → Copy → dán vào ô dưới (mỗi dòng một học sinh).
    ${lopMD ? `Nếu chỉ dán cột Họ tên, học sinh được thêm vào lớp đang chọn: <b>${esc(lopMD)}</b>.` : ''} Lớp chưa có sẽ được tạo tự động; học sinh trùng tên trong cùng lớp được bỏ qua.</p>
    <textarea id="nn-text" class="input mono" rows="12" placeholder="Nguyễn Văn An&#9;6A1&#10;Trần Thị Bình&#9;6A1&#10;Lê Hoàng Châu&#9;6A2"></textarea>
    <p id="nn-xem" class="small muted">Chưa có dữ liệu.</p>
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Hủy</button><button type="button" class="btn primary" id="nn-ok" disabled>Nhập</button></div>`);
  let kq = { out: [], loi: [] };
  const daCo = new Set(S.hs.map(h => tenLop(h.lop_id).toUpperCase() + '|' + boDau(h.ho_ten)));
  const lopCo = new Set(S.lop.map(l => l.ten_lop.toUpperCase()));
  let trung = 0;
  $('#nn-text').oninput = e => {
    kq = phanTichDanhSach(e.target.value, lopMD);
    const moi = [...new Set(kq.out.map(o => o.lop))].filter(t => !lopCo.has(t));
    trung = kq.out.filter(o => daCo.has(o.lop + '|' + boDau(o.ten))).length;
    $('#nn-xem').innerHTML = kq.out.length ? `Sẽ nhập <b>${kq.out.length - trung}</b> học sinh${trung ? ` (bỏ qua ${trung} trùng)` : ''}${moi.length ? ` · tạo ${moi.length} lớp mới: <b>${esc(moi.join(', '))}</b>` : ''}${kq.loi.length ? ` · <span class="err">dòng lỗi (tên lớp không hợp lệ hoặc thiếu): ${kq.loi.slice(0, 10).join(', ')}</span>` : ''}` : 'Chưa có dữ liệu hợp lệ.';
    $('#nn-ok').disabled = !(kq.out.length - trung);
  };
  $('#nn-ok').onclick = async () => {
    const btn = $('#nn-ok'); btn.disabled = true; btn.textContent = 'Đang nhập…';
    try {
      const map = new Map(S.lop.map(l => [l.ten_lop.toUpperCase(), l.id]));
      const moi = [...new Set(kq.out.map(o => o.lop))].filter(t => !map.has(t));
      if (moi.length) {
        const { data, error } = await sb.from('lop').insert(moi.map(t => ({ ten_lop: t, khoi: khoiTu(t) }))).select();
        if (error) throw error;
        data.forEach(l => map.set(l.ten_lop.toUpperCase(), l.id));
      }
      const seen = new Set();
      const rows = kq.out.filter(o => { const k = o.lop + '|' + boDau(o.ten); if (daCo.has(k) || seen.has(k)) return false; seen.add(k); return true; })
        .map(o => ({ ho_ten: o.ten, lop_id: map.get(o.lop) }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await sb.from('hoc_sinh').insert(rows.slice(i, i + 500));
        if (error) throw error;
      }
      toast(`Đã nhập ${rows.length} học sinh.`);
      dongModal(); await xong();
    } catch (e) { toast(dichLoi(e), 'err'); btn.disabled = false; btn.textContent = 'Nhập'; }
  };
}

/* =====================================================================
   5. HÌNH THỨC VI PHẠM
   ===================================================================== */
VIEWS.loai = function (el) {
  const conSong = giuPhien();
  el.innerHTML = `<section class="card">
    <h2>Hình thức vi phạm</h2>
    <p class="muted small"><b>Áp dụng cho</b>: “Học sinh” – ghi cho từng em; “Cả lớp” – vi phạm tập thể, ghi cho lớp.
    <b>Mức độ</b>: xanh – Nhẹ, cam – Trung bình, đỏ – <b>Nặng (chỉ Ban giám hiệu xử lý)</b>. Điểm trừ dùng cho thống kê.
    Hình thức đã phát sinh vi phạm nên <b>tắt “Đang dùng”</b> thay vì xóa.</p>
    <div class="table-wrap"><table class="tbl edit"><thead><tr><th>Thứ tự</th><th>Tên hình thức vi phạm</th><th>Áp dụng cho</th><th>Nhóm</th><th>Mức độ</th><th>Điểm trừ</th><th>Đang dùng</th><th></th></tr></thead>
    <tbody id="loai-body"></tbody></table></div>
    <datalist id="dl-nhom"></datalist></section>`;
  const dong = l => `<tr data-id="${l.id || ''}" class="${l.id ? '' : 'new-row'}">
    <td><input class="input sm num" name="thu_tu" type="number" value="${l.thu_tu ?? ''}"></td>
    <td><input class="input sm" name="ten" value="${esc(l.ten || '')}" placeholder="${l.id ? '' : '+ Thêm hình thức mới…'}"></td>
    <td><select class="input sm" name="pham_vi">${Object.entries(PHAM_VI).map(([k, t]) => `<option value="${k}" ${(l.pham_vi || 'hoc_sinh') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
    <td><input class="input sm" name="nhom" list="dl-nhom" value="${esc(l.nhom || '')}"></td>
    <td><select class="input sm md-sel" name="muc_do">${[1, 2, 3].map(k => `<option value="${k}" ${(l.muc_do || 1) === k ? 'selected' : ''}>${MUC_DO[k]}</option>`).join('')}</select></td>
    <td><input class="input sm num" name="diem_tru" type="number" step="0.5" min="0" value="${l.diem_tru ?? 0}"></td>
    <td class="c"><input type="checkbox" name="dang_dung" ${l.dang_dung !== false ? 'checked' : ''}></td>
    <td class="nowrap"><button type="button" class="btn sm ${l.id ? '' : 'primary'}" data-luu>${l.id ? 'Lưu' : 'Thêm'}</button>${l.id ? '<button type="button" class="link danger" data-xoa>Xóa</button>' : ''}</td></tr>`;
  const ve = () => {
    const maxTT = Math.max(0, ...S.loai.map(l => l.thu_tu || 0));
    const ds = [...S.loai].sort((a, b) => (a.pham_vi === 'lop') - (b.pham_vi === 'lop') || (a.thu_tu || 0) - (b.thu_tu || 0));
    $('#loai-body').innerHTML = ds.map(dong).join('') + dong({ thu_tu: maxTT + 1 });
    $('#dl-nhom').innerHTML = [...new Set(S.loai.map(l => l.nhom).filter(Boolean))].map(n => `<option value="${esc(n)}">`).join('');
  };
  el.onclick = async e => {
    const b = e.target.closest('[data-luu],[data-xoa]'); if (!b) return;
    const tr = b.closest('tr'), id = +tr.dataset.id || null;
    const v = n => tr.querySelector(`[name=${n}]`);
    let res;
    if (b.dataset.xoa !== undefined) {
      if (!confirm('Xóa hình thức vi phạm này?')) return;
      res = await sb.from('loai_vi_pham').delete().eq('id', id);
    } else {
      const row = { ten: v('ten').value.trim(), pham_vi: v('pham_vi').value, nhom: v('nhom').value.trim() || null, muc_do: +v('muc_do').value, diem_tru: +v('diem_tru').value || 0, dang_dung: v('dang_dung').checked, thu_tu: +v('thu_tu').value || 0 };
      if (!row.ten) { toast('Nhập tên hình thức vi phạm.', 'err'); v('ten').focus(); return; }
      res = id ? await sb.from('loai_vi_pham').update(row).eq('id', id) : await sb.from('loai_vi_pham').insert(row);
    }
    if (res.error) { toast(/foreign key/i.test(res.error.message) ? 'Hình thức này đã có vi phạm, không thể xóa. Hãy bỏ chọn “Đang dùng”.' : dichLoi(res.error), 'err'); return; }
    toast('Đã lưu.'); await taiDanhMuc(); if (conSong()) ve();
  };
  el.onkeydown = e => { if (e.key === 'Enter' && e.target.matches('#loai-body input')) { e.preventDefault(); e.target.closest('tr').querySelector('[data-luu]').click(); } };
  ve();
};

/* =====================================================================
   6. TÀI KHOẢN (Quản trị)
   ===================================================================== */
VIEWS.nguoidung = async function (el) {
  el.innerHTML = `<section class="card"><h2>Tài khoản người dùng</h2>
    <p class="muted small">Giáo viên tự đăng ký trên trang đăng nhập; tài khoản ở trạng thái <b>Chờ duyệt</b> cho tới khi được cấp quyền.</p>
    <ul class="small quyen">
      <li><b>Giáo viên</b>: ghi nhận vi phạm, xem danh sách và thống kê.</li>
      <li><b>GV chủ nhiệm</b>: thêm quyền xử lý vi phạm mức Nhẹ, Trung bình của lớp được giao.</li>
      <li><b>Tổng phụ trách</b>: thêm quyền xử lý vi phạm mức Nhẹ, Trung bình của điểm trường được giao (không giao = toàn trường).</li>
      <li><b>Ban giám hiệu</b>: xử lý mọi vi phạm (kể cả mức Nặng), quản lý điểm trường, lớp, học sinh, hình thức vi phạm.</li>
      <li><b>Quản trị</b>: toàn quyền, thêm cấp quyền tài khoản.</li>
    </ul>
    <div class="table-wrap" id="nd-bang"><p class="muted pad">Đang tải…</p></div></section>`;

  const oPhuTrach = (u, vt) => {
    if (vt === 'gvcn') {
      const ds = S.lop.filter(l => l.gvcn_id === u.id).map(l => l.ten_lop);
      return `<span class="small">${ds.length ? esc(ds.join(', ')) : '<span class="muted">Chưa gán lớp</span>'}</span> <button type="button" class="link" data-gan-lop="${u.id}">Gán lớp</button>`;
    }
    if (vt === 'tpt') return coDT()
      ? `<select class="input sm" name="diem_truong_id"><option value="">Toàn trường</option>${optDT(u.diem_truong_id)}</select>`
      : '<span class="small muted">Toàn trường</span>';
    return '';
  };

  const conSong = giuPhien();
  const tai = async () => {
    await taiDanhMuc();
    if (!conSong()) return;
    const data = [...S.nd];
    const thuTu = { cho_duyet: 0, admin: 1, bgh: 2, tpt: 3, gvcn: 4, gv: 5 };
    data.sort((a, b) => thuTu[a.vai_tro] - thuTu[b.vai_tro] || String(a.ho_ten).localeCompare(String(b.ho_ten), 'vi'));
    $('#nd-bang').innerHTML = `<table class="tbl"><thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Phụ trách</th><th></th></tr></thead><tbody>
      ${data.map(u => `<tr data-id="${u.id}" class="${u.vai_tro === 'cho_duyet' ? 'cho' : ''}"><td><input class="input sm" name="ho_ten" value="${esc(u.ho_ten || '')}"></td><td class="small">${esc(u.email || '')}</td>
        <td><select class="input sm" name="vai_tro">${Object.entries(VAI_TRO).map(([k, t]) => `<option value="${k}" ${u.vai_tro === k ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td class="phu-trach">${oPhuTrach(u, u.vai_tro)}</td>
        <td><button type="button" class="btn sm" data-luu>Lưu</button></td></tr>`).join('')}</tbody></table>`;
  };

  el.onchange = e => {
    if (e.target.name === 'vai_tro') {
      const tr = e.target.closest('tr'), u = S.ndMap.get(tr.dataset.id);
      tr.querySelector('.phu-trach').innerHTML = oPhuTrach(u, e.target.value);
    }
  };
  el.onclick = async e => {
    const g = e.target.closest('[data-gan-lop]');
    if (g) { moGanLop(g.dataset.ganLop, tai); return; }
    const b = e.target.closest('[data-luu]'); if (!b) return;
    const tr = b.closest('tr'), id = tr.dataset.id;
    const vt = tr.querySelector('[name=vai_tro]').value;
    if (id === S.user.id && vt !== 'admin' && !confirm('Bạn đang tự bỏ quyền Quản trị của mình. Tiếp tục?')) return;
    const dtSel = tr.querySelector('[name=diem_truong_id]');
    const row = { ho_ten: tr.querySelector('[name=ho_ten]').value.trim() || null, vai_tro: vt, diem_truong_id: vt === 'tpt' && dtSel?.value ? +dtSel.value : null };
    const { data, error } = await sb.from('nguoi_dung').update(row).eq('id', id).select('id');
    if (error || !data.length) { toast(error ? dichLoi(error) : 'Không đủ quyền.', 'err'); return; }
    toast('Đã cập nhật.');
    if (vt === 'gvcn' && !S.lop.some(l => l.gvcn_id === id)) { await tai(); if (conSong()) moGanLop(id, tai); }
    else await tai();
  };
  await tai();
};

function moGanLop(uid, xong) {
  const u = S.ndMap.get(uid);
  const item = l => {
    const khac = l.gvcn_id && l.gvcn_id !== uid ? tenND(l.gvcn_id) : '';
    return `<label class="radio o-lop"><input type="checkbox" value="${l.id}" ${l.gvcn_id === uid ? 'checked' : ''}> ${esc(l.ten_lop)}${khac ? ` <span class="muted small">(đang: ${esc(khac)})</span>` : ''}</label>`;
  };
  moModal(`<h2>Gán lớp chủ nhiệm</h2><p class="muted">${esc(u?.ho_ten || u?.email || '')}</p>
    ${S.lop.length ? (coDT()
      ? nhomTheoDT(S.lop).map(([d, a]) => `<div class="nhom-ten">${esc(d ? tenDT(d) : 'Chưa xếp điểm trường')}</div><div class="luoi-lop">${a.map(item).join('')}</div>`).join('')
      : `<div class="luoi-lop">${S.lop.map(item).join('')}</div>`) : '<p class="muted">Chưa có lớp.</p>'}
    <p class="muted small">Mỗi lớp có một GV chủ nhiệm; chọn lớp đang có người khác sẽ chuyển sang người này.</p>
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Hủy</button><button type="button" class="btn primary" id="gl-luu">Lưu</button></div>`);
  $('#gl-luu').onclick = async () => {
    const chon = $$('#modal-body input[type=checkbox]:checked').map(i => +i.value);
    let r = await sb.from('lop').update({ gvcn_id: null }).eq('gvcn_id', uid);
    if (!r.error && chon.length) r = await sb.from('lop').update({ gvcn_id: uid }).in('id', chon);
    if (r.error) { toast(dichLoi(r.error), 'err'); return; }
    toast('Đã gán lớp.'); dongModal(); await xong();
  };
}

khoiDong();