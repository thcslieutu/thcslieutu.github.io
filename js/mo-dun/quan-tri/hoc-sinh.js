'use strict';
/* =====================================================================
   PHÂN HỆ QUẢN TRỊ – ĐIỂM TRƯỜNG, LỚP & HỌC SINH (dữ liệu dùng chung cho mọi phân hệ)
   Quyền: hs.quan_ly
   ===================================================================== */
function veHocSinh(el) {
  const chonHS = new Set();   // học sinh đang được tick (trong lớp đang xem)
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
  const veBulkHS = () => {
    const b = $('#hs-bulk'); if (!b) return;
    const ds = S.hs.filter(h => h.lop_id === S.hsLop);
    for (const id of [...chonHS]) if (!ds.some(h => h.id === id)) chonHS.delete(id);
    b.classList.toggle('hidden', !chonHS.size);
    $('#hs-bulk-n').textContent = `Đã chọn ${chonHS.size} học sinh`;
    const all = $('#hs-chk-all');
    if (all) { all.checked = ds.length > 0 && chonHS.size === ds.length; all.indeterminate = chonHS.size > 0 && chonHS.size < ds.length; }
    $$('[data-chk-hs]').forEach(c => c.closest('tr').classList.toggle('sel', c.checked));
  };
  const veHS = () => {
    const ds = S.hs.filter(h => h.lop_id === S.hsLop);
    $('#hs-tieu-de').textContent = S.hsLop ? `Học sinh lớp ${tenLop(S.hsLop)} (${ds.filter(h => h.dang_hoc).length})` : 'Học sinh';
    $('#f-hs').classList.toggle('hidden', !S.hsLop);
    $('#hs-ds').innerHTML = ds.length ? `
      <div class="bulk hidden" id="hs-bulk"><b id="hs-bulk-n"></b>
        <button type="button" class="btn sm" data-act="hs-nghi">Đánh dấu đã nghỉ</button>
        <button type="button" class="btn sm danger" data-act="hs-xoa">Xóa học sinh đã chọn</button>
        <button type="button" class="btn sm" data-act="hs-bo">Bỏ chọn</button></div>
      <table class="tbl"><thead><tr><th class="w1"><input type="checkbox" id="hs-chk-all" title="Chọn cả lớp" aria-label="Chọn cả lớp"></th><th>STT</th><th>Họ và tên</th><th>Lớp</th><th>Tình trạng</th><th></th></tr></thead><tbody>
      ${ds.map(h => `<tr class="${h.dang_hoc ? '' : 'nghi'}"><td><input type="checkbox" data-chk-hs="${h.id}" ${chonHS.has(h.id) ? 'checked' : ''} aria-label="Chọn"></td><td>${S.stt.get(h.id) || ''}</td>
        <td><a href="#" data-lsu="${h.id}">${esc(h.ho_ten)}</a></td>
        <td><select class="input sm" data-chuyen="${h.id}">${optLop(h.lop_id)}</select></td>
        <td><label class="switch"><input type="checkbox" data-dang-hoc="${h.id}" ${h.dang_hoc ? 'checked' : ''}> ${h.dang_hoc ? 'Đang học' : 'Đã nghỉ'}</label></td>
        <td class="nowrap"><button type="button" class="link" data-sua-hs="${h.id}">Sửa tên</button><button type="button" class="link danger" data-xoa-hs="${h.id}">Xóa</button></td></tr>`).join('')}</tbody></table>
      <p class="muted small">Tick ô đầu dòng để chọn nhiều học sinh (ô trên cùng: chọn cả lớp), rồi bấm <b>Xóa học sinh đã chọn</b>.
      Chuyển lớp không ảnh hưởng vi phạm cũ: vi phạm được tính cho lớp tại thời điểm ghi nhận.</p>`
      : `<p class="muted pad">${S.hsLop ? 'Lớp chưa có học sinh.' : ''}</p>`;
    veBulkHS();
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
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'hs-bo') { chonHS.clear(); veHS(); return; }
    if (act === 'hs-nghi') {
      const ids = [...chonHS].filter(id => S.hsMap.get(id)?.dang_hoc);
      if (!ids.length) { toast('Các học sinh đã chọn đều đã ở trạng thái Đã nghỉ.'); return; }
      if (!confirm(`Đánh dấu ${ids.length} học sinh là “Đã nghỉ”?\n\nCác em không còn hiện ở màn hình Nhập vi phạm; vi phạm cũ được giữ nguyên.`)) return;
      if (await thucHien(sb.from('hoc_sinh').update({ dang_hoc: false }).in('id', ids), `Đã đánh dấu ${ids.length} học sinh đã nghỉ.`)) chonHS.clear();
      return;
    }
    if (act === 'hs-xoa') { moXoaNhieuHS([...chonHS], async () => { chonHS.clear(); await lamMoi(); }); return; }
    const t = e.target.closest('[data-chon-lop],[data-sua-lop],[data-xoa-lop],[data-doi-dt],[data-xoa-dt],[data-sua-hs],[data-xoa-hs],[data-lsu],#btn-nhap-nhieu');
    if (!t) return;
    const d = t.dataset;
    if (d.suaLop) {
      moSuaLop(+d.suaLop, lamMoi);
    } else if (d.xoaLop) {
      moXoaLop(+d.xoaLop, async () => { if (S.hsLop === +d.xoaLop) S.hsLop = null; chonHS.clear(); await lamMoi(); });
    } else if (d.doiDt) {
      const dt = S.dtMap.get(+d.doiDt), moi = prompt('Tên điểm trường mới:', dt.ten);
      if (moi && moi.trim() && moi.trim() !== dt.ten) await thucHien(sb.from('diem_truong').update({ ten: moi.trim() }).eq('id', dt.id), 'Đã đổi tên.');
    } else if (d.xoaDt) {
      const dt = S.dtMap.get(+d.xoaDt), n = S.lop.filter(l => l.diem_truong_id === dt.id).length;
      if (confirm(`Xóa điểm trường ${dt.ten}?${n ? `\n\n${n} lớp của điểm trường này sẽ chuyển thành “chưa xếp điểm trường” (không mất dữ liệu).` : ''}\nPhân công xử lý theo điểm trường này (nếu có) cũng được bỏ.`))
        await thucHien(sb.from('diem_truong').delete().eq('id', dt.id), 'Đã xóa điểm trường.');
    } else if (d.chonLop) {
      S.hsLop = +d.chonLop; chonHS.clear(); veLop(); veHS();
    } else if (d.suaHs) {
      const h = S.hsMap.get(+d.suaHs), moi = prompt('Họ tên mới:', h.ho_ten);
      if (moi && moi.trim()) await thucHien(sb.from('hoc_sinh').update({ ho_ten: chuanHoaTen(moi) }).eq('id', h.id), 'Đã sửa.');
    } else if (d.xoaHs) {
      moXoaNhieuHS([+d.xoaHs], async () => { chonHS.delete(+d.xoaHs); await lamMoi(); });
    } else if (d.lsu) {
      e.preventDefault(); if (typeof lichSuHS === 'function' && App.coMotQuyen(['vp.ghi_nhan', 'vp.xu_ly', 'vp.xu_ly_tat_ca'])) lichSuHS(+d.lsu);
    } else if (t.id === 'btn-nhap-nhieu') moNhapExcel(lamMoi);
  };
  el.onchange = async e => {
    const d = e.target.dataset;
    if (e.target.id === 'hs-chk-all') {
      S.hs.filter(h => h.lop_id === S.hsLop).forEach(h => e.target.checked ? chonHS.add(h.id) : chonHS.delete(h.id));
      $$('[data-chk-hs]').forEach(c => (c.checked = e.target.checked)); veBulkHS(); return;
    }
    if (d.chkHs) { e.target.checked ? chonHS.add(+d.chkHs) : chonHS.delete(+d.chkHs); veBulkHS(); return; }
    if (d.chuyen) await thucHien(sb.from('hoc_sinh').update({ lop_id: +e.target.value }).eq('id', +d.chuyen), `Đã chuyển sang lớp ${tenLop(+e.target.value)}.`);
    else if (d.dangHoc) await thucHien(sb.from('hoc_sinh').update({ dang_hoc: e.target.checked }).eq('id', +d.dangHoc));
  };
  ve();
}

