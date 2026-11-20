'use strict';
/* =====================================================================
   NỀN TẢNG – TIỆN ÍCH DÙNG CHUNG
   Hàm nhỏ dùng ở mọi phân hệ: chọn phần tử, ngày giờ Việt Nam, định dạng số,
   chuẩn hóa tên, thông báo (toast), hộp thoại (modal), xuất CSV, đọc hết dữ liệu.
   ===================================================================== */
/** Địa chỉ trang (dùng cho liên kết trong email) */
const trangChu = () => location.origin + location.pathname;

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

const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } }
};

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
  const cho = m.match(/after (\d+) seconds?/i);
  if (cho) return `Vui lòng đợi ${cho[1]} giây rồi thử lại.`;
  if (/should be different from the old password/i.test(m)) return 'Mật khẩu mới phải khác mật khẩu cũ.';
  if (/Password should be at least/i.test(m)) return 'Mật khẩu quá ngắn.';
  if (/weak|pwned|known to be/i.test(m)) return 'Mật khẩu quá yếu hoặc quá phổ biến. Hãy chọn mật khẩu khác.';
  if (/reauthentication|reauthenticate/i.test(m)) return 'Cần đăng nhập lại trước khi đổi mật khẩu.';
  if (/Auth session missing|session.*expired|JWT expired/i.test(m)) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
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

/** Hộp thoại: moModal(html, rộng?) / dongModal(). Nút có data-dong sẽ đóng hộp thoại. */
function moModal(html, rong = false) {
  $('#modal-body').onclick = null;
  $('#modal-body').innerHTML = html;
  $('.modal-box').classList.toggle('rong', rong);
  $('#modal').classList.remove('hidden');
}
function dongModal() {
  $('#modal').classList.add('hidden'); $('#modal-body').innerHTML = '';
  if (S.choModal) { const f = S.choModal; S.choModal = null; f('huy'); }   // hộp hỏi đang chờ → coi như Hủy
}

const ic = p => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

/** Mã chống chạy trùng: dữ liệu tải về muộn của trang cũ (bấm chuyển trang nhanh) bị bỏ qua.
    Dùng: const conSong = giuPhien(); … await …; if (!conSong()) return; */
let phienTrang = 0;
const giuPhien = () => { const p = phienTrang; return () => p === phienTrang; };
