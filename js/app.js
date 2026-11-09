'use strict';
/* =====================================================================
   QUẢN LÝ VI PHẠM HỌC SINH  –  HTML/JS thuần + Supabase
   ===================================================================== */

const CFG = window.APP_CONFIG || {};
let sb = null;
const S = { user: null, profile: null, lop: [], hs: [], loai: [], lopMap: new Map(), hsMap: new Map(), stt: new Map(), charts: [] };

const VAI_TRO = { cho_duyet: 'Chờ duyệt', gv: 'Giáo viên', bgh: 'Ban giám hiệu', admin: 'Quản trị' };
const TRANG_THAI = { chua_xu_ly: 'Chưa xử lý', dang_xu_ly: 'Đang xử lý', da_xu_ly: 'Đã xử lý' };
const MUC_DO = { 1: 'Nhẹ', 2: 'Trung bình', 3: 'Nặng' };
const BIEN_PHAP = ['Nhắc nhở', 'Phê bình trước lớp', 'Viết bản tự kiểm điểm', 'Thông báo PHHS',
  'Mời PHHS đến trường', 'Lao động vệ sinh', 'Hạ mức đánh giá rèn luyện', 'Đưa ra Hội đồng kỷ luật'];
const PHUT_HUY = CFG.PHUT_DUOC_HUY || 15;

/* ---------------- Tiện ích ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const boDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const TZ = 'Asia/Ho_Chi_Minh';
const fmtTG = d => new Date(d).toLocaleString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtGio = d => new Date(d).toLocaleString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const ngayVN = ts => new Date(ts).toLocaleDateString('en-CA', { timeZone: TZ });   // YYYY-MM-DD
const homNay = () => ngayVN(Date.now());
const congNgay = (ymd, n) => { const x = new Date(ymd + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const diffNgay = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
const dauTuan = ymd => congNgay(ymd, -((new Date(ymd + 'T00:00:00Z').getUTCDay() + 6) % 7));
const tuNgay = d => `${d}T00:00:00+07:00`;
const denNgay = d => `${congNgay(d, 1)}T00:00:00+07:00`;
const vn = ymd => ymd ? ymd.split('-').reverse().join('/') : '';
const so = v => (+v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
const tenRieng = s => String(s).trim().split(/\s+/).pop();
const soSanhTen = (a, b) => tenRieng(a.ho_ten).localeCompare(tenRieng(b.ho_ten), 'vi') || a.ho_ten.localeCompare(b.ho_ten, 'vi');
const chuanHoaTen = s => String(s).trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi').replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toLocaleUpperCase('vi'));
const khoiTu = ten => { const m = String(ten).match(/\d+/); return m ? +m[0] : null; };
const tenLop = id => S.lopMap.get(id)?.ten_lop || '';
const laBGH = () => ['bgh', 'admin'].includes(S.profile?.vai_tro);
const laAdmin = () => S.profile?.vai_tro === 'admin';
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } }
};
const optLop = sel => S.lop.map(l => `<option value="${l.id}" ${String(l.id) === String(sel) ? 'selected' : ''}>${esc(l.ten_lop)}</option>`).join('');
const badgeTT = tt => `<span class="tt tt-${tt}">${TRANG_THAI[tt] || tt}</span>`;

function toast(msg, loai = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show ' + loai;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = ''), 3000);
}

function dichLoi(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Sai email hoặc mật khẩu.';
  if (/Email not confirmed/i.test(m)) return 'Email chưa được xác nhận. Kiểm tra hộp thư.';
  if (/User already registered/i.test(m)) return 'Email này đã được đăng ký.';
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
  const csv = '﻿' + [header, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = tenFile;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function moModal(html) { $('#modal-body').innerHTML = html; $('#modal').classList.remove('hidden'); }
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
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  document.title = 'Quản lý vi phạm' + (CFG.TEN_TRUONG ? ' – ' + CFG.TEN_TRUONG : '');
  $('#ten-truong').textContent = CFG.TEN_TRUONG || '';
  $('#ten-truong-login').textContent = CFG.TEN_TRUONG || '';

  ganDangNhap();
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') hienDangNhap(); });
  const { data: { session } } = await sb.auth.getSession();
  if (session) await vaoApp(session.user); else hienDangNhap();
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
  };
  $('#f-dang-nhap').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, email = f.email.value.trim(), password = f.pw.value;
    $('#login-err').textContent = '';
    $('#btn-login').disabled = true;
    try {
      if (dangKy) {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { ho_ten: chuanHoaTen(f.ten.value || '') } } });
        if (error) throw error;
        if (!data.session) { $('#login-err').textContent = 'Đã đăng ký. Hãy mở email để xác nhận, sau đó đăng nhập.'; return; }
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
      <p>Tài khoản <b>${esc(user.email)}</b> đã được tạo. Vui lòng báo Quản trị viên cấp quyền (Giáo viên hoặc Ban giám hiệu), sau đó tải lại trang.</p>
      <button class="btn primary" onclick="location.reload()">Tải lại</button></section>`;
    return;
  }
  try { await taiDanhMuc(); } catch (e) { toast(dichLoi(e), 'err'); }
  dungNav();
  window.onhashchange = dieuHuong;
  dieuHuong();
}

async function taiDanhMuc() {
  const [lop, hs, loai] = await Promise.all([
    layHet(() => sb.from('lop').select('*').order('id')),
    layHet(() => sb.from('hoc_sinh').select('id,ho_ten,lop_id,dang_hoc').order('id')),
    layHet(() => sb.from('loai_vi_pham').select('*').order('thu_tu').order('id'))
  ]);
  lop.sort((a, b) => (a.khoi ?? 99) - (b.khoi ?? 99) || a.ten_lop.localeCompare(b.ten_lop, 'vi', { numeric: true }));
  hs.sort(soSanhTen);
  S.lop = lop; S.hs = hs; S.loai = loai;
  S.lopMap = new Map(lop.map(l => [l.id, l]));
  S.hsMap = new Map(hs.map(h => [h.id, h]));
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

async function capNhatBadge() {
  const { count, error } = await sb.from('vi_pham').select('id', { count: 'exact', head: true }).eq('trang_thai', 'chua_xu_ly');
  const b = $('#badge-xl');
  if (b && !error) b.textContent = count ? (count > 99 ? '99+' : count) : '';
}

const VIEWS = {};
function dieuHuong() {
  let v = location.hash.slice(1) || 'nhap';
  if (!MENU.find(m => m.id === v && m.ai())) { v = 'nhap'; history.replaceState(null, '', '#nhap'); }
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.v === v));
  huyChart();
  const el = $('#noi-dung');
  el.onclick = el.oninput = el.onchange = el.onkeydown = el.onsubmit = null;
  window.scrollTo(0, 0);
  Promise.resolve(VIEWS[v](el)).catch(e => { console.error(e); toast(dichLoi(e), 'err'); });
}
function huyChart() { S.charts.forEach(c => c.destroy()); S.charts = []; }

/* =====================================================================
   1. NHẬP VI PHẠM
   ===================================================================== */
