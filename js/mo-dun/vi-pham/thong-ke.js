'use strict';
/* =====================================================================
   PHÂN HỆ VI PHẠM – THỐNG KÊ
   ===================================================================== */

async function veThongKeVP(el) {
  const F = S.locTK || (S.locTK = { preset: 'tuan', tu: '', den: '', dt: '', lop: '', loai: '' });
  // Chuyển bộ lọc cũ (một loại / một nhóm) sang danh sách nhiều loại
  if (!Array.isArray(F.loaiDs)) {
    const cu = F.loai || '';
    F.loaiDs = cu.startsWith('n:') ? S.loai.filter(l => (l.nhom || 'Khác') === (cu.slice(2) || 'Khác')).map(l => l.id) : cu ? [+cu] : [];
    delete F.loai;
  }
  F.loaiDs = F.loaiDs.filter(id => S.loai.some(l => l.id === id));
  if (F.dt && !S.dtMap.has(+F.dt)) F.dt = '';
  el.innerHTML = `
  <section class="card">
    <div class="filters">
      <label>Khoảng thời gian<select id="tk-preset" class="input">
        <option value="tuan">Tuần này (so với tuần trước)</option>
        <option value="tuan_truoc">Tuần trước</option>
        <option value="thang">Tháng này</option>
        <option value="thang_truoc">Tháng trước</option>
        <option value="30">30 ngày qua</option>
        <option value="hk1">Học kỳ I</option><option value="hk2">Học kỳ II</option>
        <option value="nam">Cả năm học</option><option value="tuy">Tùy chọn…</option></select></label>
      <label>Từ ngày<input type="date" id="tk-tu" class="input"></label>
      <label>Đến ngày<input type="date" id="tk-den" class="input"></label>
      ${coDT() ? `<label>Điểm trường<select id="tk-dt" class="input"><option value="">Toàn trường</option>${optDT(F.dt)}</select></label>` : ''}
      <label>Lớp<select id="tk-lop" class="input"></select></label>
      <div class="grow loc-loai"><span>Loại vi phạm</span>
        <button type="button" class="input chon-nhieu" id="tk-loai-nut" aria-haspopup="true"><span id="tk-loai-nhan">${esc(moTaLoaiChon(F.loaiDs))}</span><span class="mui">▾</span></button>
        <div class="bang-chon hidden" id="tk-loai-bang">
          <div class="bang-chon-dau">
            <input class="input sm" id="tk-loai-tim" placeholder="Tìm loại vi phạm…" autocomplete="off">
            <button type="button" class="btn sm" id="tk-loai-bo">Bỏ chọn hết</button>
            <button type="button" class="btn sm primary" id="tk-loai-xong">Xong</button>
          </div>
          <p class="muted small bang-chon-gc">Không tick gì = tất cả loại vi phạm. Tick tên nhóm để chọn cả nhóm.</p>
          <div class="bang-chon-ds" id="tk-loai-ds">${bangChonLoai(F.loaiDs)}</div>
        </div>
      </div>
    </div>
    <p class="muted small" id="tk-mota"></p>
  </section>
  <div class="kpis" id="tk-kpi"></div>
  <div id="tk-chu-y"></div>
  <div class="grid2">
    <section class="card"><h3>Diễn biến số vi phạm</h3><div class="chart-box"><canvas id="c-dien-bien"></canvas></div></section>
    <section class="card"><h3>Theo hình thức vi phạm</h3><div class="chart-box"><canvas id="c-loai"></canvas></div></section>
  </div>
  <div class="grid3">
    <section class="card"><h3>Theo nhóm vi phạm</h3><div class="chart-box sm"><canvas id="c-nhom"></canvas></div></section>
    <section class="card"><h3>Theo mức độ</h3><div class="chart-box sm"><canvas id="c-muc-do"></canvas></div></section>
    <section class="card"><h3>Tình trạng xử lý</h3><div class="chart-box sm"><canvas id="c-xu-ly"></canvas></div></section>
  </div>
  <section class="card"><div class="head-row"><h3>Thống kê theo loại vi phạm</h3><button type="button" class="btn sm" id="csv-loai">Xuất CSV</button></div>
    <p class="muted small">Gộp theo nhóm; bấm tên loại vi phạm để xem lớp và học sinh vi phạm loại đó.</p>
    <div class="table-wrap" id="tk-bang-loai"></div></section>
  <section class="card"><h3>Vi phạm theo thứ trong tuần và buổi</h3><p class="muted small">Giúp nhận ra thời điểm cần tăng cường giám sát.</p><div class="chart-box sm"><canvas id="c-thu"></canvas></div></section>
  <section class="card hidden" id="card-dt"><div class="head-row"><h3>Theo điểm trường</h3></div>
    <div class="chart-box sm"><canvas id="c-dt"></canvas></div><div class="table-wrap" id="tk-bang-dt"></div></section>
  <section class="card"><div class="head-row"><h3>Theo lớp</h3></div>
    <div class="chart-box" id="box-c-lop"><canvas id="c-lop"></canvas></div>
    <div class="head-row bang-dau"><p class="muted small">Xếp theo <b>điểm trừ giảm dần</b>. Bấm tên lớp để xem chi tiết. “VP / HS” = số vi phạm của học sinh chia cho sĩ số.</p>
      <button type="button" class="btn sm" id="csv-lop-2">Xuất CSV</button></div>
    <div class="table-wrap" id="tk-bang-lop"></div></section>
  <section class="card"><div class="head-row"><h3>Học sinh vi phạm nhiều nhất</h3><button type="button" class="btn sm" id="csv-hs">Xuất CSV</button></div>
    <div class="table-wrap" id="tk-hs"></div></section>
  <section class="card"><h3>Theo người ghi nhận</h3><div class="table-wrap" id="tk-nguoi-ghi"></div></section>`;

  $('#tk-preset').value = F.preset;
  if (F.preset === 'tuy') { $('#tk-tu').value = F.tu; $('#tk-den').value = F.den; }

  const veOptLop = () => {
    const ds = F.dt ? S.lop.filter(l => String(l.diem_truong_id) === String(F.dt)) : S.lop;
    if (F.lop && !ds.some(l => String(l.id) === String(F.lop))) F.lop = '';
    $('#tk-lop').innerHTML = `<option value="">Tất cả lớp</option>${optLop(F.lop, ds)}`;
  };

  let bangLop = [], bangHS = [], bangLoai = [], dataCur = [], K = {};

  let lanTai = 0;
  async function tai() {
    const lan = ++lanTai, conSong = giuPhien();
    const moiNhat = () => lan === lanTai && conSong();
    F.preset = $('#tk-preset').value;
    if (F.preset !== 'tuy') { K = khoangTK(F.preset); F.tu = K.tu; F.den = K.den; $('#tk-tu').value = K.tu; $('#tk-den').value = K.den; }
    else { F.tu = $('#tk-tu').value; F.den = $('#tk-den').value; K = khoangTK('tuy', F.tu, F.den); }
    F.lop = $('#tk-lop').value;
    const { tu, den, pTu, pDen, a: nhanA, b: nhanB } = K;
    huyChart();
    if (!tu || !den || tu > den) {
      $('#tk-mota').textContent = tu && tu > homNay() ? 'Khoảng thời gian này chưa bắt đầu.' : 'Khoảng thời gian không hợp lệ.';
      $('#tk-kpi').innerHTML = '';
      return;
    }
    const n = diffNgay(tu, den) + 1;
    const pham = (F.lop ? `lớp ${tenLop(+F.lop)}` : F.dt ? `điểm trường ${tenDT(+F.dt)}` : 'toàn trường') + (F.loaiDs.length ? ` · ${moTaLoaiChon(F.loaiDs)}` : '');
    $('#tk-mota').innerHTML = `<b>${nhanA}</b>: ${vn(tu)} – ${vn(den)} (${n} ngày) · so với <b>${nhanB}</b>: ${vn(pTu)} – ${vn(pDen)} · Phạm vi: ${esc(pham)}`;
    $('#tk-kpi').innerHTML = '<p class="muted">Đang tải…</p>';

    const cot = 'id,thoi_gian,tao_luc,hoc_sinh_id,ho_ten,lop_id,ten_lop,diem_truong_id,loai_id,ten_vi_pham,nhom,muc_do,diem_tru,pham_vi,trang_thai,nguoi_ghi,ten_nguoi_ghi,thoi_gian_xu_ly';
    const lay = (a, b) => layHet(() => {
      let q = sb.from('v_vi_pham').select(cot).gte('thoi_gian', tuNgay(a)).lt('thoi_gian', denNgay(b)).order('id');
      if (F.lop) q = q.eq('lop_id', +F.lop);
      else if (F.dt) q = q.eq('diem_truong_id', +F.dt);
      if (F.loaiDs.length) q = q.in('loai_id', F.loaiDs);
      return q;
    });
    let cur, prev;
    try { [cur, prev] = await Promise.all([lay(tu, den), lay(pTu, pDen)]); }
    catch (e) { if (moiNhat()) $('#tk-kpi').innerHTML = `<p class="err">${esc(dichLoi(e))}</p>`; return; }
    if (!moiNhat()) return;   // đã chuyển trang hoặc đã đổi bộ lọc trong lúc tải
    huyChart();
    cur.forEach(r => (r.ngay = ngayVN(r.thoi_gian)));
    prev.forEach(r => (r.ngay = ngayVN(r.thoi_gian)));
    dataCur = cur;

    const cuaHS = a => a.filter(r => r.hoc_sinh_id);
    const soHS = a => new Set(cuaHS(a).map(r => r.hoc_sinh_id)).size;
    const taiPham = a => { const m = {}; cuaHS(a).forEach(r => (m[r.hoc_sinh_id] = (m[r.hoc_sinh_id] || 0) + 1)); return Object.values(m).filter(x => x >= 2).length; };
    const diem = a => a.reduce((s, r) => s + (+r.diem_tru || 0), 0);
    const nang = a => a.filter(r => +r.muc_do === 3).length;
    const tapThe = a => a.filter(r => !r.hoc_sinh_id).length;
    const daXL = cur.filter(r => r.trang_thai === 'da_xu_ly');
    const gioXL = daXL.filter(r => r.thoi_gian_xu_ly).map(r => (new Date(r.thoi_gian_xu_ly) - new Date(r.tao_luc)) / 36e5).filter(x => x >= 0);
    const tbXL = gioXL.length ? gioXL.reduce((s, x) => s + x, 0) / gioXL.length : null;

    // KPI
    const kpi = (ten, c, p, phu = '') => `<div class="kpi"><span>${ten}</span><b>${so(c)}</b>${xuHuong(c, p)}<small>${nhanB}: ${so(p)}${phu}</small></div>`;
    $('#tk-kpi').innerHTML =
      kpi('Tổng số vi phạm', cur.length, prev.length) +
      kpi('Học sinh vi phạm', soHS(cur), soHS(prev), ` · ${taiPham(cur)} em tái phạm`) +
      kpi('Vi phạm tập thể lớp', tapThe(cur), tapThe(prev)) +
      kpi('Vi phạm mức Nặng', nang(cur), nang(prev)) +
      kpi('Tổng điểm trừ', diem(cur), diem(prev)) +
      `<div class="kpi"><span>Đã xử lý</span><b>${cur.length ? Math.round(daXL.length / cur.length * 100) : 0}%</b>
        <em class="${cur.length - daXL.length ? 'up' : 'flat'}">${cur.length - daXL.length} vi phạm chưa xong</em>
        <small>${daXL.length}/${cur.length}${tbXL != null ? ` · xử lý TB sau ${thoiGianTB(tbXL)}` : ''}</small></div>`;

    const c = mau();
    const kyNay = { label: nhanA, backgroundColor: c.pri, borderRadius: 4 };
    const kyTruoc = { label: nhanB, backgroundColor: c.prev, borderRadius: 4 };
    const legend = { legend: { position: 'bottom' } };

    // --- Cần chú ý
    const nangChua = cur.filter(r => +r.muc_do === 3 && r.trang_thai !== 'da_xu_ly').sort((x, y) => new Date(y.thoi_gian) - new Date(x.thoi_gian));
    const mHS = new Map();
    for (const r of cuaHS(cur)) {
      let o = mHS.get(r.hoc_sinh_id);
      if (!o) mHS.set(r.hoc_sinh_id, o = { id: r.hoc_sinh_id, ten: r.ho_ten, lop: r.ten_lop, c: 0, p: 0, diem: 0, chua: 0, nang: 0, loai: {} });
      o.c++; o.diem += +r.diem_tru || 0; if (r.trang_thai !== 'da_xu_ly') o.chua++; if (+r.muc_do === 3) o.nang++;
      o.loai[r.ten_vi_pham] = (o.loai[r.ten_vi_pham] || 0) + 1;
    }
    for (const r of cuaHS(prev)) { const o = mHS.get(r.hoc_sinh_id); if (o) o.p++; }
    const canTheoDoi = [...mHS.values()].filter(o => o.c >= 3 || o.nang || (o.c - o.p >= 2)).sort((x, y) => y.c - x.c || y.diem - x.diem).slice(0, 10);
    $('#tk-chu-y').innerHTML = (nangChua.length || canTheoDoi.length) ? `<section class="card chu-y"><h3>Cần chú ý</h3><div class="grid2 khong-le">
      <div><div class="nhom-ten">Vi phạm mức Nặng chưa xử lý xong (${nangChua.length})</div>
        ${nangChua.length ? `<ul class="recent">${nangChua.slice(0, 8).map(r => `<li><span class="muted">${fmtGio(r.thoi_gian)}</span><span><b>${esc(tenHS(r))}</b> <i class="muted">${esc(r.ten_lop)}</i> — ${esc(r.ten_vi_pham)}</span>${badgeTT(r.trang_thai)}</li>`).join('')}</ul>${nangChua.length > 8 ? '<p class="muted small">… xem đủ ở mục Xử lý.</p>' : ''}` : '<p class="muted small">Không có.</p>'}</div>
      <div><div class="nhom-ten">Học sinh cần theo dõi (≥3 lần, có lỗi nặng hoặc tăng nhanh)</div>
        ${canTheoDoi.length ? `<ul class="recent">${canTheoDoi.map(o => `<li><span class="muted">${esc(o.lop)}</span><span><a href="#" data-lsu="${o.id}">${esc(o.ten)}</a> — ${o.c} lần${o.nang ? `, ${o.nang} nặng` : ''}</span>${xuHuong(o.c, o.p)}</li>`).join('')}</ul>` : '<p class="muted small">Không có.</p>'}</div>
    </div></section>` : '';

    // --- Diễn biến
    const theoTuan = n > 45, buoc = theoTuan ? 7 : 1, soCot = Math.ceil(n / buoc);
    const demCot = (arr, goc) => { const a = new Array(soCot).fill(0); arr.forEach(r => { const i = Math.floor(diffNgay(goc, r.ngay) / buoc); if (i >= 0 && i < soCot) a[i]++; }); return a; };
    veChart('c-dien-bien', {
      type: 'line',
      data: {
        labels: Array.from({ length: soCot }, (_, i) => { const d = congNgay(tu, i * buoc); return (n <= 14 ? THU[thuCua(d)] + ' ' : '') + vn(d).slice(0, 5); }),
        datasets: [
          { label: nhanA, data: demCot(cur, tu), borderColor: c.pri, backgroundColor: c.pri + '22', fill: true, tension: .3, pointRadius: 3 },
          { label: nhanB, data: demCot(prev, pTu), borderColor: c.prev, borderDash: [5, 4], pointRadius: 0, tension: .3 }
        ]
      },
      options: {
        maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { title: { display: theoTuan, text: 'Tuần bắt đầu từ ngày' } } },
        plugins: legend
      }
    });

    // --- Theo hình thức
    const dem = (arr, key) => { const m = new Map(); arr.forEach(r => m.set(r[key], (m.get(r[key]) || 0) + 1)); return m; };
    const lc = dem(cur, 'ten_vi_pham'), lp = dem(prev, 'ten_vi_pham');
    const tenLoai = [...new Set([...lc.keys(), ...lp.keys()])].sort((a, b) => (lc.get(b) || 0) - (lc.get(a) || 0)).slice(0, 12);
    veChart('c-loai', {
      type: 'bar',
      data: { labels: tenLoai, datasets: [{ ...kyNay, data: tenLoai.map(t => lc.get(t) || 0) }, { ...kyTruoc, data: tenLoai.map(t => lp.get(t) || 0) }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: legend }
    });

    // --- Nhóm / mức độ / xử lý
    const banh = (id, labels, data, colors) => veChart(id, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 1 }] },
      options: { maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'right' } } }
    });
    const nc = dem(cur.map(r => ({ ...r, nhom: r.nhom || 'Khác' })), 'nhom');
    const nhomTen = [...nc.keys()].sort((a, b) => nc.get(b) - nc.get(a));
    banh('c-nhom', nhomTen.map(t => `${t} (${nc.get(t)})`), nhomTen.map(t => nc.get(t)), c.bang);
    banh('c-muc-do', [1, 2, 3].map(k => `${MUC_DO[k]} (${cur.filter(r => +r.muc_do === k).length})`), [1, 2, 3].map(k => cur.filter(r => +r.muc_do === k).length), [c.ok, c.warn, c.err]);
    banh('c-xu-ly', Object.keys(TRANG_THAI).map(k => `${TRANG_THAI[k]} (${cur.filter(r => r.trang_thai === k).length})`), Object.keys(TRANG_THAI).map(k => cur.filter(r => r.trang_thai === k).length), [c.err, c.warn, c.ok]);

    // --- Thứ trong tuần × buổi
    const thuTu = [1, 2, 3, 4, 5, 6, 0];
    const buoi = [['Sáng', h => h < 12, c.pri], ['Chiều', h => h >= 12 && h < 18, '#e08a2c'], ['Ngoài giờ', h => h >= 18, c.prev]];
    veChart('c-thu', {
      type: 'bar',
      data: {
        labels: thuTu.map(d => d === 0 ? 'Chủ nhật' : 'Thứ ' + (d + 1)),
        datasets: buoi.map(([ten, f, mauB]) => ({ label: ten, backgroundColor: mauB, borderRadius: 3, data: thuTu.map(d => cur.filter(r => thuCua(r.ngay) === d && f(gioVN(r.thoi_gian))).length) }))
      },
      options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } }, plugins: legend }
    });

    // --- Theo điểm trường
    const hienDT = coDT() && !F.dt && !F.lop;
    $('#card-dt').classList.toggle('hidden', !hienDT);
    if (hienDT) {
      const nhomDT = [...S.dt.map(d => ({ id: d.id, ten: d.ten })), { id: null, ten: 'Chưa xếp điểm trường' }];
      const bangDT = nhomDT.map(d => {
        const lops = S.lop.filter(l => (l.diem_truong_id ?? null) === d.id).map(l => l.id);
        const a = cur.filter(r => (r.diem_truong_id ?? null) === d.id), p = prev.filter(r => (r.diem_truong_id ?? null) === d.id);
        const siSo = S.hs.filter(h => h.dang_hoc && lops.includes(h.lop_id)).length;
        return { ...d, soLop: lops.length, siSo, c: a.length, p: p.length, hs: soHS(a), tt: tapThe(a), diem: diem(a), chua: a.filter(r => r.trang_thai !== 'da_xu_ly').length };
      }).filter(d => d.id !== null || d.soLop);
      veChart('c-dt', {
        type: 'bar',
        data: { labels: bangDT.map(d => d.ten), datasets: [{ ...kyNay, data: bangDT.map(d => d.c) }, { ...kyTruoc, data: bangDT.map(d => d.p) }] },
        options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: legend }
      });
      $('#tk-bang-dt').innerHTML = `<table class="tbl"><thead><tr><th>Điểm trường</th><th class="r">Số lớp</th><th class="r">Sĩ số</th><th class="r">Số VP</th><th class="r">VP / 100 HS</th><th class="r">HS vi phạm</th><th class="r">VP tập thể</th><th class="r">Điểm trừ</th><th class="r">${nhanB}</th><th>Tăng / giảm</th><th class="r">Chưa xử lý</th></tr></thead>
        <tbody>${bangDT.map(d => `<tr><td><b>${esc(d.ten)}</b></td><td class="r">${d.soLop}</td><td class="r">${d.siSo}</td><td class="r"><b>${d.c}</b></td><td class="r">${d.siSo ? so(d.c / d.siSo * 100) : '–'}</td>
          <td class="r">${d.hs}</td><td class="r">${d.tt}</td><td class="r">${so(d.diem)}</td><td class="r">${d.p}</td><td>${xuHuong(d.c, d.p)}</td><td class="r">${d.chua || ''}</td></tr>`).join('')}</tbody></table>`;
    }

    // --- Theo loại vi phạm (gộp theo nhóm)
    const mLoai = new Map();
    const oLoai = r => {
      let o = mLoai.get(r.loai_id);
      if (!o) mLoai.set(r.loai_id, o = { id: r.loai_id, ten: r.ten_vi_pham, nhom: r.nhom || 'Khác', muc_do: +r.muc_do, pham_vi: r.pham_vi, c: 0, p: 0, hs: new Set(), lop: new Map(), diem: 0, xl: 0 });
      return o;
    };
    cur.forEach(r => {
      const o = oLoai(r); o.c++; o.diem += +r.diem_tru || 0;
      if (r.hoc_sinh_id) o.hs.add(r.hoc_sinh_id);
      o.lop.set(r.ten_lop, (o.lop.get(r.ten_lop) || 0) + 1);
      if (r.trang_thai === 'da_xu_ly') o.xl++;
    });
    prev.forEach(r => oLoai(r).p++);
    bangLoai = [...mLoai.values()].map(o => {
      const top = [...o.lop].sort((a, b) => b[1] - a[1])[0];
      return { ...o, soHS: o.hs.size, soLop: o.lop.size, lopMax: top ? `${top[0]} (${top[1]})` : '', tyLe: cur.length ? o.c / cur.length * 100 : 0, xlPct: o.c ? Math.round(o.xl / o.c * 100) : null };
    });
    const nhomL = new Map();
    bangLoai.forEach(o => { if (!nhomL.has(o.nhom)) nhomL.set(o.nhom, []); nhomL.get(o.nhom).push(o); });
    const dsNhom = [...nhomL].map(([ten, a]) => ({ ten, a: a.sort((x, y) => y.c - x.c || y.p - x.p), c: a.reduce((s, o) => s + o.c, 0), p: a.reduce((s, o) => s + o.p, 0), diem: a.reduce((s, o) => s + o.diem, 0) }))
      .sort((x, y) => y.c - x.c);
    bangLoai = dsNhom.flatMap(g => g.a);
    $('#tk-bang-loai').innerHTML = bangLoai.length ? `<table class="tbl"><thead><tr><th>Loại vi phạm</th><th>Mức độ</th><th>Áp dụng</th><th class="r">Số VP</th><th class="r">Tỷ lệ</th><th class="r">${nhanB}</th><th>Tăng / giảm</th>
        <th class="r">HS vi phạm</th><th class="r">Số lớp</th><th>Lớp nhiều nhất</th><th class="r">Điểm trừ</th><th class="r">Đã xử lý</th></tr></thead>
      <tbody>${dsNhom.map(g => `<tr class="dong-nhom"><td colspan="3"><b>${esc(g.ten)}</b></td><td class="r"><b>${g.c}</b></td><td class="r">${cur.length ? so(g.c / cur.length * 100) + '%' : '–'}</td><td class="r">${g.p}</td><td>${xuHuong(g.c, g.p)}</td><td colspan="3"></td><td class="r">${so(g.diem)}</td><td></td></tr>` +
        g.a.map(o => `<tr><td class="thut"><span class="dot md${o.muc_do}"></span>${o.c ? `<a href="#" data-loai-ct="${o.id}">${esc(o.ten)}</a>` : esc(o.ten)}</td><td class="small">${MUC_DO[o.muc_do] || ''}</td><td class="small">${PHAM_VI[o.pham_vi] || ''}</td>
          <td class="r"><b>${o.c}</b></td><td class="r">${cur.length ? so(o.tyLe) + '%' : '–'}</td><td class="r">${o.p}</td><td>${xuHuong(o.c, o.p)}</td>
          <td class="r">${o.soHS || ''}</td><td class="r">${o.soLop || ''}</td><td class="small">${esc(o.lopMax)}</td><td class="r">${so(o.diem)}</td><td class="r">${o.xlPct == null ? '' : o.xlPct + '%'}</td></tr>`).join('')).join('')}</tbody></table>`
      : '<p class="muted pad">Không có vi phạm trong khoảng thời gian này.</p>';

    // --- Theo lớp
    const dsLop = F.lop ? S.lop.filter(l => l.id === +F.lop) : F.dt ? S.lop.filter(l => String(l.diem_truong_id) === String(F.dt)) : S.lop;
    const gc = new Map(), gp = new Map();
    cur.forEach(r => { if (!gc.has(r.lop_id)) gc.set(r.lop_id, []); gc.get(r.lop_id).push(r); });
    prev.forEach(r => gp.set(r.lop_id, (gp.get(r.lop_id) || 0) + 1));
    bangLop = dsLop.map(l => {
      const a = gc.get(l.id) || [];
      const siSo = S.hs.filter(h => h.lop_id === l.id && h.dang_hoc).length;
      const vpHS = cuaHS(a).length;
      return { id: l.id, ten: l.ten_lop, dt: tenDT(l.diem_truong_id), gvcn: tenND(l.gvcn_id), siSo, c: a.length, vpHS, tt: a.length - vpHS, p: gp.get(l.id) || 0, hs: soHS(a), diem: diem(a), chua: a.filter(r => r.trang_thai !== 'da_xu_ly').length };
    }).sort((a, b) => b.diem - a.diem || b.c - a.c || a.ten.localeCompare(b.ten, 'vi', { numeric: true }));   // điểm trừ giảm dần
    const coDuLieu = bangLop.filter(r => r.c || r.p);
    $('#box-c-lop').classList.toggle('hidden', !!F.lop || !coDuLieu.length);
    if (!F.lop && coDuLieu.length) {
      const sx = [...coDuLieu].sort((a, b) => a.ten.localeCompare(b.ten, 'vi', { numeric: true }));
      veChart('c-lop', {
        type: 'bar',
        data: { labels: sx.map(r => r.ten), datasets: [
          { label: nhanA + ' – học sinh', data: sx.map(r => r.vpHS), backgroundColor: c.pri, borderRadius: 3, stack: 'nay' },
          { label: nhanA + ' – tập thể lớp', data: sx.map(r => r.tt), backgroundColor: '#e08a2c', borderRadius: 3, stack: 'nay' },
          { label: nhanB, data: sx.map(r => r.p), backgroundColor: c.prev, borderRadius: 3, stack: 'truoc' }] },
        options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } }, plugins: legend }
      });
    }
    $('#tk-bang-lop').innerHTML = `<table class="tbl"><thead><tr><th>#</th><th>Lớp</th>${coDT() ? '<th>Điểm trường</th>' : ''}<th>GVCN</th><th class="r">Sĩ số</th><th class="r">Số VP</th><th class="r">VP tập thể</th><th class="r">VP / HS</th><th class="r">HS vi phạm</th><th class="r">Điểm trừ ▼</th><th class="r">${nhanB}</th><th>Tăng / giảm</th><th class="r">Chưa xử lý</th></tr></thead>
      <tbody>${bangLop.map((r, i) => `<tr><td>${i + 1}</td><td><a href="#" data-lop-ct="${r.id}"><b>${esc(r.ten)}</b></a></td>${coDT() ? `<td class="small">${esc(r.dt)}</td>` : ''}<td class="small">${esc(r.gvcn)}</td><td class="r">${r.siSo}</td><td class="r"><b>${r.c}</b></td><td class="r">${r.tt || ''}</td>
        <td class="r">${r.siSo ? (r.vpHS / r.siSo).toFixed(2) : '–'}</td><td class="r">${r.hs}</td><td class="r">${so(r.diem)}</td><td class="r">${r.p}</td>
        <td>${xuHuong(r.c, r.p)}</td><td class="r">${r.chua || ''}</td></tr>`).join('') || `<tr><td colspan="13" class="muted">Chưa có lớp.</td></tr>`}</tbody></table>`;

    // --- Theo học sinh
    bangHS = [...mHS.values()].sort((a, b) => b.c - a.c || b.diem - a.diem).slice(0, 50);
    bangHS.forEach(o => (o.loiChinh = Object.entries(o.loai).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, k]) => `${t} (${k})`).join(', ')));
    $('#tk-hs').innerHTML = bangHS.length ? `<table class="tbl"><thead><tr><th>#</th><th>Học sinh</th><th>Lớp</th><th class="r">Số VP</th><th class="r">Điểm trừ</th><th class="r">${nhanB}</th><th>Xu hướng</th><th>Lỗi thường gặp</th><th class="r">Chưa xử lý</th></tr></thead>
      <tbody>${bangHS.map((o, i) => `<tr><td>${i + 1}</td><td><a href="#" data-lsu="${o.id}">${esc(o.ten)}</a></td><td>${esc(o.lop)}</td><td class="r"><b>${o.c}</b></td><td class="r">${so(o.diem)}</td><td class="r">${o.p}</td>
        <td>${xuHuong(o.c, o.p)}</td><td class="small">${esc(o.loiChinh)}</td><td class="r">${o.chua || ''}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted pad">Không có học sinh vi phạm trong khoảng thời gian này. 🎉</p>';

    // --- Theo người ghi nhận
    const ng = new Map();
    cur.forEach(r => { const k = r.nguoi_ghi || '-'; const o = ng.get(k) || { ten: r.ten_nguoi_ghi || '(không rõ)', c: 0, p: 0, tt: 0 }; o.c++; if (!r.hoc_sinh_id) o.tt++; ng.set(k, o); });
    prev.forEach(r => { const o = ng.get(r.nguoi_ghi || '-'); if (o) o.p++; });
    const bangNG = [...ng.values()].sort((a, b) => b.c - a.c);
    $('#tk-nguoi-ghi').innerHTML = bangNG.length ? `<table class="tbl"><thead><tr><th>Người ghi nhận</th><th class="r">Số lượt ghi</th><th class="r">Trong đó tập thể lớp</th><th class="r">${nhanB}</th></tr></thead>
      <tbody>${bangNG.map(o => `<tr><td>${esc(o.ten)}</td><td class="r"><b>${o.c}</b></td><td class="r">${o.tt || ''}</td><td class="r">${o.p}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted pad">Chưa có.</p>';
  }

  el.onchange = e => {
    const id = e.target.id;
    if (id === 'tk-tu' || id === 'tk-den') $('#tk-preset').value = 'tuy';
    if (id === 'tk-dt') { F.dt = e.target.value; veOptLop(); }
    if (['tk-preset', 'tk-tu', 'tk-den', 'tk-dt', 'tk-lop'].includes(id)) tai();
    // Tick loại / nhóm vi phạm
    const d = e.target.dataset;
    if (d.loaiNhom !== undefined) $$(`[data-loai-id][data-nhom="${CSS.escape(d.loaiNhom)}"]`).forEach(c => (c.checked = e.target.checked));
    if (d.loaiNhom !== undefined || d.loaiId) capNhatLoai();
  };
  // Cập nhật danh sách loại đã chọn; tải lại thống kê sau khi ngừng tick một chút
  let henTai = null;
  const dongBoNhom = () => $$('[data-loai-nhom]').forEach(g => {
    const con = $$(`[data-loai-id][data-nhom="${CSS.escape(g.dataset.loaiNhom)}"]`), n = con.filter(c => c.checked).length;
    g.checked = n > 0 && n === con.length; g.indeterminate = n > 0 && n < con.length;
  });
  const capNhatLoai = () => {
    F.loaiDs = $$('[data-loai-id]:checked').map(c => +c.dataset.loaiId);
    dongBoNhom();
    $('#tk-loai-nhan').textContent = moTaLoaiChon(F.loaiDs);
    clearTimeout(henTai); henTai = setTimeout(tai, 600);
  };
  dongBoNhom();
  const moDongBang = mo => {
    const b = $('#tk-loai-bang'); b.classList.toggle('hidden', !mo);
    if (mo) { $('#tk-loai-tim').value = ''; $$('.chon-muc, .chon-nhom').forEach(x => (x.style.display = '')); $('#tk-loai-tim').focus(); }
  };
  el.oninput = e => {
    if (e.target.id !== 'tk-loai-tim') return;
    const q = boDau(e.target.value.trim());
    $$('.chon-nhom').forEach(g => {
      let co = 0;
      $$('.chon-muc', g).forEach(m => { const hien = !q || m.dataset.ten.includes(q); m.style.display = hien ? '' : 'none'; co += hien; });
      g.style.display = co ? '' : 'none';
    });
  };
  el.onclick = e => {
    if (e.target.closest('#tk-loai-nut')) { moDongBang($('#tk-loai-bang').classList.contains('hidden')); return; }
    if (e.target.closest('#tk-loai-xong')) { moDongBang(false); return; }
    if (e.target.closest('#tk-loai-bo')) { $$('[data-loai-id]').forEach(c => (c.checked = false)); capNhatLoai(); return; }
    const t = e.target.closest('[data-lsu],[data-lop-ct],[data-loai-ct],#csv-lop,#csv-lop-2,#csv-hs,#csv-loai'); if (!t) return;
    if (t.dataset.lsu) { e.preventDefault(); lichSuHS(+t.dataset.lsu); }
    else if (t.dataset.loaiCt) { e.preventDefault(); chiTietLoai(+t.dataset.loaiCt, dataCur, `${K.a}: ${vn(K.tu)} – ${vn(K.den)}`); }
    else if (t.id === 'csv-loai') xuatCSV(`thong-ke-loai-vi-pham_${F.tu}_${F.den}.csv`,
      ['Nhóm', 'Loại vi phạm', 'Mức độ', 'Áp dụng cho', 'Số VP', 'Tỷ lệ (%)', K.b, 'Chênh lệch', 'HS vi phạm', 'Số lớp', 'Lớp nhiều nhất', 'Điểm trừ', 'Đã xử lý (%)'],
      bangLoai.map(o => [o.nhom, o.ten, MUC_DO[o.muc_do], PHAM_VI[o.pham_vi], o.c, +o.tyLe.toFixed(1), o.p, o.c - o.p, o.soHS, o.soLop, o.lopMax, o.diem, o.xlPct ?? '']));
    else if (t.dataset.lopCt) { e.preventDefault(); chiTietLop(+t.dataset.lopCt, dataCur, `${K.a}: ${vn(K.tu)} – ${vn(K.den)}`); }
    else if (t.id === 'csv-lop' || t.id === 'csv-lop-2') xuatCSV(`thong-ke-lop_${F.tu}_${F.den}.csv`,
      ['Lớp', 'Điểm trường', 'GVCN', 'Sĩ số', 'Số VP', 'VP tập thể', 'VP/HS', 'HS vi phạm', 'Điểm trừ', K.b, 'Chênh lệch', 'Chưa xử lý'],
      bangLop.map(r => [r.ten, r.dt, r.gvcn, r.siSo, r.c, r.tt, r.siSo ? +(r.vpHS / r.siSo).toFixed(2) : '', r.hs, r.diem, r.p, r.c - r.p, r.chua]));
    else if (t.id === 'csv-hs') xuatCSV(`thong-ke-hoc-sinh_${F.tu}_${F.den}.csv`,
      ['Học sinh', 'Lớp', 'Số VP', 'Điểm trừ', K.b, 'Chênh lệch', 'Lỗi thường gặp', 'Chưa xử lý'],
      bangHS.map(o => [o.ten, o.lop, o.c, o.diem, o.p, o.c - o.p, o.loiChinh, o.chua]));
  };

  veOptLop();
  await tai();
}
