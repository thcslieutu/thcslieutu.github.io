'use strict';
/* =====================================================================
   NỀN TẢNG – GIAO DIỆN DÙNG CHUNG
   Chụp trang thành ảnh, in / lưu PDF, khoảng thời gian thống kê, biểu đồ.
   ===================================================================== */

/* ---------- Chụp ảnh trang (PNG) & Lưu PDF / In ---------- */
/** Tên trang đang xem, vd "Vi phạm – Thống kê" (dùng làm tên file ảnh / PDF) */
function tenTrangHienTai() {
  const t = App.trangHienTai();
  if (!t) return 'Trang chủ';
  const ph = App.phanHe.find(p => p.id === t.phanHe);
  return ph && ph.ten !== t.ten ? `${ph.ten} – ${t.ten}` : t.ten;
}
const gioFile = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace(/(\d+)-(\d+)-(\d+)T(\d+):(\d+)/, '$3-$2-$1_$4h$5');
const dauTrang = () => `${CFG.TEN_TRUONG || ''} · ${tenTrangHienTai()} · ${fmtTG(Date.now())}${S.profile?.ho_ten ? ' · ' + S.profile.ho_ten : ''}`;

/** Tải thư viện chụp trang khi cần (lần đầu bấm) */
let taiHtml2canvas = null;
function canHtml2canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  return taiHtml2canvas || (taiHtml2canvas = new Promise((ok, loi) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => (window.html2canvas ? ok(window.html2canvas) : loi(new Error('Không tải được công cụ chụp.')));
    s.onerror = () => { taiHtml2canvas = null; loi(new Error('Không tải được công cụ chụp. Kiểm tra kết nối mạng rồi thử lại.')); };
    document.head.appendChild(s);
  }));
}

/** Chụp toàn bộ nội dung trang (kể cả phần phải cuộn) thành ảnh PNG */
async function chupTrang(btn) {
  const goc = $('#noi-dung'); if (!goc) return;
  const cu = btn.innerHTML; btn.disabled = true; btn.innerHTML = '⏳<span class="nhan-nut"> Đang chụp…</span>';
  try {
    const h2c = await canHtml2canvas();
    const cao = goc.scrollHeight + 60, rong = goc.scrollWidth;
    // Ảnh nét (gấp đôi) nhưng không vượt giới hạn kích thước ảnh của trình duyệt
    const tiLe = Math.max(0.5, Math.min(2, 14000 / cao, 14000 / rong, Math.sqrt(120e6 / (cao * rong))));
    const canvas = await h2c(goc, {
      scale: tiLe, backgroundColor: getComputedStyle(document.body).backgroundColor || '#f3f5f7', useCORS: true, logging: false,
      windowWidth: document.documentElement.clientWidth, width: rong, height: cao, scrollX: 0, scrollY: -window.scrollY,
      ignoreElements: e => e.classList?.contains('khong-chup'),
      onclone: doc => {
        const m = doc.querySelector('#noi-dung');
        doc.querySelectorAll('.sticky-col').forEach(x => (x.style.position = 'static'));
        doc.querySelectorAll('.table-wrap, .hs-grid, .list').forEach(x => { x.style.overflow = 'visible'; x.style.maxHeight = 'none'; });
        const d = doc.createElement('div');
        d.className = 'dau-anh'; d.textContent = dauTrang();
        m.insertBefore(d, m.firstChild);
      }
    });
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('Trang quá dài, không tạo được ảnh. Hãy dùng “PDF / In” hoặc xuất CSV.');
    const ten = boDau(tenTrangHienTai()).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${ten}_${gioFile()}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Đã chụp và tải ảnh về máy.');
  } catch (e) {
    toast(e.message || 'Không chụp được trang.', 'err');
  } finally {
    btn.disabled = false; btn.innerHTML = cu;
  }
}

/** Lưu PDF / In: dùng hộp in của trình duyệt (chọn "Lưu dưới dạng PDF") */
function inTrang() {
  $('#in-dau').textContent = dauTrang();
  const ten = document.title;
  document.title = `${tenTrangHienTai()} – ${vn(homNay())}`;   // tên file PDF gợi ý
  window.addEventListener('afterprint', () => (document.title = ten), { once: true });
  setTimeout(() => window.print(), 50);
}

/* ---------- Thống kê: khoảng thời gian, xu hướng, biểu đồ ---------- */
/** Khoảng thời gian thống kê và kỳ so sánh: p = 'tuan' | 'tuan_truoc' | 'thang' | 'thang_truoc' | '30' | 'hk1' | 'hk2' | 'nam' | 'tuy' */
function khoangTK(p, tuyTu, tuyDen) {
  const t = homNay(), [y, m] = t.split('-').map(Number);
  const nh = m >= 8 ? y : y - 1;   // năm bắt đầu năm học (chỉ dùng cho mốc học kỳ)
  const hk1 = `${nh}-${App.cauHinh('chung.hk1_bat_dau', '09-05')}`, hk2 = `${nh + 1}-${App.cauHinh('chung.hk2_bat_dau', '01-16')}`, kt = `${nh + 1}-${App.cauHinh('chung.nam_hoc_ket_thuc', '05-31')}`;
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

/** Mũi tên tăng/giảm so với kỳ trước (tăng = đỏ, vì vi phạm tăng là xấu) */
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

/** Vẽ biểu đồ Chart.js vào <canvas id=…>; tự hủy khi chuyển trang */
function veChart(id, cfg) {
  if (typeof Chart === 'undefined' || !$('#' + id)) return;
  const c = mau();
  Chart.defaults.color = c.text;
  Chart.defaults.borderColor = c.grid;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  S.charts.push(new Chart($('#' + id), cfg));
}

const thoiGianTB = gio => gio < 1 ? `${Math.round(gio * 60)} phút` : gio < 48 ? `${so(gio)} giờ` : `${so(gio / 24)} ngày`;
