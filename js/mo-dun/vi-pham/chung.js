'use strict';
/* =====================================================================
   PHÂN HỆ VI PHẠM – PHẦN DÙNG CHUNG
   Hằng số, dữ liệu riêng (hình thức VP, biện pháp, phạm vi xử lý), quyền xử lý,
   hộp thoại xử lý, lịch sử học sinh, chi tiết lớp / loại vi phạm.
   Quyền (khai báo trong supabase/10-vi-pham.sql):
     vp.ghi_nhan, vp.xu_ly, vp.xu_ly_tat_ca, vp.hinh_thuc, vp.bien_phap
   ===================================================================== */

const TRANG_THAI = { chua_xu_ly: 'Chưa xử lý', dang_xu_ly: 'Đang xử lý', da_xu_ly: 'Đã xử lý' };
const MUC_DO = { 1: 'Nhẹ', 2: 'Trung bình', 3: 'Nặng' };
const PHAM_VI = { hoc_sinh: 'Học sinh', lop: 'Cả lớp' };
const tenHS = r => r.hoc_sinh_id ? r.ho_ten : 'Cả lớp';
const badgeTT = tt => `<span class="tt tt-${tt}">${TRANG_THAI[tt] || tt}</span>`;
const oHS = r => r.hoc_sinh_id ? `<a href="#" data-lsu="${r.hoc_sinh_id}">${esc(r.ho_ten)}</a>` : '<span class="tag-lop">Cả lớp</span>';
/** Giờ được tự hủy, số ngày được lùi (Quản trị → Cấu hình) */
const gioHuy = () => +App.cauHinh('vp.gio_duoc_huy', 4);
const tgHuy = () => `${so(gioHuy())} giờ`;
const ngayLui = () => +App.cauHinh('vp.so_ngay_lui', 7);

/* Chuyên cần: các hình thức vi phạm có đánh dấu "Chuyên cần" (dùng cho phân hệ Chuyên cần) */
const CC = { co_phep: 'Nghỉ có phép', khong_phep: 'Nghỉ không phép', cup_tiet: 'Cúp tiết' };
/** Buổi học cho chuyên cần: trước 12 giờ là sáng, còn lại là chiều */
const buoiCC = ts => gioVN(ts) < 12 ? 'sang' : 'chieu';
const ngayHocTruoc = ymd => { let d = congNgay(ymd, -1); if (thuCua(d) === 0) d = congNgay(d, -1); return d; };
const tenBuoi = b => b === 'sang' ? 'sáng' : 'chiều';
const thuNgay = ymd => (thuCua(ymd) === 0 ? 'Chủ nhật' : 'Thứ ' + (thuCua(ymd) + 1)) + ' ' + vn(ymd);

/* ---------- Dữ liệu riêng của phân hệ ---------- */
S.loai = []; S.bp = []; S.vpPhamVi = new Map();
App.khiTaiDuLieu(async () => {
  if (!App.daCai('vi_pham') || !App.xemHocSinh()) { S.loai = []; S.bp = []; S.vpPhamVi = new Map(); return; }
  const [loai, bp, pv] = await Promise.all([
    layHet(() => sb.from('loai_vi_pham').select('*').order('thu_tu').order('id')),
    layHet(() => sb.from('bien_phap').select('*').order('thu_tu').order('id')),
    layHet(() => sb.from('vp_pham_vi').select('*').order('diem_truong_id'))
  ]);
  S.loai = loai; S.bp = bp;
  S.vpPhamVi = new Map();
  pv.forEach(r => { if (!S.vpPhamVi.has(r.nguoi_dung_id)) S.vpPhamVi.set(r.nguoi_dung_id, []); S.vpPhamVi.get(r.nguoi_dung_id).push(r.diem_truong_id); });
});

