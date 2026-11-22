'use strict';
/* =====================================================================
   PHÂN HỆ SỔ TRỰC
   Lịch trực (mỗi buổi, mỗi điểm trường 1 giáo viên – Quản trị xếp),
   biên bản trực (đầu biên bản: số liệu chuyên cần của buổi, của điểm), chốt sổ,
   Ban giám hiệu ghi ý kiến chỉ đạo, xác nhận đã xem, in sổ, cảnh báo buổi chưa ghi sổ.
   Cơ sở dữ liệu: supabase/40-so-truc.sql. Quyền: st.xem (Xem sổ trực).
   ===================================================================== */

const BUOI_TEN = { sang: 'Sáng', chieu: 'Chiều' };
const MSG_CHUA_CAI_ST = 'Chưa cài phân hệ Sổ trực: hãy chạy file supabase/40-so-truc.sql trên Supabase.';
const loiChuaCaiST = e => /st_lich|st_bien_ban|st_muc|st_chuyen_can|st_ds_diem|does not exist|schema cache|Could not find the function/i.test(e?.message || '');
const khoaBuoi = (ngay, buoi, dt) => `${ngay}|${buoi}|${dt ?? ''}`;
const thuNgayST = ymd => (thuCua(ymd) === 0 ? 'Chủ nhật' : 'Thứ ' + (thuCua(ymd) + 1)) + ', ' + vn(ymd);
const xemSo = () => App.coQuyen('st.xem');

/* ---------- Điểm trường (tên) – lấy riêng vì người trực có thể không có quyền xem học sinh ---------- */
S.stDiem = [];
App.khiTaiDuLieu(async () => {
  if (!App.daCai('so_truc')) return;
  const { data, error } = await sb.rpc('st_ds_diem');
  if (!error) S.stDiem = data || [];
});
/** Các điểm để trực: các điểm trường; trường không chia điểm → một cột "Toàn trường" */
const dsDiemTruc = () => S.stDiem.length ? S.stDiem.map(d => ({ id: d.id, ten: d.ten })) : [{ id: null, ten: 'Toàn trường' }];
const tenDiemTruc = id => id == null ? (S.stDiem.length ? 'Chưa rõ điểm' : 'Toàn trường') : (S.stDiem.find(d => d.id === id)?.ten || 'Điểm đã xóa');
const locDiem = (q, dt) => dt == null ? q.is('diem_truong_id', null) : q.eq('diem_truong_id', dt);

/* ---------- Thời điểm buổi trực (giờ Việt Nam): sáng 0–12 giờ, chiều 12–18 giờ ---------- */
const buoiDaBatDau = (ngay, buoi) => ngay < homNay() || (ngay === homNay() && (buoi === 'sang' || gioVN(Date.now()) >= 12));
const buoiDaQua = (ngay, buoi) => ngay < homNay() || (ngay === homNay() && gioVN(Date.now()) >= (buoi === 'sang' ? 12 : 18));

/** Số buổi trực của tôi đã bắt đầu (30 ngày gần đây) mà chưa chốt sổ – chấm đỏ */
async function demBuoiChuaChot() {
  const tu = congNgay(homNay(), -30);
  const [l, b] = await Promise.all([
    sb.from('st_lich').select('ngay,buoi,diem_truong_id').eq('nguoi_dung_id', S.user.id).gte('ngay', tu).lte('ngay', homNay()),
    sb.from('st_bien_ban').select('ngay,buoi,diem_truong_id,da_chot').gte('ngay', tu)
  ]);
  if (l.error || b.error) return 0;
  const chot = new Set(b.data.filter(x => x.da_chot).map(x => khoaBuoi(x.ngay, x.buoi, x.diem_truong_id)));
  return l.data.filter(x => buoiDaBatDau(x.ngay, x.buoi) && !chot.has(khoaBuoi(x.ngay, x.buoi, x.diem_truong_id))).length;
}
/** Số biên bản đã chốt mà Ban giám hiệu chưa xem – chấm đỏ */
async function demChuaXem() {
  if (!xemSo()) return 0;
  const { count, error } = await sb.from('st_bien_ban').select('id', { count: 'exact', head: true }).eq('da_chot', true).eq('da_xem', false);
  return error ? 0 : count || 0;
}

/** Khung chung các trang của phân hệ */
async function veSoTruc(el, trang) {
  if (S.stTrang !== trang) { S.stMo = null; S.stIn = false; }
  S.stTrang = trang;
  const conSong = giuPhien();
  el.innerHTML = '<div id="st-than"><section class="card"><p class="muted pad">Đang tải…</p></section></div>';
  el.onclick = e => S.stClick && S.stClick(e);
  el.onchange = e => S.stChange && S.stChange(e);
  el.oninput = e => S.stInput && S.stInput(e);
  S.stClick = S.stChange = S.stInput = null;
  const than = $('#st-than');
  try {
    if (S.stMo) await stBienBan(than, conSong, S.stMo);
    else if (trang === 'cua_toi') await stCuaToi(than, conSong);
    else if (trang === 'lich') await stLich(than, conSong);
    else if (trang === 'so') await (S.stIn ? stInSo(than, conSong) : stSo(than, conSong));
    else if (trang === 'tong_hop') await stTongHop(than, conSong);
    else if (trang === 'mau') await stMau(than, conSong);
  } catch (e) {
    if (conSong()) than.innerHTML = `<section class="card"><p class="err pad">${esc(loiChuaCaiST(e) ? MSG_CHUA_CAI_ST : dichLoi(e))}</p></section>`;
  }
}
const moBienBan = (ngay, buoi, dt) => { S.stMo = { ngay, buoi, dt }; dieuHuong(); };

/* =====================================================================
   BUỔI TRỰC CỦA TÔI
   ===================================================================== */
