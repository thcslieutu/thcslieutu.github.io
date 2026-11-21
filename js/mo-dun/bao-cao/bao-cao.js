'use strict';
/* =====================================================================
   PHÂN HỆ BÁO CÁO – CÁC TRANG
   Báo cáo của tôi (mọi tài khoản đã duyệt), Quản lý đợt, Tổng hợp.
   Quyền (supabase/30-bao-cao.sql):
     bc.quan_ly     – tạo đợt, xem và nhận xét các đợt do mình tạo
     bc.xem_tat_ca  – quản lý mọi đợt
   Nhóm để giao báo cáo: tất cả, theo chức vụ, GV chủ nhiệm, và các quyền "thành viên" (vd: Là đảng viên).
   ===================================================================== */

const TT_NOP = { da_nop: 'Chờ xem', dat: 'Đạt', can_sua: 'Cần sửa' };   // "Đạt" = đã duyệt: người nộp không sửa được nữa
const badgeNop = n => !n ? '' : `<span class="tt tt-bc-${n.trang_thai}">${n.trang_thai === 'da_nop' ? 'Đã nộp – chờ xem' : TT_NOP[n.trang_thai]}</span>`;
const quanLyMoiDot = () => App.coQuyen('bc.xem_tat_ca');
const taoDuocDot = () => App.coQuyen('bc.quan_ly') || App.coQuyen('bc.xem_tat_ca');
/** Đợt d có do người đang đăng nhập quản lý không (khớp hàm bc_quan_ly_dot trong SQL) */
const quanLyDot = d => quanLyMoiDot() || (App.coQuyen('bc.quan_ly') && d.tao_boi === S.user.id);
const tenNguoi = u => u ? (u.ho_ten || u.email) : '(tài khoản đã xóa)';
const soSanhNguoi = (a, b) => String(a.ho_ten || a.email).localeCompare(String(b.ho_ten || b.email), 'vi');

/* ---------- Nhóm người nhận ---------- */
S.bcGVCN = new Set();   // người đang là GV chủ nhiệm (để xem trước số người khi giao)
App.khiTaiDuLieu(async () => {
  if (!App.daCai('bao_cao') || !taoDuocDot()) return;
  const { data, error } = await sb.rpc('bc_ds_gvcn');
  if (!error) S.bcGVCN = new Set((data || []).map(r => typeof r === 'string' ? r : r.bc_ds_gvcn));
});
/** Danh sách nhóm có thể giao: [{ ma, ten, co(u) }] */
function nhomBC() {
  const cv = ['giao_vien', 'tong_phu_trach', 'nhan_vien', 'bgh'];
  return [
    { ma: 'tat_ca', ten: 'Tất cả CB-GV-NV', co: () => true },
    ...cv.map(k => ({ ma: 'cv:' + k, ten: CHUC_VU[k], co: u => u.chuc_vu === k })),
    { ma: 'gvcn', ten: 'GV chủ nhiệm', co: u => S.bcGVCN.has(u.id) },
    ...S.dsQuyen.filter(q => q.thanh_vien).map(q => ({ ma: 'q:' + q.ma, ten: q.ten.replace(/^Là\s+/i, '').replace(/^./, c => c.toUpperCase()), co: u => !!S.ndQuyen.get(u.id)?.has(q.ma) }))
  ];
}
const nguoiDaDuyet = () => S.nd.filter(u => u.chuc_vu !== 'cho_duyet');
/** Mô tả người nhận của đợt: "Giáo viên, Đảng viên + 3 người" */
function moTaNguoiNhan(d, soRieng = 0) {
  const ten = new Map(nhomBC().map(g => [g.ma, g.ten]));
  const ds = (d.nhom || []).map(m => ten.get(m) || m);
  if (soRieng) ds.push(`${ds.length ? '+ ' : ''}${soRieng} người được chọn`);
  return ds.join(', ') || 'Chưa giao cho ai';
}

function hanChot(d) {
  if (!d.han_chot) return '<span class="muted">Không có hạn chót</span>';
  const con = new Date(d.han_chot) - Date.now(), ngay = Math.ceil(Math.abs(con) / 864e5);
  const ch = con >= 0 ? (con < 864e5 ? `còn ${Math.max(1, Math.round(con / 36e5))} giờ` : `còn ${ngay} ngày`) : `quá hạn ${ngay} ngày`;
  return `Hạn chót: <b>${fmtTG(d.han_chot)}</b> <span class="${con < 0 ? 'chu-do' : con < 864e5 ? 'chu-cam' : 'muted'}">(${ch})</span>`;
}
const treHan = (d, n) => d.han_chot && n && new Date(n.nop_luc) > new Date(d.han_chot);

/** Số việc của tôi: đợt đang mở chưa nộp + bài bị yêu cầu sửa (chấm đỏ trên menu) */
async function demViecBaoCao() {
  const [g, n] = await Promise.all([sb.rpc('bc_dot_cua_toi'), sb.from('bc_nop').select('dot_id,trang_thai').eq('nguoi_dung_id', S.user.id)]);
  if (g.error || n.error) return 0;
  const ids = (g.data || []).map(r => typeof r === 'object' ? r.bc_dot_cua_toi : r);
  if (!ids.length) return 0;
  const { data, error } = await sb.from('bc_dot').select('id').in('id', ids).eq('dang_mo', true);
  if (error) return 0;
  const da = new Set(n.data.map(r => r.dot_id));
  return data.filter(d => !da.has(d.id)).length + n.data.filter(r => r.trang_thai === 'can_sua').length;
}

/** Vẽ một trang của phân hệ: tab = 'cua_toi' | 'quan_ly' | 'tong_hop' */
async function veBaoCao(el, tab) {
  if (S.bcTab !== tab) S.bcDot = null;
  S.bcTab = tab;
  const conSong = giuPhien();
  const tieuDe = { cua_toi: 'Báo cáo của tôi', quan_ly: 'Quản lý đợt báo cáo', tong_hop: 'Tổng hợp theo người' }[tab];
  el.innerHTML = `<section class="card"><div class="head-row"><h2>${tieuDe}</h2></div>
    <div id="bc-than"><p class="muted pad">Đang tải…</p></div></section>`;
  el.onclick = e => {
    const x = e.target.closest('[data-mc-xem]');
    if (x) { moAnhTrongVung(x, $('#bc-than')); return; }
    if (S.bcClick) S.bcClick(e);
  };
  el.onchange = e => S.bcChange && S.bcChange(e);
  el.oninput = e => S.bcInput && S.bcInput(e);
  S.bcClick = S.bcChange = S.bcInput = null;
  const than = $('#bc-than');
  try {
    if (tab === 'cua_toi') await bcCuaToi(than, conSong);
    else if (tab === 'quan_ly') await (S.bcDot ? bcChiTietDot(than, conSong, S.bcDot) : bcDanhSachDot(than, conSong));
    else if (tab === 'tong_hop') await bcTongHop(than, conSong);
  } catch (e) {
    if (conSong()) than.innerHTML = `<p class="err pad">${esc(loiChuaCaiBC(e) ? MSG_CHUA_CAI_BC : dichLoi(e))}</p>`;
  }
}

