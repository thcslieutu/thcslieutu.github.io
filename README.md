# Phần mềm Quản lý vi phạm học sinh (phiên bản 2)

Ứng dụng web chạy trên **GitHub Pages**, dữ liệu lưu trên **Supabase**.
Viết bằng **HTML + CSS + JavaScript thuần** (không cần cài đặt hay build) — chỉ cần tải file lên là chạy.

Tác giả: **Lâm Hòa Văn** – SĐT 0977.364.202 – Giáo viên Trường THCS Liêu Tú.

## Chức năng

| Mục | Ai dùng | Nội dung |
|---|---|---|
| **Nhập vi phạm** | Mọi người | Chọn lớp → (chọn học sinh) → chọn vi phạm → **Ghi nhận**. Chưa chọn học sinh: chỉ chọn được **vi phạm của lớp** (ghi cho cả lớp). Đã chọn học sinh: chỉ chọn được **vi phạm của học sinh**. Có thể chọn **ngày giờ vi phạm**; để trống = giờ hiện tại. Hủy được trong 15 phút. |
| **Xử lý** | GVCN, TPT, BGH xử lý; GV xem | Lọc theo trạng thái, điểm trường, lớp, mức độ, ngày, tên. Xử lý hàng loạt, xuất CSV. |
| **Thống kê** | Mọi người | Mặc định **Tuần này so với Tuần trước** (có tháng, học kỳ, năm, tùy chọn). Phạm vi toàn trường / điểm trường / lớp. Biểu đồ diễn biến, hình thức, nhóm, mức độ, tình trạng xử lý, thứ trong tuần × buổi, điểm trường, lớp; mục “Cần chú ý”; bảng lớp, học sinh, người ghi nhận. |
| **Học sinh** | BGH | Điểm trường (không bắt buộc); lớp (điểm trường, GVCN); học sinh; dán danh sách từ Excel. |
| **Hình thức VP** | BGH | Danh mục hình thức vi phạm (áp dụng cho học sinh / cả lớp, nhóm, mức độ, điểm trừ, bật/tắt) và danh mục **biện pháp xử lý** (tên, nhóm, thứ tự, bật/tắt – **chỉ Quản trị** được sửa, BGH chỉ xem). |
| **Tài khoản** | Quản trị | Duyệt giáo viên đăng ký, cấp vai trò, gán lớp chủ nhiệm, gán một hoặc nhiều điểm trường cho Tổng phụ trách. |

## Phân quyền

| Vai trò | Quyền |
|---|---|
| Chờ duyệt | Chưa xem được dữ liệu |
| Giáo viên | Ghi nhận vi phạm, xem danh sách và thống kê |
| GV chủ nhiệm | + Xử lý vi phạm mức **Nhẹ, Trung bình** của lớp mình chủ nhiệm |
| Tổng phụ trách | + Xử lý vi phạm mức **Nhẹ, Trung bình** của các điểm trường được giao (giao được nhiều điểm; không giao = toàn trường) |
| Ban giám hiệu | Xử lý mọi vi phạm, **kể cả mức Nặng**; quản lý điểm trường, lớp, học sinh, hình thức vi phạm |
| Quản trị | Toàn quyền, thêm cấp quyền tài khoản |

Quyền được kiểm tra trên máy chủ (RLS và hàm `co_the_xu_ly()` trong `schema.sql`), không chỉ ẩn nút trên giao diện.

## Nâng cấp từ phiên bản 1 (đang có dữ liệu)

1. Supabase → **SQL Editor** → **New query** → dán toàn bộ `supabase/schema.sql` mới → **Run**. Dữ liệu cũ được giữ nguyên; mỗi vi phạm cũ được gán lớp hiện tại của học sinh.
2. Tải các file mới lên GitHub (ghi đè `index.html`, `css/`, `js/`, `supabase/`, `README.md`).
3. Làm bước **Sửa liên kết xác nhận email** bên dưới.
4. Vào **Tài khoản** cấp lại vai trò GV chủ nhiệm / Tổng phụ trách, gán lớp chủ nhiệm.

## Cài mới (khoảng 15 phút)

### Bước 1 – Tạo cơ sở dữ liệu Supabase
1. Vào <https://supabase.com> → **New project** (gói Free là đủ, Region: Singapore).
2. **SQL Editor** → **New query** → dán toàn bộ `supabase/schema.sql` → **Run**.
3. **Project Settings → API**: chép **Project URL** và khóa **anon public** (hoặc *publishable key*).

### Bước 2 – Cấu hình
Mở `js/config.js`, điền `SUPABASE_URL`, `SUPABASE_ANON_KEY`, tên trường.