/* ---------- Quyền xử lý (khớp hàm vp_co_the_xu_ly trong SQL) ---------- */
/** Các điểm trường người uid được giao xử lý (mảng rỗng = toàn trường) */
const dtXuLyCua = uid => (S.vpPhamVi.get(uid) || []).filter(id => S.dtMap.has(id));
/** Người đang đăng nhập có được xử lý vi phạm nào không (để hiện nút, ô chọn, chấm đỏ) */
const duocXuLy = () => App.coQuyen('vp.xu_ly') || App.coQuyen('vp.xu_ly_tat_ca')
  || (App.coQuyen('vp.ghi_nhan') && S.lop.some(l => l.gvcn_id === S.user.id));
/** Người đang đăng nhập có được xử lý vi phạm r không */
function coTheXuLy(r) {
  if (App.coQuyen('vp.xu_ly_tat_ca')) return true;
  if (+r.muc_do >= 3) return false;
  const l = S.lopMap.get(r.lop_id);
  if (!l) return false;
  if (App.coQuyen('vp.xu_ly')) { const ds = dtXuLyCua(S.user.id); if (!ds.length || ds.includes(l.diem_truong_id)) return true; }
  return App.coQuyen('vp.ghi_nhan') && l.gvcn_id === S.user.id;
}

/* ---------- Kiểm tra vi phạm trùng trong cùng buổi ---------- */
const BUOI = { sang: 'sáng', chieu: 'chiều', toi: 'ngoài giờ' };
/** Buổi theo giờ Việt Nam: sáng < 12h ≤ chiều < 18h ≤ ngoài giờ (khớp biểu đồ "theo buổi") */
const buoiCua = ts => { const h = gioVN(ts); return h < 12 ? 'sang' : h < 18 ? 'chieu' : 'toi'; };
const khoaTrung = r => `${r.hoc_sinh_id ? 'h' + r.hoc_sinh_id : 'l' + r.lop_id}|${r.loai_id}`;
const gioPhutVN = ts => new Date(ts).toLocaleTimeString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

/** Báo học sinh đã có vi phạm chuyên cần trong buổi. Trả về 'tiep' (bỏ qua các em này, ghi phần còn lại) | 'huy' */
function baoChuyenCan(dsCu, soConLai) {
  return new Promise(xong => {
    const nguoi = r => r.nguoi_ghi === S.user?.id ? 'chính thầy cô' : `<b>${esc(r.ten_nguoi_ghi || 'một người khác')}</b>`;
    const dong = r => `<b>${esc(r.ho_ten)}</b> (${esc(r.ten_lop)}) đã được ${nguoi(r)} ghi <b>“${esc(r.ten_vi_pham)}”</b> lúc <b>${gioPhutVN(r.thoi_gian)}</b> buổi ${tenBuoi(buoiCC(r.thoi_gian))} ngày ${vn(ngayVN(r.thoi_gian))}`;
    moModal(`<h2>Không thể ghi thêm vi phạm chuyên cần</h2>
      ${dsCu.length === 1 ? `<p>${dong(dsCu[0])}.</p>` : `<ul class="ds-trung">${dsCu.map(r => `<li>${dong(r)}</li>`).join('')}</ul>`}
      <p class="small">Trong một buổi, mỗi học sinh chỉ được ghi <b>một</b> vi phạm chuyên cần (nghỉ có phép, nghỉ không phép hoặc cúp tiết).
      Nếu đã ghi nhầm, nhờ Ban giám hiệu xóa vi phạm cũ ở mục Xử lý rồi ghi lại.</p>
      <div class="modal-actions wrap-actions"><span class="sp"></span>
        ${soConLai ? `<button type="button" class="btn" data-chon="huy">Hủy</button>
          <button type="button" class="btn primary" data-chon="tiep">Bỏ qua ${dsCu.length === 1 ? 'em này' : 'các em này'}, ghi ${soConLai} mục còn lại</button>`
          : '<button type="button" class="btn primary" data-chon="huy">Đã hiểu</button>'}
      </div>`);
    S.choModal = xong;
    $('#modal-body').onclick = e => {
      const t = e.target.closest('[data-chon]'); if (!t) return;
      S.choModal = null; dongModal(); xong(t.dataset.chon);
    };
    $('#modal-body [data-chon].primary')?.focus();
  });
}

