'use strict';
/* =====================================================================
   PHÂN HỆ ĐẢNG VIÊN – KHẢO SÁT & MINH CHỨNG
   Quyền (supabase/30-dang-vien.sql): dv.dang_vien (là đảng viên), dv.quan_ly (quản lý khảo sát)
   ===================================================================== */
const KHO_MC = 'minh-chung';
/** Danh sách đảng viên (tài khoản được tick “Là đảng viên”) */
const ds_DangVien = () => S.nd.filter(u => App.nguoiCoQuyen(u.id, 'dv.dang_vien')).sort((a, b) => String(a.ho_ten || a.email).localeCompare(String(b.ho_ten || b.email), 'vi'));
const linkAnToan = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
const loiChuaCaiDV = e => /ks_dot|ks_nop|minh-chung|Bucket not found|does not exist|schema cache/i.test(e?.message || '');
const MSG_CHUA_CAI = 'Chưa cài phân hệ Đảng viên: hãy chạy file supabase/30-dang-vien.sql trên Supabase.';

/* ---------- Tệp minh chứng: ảnh (nén trên máy) hoặc PDF, Word, Excel, PowerPoint ---------- */
const MC_TOI_DA = 3;                        // tối đa 3 tệp mỗi đợt
const MC_DUNG_LUONG = 5 * 1024 * 1024;      // tệp không phải ảnh: tối đa 5 MB (khớp kho "minh-chung" trong SQL)
const MC_LOAI_TEP = {                       // đuôi tệp → kiểu tệp (khớp danh sách cho phép trong supabase/30-dang-vien.sql)
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

function hanChot(d) {
  if (!d.han_chot) return '<span class="muted">Không có hạn chót</span>';
  const con = new Date(d.han_chot) - Date.now(), ngay = Math.ceil(Math.abs(con) / 864e5);
  const ch = con >= 0 ? (con < 864e5 ? `còn ${Math.max(1, Math.round(con / 36e5))} giờ` : `còn ${ngay} ngày`) : `quá hạn ${ngay} ngày`;
  return `Hạn chót: <b>${fmtTG(d.han_chot)}</b> <span class="${con < 0 ? 'chu-do' : con < 864e5 ? 'chu-cam' : 'muted'}">(${ch})</span>`;
}
const treHan = (d, n) => d.han_chot && n && new Date(n.nop_luc) > new Date(d.han_chot);

/** Đảng viên được giao đợt d (dsGiao: Map dot_id → Set người) */
const nguoiCuaDot = (d, dsGiao) => d.doi_tuong === 'tat_ca' ? ds_DangVien() : ds_DangVien().filter(u => dsGiao.get(d.id)?.has(u.id));

/** Số đợt đang mở mà mình chưa nộp (chấm đỏ trên menu) */
async function demDotChuaNop() {
  if (!App.coQuyen('dv.dang_vien')) return 0;
  const [dots, nop] = await Promise.all([
    sb.from('ks_dot').select('id').eq('dang_mo', true),
    sb.from('ks_nop').select('dot_id').eq('nguoi_dung_id', S.user.id)
  ]);
  if (dots.error || nop.error) return 0;
  const da = new Set(nop.data.map(r => r.dot_id));
  return dots.data.filter(d => !da.has(d.id)).length;
}

/** Vẽ một trang của phân hệ: tab = 'cua_toi' | 'quan_ly' | 'tong_hop' */
async function veDangVien(el, tab) {
  if (S.dvTab !== tab) S.dvDot = null;
  S.dvTab = tab;
  const conSong = giuPhien();
  const tieuDe = { cua_toi: 'Khảo sát của tôi', quan_ly: 'Quản lý đợt khảo sát', tong_hop: 'Tổng hợp theo đảng viên' }[tab];
  el.innerHTML = `<section class="card"><div class="head-row"><h2>${tieuDe}</h2></div>
    <div id="dv-than"><p class="muted pad">Đang tải…</p></div></section>`;
  el.onclick = e => {
    const x = e.target.closest('[data-mc-xem]');
    if (x) { moAnhTrongVung(x, $('#dv-than')); return; }
    if (S.dvClick) S.dvClick(e);
  };
  el.onchange = e => S.dvChange && S.dvChange(e);
  S.dvClick = S.dvChange = null;
  const than = $('#dv-than');
  try {
    if (tab === 'cua_toi') await dvCuaToi(than, conSong);
    else if (tab === 'quan_ly') await (S.dvDot ? dvChiTietDot(than, conSong, S.dvDot) : dvDanhSachDot(than, conSong));
    else if (tab === 'tong_hop') await dvTongHop(than, conSong);
  } catch (e) {
    if (conSong()) than.innerHTML = `<p class="err pad">${esc(loiChuaCaiDV(e) ? MSG_CHUA_CAI : dichLoi(e))}</p>`;
  }
}

/* ---------- Khảo sát của tôi ---------- */
async function dvCuaToi(than, conSong) {
  const [r1, r2] = await Promise.all([
    sb.from('ks_dot').select('*').order('dang_mo', { ascending: false }).order('han_chot', { ascending: true, nullsFirst: false }).order('id', { ascending: false }),
    sb.from('ks_nop').select('*').eq('nguoi_dung_id', S.user.id)
  ]);
  if (r1.error) throw r1.error; if (r2.error) throw r2.error;
  if (!conSong()) return;
  const nop = new Map(r2.data.map(n => [n.dot_id, n]));
  const dots = r1.data;
  const mo = dots.filter(d => d.dang_mo), dong = dots.filter(d => !d.dang_mo);
  const the = d => {
    const n = nop.get(d.id), link = linkAnToan(d.link);
    const tt = n ? `<span class="tt tt-da_xu_ly">Đã nộp${treHan(d, n) ? ' (trễ)' : ''}</span>`
      : !d.dang_mo ? '<span class="tt tt-chua_xu_ly">Không nộp</span>'
      : d.han_chot && new Date(d.han_chot) < Date.now() ? '<span class="tt tt-chua_xu_ly">Quá hạn – chưa nộp</span>' : '<span class="tt tt-dang_xu_ly">Chưa nộp</span>';
    return `<div class="dv-dot ${n ? 'da-nop' : ''}">
      <div class="head-row"><h3>${esc(d.ten)}</h3>${tt}</div>
      <p class="small">${hanChot(d)} · Cần ${d.so_anh} tệp minh chứng (ảnh, PDF, Word…)${d.dang_mo ? '' : ' · <b>Đợt đã đóng</b>'}</p>
      ${d.huong_dan ? `<div class="dv-hd small">${esc(d.huong_dan)}</div>` : ''}
      <div class="row-gap wrap">
        ${link ? `<a class="btn" href="${esc(link)}" target="_blank" rel="noopener">🔗 Mở link khảo sát</a>` : ''}
        ${d.dang_mo ? `<button type="button" class="btn ${n ? '' : 'primary'}" data-nop="${d.id}">${n ? '✏️ Sửa minh chứng' : '📷 Nộp minh chứng'}</button>` : ''}
      </div>
      ${n ? `<div class="dv-da-nop">${n.anh_da_xoa ? '<span class="muted small">Minh chứng đã được lưu trữ.</span>' : oAnhNho(n.anh, d.ten)}
        <span class="small muted">Nộp lúc ${fmtTG(n.nop_luc)}${n.sua_luc ? ` · sửa lúc ${fmtTG(n.sua_luc)}` : ''}${n.ghi_chu ? ` · ${esc(n.ghi_chu)}` : ''}</span></div>` : ''}
    </div>`;
  };
  than.innerHTML = !dots.length ? '<p class="muted pad">Hiện chưa có đợt khảo sát nào được giao cho đồng chí.</p>'
    : `${mo.length ? mo.map(the).join('') : '<p class="muted pad">Không có đợt khảo sát nào đang mở. 🎉</p>'}
       ${dong.length ? `<details class="dv-dong"><summary>Các đợt đã đóng (${dong.length})</summary>${dong.map(the).join('')}</details>` : ''}`;
  ganAnhMC(than);
  S.dvClick = e => {
    const b = e.target.closest('[data-nop]'); if (!b) return;
    const d = dots.find(x => x.id === +b.dataset.nop);
    moNopMC(d, nop.get(d.id), async () => { App.capNhatHuyHieu(); if (conSong()) await dvCuaToi(than, conSong); });
  };
}

/** Hộp nộp / sửa minh chứng: 1–3 tệp (ảnh được nén trên máy; PDF, Word, Excel, PowerPoint tối đa 5 MB) */
function moNopMC(dot, nopCu, xong) {
  let cu = nopCu && !nopCu.anh_da_xoa ? [...nopCu.anh] : [];   // tệp đã nộp giữ lại (đường dẫn trong kho)
  let moi = [];                                                // [{ blob, url, ten, duoi, laAnh }]
  moModal(`<h2>${nopCu ? 'Sửa minh chứng' : 'Nộp minh chứng'}</h2>
    <p class="small"><b>${esc(dot.ten)}</b><br>${hanChot(dot)}</p>
    ${linkAnToan(dot.link) ? `<p class="small"><a href="${esc(linkAnToan(dot.link))}" target="_blank" rel="noopener">🔗 Mở link khảo sát</a> – làm xong, chụp màn hình trang xác nhận (hoặc lưu tệp) rồi tải lên.</p>` : ''}
    <div class="lbl">Minh chứng <span class="muted small" id="mc-dem"></span></div>
    <div class="mc-chon"><div class="mc-xem" id="mc-xem"></div>
      <div class="row-gap wrap" id="mc-nut">
        <label class="btn"><input type="file" id="mc-chup" accept="image/*" capture="environment" hidden>📷 Chụp ảnh</label>
        <label class="btn"><input type="file" id="mc-file" accept="${MC_CHAP_NHAN}" multiple hidden>📎 Chọn ảnh hoặc tệp</label>
      </div></div>
    <p class="muted small">Nhận: ảnh (JPG, PNG…), PDF, Word, Excel, PowerPoint. Tối đa ${MC_TOI_DA} tệp; tệp không phải ảnh tối đa 5 MB.</p>
    <textarea id="mc-gc" class="input" rows="2" placeholder="Ghi chú (không bắt buộc)">${esc(nopCu?.ghi_chu || '')}</textarea>
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Hủy</button>
      <button type="button" class="btn primary" id="mc-nop">${nopCu ? 'Lưu' : 'Nộp'}</button></div>`);
  const oTepNho = (duoi, ten) => `<span class="mc-tep-loai mc-tep-${esc(duoi)}">${esc(duoi.toUpperCase())}</span><small>${esc(ten)}</small>`;
  const ve = () => {
    const tong = cu.length + moi.length;
    $('#mc-xem').innerHTML = cu.map((p, i) => `<div class="mc-thumb ${laAnhMC(p) ? '' : 'mc-thumb-tep'}">${laAnhMC(p) ? `<img data-mc="${esc(p)}" alt="">` : oTepNho(duoiTep(p), tenTepMC(p))}<button type="button" data-bo-cu="${i}" aria-label="Bỏ tệp">×</button></div>`).join('')
      + moi.map((a, i) => `<div class="mc-thumb ${a.laAnh ? '' : 'mc-thumb-tep'}">${a.laAnh ? `<img src="${a.url}" alt="">` : oTepNho(a.duoi, a.ten)}<button type="button" data-bo-moi="${i}" aria-label="Bỏ tệp">×</button></div>`).join('');
    ganAnhMC($('#mc-xem'));
    $('#mc-nut').classList.toggle('hidden', tong >= MC_TOI_DA);
    $('#mc-dem').textContent = `(${tong}/${MC_TOI_DA} – cần ít nhất ${dot.so_anh})`;
    $('#mc-nop').disabled = tong < dot.so_anh;
  };
  const them = async files => {
    const ds = [...files].slice(0, MC_TOI_DA - cu.length - moi.length);
    if (files.length > ds.length) toast(`Mỗi đợt tối đa ${MC_TOI_DA} tệp.`, 'err');
    for (const f of ds) {
      const duoi = duoiTep(f.name);
      if (MC_LOAI_TEP[duoi]) {                                   // PDF, Word, Excel, PowerPoint: tải nguyên tệp
        if (f.size > MC_DUNG_LUONG) { toast(`“${f.name}” lớn hơn 5 MB. Hãy nén hoặc lưu lại nhỏ hơn.`, 'err'); continue; }
        moi.push({ blob: f, ten: f.name, duoi, laAnh: false });
      } else if ((f.type || '').startsWith('image/') || /^(jpe?g|png|webp|gif|bmp|heic|heif)$/.test(duoi)) {
        try { const blob = await nenAnh(f); moi.push({ blob, url: URL.createObjectURL(blob), ten: f.name, duoi: 'jpg', laAnh: true }); }
        catch (e) { toast(e.message || 'Không đọc được ảnh.', 'err'); }
      } else toast(`Không nhận loại tệp “${f.name}”. Chỉ nhận ảnh, PDF, Word, Excel, PowerPoint.`, 'err');
    }
    if ($('#mc-xem')) ve();
  };
  $('#mc-chup').onchange = e => { them(e.target.files); e.target.value = ''; };
  $('#mc-file').onchange = e => { them(e.target.files); e.target.value = ''; };
  $('#modal-body').onclick = e => {
    const a = e.target.closest('[data-bo-cu]'), b = e.target.closest('[data-bo-moi]');
    if (a) { cu.splice(+a.dataset.boCu, 1); ve(); }
    if (b) { const x = moi[+b.dataset.boMoi]; if (x.url) URL.revokeObjectURL(x.url); moi.splice(+b.dataset.boMoi, 1); ve(); }
  };
  $('#mc-nop').onclick = async () => {
    const btn = $('#mc-nop'); btn.disabled = true;
    const daTai = [];
    try {
      for (const [k, a] of moi.entries()) {
        btn.textContent = `Đang tải lên ${k + 1}/${moi.length}…`;
        const ma = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
        const path = a.laAnh ? `${S.user.id}/${dot.id}/${ma}.jpg` : `${S.user.id}/${dot.id}/${ma}__${tenAnToan(a.ten)}.${a.duoi}`;
        const { error } = await sb.storage.from(KHO_MC).upload(path, a.blob, { contentType: a.laAnh ? 'image/jpeg' : MC_LOAI_TEP[a.duoi], upsert: false });
        if (error) throw /mime|type|not allowed|exceed|size|too large|payload/i.test(error.message || '')
          ? new Error(`Máy chủ chưa nhận tệp “${a.ten}”. Quản trị cần chạy lại file supabase/30-dang-vien.sql (bản mới) để cho phép tải PDF, Word, Excel.`) : error;
        daTai.push(path);
      }
      btn.textContent = 'Đang lưu…';
      const row = { anh: [...cu, ...daTai], ghi_chu: $('#mc-gc').value.trim() || null };
      const r = nopCu ? await sb.from('ks_nop').update(row).eq('id', nopCu.id).select('id') : await sb.from('ks_nop').insert({ ...row, dot_id: dot.id }).select('id');
      if (r.error) throw r.error;
      if (!r.data?.length) throw new Error('Đợt khảo sát đã đóng, không sửa được nữa.');
      const boDi = nopCu && !nopCu.anh_da_xoa ? nopCu.anh.filter(p => !cu.includes(p)) : [];
      if (boDi.length) sb.storage.from(KHO_MC).remove(boDi);
    } catch (e) {
      if (daTai.length) sb.storage.from(KHO_MC).remove(daTai);
      toast(loiChuaCaiDV(e) ? MSG_CHUA_CAI : dichLoi(e), 'err');
      btn.disabled = false; btn.textContent = nopCu ? 'Lưu' : 'Nộp'; return;
    }
    moi.forEach(a => a.url && URL.revokeObjectURL(a.url));
    toast(nopCu ? 'Đã lưu minh chứng.' : 'Đã nộp minh chứng. Cảm ơn đồng chí!');
    dongModal(); await xong();
  };
  ve();
}

/* ---------- Quản lý: dữ liệu chung ---------- */
async function layDuLieuQL() {
  const [d, g, n] = await Promise.all([
    sb.from('ks_dot').select('*').order('tao_luc', { ascending: false }),
    sb.from('ks_dot_nguoi').select('*'),
    layHet(() => sb.from('ks_nop').select('id,dot_id,nguoi_dung_id,anh,anh_da_xoa,ghi_chu,nop_luc,sua_luc').order('id'))
  ]);
  if (d.error) throw d.error; if (g.error) throw g.error;
  const dsGiao = new Map();
  g.data.forEach(r => { if (!dsGiao.has(r.dot_id)) dsGiao.set(r.dot_id, new Set()); dsGiao.get(r.dot_id).add(r.nguoi_dung_id); });
  const nopTheoDot = new Map();
  n.forEach(r => { if (!nopTheoDot.has(r.dot_id)) nopTheoDot.set(r.dot_id, new Map()); nopTheoDot.get(r.dot_id).set(r.nguoi_dung_id, r); });
  return { dots: d.data, dsGiao, nopTheoDot };
}
const thanhTienDo = (a, b) => `<div class="tien-do-nho"><div><i style="width:${b ? Math.round(a / b * 100) : 0}%"></i></div><span>${a}/${b}${b ? ` (${Math.round(a / b * 100)}%)` : ''}</span></div>`;

async function dvDanhSachDot(than, conSong) {
  const { dots, dsGiao, nopTheoDot } = await layDuLieuQL();
  if (!conSong()) return;
  const soDV = ds_DangVien().length;
  than.innerHTML = `<div class="head-row"><p class="muted small" style="margin:0">${soDV} đảng viên (tick quyền “Là đảng viên” ở Quản trị → Tài khoản). Bấm tên đợt để xem chi tiết, người chưa nộp, minh chứng.</p>
      <button type="button" class="btn primary" id="dv-tao">+ Tạo đợt khảo sát</button></div>
    ${dots.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Đợt khảo sát</th><th>Hạn chót</th><th>Đối tượng</th><th>Đã nộp</th><th>Trạng thái</th></tr></thead><tbody>
      ${dots.map(d => {
        const ng = nguoiCuaDot(d, dsGiao), nop = nopTheoDot.get(d.id) || new Map(), da = ng.filter(u => nop.has(u.id)).length;
        return `<tr><td><a href="#" data-xem-dot="${d.id}"><b>${esc(d.ten)}</b></a><div class="muted small">Tạo ${fmtGio(d.tao_luc)}</div></td>
          <td class="nowrap small">${d.han_chot ? fmtTG(d.han_chot) : '–'}</td>
          <td class="small">${d.doi_tuong === 'tat_ca' ? 'Tất cả đảng viên' : `${ng.length} đồng chí`}</td>
          <td>${thanhTienDo(da, ng.length)}</td>
          <td>${d.dang_mo ? '<span class="tt tt-dang_xu_ly">Đang mở</span>' : '<span class="tt">Đã đóng</span>'}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="muted pad">Chưa có đợt khảo sát nào. Bấm “+ Tạo đợt khảo sát”.</p>'}`;
  S.dvClick = e => {
    if (e.target.closest('#dv-tao')) { moSuaDot(null, dsGiao, id => { S.dvDot = id; dieuHuong(); }); return; }
    const x = e.target.closest('[data-xem-dot]');
    if (x) { e.preventDefault(); S.dvDot = +x.dataset.xemDot; dieuHuong(); }
  };
}

/** Hộp tạo / sửa / nhân bản đợt */
function moSuaDot(dot, dsGiao, xong, nhanBan = false) {
  const ds = ds_DangVien();
  const giao = dot ? (dsGiao.get(dot.id) || new Set()) : new Set();
  const dt = dot?.han_chot && !nhanBan ? new Date(new Date(dot.han_chot).getTime() + 7 * 3600e3).toISOString().slice(0, 16) : '';
  moModal(`<h2>${nhanBan ? 'Nhân bản đợt' : dot ? 'Sửa đợt khảo sát' : 'Tạo đợt khảo sát'}</h2>
    <label class="lbl">Tên đợt <span class="err">*</span><input class="input" id="kd-ten" value="${esc(dot ? dot.ten + (nhanBan ? ' (bản sao)' : '') : '')}" placeholder="vd: Khảo sát ý kiến về Nghị quyết… tháng 11"></label>
    <label class="lbl">Đường link khảo sát<input class="input" id="kd-link" value="${esc(dot?.link || '')}" placeholder="https://…"></label>
    <label class="lbl">Hướng dẫn<textarea class="input" id="kd-hd" rows="3" placeholder="Nội dung cần làm, chụp màn hình nào…">${esc(dot?.huong_dan || '')}</textarea></label>
    <div class="grid2 khong-le">
      <label class="lbl">Hạn chót<input type="datetime-local" class="input" id="kd-han" value="${dt}"></label>
      <label class="lbl">Số tệp minh chứng tối thiểu (ảnh, PDF, Word…)<select class="input" id="kd-anh">${[1, 2, 3].map(k => `<option value="${k}" ${(dot?.so_anh || 1) === k ? 'selected' : ''}>${k} tệp</option>`).join('')}</select></label>
    </div>
    <div class="lbl">Đối tượng</div>
    <div class="radio-row"><label class="radio"><input type="radio" name="kd-dt" value="tat_ca" ${dot?.doi_tuong !== 'chon' ? 'checked' : ''}> Tất cả đảng viên (${ds.length})</label>
      <label class="radio"><input type="radio" name="kd-dt" value="chon" ${dot?.doi_tuong === 'chon' ? 'checked' : ''}> Chọn đảng viên</label></div>
    <div class="ds-chon ${dot?.doi_tuong === 'chon' ? '' : 'hidden'}" id="kd-ds">
      <label class="radio"><input type="checkbox" id="kd-tat"> <b>Chọn tất cả</b></label>
      <div class="luoi-lop">${ds.map(u => `<label class="radio"><input type="checkbox" data-kd-nguoi="${u.id}" ${giao.has(u.id) ? 'checked' : ''}> ${esc(u.ho_ten || u.email)}</label>`).join('')}</div>
    </div>
    ${!ds.length ? '<p class="err small">Chưa có tài khoản nào được tick quyền “Là đảng viên” (Quản trị → Tài khoản).</p>' : ''}
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Hủy</button><button type="button" class="btn primary" id="kd-luu">Lưu</button></div>`, true);
  $('#modal-body').onchange = e => {
    if (e.target.name === 'kd-dt') $('#kd-ds').classList.toggle('hidden', e.target.value !== 'chon');
    if (e.target.id === 'kd-tat') $$('[data-kd-nguoi]').forEach(c => (c.checked = e.target.checked));
  };
  $('#kd-luu').onclick = async () => {
    const ten = $('#kd-ten').value.trim(), link = $('#kd-link').value.trim(), han = $('#kd-han').value;
    if (!ten) { toast('Nhập tên đợt.', 'err'); $('#kd-ten').focus(); return; }
    if (link && !linkAnToan(link)) { toast('Đường link phải bắt đầu bằng http:// hoặc https://', 'err'); $('#kd-link').focus(); return; }
    const doiTuong = $('input[name=kd-dt]:checked').value, chon = $$('[data-kd-nguoi]:checked').map(c => c.dataset.kdNguoi);
    if (doiTuong === 'chon' && !chon.length) { toast('Chưa chọn đảng viên nào.', 'err'); return; }
    const row = { ten, link: link || null, huong_dan: $('#kd-hd').value.trim() || null, han_chot: han ? new Date(han + ':00+07:00').toISOString() : null, so_anh: +$('#kd-anh').value, doi_tuong: doiTuong };
    const btn = $('#kd-luu'); btn.disabled = true;
    try {
      const sua = dot && !nhanBan;
      const r = sua ? await sb.from('ks_dot').update(row).eq('id', dot.id).select('id').single() : await sb.from('ks_dot').insert(row).select('id').single();
      if (r.error) throw r.error;
      const id = r.data.id;
      if (sua) { const x = await sb.from('ks_dot_nguoi').delete().eq('dot_id', id); if (x.error) throw x.error; }
      if (doiTuong === 'chon') { const x = await sb.from('ks_dot_nguoi').insert(chon.map(u => ({ dot_id: id, nguoi_dung_id: u }))); if (x.error) throw x.error; }
      toast(sua ? 'Đã lưu đợt khảo sát.' : 'Đã tạo đợt khảo sát.');
      dongModal(); xong(id);
    } catch (e) { toast(loiChuaCaiDV(e) ? MSG_CHUA_CAI : dichLoi(e), 'err'); btn.disabled = false; }
  };
}

/* ---------- Quản lý: chi tiết một đợt ---------- */
async function dvChiTietDot(than, conSong, dotId) {
  const { dots, dsGiao, nopTheoDot } = await layDuLieuQL();
  if (!conSong()) return;
  const d = dots.find(x => x.id === dotId);
  if (!d) { S.dvDot = null; return dvDanhSachDot(than, conSong); }
  const ng = nguoiCuaDot(d, dsGiao), nop = nopTheoDot.get(d.id) || new Map();
  const daNop = ng.filter(u => nop.has(u.id)).map(u => ({ u, n: nop.get(u.id) })).sort((a, b) => new Date(a.n.nop_luc) - new Date(b.n.nop_luc));
  const chuaNop = ng.filter(u => !nop.has(u.id));
  const tre = daNop.filter(x => treHan(d, x.n)).length;
  const coAnh = daNop.filter(x => !x.n.anh_da_xoa && x.n.anh.length);
  const link = linkAnToan(d.link);
  than.innerHTML = `
    <p><button type="button" class="link" id="dv-ve">← Danh sách đợt</button></p>
    <div class="head-row"><h3 style="margin:0">${esc(d.ten)} ${d.dang_mo ? '<span class="tt tt-dang_xu_ly">Đang mở</span>' : '<span class="tt">Đã đóng</span>'}</h3>
      <div class="row-gap wrap">
        <button type="button" class="btn sm" id="dv-sua">Sửa</button>
        <button type="button" class="btn sm" id="dv-nhan">Nhân bản</button>
        <button type="button" class="btn sm" id="dv-dong">${d.dang_mo ? 'Đóng đợt' : 'Mở lại'}</button>
        <button type="button" class="btn sm danger" id="dv-xoa">Xóa đợt</button></div></div>
    <p class="small">${hanChot(d)} · Cần ${d.so_anh} tệp · ${d.doi_tuong === 'tat_ca' ? 'Tất cả đảng viên' : `${ng.length} đồng chí được chọn`}${link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener">Link khảo sát ↗</a>` : ''}</p>
    ${d.huong_dan ? `<div class="dv-hd small">${esc(d.huong_dan)}</div>` : ''}
    <div class="kpis">
      <div class="kpi"><span>Đã nộp</span><b>${daNop.length}<small class="kpi-phu"> / ${ng.length}</small></b><small>${ng.length ? Math.round(daNop.length / ng.length * 100) : 0}% hoàn thành</small></div>
      <div class="kpi"><span>Đúng hạn</span><b>${daNop.length - tre}</b><small>${d.han_chot ? 'trước ' + fmtGio(d.han_chot) : 'không có hạn chót'}</small></div>
      <div class="kpi"><span>Nộp trễ</span><b class="${tre ? 'chu-cam' : ''}">${tre}</b><small>&nbsp;</small></div>
      <div class="kpi"><span>Chưa nộp</span><b class="${chuaNop.length ? 'chu-do' : ''}">${chuaNop.length}</b><small>&nbsp;</small></div>
    </div>
    <div class="grid2">
      <div><div class="head-row"><h3 style="margin:0">Chưa nộp (${chuaNop.length})</h3>${chuaNop.length ? '<button type="button" class="btn sm primary" id="dv-chep">📋 Sao chép để gửi Zalo</button>' : ''}</div>
        ${chuaNop.length ? `<ol class="dv-ds">${chuaNop.map(u => `<li>${esc(u.ho_ten || u.email)} <span class="muted small">${CHUC_VU[u.chuc_vu] || ''}</span></li>`).join('')}</ol>` : '<p class="muted">Tất cả đã nộp. 🎉</p>'}</div>
      <div><div class="head-row"><h3 style="margin:0">Khác</h3></div>
        <div class="row-gap wrap"><button type="button" class="btn sm" id="dv-csv">Xuất danh sách (CSV)</button>
          <button type="button" class="btn sm danger" id="dv-don" ${coAnh.length ? '' : 'disabled'}>Dọn tệp minh chứng (giải phóng dung lượng)</button></div>
        <p class="muted small">“Dọn tệp” xóa ảnh và tệp minh chứng khỏi máy chủ nhưng vẫn giữ kết quả ai đã nộp, nộp lúc nào. Chỉ nên dọn khi không cần xem lại nữa (vd: hết năm).</p></div>
    </div>
    <div class="head-row"><h3 style="margin:0">Đã nộp (${daNop.length})</h3>${coAnh.length ? '<span class="muted small">Bấm vào ảnh để xem lớn (nút ‹ › hoặc phím ← → để xem lần lượt từng người); bấm vào tệp PDF, Word… để mở hoặc tải về.</span>' : ''}</div>
    ${daNop.length ? `<div class="mc-luoi">${daNop.map((x, i) => `<div class="mc-the ${treHan(d, x.n) ? 'tre' : ''}">
        <div class="mc-the-dau"><b>${i + 1}. ${esc(x.u.ho_ten || x.u.email)}</b>${treHan(d, x.n) ? ' <span class="nang">Trễ</span>' : ''}
          <div class="muted small">${CHUC_VU[x.u.chuc_vu] || ''} · nộp ${fmtGio(x.n.nop_luc)}${x.n.sua_luc ? ` · sửa ${fmtGio(x.n.sua_luc)}` : ''}</div></div>
        ${x.n.anh_da_xoa ? '<p class="muted small">Minh chứng đã được dọn.</p>' : oAnhNho(x.n.anh, `${x.u.ho_ten || x.u.email} – ${d.ten}`, true)}
        ${x.n.ghi_chu ? `<div class="small mc-gc">${esc(x.n.ghi_chu)}</div>` : ''}</div>`).join('')}</div>` : '<p class="muted">Chưa có ai nộp.</p>'}`;
  ganAnhMC(than);
  const lamMoi = () => { if (conSong()) dvChiTietDot(than, conSong, dotId); };
  S.dvClick = async e => {
    const id = e.target.closest('button')?.id;
    if (e.target.closest('#dv-ve')) { S.dvDot = null; dieuHuong(); return; }
    if (id === 'dv-sua') moSuaDot(d, dsGiao, lamMoi);
    else if (id === 'dv-nhan') moSuaDot(d, dsGiao, nid => { S.dvDot = nid; dieuHuong(); }, true);
    else if (id === 'dv-dong') {
      const dangMo = d.dang_mo;
      if (!confirm(dangMo ? 'Đóng đợt này? Đảng viên sẽ không nộp hay sửa minh chứng được nữa.' : 'Mở lại đợt này cho đảng viên nộp / sửa?')) return;
      const r = await sb.from('ks_dot').update({ dang_mo: !dangMo }).eq('id', d.id);
      if (r.error) toast(dichLoi(r.error), 'err'); else { toast(dangMo ? 'Đã đóng đợt.' : 'Đã mở lại đợt.'); lamMoi(); }
    } else if (id === 'dv-xoa') {
      if (!confirm(`Xóa đợt “${d.ten}” cùng ${daNop.length} bài nộp và toàn bộ minh chứng? Không thể hoàn tác.`)) return;
      const anh = daNop.flatMap(x => x.n.anh_da_xoa ? [] : x.n.anh);
      for (let i = 0; i < anh.length; i += 100) await sb.storage.from(KHO_MC).remove(anh.slice(i, i + 100));
      const r = await sb.from('ks_dot').delete().eq('id', d.id);
      if (r.error) toast(dichLoi(r.error), 'err'); else { toast('Đã xóa đợt.'); S.dvDot = null; dieuHuong(); }
    } else if (id === 'dv-chep') {
      const txt = `${d.ten}${d.han_chot ? ` – hạn chót ${fmtTG(d.han_chot)}` : ''}\nCác đồng chí chưa nộp minh chứng (${chuaNop.length}):\n`
        + chuaNop.map((u, i) => `${i + 1}. ${u.ho_ten || u.email}`).join('\n') + (link ? `\nLink khảo sát: ${link}` : '');
      try { await navigator.clipboard.writeText(txt); toast('Đã sao chép. Mở Zalo và dán (Ctrl+V).'); }
      catch { moModal(`<h2>Sao chép danh sách</h2><textarea class="input mono" rows="12" id="dv-txt">${esc(txt)}</textarea><div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Đóng</button></div>`); $('#dv-txt').select(); }
    } else if (id === 'dv-csv') {
      xuatCSV(`khao-sat_${boDau(d.ten).replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.csv`, ['Đảng viên', 'Email', 'Vai trò', 'Trạng thái', 'Nộp lúc', 'Trễ hạn', 'Số tệp', 'Ghi chú'],
        ng.map(u => { const n = nop.get(u.id); return [u.ho_ten, u.email, CHUC_VU[u.chuc_vu], n ? 'Đã nộp' : 'Chưa nộp', n ? fmtTG(n.nop_luc) : '', n && treHan(d, n) ? 'Trễ' : '', n ? (n.anh_da_xoa ? 'đã dọn' : n.anh.length) : '', n?.ghi_chu || '']; }));
    } else if (id === 'dv-don') {
      if (!confirm(`Dọn ${coAnh.reduce((s, x) => s + x.n.anh.length, 0)} tệp minh chứng của đợt này khỏi máy chủ?\n\nKết quả (ai đã nộp, nộp lúc nào) vẫn được giữ, nhưng sẽ không xem lại được minh chứng. Không thể hoàn tác.`)) return;
      const anh = coAnh.flatMap(x => x.n.anh);
      for (let i = 0; i < anh.length; i += 100) { const r = await sb.storage.from(KHO_MC).remove(anh.slice(i, i + 100)); if (r.error) { toast(dichLoi(r.error), 'err'); return; } }
      const r = await sb.from('ks_nop').update({ anh: [], anh_da_xoa: true }).in('id', coAnh.map(x => x.n.id));
      if (r.error) toast(dichLoi(r.error), 'err'); else { toast('Đã dọn minh chứng, giữ nguyên kết quả.'); lamMoi(); }
    }
  };
}

/* ---------- Quản lý: tổng hợp nhiều đợt ---------- */
async function dvTongHop(than, conSong) {
  const { dots, dsGiao, nopTheoDot } = await layDuLieuQL();
  if (!conSong()) return;
  const F = S.locDV || (S.locDV = { tu: khoangTK('nam').tu || '', den: '' });   // mặc định: từ đầu năm học, không giới hạn ngày cuối
  const loc = dots.filter(d => { const n = ngayVN(d.han_chot || d.tao_luc); return (!F.tu || n >= F.tu) && (!F.den || n <= F.den); });
  const bang = ds_DangVien().map(u => {
    const giao = loc.filter(d => nguoiCuaDot(d, dsGiao).some(x => x.id === u.id));
    const nop = giao.filter(d => nopTheoDot.get(d.id)?.has(u.id));
    const tre = nop.filter(d => treHan(d, nopTheoDot.get(d.id).get(u.id))).length;
    const chua = giao.filter(d => !nopTheoDot.get(d.id)?.has(u.id));
    return { u, giao: giao.length, nop: nop.length, dung: nop.length - tre, tre, chua };
  }).sort((a, b) => (a.giao ? a.nop / a.giao : 1) - (b.giao ? b.nop / b.giao : 1) || b.chua.length - a.chua.length);
  than.innerHTML = `
    <div class="filters"><label>Đợt có hạn chót từ ngày<input type="date" class="input" id="th-tu" value="${F.tu}"></label>
      <label>Đến ngày <span class="muted">(để trống = tất cả)</span><input type="date" class="input" id="th-den" value="${F.den}"></label>
      <button type="button" class="btn" id="th-csv">Xuất CSV</button></div>
    <p class="muted small">${loc.length} đợt khảo sát trong khoảng thời gian này. Xếp người hoàn thành thấp lên đầu.</p>
    ${bang.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Đảng viên</th><th class="r">Được giao</th><th class="r">Đã nộp</th><th class="r">Đúng hạn</th><th class="r">Trễ</th><th>Tỷ lệ hoàn thành</th><th>Đợt chưa nộp</th></tr></thead><tbody>
      ${bang.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(x.u.ho_ten || x.u.email)}</b><div class="muted small">${CHUC_VU[x.u.chuc_vu] || ''}</div></td>
        <td class="r">${x.giao}</td><td class="r">${x.nop}</td><td class="r">${x.dung}</td><td class="r">${x.tre ? `<b class="chu-cam">${x.tre}</b>` : ''}</td>
        <td>${thanhTienDo(x.nop, x.giao)}</td><td class="small">${x.chua.map(d => esc(d.ten)).join('; ')}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted pad">Chưa có tài khoản nào được tick quyền “Là đảng viên” (Quản trị → Tài khoản).</p>'}`;
  S.dvChange = e => { if (e.target.id === 'th-tu' || e.target.id === 'th-den') { F.tu = $('#th-tu').value; F.den = $('#th-den').value; dvTongHop(than, conSong); } };
  S.dvClick = e => {
    if (e.target.closest('#th-csv')) xuatCSV(`tong-hop-khao-sat_${F.tu || 'dau'}_${F.den || 'nay'}.csv`, ['Đảng viên', 'Email', 'Được giao', 'Đã nộp', 'Đúng hạn', 'Trễ', 'Tỷ lệ (%)', 'Đợt chưa nộp'],
      bang.map(x => [x.u.ho_ten, x.u.email, x.giao, x.nop, x.dung, x.tre, x.giao ? Math.round(x.nop / x.giao * 100) : '', x.chua.map(d => d.ten).join('; ')]));
  };
}