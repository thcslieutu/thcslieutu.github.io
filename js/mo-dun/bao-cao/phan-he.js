'use strict';
/* =====================================================================
   PHÂN HỆ BÁO CÁO – KHAI BÁO VỚI NỀN TẢNG
   Cơ sở dữ liệu: supabase/30-bao-cao.sql
   ===================================================================== */

App.dangKyPhanHe({
  id: 'bao_cao', ten: 'Báo cáo', thuTu: 30, moDun: 'bao_cao', mau: '#7a5bc4', icon: 'baocao',
  mo: 'Nộp báo cáo, minh chứng theo đợt; giao báo cáo theo nhóm, nhận xét, tổng hợp'
});
App.icon('baocao', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/>');

// Mọi tài khoản đã duyệt đều có thể được giao báo cáo
App.dangKyTrang({ id: 'bc-cua-toi', phanHe: 'bao_cao', ten: 'Báo cáo của tôi', icon: 'baocao', thuTu: 1,
  quyen: () => chucVu() !== 'cho_duyet', ve: el => veBaoCao(el, 'cua_toi'), huyHieu: demViecBaoCao });

App.dangKyTrang({ id: 'bc-quan-ly', phanHe: 'bao_cao', ten: 'Quản lý đợt', icon: 'xuly', thuTu: 2,
  quyen: ['bc.quan_ly', 'bc.xem_tat_ca'], ve: el => veBaoCao(el, 'quan_ly') });

App.dangKyTrang({ id: 'bc-tong-hop', phanHe: 'bao_cao', ten: 'Tổng hợp', icon: 'thongke', thuTu: 3,
  quyen: ['bc.quan_ly', 'bc.xem_tat_ca'], ve: el => veBaoCao(el, 'tong_hop') });
