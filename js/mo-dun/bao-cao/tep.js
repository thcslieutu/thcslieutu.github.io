'use strict';
/* =====================================================================
   PHÂN HỆ BÁO CÁO – TỆP MINH CHỨNG
   Nén ảnh, nhận PDF / Word / Excel / PowerPoint, xem ảnh cỡ lớn, mở tệp,
   tải minh chứng về máy (mỗi người một file .zip mang tên người đó).
   Kho lưu trữ riêng tư: "minh-chung" (supabase/30-bao-cao.sql)
   ===================================================================== */

const KHO_MC = 'minh-chung';
const linkAnToan = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
const loiChuaCaiBC = e => /bc_dot|bc_nop|bc_ds_giao|bc_dot_cua_toi|minh-chung|Bucket not found|does not exist|schema cache|Could not find the function/i.test(e?.message || '');
const MSG_CHUA_CAI_BC = 'Chưa cài phân hệ Báo cáo: hãy chạy file supabase/30-bao-cao.sql trên Supabase.';

/* ---------- Tệp minh chứng: ảnh (nén trên máy) hoặc PDF, Word, Excel, PowerPoint ---------- */
const MC_TOI_DA = 3;                        // tối đa 3 tệp mỗi đợt
const MC_DUNG_LUONG = 5 * 1024 * 1024;      // tệp không phải ảnh: tối đa 5 MB (khớp kho "minh-chung" trong SQL)
const MC_LOAI_TEP = {                       // đuôi tệp → kiểu tệp (khớp danh sách cho phép trong supabase/30-bao-cao.sql)
  pdf: 'application/pdf',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};
const MC_CHAP_NHAN = 'image/*,' + Object.keys(MC_LOAI_TEP).map(d => '.' + d).join(',');
const duoiTep = ten => (String(ten).match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
/** Đường dẫn trong kho là ảnh (hiện ngay, xem lớn) hay tệp (bấm để mở / tải về) */
const laAnhMC = p => /\.(jpe?g|png|webp)$/i.test(p);
/** Tên hiển thị của tệp: phần sau "__" trong đường dẫn (vd …/1712345abc__Bao-cao.pdf → Bao-cao.pdf) */
const tenTepMC = p => { const t = String(p).split('/').pop(); return t.includes('__') ? t.slice(t.indexOf('__') + 2) : t; };
/** Tên tệp an toàn cho kho lưu trữ: bỏ dấu, chỉ giữ chữ, số, gạch ngang */
const tenAnToan = ten => String(ten).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'tep';
const oTepMC = p => `<a class="mc-tep" data-mc-tep="${esc(p)}" target="_blank" rel="noopener" title="Bấm để mở / tải về">
  <span class="mc-tep-loai mc-tep-${duoiTep(p)}">${esc(duoiTep(p).toUpperCase() || 'TỆP')}</span><span class="mc-tep-ten">${esc(tenTepMC(p))}</span></a>`;

/** Nén ảnh trên máy: cạnh dài tối đa 1600px, JPEG ~350 KB */
async function nenAnh(file, maxCanh = 1600, toiDa = 350e3) {
  let nguon, url;
  try { nguon = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    url = URL.createObjectURL(file);
    nguon = await new Promise((ok, loi) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => loi(new Error('Không đọc được ảnh này (định dạng không hỗ trợ).')); i.src = url; });
  }
  const w0 = nguon.naturalWidth || nguon.width, h0 = nguon.naturalHeight || nguon.height;
  const tl = Math.min(1, maxCanh / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.round(w0 * tl); c.height = Math.round(h0 * tl);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(nguon, 0, 0, c.width, c.height);
  if (url) URL.revokeObjectURL(url);
  let q = 0.82, blob;
  do { blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); q -= 0.1; } while (blob && blob.size > toiDa && q > 0.35);
  if (!blob) throw new Error('Không nén được ảnh.');
  return blob;
}

