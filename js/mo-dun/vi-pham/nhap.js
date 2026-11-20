'use strict';
/* =====================================================================
   PHÂN HỆ VI PHẠM – NHẬP VI PHẠM
   Dùng chung cho phân hệ Chuyên cần (chiCC = true: chỉ hiện các hình thức chuyên cần).
   ===================================================================== */
function veNhapVP(el, chiCC = false) {
  const khoa = chiCC ? 'nhapCC' : 'nhap';
  if (!S[khoa]) {
    const luu = ls.get('vp_lop');
    S[khoa] = { lopId: luu === '0' ? 0 : (S.lopMap.has(+luu) ? +luu : (S.lop[0]?.id || 0)), hs: new Set(), loai: new Set() };
  }
  const N = S[khoa];
  const loaiHien = l => l.dang_dung && (!chiCC || l.chuyen_can);
  if (N.lopId && !S.lopMap.has(N.lopId)) N.lopId = S.lop[0]?.id || 0;
  const bgh = App.coQuyen('vp.xu_ly_tat_ca');   // không giới hạn ngày lùi
  const conSong = giuPhien();

  el.innerHTML = `
  <div class="grid-nhap">
    <section class="card">
      <h2><span class="step">1</span> Chọn lớp</h2>
      <div id="ds-lop"></div>
      <h2><span class="step">2</span> Chọn học sinh <small class="muted" id="dem-hs"></small></h2>
      <p class="muted small goi-y">${chiCC ? 'Chọn các học sinh vắng / cúp tiết (có thể chọn nhiều em).' : 'Muốn ghi vi phạm cho <b>cả lớp</b> thì không chọn học sinh nào.'}</p>
      <input id="tim-hs" class="input" placeholder="Gõ tên để lọc… (Enter: chọn người đầu tiên)" autocomplete="off">
      <div id="ds-hs" class="hs-grid"></div>
    </section>
    <section class="card sticky-col">
      <h2><span class="step">3</span> ${chiCC ? 'Chọn loại vắng' : 'Chọn vi phạm'}</h2>
      <div id="ds-loai"></div>
      <div class="lbl">${chiCC ? 'Thời gian' : 'Thời gian vi phạm'}</div>
      <div class="tg-row">
        <input type="datetime-local" id="tg-vp" class="input">
        <button type="button" class="btn sm" id="tg-bay-gio">Bây giờ</button>
      </div>
      <p class="muted small" id="tg-mota"></p>
      <textarea id="ghi-chu" class="input" rows="2" placeholder="Ghi chú (không bắt buộc)"></textarea>
      <div id="tom-tat" class="tom-tat"></div>
      <p id="canh-bao" class="canh-bao small hidden"></p>
      <button id="btn-ghi" class="btn primary big" disabled>Ghi nhận</button>
      <p class="muted small">Có thể hủy trong ${tgHuy()} sau khi bấm <b>Ghi nhận</b>.</p>
      <h3>Bạn vừa ghi nhận</h3>
      <div id="gan-day"><p class="muted small">Đang tải…</p></div>
    </section>
  </div>`;

  // Chế độ chọn vi phạm: có học sinh → vi phạm của học sinh; chỉ có lớp → vi phạm của lớp
  const cheDo = () => N.hs.size ? 'hoc_sinh' : (N.lopId ? 'lop' : null);
  const dongBoLoai = () => {
    const cd = cheDo();
    for (const id of [...N.loai]) if ((S.loai.find(l => l.id === id)?.pham_vi || 'hoc_sinh') !== cd) N.loai.delete(id);
  };

  const veLop = () => {
    const chip = l => `<button type="button" class="chip ${l.id === N.lopId ? 'on' : ''}" data-lop="${l.id}">${esc(l.ten_lop)}</button>`;
    const toan = `<button type="button" class="chip ${N.lopId === 0 ? 'on' : ''}" data-lop="0">Tìm toàn trường</button>`;
    $('#ds-lop').innerHTML = coDT()
      ? `<div class="chips">${toan}</div>` + nhomTheoDT(S.lop).map(([d, a]) =>
          `<div class="nhom-lop"><div class="nhom-ten">${esc(d ? tenDT(d) : 'Chưa xếp điểm trường')}</div><div class="chips">${a.map(chip).join('')}</div></div>`).join('')
      : `<div class="chips">${toan}${S.lop.map(chip).join('')}</div>`;
  };
  const veHS = () => {
    const q = boDau($('#tim-hs').value.trim());
    if (!S.lop.length) { $('#ds-hs').innerHTML = '<p class="muted">Chưa có lớp/học sinh. Người có quyền “Quản lý học sinh” vào phân hệ Quản trị → <b>Học sinh</b> để nhập danh sách.</p>'; return; }
    if (N.lopId === 0 && !q) { $('#ds-hs').innerHTML = '<p class="muted">Gõ tên để tìm học sinh trong toàn trường.</p>'; return; }
    let ds = S.hs.filter(h => h.dang_hoc && (N.lopId === 0 || h.lop_id === N.lopId));
    if (q) ds = ds.filter(h => boDau(h.ho_ten).includes(q));
    ds = ds.slice(0, 150);
    $('#ds-hs').innerHTML = ds.map(h => `<button type="button" class="hs ${N.hs.has(h.id) ? 'on' : ''}" data-hs="${h.id}">
        <span class="stt">${N.lopId === 0 ? esc(tenLop(h.lop_id)) : S.stt.get(h.id)}</span><span class="ten">${esc(h.ho_ten)}</span></button>`).join('')
      || '<p class="muted">Không có học sinh phù hợp.</p>';
  };
  const veLoai = () => {
    const ds = S.loai.filter(loaiHien);
    const cd = cheDo();
    const nhom = (pv, tieuDe, goiY) => {
      const a = ds.filter(l => (l.pham_vi || 'hoc_sinh') === pv);
      if (!a.length) return '';
      const on = cd === pv;
      return `<div class="nhom-loai ${on ? '' : 'tat'}">
        <div class="nhom-ten">${tieuDe}${on ? '' : ` <span class="goi-y-tat">— ${goiY}</span>`}</div>
        <div class="chips loai">${a.map(l => `<button type="button" class="chip md${l.muc_do || 1} ${N.loai.has(l.id) ? 'on' : ''}" data-loai="${l.id}" ${on ? '' : 'disabled'}>${esc(l.ten)}${+l.diem_tru ? ` <small>−${so(l.diem_tru)}</small>` : ''}</button>`).join('')}</div></div>`;
    };
    const lopTen = N.lopId ? tenLop(N.lopId) : '';
    $('#ds-loai').innerHTML = (
      nhom('lop', `Vi phạm của lớp${lopTen ? ' ' + esc(lopTen) : ''}`, N.lopId ? 'bỏ chọn học sinh để dùng' : 'chọn một lớp để dùng') +
      nhom('hoc_sinh', chiCC ? 'Loại vắng' : 'Vi phạm của học sinh', 'chọn học sinh để dùng')
    ) || (chiCC ? '<p class="muted">Chưa có hình thức nào được đánh dấu “Chuyên cần”. Vào phân hệ Vi phạm → <b>Danh mục</b>, cột “Chuyên cần”.</p>' : '<p class="muted">Chưa có hình thức vi phạm.</p>');
  };
  const veTomTat = () => {
    const cd = cheDo();
    const n = cd === 'lop' ? N.loai.size : N.hs.size * N.loai.size;
    $('#dem-hs').textContent = N.hs.size ? `· đã chọn ${N.hs.size}` : '';
    $('#tom-tat').innerHTML = cd === 'lop'
      ? `<span class="tag tag-ca-lop">Cả lớp <b>${esc(tenLop(N.lopId))}</b></span>`
      : [...N.hs].map(id => S.hsMap.get(id)).filter(Boolean)
        .map(h => `<span class="tag">${esc(h.ho_ten)} <i>${esc(tenLop(h.lop_id))}</i><button type="button" data-bo="${h.id}" aria-label="Bỏ chọn">×</button></span>`).join('');
    const cb = $('#canh-bao');
    const nhieu = cd === 'hoc_sinh' && N.hs.size > 1 && N.loai.size > 1;
    cb.classList.toggle('hidden', !nhieu);
    if (nhieu) cb.textContent = `Lưu ý: mỗi học sinh trong ${N.hs.size} em đã chọn sẽ bị ghi cả ${N.loai.size} vi phạm.`;
    const b = $('#btn-ghi');
    b.disabled = !n;
    b.textContent = n
      ? (cd === 'lop' ? `Ghi nhận ${n} vi phạm cho lớp ${tenLop(N.lopId)}` : chiCC ? `Ghi nhận vắng cho ${N.hs.size} học sinh` : `Ghi nhận ${n} vi phạm`)
      : (cd ? 'Chọn vi phạm' : 'Chọn lớp hoặc học sinh');
  };
  const veTG = () => {
    const i = $('#tg-vp');
    i.max = nayLocal();
    if (!bgh) i.min = new Date(Date.now() - ngayLui() * 864e5 + 7 * 3600e3).toISOString().slice(0, 16);
    const v = i.value;
    $('#tg-bay-gio').classList.toggle('hidden', !v);
    $('#tg-mota').innerHTML = v
      ? `Vi phạm lúc <b>${v.slice(11)} ngày ${vn(v.slice(0, 10))}</b>`
      : `Để trống = lấy giờ hiện tại khi bấm Ghi nhận.${bgh ? '' : ` Có thể chọn lùi tối đa ${ngayLui()} ngày.`}`;
  };
  const chonHS = id => { N.hs.has(id) ? N.hs.delete(id) : N.hs.add(id); };
  const doiCheDo = () => { dongBoLoai(); veLoai(); veTomTat(); };

  async function taiGanDay() {
    const box = $('#gan-day'); if (!box) return;
    // Mọi vi phạm còn trong thời gian được hủy (tối đa 100), ít nhất 8 vi phạm gần nhất
    const { data: tatCa, error } = await sb.from('v_vi_pham').select('id,thoi_gian,tao_luc,hoc_sinh_id,ho_ten,ten_lop,ten_vi_pham')
      .eq('nguoi_ghi', S.user.id).order('tao_luc', { ascending: false }).limit(100);
    if (!$('#gan-day')) return;
    if (error) { box.innerHTML = `<p class="err">${esc(dichLoi(error))}</p>`; return; }
    const now = Date.now();
    const data = tatCa.filter((r, i) => i < 8 || now - new Date(r.tao_luc) < gioHuy() * 3600e3);
    box.innerHTML = data.length ? `<ul class="recent ${data.length > 8 ? 'recent-dai' : ''}">${data.map(r => `<li>
        <span class="muted">${fmtGio(r.thoi_gian)}</span>
        <span><b>${esc(tenHS(r))}</b> <i class="muted">${esc(r.ten_lop)}</i> — ${esc(r.ten_vi_pham)}</span>
        ${now - new Date(r.tao_luc) < gioHuy() * 3600e3 ? `<button type="button" class="link" data-huy="${r.id}">Hủy</button>` : ''}</li>`).join('')}</ul>`
      : '<p class="muted small">Chưa có.</p>';
  }

  el.onclick = async e => {
    const t = e.target.closest('[data-lop],[data-hs],[data-loai],[data-bo],[data-huy],#tg-bay-gio');
    if (!t || t.disabled) return;
    const d = t.dataset;
    if (t.id === 'tg-bay-gio') {
      $('#tg-vp').value = ''; veTG();
    } else if (d.lop !== undefined) {
      N.lopId = +d.lop; ls.set('vp_lop', N.lopId);
      $('#tim-hs').value = ''; veLop(); veHS(); doiCheDo();
      if (N.lopId === 0) $('#tim-hs').focus();
    } else if (d.hs) {
      chonHS(+d.hs); t.classList.toggle('on'); doiCheDo();
    } else if (d.loai) {
      const id = +d.loai, laCC = !!S.loai.find(l => l.id === id)?.chuyen_can;
      if (N.loai.has(id)) N.loai.delete(id);
      else {
        // Vi phạm chuyên cần: mỗi lần chỉ chọn một loại (bỏ chọn loại chuyên cần khác)
        if (laCC) for (const k of [...N.loai]) if (S.loai.find(l => l.id === k)?.chuyen_can) N.loai.delete(k);
        N.loai.add(id);
      }
      if (laCC) veLoai(); else t.classList.toggle('on');
      veTomTat();
    } else if (d.bo) {
      N.hs.delete(+d.bo); veHS(); doiCheDo();
    } else if (d.huy) {
      if (!confirm('Hủy vi phạm vừa ghi nhận?')) return;
      const { data, error } = await sb.from('vi_pham').delete().eq('id', +d.huy).select('id');
      if (error) toast(dichLoi(error), 'err');
      else if (!data.length) toast(`Không thể hủy (đã quá ${tgHuy()}).`, 'err');
      else { toast('Đã hủy.'); taiGanDay(); App.capNhatHuyHieu(); }
    }
  };
  $('#tim-hs').oninput = veHS;
  $('#tim-hs').onkeydown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = $('#ds-hs [data-hs]');
      if (first) { chonHS(+first.dataset.hs); e.target.value = ''; veHS(); doiCheDo(); }
    } else if (e.key === 'Escape') { e.target.value = ''; veHS(); }
  };
  $('#tg-vp').oninput = veTG;
  $('#tg-vp').onfocus = veTG;
  el.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !$('#btn-ghi').disabled) $('#btn-ghi').click(); };

  /** Tìm các vi phạm trùng (cùng HS/lớp tập thể, cùng loại, cùng ngày, cùng buổi) đã được ghi trước đó */
  async function timTrung(rows, thoiGian) {
    const t = thoiGian || new Date().toISOString(), ngay = ngayVN(t), b = buoiCua(t);
    const loai = [...new Set(rows.map(r => r.loai_id))];
    const hs = [...new Set(rows.map(r => r.hoc_sinh_id).filter(Boolean))];
    let q = sb.from('v_vi_pham').select('id,hoc_sinh_id,lop_id,loai_id,thoi_gian,nguoi_ghi,ten_nguoi_ghi,ho_ten,ten_lop,ten_vi_pham')
      .gte('thoi_gian', tuNgay(ngay)).lt('thoi_gian', denNgay(ngay)).in('loai_id', loai).order('thoi_gian');
    q = hs.length ? q.in('hoc_sinh_id', hs) : q.eq('lop_id', rows[0].lop_id).is('hoc_sinh_id', null);
    const { data, error } = await q;
    if (error) { console.warn('Không kiểm tra được vi phạm trùng:', error.message); return new Map(); }
    const m = new Map();   // khóa → lần ghi đầu tiên trong buổi
    for (const r of data) {
      if (buoiCua(r.thoi_gian) !== b) continue;
      const k = khoaTrung(r);
      if (!m.has(k)) m.set(k, r);
    }
    return m;
  }

  /** Học sinh đã có vi phạm chuyên cần trong cùng buổi (sáng < 12 giờ ≤ chiều): hoc_sinh_id → bản ghi đã có */
  async function timChuyenCan(rows, thoiGian) {
    const idsCC = S.loai.filter(l => l.chuyen_can).map(l => l.id);
    const hs = [...new Set(rows.filter(r => r.hoc_sinh_id && idsCC.includes(r.loai_id)).map(r => r.hoc_sinh_id))];
    const m = new Map();
    if (!hs.length) return m;
    const t = thoiGian || new Date().toISOString(), ngay = ngayVN(t), b = buoiCC(t);
    const { data, error } = await sb.from('v_vi_pham').select('id,hoc_sinh_id,lop_id,loai_id,thoi_gian,nguoi_ghi,ten_nguoi_ghi,ho_ten,ten_lop,ten_vi_pham')
      .gte('thoi_gian', tuNgay(ngay)).lt('thoi_gian', denNgay(ngay)).in('loai_id', idsCC).in('hoc_sinh_id', hs).order('thoi_gian');
    if (error) { console.warn('Không kiểm tra được chuyên cần:', error.message); return m; }   // máy chủ vẫn chặn
    for (const r of data) if (buoiCC(r.thoi_gian) === b && !m.has(r.hoc_sinh_id)) m.set(r.hoc_sinh_id, r);
    return m;
  }

  $('#btn-ghi').onclick = async () => {
    const cd = cheDo();
    const ghiChu = $('#ghi-chu').value.trim() || null;

    // Thời gian vi phạm
    let thoiGian = null;
    const v = $('#tg-vp').value;
    if (v) {
      const t = new Date(v + ':00+07:00');
      if (isNaN(t)) { toast('Thời gian không hợp lệ.', 'err'); return; }
      if (t.getTime() > Date.now() + 60e3) { toast('Thời gian vi phạm không được ở tương lai.', 'err'); return; }
      if (!bgh && t.getTime() < Date.now() - ngayLui() * 864e5) { toast(`Chỉ được chọn trong ${ngayLui()} ngày gần đây.`, 'err'); return; }
      thoiGian = t.toISOString();
    }

    const rows = [];
    if (cd === 'lop') {
      for (const l of N.loai) rows.push({ hoc_sinh_id: null, lop_id: N.lopId, loai_id: l, ghi_chu: ghiChu, thoi_gian: thoiGian });
    } else {
      for (const h of N.hs) for (const l of N.loai) rows.push({ hoc_sinh_id: h, lop_id: S.hsMap.get(h)?.lop_id, loai_id: l, ghi_chu: ghiChu, thoi_gian: thoiGian });
    }
    if (!rows.length) return;
    const b = $('#btn-ghi'); b.disabled = true; b.textContent = 'Đang kiểm tra…';

    // Chuyên cần: học sinh đã có vi phạm chuyên cần trong buổi thì không ghi thêm (không có lựa chọn "ghi lần nữa")
    let ghi = rows;
    const laCC = r => r.hoc_sinh_id && S.loai.find(l => l.id === r.loai_id)?.chuyen_can;
    const daCC = await timChuyenCan(rows, thoiGian);
    const biChan = rows.filter(r => laCC(r) && daCC.has(r.hoc_sinh_id));
    if (biChan.length) {
      const conLai = rows.filter(r => !biChan.includes(r));
      const chon = await baoChuyenCan([...new Set(biChan.map(r => r.hoc_sinh_id))].map(h => daCC.get(h)), conLai.length);
      if (chon !== 'tiep') { if (conSong()) veTomTat(); return; }
      ghi = conLai;
      if (!conSong()) return;
    }

    // Kiểm tra trùng trong cùng buổi (các vi phạm không thuộc chuyên cần)
    const trung = await timTrung(ghi, thoiGian);
    const dsTrung = ghi.filter(r => !laCC(r) && trung.has(khoaTrung(r)));
    if (dsTrung.length) {
      const chon = await hoiTrung(dsTrung.map(r => trung.get(khoaTrung(r))), ghi.length);
      if (chon === 'huy') { if (conSong()) veTomTat(); return; }
      if (chon === 'bo_trung') ghi = ghi.filter(r => !dsTrung.includes(r));
      if (!ghi.length) { toast('Không ghi nhận thêm vi phạm nào.'); if (conSong()) veTomTat(); return; }
      if (!conSong()) return;
    }

    b.textContent = 'Đang lưu…';
    const { error } = await sb.from('vi_pham').insert(ghi);
    if (error) { toast(dichLoi(error), 'err'); if (conSong()) veTomTat(); return; }
    toast(`Đã ghi nhận ${ghi.length} vi phạm.` + (ghi.length < rows.length ? ` Bỏ qua ${rows.length - ghi.length} mục đã có.` : ''));
    N.hs.clear(); N.loai.clear();
    App.capNhatHuyHieu();
    if (!conSong()) return;
    $('#ghi-chu').value = ''; $('#tim-hs').value = ''; $('#tg-vp').value = '';
    veHS(); veLoai(); veTomTat(); veTG(); taiGanDay();
  };

  dongBoLoai();
  veLop(); veHS(); veLoai(); veTomTat(); veTG(); taiGanDay();
}
