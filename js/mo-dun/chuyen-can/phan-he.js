'use strict';
/* =====================================================================
   PHÂN HỆ CHUYÊN CẦN – KHAI BÁO VỚI NỀN TẢNG
   Cần phân hệ Vi phạm (học sinh vắng được ghi bằng các hình thức vi phạm có đánh dấu "Chuyên cần").
   Cơ sở dữ liệu: supabase/20-chuyen-can.sql
   ===================================================================== */

App.dangKyPhanHe({
  id: 'chuyen_can', ten: 'Chuyên cần', thuTu: 20, moDun: ['vi_pham', 'chuyen_can'], mau: '#1d8a4c', icon: 'chuyencan',
  mo: 'Ghi nhận học sinh vắng, cúp tiết; báo cáo chuyên cần theo buổi; đánh dấu lớp nghỉ'
});

App.dangKyTrang({ id: 'cc-ghi-vang', phanHe: 'chuyen_can', ten: 'Ghi nhận vắng', icon: 'ghivang', thuTu: 1,
  quyen: ['cc.su_dung'], ve: el => veNhapVP(el, true) });

App.dangKyTrang({ id: 'cc-bao-cao', phanHe: 'chuyen_can', ten: 'Báo cáo chuyên cần', icon: 'chuyencan', thuTu: 2,
  quyen: ['cc.su_dung'], ve: veChuyenCan });
