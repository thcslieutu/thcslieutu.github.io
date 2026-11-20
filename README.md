# Ứng dụng quản lý nhà trường – Trường THCS Liêu Tú

Ứng dụng web chạy trên **GitHub Pages**, dữ liệu lưu trên **Supabase**.
Viết bằng **HTML + CSS + JavaScript thuần**: không cần cài đặt hay build, chỉ cần tải file lên là chạy.

Tác giả: **Lâm Hòa Văn** – SĐT 0977.364.202 – Giáo viên Trường THCS Liêu Tú.

## Cấu trúc: nền tảng + các phân hệ

Ứng dụng gồm một **nền tảng** dùng chung và nhiều **phân hệ**. Mỗi phân hệ nằm riêng:
- 1 file SQL trong `supabase/`;
- 1 thư mục JS trong `js/mo-dun/`;
- (nếu cần) 1 file CSS trong `css/mo-dun/`.

Thêm chức năng mới = thêm một phân hệ, **không phải sửa phần đã có**. Xem `HUONG-DAN-THEM-PHAN-HE.md`.

```
index.html                      Khung trang + danh sách file của các phân hệ
js/config.js                    Địa chỉ Supabase, tên trường, logo, tác giả
js/nen-tang/                    NỀN TẢNG
  tien-ich.js                     ngày giờ, định dạng, thông báo, hộp thoại, xuất CSV
  giao-dien.js                    chụp ảnh trang, in/PDF, khoảng thống kê, biểu đồ
  ung-dung.js                     đăng nhập, phân quyền, dữ liệu chung, menu, chọn phân hệ
js/mo-dun/vi-pham/              PHÂN HỆ VI PHẠM
js/mo-dun/chuyen-can/           PHÂN HỆ CHUYÊN CẦN
js/mo-dun/dang-vien/            PHÂN HỆ ĐẢNG VIÊN
js/mo-dun/quan-tri/             PHÂN HỆ QUẢN TRỊ (học sinh, tài khoản, cấu hình, dữ liệu)
js/khoi-dong.js                 Khởi động (luôn nạp cuối cùng)
css/nen-tang.css, css/mo-dun/   Giao diện
supabase/00-nen-tang.sql        Cơ sở dữ liệu nền tảng (chạy đầu tiên)
supabase/10-vi-pham.sql         … phân hệ Vi phạm
supabase/20-chuyen-can.sql      … phân hệ Chuyên cần (cần Vi phạm)
supabase/30-dang-vien.sql       … phân hệ Đảng viên
```

## Các phân hệ

Sau khi đăng nhập, người dùng chọn **phân hệ**; menu chỉ hiện các mục của phân hệ đó. Người chỉ có một phân hệ được vào thẳng.

| Phân hệ | Mục | Nội dung |
|---|---|---|
| **Vi phạm** | Nhập vi phạm, Xử lý, Thống kê, Danh mục | Ghi vi phạm cho học sinh hoặc cả lớp, chọn ngày giờ. Chống ghi trùng trong buổi. Xử lý theo quyền, có thể xử lý hàng loạt. Thống kê có so sánh kỳ trước, theo lớp / học sinh / loại / điểm trường. Danh mục gồm hình thức vi phạm và biện pháp xử lý. |
| **Chuyên cần** | Ghi nhận vắng, Báo cáo chuyên cần | Ghi học sinh vắng có phép, không phép, cúp tiết (mỗi buổi một lần). Báo cáo theo buổi hoặc theo khoảng thời gian. Đánh dấu lớp nghỉ. |
| **Đảng viên** | Khảo sát của tôi, Quản lý đợt, Tổng hợp | Đảng viên nộp 1–3 ảnh minh chứng cho mỗi đợt khảo sát. Người quản lý xem ai chưa nộp, sao chép danh sách gửi Zalo, xem ảnh ngay trên phần mềm, xuất CSV, dọn ảnh. |
| **Quản trị** | Học sinh, Tài khoản, Cấu hình, Dữ liệu | Quản lý điểm trường – lớp – học sinh (nhập từ Excel). Duyệt tài khoản và phân quyền. Sửa thông số. Sao lưu CSV, xóa dữ liệu. |

## Chức vụ và quyền

Mỗi tài khoản có một **chức vụ** (Giáo viên, Tổng phụ trách, Nhân viên, Ban giám hiệu, Quản trị) và các **quyền** tick theo từng phân hệ (Quản trị → Tài khoản).

- Khi duyệt tài khoản, chọn chức vụ thì các quyền thường dùng được tick sẵn. Có thể tick thêm hoặc bỏ bớt.
- **Quản trị** có mọi quyền, trừ quyền dạng “thành viên” (*Là đảng viên*) phải tick riêng.
- **GV chủ nhiệm** không cần quyền riêng: người có quyền *Ghi nhận vi phạm* được gán làm GVCN một lớp (Quản trị → Học sinh → Sửa lớp) thì tự được xử lý vi phạm Nhẹ, Trung bình của lớp đó.
- Quyền *Xử lý vi phạm* có thể giới hạn theo điểm trường (nút **Sửa** dưới ô quyền).

