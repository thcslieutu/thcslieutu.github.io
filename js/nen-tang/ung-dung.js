'use strict';
/* =====================================================================
   NỀN TẢNG – ỨNG DỤNG
   Đăng nhập, hồ sơ, phân quyền, dữ liệu dùng chung (điểm trường, lớp, học sinh,
   tài khoản, cấu hình), đăng ký phân hệ / trang, điều hướng, màn hình chọn phân hệ.

   CÁCH THÊM MỘT PHÂN HỆ MỚI (xem thêm HUONG-DAN-THEM-PHAN-HE.md):
     1. Viết file SQL supabase/NN-ten-phan-he.sql (bảng, quyền, ghi vào bảng mo_dun).
     2. Tạo thư mục js/mo-dun/ten-phan-he/, trong đó gọi:
          App.dangKyPhanHe({ id, ten, mo, mau, icon, thuTu, moDun });
          App.dangKyTrang({ id, phanHe, ten, icon, thuTu, quyen: ['ma.quyen'], ve: async el => { … } });
     3. Thêm thẻ <script> của các file đó vào index.html (sau các file nền tảng).
   ===================================================================== */

const CFG = window.APP_CONFIG || {};
let sb = null;
const S = {
  user: null, profile: null,
  quyen: new Set(),          // mã quyền của người đang đăng nhập
  dsQuyen: [],               // danh mục quyền (bảng quyen)
  ndQuyen: new Map(),        // id người dùng → Set mã quyền (để biết ai là đảng viên, ai có quyền gì)
  cauHinh: new Map(), moDun: new Map(),
  dt: [], lop: [], hs: [], nd: [],
  dtMap: new Map(), lopMap: new Map(), hsMap: new Map(), ndMap: new Map(), stt: new Map(),
  charts: [], phanHe: null
};

const CHUC_VU = { cho_duyet: 'Chờ duyệt', giao_vien: 'Giáo viên', tong_phu_trach: 'Tổng phụ trách', nhan_vien: 'Nhân viên', bgh: 'Ban giám hiệu', quan_tri: 'Quản trị' };
const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MK_TOI_THIEU = 8;   // độ dài tối thiểu cho mật khẩu MỚI (đăng ký, đổi, đặt lại)
const tenUngDung = () => String(CFG.TEN_UNG_DUNG || '').trim() || 'Ứng dụng quản lý nhà trường';

/* ---------- Dữ liệu dùng chung: tra cứu nhanh ---------- */
const tenLop = id => S.lopMap.get(id)?.ten_lop || '';
const tenDT = id => S.dtMap.get(id)?.ten || '';
const tenND = id => S.ndMap.get(id)?.ho_ten || '';
const coDT = () => S.dt.length > 0;
const chucVu = () => S.profile?.chuc_vu;
/** Nhóm lớp theo điểm trường: [[dtId|null, [lớp…]], …] */
function nhomTheoDT(ds) {
  const m = new Map(S.dt.map(d => [d.id, []]));
  m.set(null, []);
  ds.forEach(l => (m.get(l.diem_truong_id ?? null) || m.get(null)).push(l));
  return [...m].filter(([, a]) => a.length);
}
/** <option> lớp (nhóm theo điểm trường nếu có) */
const optLop = (sel, ds = S.lop) => {
  const o = l => `<option value="${l.id}" ${String(l.id) === String(sel) ? 'selected' : ''}>${esc(l.ten_lop)}</option>`;
  if (!coDT()) return ds.map(o).join('');
  return nhomTheoDT(ds).map(([d, a]) => `<optgroup label="${esc(d ? tenDT(d) : 'Chưa xếp điểm trường')}">${a.map(o).join('')}</optgroup>`).join('');
};
const optDT = sel => S.dt.map(d => `<option value="${d.id}" ${String(d.id) === String(sel) ? 'selected' : ''}>${esc(d.ten)}</option>`).join('');

