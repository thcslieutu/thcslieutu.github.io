'use strict';
/* =====================================================================
   PHÂN HỆ QUẢN TRỊ – TÀI KHOẢN & PHÂN QUYỀN (chỉ Quản trị)
   Mỗi tài khoản có một CHỨC VỤ (để hiển thị, gợi ý quyền mặc định) và các QUYỀN theo từng phân hệ.
   Danh mục quyền do các file SQL của phân hệ khai báo (bảng quyen) → phân hệ mới tự hiện cột ở đây.
   ===================================================================== */

/** Tên phân hệ của một quyền (theo App.phanHe; phân hệ chưa có giao diện thì dùng mã) */
const tenPhanHeQuyen = ma => App.phanHe.find(p => p.id === ma)?.ten || { quan_tri: 'Quản trị' }[ma] || ma;
/** Danh mục quyền nhóm theo phân hệ: [[phanHe, [quyền…]], …] */
function nhomQuyen() {
  const m = new Map();
  const thuTu = ma => App.phanHe.find(p => p.id === ma)?.thuTu ?? (ma === 'quan_tri' ? 1000 : 500);
  [...S.dsQuyen].sort((a, b) => thuTu(a.phan_he) - thuTu(b.phan_he) || a.thu_tu - b.thu_tu).forEach(q => {
    if (!m.has(q.phan_he)) m.set(q.phan_he, []);
    m.get(q.phan_he).push(q);
  });
  return [...m];
}
const quyenMacDinh = cv => S.dsQuyen.filter(q => (q.mac_dinh || []).includes(cv)).map(q => q.ma);