/** Đường dẫn tạm (1 giờ) để xem ảnh riêng tư */
const URL_MC = new Map();
async function urlAnh(paths) {
  const can = [...new Set(paths)].filter(p => !(URL_MC.get(p)?.het > Date.now()));
  for (let i = 0; i < can.length; i += 100) {
    const { data, error } = await sb.storage.from(KHO_MC).createSignedUrls(can.slice(i, i + 100), 3600);
    if (!error) data.forEach(d => d.signedUrl && URL_MC.set(d.path, { url: d.signedUrl, het: Date.now() + 50 * 60e3 }));
  }
  return paths.map(p => URL_MC.get(p)?.url || '');
}
/** Gắn đường dẫn tạm vào các <img data-mc> (ảnh) và <a data-mc-tep> (tệp) trong vùng goc */
async function ganAnhMC(goc) {
  const imgs = $$('img[data-mc]', goc), teps = $$('a[data-mc-tep]', goc);
  if (!imgs.length && !teps.length) return;
  const urls = await urlAnh([...imgs.map(i => i.dataset.mc), ...teps.map(a => a.dataset.mcTep)]);
  imgs.forEach((i, k) => { if (urls[k]) i.src = urls[k]; else i.alt = 'Không tải được ảnh'; });
  teps.forEach((a, k) => { const u = urls[imgs.length + k]; if (u) a.href = u; else a.classList.add('loi'); });
}
/** Xem ảnh cỡ lớn, chuyển ảnh trước / sau (nút ‹ ›, phím ← →, vuốt trên điện thoại).
    ds: [{ p: đường dẫn, t: tiêu đề }], i: ảnh mở đầu tiên */
function xemAnhMC(ds, i = 0) {
  if (!ds.length) return;
  moModal(`<div class="mc-xem-lon" id="mc-xem-lon">
      <div class="head-row"><h2 id="mcx-td" style="margin:0"></h2><span class="muted small" id="mcx-so"></span></div>
      <div class="mcx-khung"><button type="button" class="mcx-nut" id="mcx-truoc" aria-label="Ảnh trước">‹</button>
        <img id="mcx-anh" alt="Ảnh minh chứng"><button type="button" class="mcx-nut" id="mcx-sau" aria-label="Ảnh sau">›</button></div>
      <div class="modal-actions"><a class="btn sm" id="mcx-goc" target="_blank" rel="noopener">Mở ảnh gốc ↗</a><span class="sp"></span><button type="button" class="btn" data-dong>Đóng</button></div></div>`, true);
  const ve = async () => {
    i = (i + ds.length) % ds.length;
    const a = ds[i], k = i;
    $('#mcx-td').textContent = a.t || 'Ảnh minh chứng';
    $('#mcx-so').textContent = ds.length > 1 ? `Ảnh ${i + 1} / ${ds.length}` : '';
    $('#mcx-truoc').classList.toggle('hidden', ds.length < 2); $('#mcx-sau').classList.toggle('hidden', ds.length < 2);
    const img = $('#mcx-anh'); img.removeAttribute('src');
    const [url] = await urlAnh([a.p]);
    if (k !== i || !$('#mcx-anh')) return;
    if (url) { img.src = url; $('#mcx-goc').href = url; } else img.alt = 'Không tải được ảnh';
    urlAnh(ds.slice(i + 1, i + 6).map(x => x.p));   // chuẩn bị sẵn vài ảnh kế tiếp
  };
  $('#mcx-truoc').onclick = () => { i--; ve(); };
  $('#mcx-sau').onclick = () => { i++; ve(); };
  const phim = e => {
    if (!$('#mc-xem-lon')) { document.removeEventListener('keydown', phim); return; }
    if (e.key === 'ArrowLeft') { i--; ve(); } else if (e.key === 'ArrowRight') { i++; ve(); }
  };
  document.addEventListener('keydown', phim);
  let x0 = null;
  const k = $('.mcx-khung');
  k.addEventListener('touchstart', e => (x0 = e.touches[0].clientX), { passive: true });
  k.addEventListener('touchend', e => { if (x0 == null) return; const d = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(d) > 50) { i += d < 0 ? 1 : -1; ve(); } });
  ve();
}
/** Minh chứng hiện ngay trên trang: ảnh (bấm để xem lớn, lướt qua mọi ảnh trong vùng) và tệp (bấm để mở / tải về) */
const oAnhNho = (paths, tieuDe, lon = false) => {
  const anh = (paths || []).filter(laAnhMC), tep = (paths || []).filter(p => !laAnhMC(p));
  return (anh.length ? oAnhLuoi(anh, tieuDe, lon) : '') + (tep.length ? `<div class="mc-tep-ds">${tep.map(oTepMC).join('')}</div>` : '');
};
const oAnhLuoi = (paths, tieuDe, lon) => `<div class="mc-nho ${lon ? 'lon' : ''}">${paths.map(p => `<button type="button" data-mc-xem title="Bấm để xem lớn"><img data-mc="${esc(p)}" data-tieu-de="${esc(tieuDe || '')}" alt="Ảnh minh chứng" loading="lazy"></button>`).join('')}</div>`;
/** Bấm vào một ảnh: mở trình xem với mọi ảnh trong vùng goc */
function moAnhTrongVung(nut, goc) {
  const imgs = $$('[data-mc-xem] img', goc);
  xemAnhMC(imgs.map(m => ({ p: m.dataset.mc, t: m.dataset.tieuDe })), Math.max(0, imgs.indexOf($('img', nut))));
}