VIEWS.nhap = function (el) {
  const N = S.nhap || (S.nhap = { lopId: S.lopMap.has(+ls.get('vp_lop')) ? +ls.get('vp_lop') : (S.lop[0]?.id || 0), hs: new Set(), loai: new Set() });

  el.innerHTML = `
  <div class="grid-nhap">
    <section class="card">
      <h2><span class="step">1</span> Chọn lớp</h2>
      <div id="ds-lop" class="chips"></div>
      <h2><span class="step">2</span> Chọn học sinh <small class="muted" id="dem-hs"></small></h2>
      <input id="tim-hs" class="input" placeholder="Gõ tên để lọc… (Enter: chọn người đầu tiên)" autocomplete="off">
      <div id="ds-hs" class="hs-grid"></div>
    </section>
    <section class="card sticky-col">
      <h2><span class="step">3</span> Chọn vi phạm</h2>
      <div id="ds-loai" class="chips loai"></div>
      <textarea id="ghi-chu" class="input" rows="2" placeholder="Ghi chú (không bắt buộc)"></textarea>
      <div id="tom-tat" class="tom-tat"></div>
      <button id="btn-ghi" class="btn primary big" disabled>Ghi nhận</button>
      <p class="muted small">Ngày giờ vi phạm được máy chủ ghi tự động lúc bấm <b>Ghi nhận</b>. Có thể hủy trong ${PHUT_HUY} phút.</p>
      <h3>Bạn vừa ghi nhận</h3>
      <div id="gan-day"><p class="muted small">Đang tải…</p></div>
    </section>
  </div>`;

  const veLop = () => {
    $('#ds-lop').innerHTML = `<button type="button" class="chip ${N.lopId === 0 ? 'on' : ''}" data-lop="0">Tìm toàn trường</button>` +
      S.lop.map(l => `<button type="button" class="chip ${l.id === N.lopId ? 'on' : ''}" data-lop="${l.id}">${esc(l.ten_lop)}</button>`).join('');
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
    $('#ds-loai').innerHTML = ds.map(l => `<button type="button" class="chip md${l.muc_do || 1} ${N.loai.has(l.id) ? 'on' : ''}" data-loai="${l.id}">${esc(l.ten)}${+l.diem_tru ? ` <small>−${so(l.diem_tru)}</small>` : ''}</button>`).join('')
      || '<p class="muted">Chưa có hình thức vi phạm.</p>';
  };
  const veTomTat = () => {
    const n = N.hs.size * N.loai.size;
    $('#dem-hs').textContent = N.hs.size ? `· đã chọn ${N.hs.size}` : '';
    $('#tom-tat').innerHTML = [...N.hs].map(id => S.hsMap.get(id)).filter(Boolean)
      .map(h => `<span class="tag">${esc(h.ho_ten)} <i>${esc(tenLop(h.lop_id))}</i><button type="button" data-bo="${h.id}" aria-label="Bỏ chọn">×</button></span>`).join('');
    const b = $('#btn-ghi');
    b.disabled = !n;
    b.textContent = n ? `Ghi nhận ${n} vi phạm` : (N.hs.size ? 'Chọn vi phạm' : 'Chọn học sinh');
  };
  const chonHS = id => { N.hs.has(id) ? N.hs.delete(id) : N.hs.add(id); };

  async function taiGanDay() {
    const box = $('#gan-day'); if (!box) return;
    const { data, error } = await sb.from('v_vi_pham').select('id,thoi_gian,ho_ten,ten_lop,ten_vi_pham')
      .eq('nguoi_ghi', S.user.id).order('thoi_gian', { ascending: false }).limit(8);
    if (!$('#gan-day')) return;
    if (error) { box.innerHTML = `<p class="err">${esc(dichLoi(error))}</p>`; return; }
    const now = Date.now();
    box.innerHTML = data.length ? `<ul class="recent">${data.map(r => `<li>
        <span class="muted">${fmtGio(r.thoi_gian)}</span>
        <span><b>${esc(r.ho_ten)}</b> <i class="muted">${esc(r.ten_lop)}</i> — ${esc(r.ten_vi_pham)}</span>
        ${now - new Date(r.thoi_gian) < PHUT_HUY * 60e3 ? `<button type="button" class="link" data-huy="${r.id}">Hủy</button>` : ''}</li>`).join('')}</ul>`
      : '<p class="muted small">Chưa có.</p>';
  }

  el.onclick = async e => {
    const t = e.target.closest('[data-lop],[data-hs],[data-loai],[data-bo],[data-huy]');
    if (!t) return;
    const d = t.dataset;
    if (d.lop !== undefined) {
      N.lopId = +d.lop; ls.set('vp_lop', N.lopId);
      $('#tim-hs').value = ''; veLop(); veHS();
      if (N.lopId === 0) $('#tim-hs').focus();
    } else if (d.hs) {
      chonHS(+d.hs); t.classList.toggle('on'); veTomTat();
    } else if (d.loai) {
      const id = +d.loai; N.loai.has(id) ? N.loai.delete(id) : N.loai.add(id);
      t.classList.toggle('on'); veTomTat();
    } else if (d.bo) {
      N.hs.delete(+d.bo); veHS(); veTomTat();
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
      if (first) { chonHS(+first.dataset.hs); e.target.value = ''; veHS(); veTomTat(); }
    } else if (e.key === 'Escape') { e.target.value = ''; veHS(); }
  };
  el.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !$('#btn-ghi').disabled) $('#btn-ghi').click(); };

  $('#btn-ghi').onclick = async () => {
    const ghiChu = $('#ghi-chu').value.trim() || null;
    const rows = [];
    for (const h of N.hs) for (const l of N.loai) rows.push({ hoc_sinh_id: h, loai_id: l, ghi_chu: ghiChu });
    if (!rows.length) return;
    const b = $('#btn-ghi'); b.disabled = true; b.textContent = 'Đang lưu…';
    const { error } = await sb.from('vi_pham').insert(rows);
    if (error) { toast(dichLoi(error), 'err'); veTomTat(); return; }
    toast(`Đã ghi nhận ${rows.length} vi phạm.`);
    N.hs.clear(); N.loai.clear();
    $('#ghi-chu').value = ''; $('#tim-hs').value = '';
    veHS(); veLoai(); veTomTat(); taiGanDay(); capNhatBadge();
  };

  veLop(); veHS(); veLoai(); veTomTat(); taiGanDay();
};