/** Biểu tượng (SVG). Phân hệ thêm biểu tượng riêng: App.icon('ten', '<path …/>') */
const ICON = {
  trang: ic('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  nhap: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  xuly: ic('<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  thongke: ic('<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>'),
  hocsinh: ic('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  loai: ic('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>'),
  nguoidung: ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  dangvien: ic('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  ghivang: ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m10 14 4 4M14 14l-4 4"/>'),
  chuyencan: ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>'),
  phanhe: ic('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>')
};


/* =====================================================================
   App – nơi các phân hệ đăng ký trang, quyền, dữ liệu
   ===================================================================== */
const App = {
  phanHe: [],      // { id, ten, mo, mau, icon, thuTu, moDun }
  trang: [],       // { id, phanHe, ten, icon, thuTu, quyen, ve, huyHieu }
  _taiDuLieu: [], _lienQuanHS: [], _donDuLieu: [], _quyenPhu: {}, _huyHieu: new Map(),

  /** Đăng ký một phân hệ (một ô trên màn hình chọn phân hệ).
      moDun: mã trong bảng mo_dun – phân hệ chỉ hiện khi file SQL tương ứng đã chạy. */
  dangKyPhanHe(p) { this.phanHe.push({ thuTu: 99, ...p }); },

  /** Đăng ký một trang (một mục menu) thuộc một phân hệ.
      quyen: mảng mã quyền (có một trong các quyền là được vào) hoặc hàm trả về true/false.
      ve(el): vẽ nội dung trang vào phần tử el. huyHieu(): số việc cần làm (hiện thành chấm đỏ). */
  dangKyTrang(t) { this.trang.push({ thuTu: 99, ...t }); },

  /** Thêm biểu tượng SVG: App.icon('ten', '<path d="…"/>') */
  icon(ten, svg) { ICON[ten] = ic(svg); },

  /** Hàm tải dữ liệu riêng của phân hệ, chạy mỗi khi tải lại danh mục (sau đăng nhập, sau khi sửa danh mục) */
  khiTaiDuLieu(fn) { this._taiDuLieu.push(fn); },

  /** Khi xóa học sinh / lớp: phân hệ cho biết sẽ xóa kèm bao nhiêu dữ liệu. fn({ hocSinh: [id], lop: [id] }) → [{ ten, so }] */
  dangKyLienQuanHocSinh(fn) { this._lienQuanHS.push(fn); },

  /** Mục trong trang Quản trị → Xóa dữ liệu: { id, ten, mo, coNgay, dem(ngay) → số, xoa(ngay) → số } */
  dangKyDonDuLieu(m) { this._donDuLieu.push(m); },

  /** Cài đặt thêm cạnh một quyền trong trang Tài khoản, vd phạm vi điểm trường: { nhan(uid) → html, mo(uid, xong) } */
  dangKyQuyenPhu(ma, cai) { this._quyenPhu[ma] = cai; },

  /* ---- Tra cứu ---- */
  laQuanTri: () => chucVu() === 'quan_tri',
  thanhVien: ma => !!S.dsQuyen.find(q => q.ma === ma)?.thanh_vien,
  /** Người đang đăng nhập có quyền ma không (Quản trị có mọi quyền, trừ quyền "thành viên" như "Là đảng viên") */
  coQuyen(ma) { return (this.laQuanTri() && !this.thanhVien(ma)) || (chucVu() !== 'cho_duyet' && S.quyen.has(ma)); },
  coMotQuyen(ds) { return ds.some(ma => this.coQuyen(ma)); },
  /** Người uid có quyền ma không (theo quyền đã tick; Quản trị có mọi quyền trừ quyền "thành viên") */
  nguoiCoQuyen(uid, ma) {
    const u = S.ndMap.get(uid); if (!u || u.chuc_vu === 'cho_duyet') return false;
    return (u.chuc_vu === 'quan_tri' && !this.thanhVien(ma)) || !!S.ndQuyen.get(uid)?.has(ma);
  },
  /** Có quyền nào cần xem danh sách lớp / học sinh không */
  xemHocSinh() { return this.laQuanTri() || S.dsQuyen.some(q => q.xem_hoc_sinh && S.quyen.has(q.ma)); },
  /** Giá trị cấu hình (Quản trị → Cấu hình) */
  cauHinh(khoa, macDinh) { const v = S.cauHinh.get(khoa); return v === undefined || v === null || v === '' ? macDinh : v; },
  /** Phân hệ có mã moDun đã được cài (đã chạy file SQL) chưa */
  daCai(ma) { return !ma || [].concat(ma).every(m => S.moDun.has(m)); },

  trangDuoc(id) {
    const t = this.trang.find(x => x.id === id); if (!t) return null;
    const ph = this.phanHe.find(p => p.id === t.phanHe);
    if (!ph || !this.daCai(ph.moDun)) return null;
    const ok = typeof t.quyen === 'function' ? t.quyen() : !t.quyen?.length || this.coMotQuyen(t.quyen);
    return ok ? t : null;
  },
  trangCua(phId) { return this.trang.filter(t => t.phanHe === phId && this.trangDuoc(t.id)).sort((a, b) => a.thuTu - b.thuTu); },
  phanHeDuoc() { return this.phanHe.filter(p => this.trangCua(p.id).length).sort((a, b) => a.thuTu - b.thuTu); },
  trangHienTai() { return this.trang.find(t => t.id === location.hash.slice(1)) || null; },
  /** Chuyển tới trang: App.di('vp-xu-ly') */
  di(id) { location.hash = '#' + id; },
  /** Tải lại dữ liệu dùng chung (sau khi sửa lớp, học sinh, danh mục…) */
  lamMoi: () => taiDanhMuc(),

  /** Cập nhật các chấm đỏ (số việc cần làm) trên menu và trên ô phân hệ */
  async capNhatHuyHieu() {
    const ds = this.phanHeDuoc().flatMap(p => this.trangCua(p.id)).filter(t => t.huyHieu);
    await Promise.all(ds.map(async t => { try { this._huyHieu.set(t.id, +(await t.huyHieu()) || 0); } catch { /* bỏ qua */ } }));
    const hien = n => n ? (n > 99 ? '99+' : String(n)) : '';
    $$('[data-hh-trang]').forEach(b => (b.textContent = hien(this._huyHieu.get(b.dataset.hhTrang))));
    $$('[data-hh-ph]').forEach(b => (b.textContent = hien(this.trangCua(b.dataset.hhPh).reduce((s, t) => s + (this._huyHieu.get(t.id) || 0), 0))));
  }
};

/* ---------------- Khởi động & đăng nhập ---------------- */
/** Chân trang tác giả: lấy từ config.js; bỏ trống TAC_GIA thì ẩn */
function veTacGia() {
  const o = $('#tac-gia'); if (!o) return;
  const ten = String(CFG.TAC_GIA || '').trim();
  if (!ten) { o.classList.add('hidden'); return; }
  const sdt = String(CFG.TAC_GIA_SDT || '').trim(), dv = String(CFG.TAC_GIA_DON_VI || '').trim();
  o.innerHTML = [`Tác giả: <b>${esc(ten)}</b>`,
    sdt && `SĐT: <a href="tel:${esc(sdt.replace(/[^\d+]/g, ''))}">${esc(sdt)}</a>`,
    dv && esc(dv)].filter(Boolean).join(' · ');
  o.classList.remove('hidden');
}

/** Logo trường: lấy từ config.js (LOGO). Ảnh lỗi hoặc để trống thì giữ biểu tượng ✓ mặc định. */
function apDungLogo() {
  const url = String(CFG.LOGO || '').trim();
  if (!url || !/^(https:\/\/|[\w.\-\/]+$)/i.test(url)) return;   // chỉ nhận đường dẫn trong trang hoặc https://
  const img = new Image();
  img.onload = () => {
    $('#favicon')?.setAttribute('href', url);
    let apple = document.querySelector('link[rel="apple-touch-icon"]');
    if (!apple) { apple = document.createElement('link'); apple.rel = 'apple-touch-icon'; document.head.appendChild(apple); }
    apple.href = url;
    const lg = $('#logo-dang-nhap');
    if (lg) { lg.textContent = ''; lg.classList.add('co-anh'); const i = new Image(); i.src = url; i.alt = 'Logo'; lg.appendChild(i); }
    const nho = $('#logo-nho');
    if (nho) { nho.src = url; nho.classList.remove('hidden'); }
  };
  img.onerror = () => console.warn('Không tải được logo:', url, '– kiểm tra lại LOGO trong js/config.js');
  img.src = url;
}

async function khoiDong() {
  veTacGia();
  apDungLogo();
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
  const tuLinkDatLaiMK = tham.get('type') === 'recovery';

  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
  });
  document.title = CFG.TEN_TRUONG ? `${tenUngDung()} – ${CFG.TEN_TRUONG}` : tenUngDung();
  $$('.ten-ung-dung').forEach(x => (x.textContent = tenUngDung()));
  $('#ten-truong').textContent = CFG.TEN_TRUONG || '';
  $('#ten-truong-login').textContent = CFG.TEN_TRUONG || '';

  ganDangNhap();
  ganDatMK();
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') hienDangNhap(); });
  const { data: { session } } = await sb.auth.getSession();

  if (loiLink || tuLinkXacNhan || tuLinkDatLaiMK) history.replaceState(null, '', location.pathname);
  if (session && tuLinkDatLaiMK) {
    hienDatMK(session.user);
  } else if (session) {
    await vaoApp(session.user);
    if (tuLinkXacNhan) toast('Đã xác nhận email thành công.');
  } else {
    hienDangNhap();
    if (loiLink) {
      $('#login-err').textContent = /expired|invalid|otp/i.test(loiLink)
        ? 'Liên kết đã hết hạn hoặc đã được dùng. Hãy thử đăng nhập; nếu quên mật khẩu, bấm “Quên mật khẩu?” để nhận liên kết mới.'
        : 'Không mở được liên kết: ' + loiLink;
    } else if (tuLinkXacNhan) {
      $('#login-ok').textContent = 'Đã xác nhận email. Vui lòng đăng nhập.';
      $('#login-ok').classList.remove('hidden');
    }
  }
}

