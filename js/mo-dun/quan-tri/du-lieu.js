'use strict';
/* =====================================================================
   PHÂN HỆ QUẢN TRỊ – SAO LƯU & XÓA DỮ LIỆU (chỉ Quản trị)
   Mỗi phân hệ tự thêm mục của mình bằng App.dangKyDonDuLieu({ … }).
   ===================================================================== */

/* ---------- Mục của nền tảng ---------- */
App.dangKyDonDuLieu({
  id: 'hs_sao_luu', ten: 'Sao lưu danh sách học sinh (CSV)', chiTai: true, thuTu: 0,
  mo: 'Họ tên, lớp, điểm trường, tình trạng.',
  tai: async () => {
    const ds = [...S.hs].sort((a, b) => tenLop(a.lop_id).localeCompare(tenLop(b.lop_id), 'vi', { numeric: true }) || soSanhTen(a, b));
    xuatCSV(`sao-luu-hoc-sinh_${homNay()}.csv`, ['Họ tên', 'Lớp', 'Điểm trường', 'Tình trạng'],
      ds.map(h => [h.ho_ten, tenLop(h.lop_id), tenDT(S.lopMap.get(h.lop_id)?.diem_truong_id), h.dang_hoc ? 'Đang học' : 'Đã nghỉ']));
    return ds.length;
  }
});
App.dangKyDonDuLieu({
  id: 'hoc_sinh', ten: 'Học sinh, lớp, điểm trường', thuTu: 90,
  mo: 'Xóa kèm mọi dữ liệu gắn với học sinh, lớp ở các phân hệ (vi phạm, vắng, lớp nghỉ…).',
  dem: async () => S.hs.length + S.lop.length + S.dt.length,
  xoa: async () => {
    for (const [bang, cot] of [['lop', 'id'], ['diem_truong', 'id']]) {
      const { error } = await sb.from(bang).delete().gte(cot, 0);
      if (error) throw error;
    }
  }
});
App.dangKyDonDuLieu({
  id: 'tai_khoan', ten: 'Tài khoản (trừ Quản trị)', thuTu: 99,
  mo: 'Xóa mọi tài khoản không phải Quản trị. Dữ liệu họ đã ghi vẫn giữ, chỉ mất tên người ghi.',
  dem: async () => S.nd.filter(u => u.chuc_vu !== 'quan_tri').length,
  xoa: async () => {
    const ids = S.nd.filter(u => u.chuc_vu !== 'quan_tri').map(u => u.id);
    if (!ids.length) return;
    const { error } = await sb.rpc('xoa_tai_khoan', { p_ids: ids });
    if (error) throw error;
  }
});

function veDuLieu(el) {
  const ds = App._donDuLieu.filter(m => App.daCai(m.moDun)).sort((a, b) => (a.thuTu ?? 50) - (b.thuTu ?? 50));
  const tai = ds.filter(m => m.chiTai), xoa = ds.filter(m => !m.chiTai);
  el.innerHTML = `<section class="card"><h2>Sao lưu</h2>
    <p class="muted small">Tải file CSV (mở bằng Excel) để lưu trữ, nhất là trước khi xóa dữ liệu hoặc cuối năm học.</p>
    <div class="row-gap wrap">${tai.map(m => `<button type="button" class="btn" data-tai="${m.id}" title="${esc(m.mo || '')}">${esc(m.ten)}</button>`).join('')}</div></section>
  <section class="card nguy-hiem"><h2>Xóa dữ liệu</h2>
    <p class="small"><b>Thao tác không thể hoàn tác.</b> Nên sao lưu trước khi xóa.</p>
    <div class="xoa-chon">${xoa.map(m => `<div><label class="radio"><input type="checkbox" data-xoa="${m.id}"> <b>${esc(m.ten)}</b></label>
      ${m.coNgay ? `<span class="small muted"> · chỉ dữ liệu trước ngày <input type="date" class="input sm o-ngay" data-ngay="${m.id}"></span>` : ''}
      <div class="muted small xoa-con">${esc(m.mo || '')}</div></div>`).join('')}</div>
    <button type="button" class="btn danger" id="x-mo">Xóa dữ liệu đã chọn…</button></section>`;

  el.onclick = async e => {
    const t = e.target.closest('[data-tai]');
    if (t) {
      const m = ds.find(x => x.id === t.dataset.tai), cu = t.textContent; t.disabled = true; t.textContent = 'Đang tải…';
      try { const n = await m.tai(); toast(`Đã tải ${so(n)} dòng.`); } catch (ex) { toast(dichLoi(ex), 'err'); }
      t.disabled = false; t.textContent = cu; return;
    }
    if (e.target.id !== 'x-mo') return;
    const chon = $$('[data-xoa]:checked').map(c => ({ m: xoa.find(x => x.id === c.dataset.xoa), ngay: $(`[data-ngay="${c.dataset.xoa}"]`)?.value || null }));
    if (!chon.length) { toast('Chưa chọn dữ liệu cần xóa.', 'err'); return; }
    const MA = 'XOA DU LIEU';
    moModal(`<h2>Xác nhận xóa dữ liệu</h2><div id="xd-tom-tat"><p class="muted">Đang đếm dữ liệu…</p></div>
      <p class="small">Gõ <b>${MA}</b> vào ô dưới để xác nhận:</p>
      <input class="input" id="xd-ma" autocomplete="off" placeholder="${MA}">
      <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Hủy</button>
        <button type="button" class="btn danger-solid" id="xd-ok" disabled>Xóa vĩnh viễn</button></div>`);
    let dem;
    try { dem = await Promise.all(chon.map(c => c.m.dem(c.ngay))); }
    catch (ex) { $('#xd-tom-tat') && ($('#xd-tom-tat').innerHTML = `<p class="err">${esc(dichLoi(ex))}</p>`); return; }
    if (!$('#xd-tom-tat')) return;
    $('#xd-tom-tat').innerHTML = `<div class="info-box canh-bao-do"><p class="small">Sẽ xóa vĩnh viễn:</p><ul class="small">
      ${chon.map((c, i) => `<li>${esc(c.m.ten)}${c.ngay ? ` – trước ngày ${vn(c.ngay)}` : ''}: <b>${so(dem[i])}</b> mục</li>`).join('')}</ul></div>`;
    $('#xd-ma').oninput = ev => ($('#xd-ok').disabled = ev.target.value.trim().toUpperCase() !== MA);
    $('#xd-ma').focus();
    $('#xd-ok').onclick = async () => {
      const btn = $('#xd-ok'); btn.disabled = true; btn.textContent = 'Đang xóa…';
      try { for (const c of chon) await c.m.xoa(c.ngay); }
      catch (ex) { toast(dichLoi(ex), 'err'); btn.disabled = false; btn.textContent = 'Xóa vĩnh viễn'; return; }
      toast('Đã xóa dữ liệu đã chọn.');
      S.nhap = S.nhapCC = null; S.hsLop = null;
      dongModal(); await taiDanhMuc(); App.capNhatHuyHieu(); veDuLieu(el);
    };
  };
}