async function stCuaToi(than, conSong) {
  const tu = congNgay(homNay(), -60), den = congNgay(homNay(), 21);
  const [l, b] = await Promise.all([
    layHet(() => sb.from('st_lich').select('*').eq('nguoi_dung_id', S.user.id).gte('ngay', tu).lte('ngay', den).order('ngay').order('buoi', { ascending: false })),
    layHet(() => sb.from('st_bien_ban').select('ngay,buoi,diem_truong_id,da_chot,y_kien,da_xem,sua_luc').gte('ngay', tu).order('id'))
  ]);
  if (!conSong()) return;
  const bb = new Map(b.map(x => [khoaBuoi(x.ngay, x.buoi, x.diem_truong_id), x]));
  const thuTuBuoi = x => x.ngay + (x.buoi === 'sang' ? 'a' : 'b');
  const sapToi = l.filter(x => !buoiDaQua(x.ngay, x.buoi)).sort((a, c) => thuTuBuoi(a).localeCompare(thuTuBuoi(c)));
  const daQua = l.filter(x => buoiDaQua(x.ngay, x.buoi)).sort((a, c) => thuTuBuoi(c).localeCompare(thuTuBuoi(a)));
  const tt = x => {
    const r = bb.get(khoaBuoi(x.ngay, x.buoi, x.diem_truong_id));
    if (!buoiDaBatDau(x.ngay, x.buoi)) return '<span class="tt">Chưa đến buổi</span>';
    if (!r) return '<span class="tt tt-chua_xu_ly">Chưa ghi sổ</span>';
    if (!r.da_chot) return '<span class="tt tt-dang_xu_ly">Đang ghi – chưa chốt</span>';
    return '<span class="tt tt-da_xu_ly">Đã chốt sổ</span>' + (r.y_kien ? ' <span class="tt tt-bc-da_nop" title="Có ý kiến của Ban giám hiệu">💬 Có ý kiến BGH</span>' : '') + (r.da_xem ? ' <span class="muted small">· BGH đã xem</span>' : '');
  };
  const dong = x => `<tr class="${x.ngay === homNay() ? 'st-hom-nay' : ''}"><td class="nowrap"><b>${thuNgayST(x.ngay)}</b></td><td>${BUOI_TEN[x.buoi]}</td><td>${esc(tenDiemTruc(x.diem_truong_id))}</td><td>${tt(x)}</td>
    <td class="r">${buoiDaBatDau(x.ngay, x.buoi) ? `<button type="button" class="btn sm ${bb.get(khoaBuoi(x.ngay, x.buoi, x.diem_truong_id))?.da_chot ? '' : 'primary'}" data-mo="${khoaBuoi(x.ngay, x.buoi, x.diem_truong_id)}">${bb.get(khoaBuoi(x.ngay, x.buoi, x.diem_truong_id))?.da_chot ? 'Xem' : '✏️ Ghi sổ'}</button>` : ''}</td></tr>`;
  const bang = ds => `<div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Buổi</th><th>Điểm trường</th><th>Tình trạng sổ</th><th></th></tr></thead><tbody>${ds.map(dong).join('')}</tbody></table></div>`;
  than.innerHTML = `<section class="card"><h2>Buổi trực của tôi</h2>
    <p class="muted small">Đến buổi trực, bấm <b>Ghi sổ</b> để ghi diễn biến tình hình; đầu biên bản tự có số liệu chuyên cần của buổi. Ghi xong bấm <b>Chốt sổ</b>.</p>
    <h3>Hôm nay và sắp tới</h3>${sapToi.length ? bang(sapToi) : '<p class="muted">Chưa có lịch trực sắp tới.</p>'}
    <h3>Các buổi đã trực (60 ngày gần đây)</h3>${daQua.length ? bang(daQua) : '<p class="muted">Chưa có.</p>'}</section>`;
  S.stClick = e => {
    const b2 = e.target.closest('[data-mo]'); if (!b2) return;
    const [ngay, buoi, dt] = b2.dataset.mo.split('|');
    moBienBan(ngay, buoi, dt ? +dt : null);
  };
}

/* =====================================================================
   BIÊN BẢN TRỰC (ghi / xem / ý kiến)
   ===================================================================== */
/** Khối số liệu chuyên cần ở đầu biên bản */
function htmlChuyenCan(cc, coCapNhat) {
  if (!cc) return '<p class="muted small">Chưa có số liệu chuyên cần.</p>';
  const tyLe = cc.si_so ? Math.round(cc.co_mat / cc.si_so * 1000) / 10 : null;
  const vang = (cc.hoc_sinh || []).filter(h => h.loai !== 'cup_tiet'), cup = (cc.hoc_sinh || []).filter(h => h.loai === 'cup_tiet');
  const tenHSs = ds => ds.map(h => `${esc(h.ten)} (${esc(h.lop)}${h.loai === 'co_phep' ? ', P' : h.loai === 'khong_phep' ? ', KP' : ''})`).join('; ');
  return `<div class="st-cc">
    <div class="st-cc-so">
      <div><span>Sĩ số</span><b>${so(cc.si_so)}</b><small>${cc.so_lop_hoc} lớp học</small></div>
      <div><span>Có mặt</span><b>${so(cc.co_mat)}</b><small>${tyLe == null ? '' : `chuyên cần ${so(tyLe)}%`}</small></div>
      <div><span>Vắng có phép</span><b>${so(cc.cp)}</b></div>
      <div><span>Vắng không phép</span><b class="${cc.kp ? 'chu-do' : ''}">${so(cc.kp)}</b></div>
      <div><span>Cúp tiết</span><b class="${cc.ct ? 'chu-cam' : ''}">${so(cc.ct)}</b></div>
    </div>
    ${(cc.lop_nghi || []).length ? `<p class="small">Lớp nghỉ buổi này: <b>${esc(cc.lop_nghi.join(', '))}</b></p>` : ''}
    ${vang.length ? `<p class="small"><b>Học sinh vắng:</b> ${tenHSs(vang)}</p>` : ''}
    ${cup.length ? `<p class="small"><b>Cúp tiết:</b> ${tenHSs(cup)}</p>` : ''}
    <details class="small"><summary>Chi tiết theo lớp</summary><div class="table-wrap"><table class="tbl st-cc-lop"><thead><tr><th>Lớp</th><th class="r">Sĩ số</th><th class="r">Vắng P</th><th class="r">Vắng KP</th><th class="r">Cúp tiết</th></tr></thead><tbody>
      ${(cc.lop || []).map(l => l.nghi ? `<tr class="dong-nghi"><td>${esc(l.ten)}</td><td colspan="4"><span class="tag-nghi">Lớp nghỉ</span></td></tr>`
        : `<tr><td>${esc(l.ten)}</td><td class="r">${l.si_so}</td><td class="r">${l.cp || ''}</td><td class="r">${l.kp ? `<b class="chu-do">${l.kp}</b>` : ''}</td><td class="r">${l.ct ? `<b class="chu-cam">${l.ct}</b>` : ''}</td></tr>`).join('')}</tbody></table></div></details>
    <p class="muted small">${coCapNhat ? `Số liệu lấy lúc ${fmtGio(cc.luc)} từ phần Chuyên cần (vắng, cúp tiết do giáo viên ghi; lớp nghỉ đã đánh dấu); sẽ được chốt lại khi bấm Chốt sổ.`
      : `Số liệu chốt lúc ${fmtGio(cc.luc)}.`}</p></div>`;
}

/** Nội dung một biên bản để in */
function htmlBienBanIn(r, cc) {
  return `<article class="st-bb-in">
    <h3>BIÊN BẢN TRỰC – Buổi ${BUOI_TEN[r.buoi].toLowerCase()} ${thuNgayST(r.ngay)} – ${esc(tenDiemTruc(r.diem_truong_id))}</h3>
    <p class="small">Giáo viên trực: <b>${esc(tenND(r.nguoi_truc) || '…')}</b>${r.chot_luc ? ` · Chốt sổ lúc ${fmtTG(r.chot_luc)}` : ' · <span class="chu-do">Chưa chốt sổ</span>'}</p>
    ${htmlChuyenCan(cc, false)}
    ${(r.noi_dung || []).map(m => `<div class="st-muc-in"><b>${esc(m.ten)}:</b> ${m.nd ? esc(m.nd) : '<span class="muted">Không có gì đặc biệt.</span>'}</div>`).join('')}
    <div class="st-y-kien-in"><b>Ý kiến chỉ đạo của Ban giám hiệu:</b> ${r.y_kien ? esc(r.y_kien) : '<span class="muted">…</span>'}
      ${r.nguoi_y_kien ? `<span class="muted small">(${esc(tenND(r.nguoi_y_kien))}, ${fmtGio(r.y_kien_luc)})</span>` : ''}
      ${r.da_xem ? `<div class="small">Đã xem: ${esc(tenND(r.nguoi_xem))}, ${fmtGio(r.xem_luc)}</div>` : ''}</div>
  </article>`;
}