/* =====================================================================
   BÁO CÁO CỦA TÔI
   ===================================================================== */
async function bcCuaToi(than, conSong) {
  const g = await sb.rpc('bc_dot_cua_toi');
  if (g.error) throw g.error;
  const ids = (g.data || []).map(r => typeof r === 'object' ? r.bc_dot_cua_toi : r);
  const [r1, r2] = await Promise.all([
    ids.length ? sb.from('bc_dot').select('*').in('id', ids).order('id', { ascending: false }) : Promise.resolve({ data: [] }),
    sb.from('bc_nop').select('*').eq('nguoi_dung_id', S.user.id)
  ]);
  if (r1.error) throw r1.error; if (r2.error) throw r2.error;
  if (!conSong()) return;
  const nop = new Map(r2.data.map(n => [n.dot_id, n]));
  const conHan = d => d.han_chot ? new Date(d.han_chot).getTime() : Infinity;
  const dots = r1.data.sort((a, b) => (b.dang_mo - a.dang_mo) || conHan(a) - conHan(b) || b.id - a.id);
  const canLam = d => (d.dang_mo && !nop.has(d.id)) || nop.get(d.id)?.trang_thai === 'can_sua';
  const viec = dots.filter(canLam), con = dots.filter(d => !canLam(d) && d.dang_mo), dong = dots.filter(d => !canLam(d) && !d.dang_mo);
  const the = d => {
    const n = nop.get(d.id), link = linkAnToan(d.link), canSua = n?.trang_thai === 'can_sua';
    const tt = n ? badgeNop(n) + (treHan(d, n) ? ' <span class="tt tt-chua_xu_ly">Trễ</span>' : '')
      : !d.dang_mo ? '<span class="tt tt-chua_xu_ly">Không nộp</span>'
      : d.han_chot && new Date(d.han_chot) < Date.now() ? '<span class="tt tt-chua_xu_ly">Quá hạn – chưa nộp</span>' : '<span class="tt tt-dang_xu_ly">Chưa nộp</span>';
    const daDuyet = n?.trang_thai === 'dat';   // đã duyệt "Đạt": khóa, không sửa được nữa
    const nutNop = daDuyet ? '<span class="small chu-xanh">🔒 Đã được duyệt – không sửa được nữa</span>'
      : d.dang_mo || canSua
      ? `<button type="button" class="btn ${n && !canSua ? '' : 'primary'}" data-nop="${d.id}">${canSua ? '✏️ Sửa và nộp lại' : n ? '✏️ Sửa bài nộp' : '📤 Nộp báo cáo'}</button>` : '';
    return `<div class="dv-dot ${n ? 'da-nop' : ''} ${canSua ? 'can-sua' : ''}">
      <div class="head-row"><h3>${esc(d.ten)}</h3><span>${tt}</span></div>
      <p class="small">${hanChot(d)} · Cần ${d.so_tep} tệp (ảnh, PDF, Word…) · Người giao: ${esc(tenNguoi(S.ndMap.get(d.tao_boi)))}${d.dang_mo ? '' : ' · <b>Đợt đã đóng</b>'}</p>
      ${d.huong_dan ? `<div class="dv-hd small">${esc(d.huong_dan)}</div>` : ''}
      ${n?.nhan_xet ? `<div class="bc-nhan-xet ${canSua ? 'can-sua' : ''}"><b>Nhận xét</b>${n.nguoi_duyet ? ` của ${esc(tenNguoi(S.ndMap.get(n.nguoi_duyet)))}` : ''}${n.duyet_luc ? ` (${fmtGio(n.duyet_luc)})` : ''}: ${esc(n.nhan_xet)}</div>` : ''}
      <div class="row-gap wrap">
        ${link ? `<a class="btn" href="${esc(link)}" target="_blank" rel="noopener">🔗 Mở đường link</a>` : ''}${nutNop}
      </div>
      ${n ? `<div class="dv-da-nop">${n.anh_da_xoa ? '<span class="muted small">Minh chứng đã được lưu trữ.</span>' : oAnhNho(n.anh, d.ten)}
        <span class="small muted">Nộp lúc ${fmtTG(n.nop_luc)}${n.sua_luc ? ` · sửa lúc ${fmtTG(n.sua_luc)}` : ''}${n.ghi_chu ? ` · ${esc(n.ghi_chu)}` : ''}</span></div>` : ''}
    </div>`;
  };
  than.innerHTML = !dots.length ? '<p class="muted pad">Hiện chưa có đợt báo cáo nào được giao cho thầy cô.</p>'
    : `<h3 class="bc-nhom-tieu-de">Cần làm (${viec.length})</h3>${viec.length ? viec.map(the).join('') : '<p class="muted pad">Không còn báo cáo nào cần nộp. 🎉</p>'}
       ${con.length ? `<h3 class="bc-nhom-tieu-de">Đã nộp – đợt đang mở (${con.length})</h3>${con.map(the).join('')}` : ''}
       ${dong.length ? `<details class="dv-dong"><summary>Các đợt đã đóng (${dong.length})</summary>${dong.map(the).join('')}</details>` : ''}`;
  ganAnhMC(than);
  S.bcClick = e => {
    const b = e.target.closest('[data-nop]'); if (!b) return;
    const d = dots.find(x => x.id === +b.dataset.nop);
    moNopMC(d, nop.get(d.id), async () => { App.capNhatHuyHieu(); if (conSong()) await bcCuaToi(than, conSong); });
  };
}