/** Hỏi các phân hệ: xóa các học sinh / lớp này sẽ xóa kèm những dữ liệu gì → [{ ten, so }] */
async function demLienQuan(hocSinh, lop = []) {
  const kq = await Promise.all(App._lienQuanHS.map(fn => Promise.resolve().then(() => fn({ hocSinh, lop })).catch(() => [])));
  return kq.flat().filter(x => x.so);
}
const liLienQuan = ds => ds.map(x => `<li><b>${so(x.so)}</b> ${esc(x.ten)}</li>`).join('');

/** Xóa lớp cùng toàn bộ học sinh của lớp và dữ liệu liên quan (vi phạm…) */
async function moXoaLop(lopId, xong) {
  const l = S.lopMap.get(lopId); if (!l) return;
  const hs = S.hs.filter(h => h.lop_id === lopId), ids = hs.map(h => h.id);
  moModal(`<h2>Xóa lớp ${esc(l.ten_lop)}</h2><p class="muted">Đang kiểm tra dữ liệu của lớp…</p>`);
  let lq;
  try { lq = await demLienQuan(ids, [lopId]); }
  catch (e) { moModal(`<h2>Xóa lớp ${esc(l.ten_lop)}</h2><p class="err">${esc(dichLoi(e))}</p><div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Đóng</button></div>`); return; }
  if ($('#modal').classList.contains('hidden')) return;
  const tenXN = l.ten_lop;
  moModal(`<h2>Xóa lớp ${esc(l.ten_lop)}</h2>
    <div class="info-box canh-bao-do"><p class="small">Sẽ xóa vĩnh viễn:</p><ul class="small">
      <li>Lớp <b>${esc(l.ten_lop)}</b>${l.gvcn_id ? ` (GVCN: ${esc(tenND(l.gvcn_id))})` : ''}</li>
      <li><b>${hs.length}</b> học sinh của lớp${hs.some(h => !h.dang_hoc) ? ` (gồm ${hs.filter(h => !h.dang_hoc).length} em đã nghỉ)` : ''}</li>
      ${liLienQuan(lq)}</ul>
      <p class="small"><b>Không thể hoàn tác.</b>${lq.length ? ' Nếu cần giữ số liệu, hãy xuất CSV trước khi xóa (Quản trị → Dữ liệu).' : ''}</p></div>
    <p class="small">Gõ tên lớp <b>${esc(tenXN)}</b> để xác nhận:</p>
    <input class="input" id="xl-ma" autocomplete="off" placeholder="${esc(tenXN)}">
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Hủy</button>
      <button type="button" class="btn danger-solid" id="xl-ok" disabled>Xóa lớp</button></div>`);
  $('#xl-ma').oninput = e => ($('#xl-ok').disabled = chuanHoaLop(e.target.value) !== chuanHoaLop(tenXN));
  $('#xl-ma').focus();
  $('#xl-ok').onclick = async () => {
    const btn = $('#xl-ok'); btn.disabled = true; btn.textContent = 'Đang xóa…';
    const { error } = await sb.from('lop').delete().eq('id', lopId);   // học sinh, vi phạm… tự xóa theo
    if (error) { toast(dichLoi(error), 'err'); btn.disabled = false; btn.textContent = 'Xóa lớp'; return; }
    toast(`Đã xóa lớp ${l.ten_lop} và ${hs.length} học sinh.`);
    dongModal(); App.capNhatHuyHieu(); await xong();
  };
}