async function stBienBan(than, conSong, mo) {
  const { ngay, buoi, dt } = mo;
  const [lich, bb, muc] = await Promise.all([
    locDiem(sb.from('st_lich').select('*').eq('ngay', ngay).eq('buoi', buoi), dt).maybeSingle(),
    locDiem(sb.from('st_bien_ban').select('*').eq('ngay', ngay).eq('buoi', buoi), dt).maybeSingle(),
    sb.from('st_muc').select('*').eq('dang_dung', true).order('thu_tu').order('id')
  ]);
  for (const r of [lich, bb, muc]) if (r.error) throw r.error;
  if (!conSong()) return;
  const r = bb.data, laTruc = lich.data?.nguoi_dung_id === S.user.id;
  const ghiDuoc = laTruc && !r?.da_chot && buoiDaBatDau(ngay, buoi);
  let cc = r?.da_chot ? r.chuyen_can : null;
  if (!cc && (laTruc || xemSo())) {
    const x = await sb.rpc('st_chuyen_can', { p_ngay: ngay, p_buoi: buoi, p_dt: dt });
    if (!x.error) cc = x.data;
    if (!conSong()) return;
  }
  // Các mục: biên bản đã chốt giữ nguyên như lúc ghi; đang ghi thì theo mẫu hiện hành (giữ cả nội dung mục cũ đã ghi)
  const daGhi = r?.noi_dung || [];
  const mucs = r?.da_chot ? daGhi : [
    ...muc.data.map(m => ({ muc_id: m.id, ten: m.ten, goi_y: m.goi_y, nd: daGhi.find(x => x.muc_id === m.id)?.nd || '' })),
    ...daGhi.filter(x => x.nd && !muc.data.some(m => m.id === x.muc_id))
  ];
  const ghiVang = App.trangDuoc('cc-ghi-vang'), ghiVP = App.trangDuoc('vp-nhap');
  than.innerHTML = `<section class="card">
    <p class="khong-chup"><button type="button" class="link" id="st-ve">← Quay lại</button></p>
    <div class="head-row"><h2 style="margin:0">Biên bản trực – Buổi ${BUOI_TEN[buoi].toLowerCase()} ${thuNgayST(ngay)} – ${esc(tenDiemTruc(dt))}</h2>
      ${r?.da_chot ? '<span class="tt tt-da_xu_ly">Đã chốt sổ</span>' : r ? '<span class="tt tt-dang_xu_ly">Đang ghi</span>' : '<span class="tt tt-chua_xu_ly">Chưa ghi sổ</span>'}</div>
    <p class="small">Giáo viên trực: <b>${esc(tenND(lich.data?.nguoi_dung_id) || 'chưa phân công')}</b>
      ${r?.nguoi_truc && r.nguoi_truc !== lich.data?.nguoi_dung_id ? ` · Người ghi: ${esc(tenND(r.nguoi_truc))}` : ''}
      ${r?.sua_luc ? ` · Ghi lúc ${fmtGio(r.sua_luc)}` : ''}${r?.chot_luc ? ` · Chốt sổ lúc ${fmtTG(r.chot_luc)}` : ''}</p>
    <h3>Số liệu chuyên cần</h3>
    ${htmlChuyenCan(cc, !r?.da_chot)}
    ${ghiDuoc && (ghiVang || ghiVP) ? `<p class="small khong-chup">Cần ghi thêm: ${ghiVang ? '<a href="#cc-ghi-vang">Ghi nhận vắng</a>' : ''}${ghiVang && ghiVP ? ' · ' : ''}${ghiVP ? '<a href="#vp-nhap">Ghi vi phạm</a>' : ''}
      <span class="muted">(ghi xong quay lại đây, số liệu tự cập nhật)</span></p>` : ''}
    <h3>Diễn biến tình hình</h3>
    <div id="st-muc">${mucs.map((m, i) => `<label class="lbl">${esc(m.ten)}
      ${ghiDuoc ? `<textarea class="input" rows="2" data-muc="${i}" placeholder="${esc(m.goi_y || 'Không có gì đặc biệt')}">${esc(m.nd || '')}</textarea>`
        : `<div class="st-nd">${m.nd ? esc(m.nd) : '<span class="muted">Không có gì đặc biệt.</span>'}</div>`}</label>`).join('')
      || '<p class="muted">Chưa có mục nào trong mẫu biên bản. Quản trị vào Sổ trực → Mẫu biên bản để thêm.</p>'}</div>
    ${ghiDuoc ? `<div class="modal-actions khong-chup"><span class="muted small" id="st-luu-tt"></span><span class="sp"></span>
      <button type="button" class="btn" id="st-luu">Lưu</button><button type="button" class="btn primary" id="st-chot">✔ Chốt sổ</button></div>
      <p class="muted small">Chốt sổ xong thì không sửa được nữa (giống ký tên trên sổ giấy); số liệu chuyên cần được chốt theo thời điểm đó.</p>`
      : laTruc && !buoiDaBatDau(ngay, buoi) ? '<p class="muted">Chưa đến buổi trực.</p>' : ''}
    <h3>Ý kiến chỉ đạo của Ban giám hiệu</h3>
    ${xemSo() ? `<textarea class="input" rows="3" id="st-y-kien" placeholder="Ý kiến chỉ đạo (giáo viên trực sẽ thấy)…">${esc(r?.y_kien || '')}</textarea>
      ${r?.nguoi_y_kien ? `<p class="muted small">${esc(tenND(r.nguoi_y_kien))} · ${fmtGio(r.y_kien_luc)}</p>` : ''}
      <div class="row-gap wrap khong-chup">${r ? `<button type="button" class="btn sm primary" id="st-luu-yk">Lưu ý kiến</button>
        ${r.da_chot ? `<button type="button" class="btn sm" id="st-da-xem">${r.da_xem ? '↺ Bỏ xác nhận đã xem' : '✔ Xác nhận đã xem'}</button>
          <button type="button" class="btn sm" id="st-mo-khoa" title="Cho giáo viên trực sửa lại biên bản">🔓 Mở khóa cho sửa</button>` : ''}`
        : '<span class="muted small">Giáo viên trực chưa ghi sổ.</span>'}</div>
      ${r?.da_xem ? `<p class="small chu-xanh">✔ Đã xem: ${esc(tenND(r.nguoi_xem))}, ${fmtGio(r.xem_luc)}</p>` : ''}`
      : r?.y_kien ? `<div class="bc-nhan-xet">${esc(r.y_kien)} <span class="muted small">(${esc(tenND(r.nguoi_y_kien))}, ${fmtGio(r.y_kien_luc)})</span></div>`
      : '<p class="muted small">Chưa có ý kiến.</p>'}
    ${!xemSo() && r?.da_xem ? `<p class="small chu-xanh">✔ Ban giám hiệu đã xem (${esc(tenND(r.nguoi_xem))}, ${fmtGio(r.xem_luc)}).</p>` : ''}
    ${r && App.laQuanTri() ? `<div class="st-xoa khong-chup"><button type="button" class="btn sm danger" id="st-xoa">🗑 Xóa biên bản này</button>
      <span class="muted small">Chỉ Quản trị. Xóa hẳn nội dung, số liệu đã chốt và ý kiến chỉ đạo; lịch trực vẫn giữ (buổi này sẽ thành “Chưa ghi sổ”).</span></div>` : ''}
  </section>`;

  const noiDung = () => mucs.map((m, i) => ({ muc_id: m.muc_id ?? null, ten: m.ten, nd: ($(`[data-muc="${i}"]`)?.value ?? m.nd ?? '').trim() }));
  const luu = async chot => {
    const row = { noi_dung: noiDung(), ...(chot ? { da_chot: true } : {}) };
    const q = r ? sb.from('st_bien_ban').update(row).eq('id', r.id).select('id') : sb.from('st_bien_ban').insert({ ngay, buoi, diem_truong_id: dt, ...row }).select('id');
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) throw new Error('Không lưu được (biên bản đã chốt hoặc không phải buổi trực của bạn).');
  };
  const capNhat = async (row, thongBao) => {
    const { data, error } = await sb.from('st_bien_ban').update(row).eq('id', r.id).select('id');
    if (error || !data?.length) { toast(error ? dichLoi(error) : 'Không đủ quyền.', 'err'); return; }
    toast(thongBao); App.capNhatHuyHieu(); if (conSong()) stBienBan(than, conSong, mo);
  };
  S.stInput = e => { if (e.target.dataset.muc !== undefined && $('#st-luu-tt')) $('#st-luu-tt').textContent = 'Chưa lưu…'; };
  S.stClick = async e => {
    const id = e.target.closest('button')?.id;
    if (e.target.closest('#st-ve')) { S.stMo = null; dieuHuong(); return; }
    if (id === 'st-luu' || id === 'st-chot') {
      if (id === 'st-chot' && !confirm('Chốt sổ buổi trực này?\n\nSau khi chốt sẽ không sửa được nữa; số liệu chuyên cần được chốt theo thời điểm hiện tại.')) return;
      const btn = $('#' + id); btn.disabled = true;
      try { await luu(id === 'st-chot'); toast(id === 'st-chot' ? 'Đã chốt sổ. Cảm ơn thầy cô!' : 'Đã lưu biên bản.'); App.capNhatHuyHieu(); if (conSong()) stBienBan(than, conSong, mo); }
      catch (ex) { toast(loiChuaCaiST(ex) ? MSG_CHUA_CAI_ST : dichLoi(ex), 'err'); btn.disabled = false; }
    } else if (id === 'st-luu-yk') capNhat({ y_kien: $('#st-y-kien').value.trim() || null }, 'Đã lưu ý kiến chỉ đạo.');
    else if (id === 'st-da-xem') capNhat({ da_xem: !r.da_xem, y_kien: $('#st-y-kien').value.trim() || null }, r.da_xem ? 'Đã bỏ xác nhận.' : 'Đã xác nhận đã xem.');
    else if (id === 'st-mo-khoa') {
      if (confirm('Mở khóa để giáo viên trực sửa lại biên bản? Giáo viên trực sẽ phải chốt sổ lại.')) capNhat({ da_chot: false }, 'Đã mở khóa biên bản.');
    } else if (id === 'st-xoa') {
      xoaBienBan(r.id, `${BUOI_TEN[buoi]} ${vn(ngay)} – ${tenDiemTruc(dt)}`, () => { S.stMo = null; dieuHuong(); });
    }
  };
}

