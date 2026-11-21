'use strict';
/* =====================================================================
   PHÂN HỆ SỔ TRỰC – KHAI BÁO VỚI NỀN TẢNG
   Cơ sở dữ liệu: supabase/40-so-truc.sql (cần Vi phạm + Chuyên cần)
   ===================================================================== */

App.dangKyPhanHe({
  id: 'so_truc', ten: 'Sổ trực', thuTu: 40, moDun: 'so_truc', mau: '#c47a1e', icon: 'sotruc',
  mo: 'Lịch trực từng buổi, từng điểm trường; biên bản trực kèm số liệu chuyên cần; ý kiến chỉ đạo của BGH'
});
App.icon('sotruc', '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7M9 11h5"/>');
App.icon('lich', '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>');

// Người trực là giáo viên (mọi chức vụ trừ Nhân viên); Ban giám hiệu xem sổ
const daDuyetST = () => !['cho_duyet', 'nhan_vien'].includes(chucVu()) || App.coQuyen('st.xem');

App.dangKyTrang({ id: 'st-cua-toi', phanHe: 'so_truc', ten: 'Buổi trực của tôi', icon: 'sotruc', thuTu: 1,
  quyen: daDuyetST, ve: el => veSoTruc(el, 'cua_toi'), huyHieu: demBuoiChuaChot });

App.dangKyTrang({ id: 'st-lich', phanHe: 'so_truc', ten: 'Lịch trực', icon: 'lich', thuTu: 2,
  quyen: daDuyetST, ve: el => veSoTruc(el, 'lich') });

App.dangKyTrang({ id: 'st-so', phanHe: 'so_truc', ten: 'Sổ trực', icon: 'xuly', thuTu: 3,
  quyen: ['st.xem'], ve: el => veSoTruc(el, 'so'), huyHieu: demChuaXem });

App.dangKyTrang({ id: 'st-tong-hop', phanHe: 'so_truc', ten: 'Tổng hợp', icon: 'thongke', thuTu: 4,
  quyen: ['st.xem'], ve: el => veSoTruc(el, 'tong_hop') });

App.dangKyTrang({ id: 'st-mau', phanHe: 'so_truc', ten: 'Mẫu biên bản', icon: 'loai', thuTu: 5,
  quyen: () => App.laQuanTri(), ve: el => veSoTruc(el, 'mau') });
