// =============================================================
//  CẤU HÌNH – chỉ cần sửa file này
//  Lấy 2 giá trị dưới trong Supabase: Project Settings → API
//  (Project URL và khóa "anon public" / "publishable").
//  Khóa anon được phép công khai; dữ liệu được bảo vệ bằng RLS.
// =============================================================
window.APP_CONFIG = {
  SUPABASE_URL: 'https://axodppkfmjjpxmsqafvf.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_enbD2CQEpPYrnTs0dXuEKA_d-P66sJH',
  TEN_TRUONG: 'Trường THCS Liêu Tú',
  LOGO: 'img/logo.png',

  // Năm học: ngày bắt đầu học kỳ (tháng-ngày), dùng cho thống kê
  HK1_BAT_DAU: '09-07',
  HK2_BAT_DAU: '01-18',
  NAM_HOC_KET_THUC: '05-31',

  // Người ghi được tự hủy vi phạm vừa nhập trong bao nhiêu phút (khớp với schema.sql)
  PHUT_DUOC_HUY: 15,

  // Giáo viên được chọn ngày giờ vi phạm lùi về trước tối đa bao nhiêu ngày
  // (BGH, Quản trị không giới hạn). Khớp với "so_ngay_lui" trong schema.sql
  SO_NGAY_DUOC_LUI: 7,

  // Thông tin tác giả (hiện ở chân trang trên máy tính)
  TAC_GIA: 'Lâm Hòa Văn',
  TAC_GIA_SDT: '0977.364.202',
  TAC_GIA_DON_VI: 'Giáo viên Trường THCS Liêu Tú - Xã Liêu Tú'
};