/* ---------- Nộp / sửa bài ---------- */
/** Hộp nộp / sửa minh chứng: 1–3 tệp (ảnh được nén trên máy; PDF, Word, Excel, PowerPoint tối đa 5 MB) */
function moNopMC(dot, nopCu, xong) {
  let cu = nopCu && !nopCu.anh_da_xoa ? [...nopCu.anh] : [];   // tệp đã nộp giữ lại (đường dẫn trong kho)
  const anhCu = nopCu && !nopCu.anh_da_xoa ? [...nopCu.anh] : [];
  let moi = [];                                                // [{ blob, url, ten, duoi, laAnh }]
  moModal(`<h2>${nopCu?.trang_thai === 'can_sua' ? 'Sửa và nộp lại' : nopCu ? 'Sửa bài nộp' : 'Nộp báo cáo'}</h2>
    <p class="small"><b>${esc(dot.ten)}</b><br>${hanChot(dot)}</p>
    ${linkAnToan(dot.link) ? `<p class="small"><a href="${esc(linkAnToan(dot.link))}" target="_blank" rel="noopener">🔗 Mở đường link</a> – làm xong, chụp màn hình (hoặc lưu tệp) rồi tải lên.</p>` : ''}
    ${nopCu?.nhan_xet ? `<div class="bc-nhan-xet small ${nopCu.trang_thai === 'can_sua' ? 'can-sua' : ''}"><b>Nhận xét:</b> ${esc(nopCu.nhan_xet)}</div>` : ''}
    <div class="lbl">Minh chứng <span class="muted small" id="mc-dem"></span></div>
    <div class="mc-chon"><div class="mc-xem" id="mc-xem"></div>
      <div class="row-gap wrap" id="mc-nut">
        <label class="btn"><input type="file" id="mc-chup" accept="image/*" capture="environment" hidden>📷 Chụp ảnh</label>
        <label class="btn"><input type="file" id="mc-file" accept="${MC_CHAP_NHAN}" multiple hidden>📎 Chọn ảnh hoặc tệp</label>
      </div></div>
    <p class="muted small">Nhận: ảnh (JPG, PNG…), PDF, Word, Excel, PowerPoint. Tối đa ${MC_TOI_DA} tệp; tệp không phải ảnh tối đa 5 MB.</p>
    <textarea id="mc-gc" class="input" rows="2" placeholder="Ghi chú (không bắt buộc)">${esc(nopCu?.ghi_chu || '')}</textarea>
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Hủy</button>
      <button type="button" class="btn primary" id="mc-nop">${nopCu ? 'Nộp lại' : 'Nộp'}</button></div>`);
  const oTepNho = (duoi, ten) => `<span class="mc-tep-loai mc-tep-${esc(duoi)}">${esc(duoi.toUpperCase())}</span><small>${esc(ten)}</small>`;
  const ve = () => {
    const tong = cu.length + moi.length;
    $('#mc-xem').innerHTML = cu.map((p, i) => `<div class="mc-thumb ${laAnhMC(p) ? '' : 'mc-thumb-tep'}">${laAnhMC(p) ? `<img data-mc="${esc(p)}" alt="">` : oTepNho(duoiTep(p), tenTepMC(p))}<button type="button" data-bo-cu="${i}" aria-label="Bỏ tệp">×</button></div>`).join('')
      + moi.map((a, i) => `<div class="mc-thumb ${a.laAnh ? '' : 'mc-thumb-tep'}">${a.laAnh ? `<img src="${a.url}" alt="">` : oTepNho(a.duoi, a.ten)}<button type="button" data-bo-moi="${i}" aria-label="Bỏ tệp">×</button></div>`).join('');
    ganAnhMC($('#mc-xem'));
    $('#mc-nut').classList.toggle('hidden', tong >= MC_TOI_DA);
    $('#mc-dem').textContent = `(${tong}/${MC_TOI_DA} – cần ít nhất ${dot.so_tep})`;
    $('#mc-nop').disabled = tong < dot.so_tep;
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
          ? new Error(`Máy chủ chưa nhận tệp “${a.ten}”. Quản trị cần chạy lại file supabase/30-bao-cao.sql để cho phép tải PDF, Word, Excel.`) : error;
        daTai.push(path);
      }
      btn.textContent = 'Đang lưu…';
      const row = { anh: [...cu, ...daTai], ghi_chu: $('#mc-gc').value.trim() || null };
      const r = nopCu ? await sb.from('bc_nop').update(row).eq('id', nopCu.id).select('id') : await sb.from('bc_nop').insert({ ...row, dot_id: dot.id }).select('id');
      if (r.error) throw r.error;
      if (!r.data?.length) throw new Error('Đợt báo cáo đã đóng, không sửa được nữa.');
      const boDi = anhCu.filter(p => !cu.includes(p));   // tệp cũ người nộp đã bỏ
      if (boDi.length) sb.storage.from(KHO_MC).remove(boDi);
    } catch (e) {
      if (daTai.length) sb.storage.from(KHO_MC).remove(daTai);
      toast(loiChuaCaiBC(e) ? MSG_CHUA_CAI_BC : dichLoi(e), 'err');
      btn.disabled = false; btn.textContent = nopCu ? 'Nộp lại' : 'Nộp'; return;
    }
    moi.forEach(a => a.url && URL.revokeObjectURL(a.url));
    toast(nopCu ? 'Đã nộp lại báo cáo.' : 'Đã nộp báo cáo. Cảm ơn thầy cô!');
    dongModal(); await xong();
  };
  ve();
}

/* =====================================================================
   QUẢN LÝ ĐỢT
   ===================================================================== */
/** Các đợt mình quản lý, người được giao (theo máy chủ), bài nộp */
async function layDuLieuQL() {
  const [d, g, r, n] = await Promise.all([
    layHet(() => sb.from('bc_dot').select('*').order('tao_luc', { ascending: false }).order('id', { ascending: false })),
    layHet(() => sb.rpc('bc_ds_giao').order('dot_id')),
    layHet(() => sb.from('bc_dot_nguoi').select('*').order('dot_id')),
    layHet(() => sb.from('bc_nop').select('*').order('id'))
  ]);
  const dots = d.filter(quanLyDot), cua = new Set(dots.map(x => x.id));
  const dsGiao = new Map();      // dot_id → Set người được giao
  g.forEach(x => { if (!dsGiao.has(x.dot_id)) dsGiao.set(x.dot_id, new Set()); dsGiao.get(x.dot_id).add(x.nguoi_dung_id); });
  const dsRieng = new Map();     // dot_id → Set người được chọn riêng
  r.forEach(x => { if (!dsRieng.has(x.dot_id)) dsRieng.set(x.dot_id, new Set()); dsRieng.get(x.dot_id).add(x.nguoi_dung_id); });
  const nopTheoDot = new Map();
  n.filter(x => cua.has(x.dot_id)).forEach(x => { if (!nopTheoDot.has(x.dot_id)) nopTheoDot.set(x.dot_id, new Map()); nopTheoDot.get(x.dot_id).set(x.nguoi_dung_id, x); });
  return { dots, dsGiao, dsRieng, nopTheoDot };
}
/** Người được giao đợt d (đối tượng tài khoản, sắp theo tên) */
const nguoiCuaDot = (d, dsGiao) => [...(dsGiao.get(d.id) || [])].map(id => S.ndMap.get(id)).filter(Boolean).sort(soSanhNguoi);
const thanhTienDo = (a, b) => `<div class="tien-do-nho"><div><i style="width:${b ? Math.round(a / b * 100) : 0}%"></i></div><span>${a}/${b}${b ? ` (${Math.round(a / b * 100)}%)` : ''}</span></div>`;