function hienDangNhap() {
  try { sessionStorage.removeItem('phan_he'); } catch { /* bỏ qua */ }   // lần đăng nhập sau: hiện màn hình chọn phân hệ
  S.phanHe = null;
  $('#khung').classList.add('hidden');
  $('#man-dat-mk').classList.add('hidden');
  $('#man-dang-nhap').classList.remove('hidden');
}

/* ---------------- Đặt lại mật khẩu (từ email "Quên mật khẩu") ---------------- */
function hienDatMK(user) {
  $('#khung').classList.add('hidden');
  $('#man-dang-nhap').classList.add('hidden');
  $('#man-dat-mk').classList.remove('hidden');
  $('#dat-mk-email').textContent = user?.email || '';
  $('#dat-mk-err').textContent = '';
  $('#f-dat-mk').reset();
  $('#f-dat-mk [name=moi]').focus();
}
function ganDatMK() {
  $('#f-dat-mk').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, moi = f.moi.value, lai = f.lai.value;
    $('#dat-mk-err').textContent = '';
    if (moi.length < MK_TOI_THIEU) { $('#dat-mk-err').textContent = `Mật khẩu cần ít nhất ${MK_TOI_THIEU} ký tự.`; return; }
    if (moi !== lai) { $('#dat-mk-err').textContent = 'Hai lần nhập mật khẩu không khớp.'; return; }
    const btn = $('#btn-dat-mk'); btn.disabled = true;
    const { data, error } = await sb.auth.updateUser({ password: moi });
    btn.disabled = false;
    if (error) { $('#dat-mk-err').textContent = dichLoi(error); return; }
    $('#man-dat-mk').classList.add('hidden');
    await vaoApp(data.user);
    toast('Đã đặt mật khẩu mới.');
  };
  $('#lnk-huy-dat-mk').onclick = async e => { e.preventDefault(); await sb.auth.signOut({ scope: 'local' }); hienDangNhap(); };
}

