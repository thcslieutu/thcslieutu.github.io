'use strict';
/* =====================================================================
   PHÂN HỆ ĐẢNG VIÊN – KHAI BÁO VỚI NỀN TẢNG
   Cơ sở dữ liệu: supabase/30-dang-vien.sql
   ===================================================================== */

App.dangKyPhanHe({
  id: 'dang_vien', ten: 'Đảng viên', thuTu: 30, moDun: 'dang_vien', mau: '#c93c3c', icon: 'dangvien',
  mo: 'Khảo sát theo đợt, nộp ảnh minh chứng, theo dõi hoàn thành'
});
App.icon('tonghop', '<path d="M3 3h18v4H3z"/><path d="M3 10h18v4H3z"/><path d="M3 17h18v4H3z"/>');

App.dangKyTrang({ id: 'dv-cua-toi', phanHe: 'dang_vien', ten: 'Khảo sát của tôi', icon: 'dangvien', thuTu: 1,
  quyen: ['dv.dang_vien'], ve: el => veDangVien(el, 'cua_toi'), huyHieu: demDotChuaNop });

App.dangKyTrang({ id: 'dv-quan-ly', phanHe: 'dang_vien', ten: 'Quản lý đợt', icon: 'xuly', thuTu: 2,
  quyen: ['dv.quan_ly'], ve: el => veDangVien(el, 'quan_ly') });

App.dangKyTrang({ id: 'dv-tong-hop', phanHe: 'dang_vien', ten: 'Tổng hợp', icon: 'thongke', thuTu: 3,
  quyen: ['dv.quan_ly'], ve: el => veDangVien(el, 'tong_hop') });
