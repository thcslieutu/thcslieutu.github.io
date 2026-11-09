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

  // Năm học: ngày bắt đầu học kỳ (tháng-ngày), dùng cho thống kê
  HK1_BAT_DAU: '09-01',
  HK2_BAT_DAU: '01-16',
  NAM_HOC_KET_THUC: '05-31',

  // Người ghi được tự hủy vi phạm vừa nhập trong bao nhiêu phút (khớp với schema.sql)
  PHUT_DUOC_HUY: 15
};