/* ---------------- Đổi mật khẩu (khi đã đăng nhập) ---------------- */
function moDoiMK() {
  moModal(`<h2>Đổi mật khẩu</h2>
    <p class="muted small">${esc(S.user?.email || '')}</p>
    <form id="f-doi-mk" autocomplete="off">
      <input type="email" name="email" value="${esc(S.user?.email || '')}" autocomplete="username" hidden>
      <label class="lbl">Mật khẩu hiện tại<input class="input" type="password" name="cu" required autocomplete="current-password"></label>
      <label class="lbl">Mật khẩu mới<input class="input" type="password" name="moi" required minlength="${MK_TOI_THIEU}" autocomplete="new-password"></label>
      <label class="lbl">Nhập lại mật khẩu mới<input class="input" type="password" name="lai" required minlength="${MK_TOI_THIEU}" autocomplete="new-password"></label>
      <p class="muted small">Ít nhất ${MK_TOI_THIEU} ký tự, nên có cả chữ và số.</p>
      <label class="switch"><input type="checkbox" name="khac" checked> Đăng xuất khỏi các thiết bị khác</label>
      <p class="err small" id="doi-mk-err"></p>
      <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Hủy</button><button class="btn primary" id="doi-mk-luu">Đổi mật khẩu</button></div>
    </form>`);
  $('#f-doi-mk [name=cu]').focus();
  $('#f-doi-mk').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, err = $('#doi-mk-err');
    err.textContent = '';
    if (f.moi.value.length < MK_TOI_THIEU) { err.textContent = `Mật khẩu mới cần ít nhất ${MK_TOI_THIEU} ký tự.`; return; }
    if (f.moi.value !== f.lai.value) { err.textContent = 'Hai lần nhập mật khẩu mới không khớp.'; return; }
    if (f.moi.value === f.cu.value) { err.textContent = 'Mật khẩu mới phải khác mật khẩu cũ.'; return; }
    const btn = $('#doi-mk-luu'); btn.disabled = true; btn.textContent = 'Đang lưu…';
    try {
      // Kiểm tra mật khẩu hiện tại bằng một phiên tạm, không ảnh hưởng phiên đang dùng
      const kt = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'kiem-tra-mat-khau' }
      });
      const { error: e1 } = await kt.auth.signInWithPassword({ email: S.user.email, password: f.cu.value });
      if (e1) throw new Error(/Invalid login credentials/i.test(e1.message) ? 'Mật khẩu hiện tại không đúng.' : dichLoi(e1));
      await kt.auth.signOut({ scope: 'local' });
      const { error: e2 } = await sb.auth.updateUser({ password: f.moi.value });
      if (e2) throw e2;
      if (f.khac.checked) await sb.auth.signOut({ scope: 'others' });
      dongModal();
      toast('Đã đổi mật khẩu.');
    } catch (ex) {
      if ($('#doi-mk-err')) { err.textContent = dichLoi(ex); btn.disabled = false; btn.textContent = 'Đổi mật khẩu'; }
    }
  };
}