async function veTaiKhoan(el) {
  const conSong = giuPhien();
  const F = S.locTK2 || (S.locTK2 = { q: '', cv: '' });
  el.innerHTML = `<section class="card"><div class="head-row"><h2>Tài khoản & phân quyền</h2>
      <div class="row-gap wrap"><input class="input sm" id="tk-tim" placeholder="Tìm tên, email…" value="${esc(F.q)}">
        <select class="input sm" id="tk-cv"><option value="">Mọi chức vụ</option>${Object.entries(CHUC_VU).map(([k, t]) => `<option value="${k}" ${F.cv === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <p class="muted small">Giáo viên, nhân viên tự đăng ký ở trang đăng nhập; tài khoản ở trạng thái <b>Chờ duyệt</b> cho tới khi được chọn chức vụ.
      Chọn <b>chức vụ</b> thì các quyền thường dùng của chức vụ đó được tick sẵn; có thể tick thêm / bỏ từng quyền rồi bấm <b>Lưu</b>.
      <b>Quản trị</b> có mọi quyền (trừ quyền dạng “thành viên” như <i>Là đảng viên</i> – phải tick riêng).</p>
    <details class="small giai-thich"><summary>Ý nghĩa từng quyền</summary>
      ${nhomQuyen().map(([ph, ds]) => `<div class="nhom-ten">${esc(tenPhanHeQuyen(ph))}</div><ul>${ds.map(q => `<li><b>${esc(q.ten)}</b>: ${esc(q.mo_ta || '')}</li>`).join('')}</ul>`).join('')}
    </details>
    <div class="table-wrap" id="tk-bang"><p class="muted pad">Đang tải…</p></div></section>`;

  const nhom = nhomQuyen();
  const ve = () => {
    const q = boDau(F.q);
    const thuTu = { cho_duyet: 0, quan_tri: 1, bgh: 2, tong_phu_trach: 3, giao_vien: 4, nhan_vien: 5 };
    const ds = S.nd.filter(u => (!F.cv || u.chuc_vu === F.cv) && (!q || boDau(`${u.ho_ten} ${u.email}`).includes(q)))
      .sort((a, b) => thuTu[a.chuc_vu] - thuTu[b.chuc_vu] || String(a.ho_ten || a.email).localeCompare(String(b.ho_ten || b.email), 'vi'));
    const oQuyen = (u, qq) => {
      const qt = u.chuc_vu === 'quan_tri' && !qq.thanh_vien;
      const co = qt || !!S.ndQuyen.get(u.id)?.has(qq.ma);
      const phu = App._quyenPhu[qq.ma];
      return `<td class="c o-quyen">${qt ? '<span class="muted" title="Quản trị có sẵn quyền này">✓</span>'
        : `<input type="checkbox" data-q="${qq.ma}" ${co ? 'checked' : ''} ${u.chuc_vu === 'cho_duyet' ? 'disabled' : ''} title="${esc(qq.ten)}">`}
        ${phu && co && !qt && phu.nhan(u.id) ? `<div>${phu.nhan(u.id)} <button type="button" class="link" data-phu="${qq.ma}">Sửa</button></div>` : ''}</td>`;
    };
    const lopCN = uid => S.lop.filter(l => l.gvcn_id === uid).map(l => l.ten_lop);
    $('#tk-bang').innerHTML = `<table class="tbl bang-quyen"><thead>
      <tr><th rowspan="2">Họ tên</th><th rowspan="2">Chức vụ</th>${nhom.map(([ph, a]) => `<th colspan="${a.length}" class="c nhom-cot">${esc(tenPhanHeQuyen(ph))}</th>`).join('')}<th rowspan="2"></th></tr>
      <tr>${nhom.map(([, a]) => a.map(qq => `<th class="c cot-quyen" title="${esc(qq.mo_ta || '')}">${esc(qq.ten)}</th>`).join('')).join('')}</tr></thead>
      <tbody>${ds.map(u => `<tr data-id="${u.id}" class="${u.chuc_vu === 'cho_duyet' ? 'cho' : ''}">
        <td><input class="input sm" name="ho_ten" value="${esc(u.ho_ten || '')}"><div class="muted small">${esc(u.email || '')}${lopCN(u.id).length ? ` · CN: ${esc(lopCN(u.id).join(', '))}` : ''}</div></td>
        <td><select class="input sm" name="chuc_vu">${Object.entries(CHUC_VU).map(([k, t]) => `<option value="${k}" ${u.chuc_vu === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          ${u.chuc_vu !== 'cho_duyet' && u.chuc_vu !== 'quan_tri' ? '<div><button type="button" class="link" data-mac-dinh>Quyền mặc định</button></div>' : ''}</td>
        ${nhom.map(([, a]) => a.map(qq => oQuyen(u, qq)).join('')).join('')}
        <td class="nowrap"><button type="button" class="btn sm" data-luu>Lưu</button>
          <div>${u.email && u.id !== S.user.id ? `<button type="button" class="link" data-dat-lai="${esc(u.email)}" title="Gửi email đặt lại mật khẩu">Đặt lại MK</button>` : ''}
          ${u.id !== S.user.id ? '<button type="button" class="link danger" data-xoa-tk>Xóa</button>' : ''}</div></td></tr>`).join('')
        || `<tr><td colspan="99" class="muted">Không có tài khoản phù hợp.</td></tr>`}</tbody></table>`;
  };
  const danhDau = tr => tr.querySelector('[data-luu]').classList.add('primary');
  const tickMacDinh = (tr, cv) => {
    const md = new Set(quyenMacDinh(cv));
    tr.querySelectorAll('[data-q]').forEach(c => { if (!App.thanhVien(c.dataset.q)) c.checked = md.has(c.dataset.q); });
    danhDau(tr);
  };

  el.oninput = e => {
    if (e.target.id === 'tk-tim') { F.q = e.target.value.trim(); ve(); return; }
    const tr = e.target.closest('tr[data-id]'); if (tr) danhDau(tr);
  };
  el.onchange = e => {
    if (e.target.id === 'tk-cv') { F.cv = e.target.value; ve(); return; }
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    if (e.target.name === 'chuc_vu') {
      const u = S.ndMap.get(tr.dataset.id), cv = e.target.value;
      tr.querySelectorAll('[data-q]').forEach(c => (c.disabled = cv === 'cho_duyet'));
      if (u.chuc_vu === 'cho_duyet' || ![...tr.querySelectorAll('[data-q]:checked')].length) tickMacDinh(tr, cv);
    }
    danhDau(tr);
  };
  el.onclick = async e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    const id = tr.dataset.id, u = S.ndMap.get(id);
    if (e.target.closest('[data-mac-dinh]')) { tickMacDinh(tr, tr.querySelector('[name=chuc_vu]').value); return; }
    const phu = e.target.closest('[data-phu]');
    if (phu) { App._quyenPhu[phu.dataset.phu].mo(id, async () => { await taiDanhMuc(); if (conSong()) ve(); }); return; }
    const dl = e.target.closest('[data-dat-lai]');
    if (dl) {
      const email = dl.dataset.datLai;
      if (!confirm(`Gửi email đặt lại mật khẩu tới ${email}?\n\nNgười dùng bấm liên kết trong email để tự đặt mật khẩu mới.`)) return;
      dl.disabled = true;
      const { error } = await guiLinkDatLaiMK(email);
      dl.disabled = false;
      toast(error ? dichLoi(error) : `Đã gửi liên kết đặt lại mật khẩu tới ${email}.`, error ? 'err' : 'ok');
      return;
    }
    if (e.target.closest('[data-xoa-tk]')) {
      if (!confirm(`Xóa tài khoản ${u.ho_ten || u.email}?\n\nNgười này không đăng nhập được nữa. Dữ liệu họ đã ghi (vi phạm…) vẫn được giữ, chỉ mất tên người ghi.`)) return;
      const { data, error } = await sb.rpc('xoa_tai_khoan', { p_ids: [id] });
      if (error || !data) { toast(error ? dichLoi(error) : 'Không xóa được.', 'err'); return; }
      toast('Đã xóa tài khoản.'); await taiDanhMuc(); if (conSong()) ve();
      return;
    }
    if (!e.target.closest('[data-luu]')) return;
    const cv = tr.querySelector('[name=chuc_vu]').value;
    if (id === S.user.id && cv !== 'quan_tri' && !confirm('Bạn đang tự bỏ quyền Quản trị của mình. Tiếp tục?')) return;
    const btn = e.target.closest('[data-luu]'); btn.disabled = true;
    try {
      const { data, error } = await sb.from('nguoi_dung').update({ ho_ten: tr.querySelector('[name=ho_ten]').value.trim() || null, chuc_vu: cv }).eq('id', id).select('id');
      if (error) throw error;
      if (!data.length) throw new Error('Không đủ quyền.');
      if (cv !== 'cho_duyet') {
        const cu = S.ndQuyen.get(id) || new Set();
        const moi = new Set($$('[data-q]', tr).filter(c => c.checked).map(c => c.dataset.q));
        const bo = [...cu].filter(q => !moi.has(q)), them = [...moi].filter(q => !cu.has(q));
        if (bo.length) { const r = await sb.from('nguoi_dung_quyen').delete().eq('nguoi_dung_id', id).in('quyen', bo); if (r.error) throw r.error; }
        if (them.length) { const r = await sb.from('nguoi_dung_quyen').insert(them.map(q => ({ nguoi_dung_id: id, quyen: q }))); if (r.error) throw r.error; }
      }
      toast('Đã lưu.');
      await taiDanhMuc(); App.capNhatHuyHieu();
      if (id === S.user.id) { dieuHuong(); return; }
      if (conSong()) ve();
    } catch (ex) { toast(dichLoi(ex), 'err'); btn.disabled = false; }
  };
  ve();
}
