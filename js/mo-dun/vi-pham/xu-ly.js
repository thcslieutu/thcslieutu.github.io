'use strict';
/* =====================================================================
   PHÂN HỆ VI PHẠM – XỬ LÝ VI PHẠM
   ===================================================================== */
async function veXuLyVP(el) {
  const xl = duocXuLy(), bgh = App.coQuyen('vp.xu_ly_tat_ca');
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
}