const guiLinkDatLaiMK = email => sb.auth.resetPasswordForEmail(email, { redirectTo: trangChu() });

function ganDangNhap() {
  let cheDo = 'dang_nhap';   // 'dang_nhap' | 'dang_ky' | 'quen'
  const datCheDo = cd => {
    cheDo = cd;
    const f = $('#f-dang-nhap'), pw = f.pw;
    $('.dk').classList.toggle('hidden', cd !== 'dang_ky');
    $('#o-mk').classList.toggle('hidden', cd === 'quen');
    pw.required = cd !== 'quen';
    pw.minLength = cd === 'dang_ky' ? MK_TOI_THIEU : 6;
    pw.autocomplete = cd === 'dang_ky' ? 'new-password' : 'current-password';
    $('#btn-login').textContent = { dang_nhap: 'Đăng nhập', dang_ky: 'Đăng ký', quen: 'Gửi liên kết đặt lại mật khẩu' }[cd];
    $('#lnk-dk').textContent = cd === 'dang_nhap' ? 'Chưa có tài khoản? Đăng ký' : 'Quay lại đăng nhập';
    $('#lnk-quen').classList.toggle('hidden', cd !== 'dang_nhap');
    $('#login-err').textContent = '';
    $('#login-ok').classList.add('hidden');
    (cd === 'dang_ky' ? f.ten : f.email).focus();
  };
  $('#lnk-dk').onclick = e => { e.preventDefault(); datCheDo(cheDo === 'dang_nhap' ? 'dang_ky' : 'dang_nhap'); };
  $('#lnk-quen').onclick = e => { e.preventDefault(); datCheDo('quen'); };
  $('#f-dang-nhap').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, email = f.email.value.trim(), password = f.pw.value;
    $('#login-err').textContent = '';
    $('#login-ok').classList.add('hidden');
    $('#btn-login').disabled = true;
    try {
      if (cheDo === 'quen') {
        const { error } = await guiLinkDatLaiMK(email);
        if (error) throw error;
        $('#login-ok').textContent = 'Nếu email này đã đăng ký, một liên kết đặt lại mật khẩu đã được gửi tới. Hãy kiểm tra cả thư mục Spam (Thư rác).';
        $('#login-ok').classList.remove('hidden');
        return;
      }
      if (cheDo === 'dang_ky') {
        if (password.length < MK_TOI_THIEU) throw new Error(`Mật khẩu cần ít nhất ${MK_TOI_THIEU} ký tự.`);
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: {
            // Liên kết trong email xác nhận trỏ về đúng trang này (không phải localhost)
            emailRedirectTo: trangChu(),
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
  $('#btn-doi-mk').onclick = moDoiMK;
  $('#btn-chup').onclick = e => chupTrang(e.currentTarget);
  $('#btn-in').onclick = inTrang;
  $('#btn-dang-xuat').onclick = async () => { await sb.auth.signOut(); history.replaceState(null, '', location.pathname); hienDangNhap(); };
}

async function vaoApp(user) {
  S.user = user;
  const { data, error } = await sb.from('nguoi_dung').select('*').eq('id', user.id).maybeSingle();
  if (error) {
    toast(/nguoi_dung|does not exist|schema cache/i.test(error.message) ? 'Chưa cài cơ sở dữ liệu: hãy chạy file supabase/00-nen-tang.sql.' : dichLoi(error), 'err');
    return;
  }
  S.profile = data || { chuc_vu: 'cho_duyet' };
  $('#man-dang-nhap').classList.add('hidden');
  $('#man-dat-mk').classList.add('hidden');
  $('#khung').classList.remove('hidden');
  veTenNguoiDung();

  if (chucVu() === 'cho_duyet') {
    $('#nav').innerHTML = '';
    $('#ten-phan-he').textContent = tenUngDung();
    $('#noi-dung').innerHTML = `<section class="card empty-state"><h2>Tài khoản đang chờ duyệt</h2>
      <p>Tài khoản <b>${esc(user.email)}</b> đã được tạo. Vui lòng báo Quản trị viên cấp quyền, sau đó tải lại trang.</p>
      <button class="btn primary" onclick="location.reload()">Tải lại</button></section>`;
    return;
  }
  try { await taiDanhMuc(); } catch (e) { toast(dichLoi(e), 'err'); }
  // Mở phần mềm (đăng nhập) → màn hình chọn phân hệ. Tải lại trang (F5) hoặc mở đường dẫn tới một trang cụ thể thì giữ trang đó.
  let daChon = null; try { daChon = sessionStorage.getItem('phan_he'); } catch { /* bỏ qua */ }
  if (!daChon && !App.trangDuoc(location.hash.slice(1))) history.replaceState(null, '', '#trangchu');
  window.onhashchange = dieuHuong;
  dieuHuong();
}
const veTenNguoiDung = () => ($('#ten-user').innerHTML = `${esc(S.profile.ho_ten || S.user.email)} <span class="role">${CHUC_VU[chucVu()] || ''}</span>`);

/** Tải dữ liệu dùng chung + dữ liệu riêng của các phân hệ */
async function taiDanhMuc() {
  const [dsQuyen, nd, ndq, ch, md] = await Promise.all([
    layHet(() => sb.from('quyen').select('*').order('phan_he').order('thu_tu')),
    layHet(() => sb.from('nguoi_dung').select('*').order('id')),
    layHet(() => sb.from('nguoi_dung_quyen').select('*').order('nguoi_dung_id')),
    layHet(() => sb.from('cau_hinh').select('*').order('khoa')),
    layHet(() => sb.from('mo_dun').select('*').order('ma'))
  ]);
  S.dsQuyen = dsQuyen;
  S.nd = nd; S.ndMap = new Map(nd.map(u => [u.id, u]));
  S.ndQuyen = new Map();
  ndq.forEach(r => { if (!S.ndQuyen.has(r.nguoi_dung_id)) S.ndQuyen.set(r.nguoi_dung_id, new Set()); S.ndQuyen.get(r.nguoi_dung_id).add(r.quyen); });
  S.quyen = S.ndQuyen.get(S.user.id) || new Set();
  S.cauHinh = new Map(ch.map(r => [r.khoa, r.gia_tri]));
  S.cauHinhDS = ch;
  S.moDun = new Map(md.map(r => [r.ma, r]));
  const toi = S.ndMap.get(S.user.id);
  if (toi) { Object.assign(S.profile, toi); veTenNguoiDung(); }

  if (App.xemHocSinh()) {
    const [dt, lop, hs] = await Promise.all([
      layHet(() => sb.from('diem_truong').select('*').order('thu_tu').order('id')),
      layHet(() => sb.from('lop').select('*').order('id')),
      layHet(() => sb.from('hoc_sinh').select('id,ho_ten,lop_id,dang_hoc').order('id'))
    ]);
    lop.sort((a, b) => (a.khoi ?? 99) - (b.khoi ?? 99) || a.ten_lop.localeCompare(b.ten_lop, 'vi', { numeric: true }));
    hs.sort(soSanhTen);
    S.dt = dt; S.lop = lop; S.hs = hs;
  } else { S.dt = []; S.lop = []; S.hs = []; }
  S.dtMap = new Map(S.dt.map(d => [d.id, d]));
  S.lopMap = new Map(S.lop.map(l => [l.id, l]));
  S.hsMap = new Map(S.hs.map(h => [h.id, h]));
  S.stt = new Map();
  const dem = {};
  for (const h of S.hs) {
    if (!h.dang_hoc) continue;
    dem[h.lop_id] = (dem[h.lop_id] || 0) + 1;
    S.stt.set(h.id, dem[h.lop_id]);
  }
  // Dữ liệu riêng của từng phân hệ (phân hệ chưa cài SQL thì bỏ qua, không làm hỏng trang)
  await Promise.all(App._taiDuLieu.map(fn => Promise.resolve().then(fn).catch(e => console.warn('Tải dữ liệu phân hệ:', e.message || e))));
}

/* ---------------- Menu, màn hình chọn phân hệ, điều hướng ---------------- */
function dungNav() {
  const ph = App.phanHe.find(p => p.id === S.phanHe);
  const nhieu = App.phanHeDuoc().length > 1;
  $('#ten-phan-he').textContent = ph ? ph.ten : tenUngDung();
  if (!ph) { $('#nav').innerHTML = ''; return; }
  $('#nav').innerHTML = (nhieu ? `<a href="#trangchu" data-v="trangchu" class="nav-phan-he" title="Chọn phân hệ khác">${ICON.phanhe}<span>Phân hệ</span></a>` : '')
    + App.trangCua(ph.id).map(t => `<a href="#${t.id}" data-v="${t.id}">${ICON[t.icon] || ICON.trang}<span>${esc(t.ten)}</span>${t.huyHieu ? `<span class="badge" data-hh-trang="${t.id}"></span>` : ''}</a>`).join('');
}

/** Màn hình chọn phân hệ */
function veTrangChu(el) {
  const ds = App.phanHeDuoc();
  const gio = gioVN(Date.now()), chao = gio < 11 ? 'Chào buổi sáng' : gio < 14 ? 'Chào buổi trưa' : gio < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const chuaCai = App.laQuanTri() ? App.phanHe.filter(p => !App.daCai(p.moDun)) : [];
  el.innerHTML = `<section class="chon-ph">
    <h1>${chao}, ${esc(tenRieng(S.profile?.ho_ten || '') || '')}!</h1>
    <p class="muted">Chọn phân hệ để làm việc. Có thể đổi phân hệ bất cứ lúc nào bằng nút <b>Phân hệ</b> trên thanh menu.</p>
    <div class="o-ph-luoi">${ds.map(p => `<a href="#${App.trangCua(p.id)[0].id}" class="o-ph" data-ph="${p.id}" style="--mau:${p.mau || '#0f5f78'}">
      <span class="o-ph-icon">${ICON[p.icon] || ICON.trang}</span>
      <span class="o-ph-chu"><b>${esc(p.ten)}</b><small>${esc(p.mo || '')}</small></span>
      <span class="badge" data-hh-ph="${p.id}"></span></a>`).join('')}</div>
    ${chuaCai.length ? `<p class="muted small chua-cai">Phân hệ chưa cài cơ sở dữ liệu: ${chuaCai.map(p => `<b>${esc(p.ten)}</b>`).join(', ')}. Chạy file SQL tương ứng trong thư mục <code>supabase/</code> rồi tải lại trang.</p>` : ''}
  </section>`;
  el.onclick = e => { const a = e.target.closest('[data-ph]'); if (a) S.phanHe = a.dataset.ph; };   // chọn đúng phân hệ (kể cả khi trùng trang)
}

function dieuHuong() {
  phienTrang++;
  const dsPH = App.phanHeDuoc();
  if (!dsPH.length) {
    $('#nav').innerHTML = '';
    $('#noi-dung').innerHTML = `<section class="card empty-state"><h2>Chưa có chức năng nào</h2>
      <p>Tài khoản <b>${esc(CHUC_VU[chucVu()] || '')}</b> của bạn chưa được giao quyền nào. Vui lòng báo Quản trị viên.</p></section>`;
    return;
  }
  const dau = ph => App.trangCua(ph.id)[0].id;
  let v = location.hash.slice(1);
  // Chỉ có một phân hệ thì vào thẳng, không cần màn hình chọn
  if ((v === 'trangchu' || !v) && dsPH.length === 1) v = dau(dsPH[0]);
  if (v !== 'trangchu' && !App.trangDuoc(v)) v = dsPH.length > 1 ? 'trangchu' : dau(dsPH[0]);
  if (location.hash.slice(1) !== v) history.replaceState(null, '', '#' + v);
  const cu = S.phanHe;
  S.phanHe = v === 'trangchu' ? null : App.trangDuoc(v).phanHe;
  if (S.phanHe) { try { sessionStorage.setItem('phan_he', S.phanHe); } catch { /* bỏ qua */ } }
  if (cu !== S.phanHe || !$('#nav').children.length) dungNav();
  if (!S.phanHe) $('#ten-phan-he').textContent = tenUngDung();
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.v === v));
  huyChart();
  const el = $('#noi-dung');
  el.onclick = el.oninput = el.onchange = el.onkeydown = el.onsubmit = null;
  window.scrollTo(0, 0);
  const conSong = giuPhien();
  const ve = v === 'trangchu' ? veTrangChu : App.trangDuoc(v).ve;
  Promise.resolve().then(() => ve(el)).catch(e => { console.error(e); if (conSong()) toast(dichLoi(e), 'err'); });
  App.capNhatHuyHieu();
}
function huyChart() { S.charts.forEach(c => c.destroy()); S.charts = []; }
