'use strict';
/* =====================================================================
   PHÂN HỆ VI PHẠM – KHAI BÁO VỚI NỀN TẢNG
   Phân hệ, các trang (mục menu), chấm đỏ, phạm vi xử lý, xóa dữ liệu.
   Cơ sở dữ liệu: supabase/10-vi-pham.sql
   ===================================================================== */

App.dangKyPhanHe({
  id: 'vi_pham', ten: 'Vi phạm', thuTu: 10, moDun: 'vi_pham', mau: '#0f5f78', icon: 'nhap',
  mo: 'Ghi nhận, xử lý, thống kê vi phạm của học sinh và tập thể lớp'
});

const QUYEN_XEM_VP = ['vp.ghi_nhan', 'vp.xu_ly', 'vp.xu_ly_tat_ca'];

App.dangKyTrang({ id: 'vp-nhap', phanHe: 'vi_pham', ten: 'Nhập vi phạm', icon: 'nhap', thuTu: 1,
  quyen: ['vp.ghi_nhan'], ve: el => veNhapVP(el) });

App.dangKyTrang({ id: 'vp-xu-ly', phanHe: 'vi_pham', ten: 'Xử lý', icon: 'xuly', thuTu: 2,
  quyen: QUYEN_XEM_VP, ve: veXuLyVP,
  // Chấm đỏ: số vi phạm chưa xử lý mà người này được quyền xử lý
  huyHieu: async () => {
    if (!duocXuLy()) return 0;
    const ds = await layHet(() => sb.from('v_vi_pham').select('id,lop_id,muc_do').eq('trang_thai', 'chua_xu_ly').order('id'));
    return ds.filter(coTheXuLy).length;
  } });

App.dangKyTrang({ id: 'vp-thong-ke', phanHe: 'vi_pham', ten: 'Thống kê', icon: 'thongke', thuTu: 3,
  quyen: QUYEN_XEM_VP, ve: veThongKeVP });

App.dangKyTrang({ id: 'vp-danh-muc', phanHe: 'vi_pham', ten: 'Danh mục', icon: 'loai', thuTu: 4,
  quyen: ['vp.hinh_thuc', 'vp.bien_phap'], ve: veDanhMucVP });

/* ---------- Phạm vi xử lý theo điểm trường (cạnh quyền "Xử lý vi phạm" trong trang Tài khoản) ---------- */
App.dangKyQuyenPhu('vp.xu_ly', {
  nhan: uid => coDT() ? `<span class="small">${dtXuLyCua(uid).length ? esc(dtXuLyCua(uid).map(tenDT).join(', ')) : 'toàn trường'}</span>` : '',
  mo: moPhamViXuLy
});
function moPhamViXuLy(uid, xong) {
  const u = S.ndMap.get(uid), daGan = dtXuLyCua(uid);
  moModal(`<h2>Phạm vi xử lý vi phạm</h2><p class="muted">${esc(u?.ho_ten || u?.email || '')}</p>
    <div class="luoi-lop">${S.dt.map(d => {
      const khac = S.nd.filter(x => x.id !== uid && App.nguoiCoQuyen(x.id, 'vp.xu_ly') && dtXuLyCua(x.id).includes(d.id)).map(x => x.ho_ten || x.email);
      return `<label class="radio o-lop"><input type="checkbox" value="${d.id}" ${daGan.includes(d.id) ? 'checked' : ''}> ${esc(d.ten)}${khac.length ? ` <span class="muted small">(cùng: ${esc(khac.join(', '))})</span>` : ''}</label>`;
    }).join('')}</div>
    <p class="muted small">Chọn một hoặc nhiều điểm trường. <b>Không chọn điểm nào = xử lý toàn trường.</b></p>
    <div class="modal-actions"><span class="sp"></span><button type="button" class="btn" data-dong>Hủy</button><button type="button" class="btn primary" id="gd-luu">Lưu</button></div>`);
  $('#gd-luu').onclick = async () => {
    const chon = $$('#modal-body input[type=checkbox]:checked').map(i => +i.value);
    const btn = $('#gd-luu'); btn.disabled = true;
    let r = await sb.from('vp_pham_vi').delete().eq('nguoi_dung_id', uid);
    if (!r.error && chon.length) r = await sb.from('vp_pham_vi').insert(chon.map(id => ({ nguoi_dung_id: uid, diem_truong_id: id })));
    btn.disabled = false;
    if (r.error) { toast(dichLoi(r.error), 'err'); return; }
    toast(chon.length ? `Đã giao ${chon.length} điểm trường.` : 'Đã đặt xử lý toàn trường.');
    dongModal(); await xong();
  };
}