/** Xóa một hoặc nhiều học sinh. Có dữ liệu liên quan (vi phạm…) thì phải tick xác nhận. */
async function moXoaNhieuHS(ids, xong) {
  if (!ids.length) return;
  moModal('<h2>Xóa học sinh</h2><p class="muted">Đang kiểm tra dữ liệu của các em…</p>');
  let lq;
  try { lq = await demLienQuan(ids); }
  catch (e) { moModal(`<h2>Xóa học sinh</h2><p class="err">${esc(dichLoi(e))}</p><div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Đóng</button></div>`); return; }
  if ($('#modal').classList.contains('hidden')) return;
  const hs = ids.map(id => S.hsMap.get(id)).filter(Boolean).sort(soSanhTen);
  const toiDa = 20;
  moModal(`<h2>Xóa ${hs.length} học sinh</h2>
    <div class="info-box"><p class="small">${hs.slice(0, toiDa).map(h => esc(h.ho_ten)).join(', ')}${hs.length > toiDa ? ` … và ${hs.length - toiDa} em khác` : ''}</p></div>
    ${lq.length ? `<div class="info-box canh-bao-do"><p class="small">Các em này đã có dữ liệu, sẽ bị xóa kèm:</p><ul class="small">${liLienQuan(lq)}</ul>
      <label class="switch"><input type="checkbox" id="xh-vp"> Tôi hiểu, xóa cả dữ liệu này</label>
      <p class="small muted" style="margin-top:6px">Học sinh nghỉ học / chuyển trường nên bấm “Đánh dấu đã nghỉ” để giữ lịch sử thay vì xóa.</p></div>` : ''}
    <p class="small"><b>Không thể hoàn tác.</b></p>
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Hủy</button>
      <button type="button" class="btn danger-solid" id="xh-ok" ${lq.length ? 'disabled' : ''}>Xóa ${hs.length} học sinh</button></div>`);
  if ($('#xh-vp')) $('#xh-vp').onchange = e => ($('#xh-ok').disabled = !e.target.checked);
  $('#xh-ok').onclick = async () => {
    const btn = $('#xh-ok'); btn.disabled = true; btn.textContent = 'Đang xóa…';
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await sb.from('hoc_sinh').delete().in('id', ids.slice(i, i + 200));
      if (error) { toast(dichLoi(error), 'err'); btn.disabled = false; btn.textContent = `Xóa ${hs.length} học sinh`; return; }
    }
    toast(`Đã xóa ${hs.length} học sinh.`);
    dongModal(); App.capNhatHuyHieu(); await xong();
  };
}