/* ---------- Tải minh chứng về máy: mỗi người một file .zip mang tên người đó ---------- */
let taiJSZip = null;
/** Nạp thư viện nén JSZip khi cần (lần đầu bấm tải) */
function canJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  return taiJSZip || (taiJSZip = new Promise((ok, loi) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = () => (window.JSZip ? ok(window.JSZip) : loi(new Error('Không tải được công cụ nén.')));
    s.onerror = () => { taiJSZip = null; loi(new Error('Không tải được công cụ nén. Kiểm tra kết nối mạng rồi thử lại.')); };
    document.head.appendChild(s);
  }));
}
/** Tên file hợp lệ trên Windows / điện thoại (giữ dấu tiếng Việt, bỏ ký tự cấm) */
const tenFileHopLe = t => String(t || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 80) || 'Khong-ten';
/** Tên người trong danh sách tải (trùng tên thì thêm (2), (3)…) */
function tenNguoiDuyNhat(ds) {
  const dem = new Map();
  return ds.map(x => {
    const goc = tenFileHopLe(x.u.ho_ten || x.u.email), k = goc.toLowerCase(), n = (dem.get(k) || 0) + 1;
    dem.set(k, n);
    return n > 1 ? `${goc} (${n})` : goc;
  });
}
/** Tải các tệp của một bài nộp từ kho, nén thành 1 file .zip (Blob) */
async function nenBaiNop(JSZip, n) {
  const urls = await urlAnh(n.anh);
  const zip = new JSZip(), daDung = new Set();
  for (const [i, p] of n.anh.entries()) {
    if (!urls[i]) throw new Error('Không lấy được đường dẫn tệp.');
    const res = await fetch(urls[i]);
    if (!res.ok) throw new Error(`Không tải được tệp (${res.status}).`);
    let ten = tenFileHopLe(laAnhMC(p) ? `Anh ${i + 1}.jpg` : `${i + 1}. ${tenTepMC(p)}`);
    while (daDung.has(ten.toLowerCase())) ten = '_' + ten;
    daDung.add(ten.toLowerCase());
    zip.file(ten, await res.blob(), { date: new Date(n.sua_luc || n.nop_luc) });
  }
  if (n.ghi_chu) zip.file('Ghi chu.txt', n.ghi_chu);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
function taiBlob(blob, ten) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = ten;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
/** Tải minh chứng của một hoặc nhiều người.
    - Một người: tải thẳng file "<Tên người>.zip".
    - Nhiều người: một file "Minh chứng - <tên đợt>.zip" chứa các file "<Tên người>.zip" (giải nén ra là có từng file của từng người). */
async function taiMinhChung(d, ds, btn) {
  const cu = btn.innerHTML; btn.disabled = true;
  const hien = t => (btn.textContent = t);
  try {
    hien('Đang chuẩn bị…');
    const JSZip = await canJSZip();
    const ten = tenNguoiDuyNhat(ds);
    if (ds.length === 1) {
      hien('Đang tải…');
      taiBlob(await nenBaiNop(JSZip, ds[0].n), `${ten[0]}.zip`);
      toast(`Đã tải minh chứng của ${ds[0].u.ho_ten || ds[0].u.email}.`);
      return;
    }
    const goi = new JSZip(), loi = [];
    for (const [i, x] of ds.entries()) {
      hien(`Đang tải ${i + 1}/${ds.length}…`);
      try { goi.file(`${ten[i]}.zip`, await nenBaiNop(JSZip, x.n)); }
      catch (e) { loi.push(`${x.u.ho_ten || x.u.email}: ${e.message}`); }
    }
    if (loi.length === ds.length) throw new Error(loi[0]);
    if (loi.length) goi.file('KHONG TAI DUOC.txt', 'Các bài nộp không tải được (hãy thử lại):\n' + loi.join('\n'));
    hien('Đang đóng gói…');
    const blob = await goi.generateAsync({ type: 'blob', compression: 'STORE' });   // file con đã nén sẵn
    taiBlob(blob, `Minh chứng - ${tenFileHopLe(d.ten)}.zip`);
    toast(`Đã tải minh chứng của ${ds.length - loi.length} người.` + (loi.length ? ` ${loi.length} người không tải được (xem file KHONG TAI DUOC.txt).` : ''), loi.length ? 'err' : 'ok');
  } catch (e) {
    toast(e.message || 'Không tải được minh chứng.', 'err');
  } finally {
    btn.disabled = false; btn.innerHTML = cu;
  }
}