/* =====================================================================
   2. XỬ LÝ VI PHẠM
   ===================================================================== */
VIEWS.xuly = async function (el) {
  const F = S.locXL || (S.locXL = { tt: 'chua_xu_ly', lop: '', tu: congNgay(homNay(), -30), den: homNay(), q: '' });
  const bgh = laBGH();
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
      <label>Lớp<select id="xl-lop" class="input"><option value="">Tất cả lớp</option>${optLop(F.lop)}</select></label>
      <label>Từ ngày<input type="date" id="xl-tu" class="input" value="${F.tu}"></label>
      <label>Đến ngày<input type="date" id="xl-den" class="input" value="${F.den}"></label>
      <label class="grow">Tìm học sinh<input id="xl-q" class="input" placeholder="Nhập tên…" value="${esc(F.q)}"></label>
      <button type="button" class="btn" id="xl-csv">Xuất Excel (CSV)</button>
    </div>
    ${bgh ? `<div class="bulk hidden" id="bulk"><b id="bulk-n"></b>
      <button type="button" class="btn primary sm" data-act="bulk-xl">Xử lý các mục đã chọn</button>
      <button type="button" class="btn sm" data-act="bulk-bo">Bỏ chọn</button></div>` : ''}
    <div id="xl-bang" class="table-wrap"><p class="muted pad">Đang tải…</p></div>
    ${bgh ? '' : '<p class="muted small">Chỉ Ban giám hiệu được cập nhật trạng thái xử lý.</p>'}
  </section>`;

  async function tai() {
    F.lop = $('#xl-lop').value; F.tu = $('#xl-tu').value; F.den = $('#xl-den').value;
    $('#xl-bang').innerHTML = '<p class="muted pad">Đang tải…</p>';
    try {
      all = await layHet(() => {
        let q = sb.from('v_vi_pham').select('*').order('thoi_gian', { ascending: false }).order('id', { ascending: false });
        if (F.tu) q = q.gte('thoi_gian', tuNgay(F.tu));
        if (F.den) q = q.lt('thoi_gian', denNgay(F.den));
        if (F.lop) q = q.eq('lop_id', +F.lop);
        return q;
      });
    } catch (e) { $('#xl-bang').innerHTML = `<p class="err pad">${esc(dichLoi(e))}</p>`; return; }
    chon.clear();
    ve();
  }

  function ve() {
    const q = boDau(F.q);
    const base = all.filter(r => !q || boDau(r.ho_ten).includes(q));
    const cnt = { chua_xu_ly: 0, dang_xu_ly: 0, da_xu_ly: 0, '': base.length };
    base.forEach(r => cnt[r.trang_thai]++);
    $$('[data-cnt]').forEach(s => (s.textContent = cnt[s.dataset.cnt]));
    rows = base.filter(r => !F.tt || r.trang_thai === F.tt);
    $('#xl-bang').innerHTML = rows.length ? `<table class="tbl">
      <thead><tr>${bgh ? '<th class="w1"><input type="checkbox" id="chk-all" aria-label="Chọn tất cả"></th>' : ''}
        <th>Thời gian</th><th>Học sinh</th><th>Lớp</th><th>Vi phạm</th><th>Người ghi</th><th>Trạng thái</th><th>Biện pháp xử lý</th>${bgh ? '<th></th>' : ''}</tr></thead>
      <tbody>${rows.map(r => `<tr class="${chon.has(r.id) ? 'sel' : ''}">
        ${bgh ? `<td><input type="checkbox" data-chk="${r.id}" ${chon.has(r.id) ? 'checked' : ''}></td>` : ''}
        <td class="nowrap">${fmtTG(r.thoi_gian)}</td>
        <td><a href="#" data-lsu="${r.hoc_sinh_id}">${esc(r.ho_ten)}</a></td>
        <td>${esc(r.ten_lop)}</td>
        <td><span class="dot md${r.muc_do}"></span>${esc(r.ten_vi_pham)}${r.ghi_chu ? `<div class="muted small">${esc(r.ghi_chu)}</div>` : ''}</td>
        <td class="small">${esc(r.ten_nguoi_ghi || '')}</td>
        <td>${badgeTT(r.trang_thai)}</td>
        <td class="small">${esc(r.bien_phap || '')}${r.thoi_gian_xu_ly ? `<div class="muted">${esc(r.ten_nguoi_xu_ly || '')} · ${fmtGio(r.thoi_gian_xu_ly)}</div>` : ''}</td>
        ${bgh ? `<td><button type="button" class="btn sm" data-xl="${r.id}">Xử lý</button></td>` : ''}
      </tr>`).join('')}</tbody></table>`
      : '<p class="muted pad">Không có vi phạm nào phù hợp.</p>';
    veBulk();
  }

  function veBulk() {
    const b = $('#bulk'); if (!b) return;
    b.classList.toggle('hidden', !chon.size);
    $('#bulk-n').textContent = `Đã chọn ${chon.size}`;
    const all2 = $('#chk-all');
    if (all2) all2.checked = rows.length > 0 && rows.every(r => chon.has(r.id));
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
        ['Thời gian', 'Học sinh', 'Lớp', 'Vi phạm', 'Mức độ', 'Điểm trừ', 'Ghi chú', 'Người ghi', 'Trạng thái', 'Biện pháp', 'Người xử lý', 'Thời gian xử lý'],
        rows.map(r => [fmtTG(r.thoi_gian), r.ho_ten, r.ten_lop, r.ten_vi_pham, MUC_DO[r.muc_do], r.diem_tru, r.ghi_chu, r.ten_nguoi_ghi,
          TRANG_THAI[r.trang_thai], r.bien_phap, r.ten_nguoi_xu_ly, r.thoi_gian_xu_ly ? fmtTG(r.thoi_gian_xu_ly) : '']));
    }
  };
  el.onchange = e => {
    if (e.target.id === 'chk-all') {
      rows.forEach(r => e.target.checked ? chon.add(r.id) : chon.delete(r.id)); ve();
    } else if (e.target.dataset.chk) {
      const id = +e.target.dataset.chk;
      e.target.checked ? chon.add(id) : chon.delete(id);
      e.target.closest('tr').classList.toggle('sel', e.target.checked);
      veBulk();
    } else if (['xl-lop', 'xl-tu', 'xl-den'].includes(e.target.id)) tai();
  };
  el.oninput = e => { if (e.target.id === 'xl-q') { F.q = e.target.value.trim(); ve(); } };

  await tai();
};

function moXuLy(ids, nguon, xong) {
  const one = ids.length === 1 ? nguon.find(r => r.id === ids[0]) : null;
  moModal(`<h2>${one ? 'Xử lý vi phạm' : `Xử lý ${ids.length} vi phạm`}</h2>
    ${one ? `<div class="info-box"><b>${esc(one.ho_ten)}</b> · lớp ${esc(one.ten_lop)}<br>${esc(one.ten_vi_pham)}
      <div class="muted small">${fmtTG(one.thoi_gian)}${one.ten_nguoi_ghi ? ' · ghi bởi ' + esc(one.ten_nguoi_ghi) : ''}</div>
      ${one.ghi_chu ? `<div class="small">Ghi chú: ${esc(one.ghi_chu)}</div>` : ''}</div>` : ''}
    <label class="lbl">Biện pháp xử lý <span class="muted small">(bấm để chèn nhanh)</span></label>
    <div class="chips" id="bp-chips">${BIEN_PHAP.map(b => `<button type="button" class="chip" data-bp="${esc(b)}">${esc(b)}</button>`).join('')}</div>
    <textarea id="bp-text" class="input" rows="3" placeholder="Ghi rõ biện pháp, kết quả xử lý…">${esc(one?.bien_phap || '')}</textarea>
    <label class="lbl">Trạng thái</label>
    <div class="radio-row">
      ${['da_xu_ly', 'dang_xu_ly', 'chua_xu_ly'].map(k => `<label class="radio"><input type="radio" name="tt" value="${k}" ${(one && one.trang_thai !== 'chua_xu_ly' ? one.trang_thai : 'da_xu_ly') === k ? 'checked' : ''}> ${TRANG_THAI[k]}</label>`).join('')}
    </div>
    <div class="modal-actions">
      ${one ? '<button type="button" class="btn danger" id="m-xoa">Xóa vi phạm</button>' : ''}
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
    $('#m-luu').disabled = true;
    const { data, error } = await sb.from('vi_pham').update({ trang_thai: tt, bien_phap: tt === 'chua_xu_ly' ? null : bp }).in('id', ids).select('id');
    $('#m-luu').disabled = false;
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
  moModal(`<h2>${esc(h?.ho_ten || 'Học sinh')}</h2><p class="muted">Lớp ${esc(tenLop(h?.lop_id))}</p>
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
  box.innerHTML = `<div class="mini-kpis"><div><b>${data.length}</b><span>vi phạm</span></div><div><b>${so(diem)}</b><span>điểm trừ</span></div><div><b>${chua}</b><span>chưa xử lý xong</span></div></div>
    <p class="small">${Object.entries(theoLoai).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span class="tag">${esc(t)} <i>×${n}</i></span>`).join(' ')}</p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Thời gian</th><th>Vi phạm</th><th>Trạng thái</th><th>Biện pháp</th></tr></thead>
    <tbody>${data.map(r => `<tr><td class="nowrap">${fmtTG(r.thoi_gian)}</td><td>${esc(r.ten_vi_pham)}${r.ghi_chu ? `<div class="muted small">${esc(r.ghi_chu)}</div>` : ''}</td><td>${badgeTT(r.trang_thai)}</td><td class="small">${esc(r.bien_phap || '')}</td></tr>`).join('')}</tbody></table></div>`;
}

/* =====================================================================
   3. THỐNG KÊ
   ===================================================================== */
function khoangThoiGian(p) {
  const t = homNay(), [y, m] = t.split('-').map(Number);
  const nh = m >= 8 ? y : y - 1;   // năm bắt đầu năm học
  const hk1 = `${nh}-${CFG.HK1_BAT_DAU || '09-01'}`, hk2 = `${nh + 1}-${CFG.HK2_BAT_DAU || '01-16'}`, kt = `${nh + 1}-${CFG.NAM_HOC_KET_THUC || '05-31'}`;
  switch (p) {
    case '7': return [congNgay(t, -6), t];
    case '30': return [congNgay(t, -29), t];
    case 'tuan': return [dauTuan(t), t];
    case 'thang': return [t.slice(0, 8) + '01', t];
    case 'hk1': return [hk1, congNgay(hk2, -1)];
    case 'hk2': return [hk2, kt];
    case 'nam': return [hk1, kt];
    default: return [congNgay(t, -29), t];
  }
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
  return { pri: g('--pri'), prev: g('--chart-prev'), text: g('--muted'), grid: g('--line') };
}

function veChart(id, cfg) {
  if (typeof Chart === 'undefined') return;
  const c = mau();
  Chart.defaults.color = c.text;
  Chart.defaults.borderColor = c.grid;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  const ch = new Chart($('#' + id), cfg);
  S.charts.push(ch);
}

VIEWS.thongke = async function (el) {
  const F = S.locTK || (S.locTK = { preset: '30', tu: '', den: '', lop: '' });
  el.innerHTML = `
  <section class="card">
    <div class="filters">
      <label>Khoảng thời gian<select id="tk-preset" class="input">
        <option value="7">7 ngày qua</option><option value="30">30 ngày qua</option>
        <option value="tuan">Tuần này</option><option value="thang">Tháng này</option>
        <option value="hk1">Học kỳ I</option><option value="hk2">Học kỳ II</option>
        <option value="nam">Cả năm học</option><option value="tuy">Tùy chọn…</option></select></label>
      <label>Từ ngày<input type="date" id="tk-tu" class="input"></label>
      <label>Đến ngày<input type="date" id="tk-den" class="input"></label>
      <label>Phạm vi<select id="tk-lop" class="input"><option value="">Toàn trường</option>${optLop(F.lop)}</select></label>
    </div>
    <p class="muted small" id="tk-mota"></p>
  </section>
  <div class="kpis" id="tk-kpi"></div>
  <div class="grid2">
    <section class="card"><h3>Diễn biến số vi phạm</h3><div class="chart-box"><canvas id="c-dien-bien"></canvas></div></section>
    <section class="card"><h3>Theo hình thức vi phạm</h3><div class="chart-box"><canvas id="c-loai"></canvas></div></section>
  </div>
  <section class="card"><div class="head-row"><h3>Theo lớp</h3><button type="button" class="btn sm" id="csv-lop">Xuất CSV</button></div>
    <div class="chart-box" id="box-c-lop"><canvas id="c-lop"></canvas></div><div class="table-wrap" id="tk-bang-lop"></div></section>
  <section class="card"><div class="head-row"><h3>Học sinh vi phạm nhiều nhất</h3><button type="button" class="btn sm" id="csv-hs">Xuất CSV</button></div>
    <div class="table-wrap" id="tk-hs"></div></section>`;
  $('#tk-preset').value = F.preset;
  if (F.preset === 'tuy') { $('#tk-tu').value = F.tu; $('#tk-den').value = F.den; }

  let bangLop = [], bangHS = [];

  async function tai() {
    F.preset = $('#tk-preset').value;
    if (F.preset !== 'tuy') { [F.tu, F.den] = khoangThoiGian(F.preset); $('#tk-tu').value = F.tu; $('#tk-den').value = F.den; }
    else { F.tu = $('#tk-tu').value; F.den = $('#tk-den').value; }
    F.lop = $('#tk-lop').value;
    const tu = F.tu, den = F.den > homNay() ? homNay() : F.den;
    huyChart();
    if (!tu || !den || tu > den) {
      $('#tk-mota').textContent = tu > homNay() ? 'Khoảng thời gian này chưa bắt đầu.' : 'Khoảng thời gian không hợp lệ.';
      return;
    }
    const n = diffNgay(tu, den) + 1, pTu = congNgay(tu, -n), pDen = congNgay(tu, -1);
    $('#tk-mota').textContent = `Từ ${vn(tu)} đến ${vn(den)} (${n} ngày) · so sánh với cùng số ngày liền trước: ${vn(pTu)} – ${vn(pDen)}`;
    $('#tk-kpi').innerHTML = '<p class="muted">Đang tải…</p>';

    let data;
    try {
      data = await layHet(() => {
        let q = sb.from('v_vi_pham').select('id,thoi_gian,hoc_sinh_id,ho_ten,lop_id,ten_lop,loai_id,ten_vi_pham,diem_tru,trang_thai')
          .gte('thoi_gian', tuNgay(pTu)).lt('thoi_gian', denNgay(den)).order('id');
        if (F.lop) q = q.eq('lop_id', +F.lop);
        return q;
      });
    } catch (e) { $('#tk-kpi').innerHTML = `<p class="err">${esc(dichLoi(e))}</p>`; return; }
    data.forEach(r => (r.ngay = ngayVN(r.thoi_gian)));
    const cur = data.filter(r => r.ngay >= tu), prev = data.filter(r => r.ngay < tu);
    const soHS = a => new Set(a.map(r => r.hoc_sinh_id)).size;
    const diem = a => a.reduce((s, r) => s + (+r.diem_tru || 0), 0);
    const daXL = cur.filter(r => r.trang_thai === 'da_xu_ly').length;

    // KPI
    const kpi = (ten, c, p) => `<div class="kpi"><span>${ten}</span><b>${so(c)}</b>${xuHuong(c, p)}<small>Kỳ trước: ${so(p)}</small></div>`;
    $('#tk-kpi').innerHTML = kpi('Tổng số vi phạm', cur.length, prev.length) + kpi('Số học sinh vi phạm', soHS(cur), soHS(prev)) +
      kpi('Tổng điểm trừ', diem(cur), diem(prev)) +
      `<div class="kpi"><span>Đã xử lý</span><b>${cur.length ? Math.round(daXL / cur.length * 100) : 0}%</b><em class="${cur.length - daXL ? 'up' : 'flat'}">${cur.length - daXL} vi phạm chưa xong</em><small>${daXL}/${cur.length} đã xử lý</small></div>`;

    const c = mau();
    // Diễn biến
    const theoTuan = n > 45, buoc = theoTuan ? 7 : 1, soCot = Math.ceil(n / buoc);
    const cot = (arr, goc) => { const a = new Array(soCot).fill(0); arr.forEach(r => { const i = Math.floor(diffNgay(goc, r.ngay) / buoc); if (i >= 0 && i < soCot) a[i]++; }); return a; };
    veChart('c-dien-bien', {
      type: 'line',
      data: {
        labels: Array.from({ length: soCot }, (_, i) => vn(congNgay(tu, i * buoc)).slice(0, 5)),
        datasets: [
          { label: 'Kỳ này', data: cot(cur, tu), borderColor: c.pri, backgroundColor: c.pri + '22', fill: true, tension: .3, pointRadius: 2 },
          { label: 'Kỳ trước', data: cot(prev, pTu), borderColor: c.prev, borderDash: [5, 4], pointRadius: 0, tension: .3 }
        ]
      },
      options: {
        maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { title: { display: theoTuan, text: 'Tuần bắt đầu từ ngày' } } },
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Theo hình thức
    const dem = (arr, key) => { const m = new Map(); arr.forEach(r => m.set(r[key], (m.get(r[key]) || 0) + 1)); return m; };
    const lc = dem(cur, 'ten_vi_pham'), lp = dem(prev, 'ten_vi_pham');
    const tenLoai = [...new Set([...lc.keys(), ...lp.keys()])].sort((a, b) => (lc.get(b) || 0) - (lc.get(a) || 0)).slice(0, 12);
    veChart('c-loai', {
      type: 'bar',
      data: { labels: tenLoai, datasets: [
        { label: 'Kỳ này', data: tenLoai.map(t => lc.get(t) || 0), backgroundColor: c.pri, borderRadius: 4 },
        { label: 'Kỳ trước', data: tenLoai.map(t => lp.get(t) || 0), backgroundColor: c.prev, borderRadius: 4 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom' } } }
    });

    // Theo lớp
    const dsLop = F.lop ? S.lop.filter(l => l.id === +F.lop) : S.lop;
    const gc = new Map(), gp = new Map();
    cur.forEach(r => { if (!gc.has(r.lop_id)) gc.set(r.lop_id, []); gc.get(r.lop_id).push(r); });
    prev.forEach(r => gp.set(r.lop_id, (gp.get(r.lop_id) || 0) + 1));
    bangLop = dsLop.map(l => {
      const a = gc.get(l.id) || [];
      const siSo = S.hs.filter(h => h.lop_id === l.id && h.dang_hoc).length;
      return { ten: l.ten_lop, siSo, c: a.length, p: gp.get(l.id) || 0, hs: soHS(a), diem: diem(a), chua: a.filter(r => r.trang_thai !== 'da_xu_ly').length };
    }).sort((a, b) => b.c - a.c || b.diem - a.diem || a.ten.localeCompare(b.ten, 'vi', { numeric: true }));
    const coDuLieu = bangLop.filter(r => r.c || r.p);
    $('#box-c-lop').classList.toggle('hidden', !!F.lop || !coDuLieu.length);
    if (!F.lop && coDuLieu.length) {
      const sx = [...coDuLieu].sort((a, b) => a.ten.localeCompare(b.ten, 'vi', { numeric: true }));
      veChart('c-lop', {
        type: 'bar',
        data: { labels: sx.map(r => r.ten), datasets: [
          { label: 'Kỳ này', data: sx.map(r => r.c), backgroundColor: c.pri, borderRadius: 4 },
          { label: 'Kỳ trước', data: sx.map(r => r.p), backgroundColor: c.prev, borderRadius: 4 }] },
        options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom' } } }
      });
    }
    $("#tk-bang-lop").innerHTML = `<table class="tbl"><thead><tr><th>#</th><th>Lớp</th><th class="r">Sĩ số</th><th class="r">Số VP</th><th class="r">VP / HS</th><th class="r">HS vi phạm</th><th class="r">Điểm trừ</th><th class="r">Kỳ trước</th><th>Tăng / giảm</th><th class="r">Chưa xử lý</th></tr></thead>
      <tbody>${bangLop.map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(r.ten)}</b></td><td class="r">${r.siSo}</td><td class="r"><b>${r.c}</b></td>
        <td class="r">${r.siSo ? (r.c / r.siSo).toFixed(2) : '–'}</td><td class="r">${r.hs}</td><td class="r">${so(r.diem)}</td><td class="r">${r.p}</td>
        <td>${xuHuong(r.c, r.p)}</td><td class="r">${r.chua || ''}</td></tr>`).join('') || '<tr><td colspan="10" class="muted">Chưa có lớp.</td></tr>'}</tbody></table>`;

    // Theo học sinh
    const m = new Map();
    for (const r of cur) {
      let o = m.get(r.hoc_sinh_id);
      if (!o) m.set(r.hoc_sinh_id, o = { id: r.hoc_sinh_id, ten: r.ho_ten, lop: r.ten_lop, c: 0, p: 0, diem: 0, chua: 0, loai: {} });
      o.c++; o.diem += +r.diem_tru || 0; if (r.trang_thai !== 'da_xu_ly') o.chua++;
      o.loai[r.ten_vi_pham] = (o.loai[r.ten_vi_pham] || 0) + 1;
    }
    for (const r of prev) { const o = m.get(r.hoc_sinh_id); if (o) o.p++; }
    bangHS = [...m.values()].sort((a, b) => b.c - a.c || b.diem - a.diem).slice(0, 50);
    bangHS.forEach(o => (o.loiChinh = Object.entries(o.loai).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, k]) => `${t} (${k})`).join(', ')));
    $('#tk-hs').innerHTML = bangHS.length ? `<table class="tbl"><thead><tr><th>#</th><th>Học sinh</th><th>Lớp</th><th class="r">Số VP</th><th class="r">Điểm trừ</th><th class="r">Kỳ trước</th><th>Xu hướng</th><th>Lỗi thường gặp</th><th class="r">Chưa xử lý</th></tr></thead>
      <tbody>${bangHS.map((o, i) => `<tr><td>${i + 1}</td><td><a href="#" data-lsu="${o.id}">${esc(o.ten)}</a></td><td>${esc(o.lop)}</td><td class="r"><b>${o.c}</b></td><td class="r">${so(o.diem)}</td><td class="r">${o.p}</td>
        <td>${xuHuong(o.c, o.p)}</td><td class="small">${esc(o.loiChinh)}</td><td class="r">${o.chua || ''}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted pad">Không có học sinh vi phạm trong khoảng thời gian này. 🎉</p>';
  }

  el.onchange = e => {
    if (e.target.id === 'tk-tu' || e.target.id === 'tk-den') $('#tk-preset').value = 'tuy';
    if (['tk-preset', 'tk-tu', 'tk-den', 'tk-lop'].includes(e.target.id)) tai();
  };
  el.onclick = e => {
    const t = e.target.closest('[data-lsu],#csv-lop,#csv-hs'); if (!t) return;
    if (t.dataset.lsu) { e.preventDefault(); lichSuHS(+t.dataset.lsu); }
    else if (t.id === 'csv-lop') xuatCSV(`thong-ke-lop_${F.tu}_${F.den}.csv`, ['Lớp', 'Sĩ số', 'Số VP', 'VP/HS', 'HS vi phạm', 'Điểm trừ', 'Kỳ trước', 'Chênh lệch', 'Chưa xử lý'],
      bangLop.map(r => [r.ten, r.siSo, r.c, r.siSo ? (r.c / r.siSo).toFixed(2) : '', r.hs, r.diem, r.p, r.c - r.p, r.chua]));
    else if (t.id === 'csv-hs') xuatCSV(`thong-ke-hoc-sinh_${F.tu}_${F.den}.csv`, ['Học sinh', 'Lớp', 'Số VP', 'Điểm trừ', 'Kỳ trước', 'Chênh lệch', 'Lỗi thường gặp', 'Chưa xử lý'],
      bangHS.map(o => [o.ten, o.lop, o.c, o.diem, o.p, o.c - o.p, o.loiChinh, o.chua]));
  };
  await tai();
};

/* =====================================================================
   4. HỌC SINH & LỚP
   ===================================================================== */
VIEWS.hocsinh = function (el) {
  if (!S.lopMap.has(S.hsLop)) S.hsLop = S.lop[0]?.id || 0;
  el.innerHTML = `
  <div class="grid-hs">
    <section class="card">
      <h2>Lớp học</h2>
      <form id="f-lop" class="row"><input class="input" name="ten" placeholder="Tên lớp, vd: 6A1" required><button class="btn primary">Thêm</button></form>
      <div id="hs-ds-lop" class="list"></div>
    </section>
    <section class="card">
      <div class="head-row"><h2 id="hs-tieu-de">Học sinh</h2>
        <div class="row-gap"><button type="button" class="btn" id="btn-nhap-nhieu">Nhập từ Excel</button></div></div>
      <form id="f-hs" class="row"><input class="input" name="ten" placeholder="Họ tên học sinh, Enter để thêm" required autocomplete="off"><button class="btn primary">Thêm</button></form>
      <div id="hs-ds" class="table-wrap"></div>
    </section>
  </div>`;

  const veLop = () => {
    const dem = {}; S.hs.forEach(h => { if (h.dang_hoc) dem[h.lop_id] = (dem[h.lop_id] || 0) + 1; });
    $('#hs-ds-lop').innerHTML = S.lop.map(l => `<div class="list-item ${l.id === S.hsLop ? 'on' : ''}" data-chon-lop="${l.id}">
      <span><b>${esc(l.ten_lop)}</b> <span class="muted small">${dem[l.id] || 0} HS</span></span>
      <span><button type="button" class="link" data-doi-lop="${l.id}">Đổi tên</button><button type="button" class="link danger" data-xoa-lop="${l.id}">Xóa</button></span></div>`).join('')
      || '<p class="muted">Chưa có lớp nào. Thêm lớp ở trên hoặc dùng “Nhập từ Excel”.</p>';
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
        <td class="nowrap"><button type="button" class="link" data-sua-hs="${h.id}">Sửa tên</button><button type="button" class="link danger" data-xoa-hs="${h.id}">Xóa</button></td></tr>`).join('')}</tbody></table>`
      : `<p class="muted pad">${S.hsLop ? 'Lớp chưa có học sinh.' : ''}</p>`;
  };
  const lamMoi = async () => { await taiDanhMuc(); if (!S.lopMap.has(S.hsLop)) S.hsLop = S.lop[0]?.id || 0; veLop(); veHS(); };
  const thucHien = async (p, okMsg) => { const { error } = await p; if (error) { toast(dichLoi(error), 'err'); return false; } if (okMsg) toast(okMsg); await lamMoi(); return true; };

  el.onsubmit = async e => {
    e.preventDefault();
    const f = e.target, ten = f.ten.value.trim(); if (!ten) return;
    if (f.id === 'f-lop') {
      const t = ten.toUpperCase().replace(/\s+/g, '');
      const { data, error } = await sb.from('lop').insert({ ten_lop: t, khoi: khoiTu(t) }).select().single();
      if (error) { toast(dichLoi(error), 'err'); return; }
      S.hsLop = data.id; f.reset(); toast(`Đã thêm lớp ${t}.`); await lamMoi();
    } else if (f.id === 'f-hs') {
      if (await thucHien(sb.from('hoc_sinh').insert({ ho_ten: chuanHoaTen(ten), lop_id: S.hsLop }), 'Đã thêm học sinh.')) { f.reset(); f.ten.focus(); }
    }
  };
  el.onclick = async e => {
    const t = e.target.closest('[data-chon-lop],[data-doi-lop],[data-xoa-lop],[data-sua-hs],[data-xoa-hs],[data-lsu],#btn-nhap-nhieu');
    if (!t) return;
    const d = t.dataset;
    if (d.doiLop) {
      const l = S.lopMap.get(+d.doiLop), moi = prompt('Tên lớp mới:', l.ten_lop);
      if (moi && moi.trim() && moi.trim() !== l.ten_lop) { const tt = moi.trim().toUpperCase().replace(/\s+/g, ''); await thucHien(sb.from('lop').update({ ten_lop: tt, khoi: khoiTu(tt) }).eq('id', l.id), 'Đã đổi tên lớp.'); }
    } else if (d.xoaLop) {
      const l = S.lopMap.get(+d.xoaLop), n = S.hs.filter(h => h.lop_id === l.id).length;
      if (confirm(`Xóa lớp ${l.ten_lop}?${n ? `\n\nCẢNH BÁO: ${n} học sinh và TOÀN BỘ vi phạm của các em sẽ bị xóa vĩnh viễn.` : ''}`)) await thucHien(sb.from('lop').delete().eq('id', l.id), 'Đã xóa lớp.');
    } else if (d.chonLop) {
      S.hsLop = +d.chonLop; veLop(); veHS();
    } else if (d.suaHs) {
      const h = S.hsMap.get(+d.suaHs), moi = prompt('Họ tên mới:', h.ho_ten);
      if (moi && moi.trim()) await thucHien(sb.from('hoc_sinh').update({ ho_ten: chuanHoaTen(moi) }).eq('id', h.id), 'Đã sửa.');
    } else if (d.xoaHs) {
      const h = S.hsMap.get(+d.xoaHs);
      if (confirm(`Xóa học sinh ${h.ho_ten}? Toàn bộ vi phạm của em cũng bị xóa.\n\nNếu học sinh chuyển trường, nên bỏ chọn “Đang học” thay vì xóa.`)) await thucHien(sb.from('hoc_sinh').delete().eq('id', h.id), 'Đã xóa.');
    } else if (d.lsu) {
      e.preventDefault(); lichSuHS(+d.lsu);
    } else if (t.id === 'btn-nhap-nhieu') moNhapExcel(lamMoi);
  };
  el.onchange = async e => {
    const d = e.target.dataset;
    if (d.chuyen) await thucHien(sb.from('hoc_sinh').update({ lop_id: +e.target.value }).eq('id', +d.chuyen), `Đã chuyển sang lớp ${tenLop(+e.target.value)}.`);
    else if (d.dangHoc) await thucHien(sb.from('hoc_sinh').update({ dang_hoc: e.target.checked }).eq('id', +d.dangHoc));
  };
  veLop(); veHS();
};

function phanTichDanhSach(text, lopMacDinh) {
  const out = [], loi = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    let cols = line.split(/\t|;/).map(s => s.trim()).filter(Boolean);
    if (!cols.length) return;
    if (/^(stt|ho\s*(va\s*)?ten|ho ten)$/i.test(boDau(cols[0])) || /ho\s*(va\s*)?ten/.test(boDau(cols[1] || ''))) return; // dòng tiêu đề
    if (/^\d+$/.test(cols[0]) && cols.length >= 2) cols = cols.slice(1);   // bỏ cột STT
    const ten = cols[0], lop = cols[1] || lopMacDinh;
    if (!ten || !lop || /^\d+$/.test(ten)) { loi.push(i + 1); return; }
    out.push({ ten: chuanHoaTen(ten), lop: String(lop).toUpperCase().replace(/\s+/g, '') });
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
  $('#nn-text').oninput = e => {
    kq = phanTichDanhSach(e.target.value, lopMD);
    const moi = [...new Set(kq.out.map(o => o.lop))].filter(t => !lopCo.has(t));
    const trung = kq.out.filter(o => daCo.has(o.lop + '|' + boDau(o.ten))).length;
    $('#nn-xem').innerHTML = kq.out.length ? `Sẽ nhập <b>${kq.out.length - trung}</b> học sinh${trung ? ` (bỏ qua ${trung} trùng)` : ''}${moi.length ? ` · tạo ${moi.length} lớp mới: <b>${esc(moi.join(', '))}</b>` : ''}${kq.loi.length ? ` · <span class="err">dòng lỗi: ${kq.loi.slice(0, 10).join(', ')}</span>` : ''}` : 'Chưa có dữ liệu hợp lệ.';
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
  el.innerHTML = `<section class="card">
    <h2>Hình thức vi phạm</h2>
    <p class="muted small">Mức độ dùng để tô màu khi nhập (xanh: nhẹ, cam: trung bình, đỏ: nặng); điểm trừ dùng cho thống kê. Hình thức đã phát sinh vi phạm nên <b>tắt “Đang dùng”</b> thay vì xóa.</p>
    <div class="table-wrap"><table class="tbl edit"><thead><tr><th>Thứ tự</th><th>Tên hình thức vi phạm</th><th>Nhóm</th><th>Mức độ</th><th>Điểm trừ</th><th>Đang dùng</th><th></th></tr></thead>
    <tbody id="loai-body"></tbody></table></div>
    <datalist id="dl-nhom"></datalist></section>`;
  const dong = l => `<tr data-id="${l.id || ''}" class="${l.id ? '' : 'new-row'}">
    <td><input class="input sm num" name="thu_tu" type="number" value="${l.thu_tu ?? ''}"></td>
    <td><input class="input sm" name="ten" value="${esc(l.ten || '')}" placeholder="${l.id ? '' : '+ Thêm hình thức mới…'}"></td>
    <td><input class="input sm" name="nhom" list="dl-nhom" value="${esc(l.nhom || '')}"></td>
    <td><select class="input sm" name="muc_do">${[1, 2, 3].map(k => `<option value="${k}" ${(l.muc_do || 1) === k ? 'selected' : ''}>${MUC_DO[k]}</option>`).join('')}</select></td>
    <td><input class="input sm num" name="diem_tru" type="number" step="0.5" min="0" value="${l.diem_tru ?? 0}"></td>
    <td class="c"><input type="checkbox" name="dang_dung" ${l.dang_dung !== false ? 'checked' : ''}></td>
    <td class="nowrap"><button type="button" class="btn sm ${l.id ? '' : 'primary'}" data-luu>${l.id ? 'Lưu' : 'Thêm'}</button>${l.id ? '<button type="button" class="link danger" data-xoa>Xóa</button>' : ''}</td></tr>`;
  const ve = () => {
    const maxTT = Math.max(0, ...S.loai.map(l => l.thu_tu || 0));
    $('#loai-body').innerHTML = S.loai.map(dong).join('') + dong({ thu_tu: maxTT + 1 });
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
      const row = { ten: v('ten').value.trim(), nhom: v('nhom').value.trim() || null, muc_do: +v('muc_do').value, diem_tru: +v('diem_tru').value || 0, dang_dung: v('dang_dung').checked, thu_tu: +v('thu_tu').value || 0 };
      if (!row.ten) { toast('Nhập tên hình thức vi phạm.', 'err'); v('ten').focus(); return; }
      res = id ? await sb.from('loai_vi_pham').update(row).eq('id', id) : await sb.from('loai_vi_pham').insert(row);
    }
    if (res.error) { toast(/foreign key/i.test(res.error.message) ? 'Hình thức này đã có vi phạm, không thể xóa. Hãy bỏ chọn “Đang dùng”.' : dichLoi(res.error), 'err'); return; }
    toast('Đã lưu.'); await taiDanhMuc(); ve();
  };
  el.onkeydown = e => { if (e.key === 'Enter' && e.target.matches('#loai-body input')) { e.preventDefault(); e.target.closest('tr').querySelector('[data-luu]').click(); } };
  ve();
};

/* =====================================================================
   6. TÀI KHOẢN (Quản trị)
   ===================================================================== */
VIEWS.nguoidung = async function (el) {
  el.innerHTML = `<section class="card"><h2>Tài khoản người dùng</h2>
    <p class="muted small">Giáo viên tự đăng ký trên trang đăng nhập, tài khoản ở trạng thái <b>Chờ duyệt</b> cho tới khi được cấp quyền.
    <b>Giáo viên</b>: nhập vi phạm, xem thống kê. <b>Ban giám hiệu</b>: thêm xử lý vi phạm, quản lý học sinh và hình thức vi phạm. <b>Quản trị</b>: thêm cấp quyền tài khoản.</p>
    <div class="table-wrap" id="nd-bang"><p class="muted pad">Đang tải…</p></div></section>`;
  const tai = async () => {
    const { data, error } = await sb.from('nguoi_dung').select('*');
    if (error) { $('#nd-bang').innerHTML = `<p class="err">${esc(dichLoi(error))}</p>`; return; }
    const thuTu = { cho_duyet: 0, admin: 1, bgh: 2, gv: 3 };
    data.sort((a, b) => thuTu[a.vai_tro] - thuTu[b.vai_tro] || String(a.ho_ten).localeCompare(String(b.ho_ten), 'vi'));
    $('#nd-bang').innerHTML = `<table class="tbl"><thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th></th></tr></thead><tbody>
      ${data.map(u => `<tr data-id="${u.id}" class="${u.vai_tro === 'cho_duyet' ? 'cho' : ''}"><td><input class="input sm" name="ho_ten" value="${esc(u.ho_ten || '')}"></td><td>${esc(u.email || '')}</td>
        <td><select class="input sm" name="vai_tro">${Object.entries(VAI_TRO).map(([k, t]) => `<option value="${k}" ${u.vai_tro === k ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td><button type="button" class="btn sm" data-luu>Lưu</button></td></tr>`).join('')}</tbody></table>`;
  };
  el.onclick = async e => {
    const b = e.target.closest('[data-luu]'); if (!b) return;
    const tr = b.closest('tr'), id = tr.dataset.id;
    const vt = tr.querySelector('[name=vai_tro]').value;
    if (id === S.user.id && vt !== 'admin' && !confirm('Bạn đang tự bỏ quyền Quản trị của mình. Tiếp tục?')) return;
    const { data, error } = await sb.from('nguoi_dung').update({ ho_ten: tr.querySelector('[name=ho_ten]').value.trim() || null, vai_tro: vt }).eq('id', id).select('id');
    if (error || !data.length) { toast(error ? dichLoi(error) : 'Không đủ quyền.', 'err'); return; }
    toast('Đã cập nhật.'); tai();
  };
  await tai();
};

khoiDong();
