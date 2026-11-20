// =============================================================
//  CẤU HÌNH – chỉ cần sửa file này
//  Lấy 2 giá trị dưới trong Supabase: Project Settings → API
//  (Project URL và khóa "anon public" / "publishable").
//  Khóa anon được phép công khai; dữ liệu được bảo vệ bằng phân quyền (RLS) trên máy chủ.
//
//  Các thông số khác (giờ được hủy vi phạm, số ngày được lùi, mốc học kỳ…)
//  Quản trị sửa ngay trong phần mềm: phân hệ Quản trị → Cấu hình.
// =============================================================
window.APP_CONFIG = {
  SUPABASE_URL: 'https://etbajyyevkafprnktpje.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_gGPvuf4D3O029aWNim1obw_1biFNEjI',

  TEN_TRUONG: 'Trường THCS Liêu Tú',
  TEN_UNG_DUNG: 'Ứng dụng quản lý nhà trường',

  // Logo trường (tab trình duyệt, trang đăng nhập, thanh menu, màn hình chính điện thoại).
  // Tải ảnh vuông (PNG/JPG/SVG, nên 512×512) vào thư mục img/ rồi ghi đường dẫn, vd: 'img/logo.png'.
  // Để trống '' thì dùng biểu tượng ✓ mặc định.
  LOGO: '',

  // Thông tin tác giả (hiện ở chân trang trên máy tính). Để trống TAC_GIA: '' thì ẩn chân trang.
  TAC_GIA: 'Lâm Hòa Văn',
  TAC_GIA_SDT: '0977.364.202',
  TAC_GIA_DON_VI: 'Giáo viên Trường THCS Liêu Tú'
};
