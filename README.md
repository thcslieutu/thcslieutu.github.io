# Phần mềm Quản lý vi phạm học sinh

Ứng dụng web chạy trên **GitHub Pages**, dữ liệu lưu trên **Supabase**.
Viết bằng **HTML + CSS + JavaScript thuần** (không cần cài đặt hay build) — chỉ cần tải file lên là chạy.

## Chức năng

| Mục | Ai dùng | Nội dung |
|---|---|---|
| **Nhập vi phạm** | GV, BGH | Chọn lớp → bấm chọn một hoặc nhiều học sinh → bấm hình thức vi phạm → **Ghi nhận**. Ngày giờ do máy chủ ghi tự động. Gõ tên + Enter để chọn nhanh; “Tìm toàn trường” để tìm không cần chọn lớp. Hủy được trong 15 phút nếu ghi nhầm. |
| **Xử lý** | BGH cập nhật, GV xem | Lọc theo trạng thái (Chưa / Đang / Đã xử lý), lớp, ngày, tên. Chọn nhiều dòng để xử lý hàng loạt, chọn biện pháp mẫu. Xuất Excel (CSV). |
| **Thống kê** | Tất cả | Tổng vi phạm, số HS vi phạm, điểm trừ, tỷ lệ đã xử lý — **so sánh tăng/giảm** với kỳ trước cùng độ dài. Biểu đồ diễn biến, theo hình thức, theo lớp; bảng xếp hạng lớp và học sinh vi phạm nhiều; bấm tên HS xem lịch sử. |
| **Học sinh** | BGH | Thêm/đổi tên/xóa lớp; thêm, sửa, chuyển lớp, đánh dấu nghỉ học; **dán danh sách từ Excel** (cột Họ tên, Lớp). |
| **Hình thức VP** | BGH | Danh mục vi phạm: nhóm, mức độ, điểm trừ, bật/tắt. |
| **Tài khoản** | Quản trị | Duyệt giáo viên đăng ký, cấp quyền GV / BGH / Quản trị. |

## Cài đặt (khoảng 15 phút)

### Bước 1 – Tạo cơ sở dữ liệu Supabase
1. Vào <https://supabase.com> → đăng nhập → **New project** (gói Free là đủ). Chọn Region gần Việt Nam (Singapore).
2. Mở **SQL Editor** → **New query** → dán toàn bộ nội dung file `supabase/schema.sql` → **Run**.
3. Vào **Authentication → Sign In / Providers → Email**: nên **tắt “Confirm email”** để giáo viên đăng ký xong dùng được ngay (nếu bật, giáo viên phải bấm link xác nhận trong email).
4. Vào **Project Settings → API**, chép **Project URL** và khóa **anon public** (hoặc *publishable key*).

### Bước 2 – Cấu hình
Mở `js/config.js`, điền `SUPABASE_URL`, `SUPABASE_ANON_KEY`, tên trường. Khóa anon được phép để công khai: dữ liệu đã được bảo vệ bằng Row Level Security, người chưa đăng nhập hoặc chưa được duyệt không đọc được gì.

### Bước 3 – Đưa lên GitHub Pages
1. Tạo repository mới trên GitHub (ví dụ `quan-ly-vi-pham`).
2. **Add file → Upload files**: kéo thả toàn bộ nội dung thư mục này (index.html, css/, js/, …) → Commit.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch `main`, thư mục `/ (root)` → Save.
4. Sau 1–2 phút trang chạy tại `https://<tên-github>.github.io/quan-ly-vi-pham/`.
5. (Nếu bật xác nhận email) Supabase → **Authentication → URL Configuration** → đặt *Site URL* là địa chỉ trên.

### Bước 4 – Sử dụng lần đầu
1. Mở trang → **Đăng ký**. **Tài khoản đầu tiên tự động là Quản trị.**
2. Vào **Học sinh → Nhập từ Excel**, dán danh sách 2 cột Họ tên – Lớp.
3. Vào **Hình thức VP** chỉnh danh mục cho đúng nội quy trường.
4. Giáo viên tự đăng ký → Quản trị vào **Tài khoản** cấp quyền Giáo viên hoặc Ban giám hiệu.

## Phân quyền
- **Chờ duyệt**: chưa xem được dữ liệu.
- **Giáo viên**: nhập vi phạm, xem danh sách xử lý và thống kê.
- **Ban giám hiệu**: thêm quyền xử lý vi phạm, quản lý lớp/học sinh/hình thức vi phạm.
- **Quản trị**: thêm quyền cấp tài khoản.

Quyền được kiểm tra trên máy chủ (RLS trong `schema.sql`), không chỉ ẩn nút trên giao diện. Muốn cho giáo viên chủ nhiệm cũng được xử lý, sửa hàm `la_bgh()` hoặc chính sách `vp_sua` trong SQL.

## Lưu ý
- Thời gian vi phạm được máy chủ ghi (`now()`), không thể sửa từ trình duyệt.
- Dự án Supabase gói Free có thể bị tạm dừng nếu lâu không có truy cập; vào Dashboard bấm *Restore* để chạy lại. Nên định kỳ xuất CSV để lưu trữ.
- Mốc học kỳ dùng cho thống kê chỉnh trong `js/config.js`.

## Cấu trúc thư mục
```
index.html          Giao diện chính
css/style.css       Định dạng (hỗ trợ điện thoại)
js/config.js        Cấu hình Supabase, tên trường
js/app.js           Toàn bộ chức năng
supabase/schema.sql Tạo bảng, phân quyền, dữ liệu mẫu
```