/** Quản trị xóa một biên bản trực (máy chủ chỉ cho Quản trị xóa) */
async function xoaBienBan(id, ten, xong) {
  if (!confirm(`XÓA biên bản trực: ${ten}?\n\nXóa hẳn nội dung, số liệu đã chốt và ý kiến chỉ đạo; không khôi phục được. Lịch trực vẫn giữ.`)) return;
  const { data, error } = await sb.from('st_bien_ban').delete().eq('id', id).select('id');
  if (error || !data?.length) { toast(error ? dichLoi(error) : 'Không đủ quyền xóa (chỉ Quản trị).', 'err'); return; }
  toast('Đã xóa biên bản.'); App.capNhatHuyHieu(); xong();
}

/* =====================================================================
   LỊCH TRỰC (mọi người xem; Quản trị xếp)
   ===================================================================== */
async function stLich(than, conSong) {
  const sua = App.laQuanTri();
  if (!S.stTuan) S.stTuan = dauTuan(homNay());
  const tu = S.stTuan, ngays = [0, 1, 2, 3, 4, 5].map(i => congNgay(tu, i));   // Thứ Hai → Thứ Bảy
  const lich = await layHet(() => sb.from('st_lich').select('*').gte('ngay', tu).lte('ngay', ngays[5]).order('id'));
  if (!conSong()) return;
  const m = new Map(lich.map(x => [khoaBuoi(x.ngay, x.buoi, x.diem_truong_id), x]));
  const diem = dsDiemTruc(), nguoi = S.nd.filter(u => !['cho_duyet', 'nhan_vien'].includes(u.chuc_vu)).sort((a, b) => String(a.ho_ten || a.email).localeCompare(String(b.ho_ten || b.email), 'vi'));
  const o = (ngay, buoi, dt) => {
    const x = m.get(khoaBuoi(ngay, buoi, dt)), toi = x?.nguoi_dung_id === S.user.id;
    if (!sua) return `<td class="${toi ? 'st-cua-toi' : ''}">${x ? esc(tenND(x.nguoi_dung_id)) : '<span class="muted">–</span>'}</td>`;
    return `<td class="${toi ? 'st-cua-toi' : ''}"><select class="input sm" data-lich="${khoaBuoi(ngay, buoi, dt)}"><option value="">—</option>
      ${nguoi.map(u => `<option value="${u.id}" ${x?.nguoi_dung_id === u.id ? 'selected' : ''}>${esc(u.ho_ten || u.email)}</option>`).join('')}</select></td>`;
  };
  than.innerHTML = `<section class="card"><div class="head-row"><h2 style="margin:0">Lịch trực tuần ${vn(tu)} – ${vn(ngays[5])}</h2>
      <div class="row-gap wrap khong-chup"><button type="button" class="btn sm" data-tuan="-7">‹ Tuần trước</button><button type="button" class="btn sm" data-tuan="0">Tuần này</button><button type="button" class="btn sm" data-tuan="7">Tuần sau ›</button>
        ${sua ? '<button type="button" class="btn sm primary" id="st-chep">Chép lịch từ tuần trước</button>' : ''}</div></div>
    <p class="muted small">${sua ? 'Chọn giáo viên trực cho từng buổi, từng điểm trường (lưu ngay khi chọn). Ô tô màu là buổi trực của bạn.' : 'Ô tô màu là buổi trực của bạn. Lịch do Quản trị xếp.'}</p>
    <div class="table-wrap"><table class="tbl st-lich"><thead>
      <tr><th rowspan="${diem.length > 1 ? 2 : 1}">Ngày</th>${diem.length > 1 ? diem.map(d => `<th colspan="2" class="c nhom-cot">${esc(d.ten)}</th>`).join('') : '<th>Sáng</th><th>Chiều</th>'}</tr>
      ${diem.length > 1 ? `<tr>${diem.map(() => '<th>Sáng</th><th>Chiều</th>').join('')}</tr>` : ''}</thead>
      <tbody>${ngays.map(n => `<tr class="${n === homNay() ? 'st-hom-nay' : ''}"><td class="nowrap"><b>${thuNgayST(n)}</b></td>${diem.map(d => o(n, 'sang', d.id) + o(n, 'chieu', d.id)).join('')}</tr>`).join('')}</tbody></table></div></section>`;
  S.stClick = async e => {
    const t = e.target.closest('[data-tuan]');
    if (t) { S.stTuan = +t.dataset.tuan ? congNgay(S.stTuan, +t.dataset.tuan) : dauTuan(homNay()); stLich(than, conSong); return; }
    if (e.target.closest('#st-chep')) {
      const truoc = await layHet(() => sb.from('st_lich').select('*').gte('ngay', congNgay(tu, -7)).lte('ngay', congNgay(tu, -2)).order('id'));
      if (!truoc.length) { toast('Tuần trước chưa có lịch.', 'err'); return; }
      if (lich.length && !confirm(`Tuần này đã có ${lich.length} buổi được xếp. Chép đè bằng lịch tuần trước?`)) return;
      const r1 = await sb.from('st_lich').delete().gte('ngay', tu).lte('ngay', ngays[5]);
      if (r1.error) { toast(dichLoi(r1.error), 'err'); return; }
      const r2 = await sb.from('st_lich').insert(truoc.map(x => ({ ngay: congNgay(x.ngay, 7), buoi: x.buoi, diem_truong_id: x.diem_truong_id, nguoi_dung_id: x.nguoi_dung_id })));
      if (r2.error) { toast(dichLoi(r2.error), 'err'); return; }
      toast(`Đã chép ${truoc.length} buổi trực.`); stLich(than, conSong);
    }
  };
  S.stChange = async e => {
    const s = e.target.closest('[data-lich]'); if (!s) return;
    const [ngay, buoi, dtS] = s.dataset.lich.split('|'), dt = dtS ? +dtS : null;
    s.disabled = true;
    let r = await locDiem(sb.from('st_lich').delete().eq('ngay', ngay).eq('buoi', buoi), dt);
    if (!r.error && s.value) r = await sb.from('st_lich').insert({ ngay, buoi, diem_truong_id: dt, nguoi_dung_id: s.value });
    s.disabled = false;
    if (r.error) { toast(dichLoi(r.error), 'err'); return; }
    toast(s.value ? `Đã xếp ${tenND(s.value)} trực buổi ${BUOI_TEN[buoi].toLowerCase()} ${vn(ngay)}.` : 'Đã bỏ phân công.');
    s.closest('td').classList.toggle('st-cua-toi', s.value === S.user.id);
    App.capNhatHuyHieu();
  };
}