async function bcDanhSachDot(than, conSong) {
  const { dots, dsGiao, dsRieng, nopTheoDot } = await layDuLieuQL();
  if (!conSong()) return;
  const F = S.locBC || (S.locBC = { cuaToi: false, q: '' });
  const ve = () => {
    const q = boDau(F.q);
    const ds = dots.filter(d => (!F.cuaToi || d.tao_boi === S.user.id) && (!q || boDau(d.ten).includes(q)));
    $('#bc-ds').innerHTML = ds.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Đợt báo cáo</th><th>Giao cho</th><th>Hạn chót</th><th>Đã nộp</th><th class="r">Chờ xem</th><th class="r">Cần sửa</th><th>Trạng thái</th></tr></thead><tbody>
      ${ds.map(d => {
        const ng = nguoiCuaDot(d, dsGiao), nop = nopTheoDot.get(d.id) || new Map(), da = ng.filter(u => nop.has(u.id)).length;
        const cho = [...nop.values()].filter(n => n.trang_thai === 'da_nop').length, sua = [...nop.values()].filter(n => n.trang_thai === 'can_sua').length;
        return `<tr><td><a href="#" data-xem-dot="${d.id}"><b>${esc(d.ten)}</b></a><div class="muted small">${esc(tenNguoi(S.ndMap.get(d.tao_boi)))} · tạo ${fmtGio(d.tao_luc)}</div></td>
          <td class="small">${esc(moTaNguoiNhan(d, dsRieng.get(d.id)?.size || 0))}<div class="muted">${ng.length} người</div></td>
          <td class="nowrap small">${d.han_chot ? fmtTG(d.han_chot) : '–'}</td>
          <td>${thanhTienDo(da, ng.length)}</td>
          <td class="r">${cho ? `<b>${cho}</b>` : ''}</td><td class="r">${sua ? `<span class="chu-cam">${sua}</span>` : ''}</td>
          <td>${d.dang_mo ? '<span class="tt tt-dang_xu_ly">Đang mở</span>' : '<span class="tt">Đã đóng</span>'}</td></tr>`;
      }).join('')}</tbody></table></div>` : `<p class="muted pad">${dots.length ? 'Không có đợt phù hợp.' : 'Chưa có đợt báo cáo nào. Bấm “+ Tạo đợt báo cáo”.'}</p>`;
  };
  than.innerHTML = `<div class="head-row"><div class="row-gap wrap"><input class="input sm" id="bc-tim" placeholder="Tìm tên đợt…" value="${esc(F.q)}">
      ${quanLyMoiDot() ? `<label class="switch"><input type="checkbox" id="bc-cua-toi" ${F.cuaToi ? 'checked' : ''}> Chỉ đợt tôi tạo</label>` : ''}</div>
      <button type="button" class="btn primary" id="bc-tao">+ Tạo đợt báo cáo</button></div>
    <p class="muted small">${quanLyMoiDot() ? 'Bạn quản lý mọi đợt báo cáo.' : 'Bạn quản lý các đợt do mình tạo.'} Bấm tên đợt để xem bài nộp, nhận xét, tải minh chứng.</p>
    <div id="bc-ds"></div>`;
  ve();
  S.bcInput = e => { if (e.target.id === 'bc-tim') { F.q = e.target.value.trim(); ve(); } };
  S.bcChange = e => { if (e.target.id === 'bc-cua-toi') { F.cuaToi = e.target.checked; ve(); } };
  S.bcClick = e => {
    if (e.target.closest('#bc-tao')) { moSuaDot(null, new Set(), id => { S.bcDot = id; dieuHuong(); }); return; }
    const x = e.target.closest('[data-xem-dot]');
    if (x) { e.preventDefault(); S.bcDot = +x.dataset.xemDot; dieuHuong(); }
  };
}

/** Hộp tạo / sửa / nhân bản đợt */
function moSuaDot(dot, rieng, xong, nhanBan = false) {
  const nhom = nhomBC(), ds = nguoiDaDuyet().sort(soSanhNguoi);
  const chonNhom = new Set(dot?.nhom || []), chonRieng = new Set(rieng || []);
  const dt = dot?.han_chot && !nhanBan ? new Date(new Date(dot.han_chot).getTime() + 7 * 3600e3).toISOString().slice(0, 16) : '';
  const dem = g => ds.filter(g.co).length;
  moModal(`<h2>${nhanBan ? 'Nhân bản đợt' : dot ? 'Sửa đợt báo cáo' : 'Tạo đợt báo cáo'}</h2>
    <label class="lbl">Tên đợt <span class="err">*</span><input class="input" id="kd-ten" value="${esc(dot ? dot.ten + (nhanBan ? ' (bản sao)' : '') : '')}" placeholder="vd: Báo cáo sơ kết tháng 11; Kế hoạch bài dạy tuần 12; Khảo sát Nghị quyết…"></label>
    <label class="lbl">Hướng dẫn<textarea class="input" id="kd-hd" rows="3" placeholder="Cần nộp gì, theo mẫu nào…">${esc(dot?.huong_dan || '')}</textarea></label>
    <label class="lbl">Đường link kèm theo <span class="muted small">(không bắt buộc: biểu mẫu, khảo sát, tài liệu…)</span><input class="input" id="kd-link" value="${esc(dot?.link || '')}" placeholder="https://…"></label>
    <div class="grid2 khong-le">
      <label class="lbl">Hạn chót<input type="datetime-local" class="input" id="kd-han" value="${dt}"></label>
      <label class="lbl">Số tệp tối thiểu (ảnh, PDF, Word…)<select class="input" id="kd-anh">${[1, 2, 3].map(k => `<option value="${k}" ${(dot?.so_tep || 1) === k ? 'selected' : ''}>${k} tệp</option>`).join('')}</select></label>
    </div>
    <div class="lbl">Giao cho nhóm</div>
    <div class="luoi-lop bc-nhom">${nhom.map(g => `<label class="radio"><input type="checkbox" data-kd-nhom="${esc(g.ma)}" ${chonNhom.has(g.ma) ? 'checked' : ''}> ${esc(g.ten)} <span class="muted small">(${dem(g)})</span></label>`).join('')}</div>
    <details class="bc-chon-rieng" ${chonRieng.size ? 'open' : ''}><summary class="lbl">Thêm từng người <span class="muted small" id="kd-dem-rieng"></span></summary>
      <input class="input sm" id="kd-tim" placeholder="Tìm tên…" autocomplete="off">
      <div class="luoi-lop ds-chon" id="kd-ds">${ds.map(u => `<label class="radio" data-ten="${esc(boDau(u.ho_ten || u.email))}"><input type="checkbox" data-kd-nguoi="${u.id}" ${chonRieng.has(u.id) ? 'checked' : ''}> ${esc(tenNguoi(u))} <span class="muted small">${CHUC_VU[u.chuc_vu] || ''}</span></label>`).join('')}</div>
    </details>
    <p class="small bc-xem-truoc" id="kd-tong"></p>
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Hủy</button><button type="button" class="btn primary" id="kd-luu">Lưu</button></div>`, true);
  const tinh = () => {
    const nh = $$('[data-kd-nhom]:checked').map(c => nhom.find(g => g.ma === c.dataset.kdNhom));
    const rg = new Set($$('[data-kd-nguoi]:checked').map(c => c.dataset.kdNguoi));
    const nguoi = ds.filter(u => rg.has(u.id) || nh.some(g => g.co(u)));
    $('#kd-dem-rieng').textContent = rg.size ? `(đã chọn ${rg.size})` : '';
    $('#kd-tong').innerHTML = nguoi.length ? `Sẽ giao cho <b>${nguoi.length}</b> người: ${esc(nguoi.slice(0, 12).map(tenNguoi).join(', '))}${nguoi.length > 12 ? ` … và ${nguoi.length - 12} người khác` : ''}.`
      : '<span class="err">Chưa chọn nhóm hoặc người nhận.</span>';
    return nguoi.length;
  };
  tinh();
  $('#modal-body').onchange = tinh;
  $('#kd-tim').oninput = e => { const q = boDau(e.target.value.trim()); $$('#kd-ds [data-ten]').forEach(l => (l.style.display = !q || l.dataset.ten.includes(q) ? '' : 'none')); };
  $('#kd-luu').onclick = async () => {
    const ten = $('#kd-ten').value.trim(), link = $('#kd-link').value.trim(), han = $('#kd-han').value;
    if (!ten) { toast('Nhập tên đợt.', 'err'); $('#kd-ten').focus(); return; }
    if (link && !linkAnToan(link)) { toast('Đường link phải bắt đầu bằng http:// hoặc https://', 'err'); return; }
    if (!tinh()) { toast('Chọn ít nhất một nhóm hoặc một người nhận.', 'err'); return; }
    const nhomMoi = $$('[data-kd-nhom]:checked').map(c => c.dataset.kdNhom), rgMoi = $$('[data-kd-nguoi]:checked').map(c => c.dataset.kdNguoi);
    const row = { ten, link: link || null, huong_dan: $('#kd-hd').value.trim() || null, han_chot: han ? new Date(han + ':00+07:00').toISOString() : null, so_tep: +$('#kd-anh').value, nhom: nhomMoi };
    const btn = $('#kd-luu'); btn.disabled = true;
    try {
      const sua = dot && !nhanBan;
      const r = sua ? await sb.from('bc_dot').update(row).eq('id', dot.id).select('id').single() : await sb.from('bc_dot').insert(row).select('id').single();
      if (r.error) throw r.error;
      const id = r.data.id;
      if (sua) { const x = await sb.from('bc_dot_nguoi').delete().eq('dot_id', id); if (x.error) throw x.error; }
      if (rgMoi.length) { const x = await sb.from('bc_dot_nguoi').insert(rgMoi.map(u => ({ dot_id: id, nguoi_dung_id: u }))); if (x.error) throw x.error; }
      toast(sua ? 'Đã lưu đợt báo cáo.' : 'Đã tạo đợt báo cáo.');
      dongModal(); App.capNhatHuyHieu(); xong(id);
    } catch (e) { toast(loiChuaCaiBC(e) ? MSG_CHUA_CAI_BC : dichLoi(e), 'err'); btn.disabled = false; }
  };
}

/** Nhận xét một bài nộp: Đạt / Cần sửa (+ lời nhận xét) */
function moNhanXet(n, u, d, xong) {
  moModal(`<h2>Nhận xét bài nộp</h2>
    <p class="small"><b>${esc(tenNguoi(u))}</b> · ${esc(d.ten)}<br><span class="muted">Nộp lúc ${fmtTG(n.nop_luc)}${n.sua_luc ? ` · sửa lúc ${fmtTG(n.sua_luc)}` : ''}</span></p>
    <div class="radio-row">
      <label class="radio"><input type="radio" name="nx-tt" value="dat" ${n.trang_thai !== 'can_sua' ? 'checked' : ''}> ✔ Đạt</label>
      <label class="radio"><input type="radio" name="nx-tt" value="can_sua" ${n.trang_thai === 'can_sua' ? 'checked' : ''}> ✎ Cần sửa – yêu cầu nộp lại</label>
      <label class="radio"><input type="radio" name="nx-tt" value="da_nop"> Chưa xem (bỏ nhận xét)</label></div>
    <label class="lbl">Lời nhận xét <span class="muted small">(người nộp sẽ thấy)</span><textarea class="input" id="nx-nd" rows="4" placeholder="vd: Cần bổ sung số liệu tháng 11…">${esc(n.nhan_xet || '')}</textarea></label>
    <p class="muted small">“Cần sửa”: người nộp được sửa và nộp lại kể cả khi đợt đã đóng; nộp lại xong bài trở về “Chờ xem”. “Đạt”: bài được duyệt, người nộp không sửa được nữa (muốn cho sửa, chọn lại “Cần sửa” hoặc “Chưa xem”).</p>
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Hủy</button><button type="button" class="btn primary" id="nx-luu">Lưu nhận xét</button></div>`);
  $('#nx-luu').onclick = async () => {
    const tt = $('input[name=nx-tt]:checked').value, nd = $('#nx-nd').value.trim();
    if (tt === 'can_sua' && !nd) { toast('Ghi rõ cần sửa gì để người nộp biết.', 'err'); $('#nx-nd').focus(); return; }
    const r = await sb.from('bc_nop').update({ trang_thai: tt, nhan_xet: tt === 'da_nop' ? null : nd || null }).eq('id', n.id).select('id');
    if (r.error || !r.data?.length) { toast(r.error ? dichLoi(r.error) : 'Không đủ quyền.', 'err'); return; }
    toast('Đã lưu nhận xét.'); dongModal(); xong();
  };
}

async function bcChiTietDot(than, conSong, dotId) {
  const { dots, dsGiao, dsRieng, nopTheoDot } = await layDuLieuQL();
  if (!conSong()) return;
  const d = dots.find(x => x.id === dotId);
  if (!d) { S.bcDot = null; return bcDanhSachDot(than, conSong); }
  const ng = nguoiCuaDot(d, dsGiao), nop = nopTheoDot.get(d.id) || new Map();
  // Bài nộp của người không còn trong danh sách giao (vd đổi nhóm sau khi đã nộp) vẫn hiện
  const nguoiNop = [...nop.keys()].filter(id => !ng.some(u => u.id === id)).map(id => S.ndMap.get(id) || { id, ho_ten: '(tài khoản đã xóa)' });
  const daNop = [...ng, ...nguoiNop].filter(u => nop.has(u.id)).map(u => ({ u, n: nop.get(u.id) })).sort((a, b) => new Date(a.n.nop_luc) - new Date(b.n.nop_luc));
  const chuaNop = ng.filter(u => !nop.has(u.id));
  const tre = daNop.filter(x => treHan(d, x.n)).length;
  const dem = tt => daNop.filter(x => x.n.trang_thai === tt).length;
  const coAnh = daNop.filter(x => !x.n.anh_da_xoa && x.n.anh.length);
  const link = linkAnToan(d.link);
  const F = S.locBCCT || (S.locBCCT = { tt: '' });
  than.innerHTML = `
    <p><button type="button" class="link" id="dv-ve">← Danh sách đợt</button></p>
    <div class="head-row"><h3 style="margin:0">${esc(d.ten)} ${d.dang_mo ? '<span class="tt tt-dang_xu_ly">Đang mở</span>' : '<span class="tt">Đã đóng</span>'}</h3>
      <div class="row-gap wrap">
        <button type="button" class="btn sm" id="dv-sua">Sửa</button>
        <button type="button" class="btn sm" id="dv-nhan">Nhân bản</button>
        <button type="button" class="btn sm" id="dv-dong">${d.dang_mo ? 'Đóng đợt' : 'Mở lại'}</button>
        <button type="button" class="btn sm danger" id="dv-xoa">Xóa đợt</button></div></div>
    <p class="small">${hanChot(d)} · Cần ${d.so_tep} tệp · Giao cho: ${esc(moTaNguoiNhan(d, dsRieng.get(d.id)?.size || 0))} (${ng.length} người) · Người tạo: ${esc(tenNguoi(S.ndMap.get(d.tao_boi)))}${link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener">Đường link ↗</a>` : ''}</p>
    ${d.huong_dan ? `<div class="dv-hd small">${esc(d.huong_dan)}</div>` : ''}
    <div class="kpis">
      <div class="kpi"><span>Đã nộp</span><b>${daNop.length}<small class="kpi-phu"> / ${ng.length}</small></b><small>${ng.length ? Math.round(daNop.length / ng.length * 100) : 0}% · ${tre ? `<span class="chu-cam">${tre} trễ hạn</span>` : 'không ai trễ'}</small></div>
      <div class="kpi"><span>Chờ xem</span><b>${dem('da_nop')}</b><small>chưa nhận xét</small></div>
      <div class="kpi"><span>Đạt</span><b class="chu-xanh">${dem('dat')}</b><small>&nbsp;</small></div>
      <div class="kpi"><span>Cần sửa</span><b class="${dem('can_sua') ? 'chu-cam' : ''}">${dem('can_sua')}</b><small>đang chờ nộp lại</small></div>
      <div class="kpi"><span>Chưa nộp</span><b class="${chuaNop.length ? 'chu-do' : ''}">${chuaNop.length}</b><small>&nbsp;</small></div>
    </div>
    <div class="grid2">
      <div><div class="head-row"><h3 style="margin:0">Chưa nộp (${chuaNop.length})</h3>${chuaNop.length ? '<button type="button" class="btn sm primary" id="dv-chep">📋 Sao chép để gửi Zalo</button>' : ''}</div>
        ${chuaNop.length ? `<ol class="dv-ds">${chuaNop.map(u => `<li>${esc(tenNguoi(u))} <span class="muted small">${CHUC_VU[u.chuc_vu] || ''}</span></li>`).join('')}</ol>` : '<p class="muted">Tất cả đã nộp. 🎉</p>'}</div>
      <div><div class="head-row"><h3 style="margin:0">Khác</h3></div>
        <div class="row-gap wrap"><button type="button" class="btn sm primary" id="dv-tai" ${coAnh.length ? '' : 'disabled'}>⬇️ Tải tất cả minh chứng</button>
          <button type="button" class="btn sm" id="dv-csv">Xuất danh sách (CSV)</button>
          <button type="button" class="btn sm danger" id="dv-don" ${coAnh.length ? '' : 'disabled'}>Dọn tệp minh chứng</button></div>
        <p class="muted small">“Tải tất cả” tạo một file nén chứa các file <b>&lt;Tên người&gt;.zip</b> – mỗi người một file. Muốn tải riêng một người, bấm ⬇️ trên thẻ của người đó.</p>
        <p class="muted small">“Dọn tệp” xóa ảnh và tệp khỏi máy chủ để giải phóng dung lượng, vẫn giữ kết quả ai đã nộp, nộp lúc nào, nhận xét. Chỉ nên dọn khi không cần xem lại (vd: hết năm).</p></div>
    </div>
    <div class="head-row"><h3 style="margin:0">Bài đã nộp (${daNop.length})</h3>
      <div class="segs" id="bc-loc-tt">${[['', 'Tất cả'], ['da_nop', 'Chờ xem'], ['dat', 'Đạt'], ['can_sua', 'Cần sửa']].map(([k, t]) => `<button type="button" class="seg ${F.tt === k ? 'on' : ''}" data-loc-tt="${k}">${t} <span class="cnt">${k ? dem(k) : daNop.length}</span></button>`).join('')}</div></div>
    ${coAnh.length ? '<p class="muted small">Bấm vào ảnh để xem lớn (nút ‹ › hoặc phím ← → để xem lần lượt); bấm vào tệp PDF, Word… để mở hoặc tải về.</p>' : ''}
    ${daNop.length ? `<div class="mc-luoi">${daNop.map((x, i) => `<div class="mc-the ${treHan(d, x.n) ? 'tre' : ''} ${F.tt && x.n.trang_thai !== F.tt ? 'hidden' : ''}">
        <div class="mc-the-dau">${!x.n.anh_da_xoa && x.n.anh.length ? `<button type="button" class="btn sm mc-tai" data-tai-nguoi="${esc(x.u.id)}" title="Tải minh chứng của người này (.zip)">⬇️</button>` : ''}<b>${i + 1}. ${esc(tenNguoi(x.u))}</b>
          <div class="muted small">${CHUC_VU[x.u.chuc_vu] || ''} · nộp ${fmtGio(x.n.nop_luc)}${x.n.sua_luc ? ` · sửa ${fmtGio(x.n.sua_luc)}` : ''}</div>
          <div>${badgeNop(x.n)}${treHan(d, x.n) ? ' <span class="nang">Trễ</span>' : ''}</div></div>
        ${x.n.anh_da_xoa ? '<p class="muted small">Minh chứng đã được dọn.</p>' : oAnhNho(x.n.anh, `${tenNguoi(x.u)} – ${d.ten}`, true)}
        ${x.n.ghi_chu ? `<div class="small mc-gc">${esc(x.n.ghi_chu)}</div>` : ''}
        ${x.n.nhan_xet ? `<div class="bc-nhan-xet small ${x.n.trang_thai === 'can_sua' ? 'can-sua' : ''}"><b>Nhận xét:</b> ${esc(x.n.nhan_xet)}</div>` : ''}
        <div class="row-gap wrap bc-nut-duyet">
          ${x.n.trang_thai !== 'dat' ? `<button type="button" class="btn sm" data-dat="${x.n.id}">✔ Đạt</button>` : ''}
          <button type="button" class="btn sm" data-nhan-xet="${x.n.id}">✎ Nhận xét / yêu cầu sửa</button></div></div>`).join('')}</div>` : '<p class="muted">Chưa có ai nộp.</p>'}`;
  ganAnhMC(than);
  const lamMoi = () => { if (conSong()) { App.capNhatHuyHieu(); bcChiTietDot(than, conSong, dotId); } };
  S.bcClick = async e => {
    const id = e.target.closest('button')?.id;
    if (e.target.closest('#dv-ve')) { S.bcDot = null; dieuHuong(); return; }
    const loc = e.target.closest('[data-loc-tt]');
    if (loc) { F.tt = loc.dataset.locTt; lamMoi(); return; }
    const tn = e.target.closest('[data-tai-nguoi]');
    if (tn) { taiMinhChung(d, coAnh.filter(x => x.u.id === tn.dataset.taiNguoi), tn); return; }
    const dat = e.target.closest('[data-dat]');
    if (dat) {
      dat.disabled = true;
      const r = await sb.from('bc_nop').update({ trang_thai: 'dat' }).eq('id', +dat.dataset.dat).select('id');
      if (r.error || !r.data?.length) { toast(r.error ? dichLoi(r.error) : 'Không đủ quyền.', 'err'); dat.disabled = false; return; }
      toast('Đã đánh dấu Đạt.'); lamMoi(); return;
    }
    const nx = e.target.closest('[data-nhan-xet]');
    if (nx) { const x = daNop.find(y => y.n.id === +nx.dataset.nhanXet); moNhanXet(x.n, x.u, d, lamMoi); return; }
    if (id === 'dv-tai') taiMinhChung(d, coAnh, e.target.closest('button'));
    else if (id === 'dv-sua') moSuaDot(d, dsRieng.get(d.id), lamMoi);
    else if (id === 'dv-nhan') moSuaDot(d, dsRieng.get(d.id), nid => { S.bcDot = nid; dieuHuong(); }, true);
    else if (id === 'dv-dong') {
      const dangMo = d.dang_mo;
      if (!confirm(dangMo ? 'Đóng đợt này? Mọi người sẽ không nộp hay sửa bài được nữa (trừ bài bị yêu cầu sửa).' : 'Mở lại đợt này cho mọi người nộp / sửa?')) return;
      const r = await sb.from('bc_dot').update({ dang_mo: !dangMo }).eq('id', d.id);
      if (r.error) toast(dichLoi(r.error), 'err'); else { toast(dangMo ? 'Đã đóng đợt.' : 'Đã mở lại đợt.'); lamMoi(); }
    } else if (id === 'dv-xoa') {
      if (!confirm(`Xóa đợt “${d.ten}” cùng ${daNop.length} bài nộp và toàn bộ minh chứng? Không thể hoàn tác.`)) return;
      const tep = daNop.flatMap(x => x.n.anh_da_xoa ? [] : x.n.anh);
      for (let i = 0; i < tep.length; i += 100) await sb.storage.from(KHO_MC).remove(tep.slice(i, i + 100));
      const r = await sb.from('bc_dot').delete().eq('id', d.id);
      if (r.error) toast(dichLoi(r.error), 'err'); else { toast('Đã xóa đợt.'); S.bcDot = null; App.capNhatHuyHieu(); dieuHuong(); }
    } else if (id === 'dv-chep') {
      const txt = `${d.ten}${d.han_chot ? ` – hạn chót ${fmtTG(d.han_chot)}` : ''}\nDanh sách chưa nộp (${chuaNop.length}):\n`
        + chuaNop.map((u, i) => `${i + 1}. ${tenNguoi(u)}`).join('\n') + (link ? `\nĐường link: ${link}` : '');
      try { await navigator.clipboard.writeText(txt); toast('Đã sao chép. Mở Zalo và dán (Ctrl+V).'); }
      catch { moModal(`<h2>Sao chép danh sách</h2><textarea class="input mono" rows="12" id="dv-txt">${esc(txt)}</textarea><div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Đóng</button></div>`); $('#dv-txt').select(); }
    } else if (id === 'dv-csv') {
      xuatCSV(`bao-cao_${boDau(d.ten).replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.csv`, ['Họ tên', 'Email', 'Chức vụ', 'Trạng thái', 'Nộp lúc', 'Trễ hạn', 'Số tệp', 'Ghi chú', 'Nhận xét'],
        [...ng, ...nguoiNop].map(u => { const n = nop.get(u.id); return [u.ho_ten, u.email, CHUC_VU[u.chuc_vu], n ? TT_NOP[n.trang_thai] : 'Chưa nộp', n ? fmtTG(n.nop_luc) : '', n && treHan(d, n) ? 'Trễ' : '', n ? (n.anh_da_xoa ? 'đã dọn' : n.anh.length) : '', n?.ghi_chu || '', n?.nhan_xet || '']; }));
    } else if (id === 'dv-don') {
      if (!confirm(`Dọn ${coAnh.reduce((s, x) => s + x.n.anh.length, 0)} tệp minh chứng của đợt này khỏi máy chủ?\n\nKết quả (ai đã nộp, nộp lúc nào, nhận xét) vẫn được giữ, nhưng sẽ không xem lại được minh chứng. Không thể hoàn tác.`)) return;
      const tep = coAnh.flatMap(x => x.n.anh);
      for (let i = 0; i < tep.length; i += 100) { const r = await sb.storage.from(KHO_MC).remove(tep.slice(i, i + 100)); if (r.error) { toast(dichLoi(r.error), 'err'); return; } }
      const r = await sb.from('bc_nop').update({ anh: [], anh_da_xoa: true }).in('id', coAnh.map(x => x.n.id));
      if (r.error) toast(dichLoi(r.error), 'err'); else { toast('Đã dọn minh chứng, giữ nguyên kết quả.'); lamMoi(); }
    }
  };
}

/* =====================================================================
   TỔNG HỢP THEO NGƯỜI
   ===================================================================== */
async function bcTongHop(than, conSong) {
  const { dots, dsGiao, nopTheoDot } = await layDuLieuQL();
  if (!conSong()) return;
  const F = S.locBCTH || (S.locBCTH = { tu: khoangTK('nam').tu || '', den: '', nhom: '' });
  const nhom = nhomBC();
  const loc = dots.filter(d => { const n = ngayVN(d.han_chot || d.tao_luc); return (!F.tu || n >= F.tu) && (!F.den || n <= F.den); });
  const g = nhom.find(x => x.ma === F.nhom);
  const nguoi = new Map();
  loc.forEach(d => (dsGiao.get(d.id) || new Set()).forEach(id => { const u = S.ndMap.get(id); if (u && (!g || g.co(u))) nguoi.set(id, u); }));
  const bang = [...nguoi.values()].map(u => {
    const giao = loc.filter(d => dsGiao.get(d.id)?.has(u.id));
    const nop = giao.filter(d => nopTheoDot.get(d.id)?.has(u.id));
    const n = d => nopTheoDot.get(d.id).get(u.id);
    const tre = nop.filter(d => treHan(d, n(d))).length;
    return { u, giao: giao.length, nop: nop.length, dung: nop.length - tre, tre, dat: nop.filter(d => n(d).trang_thai === 'dat').length,
      sua: nop.filter(d => n(d).trang_thai === 'can_sua').length, chua: giao.filter(d => !nopTheoDot.get(d.id)?.has(u.id)) };
  }).sort((a, b) => (a.giao ? a.nop / a.giao : 1) - (b.giao ? b.nop / b.giao : 1) || b.chua.length - a.chua.length || soSanhNguoi(a.u, b.u));
  than.innerHTML = `
    <div class="filters"><label>Đợt có hạn chót từ ngày<input type="date" class="input" id="th-tu" value="${F.tu}"></label>
      <label>Đến ngày <span class="muted">(để trống = tất cả)</span><input type="date" class="input" id="th-den" value="${F.den}"></label>
      <label>Nhóm<select class="input" id="th-nhom"><option value="">Tất cả</option>${nhom.filter(x => x.ma !== 'tat_ca').map(x => `<option value="${esc(x.ma)}" ${F.nhom === x.ma ? 'selected' : ''}>${esc(x.ten)}</option>`).join('')}</select></label>
      <button type="button" class="btn" id="th-csv">Xuất CSV</button></div>
    <p class="muted small">${loc.length} đợt báo cáo ${quanLyMoiDot() ? '' : 'do bạn tạo '}trong khoảng thời gian này. Xếp người hoàn thành thấp lên đầu.</p>
    ${bang.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Họ tên</th><th class="r">Được giao</th><th class="r">Đã nộp</th><th class="r">Đúng hạn</th><th class="r">Trễ</th><th class="r">Đạt</th><th class="r">Cần sửa</th><th>Tỷ lệ hoàn thành</th><th>Đợt chưa nộp</th></tr></thead><tbody>
      ${bang.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(tenNguoi(x.u))}</b><div class="muted small">${CHUC_VU[x.u.chuc_vu] || ''}</div></td>
        <td class="r">${x.giao}</td><td class="r">${x.nop}</td><td class="r">${x.dung}</td><td class="r">${x.tre ? `<b class="chu-cam">${x.tre}</b>` : ''}</td>
        <td class="r">${x.dat || ''}</td><td class="r">${x.sua ? `<span class="chu-cam">${x.sua}</span>` : ''}</td>
        <td>${thanhTienDo(x.nop, x.giao)}</td><td class="small">${x.chua.map(d => esc(d.ten)).join('; ')}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted pad">Không có người nào được giao báo cáo trong khoảng thời gian / nhóm này.</p>'}`;
  S.bcChange = e => { if (['th-tu', 'th-den', 'th-nhom'].includes(e.target.id)) { F.tu = $('#th-tu').value; F.den = $('#th-den').value; F.nhom = $('#th-nhom').value; bcTongHop(than, conSong); } };
  S.bcClick = e => {
    if (e.target.closest('#th-csv')) xuatCSV(`tong-hop-bao-cao_${F.tu || 'dau'}_${F.den || 'nay'}.csv`, ['Họ tên', 'Email', 'Chức vụ', 'Được giao', 'Đã nộp', 'Đúng hạn', 'Trễ', 'Đạt', 'Cần sửa', 'Tỷ lệ (%)', 'Đợt chưa nộp'],
      bang.map(x => [x.u.ho_ten, x.u.email, CHUC_VU[x.u.chuc_vu], x.giao, x.nop, x.dung, x.tre, x.dat, x.sua, x.giao ? Math.round(x.nop / x.giao * 100) : '', x.chua.map(d => d.ten).join('; ')]));
  };
}