| Quyền | Phân hệ | Mặc định cho |
|---|---|---|
| Ghi nhận vi phạm | Vi phạm | GV, TPT, BGH |
| Xử lý vi phạm (Nhẹ, TB) | Vi phạm | TPT |
| Xử lý mọi vi phạm (kể cả Nặng, sửa/xóa) | Vi phạm | BGH |
| Sửa hình thức vi phạm | Vi phạm | BGH |
| Sửa biện pháp xử lý | Vi phạm | (chỉ Quản trị) |
| Dùng phân hệ Chuyên cần | Chuyên cần | GV, TPT, BGH |
| Là đảng viên | Đảng viên | tick riêng |
| Quản lý khảo sát | Đảng viên | (chỉ Quản trị) |
| Quản lý học sinh | Quản trị | BGH |

Mọi quyền được kiểm tra **trên máy chủ** (Row Level Security), không chỉ ẩn nút trên giao diện. Nhân viên chỉ có quyền Đảng viên thì không xem được dữ liệu học sinh.

## Cài đặt (khoảng 15 phút)

### Bước 1 – Tạo cơ sở dữ liệu
1. <https://supabase.com> → **New project** (gói Free, Region: Singapore).
2. **SQL Editor** → **New query** → dán và **Run** lần lượt từng file, **đúng thứ tự**:
   `00-nen-tang.sql` → `10-vi-pham.sql` → `20-chuyen-can.sql` → `30-dang-vien.sql`.
   Mỗi file chạy xong hiện dòng “Đã cài …”. Chạy lại nhiều lần vẫn an toàn. Có lỗi thì file tự hủy, không thay đổi gì.
3. **Project Settings → API**: chép **Project URL** và khóa **anon public** (hoặc *publishable key*).

### Bước 2 – Cấu hình
Mở `js/config.js`, điền `SUPABASE_URL`, `SUPABASE_ANON_KEY`, tên trường. Logo (không bắt buộc): tải ảnh vào thư mục `img/`, ghi `LOGO: 'img/logo.png'`.

### Bước 3 – Đưa lên GitHub Pages
Repository → **Add file → Upload files** → kéo thả toàn bộ nội dung thư mục (giữ nguyên các thư mục con) → Commit → **Settings → Pages** → `main`, `/ (root)`.

Nên thử trước ở một repository riêng (ví dụ `thu-nghiem` → `https://thcslieutu.github.io/thu-nghiem/`) với một dự án Supabase riêng.

### Bước 4 – Liên kết trong email (tránh trỏ về localhost)
Supabase → **Authentication → URL Configuration**:
- **Site URL**: địa chỉ trang (vd `https://thcslieutu.github.io`).
- **Redirect URLs**: thêm `https://thcslieutu.github.io/**`.

### Bước 5 – Sử dụng lần đầu
1. Mở trang → **Đăng ký**. **Tài khoản đầu tiên tự động là Quản trị.**
2. Quản trị → **Học sinh**: thêm điểm trường (nếu có), lớp, **Nhập từ Excel** danh sách 2 cột Họ tên – Lớp.
3. Vi phạm → **Danh mục**: chỉnh hình thức vi phạm cho đúng nội quy (đã có sẵn mẫu, gồm 3 loại chuyên cần).
4. Giáo viên, nhân viên tự đăng ký → Quản trị → **Tài khoản**: chọn chức vụ, kiểm tra quyền, **Lưu**.
5. Quản trị → **Cấu hình**: mốc học kỳ, số giờ được tự hủy vi phạm, số ngày được ghi lùi.

## Mật khẩu
- **Đổi mật khẩu**: nút **Mật khẩu** trên thanh trên cùng.
- **Quên mật khẩu**: màn hình đăng nhập → **Quên mật khẩu?** → mở email, bấm liên kết.
- Quản trị có thể bấm **Đặt lại MK** cạnh từng tài khoản.
- Dịch vụ email có sẵn của Supabase gửi được rất ít email mỗi giờ. Cần nhiều thì cấu hình SMTP riêng (Authentication → Emails → SMTP Settings).

## Lưu ý
- Mỗi vi phạm lưu **lớp và điểm trừ tại thời điểm ghi**. Chuyển lớp hay đổi thang điểm không làm thay đổi số liệu cũ.
- Xóa lớp / học sinh sẽ xóa kèm dữ liệu liên quan (vi phạm, vắng…). Phần mềm báo trước số lượng và yêu cầu xác nhận. Học sinh nghỉ học nên **Đánh dấu đã nghỉ** thay vì xóa.
- Supabase gói Free có thể tạm dừng nếu lâu không truy cập (nhất là dịp hè). Vào Dashboard bấm *Restore*. Nên sao lưu CSV định kỳ (Quản trị → Dữ liệu).
- Ảnh minh chứng: gói Free có 1 GB. Mỗi ảnh sau khi nén khoảng 100–300 KB. Có thể **Dọn ảnh** các đợt cũ.