/* =====================================================================
   SỔ TRỰC (Ban giám hiệu: xem, ý kiến, đã xem, cảnh báo, in)
   ===================================================================== */
async function laySo(F) {
  const [l, b] = await Promise.all([
    layHet(() => { let q = sb.from('st_lich').select('*').gte('ngay', F.tu).lte('ngay', F.den).order('ngay'); if (F.dt !== '') q = locDiem(q, F.dt === 'null' ? null : +F.dt); return q; }),
    layHet(() => { let q = sb.from('st_bien_ban').select('*').gte('ngay', F.tu).lte('ngay', F.den).order('ngay'); if (F.dt !== '') q = locDiem(q, F.dt === 'null' ? null : +F.dt); return q; })
  ]);
  const ds = new Map();
  l.forEach(x => ds.set(khoaBuoi(x.ngay, x.buoi, x.diem_truong_id), { ngay: x.ngay, buoi: x.buoi, dt: x.diem_truong_id, gv: x.nguoi_dung_id, bb: null }));
  b.forEach(x => { const k = khoaBuoi(x.ngay, x.buoi, x.diem_truong_id); const o = ds.get(k) || { ngay: x.ngay, buoi: x.buoi, dt: x.diem_truong_id, gv: null }; o.bb = x; ds.set(k, o); });
  const thuTuDiem = id => dsDiemTruc().findIndex(d => d.id === id);
  return [...ds.values()].sort((a, c) => c.ngay.localeCompare(a.ngay) || (a.buoi === c.buoi ? 0 : a.buoi === 'sang' ? -1 : 1) || thuTuDiem(a.dt) - thuTuDiem(c.dt));
}

async function stSo(than, conSong) {
  const F = S.locST || (S.locST = { tu: dauTuan(homNay()), den: homNay(), dt: '', tt: '' });
  const ds = await laySo(F);
  if (!conSong()) return;
  const canhBao = ds.filter(x => x.gv && buoiDaQua(x.ngay, x.buoi) && !x.bb?.da_chot);
  const loc = ds.filter(x => !F.tt || (F.tt === 'chua_xem' ? x.bb?.da_chot && !x.bb.da_xem : F.tt === 'chua_chot' ? !x.bb?.da_chot : x.bb?.y_kien));
  const tyLe = cc => cc?.si_so ? `${cc.co_mat}/${cc.si_so} (${so(Math.round(cc.co_mat / cc.si_so * 1000) / 10)}%)` : '';
  const tt = x => !x.bb ? (buoiDaBatDau(x.ngay, x.buoi) ? '<span class="tt tt-chua_xu_ly">Chưa ghi sổ</span>' : '<span class="tt">Chưa đến buổi</span>')
    : !x.bb.da_chot ? '<span class="tt tt-dang_xu_ly">Đang ghi</span>' : '<span class="tt tt-da_xu_ly">Đã chốt</span>';
  than.innerHTML = `<section class="card"><div class="head-row"><h2 style="margin:0">Sổ trực</h2>
      <button type="button" class="btn primary" id="st-in">🖨️ In sổ (PDF)</button></div>
    <div class="filters"><label>Từ ngày<input type="date" class="input" id="sts-tu" value="${F.tu}"></label><label>Đến ngày<input type="date" class="input" id="sts-den" value="${F.den}"></label>
      ${S.stDiem.length > 1 ? `<label>Điểm trường<select class="input" id="sts-dt"><option value="">Tất cả</option>${dsDiemTruc().map(d => `<option value="${d.id}" ${String(F.dt) === String(d.id) ? 'selected' : ''}>${esc(d.ten)}</option>`).join('')}</select></label>` : ''}
      <label>Hiện<select class="input" id="sts-tt"><option value="">Tất cả buổi</option><option value="chua_xem" ${F.tt === 'chua_xem' ? 'selected' : ''}>Đã chốt, chưa xem</option>
        <option value="chua_chot" ${F.tt === 'chua_chot' ? 'selected' : ''}>Chưa chốt sổ</option><option value="y_kien" ${F.tt === 'y_kien' ? 'selected' : ''}>Có ý kiến chỉ đạo</option></select></label></div>
    ${canhBao.length ? `<div class="info-box canh-bao-do"><b>⚠ ${canhBao.length} buổi trực đã qua chưa chốt sổ:</b><ul class="small">${canhBao.slice(0, 15).map(x =>
      `<li>${BUOI_TEN[x.buoi]} ${thuNgayST(x.ngay)} – ${esc(tenDiemTruc(x.dt))}: <b>${esc(tenND(x.gv))}</b> (${x.bb ? 'đang ghi, chưa chốt' : 'chưa ghi sổ'})</li>`).join('')}${canhBao.length > 15 ? `<li>… và ${canhBao.length - 15} buổi khác</li>` : ''}</ul></div>` : ''}
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Buổi</th><th>Điểm trường</th><th>Giáo viên trực</th><th>Sổ</th><th>Có mặt / sĩ số</th><th>Ý kiến BGH</th><th>Đã xem</th><th></th></tr></thead><tbody>
      ${loc.map(x => `<tr class="${x.bb?.da_chot && !x.bb.da_xem ? 'st-chua-xem' : ''}"><td class="nowrap">${thuNgayST(x.ngay)}</td><td>${BUOI_TEN[x.buoi]}</td><td>${esc(tenDiemTruc(x.dt))}</td>
        <td>${esc(tenND(x.gv || x.bb?.nguoi_truc) || '–')}${!x.gv && x.bb ? ' <span class="muted small">(không còn trong lịch)</span>' : ''}</td><td>${tt(x)}</td><td class="small">${tyLe(x.bb?.chuyen_can)}</td>
        <td class="small">${x.bb?.y_kien ? esc(x.bb.y_kien.slice(0, 60)) + (x.bb.y_kien.length > 60 ? '…' : '') : ''}</td><td class="c">${x.bb?.da_xem ? '✔' : ''}</td>
        <td class="r nowrap">${x.bb || x.gv ? `<button type="button" class="btn sm" data-mo="${khoaBuoi(x.ngay, x.buoi, x.dt)}">Xem</button>` : ''}${x.bb && App.laQuanTri() ? ` <button type="button" class="btn sm danger" data-xoa-bb="${x.bb.id}" title="Xóa biên bản (chỉ Quản trị)">🗑 Xóa</button>` : ''}</td></tr>`).join('')
        || '<tr><td colspan="9" class="muted">Không có buổi trực nào trong khoảng này.</td></tr>'}</tbody></table></div></section>`;
  S.stChange = e => {
    if (!['sts-tu', 'sts-den', 'sts-dt', 'sts-tt'].includes(e.target.id)) return;
    F.tu = $('#sts-tu').value || F.tu; F.den = $('#sts-den').value || F.den; F.dt = $('#sts-dt')?.value ?? ''; F.tt = $('#sts-tt').value;
    stSo(than, conSong);
  };
  S.stClick = e => {
    if (e.target.closest('#st-in')) { S.stIn = true; dieuHuong(); return; }
    const xb = e.target.closest('[data-xoa-bb]');
    if (xb) { xoaBienBan(+xb.dataset.xoaBb, xb.closest('tr').cells[0].innerText + ' – ' + xb.closest('tr').cells[1].innerText + ' – ' + xb.closest('tr').cells[2].innerText, () => stSo(than, conSong)); return; }
    const b = e.target.closest('[data-mo]'); if (!b) return;
    const [ngay, buoi, dt] = b.dataset.mo.split('|');
    moBienBan(ngay, buoi, dt ? +dt : null);
  };
}