### Bước 3 – Đưa lên GitHub Pages
1. Repository tên `<tên-github>.github.io` (ví dụ `thcslieutu.github.io`) → trang chạy ở `https://thcslieutu.github.io/`.
   Repository tên khác (ví dụ `quan-ly-vi-pham`) → trang chạy ở `https://<tên-github>.github.io/quan-ly-vi-pham/`.
2. **Add file → Upload files** → kéo thả toàn bộ nội dung thư mục → Commit.
3. **Settings → Pages** → *Deploy from a branch* → `main`, `/ (root)` → Save.

### Bước 4 – Sửa liên kết xác nhận email (tránh trỏ về localhost)
Mặc định Supabase đặt *Site URL* là `http://localhost:3000`, nên link trong email xác nhận trỏ về localhost. Cách sửa:

1. Supabase → **Authentication → URL Configuration**.
2. **Site URL**: `https://thcslieutu.github.io` → **Save**.
3. **Redirect URLs** → **Add URL**: `https://thcslieutu.github.io/**` → **Save**.

Phần mềm cũng tự gửi kèm địa chỉ trang hiện tại khi đăng ký (`emailRedirectTo`), nhưng Supabase chỉ chấp nhận địa chỉ có trong danh sách Redirect URLs, nên bước trên là bắt buộc. Người đã nhận email cũ (link localhost) cần **đăng ký lại** hoặc nhờ Quản trị xác nhận tay: Supabase → **Authentication → Users** → chọn người dùng → *Confirm email*.

(Nếu muốn giáo viên đăng ký xong dùng ngay, không cần xác nhận email: **Authentication → Sign In / Providers → Email** → tắt *Confirm email*.)

### Bước 5 – Sử dụng lần đầu
1. Mở trang → **Đăng ký**. **Tài khoản đầu tiên tự động là Quản trị.**
2. **Học sinh**: thêm điểm trường (nếu có), lớp, rồi **Nhập từ Excel** danh sách 2 cột Họ tên – Lớp.
3. **Hình thức VP**: chỉnh danh mục cho đúng nội quy trường.
4. Giáo viên tự đăng ký → Quản trị vào **Tài khoản** cấp vai trò, gán lớp chủ nhiệm.

## Mật khẩu
- **Đổi mật khẩu**: bấm nút **Mật khẩu** trên thanh trên cùng (cần nhập mật khẩu hiện tại; có thể đăng xuất khỏi các thiết bị khác).
- **Quên mật khẩu**: ở màn hình đăng nhập bấm **Quên mật khẩu?** → nhập email → mở email, bấm liên kết → đặt mật khẩu mới.
- **Quản trị** có thể bấm **Gửi link đặt lại MK** cạnh tài khoản giáo viên trong mục Tài khoản.
- Liên kết trong email chỉ hoạt động khi đã làm **Bước 4 – Redirect URLs** ở trên.
- Dịch vụ email có sẵn của Supabase chỉ gửi được rất ít email mỗi giờ. Nếu nhiều giáo viên cùng cần, nên cấu hình SMTP riêng: Supabase → **Authentication → Emails → SMTP Settings**.
- Mật khẩu mới cần ít nhất 8 ký tự. Muốn máy chủ cũng bắt buộc như vậy: **Authentication → Sign In / Providers → Email → Minimum password length** = 8.

## Lưu ý
- Giáo viên được chọn ngày giờ vi phạm lùi tối đa **7 ngày** (BGH, Quản trị không giới hạn). Đổi con số ở `so_ngay_lui` trong `schema.sql` và `SO_NGAY_DUOC_LUI` trong `js/config.js`.
- Thời điểm bấm Ghi nhận luôn do máy chủ ghi (`tao_luc`), không sửa được từ trình duyệt.
- Mỗi vi phạm lưu **lớp tại thời điểm ghi**: chuyển lớp cho học sinh không làm thay đổi thống kê cũ.
- Không xóa được lớp còn học sinh, lớp/học sinh đã có vi phạm. Học sinh nghỉ học hãy bỏ chọn “Đang học”.
- Dự án Supabase gói Free có thể bị tạm dừng nếu lâu không truy cập (nhất là dịp hè); vào Dashboard bấm *Restore*. Nên định kỳ xuất CSV để lưu trữ.

## Cấu trúc thư mục
```
index.html          Giao diện chính
css/style.css       Định dạng (hỗ trợ điện thoại)
js/config.js        Cấu hình Supabase, tên trường, mốc học kỳ
js/app.js           Toàn bộ chức năng
supabase/schema.sql Tạo bảng / nâng cấp, phân quyền, dữ liệu mẫu
```