/** Hỏi khi trùng. Trả về 'ghi_het' | 'bo_trung' | 'huy' */
function hoiTrung(dsCu, tongSo) {
  return new Promise(xong => {
    const nguoi = r => r.nguoi_ghi === S.user?.id ? 'chính thầy cô' : `<b>${esc(r.ten_nguoi_ghi || 'một người khác')}</b>`;
    const dong = r => `vi phạm <b>“${esc(r.ten_vi_pham)}”</b> của <b>${esc(r.hoc_sinh_id ? r.ho_ten : 'tập thể lớp')}</b> (${esc(r.ten_lop)})
      đã được ${nguoi(r)} ghi nhận vào lúc <b>${gioPhutVN(r.thoi_gian)}</b> buổi ${BUOI[buoiCua(r.thoi_gian)]} cùng ngày <b>${vn(ngayVN(r.thoi_gian))}</b>`;
    const tatCa = dsCu.length === tongSo;
    moModal(`<h2>Vi phạm đã được ghi nhận</h2>
      ${dsCu.length === 1
        ? `<p>Trong cùng buổi, ${dong(dsCu[0])}.</p>`
        : `<p>Trong cùng buổi, ${dsCu.length} vi phạm sau đã được ghi nhận:</p><ul class="ds-trung">${dsCu.map(r => `<li>${dong(r).replace(/^vi phạm /, '')}</li>`).join('')}</ul>`}
      <p><b>Thầy cô có muốn ghi nhận ${dsCu.length === 1 ? 'lần nữa' : 'thêm lần nữa'} không?</b></p>
      <div class="modal-actions wrap-actions">
        <span class="sp"></span>
        ${tatCa
          ? `<button type="button" class="btn" data-chon="huy">Không, bỏ qua</button>
             <button type="button" class="btn primary" data-chon="ghi_het">Có, ghi nhận lần nữa</button>`
          : `<button type="button" class="btn" data-chon="huy">Hủy</button>
             <button type="button" class="btn" data-chon="ghi_het">Ghi tất cả (${tongSo})</button>
             <button type="button" class="btn primary" data-chon="bo_trung">Bỏ qua mục trùng, ghi ${tongSo - dsCu.length} mục còn lại</button>`}
      </div>`);
    S.choModal = xong;
    $('#modal-body').onclick = e => {
      const t = e.target.closest('[data-chon]'); if (!t) return;
      S.choModal = null; dongModal(); xong(t.dataset.chon);
    };
    $('#modal-body [data-chon].primary')?.focus();
  });
}

/** Câu mô tả quyền xử lý của người đang đăng nhập (hiện dưới bảng Xử lý) */
function moTaQuyenXuLy() {
  if (App.coQuyen('vp.xu_ly_tat_ca')) return 'Bạn được xử lý mọi vi phạm.';
  const phan = [];
  if (App.coQuyen('vp.xu_ly')) { const ds = dtXuLyCua(S.user.id); phan.push(`vi phạm mức Nhẹ, Trung bình của ${ds.length ? 'điểm trường ' + ds.map(tenDT).join(', ') : 'toàn trường'}`); }
  const lopCN = S.lop.filter(l => l.gvcn_id === S.user.id).map(l => l.ten_lop);
  if (lopCN.length && App.coQuyen('vp.ghi_nhan')) phan.push(`vi phạm mức Nhẹ, Trung bình của lớp chủ nhiệm ${lopCN.join(', ')}`);
  return phan.length ? `Bạn được xử lý ${phan.join('; ')}. Vi phạm mức Nặng do người có quyền “Xử lý mọi vi phạm” xử lý.`
    : 'Bạn được xem danh sách; việc xử lý do GV chủ nhiệm, người được giao quyền xử lý và Ban giám hiệu thực hiện.';
}