/** Bản in sổ trực: các biên bản trong khoảng đang lọc, theo thứ tự ngày */
async function stInSo(than, conSong) {
  const F = S.locST;
  const ds = (await laySo(F)).filter(x => x.bb).reverse();
  if (!conSong()) return;
  than.innerHTML = `<section class="card khong-chup"><div class="head-row"><button type="button" class="link" id="st-ve-so">← Quay lại sổ trực</button>
      <button type="button" class="btn primary" id="st-in-ngay">🖨️ In / Lưu PDF</button></div>
    <p class="muted small">${ds.length} biên bản từ ${vn(F.tu)} đến ${vn(F.den)}. Bấm “In / Lưu PDF”, chọn máy in hoặc “Lưu dưới dạng PDF”.</p></section>
    <section class="card st-so-in"><h2 class="c">SỔ TRỰC – ${esc(CFG.TEN_TRUONG || '')}</h2><p class="c small">Từ ngày ${vn(F.tu)} đến ngày ${vn(F.den)}</p>
      ${ds.map(x => htmlBienBanIn(x.bb, x.bb.chuyen_can)).join('') || '<p class="muted">Không có biên bản nào.</p>'}</section>`;
  $$('.st-so-in details').forEach(d => (d.open = true));
  S.stClick = e => {
    if (e.target.closest('#st-ve-so')) { S.stIn = false; dieuHuong(); }
    else if (e.target.closest('#st-in-ngay')) inTrang();
  };
}

/* =====================================================================
   TỔNG HỢP SỔ TRỰC (Ban giám hiệu): gộp theo buổi / ngày / tuần / tháng / học kỳ / điểm trường;
   xuất CSV (mở bằng Excel), in / lưu PDF
   ===================================================================== */
const GOM_ST = { buoi: 'Buổi', ngay: 'Ngày', tuan: 'Tuần', thang: 'Tháng', hoc_ky: 'Học kỳ', diem: 'Điểm trường' };
const KY_ST = { tuan: 'Tuần này', tuan_truoc: 'Tuần trước', thang: 'Tháng này', thang_truoc: 'Tháng trước', hk1: 'Học kỳ I', hk2: 'Học kỳ II', nam: 'Năm học', tuy: 'Tùy chọn…' };
function hocKyCua(ymd) {
  const [y, m] = ymd.split('-').map(Number), nh = m >= 8 ? y : y - 1;
  const ii = ymd >= `${nh + 1}-${App.cauHinh('chung.hk2_bat_dau', '01-16')}`;
  return { k: `${nh}-${ii ? 2 : 1}`, ten: `Học kỳ ${ii ? 'II' : 'I'} (${nh}–${nh + 1})` };
}
const thuTuBuoiST = x => x.ngay + (x.buoi === 'sang' ? 'a' : 'b') + String(dsDiemTruc().findIndex(d => d.id === x.dt) + 10);
/** Khóa và tên nhóm của một buổi trực */
function nhomST(x, gom, tach) {
  let k, ten;
  switch (gom) {
    case 'buoi': k = thuTuBuoiST(x); ten = `${BUOI_TEN[x.buoi]} ${thuNgayST(x.ngay)}`; break;
    case 'ngay': k = x.ngay; ten = thuNgayST(x.ngay); break;
    case 'tuan': k = dauTuan(x.ngay); ten = `Tuần ${vn(k)} – ${vn(congNgay(k, 6))}`; break;
    case 'thang': k = x.ngay.slice(0, 7); ten = `Tháng ${k.slice(5)}/${k.slice(0, 4)}`; break;
    case 'hoc_ky': ({ k, ten } = hocKyCua(x.ngay)); break;
    default: k = String(dsDiemTruc().findIndex(d => d.id === x.dt) + 10); ten = tenDiemTruc(x.dt);
  }
  if (tach && gom !== 'diem' && gom !== 'buoi') { k += '|' + (dsDiemTruc().findIndex(d => d.id === x.dt) + 10); ten += ' – ' + tenDiemTruc(x.dt); }
  return { k, ten };
}
const ttBuoiST = x => !x.bb ? 'Chưa ghi sổ' : x.bb.da_chot ? 'Đã chốt' : 'Chưa chốt';
const tyLeST = (cm, ss) => ss ? Math.round(cm / ss * 1000) / 10 : null;

