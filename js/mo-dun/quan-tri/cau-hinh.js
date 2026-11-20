'use strict';
/* =====================================================================
   PHÂN HỆ QUẢN TRỊ – CẤU HÌNH (chỉ Quản trị)
   Các thông số do file SQL của từng phân hệ khai báo (bảng cau_hinh) → phân hệ mới tự hiện ở đây.
   Cùng trang: danh sách phân hệ đã cài cơ sở dữ liệu.
   ===================================================================== */

async function veCauHinh(el) {
  const conSong = giuPhien();
  const ds = [...(S.cauHinhDS || [])];
  const nhom = new Map();
  ds.sort((a, b) => (a.phan_he === 'chung' ? -1 : 0) - (b.phan_he === 'chung' ? -1 : 0) || a.phan_he.localeCompare(b.phan_he) || a.thu_tu - b.thu_tu)
    .forEach(r => { if (!nhom.has(r.phan_he)) nhom.set(r.phan_he, []); nhom.get(r.phan_he).push(r); });
  const tenNhom = ph => ph === 'chung' ? 'Chung' : tenPhanHeQuyen(ph);
  const oNhap = r => {
    const v = r.gia_tri ?? '';
    if (r.kieu === 'so') return `<input class="input sm num" type="number" min="0" step="1" name="${esc(r.khoa)}" value="${esc(v)}">`;
    if (r.kieu === 'thang_ngay') return `<input class="input sm o-thang-ngay" name="${esc(r.khoa)}" value="${esc(v)}" placeholder="MM-DD" pattern="\\d{2}-\\d{2}">`;
    return `<input class="input sm" name="${esc(r.khoa)}" value="${esc(v)}">`;
  };
  const md = [...S.moDun.values()].sort((a, b) => a.ma.localeCompare(b.ma));
  el.innerHTML = `<section class="card"><h2>Cấu hình</h2>
    <p class="muted small">Thay đổi có hiệu lực ngay cho mọi người (người đang mở phần mềm cần tải lại trang).</p>
    <form id="f-cau-hinh">${[...nhom].map(([ph, a]) => `<h3>${esc(tenNhom(ph))}</h3>
      <div class="table-wrap"><table class="tbl edit"><tbody>${a.map(r => `<tr><td><b>${esc(r.ten)}</b><div class="muted small">${esc(r.mo_ta || '')}</div></td><td class="nowrap">${oNhap(r)}</td></tr>`).join('')}</tbody></table></div>`).join('')
      || '<p class="muted">Chưa có cấu hình nào.</p>'}
      <div class="modal-actions"><span class="sp"></span><button class="btn primary" id="ch-luu">Lưu cấu hình</button></div></form></section>
  <section class="card"><h2>Phân hệ đã cài</h2>
    <p class="muted small">Mỗi phân hệ có một file SQL trong thư mục <code>supabase/</code>. Phân hệ chỉ hiện khi file SQL đã được chạy.</p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Phân hệ</th><th>Mã</th><th class="r">Phiên bản</th><th>Cài lúc</th></tr></thead><tbody>
      ${md.map(m => `<tr><td><b>${esc(m.ten)}</b></td><td class="small"><code>${esc(m.ma)}</code></td><td class="r">${m.phien_ban}</td><td class="small">${fmtTG(m.cai_luc)}</td></tr>`).join('')}
      ${App.phanHe.filter(p => !App.daCai(p.moDun)).map(p => `<tr class="cho"><td><b>${esc(p.ten)}</b></td><td colspan="3" class="small">Chưa cài – chạy file SQL của phân hệ (cần: ${[].concat(p.moDun).map(esc).join(', ')})</td></tr>`).join('')}
    </tbody></table></div></section>`;
  $('#f-cau-hinh').onsubmit = async e => {
    e.preventDefault();
    const btn = $('#ch-luu'); btn.disabled = true;
    try {
      for (const r of ds) {
        const o = e.target.elements[r.khoa]; if (!o) continue;
        let v = o.value.trim();
        if (r.kieu === 'so') { if (v === '' || isNaN(+v) || +v < 0) throw new Error(`“${r.ten}” phải là số không âm.`); v = +v; }
        if (r.kieu === 'thang_ngay' && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)) throw new Error(`“${r.ten}” phải có dạng tháng-ngày, vd 09-05.`);
        if (JSON.stringify(v) === JSON.stringify(r.gia_tri)) continue;
        const { error } = await sb.from('cau_hinh').update({ gia_tri: v }).eq('khoa', r.khoa);
        if (error) throw error;
      }
      toast('Đã lưu cấu hình.');
      await taiDanhMuc(); if (conSong()) veCauHinh(el);
    } catch (ex) { toast(ex.message ? dichLoi(ex) : String(ex), 'err'); btn.disabled = false; }
  };
}