function moSuaLop(id, xong) {
  const l = S.lopMap.get(id);
  const dsGV = S.nd.filter(u => ['giao_vien', 'tong_phu_trach', 'bgh', 'quan_tri'].includes(u.chuc_vu) || u.id === l.gvcn_id).sort((a, b) => String(a.ho_ten || a.email).localeCompare(String(b.ho_ten || b.email), 'vi'));
  moModal(`<h2>Sửa lớp ${esc(l.ten_lop)}</h2>
    <label class="lbl">Tên lớp<input class="input" id="sl-ten" value="${esc(l.ten_lop)}"></label>
    ${coDT() ? `<label class="lbl">Điểm trường<select class="input" id="sl-dt"><option value="">— Chưa xếp —</option>${optDT(l.diem_truong_id)}</select></label>` : ''}
    <label class="lbl">Giáo viên chủ nhiệm<select class="input" id="sl-gvcn"><option value="">— Chưa phân công —</option>
      ${dsGV.map(u => `<option value="${u.id}" ${u.id === l.gvcn_id ? 'selected' : ''}>${esc(u.ho_ten || u.email)}${u.chuc_vu !== 'giao_vien' ? ` (${CHUC_VU[u.chuc_vu]})` : ''}</option>`).join('')}</select></label>
    <p class="muted small">GV chủ nhiệm (có quyền “Ghi nhận vi phạm”) được xử lý vi phạm Nhẹ, Trung bình của lớp mình.</p>
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
