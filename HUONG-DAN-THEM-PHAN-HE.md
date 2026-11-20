# Hướng dẫn thêm một phân hệ mới

Ví dụ: thêm phân hệ **“Lịch công tác”** (mã `lich_cong_tac`, tiền tố bảng `lct_`, tiền tố quyền `lct.`).
Chỉ thêm file mới và vài dòng trong `index.html`. **Không sửa các phân hệ đã có.**

## 1. File SQL: `supabase/40-lich-cong-tac.sql`

Quy ước:
- Đặt số thứ tự lớn hơn các file trước (40, 50…).
- Tên bảng có **tiền tố riêng** (`lct_…`).
- Chạy lại nhiều lần vẫn an toàn (`create table if not exists`, `drop policy if exists`, `on conflict`).

```sql
begin;
do $$ begin
  if to_regclass('public.quyen') is null then
    raise exception 'Chưa cài nền tảng: hãy chạy file 00-nen-tang.sql trước.';
  end if;
end $$;

-- 1. Bảng
create table if not exists public.lct_su_kien (
  id        bigint generated always as identity primary key,
  ngay      date not null,
  noi_dung  text not null,
  tao_boi   uuid references public.nguoi_dung(id) on delete set null default auth.uid(),
  tao_luc   timestamptz not null default now()
);

-- 2. Bảo mật: dùng hàm co_quyen('mã quyền') của nền tảng
alter table public.lct_su_kien enable row level security;
drop policy if exists lct_doc on public.lct_su_kien;
drop policy if exists lct_ghi on public.lct_su_kien;
create policy lct_doc on public.lct_su_kien for select to authenticated using (public.co_quyen('lct.xem'));
create policy lct_ghi on public.lct_su_kien for all to authenticated
  using (public.co_quyen('lct.sua')) with check (public.co_quyen('lct.sua'));
grant select, insert, update, delete on public.lct_su_kien to authenticated;

-- 3. Khai báo quyền → tự hiện thành cột trong Quản trị → Tài khoản
--    mac_dinh: chức vụ được tick sẵn (giao_vien, tong_phu_trach, nhan_vien, bgh)
--    xem_hoc_sinh: quyền này có cần đọc danh sách lớp, học sinh không
insert into public.quyen (ma, phan_he, ten, mo_ta, thu_tu, mac_dinh, xem_hoc_sinh) values
  ('lct.xem', 'lich_cong_tac', 'Xem lịch công tác', 'Xem lịch tuần của trường.', 1, '{giao_vien,tong_phu_trach,nhan_vien,bgh}', false),
  ('lct.sua', 'lich_cong_tac', 'Soạn lịch công tác', 'Thêm, sửa, xóa lịch.',      2, '{bgh}', false)
on conflict (ma) do update set phan_he = excluded.phan_he, ten = excluded.ten, mo_ta = excluded.mo_ta,
  thu_tu = excluded.thu_tu, mac_dinh = excluded.mac_dinh, xem_hoc_sinh = excluded.xem_hoc_sinh;

-- 4. (Không bắt buộc) Cấu hình → tự hiện trong Quản trị → Cấu hình
insert into public.cau_hinh (khoa, gia_tri, ten, mo_ta, kieu, phan_he, thu_tu) values
  ('lct.so_tuan_hien', '2', 'Số tuần hiển thị', 'Hiện lịch bao nhiêu tuần tới.', 'so', 'lich_cong_tac', 1)
on conflict (khoa) do update set ten = excluded.ten, mo_ta = excluded.mo_ta;

-- 5. Ghi nhận đã cài (phân hệ chỉ hiện khi có dòng này)
insert into public.mo_dun (ma, ten, phien_ban) values ('lich_cong_tac', 'Lịch công tác', 1)
on conflict (ma) do update set ten = excluded.ten, phien_ban = excluded.phien_ban, cai_luc = now();
commit;
select 'Đã cài phân hệ LỊCH CÔNG TÁC.' as ket_qua;
```

## 2. Thư mục JS: `js/mo-dun/lich-cong-tac/`

`lich.js` – nội dung các trang:

```js
'use strict';
async function veLichCongTac(el) {
  const conSong = giuPhien();                 // chống lỗi khi người dùng chuyển trang nhanh
  el.innerHTML = `<section class="card"><h2>Lịch công tác</h2><div id="lct-ds">Đang tải…</div></section>`;
  const { data, error } = await sb.from('lct_su_kien').select('*').order('ngay');
  if (!conSong()) return;
  if (error) { $('#lct-ds').innerHTML = `<p class="err">${esc(dichLoi(error))}</p>`; return; }
  $('#lct-ds').innerHTML = data.map(r => `<p><b>${vn(r.ngay)}</b> – ${esc(r.noi_dung)}</p>`).join('') || 'Chưa có lịch.';
  // Nút chỉ hiện với người có quyền; máy chủ vẫn kiểm tra lại
  if (App.coQuyen('lct.sua')) { /* … thêm nút Thêm / Sửa … */ }
}
```

`phan-he.js` – khai báo với nền tảng:

```js
'use strict';
App.dangKyPhanHe({
  id: 'lich_cong_tac', ten: 'Lịch công tác', thuTu: 40, moDun: 'lich_cong_tac',
  mau: '#7a5bc4', icon: 'lich', mo: 'Lịch công tác tuần của nhà trường'
});
App.icon('lich', '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>');
App.dangKyTrang({
  id: 'lct-lich', phanHe: 'lich_cong_tac', ten: 'Lịch tuần', icon: 'lich', thuTu: 1,
  quyen: ['lct.xem', 'lct.sua'],                 // có một trong các quyền này thì thấy trang
  ve: veLichCongTac
  // huyHieu: async () => số việc cần làm (hiện chấm đỏ trên menu và ô phân hệ)
});
```

## 3. Thêm vào `index.html` (trước dòng `js/khoi-dong.js`)

```html
  <!-- Phân hệ Lịch công tác -->
  <script src="js/mo-dun/lich-cong-tac/lich.js"></script>
  <script src="js/mo-dun/lich-cong-tac/phan-he.js"></script>
```

CSS riêng (nếu có): `css/mo-dun/lich-cong-tac.css` và thêm một dòng `<link>` trong `<head>`.

## 4. Cài đặt
1. Chạy file SQL trên Supabase (thử trên CSDL thử trước).
2. Tải thư mục JS mới và `index.html` lên GitHub.
3. Quản trị → Tài khoản: tick quyền mới cho mọi người → Lưu.

## Những gì nền tảng cung cấp sẵn

| Dùng | Ý nghĩa |
|---|---|
| `sb` | Kết nối Supabase (`sb.from('bảng')…`, `sb.rpc(…)`, `sb.storage…`) |
| `S.user`, `S.profile` | Người đang đăng nhập (`S.profile.ho_ten`, `S.profile.chuc_vu`) |
| `S.nd`, `S.ndMap` | Danh sách tài khoản |
| `S.dt`, `S.lop`, `S.hs` (+ `S.lopMap`, `S.hsMap`) | Điểm trường, lớp, học sinh (khi người dùng có quyền cần xem học sinh) |
| `App.coQuyen('ma')`, `App.laQuanTri()` | Kiểm tra quyền |
| `App.nguoiCoQuyen(uid, 'ma')` | Người khác có quyền không (vd: ai là đảng viên) |
| `App.cauHinh('khoa', mặc_định)` | Đọc cấu hình |
| `App.khiTaiDuLieu(async () => …)` | Tải dữ liệu riêng của phân hệ khi mở phần mềm |
| `App.dangKyLienQuanHocSinh(fn)` | Báo số dữ liệu bị xóa kèm khi xóa học sinh, lớp |
| `App.dangKyDonDuLieu({…})` | Thêm mục sao lưu / xóa vào Quản trị → Dữ liệu |
| `App.dangKyQuyenPhu('ma', {nhan, mo})` | Cài đặt thêm cạnh một quyền trong trang Tài khoản |
| `App.capNhatHuyHieu()` | Cập nhật chấm đỏ sau khi thay đổi dữ liệu |
| `App.lamMoi()` | Tải lại dữ liệu dùng chung |
| `toast`, `moModal` / `dongModal`, `xuatCSV`, `layHet`, `dichLoi`, `esc` | Thông báo, hộp thoại, xuất Excel, đọc hết dữ liệu, dịch lỗi, chống chèn mã |
| `fmtTG`, `fmtGio`, `vn`, `homNay`, `congNgay`, `tuNgay`, `denNgay`, `khoangTK` | Ngày giờ Việt Nam |
| `optLop`, `optDT`, `nhomTheoDT`, `tenLop`, `tenDT`, `tenND` | Danh sách lớp / điểm trường |
| `veChart`, `xuHuong`, `mau` | Biểu đồ, mũi tên tăng giảm |