async function stTongHop(than, conSong) {
  const F = S.locSTTH || (S.locSTTH = { ky: 'thang', tu: dauTuan(homNay()), den: homNay(), dt: '', gom: 'ngay', tach: false, nd: false });
  const K = F.ky === 'tuy' ? khoangTK('tuy', F.tu, F.den) : khoangTK(F.ky);
  const ok = K.tu && K.den && K.tu <= K.den;
  const ds = ok ? (await laySo({ tu: K.tu, den: K.den, dt: F.dt })).filter(x => buoiDaBatDau(x.ngay, x.buoi)).sort((a, c) => thuTuBuoiST(a).localeCompare(thuTuBuoiST(c))) : [];
  if (!conSong()) return;
  // Gộp nhóm
  const nhom = new Map();
  for (const x of ds) {
    const { k, ten } = nhomST(x, F.gom, F.tach);
    if (!nhom.has(k)) nhom.set(k, { k, ten, ds: [] });
    nhom.get(k).ds.push(x);
  }
  const cong = arr => {
    const chot = arr.filter(x => x.bb?.da_chot), c = { buoi: arr.length, chot: chot.length, chua_chot: arr.filter(x => x.bb && !x.bb.da_chot).length, chua_ghi: arr.filter(x => !x.bb).length,
      ss: 0, cm: 0, cp: 0, kp: 0, ct: 0, yk: arr.filter(x => x.bb?.y_kien).length, xem: chot.filter(x => x.bb.da_xem).length, coSo: 0 };
    chot.forEach(x => { const cc = x.bb.chuyen_can; if (!cc) return; c.coSo++; c.ss += +cc.si_so || 0; c.cm += +cc.co_mat || 0; c.cp += +cc.cp || 0; c.kp += +cc.kp || 0; c.ct += +cc.ct || 0; });
    return c;
  };
  const dsNhom = [...nhom.values()].sort((a, c) => a.k.localeCompare(c.k)).map(n => ({ ...n, c: cong(n.ds) }));
  const tong = cong(ds), laBuoi = F.gom === 'buoi';
  const cotDau = laBuoi ? ['Buổi', 'Điểm trường', 'Giáo viên trực', 'Sổ'] : [GOM_ST[F.gom], 'Số buổi trực', 'Đã chốt', 'Chưa chốt', 'Chưa ghi sổ'];
  const cotSo = ['Sĩ số TB/buổi', 'Có mặt (lượt)', 'Vắng có phép', 'Vắng không phép', 'Cúp tiết', 'Tỷ lệ chuyên cần (%)', 'Có ý kiến BGH', 'BGH đã xem'];
  const giaTri = (n, c) => [...(laBuoi ? [n.ten, tenDiemTruc(n.ds[0].dt), tenND(n.ds[0].gv || n.ds[0].bb?.nguoi_truc) || '', ttBuoiST(n.ds[0])] : [n.ten, c.buoi, c.chot, c.chua_chot, c.chua_ghi]),
    c.coSo ? Math.round(c.ss / c.coSo * 10) / 10 : '', c.coSo ? c.cm : '', c.coSo ? c.cp : '', c.coSo ? c.kp : '', c.coSo ? c.ct : '', c.coSo ? tyLeST(c.cm, c.ss) : '', c.yk, c.xem];
  const tenKy = ok ? `${F.ky === 'tuy' ? '' : KY_ST[F.ky] + ': '}${vn(K.tu)} – ${vn(K.den)}` : '';
  const tenDiemLoc = F.dt === '' ? (S.stDiem.length > 1 ? 'Tất cả điểm trường' : '') : tenDiemTruc(F.dt === 'null' ? null : +F.dt);
  // Gộp nội dung biên bản theo mục
  const htmlNoiDung = n => {
    const muc = new Map();
    n.ds.filter(x => x.bb).forEach(x => (x.bb.noi_dung || []).filter(m => m.nd).forEach(m => {
      if (!muc.has(m.ten)) muc.set(m.ten, []);
      muc.get(m.ten).push(`<li><span class="muted">${laBuoi ? '' : `${BUOI_TEN[x.buoi]} ${vn(x.ngay)}${S.stDiem.length > 1 && !F.tach && F.gom !== 'diem' ? ', ' + esc(tenDiemTruc(x.dt)) : ''}: `}</span>${esc(m.nd)}</li>`);
    }));
    const yk = n.ds.filter(x => x.bb?.y_kien).map(x => `<li><span class="muted">${laBuoi ? '' : `${BUOI_TEN[x.buoi]} ${vn(x.ngay)}: `}</span>${esc(x.bb.y_kien)}</li>`);
    return `<div class="st-th-nd"><h3>${esc(n.ten)}${laBuoi ? ' – ' + esc(tenDiemTruc(n.ds[0].dt)) : ''}</h3>
      ${[...muc].map(([t, li]) => `<p><b>${esc(t)}:</b></p><ul>${li.join('')}</ul>`).join('') || '<p class="muted small">Không có nội dung ghi chép.</p>'}
      ${yk.length ? `<p><b>Ý kiến chỉ đạo của BGH:</b></p><ul>${yk.join('')}</ul>` : ''}</div>`;
  };
  than.innerHTML = `<section class="card"><div class="head-row"><h2 style="margin:0">Tổng hợp sổ trực</h2>
      <div class="row-gap wrap khong-chup"><button type="button" class="btn" id="th-csv">⬇ Xuất bảng (CSV)</button><button type="button" class="btn" id="th-csv-ct">⬇ Chi tiết từng biên bản (CSV)</button>
        <button type="button" class="btn primary" id="th-in">🖨️ In / PDF</button></div></div>
    <div class="filters khong-chup">
      <label>Kỳ<select class="input" id="th-ky">${Object.entries(KY_ST).map(([k, t]) => `<option value="${k}" ${F.ky === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      ${F.ky === 'tuy' ? `<label>Từ ngày<input type="date" class="input" id="th-tu" value="${F.tu}"></label><label>Đến ngày<input type="date" class="input" id="th-den" value="${F.den}"></label>` : ''}
      <label>Tổng hợp theo<select class="input" id="th-gom">${Object.entries(GOM_ST).map(([k, t]) => `<option value="${k}" ${F.gom === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      ${S.stDiem.length > 1 ? `<label>Điểm trường<select class="input" id="th-dt"><option value="">Tất cả</option>${dsDiemTruc().map(d => `<option value="${d.id}" ${String(F.dt) === String(d.id) ? 'selected' : ''}>${esc(d.ten)}</option>`).join('')}</select></label>
        ${F.gom !== 'diem' && F.gom !== 'buoi' && F.dt === '' ? `<label class="switch"><input type="checkbox" id="th-tach" ${F.tach ? 'checked' : ''}> Tách từng điểm</label>` : ''}` : ''}
      <label class="switch"><input type="checkbox" id="th-nd" ${F.nd ? 'checked' : ''}> Kèm nội dung biên bản</label>
    </div>
    <p class="small"><b>${esc(tenKy)}</b>${tenDiemLoc ? ' · ' + esc(tenDiemLoc) : ''} · tổng hợp theo <b>${GOM_ST[F.gom].toLowerCase()}</b></p>
    ${!ok ? '<p class="err">Chọn khoảng ngày hợp lệ.</p>' : `
    <div class="table-wrap"><table class="tbl st-th"><thead><tr>${[...cotDau, ...cotSo].map((t, i) => `<th class="${i >= cotDau.length || (!laBuoi && i) ? 'r' : ''}">${t}</th>`).join('')}</tr></thead><tbody>
      ${dsNhom.map(n => `<tr>${giaTri(n, n.c).map((v, i) => `<td class="${i >= cotDau.length || (!laBuoi && i) ? 'r' : ''} ${i === 0 ? 'nowrap' : ''}">${typeof v === 'number' ? so(v) : esc(v)}</td>`).join('')}</tr>`).join('')
        || `<tr><td colspan="${cotDau.length + cotSo.length}" class="muted">Không có buổi trực nào trong kỳ này.</td></tr>`}</tbody>
      ${dsNhom.length > 1 ? `<tfoot><tr class="dong-tong">${giaTri({ ten: 'Tổng cộng', ds: [{}] }, tong).map((v, i) => `<td class="${i >= cotDau.length || (!laBuoi && i) ? 'r' : ''}"><b>${laBuoi && i > 0 && i < cotDau.length ? '' : typeof v === 'number' ? so(v) : esc(v)}</b></td>`).join('')}</tr></tfoot>` : ''}</table></div>
    <p class="muted small">Chỉ tính các buổi đã đến giờ trực. Số liệu chuyên cần lấy từ các biên bản <b>đã chốt</b> (chốt lúc nào thì số liệu lúc đó).
      ${laBuoi ? '' : 'Sĩ số TB/buổi = tổng sĩ số các buổi đã chốt ÷ số buổi đã chốt; tỷ lệ chuyên cần = có mặt ÷ sĩ số.'}</p>
    ${F.nd ? `<h2 class="st-th-tieu-de">Nội dung biên bản</h2>${dsNhom.map(htmlNoiDung).join('') || '<p class="muted">Không có.</p>'}` : ''}`}
  </section>`;

  const tenFile = `So-truc_${GOM_ST[F.gom].replace(/\s+/g, '-')}_${ok ? K.tu + '_' + K.den : ''}.csv`;
  S.stChange = e => {
    const id = e.target.id;
    if (!['th-ky', 'th-tu', 'th-den', 'th-gom', 'th-dt', 'th-tach', 'th-nd'].includes(id)) return;
    F.ky = $('#th-ky').value; F.gom = $('#th-gom').value; F.dt = $('#th-dt')?.value ?? ''; F.tach = !!$('#th-tach')?.checked; F.nd = $('#th-nd').checked;
    if ($('#th-tu')) { F.tu = $('#th-tu').value || F.tu; F.den = $('#th-den').value || F.den; }
    stTongHop(than, conSong);
  };
  S.stClick = e => {
    const id = e.target.closest('button')?.id;
    if (id === 'th-in') inTrang();
    else if (id === 'th-csv') {
      if (!dsNhom.length) { toast('Không có dữ liệu.', 'err'); return; }
      xuatCSV(tenFile, [...cotDau, ...cotSo], [...dsNhom.map(n => giaTri(n, n.c)), ...(dsNhom.length > 1 ? [giaTri({ ten: 'Tổng cộng', ds: [{}] }, tong).map((v, i) => laBuoi && i > 0 && i < cotDau.length ? '' : v)] : [])]);
    } else if (id === 'th-csv-ct') {
      if (!ds.length) { toast('Không có dữ liệu.', 'err'); return; }
      const tenMuc = [...new Set(ds.flatMap(x => (x.bb?.noi_dung || []).map(m => m.ten)))];
      xuatCSV('Chi-tiet-' + tenFile, ['Ngày', 'Thứ', 'Buổi', 'Điểm trường', 'Giáo viên trực', 'Sổ', 'Chốt lúc', 'Sĩ số', 'Có mặt', 'Vắng có phép', 'Vắng không phép', 'Cúp tiết', 'Tỷ lệ CC (%)', 'Lớp nghỉ', 'Học sinh vắng', ...tenMuc, 'Ý kiến chỉ đạo BGH', 'Người cho ý kiến', 'BGH đã xem'],
        ds.map(x => { const b = x.bb, cc = b?.da_chot ? b.chuyen_can : null;
          return [vn(x.ngay), thuNgayST(x.ngay).split(',')[0], BUOI_TEN[x.buoi], tenDiemTruc(x.dt), tenND(x.gv || b?.nguoi_truc) || '', ttBuoiST(x), b?.chot_luc ? fmtTG(b.chot_luc) : '',
            cc ? cc.si_so : '', cc ? cc.co_mat : '', cc ? cc.cp : '', cc ? cc.kp : '', cc ? cc.ct : '', cc ? tyLeST(cc.co_mat, cc.si_so) ?? '' : '', cc ? (cc.lop_nghi || []).join(', ') : '',
            cc ? (cc.hoc_sinh || []).map(h => `${h.ten} (${h.lop}, ${h.loai === 'co_phep' ? 'P' : h.loai === 'khong_phep' ? 'KP' : 'cúp tiết'})`).join('; ') : '',
            ...tenMuc.map(t => (b?.noi_dung || []).find(m => m.ten === t)?.nd || ''), b?.y_kien || '', b?.nguoi_y_kien ? tenND(b.nguoi_y_kien) : '', b?.da_xem ? 'Đã xem' : ''];
        }));
    }
  };
}

/* =====================================================================
   MẪU BIÊN BẢN (Quản trị)
   ===================================================================== */
async function stMau(than, conSong) {
  const { data, error } = await sb.from('st_muc').select('*').order('thu_tu').order('id');
  if (error) throw error;
  if (!conSong()) return;
  const max = Math.max(0, ...data.map(m => m.thu_tu || 0));
  const dong = m => `<tr data-id="${m.id || ''}" class="${m.id ? '' : 'new-row'}">
    <td><input class="input sm num" name="thu_tu" type="number" value="${m.thu_tu ?? ''}"></td>
    <td><input class="input sm" name="ten" value="${esc(m.ten || '')}" placeholder="${m.id ? '' : '+ Thêm mục mới…'}"></td>
    <td><input class="input sm" name="goi_y" value="${esc(m.goi_y || '')}" placeholder="Gợi ý hiện trong ô nhập"></td>
    <td class="c"><input type="checkbox" name="dang_dung" ${m.dang_dung !== false ? 'checked' : ''}></td>
    <td class="nowrap"><button type="button" class="btn sm ${m.id ? '' : 'primary'}" data-luu>${m.id ? 'Lưu' : 'Thêm'}</button>${m.id ? '<button type="button" class="link danger" data-xoa>Xóa</button>' : ''}</td></tr>`;
  than.innerHTML = `<section class="card"><h2>Mẫu biên bản trực</h2>
    <p class="muted small">Các mục giáo viên trực ghi trong biên bản (đầu biên bản luôn có số liệu chuyên cần). Đổi tên, tắt hay xóa mục <b>không ảnh hưởng</b> biên bản đã ghi.</p>
    <div class="table-wrap"><table class="tbl edit"><thead><tr><th>Thứ tự</th><th>Tên mục</th><th>Gợi ý</th><th>Đang dùng</th><th></th></tr></thead>
      <tbody>${data.map(dong).join('')}${dong({ thu_tu: max + 1 })}</tbody></table></div></section>`;
  S.stClick = async e => {
    const b = e.target.closest('[data-luu],[data-xoa]'); if (!b) return;
    const tr = b.closest('tr'), id = +tr.dataset.id || null, v = n => tr.querySelector(`[name=${n}]`);
    let r;
    if (b.dataset.xoa !== undefined) {
      if (!confirm(`Xóa mục “${v('ten').value}”?`)) return;
      r = await sb.from('st_muc').delete().eq('id', id);
    } else {
      const row = { ten: v('ten').value.trim(), goi_y: v('goi_y').value.trim() || null, thu_tu: +v('thu_tu').value || 0, dang_dung: v('dang_dung').checked };
      if (!row.ten) { toast('Nhập tên mục.', 'err'); v('ten').focus(); return; }
      r = id ? await sb.from('st_muc').update(row).eq('id', id) : await sb.from('st_muc').insert(row);
    }
    if (r.error) { toast(dichLoi(r.error), 'err'); return; }
    toast('Đã lưu.'); stMau(than, conSong);
  };
}