/* ---------- Khi xóa học sinh / lớp: báo số vi phạm bị xóa kèm ---------- */
App.dangKyLienQuanHocSinh(async ({ hocSinh = [], lop = [] }) => {
  if (!App.daCai('vi_pham')) return [];
  const loc = [];
  if (lop.length) loc.push(`lop_id.in.(${lop.join(',')})`);
  for (let i = 0; i < hocSinh.length; i += 300) loc.push(`hoc_sinh_id.in.(${hocSinh.slice(i, i + 300).join(',')})`);
  if (!loc.length) return [];
  const { count, error } = await sb.from('vi_pham').select('id', { count: 'exact', head: true }).or(loc.join(','));
  if (error) throw error;
  return count ? [{ ten: 'vi phạm (gồm cả vắng, cúp tiết)', so: count }] : [];
});

/* ---------- Quản trị → Xóa dữ liệu ---------- */
App.dangKyDonDuLieu({
  id: 'vi_pham', moDun: 'vi_pham', ten: 'Vi phạm (gồm cả vắng, cúp tiết)', coNgay: true,
  mo: 'Để trống ngày = xóa tất cả; chọn ngày = chỉ xóa vi phạm xảy ra trước ngày đó.',
  dem: async ngay => {
    let q = sb.from('vi_pham').select('id', { count: 'exact', head: true });
    q = ngay ? q.lt('thoi_gian', tuNgay(ngay)) : q.gte('id', 0);
    const { count, error } = await q; if (error) throw error; return count || 0;
  },
  xoa: async ngay => {
    let q = sb.from('vi_pham').delete();
    q = ngay ? q.lt('thoi_gian', tuNgay(ngay)) : q.gte('id', 0);
    const { error } = await q; if (error) throw error;
  }
});
App.dangKyDonDuLieu({
  id: 'vp_sao_luu', moDun: 'vi_pham', ten: 'Sao lưu toàn bộ vi phạm (CSV)', chiTai: true,
  mo: 'Tải file CSV toàn bộ vi phạm trước khi xóa.',
  tai: async () => {
    const rows = await layHet(() => sb.from('v_vi_pham').select('*').order('thoi_gian').order('id'));
    xuatCSV(`sao-luu-vi-pham_${homNay()}.csv`,
      ['Thời gian', 'Ghi lúc', 'Học sinh', 'Lớp', 'Điểm trường', 'Vi phạm', 'Áp dụng cho', 'Nhóm', 'Mức độ', 'Điểm trừ', 'Chuyên cần', 'Ghi chú', 'Người ghi', 'Trạng thái', 'Biện pháp', 'Người xử lý', 'Thời gian xử lý'],
      rows.map(r => [fmtTG(r.thoi_gian), fmtTG(r.tao_luc), tenHS(r), r.ten_lop, r.ten_diem_truong, r.ten_vi_pham, PHAM_VI[r.pham_vi], r.nhom, MUC_DO[r.muc_do], +r.diem_tru, CC[r.chuyen_can] || '', r.ghi_chu, r.ten_nguoi_ghi,
        TRANG_THAI[r.trang_thai], r.bien_phap, r.ten_nguoi_xu_ly, r.thoi_gian_xu_ly ? fmtTG(r.thoi_gian_xu_ly) : '']));
    return rows.length;
  }
});
