'use strict';
/* =====================================================================
   PHÂN HỆ CHUYÊN CẦN – BÁO CÁO
   Lấy từ các vi phạm có đánh dấu "Chuyên cần" (phân hệ Vi phạm) + bảng lớp nghỉ.
   ===================================================================== */
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : null;
const fmtPct = v => v == null ? '–' : so(v) + '%';
/** Như xuHuong nhưng tăng là tốt (xanh), giảm là xấu (đỏ) – dùng cho số học sinh có mặt */
const xuHuongTot = (c, p) => xuHuong(c, p).replace('class="up"', 'class="__"').replace('class="down"', 'class="up"').replace('class="__"', 'class="down"');
/** Chênh lệch tỷ lệ (điểm %): tăng là tốt (xanh) */
function xuHuongPct(c, p) {
  if (c == null || p == null) return '';
  const d = Math.round((c - p) * 10) / 10;
  if (!d) return '<em class="flat">— không đổi</em>';
  return `<em class="${d > 0 ? 'down' : 'up'}">${d > 0 ? '▲' : '▼'} ${so(Math.abs(d))} điểm %</em>`;
}

async function veChuyenCan(el) {
  const F = S.locCC || (S.locCC = { cheDo: 'buoi', ngay: homNay(), buoi: buoiCC(Date.now()), ss: 'truoc', preset: 'tuan', tu: '', den: '', dt: '' });
  if (F.dt && !S.dtMap.has(+F.dt)) F.dt = '';
  const conSong = giuPhien();
  const loaiCC = new Map(S.loai.filter(l => l.chuyen_can).map(l => [l.id, l.chuyen_can]));
  const optP = (v, t) => `<option value="${v}" ${F.preset === v ? 'selected' : ''}>${t}</option>`;
  el.innerHTML = `
  <section class="card">
    <div class="filters">
      <label>Xem theo<select id="cc-che-do" class="input">
        <option value="buoi" ${F.cheDo === 'buoi' ? 'selected' : ''}>Từng buổi</option>
        <option value="khoang" ${F.cheDo === 'khoang' ? 'selected' : ''}>Tuần / tháng / khoảng thời gian</option></select></label>
      <span class="filters-con" id="cc-loc-buoi">
        <label>Ngày<input type="date" id="cc-ngay" class="input" value="${F.ngay}" max="${homNay()}"></label>
        <label>Buổi<select id="cc-buoi" class="input"><option value="sang" ${F.buoi === 'sang' ? 'selected' : ''}>Sáng</option><option value="chieu" ${F.buoi === 'chieu' ? 'selected' : ''}>Chiều</option></select></label>
        <label>So sánh với<select id="cc-ss" class="input">
          <option value="truoc" ${F.ss === 'truoc' ? 'selected' : ''}>Buổi học trước</option>
          <option value="tuan" ${F.ss === 'tuan' ? 'selected' : ''}>Cùng buổi tuần trước</option>
          <option value="thang" ${F.ss === 'thang' ? 'selected' : ''}>Cùng buổi tháng trước</option></select></label>
      </span>
      <span class="filters-con" id="cc-loc-khoang">
        <label>Khoảng thời gian<select id="cc-preset" class="input">
          ${optP('tuan', 'Tuần này (so với tuần trước)')}${optP('tuan_truoc', 'Tuần trước')}${optP('thang', 'Tháng này (so với tháng trước)')}${optP('thang_truoc', 'Tháng trước')}
          ${optP('30', '30 ngày qua')}${optP('hk1', 'Học kỳ I')}${optP('hk2', 'Học kỳ II')}${optP('nam', 'Cả năm học')}${optP('tuy', 'Tùy chọn…')}</select></label>
        <label>Từ ngày<input type="date" id="cc-tu" class="input" value="${F.tu}"></label>
        <label>Đến ngày<input type="date" id="cc-den" class="input" value="${F.den}"></label>
      </span>
      ${coDT() ? `<label>Điểm trường<select id="cc-dt" class="input"><option value="">Toàn trường</option>${optDT(F.dt)}</select></label>` : ''}
    </div>
    <p class="muted small" id="cc-mota"></p>
    ${!loaiCC.size ? '<p class="err small">Chưa có hình thức vi phạm nào được đánh dấu “Chuyên cần”. Người có quyền “Sửa hình thức vi phạm” vào phân hệ Vi phạm → <b>Danh mục</b>, cột “Chuyên cần”, chọn cho các hình thức nghỉ có phép / không phép / cúp tiết.</p>'
      : `<p class="muted small">Tính từ các vi phạm: ${[...new Set(S.loai.filter(l => l.chuyen_can).map(l => `${esc(l.ten)} (${CC[l.chuyen_can]})`))].join('; ')}. Lớp không có vi phạm chuyên cần được tính là đủ sĩ số. Sĩ số = số học sinh đang học hiện nay.</p>`}
  </section>
  <div class="kpis" id="cc-kpi"></div>
  <section class="card hidden" id="cc-card-dt"><div class="head-row"><h3>Theo điểm trường</h3></div><div class="table-wrap" id="cc-bang-dt"></div></section>
  <section class="card"><div class="head-row"><h3 id="cc-td-lop">Theo lớp</h3>
    <div class="row-gap"><span class="row-gap hidden" id="cc-nghi-nut"><button type="button" class="btn sm" id="cc-nghi-het">Tất cả lớp nghỉ buổi này</button><button type="button" class="btn sm" id="cc-nghi-bo">Bỏ đánh dấu nghỉ</button></span>
    <button type="button" class="btn sm" id="cc-csv-lop">Xuất CSV</button></div></div>
    <p class="muted small" id="cc-gc-lop"></p><div class="table-wrap" id="cc-bang-lop"></div></section>
  <section class="card hidden" id="cc-card-bd"><h3>Diễn biến theo ngày</h3><div class="chart-box"><canvas id="c-cc"></canvas></div></section>
  <section class="card"><div class="head-row"><h3 id="cc-td-hs">Học sinh vắng</h3><button type="button" class="btn sm" id="cc-csv-hs">Xuất CSV</button></div>
    <div class="table-wrap" id="cc-bang-hs"></div></section>`;

  const hienLoc = () => {
    $('#cc-loc-buoi').classList.toggle('hidden', F.cheDo !== 'buoi');
    $('#cc-loc-khoang').classList.toggle('hidden', F.cheDo !== 'khoang');
  };
  hienLoc();

  const lay = (tu, den) => layHet(() => {
    let q = sb.from('v_vi_pham').select('id,hoc_sinh_id,ho_ten,lop_id,ten_lop,diem_truong_id,loai_id,thoi_gian,ten_nguoi_ghi')
      .in('loai_id', [...loaiCC.keys()]).gte('thoi_gian', tuNgay(tu)).lt('thoi_gian', denNgay(den)).order('id');
    if (F.dt) q = q.eq('diem_truong_id', +F.dt);
    return q;
  }).then(a => a.filter(r => r.hoc_sinh_id).map(r => ({ ...r, cc: loaiCC.get(r.loai_id), ngay: ngayVN(r.thoi_gian), buoi: buoiCC(r.thoi_gian) })));

  /* Lớp nghỉ theo buổi (bảng lop_nghi) */
  let coBangNghi = true;
  const layNghi = async ngay => {
    const { data, error } = await sb.from('lop_nghi').select('lop_id,nguoi,luc').eq('ngay', ngay).eq('buoi', F.buoi);
    if (error) { coBangNghi = false; return new Set(); }
    if (ngay === F.ngay) aiDanh = new Map(data.map(r => [r.lop_id, r]));
    return new Set(data.map(r => r.lop_id));
  };
  const coTheDanhNghi = () => true;   // mọi tài khoản đã được duyệt (máy chủ kiểm tra lại)
  let aiDanh = new Map();   // lop_id → { nguoi, luc } của buổi đang xem
  const danhNghi = async (ids, nghi) => {
    ids = ids.filter(id => coTheDanhNghi(S.lopMap.get(id)));
    if (!ids.length) return;
    const r = nghi
      ? await sb.from('lop_nghi').upsert(ids.map(id => ({ ngay: F.ngay, buoi: F.buoi, lop_id: id })), { onConflict: 'ngay,buoi,lop_id', ignoreDuplicates: true })
      : await sb.from('lop_nghi').delete().eq('ngay', F.ngay).eq('buoi', F.buoi).in('lop_id', ids);
    if (r.error) toast(dichLoi(r.error), 'err');
    else if (ids.length > 1) toast(nghi ? `Đã đánh dấu ${ids.length} lớp nghỉ buổi ${tenBuoi(F.buoi)} ${vn(F.ngay)}.` : 'Đã bỏ đánh dấu lớp nghỉ.');
    await taiBuoi();
  };
  const dsLop = () => (F.dt ? S.lop.filter(l => String(l.diem_truong_id) === String(F.dt)) : S.lop);
  const siSoLop = id => S.hs.filter(h => h.lop_id === id && h.dang_hoc).length;
  let xuatLop = null, xuatHS = null, lanTai = 0;

  /* ---------- Từng buổi ---------- */
  function tinhBuoi(rows) {   // theo lớp: tập học sinh nghỉ có phép / không phép / cúp tiết
    const m = new Map();
    for (const r of rows) {
      let o = m.get(r.lop_id);
      if (!o) m.set(r.lop_id, o = { cp: new Set(), kp: new Set(), ct: new Set() });
      ({ co_phep: o.cp, khong_phep: o.kp, cup_tiet: o.ct })[r.cc].add(r.hoc_sinh_id);
    }
    return m;
  }
  function soLieuLop(o, siSo, nghi = false) {
    if (nghi) return { nghi: true, siSo: 0, cp: 0, kp: 0, ct: 0, vang: 0, coMat: 0, tyLe: null, coVP: !!o };   // lớp nghỉ: không tính
    const cp = o ? o.cp.size : 0, kp = o ? [...o.kp].filter(h => !o.cp.has(h)).length : 0, ct = o ? o.ct.size : 0;
    const vang = cp + kp, coMat = Math.max(0, siSo - vang);
    return { siSo, cp, kp, ct, vang, coMat, tyLe: pct(coMat, siSo) };
  }
  const cong = (a, b) => { for (const k of ['siSo', 'cp', 'kp', 'ct', 'vang', 'coMat']) a[k] = (a[k] || 0) + b[k]; a.tyLe = pct(a.coMat, a.siSo); return a; };

  async function taiBuoi() {
    const lan = ++lanTai;
    const ngay = F.ngay, ngaySS = F.ss === 'tuan' ? congNgay(ngay, -7) : F.ss === 'thang' ? congThang(ngay, -1) : ngayHocTruoc(ngay);
    const nhanSS = F.ss === 'tuan' ? 'Tuần trước' : F.ss === 'thang' ? 'Tháng trước' : 'Buổi trước';
    $('#cc-mota').innerHTML = `Buổi <b>${tenBuoi(F.buoi)} ${thuNgay(ngay)}</b> · so với buổi ${tenBuoi(F.buoi)} ${thuNgay(ngaySS)} (${nhanSS.toLowerCase()})`;
    $('#cc-kpi').innerHTML = '<p class="muted">Đang tải…</p>';
    let cur, prev, nghi, nghiP;
    try { [cur, prev, nghi, nghiP] = await Promise.all([lay(ngay, ngay), lay(ngaySS, ngaySS), layNghi(ngay), layNghi(ngaySS)]); }
    catch (e) { if (lan === lanTai && conSong()) $('#cc-kpi').innerHTML = `<p class="err">${esc(dichLoi(e))}</p>`; return; }
    if (lan !== lanTai || !conSong()) return;
    cur = cur.filter(r => r.buoi === F.buoi); prev = prev.filter(r => r.buoi === F.buoi);
    const mc = tinhBuoi(cur), mp = tinhBuoi(prev);

    const lops = dsLop().map(l => {
      const ss = siSoLop(l.id);
      return { l, c: soLieuLop(mc.get(l.id), ss, nghi.has(l.id)), p: soLieuLop(mp.get(l.id), ss, nghiP.has(l.id)) };
    });
    const soNghi = lops.filter(x => x.c.nghi).length;
    const nghiCoVP = lops.filter(x => x.c.nghi && x.c.coVP).map(x => x.l.ten_lop);
    // Ở chế độ đánh dấu, bỏ qua học sinh của lớp nghỉ trong danh sách vắng
    cur = cur.filter(r => !nghi.has(r.lop_id));
    const tong = lops.reduce((a, x) => cong(a, x.c), {}), tongP = lops.reduce((a, x) => cong(a, x.p), {});

    const kpi = (ten, c, p, phu = '', laTyLe = false, tot = false) => `<div class="kpi"><span>${ten}</span><b>${laTyLe ? fmtPct(c) : so(c)}</b>${laTyLe ? xuHuongPct(c, p) : tot ? xuHuongTot(c, p) : xuHuong(c, p)}<small>${nhanSS}: ${laTyLe ? fmtPct(p) : so(p)}${phu}</small></div>`;
    $('#cc-kpi').innerHTML =
      `<div class="kpi"><span>Sĩ số</span><b>${so(tong.siSo || 0)}</b><small>${lops.length - soNghi} lớp học${soNghi ? ` · ${soNghi} lớp nghỉ` : ''}</small></div>` +
      `<div class="kpi"><span>Có mặt</span><b>${so(tong.coMat || 0)}<small class="kpi-phu"> / ${so(tong.siSo || 0)}</small></b><small>${nhanSS}: ${so(tongP.coMat || 0)} / ${so(tongP.siSo || 0)}</small></div>` +
      kpi('Tỷ lệ chuyên cần', tong.tyLe, tongP.tyLe, '', true) +
      kpi('Nghỉ có phép', tong.cp || 0, tongP.cp || 0) +
      kpi('Nghỉ không phép', tong.kp || 0, tongP.kp || 0) +
      kpi('Cúp tiết', tong.ct || 0, tongP.ct || 0);

    // Theo điểm trường
    const hienDT = coDT() && !F.dt;
    $('#cc-card-dt').classList.toggle('hidden', !hienDT);
    const dongSo = (ten, c, p, extra = '') => `<td class="r">${so(c.siSo)}</td><td class="r">${so(c.coMat)}</td><td class="r">${c.cp || ''}</td><td class="r">${c.kp ? `<b class="chu-do">${c.kp}</b>` : ''}</td><td class="r">${c.ct ? `<b class="chu-do">${c.ct}</b>` : ''}</td>
      <td class="r"><b>${fmtPct(c.tyLe)}</b></td><td class="r">${fmtPct(p.tyLe)}</td><td>${xuHuongPct(c.tyLe, p.tyLe)}</td>${extra}`;
    const dauBang = (cot1, them = '') => `<thead><tr>${cot1}<th class="r">Sĩ số</th><th class="r">Có mặt</th><th class="r">Nghỉ có phép</th><th class="r">Nghỉ không phép</th><th class="r">Cúp tiết</th><th class="r">Tỷ lệ CC</th><th class="r">${nhanSS}</th><th>Tăng / giảm</th>${them}</tr></thead>`;
    if (hienDT) {
      const nhom = [...S.dt.map(d => [d.id, d.ten]), [null, 'Chưa xếp điểm trường']].map(([id, ten]) => {
        const a = lops.filter(x => (x.l.diem_truong_id ?? null) === id);
        return { ten, n: a.filter(x => !x.c.nghi).length, nghi: a.filter(x => x.c.nghi).length, c: a.reduce((s, x) => cong(s, x.c), {}), p: a.reduce((s, x) => cong(s, x.p), {}) };
      }).filter(g => g.n + g.nghi);
      const oSoLop = (n, ng) => `<td class="r">${n}${ng ? ` <span class="muted small">(+${ng} nghỉ)</span>` : ''}</td>`;
      $('#cc-bang-dt').innerHTML = `<table class="tbl">${dauBang('<th>Điểm trường</th><th class="r">Số lớp học</th>')}<tbody>
        ${nhom.map(g => `<tr><td><b>${esc(g.ten)}</b></td>${oSoLop(g.n, g.nghi)}${g.n ? dongSo(g.ten, g.c, g.p) : '<td colspan="8" class="muted">Cả điểm trường nghỉ buổi này</td>'}</tr>`).join('')}
        <tr class="dong-tong"><td><b>Toàn trường</b></td>${oSoLop(lops.length - soNghi, soNghi)}${dongSo('', tong, tongP)}</tr></tbody></table>`;
    }

    // Theo lớp
    $('#cc-td-lop').textContent = `Theo lớp – buổi ${tenBuoi(F.buoi)} ${vn(ngay)}`;
    const duocDanh = lops.some(x => coTheDanhNghi(x.l));
    $('#cc-gc-lop').innerHTML = (coBangNghi
        ? '<b>Tick ô “Nghỉ”</b> cho lớp không học buổi này (lưu ngay, mọi người cùng thấy; rê chuột vào ô để xem ai đánh dấu) – lớp nghỉ không tính vào thống kê. '
        : '<span class="err">Chưa chạy file supabase/20-chuyen-can.sql nên chưa đánh dấu được lớp nghỉ. </span>')
      + 'Lớp có học sinh nghỉ không phép hoặc cúp tiết được tô màu. Cúp tiết: học sinh vẫn tính là có mặt.'
      + (nghiCoVP.length ? `<br><span class="chu-do">⚠ Lớp ${esc(nghiCoVP.join(', '))} được đánh dấu nghỉ nhưng buổi này vẫn có vi phạm chuyên cần được ghi – kiểm tra lại.</span>` : '');
    $('#cc-nghi-nut').classList.toggle('hidden', !(coBangNghi && duocDanh));
    const aiTick = x => { const a = aiDanh.get(x.l.id); return a?.luc ? `Đánh dấu nghỉ bởi ${tenND(a.nguoi) || 'không rõ'} lúc ${fmtGio(a.luc)}` : `Tick nếu lớp ${x.l.ten_lop} nghỉ buổi này`; };
    const oNghi = x => coBangNghi ? `<td class="c"><input type="checkbox" data-lop-nghi="${x.l.id}" ${x.c.nghi ? 'checked' : ''} title="${esc(aiTick(x))}" aria-label="${esc(aiTick(x))}"></td>` : '';
    $('#cc-bang-lop').innerHTML = lops.length ? `<table class="tbl">${dauBang(`${coBangNghi ? '<th class="c">Nghỉ</th>' : ''}<th>Lớp</th>${coDT() ? '<th>Điểm trường</th>' : ''}`)}<tbody>
      ${lops.map(x => x.c.nghi
        ? `<tr class="dong-nghi">${oNghi(x)}<td><b>${esc(x.l.ten_lop)}</b></td>${coDT() ? `<td class="small">${esc(tenDT(x.l.diem_truong_id))}</td>` : ''}<td colspan="8"><span class="tag-nghi">Lớp nghỉ</span>${aiDanh.get(x.l.id)?.luc ? ` <span class="small">· ${esc(tenND(aiDanh.get(x.l.id).nguoi) || '')} ${fmtGio(aiDanh.get(x.l.id).luc)}</span>` : ''}${x.c.coVP ? ' <span class="chu-do small">⚠ vẫn có vi phạm chuyên cần</span>' : ''}</td></tr>`
        : `<tr class="${x.c.kp || x.c.ct ? 'dong-canh-bao' : ''}">${oNghi(x)}<td><b>${esc(x.l.ten_lop)}</b></td>${coDT() ? `<td class="small">${esc(tenDT(x.l.diem_truong_id))}</td>` : ''}${dongSo(x.l.ten_lop, x.c, x.p)}</tr>`).join('')}
      <tr class="dong-tong">${coBangNghi ? '<td></td>' : ''}<td><b>Tổng</b></td>${coDT() ? '<td></td>' : ''}${dongSo('', tong, tongP)}</tr></tbody></table>` : '<p class="muted pad">Chưa có lớp.</p>';
    xuatLop = () => xuatCSV(`chuyen-can_${F.buoi}_${ngay}.csv`,
      ['Lớp', 'Điểm trường', 'Sĩ số', 'Có mặt', 'Nghỉ có phép', 'Nghỉ không phép', 'Cúp tiết', 'Tỷ lệ chuyên cần (%)', `${nhanSS} (%)`],
      [...lops.map(x => x.c.nghi ? [x.l.ten_lop, tenDT(x.l.diem_truong_id), 'Lớp nghỉ', '', '', '', '', '', x.p.tyLe ?? '']
        : [x.l.ten_lop, tenDT(x.l.diem_truong_id), x.c.siSo, x.c.coMat, x.c.cp, x.c.kp, x.c.ct, x.c.tyLe ?? '', x.p.tyLe ?? '']),
       ['Tổng', '', tong.siSo || 0, tong.coMat || 0, tong.cp || 0, tong.kp || 0, tong.ct || 0, tong.tyLe ?? '', tongP.tyLe ?? '']]);

    // Học sinh vắng trong buổi
    $('#cc-card-bd').classList.add('hidden');
    const ds = [...cur].sort((a, b) => a.ten_lop.localeCompare(b.ten_lop, 'vi', { numeric: true }) || soSanhTen(a, b));
    $('#cc-td-hs').textContent = `Học sinh vắng / cúp tiết – buổi ${tenBuoi(F.buoi)} ${vn(ngay)} (${new Set(ds.map(r => r.hoc_sinh_id)).size} em)`;
    $('#cc-bang-hs').innerHTML = ds.length ? `<table class="tbl"><thead><tr><th>Lớp</th><th>Học sinh</th><th>Loại</th><th>Ghi nhận lúc</th><th>Người ghi</th></tr></thead><tbody>
      ${ds.map(r => `<tr><td>${esc(r.ten_lop)}</td><td><a href="#" data-lsu="${r.hoc_sinh_id}">${esc(r.ho_ten)}</a></td><td><span class="tag-cc tag-${r.cc}">${CC[r.cc]}</span></td><td class="nowrap">${gioPhutVN(r.thoi_gian)}</td><td class="small">${esc(r.ten_nguoi_ghi || '')}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted pad">Không có học sinh vắng hay cúp tiết trong buổi này. 🎉</p>';
    xuatHS = () => xuatCSV(`hoc-sinh-vang_${F.buoi}_${ngay}.csv`, ['Lớp', 'Học sinh', 'Loại', 'Ghi nhận lúc', 'Người ghi'],
      ds.map(r => [r.ten_lop, r.ho_ten, CC[r.cc], fmtTG(r.thoi_gian), r.ten_nguoi_ghi]));
  }

  /* ---------- Tuần / tháng / khoảng ---------- */
  function tinhKhoang(rows) {
    const m = new Map();
    for (const r of rows) {
      let o = m.get(r.lop_id);
      if (!o) m.set(r.lop_id, o = { cp: 0, kp: 0, ct: 0, hs: new Set() });
      o[{ co_phep: 'cp', khong_phep: 'kp', cup_tiet: 'ct' }[r.cc]]++; o.hs.add(r.hoc_sinh_id);
    }
    return m;
  }
  async function taiKhoang() {
    const lan = ++lanTai;
    huyChart();
    $('#cc-nghi-nut').classList.add('hidden');
    const K = F.preset === 'tuy' ? khoangTK('tuy', F.tu, F.den) : khoangTK(F.preset);
    if (F.preset !== 'tuy') { F.tu = K.tu; F.den = K.den; $('#cc-tu').value = K.tu; $('#cc-den').value = K.den; }
    if (!K.tu || !K.den || K.tu > K.den) { $('#cc-mota').textContent = 'Khoảng thời gian không hợp lệ.'; $('#cc-kpi').innerHTML = ''; return; }
    const soNgayHoc = (a, b) => { let n = 0; for (let d = a; d <= b; d = congNgay(d, 1)) if (thuCua(d) !== 0) n++; return n; };
    const nNgay = soNgayHoc(K.tu, K.den);
    $('#cc-mota').innerHTML = `<b>${K.a}</b>: ${vn(K.tu)} – ${vn(K.den)} (${nNgay} ngày học, không tính Chủ nhật) · so với <b>${K.b}</b>: ${vn(K.pTu)} – ${vn(K.pDen)}`;
    $('#cc-kpi').innerHTML = '<p class="muted">Đang tải…</p>';
    let cur, prev;
    try { [cur, prev] = await Promise.all([lay(K.tu, K.den), lay(K.pTu, K.pDen)]); }
    catch (e) { if (lan === lanTai && conSong()) $('#cc-kpi').innerHTML = `<p class="err">${esc(dichLoi(e))}</p>`; return; }
    if (lan !== lanTai || !conSong()) return;
    const mc = tinhKhoang(cur), mp = tinhKhoang(prev);
    const dem = (a, k) => a.filter(r => r.cc === k).length;
    const siSoTong = dsLop().reduce((s, l) => s + siSoLop(l.id), 0);
    const vangC = dem(cur, 'co_phep') + dem(cur, 'khong_phep'), vangP = dem(prev, 'co_phep') + dem(prev, 'khong_phep');
    const kpi = (ten, c, p, phu = '') => `<div class="kpi"><span>${ten}</span><b>${so(c)}</b>${xuHuong(c, p)}<small>${K.b}: ${so(p)}${phu}</small></div>`;
    $('#cc-kpi').innerHTML =
      `<div class="kpi"><span>Sĩ số</span><b>${so(siSoTong)}</b><small>${dsLop().length} lớp</small></div>` +
      kpi('Lượt nghỉ có phép', dem(cur, 'co_phep'), dem(prev, 'co_phep')) +
      kpi('Lượt nghỉ không phép', dem(cur, 'khong_phep'), dem(prev, 'khong_phep')) +
      kpi('Lượt cúp tiết', dem(cur, 'cup_tiet'), dem(prev, 'cup_tiet')) +
      kpi('Học sinh có vắng / cúp tiết', new Set(cur.map(r => r.hoc_sinh_id)).size, new Set(prev.map(r => r.hoc_sinh_id)).size) +
      `<div class="kpi"><span>Lượt vắng TB mỗi ngày học</span><b>${nNgay ? so(Math.round(vangC / nNgay * 10) / 10) : '–'}</b><small>${so(vangC)} lượt vắng / ${nNgay} ngày</small></div>`;

    const lops = dsLop().map(l => {
      const ss = siSoLop(l.id), c = mc.get(l.id) || { cp: 0, kp: 0, ct: 0, hs: new Set() }, p = mp.get(l.id) || { cp: 0, kp: 0, ct: 0, hs: new Set() };
      return { l, ss, c, p, vang: c.cp + c.kp, vangP: p.cp + p.kp, tram: ss ? (c.cp + c.kp) / ss * 100 : 0 };
    }).sort((a, b) => (b.c.kp + b.c.ct) - (a.c.kp + a.c.ct) || b.vang - a.vang || a.l.ten_lop.localeCompare(b.l.ten_lop, 'vi', { numeric: true }));
    const dau = cot1 => `<thead><tr>${cot1}<th class="r">Sĩ số</th><th class="r">Nghỉ có phép</th><th class="r">Nghỉ không phép</th><th class="r">Cúp tiết</th><th class="r">Tổng lượt vắng</th><th class="r">Vắng / 100 HS</th><th class="r">HS liên quan</th><th class="r">${K.b} (lượt vắng)</th><th>Tăng / giảm</th></tr></thead>`;
    const o = (ss, c, vang, vangP) => `<td class="r">${ss}</td><td class="r">${c.cp || ''}</td><td class="r">${c.kp ? `<b class="chu-do">${c.kp}</b>` : ''}</td><td class="r">${c.ct ? `<b class="chu-do">${c.ct}</b>` : ''}</td>
      <td class="r"><b>${vang}</b></td><td class="r">${ss ? so(Math.round(vang / ss * 1000) / 10) : '–'}</td><td class="r">${c.hs.size || ''}</td><td class="r">${vangP}</td><td>${xuHuong(vang, vangP)}</td>`;

    const hienDT = coDT() && !F.dt;
    $('#cc-card-dt').classList.toggle('hidden', !hienDT);
    if (hienDT) {
      const nhom = [...S.dt.map(d => [d.id, d.ten]), [null, 'Chưa xếp điểm trường']].map(([id, ten]) => {
        const a = lops.filter(x => (x.l.diem_truong_id ?? null) === id);
        const c = { cp: 0, kp: 0, ct: 0, hs: new Set() }; let ss = 0, vang = 0, vangP = 0;
        a.forEach(x => { ss += x.ss; c.cp += x.c.cp; c.kp += x.c.kp; c.ct += x.c.ct; x.c.hs.forEach(h => c.hs.add(h)); vang += x.vang; vangP += x.vangP; });
        return { ten, n: a.length, ss, c, vang, vangP };
      }).filter(g => g.n);
      $('#cc-bang-dt').innerHTML = `<table class="tbl">${dau('<th>Điểm trường</th><th class="r">Số lớp</th>')}<tbody>
        ${nhom.map(g => `<tr><td><b>${esc(g.ten)}</b></td><td class="r">${g.n}</td>${o(g.ss, g.c, g.vang, g.vangP)}</tr>`).join('')}</tbody></table>`;
    }
    $('#cc-td-lop').textContent = `Theo lớp – ${K.a.toLowerCase()}`;
    $('#cc-gc-lop').innerHTML = 'Xếp lớp có nhiều lượt nghỉ không phép + cúp tiết lên đầu. “Vắng / 100 HS” giúp so sánh các lớp có sĩ số khác nhau.';
    $('#cc-bang-lop').innerHTML = lops.length ? `<table class="tbl">${dau(`<th>#</th><th>Lớp</th>${coDT() ? '<th>Điểm trường</th>' : ''}`)}<tbody>
      ${lops.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(x.l.ten_lop)}</b></td>${coDT() ? `<td class="small">${esc(tenDT(x.l.diem_truong_id))}</td>` : ''}${o(x.ss, x.c, x.vang, x.vangP)}</tr>`).join('')}</tbody></table>` : '<p class="muted pad">Chưa có lớp.</p>';
    xuatLop = () => xuatCSV(`chuyen-can_${K.tu}_${K.den}.csv`,
      ['Lớp', 'Điểm trường', 'Sĩ số', 'Nghỉ có phép', 'Nghỉ không phép', 'Cúp tiết', 'Tổng lượt vắng', 'Vắng / 100 HS', 'HS liên quan', `${K.b} (lượt vắng)`],
      lops.map(x => [x.l.ten_lop, tenDT(x.l.diem_truong_id), x.ss, x.c.cp, x.c.kp, x.c.ct, x.vang, x.ss ? Math.round(x.vang / x.ss * 1000) / 10 : '', x.c.hs.size, x.vangP]));

    // Biểu đồ theo ngày
    $('#cc-card-bd').classList.remove('hidden');
    const ngays = []; for (let d = K.tu; d <= K.den; d = congNgay(d, 1)) if (thuCua(d) !== 0) ngays.push(d);
    const c = mau();
    veChart('c-cc', {
      type: 'bar',
      data: {
        labels: ngays.map(d => THU[thuCua(d)] + ' ' + vn(d).slice(0, 5)),
        datasets: [['co_phep', c.ok], ['khong_phep', c.err], ['cup_tiet', c.warn]].map(([k, mauK]) => ({
          label: CC[k], backgroundColor: mauK, borderRadius: 3, data: ngays.map(d => cur.filter(r => r.ngay === d && r.cc === k).length) }))
      },
      options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom' } } }
    });

    // Học sinh vắng nhiều
    const mh = new Map();
    for (const r of cur) {
      let x = mh.get(r.hoc_sinh_id);
      if (!x) mh.set(r.hoc_sinh_id, x = { id: r.hoc_sinh_id, ten: r.ho_ten, lop: r.ten_lop, cp: 0, kp: 0, ct: 0 });
      x[{ co_phep: 'cp', khong_phep: 'kp', cup_tiet: 'ct' }[r.cc]]++;
    }
    const ds = [...mh.values()].sort((a, b) => (b.kp + b.ct) - (a.kp + a.ct) || (b.cp - a.cp)).slice(0, 100);
    $('#cc-td-hs').textContent = `Học sinh vắng / cúp tiết nhiều – ${K.a.toLowerCase()} (${mh.size} em)`;
    $('#cc-bang-hs').innerHTML = ds.length ? `<table class="tbl"><thead><tr><th>#</th><th>Học sinh</th><th>Lớp</th><th class="r">Nghỉ có phép</th><th class="r">Nghỉ không phép</th><th class="r">Cúp tiết</th><th class="r">Tổng</th></tr></thead><tbody>
      ${ds.map((x, i) => `<tr><td>${i + 1}</td><td><a href="#" data-lsu="${x.id}">${esc(x.ten)}</a></td><td>${esc(x.lop)}</td><td class="r">${x.cp || ''}</td><td class="r">${x.kp ? `<b class="chu-do">${x.kp}</b>` : ''}</td><td class="r">${x.ct ? `<b class="chu-do">${x.ct}</b>` : ''}</td><td class="r"><b>${x.cp + x.kp + x.ct}</b></td></tr>`).join('')}</tbody></table>`
      : '<p class="muted pad">Không có học sinh vắng hay cúp tiết trong khoảng thời gian này. 🎉</p>';
    xuatHS = () => xuatCSV(`hoc-sinh-vang_${K.tu}_${K.den}.csv`, ['Học sinh', 'Lớp', 'Nghỉ có phép', 'Nghỉ không phép', 'Cúp tiết', 'Tổng'],
      ds.map(x => [x.ten, x.lop, x.cp, x.kp, x.ct, x.cp + x.kp + x.ct]));
  }

  const tai = () => {
    if (!loaiCC.size) { $('#cc-kpi').innerHTML = ''; $('#cc-bang-lop').innerHTML = ''; $('#cc-bang-hs').innerHTML = ''; return; }
    return F.cheDo === 'buoi' ? taiBuoi() : taiKhoang();
  };
  el.onchange = e => {
    const id = e.target.id, v = e.target.value;
    if (e.target.dataset.lopNghi) { e.target.disabled = true; danhNghi([+e.target.dataset.lopNghi], e.target.checked); return; }
    if (id === 'cc-che-do') { F.cheDo = v; hienLoc(); }
    else if (id === 'cc-ngay') { if (!v) return; F.ngay = v; }
    else if (id === 'cc-buoi') F.buoi = v;
    else if (id === 'cc-ss') F.ss = v;
    else if (id === 'cc-preset') F.preset = v;
    else if (id === 'cc-tu' || id === 'cc-den') { F.preset = 'tuy'; $('#cc-preset').value = 'tuy'; F.tu = $('#cc-tu').value; F.den = $('#cc-den').value; }
    else if (id === 'cc-dt') F.dt = v;
    else return;
    tai();
  };
  el.onclick = e => {
    if (e.target.id === 'cc-nghi-het') {
      const ids = dsLop().filter(coTheDanhNghi).map(l => l.id);
      if (confirm(`Đánh dấu ${ids.length} lớp${F.dt ? ' của điểm trường ' + tenDT(+F.dt) : ''} nghỉ buổi ${tenBuoi(F.buoi)} ${vn(F.ngay)}?`)) danhNghi(ids, true);
      return;
    }
    if (e.target.id === 'cc-nghi-bo') {
      if (confirm(`Bỏ đánh dấu nghỉ cho mọi lớp${F.dt ? ' của điểm trường ' + tenDT(+F.dt) : ''} buổi ${tenBuoi(F.buoi)} ${vn(F.ngay)}?`)) danhNghi(dsLop().map(l => l.id), false);
      return;
    }
    const t = e.target.closest('[data-lsu],#cc-csv-lop,#cc-csv-hs'); if (!t) return;
    if (t.dataset.lsu) { e.preventDefault(); lichSuHS(+t.dataset.lsu); }
    else if (t.id === 'cc-csv-lop') xuatLop && xuatLop();
    else if (t.id === 'cc-csv-hs') xuatHS && xuatHS();
  };
  await tai();
}

