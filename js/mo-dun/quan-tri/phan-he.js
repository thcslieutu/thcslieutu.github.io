'use strict';
/* =====================================================================
   PHÂN HỆ QUẢN TRỊ – KHAI BÁO VỚI NỀN TẢNG
   Cơ sở dữ liệu: supabase/00-nen-tang.sql
   ===================================================================== */

App.dangKyPhanHe({
  id: 'quan_tri', ten: 'Quản trị', thuTu: 1000, moDun: 'nen_tang', mau: '#5c6670', icon: 'nguoidung',
  mo: 'Học sinh – lớp – điểm trường, tài khoản & phân quyền, cấu hình, sao lưu'
});
App.icon('caidat', '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');
App.icon('dulieu', '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>');

App.dangKyTrang({ id: 'qt-hoc-sinh', phanHe: 'quan_tri', ten: 'Học sinh', icon: 'hocsinh', thuTu: 1,
  quyen: ['hs.quan_ly'], ve: veHocSinh });
App.dangKyTrang({ id: 'qt-tai-khoan', phanHe: 'quan_tri', ten: 'Tài khoản', icon: 'nguoidung', thuTu: 2,
  quyen: () => App.laQuanTri(), ve: veTaiKhoan,
  huyHieu: async () => S.nd.filter(u => u.chuc_vu === 'cho_duyet').length });   // số tài khoản chờ duyệt
App.dangKyTrang({ id: 'qt-cau-hinh', phanHe: 'quan_tri', ten: 'Cấu hình', icon: 'caidat', thuTu: 3,
  quyen: () => App.laQuanTri(), ve: veCauHinh });
App.dangKyTrang({ id: 'qt-du-lieu', phanHe: 'quan_tri', ten: 'Dữ liệu', icon: 'dulieu', thuTu: 4,
  quyen: () => App.laQuanTri(), ve: veDuLieu });