function chipBienPhap() {
  const ds = (S.bp || []).filter(b => b.dang_dung);
  if (!ds.length) return '<p class="muted small">Chưa có biện pháp mẫu. Thêm ở mục <b>Danh mục</b> của phân hệ Vi phạm.</p>';
  const nhom = new Map();
  ds.forEach(b => { const k = b.nhom || ''; if (!nhom.has(k)) nhom.set(k, []); nhom.get(k).push(b); });
  const chip = b => `<button type="button" class="chip" data-bp="${esc(b.ten)}">${esc(b.ten)}</button>`;
  return [...nhom].map(([k, a]) => (nhom.size > 1 && k ? `<div class="nhom-ten">${esc(k)}</div>` : '') + `<div class="chips">${a.map(chip).join('')}</div>`).join('');
}

function moXuLy(ids, nguon, xong) {
  const one = ids.length === 1 ? nguon.find(r => r.id === ids[0]) : null;
  moModal(`<h2>${one ? 'Xử lý vi phạm' : `Xử lý ${ids.length} vi phạm`}</h2>
    ${one ? `<div class="info-box"><b>${esc(tenHS(one))}</b> · lớp ${esc(one.ten_lop)}<br>${esc(one.ten_vi_pham)}${+one.muc_do === 3 ? ' <span class="nang">Nặng</span>' : ''}
      <div class="muted small">${fmtTG(one.thoi_gian)}${one.ten_nguoi_ghi ? ' · ghi bởi ' + esc(one.ten_nguoi_ghi) : ''}</div>
      ${one.ghi_chu ? `<div class="small">Ghi chú: ${esc(one.ghi_chu)}</div>` : ''}</div>` : ''}
    <div class="lbl">Biện pháp xử lý <span class="muted small">(bấm để chèn nhanh)</span></div>
    <div id="bp-chips">${chipBienPhap()}</div>
    <textarea id="bp-text" class="input" rows="3" placeholder="Ghi rõ biện pháp, kết quả xử lý…">${esc(one?.bien_phap || '')}</textarea>
    <div class="lbl">Trạng thái</div>
    <div class="radio-row">
      ${['da_xu_ly', 'dang_xu_ly', 'chua_xu_ly'].map(k => `<label class="radio"><input type="radio" name="tt" value="${k}" ${(one && one.trang_thai !== 'chua_xu_ly' ? one.trang_thai : 'da_xu_ly') === k ? 'checked' : ''}> ${TRANG_THAI[k]}</label>`).join('')}
    </div>
    <div class="modal-actions">
      ${one && App.coQuyen('vp.xu_ly_tat_ca') ? '<button type="button" class="btn danger" id="m-xoa">Xóa vi phạm</button>' : ''}
      <span class="sp"></span>
      <button type="button" class="btn" data-dong>Hủy</button>
      <button type="button" class="btn primary" id="m-luu">Lưu</button>
    </div>`);

  $('#bp-chips').onclick = e => {
    const c = e.target.closest('[data-bp]'); if (!c) return;
    const ta = $('#bp-text'), v = ta.value.trim();
    ta.value = v ? `${v}; ${c.dataset.bp}` : c.dataset.bp;
    ta.focus();
  };
  $('#m-luu').onclick = async () => {
    const tt = $('input[name=tt]:checked').value;
    const bp = $('#bp-text').value.trim() || null;
    if (tt !== 'chua_xu_ly' && !bp) { toast('Vui lòng nhập biện pháp xử lý.', 'err'); $('#bp-text').focus(); return; }
    const btnLuu = $('#m-luu'); btnLuu.disabled = true;
    const { data, error } = await sb.from('vi_pham').update({ trang_thai: tt, bien_phap: tt === 'chua_xu_ly' ? null : bp }).in('id', ids).select('id');
    btnLuu.disabled = false;
    if (error) { toast(dichLoi(error), 'err'); return; }
    if (data.length < ids.length) toast(`Chỉ cập nhật được ${data.length}/${ids.length} mục (không đủ quyền).`, 'err');
    else toast(`Đã cập nhật ${data.length} vi phạm.`);
    dongModal(); App.capNhatHuyHieu(); xong && xong();
  };
  const xoa = $('#m-xoa');
  if (xoa) xoa.onclick = async () => {
    if (!confirm('Xóa vĩnh viễn vi phạm này? Thao tác không thể hoàn tác.')) return;
    const { data, error } = await sb.from('vi_pham').delete().in('id', ids).select('id');
    if (error || !data.length) { toast(error ? dichLoi(error) : 'Không xóa được (không đủ quyền).', 'err'); return; }
    toast('Đã xóa.'); dongModal(); App.capNhatHuyHieu(); xong && xong();
  };
}

async function lichSuHS(id) {
  const h = S.hsMap.get(id);
  moModal(`<h2>${esc(h?.ho_ten || 'Học sinh')}</h2><p class="muted">Lớp hiện tại: ${esc(tenLop(h?.lop_id))}${h && !h.dang_hoc ? ' · đã nghỉ học' : ''}</p>
    <div id="ls-body"><p class="muted">Đang tải…</p></div>
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Đóng</button></div>`);
  const { data, error } = await sb.from('v_vi_pham').select('*').eq('hoc_sinh_id', id).order('thoi_gian', { ascending: false });
  const box = $('#ls-body'); if (!box) return;
  if (error) { box.innerHTML = `<p class="err">${esc(dichLoi(error))}</p>`; return; }
  if (!data.length) { box.innerHTML = '<p class="muted">Chưa có vi phạm nào.</p>'; return; }
  const theoLoai = {};
  data.forEach(r => (theoLoai[r.ten_vi_pham] = (theoLoai[r.ten_vi_pham] || 0) + 1));
  const diem = data.reduce((s, r) => s + (+r.diem_tru || 0), 0);
  const chua = data.filter(r => r.trang_thai !== 'da_xu_ly').length;
  const nhieuLop = new Set(data.map(r => r.lop_id)).size > 1;
  box.innerHTML = `<div class="mini-kpis"><div><b>${data.length}</b><span>vi phạm</span></div><div><b>${so(diem)}</b><span>điểm trừ</span></div><div><b>${chua}</b><span>chưa xử lý xong</span></div></div>
    <p class="small">${Object.entries(theoLoai).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span class="tag">${esc(t)} <i>×${n}</i></span>`).join(' ')}</p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Thời gian</th>${nhieuLop ? '<th>Lớp</th>' : ''}<th>Vi phạm</th><th>Trạng thái</th><th>Biện pháp</th></tr></thead>
    <tbody>${data.map(r => `<tr><td class="nowrap">${fmtTG(r.thoi_gian)}</td>${nhieuLop ? `<td>${esc(r.ten_lop)}</td>` : ''}<td>${esc(r.ten_vi_pham)}${r.ghi_chu ? `<div class="muted small">${esc(r.ghi_chu)}</div>` : ''}</td><td>${badgeTT(r.trang_thai)}</td><td class="small">${esc(r.bien_phap || '')}</td></tr>`).join('')}</tbody></table></div>`;
}

/** Chi tiết một lớp trong khoảng thời gian đang thống kê */
function chiTietLop(lopId, ds, tieuDeKy) {
  const l = S.lopMap.get(lopId);
  const a = ds.filter(r => r.lop_id === lopId);
  const tapThe = a.filter(r => !r.hoc_sinh_id);
  const m = new Map();
  a.filter(r => r.hoc_sinh_id).forEach(r => {
    const o = m.get(r.hoc_sinh_id) || { id: r.hoc_sinh_id, ten: r.ho_ten, c: 0, diem: 0 };
    o.c++; o.diem += +r.diem_tru || 0; m.set(r.hoc_sinh_id, o);
  });
  const top = [...m.values()].sort((x, y) => y.c - x.c || y.diem - x.diem);
  const theoLoai = {};
  a.forEach(r => (theoLoai[r.ten_vi_pham] = (theoLoai[r.ten_vi_pham] || 0) + 1));
  moModal(`<h2>Lớp ${esc(l?.ten_lop || '')}</h2>
    <p class="muted">${esc(tieuDeKy)}${l?.gvcn_id ? ' · GVCN: ' + esc(tenND(l.gvcn_id)) : ''}${l?.diem_truong_id ? ' · ' + esc(tenDT(l.diem_truong_id)) : ''}</p>
    <div class="mini-kpis"><div><b>${a.length}</b><span>vi phạm</span></div><div><b>${tapThe.length}</b><span>vi phạm tập thể</span></div>
      <div><b>${m.size}</b><span>học sinh vi phạm</span></div><div><b>${a.filter(r => r.trang_thai !== 'da_xu_ly').length}</b><span>chưa xử lý xong</span></div></div>
    <p class="small">${Object.entries(theoLoai).sort((x, y) => y[1] - x[1]).map(([t, n]) => `<span class="tag">${esc(t)} <i>×${n}</i></span>`).join(' ') || '<span class="muted">Không có vi phạm.</span>'}</p>
    ${top.length ? `<h3>Học sinh vi phạm</h3><div class="table-wrap"><table class="tbl"><thead><tr><th>Học sinh</th><th class="r">Số VP</th><th class="r">Điểm trừ</th></tr></thead>
      <tbody>${top.map(o => `<tr><td><a href="#" data-lsu="${o.id}">${esc(o.ten)}</a></td><td class="r">${o.c}</td><td class="r">${so(o.diem)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${tapThe.length ? `<h3>Vi phạm tập thể</h3><ul class="recent">${tapThe.map(r => `<li><span class="muted">${fmtGio(r.thoi_gian)}</span><span>${esc(r.ten_vi_pham)}</span>${badgeTT(r.trang_thai)}</li>`).join('')}</ul>` : ''}
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Đóng</button></div>`, true);
  $('#modal-body').onclick = e => { const t = e.target.closest('[data-lsu]'); if (t) { e.preventDefault(); lichSuHS(+t.dataset.lsu); } };
}

/* ---------- Bộ lọc nhiều loại vi phạm (Thống kê) ---------- */
/** Các loại vi phạm theo nhóm: [[tên nhóm, [loại…]], …] */
function nhomLoai() {
  const nhom = new Map();
  [...S.loai].sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0)).forEach(l => { const k = l.nhom || 'Khác'; if (!nhom.has(k)) nhom.set(k, []); nhom.get(k).push(l); });
  return [...nhom];
}
/** Mô tả các loại đã chọn: "Tất cả loại vi phạm" / "nhóm Nề nếp" / "Đi học trễ, Vắng không phép và 2 loại khác" */
function moTaLoaiChon(ids) {
  if (!ids.length) return 'Tất cả loại vi phạm';
  const chon = new Set(ids), phan = [];
  let le = [];
  for (const [k, a] of nhomLoai()) {
    const trong = a.filter(l => chon.has(l.id));
    if (trong.length && trong.length === a.length && a.length > 1) phan.push(`cả nhóm ${k}`);
    else le = le.concat(trong.map(l => l.ten));
  }
  const tatCa = phan.concat(le);
  return tatCa.length <= 3 ? tatCa.join(', ') : `${tatCa.slice(0, 2).join(', ')} và ${tatCa.length - 2} mục khác`;
}
/** Bảng tick chọn nhiều loại vi phạm, chia theo nhóm */
function bangChonLoai(ids) {
  const chon = new Set(ids);
  return nhomLoai().map(([k, a]) => {
    const n = a.filter(l => chon.has(l.id)).length;
    return `<div class="chon-nhom" data-nhom-wrap>
      <label class="radio chon-nhom-dau"><input type="checkbox" data-loai-nhom="${esc(k)}" ${n === a.length ? 'checked' : ''} ${n && n < a.length ? 'data-mot-phan="1"' : ''}> <b>${esc(k)}</b> <span class="muted small">(${a.length})</span></label>
      ${a.map(l => `<label class="radio chon-muc" data-ten="${esc(boDau(l.ten))}"><input type="checkbox" data-loai-id="${l.id}" data-nhom="${esc(k)}" ${chon.has(l.id) ? 'checked' : ''}> ${esc(l.ten)}${l.dang_dung ? '' : ' <span class="muted small">(đã tắt)</span>'}</label>`).join('')}
    </div>`;
  }).join('') || '<p class="muted small">Chưa có hình thức vi phạm.</p>';
}
/* Đóng bảng chọn khi bấm ra ngoài (gắn một lần) */
document.addEventListener('mousedown', e => {
  const b = document.querySelector('.bang-chon:not(.hidden)');
  if (b && !e.target.closest('.loc-loai')) { b.classList.add('hidden'); b.dispatchEvent(new Event('dong')); }
});

/** Chi tiết một loại vi phạm trong khoảng thời gian đang thống kê */
function chiTietLoai(loaiId, ds, tieuDeKy) {
  const a = ds.filter(r => r.loai_id === loaiId);
  const l = S.loai.find(x => x.id === loaiId) || { ten: a[0]?.ten_vi_pham };
  const theoLop = new Map(), theoHS = new Map();
  a.forEach(r => {
    theoLop.set(r.ten_lop, (theoLop.get(r.ten_lop) || 0) + 1);
    if (r.hoc_sinh_id) { const o = theoHS.get(r.hoc_sinh_id) || { id: r.hoc_sinh_id, ten: r.ho_ten, lop: r.ten_lop, c: 0 }; o.c++; theoHS.set(r.hoc_sinh_id, o); }
  });
  const lop = [...theoLop].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'vi', { numeric: true }));
  const hs = [...theoHS.values()].sort((x, y) => y.c - x.c).slice(0, 30);
  moModal(`<h2>${esc(l.ten || '')}</h2>
    <p class="muted">${esc(tieuDeKy)}${l.nhom ? ' · ' + esc(l.nhom) : ''} · ${MUC_DO[l.muc_do] || ''}</p>
    <div class="mini-kpis"><div><b>${a.length}</b><span>vi phạm</span></div><div><b>${theoHS.size}</b><span>học sinh</span></div>
      <div><b>${theoLop.size}</b><span>lớp</span></div><div><b>${a.filter(r => r.trang_thai !== 'da_xu_ly').length}</b><span>chưa xử lý xong</span></div></div>
    <h3>Theo lớp</h3><p class="small">${lop.map(([t, n]) => `<span class="tag">${esc(t)} <i>×${n}</i></span>`).join(' ')}</p>
    ${hs.length ? `<h3>Học sinh vi phạm</h3><div class="table-wrap"><table class="tbl"><thead><tr><th>Học sinh</th><th>Lớp</th><th class="r">Số lần</th></tr></thead>
      <tbody>${hs.map(o => `<tr><td><a href="#" data-lsu="${o.id}">${esc(o.ten)}</a></td><td>${esc(o.lop)}</td><td class="r">${o.c}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Đóng</button></div>`, true);
  $('#modal-body').onclick = e => { const t = e.target.closest('[data-lsu]'); if (t) { e.preventDefault(); lichSuHS(+t.dataset.lsu); } };
}

