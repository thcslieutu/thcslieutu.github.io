-- =====================================================================
--  ỨNG DỤNG QUẢN LÝ NHÀ TRƯỜNG – 00. NỀN TẢNG (chạy ĐẦU TIÊN)
--  Gồm: tài khoản, chức vụ, phân quyền theo phân hệ, cấu hình,
--       điểm trường – lớp – học sinh (dữ liệu dùng chung cho mọi phân hệ).
--
--  Cách chạy: Supabase → SQL Editor → New query → dán toàn bộ → Run.
--  Chạy lại nhiều lần vẫn an toàn (không mất dữ liệu). Có lỗi thì tự hủy, không thay đổi gì.
-- =====================================================================
begin;

-- ---------- 1. BẢNG NỀN TẢNG ----------

-- Nhật ký các phân hệ đã cài (mỗi file SQL ghi một dòng khi chạy xong)
create table if not exists public.mo_dun (
  ma         text primary key,                 -- vd: 'nen_tang', 'vi_pham'
  ten        text not null,
  phien_ban  int  not null,
  cai_luc    timestamptz not null default now()
);

-- Tài khoản (gắn với Supabase Auth). Người đăng ký đầu tiên tự động là Quản trị.
create table if not exists public.nguoi_dung (
  id       uuid primary key references auth.users(id) on delete cascade,
  email    text,
  ho_ten   text,
  chuc_vu  text not null default 'cho_duyet',
  tao_luc  timestamptz not null default now()
);
alter table public.nguoi_dung drop constraint if exists nguoi_dung_chuc_vu_check;
alter table public.nguoi_dung add constraint nguoi_dung_chuc_vu_check
  check (chuc_vu in ('cho_duyet','giao_vien','tong_phu_trach','nhan_vien','bgh','quan_tri'));

-- Danh mục quyền: mỗi phân hệ tự khai báo quyền của mình trong file SQL của phân hệ
create table if not exists public.quyen (
  ma            text primary key,              -- vd: 'vp.ghi_nhan'
  phan_he       text not null,                 -- vd: 'vi_pham'
  ten           text not null,
  mo_ta         text,
  thu_tu        int  not null default 0,
  mac_dinh      text[] not null default '{}',  -- chức vụ được tick sẵn khi duyệt tài khoản
  xem_hoc_sinh  boolean not null default false, -- quyền này có cần xem danh sách lớp, học sinh không
  thanh_vien    boolean not null default false  -- quyền "là thành viên" (vd: là đảng viên): Quản trị KHÔNG tự có, phải tick riêng
);
alter table public.quyen add column if not exists thanh_vien boolean not null default false;

-- Quyền của từng người (Quản trị có mọi quyền, không cần dòng nào)
create table if not exists public.nguoi_dung_quyen (
  nguoi_dung_id uuid not null references public.nguoi_dung(id) on delete cascade,
  quyen         text not null references public.quyen(ma) on delete cascade on update cascade,
  primary key (nguoi_dung_id, quyen)
);

-- Cấu hình chung, Quản trị sửa trong phần mềm (Quản trị → Cấu hình)
create table if not exists public.cau_hinh (
  khoa     text primary key,                   -- vd: 'vp.gio_duoc_huy'
  gia_tri  jsonb,
  ten      text not null,
  mo_ta    text,
  kieu     text not null default 'chu' check (kieu in ('so','chu','thang_ngay')),
  phan_he  text not null default 'chung',
  thu_tu   int  not null default 0
);

-- Điểm trường (không bắt buộc), lớp, học sinh
create table if not exists public.diem_truong (
  id      bigint generated always as identity primary key,
  ten     text not null unique,
  thu_tu  int not null default 0
);

create table if not exists public.lop (
  id              bigint generated always as identity primary key,
  ten_lop         text not null unique,
  khoi            smallint,
  diem_truong_id  bigint references public.diem_truong(id) on delete set null,
  gvcn_id         uuid references public.nguoi_dung(id) on delete set null,   -- giáo viên chủ nhiệm
  tao_luc         timestamptz not null default now()
);
create index if not exists lop_diem_truong_idx on public.lop(diem_truong_id);
create index if not exists lop_gvcn_idx on public.lop(gvcn_id);

create table if not exists public.hoc_sinh (
  id        bigint generated always as identity primary key,
  ho_ten    text not null,
  lop_id    bigint not null references public.lop(id) on delete cascade,
  dang_hoc  boolean not null default true,      -- false = đã nghỉ học / chuyển trường
  tao_luc   timestamptz not null default now()
);
create index if not exists hoc_sinh_lop_idx on public.hoc_sinh(lop_id);

-- ---------- 2. HÀM PHÂN QUYỀN (dùng chung cho mọi phân hệ) ----------

create or replace function public.chuc_vu_cua_toi() returns text
language sql stable security definer set search_path = public as $$
  select chuc_vu from public.nguoi_dung where id = auth.uid()
$$;

create or replace function public.da_duyet() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.chuc_vu_cua_toi() <> 'cho_duyet', false)
$$;

create or replace function public.la_quan_tri() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.chuc_vu_cua_toi() = 'quan_tri', false)
$$;

-- Người đang đăng nhập có quyền p_ma không (Quản trị: có mọi quyền, trừ quyền "thành viên" phải tick riêng)
create or replace function public.co_quyen(p_ma text) returns boolean
language sql stable security definer set search_path = public as $$
  select (public.la_quan_tri() and not exists (select 1 from public.quyen where ma = p_ma and thanh_vien))
      or (public.da_duyet() and exists (select 1 from public.nguoi_dung_quyen
                                        where nguoi_dung_id = auth.uid() and quyen = p_ma))
$$;

-- Có ít nhất một quyền cần xem danh sách lớp, học sinh (Nhân viên chỉ dùng phân hệ Đảng viên thì không)
create or replace function public.xem_hoc_sinh() returns boolean
language sql stable security definer set search_path = public as $$
  select public.la_quan_tri()
      or (public.da_duyet() and exists (select 1 from public.nguoi_dung_quyen x join public.quyen q on q.ma = x.quyen
                                        where x.nguoi_dung_id = auth.uid() and q.xem_hoc_sinh))
$$;

-- Đọc một cấu hình dạng số (không có thì dùng giá trị mặc định)
create or replace function public.cau_hinh_so(p_khoa text, p_mac_dinh numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select case when jsonb_typeof(gia_tri) = 'number' then (gia_tri)::text::numeric end
                   from public.cau_hinh where khoa = p_khoa), p_mac_dinh)
$$;

-- ---------- 3. TRIGGER ----------

-- Tự tạo hồ sơ khi có người đăng ký. Người đầu tiên = Quản trị, sau đó = Chờ duyệt.
create or replace function public.tao_nguoi_dung() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('tao_nguoi_dung'));
  insert into public.nguoi_dung (id, email, ho_ten, chuc_vu)
  values (
    new.id, new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'ho_ten'), ''), split_part(new.email, '@', 1)),
    case when exists (select 1 from public.nguoi_dung) then 'cho_duyet' else 'quan_tri' end
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists trg_tao_nguoi_dung on auth.users;
create trigger trg_tao_nguoi_dung after insert on auth.users
  for each row execute function public.tao_nguoi_dung();

-- Bảo vệ hồ sơ: chỉ Quản trị đổi chức vụ; không ai tự bỏ Quản trị cuối cùng
create or replace function public.nguoi_dung_truoc_sua() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  new.id := old.id; new.tao_luc := old.tao_luc;
  if auth.uid() is not null and not public.la_quan_tri() then
    new.chuc_vu := old.chuc_vu; new.email := old.email;
  end if;
  if old.chuc_vu = 'quan_tri' and new.chuc_vu <> 'quan_tri'
     and not exists (select 1 from public.nguoi_dung where chuc_vu = 'quan_tri' and id <> old.id) then
    raise exception 'Phải còn ít nhất một tài khoản Quản trị.';
  end if;
  return new;
end $$;
drop trigger if exists trg_nguoi_dung_truoc_sua on public.nguoi_dung;
create trigger trg_nguoi_dung_truoc_sua before update on public.nguoi_dung
  for each row execute function public.nguoi_dung_truoc_sua();

-- Chuyển về "Chờ duyệt" thì thu hồi mọi quyền
create or replace function public.nguoi_dung_sau_sua() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.chuc_vu = 'cho_duyet' and old.chuc_vu <> 'cho_duyet' then
    delete from public.nguoi_dung_quyen where nguoi_dung_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists trg_nguoi_dung_sau_sua on public.nguoi_dung;
create trigger trg_nguoi_dung_sau_sua after update of chuc_vu on public.nguoi_dung
  for each row execute function public.nguoi_dung_sau_sua();

-- Quản trị xóa tài khoản (xóa cả đăng nhập). Không xóa được chính mình.
create or replace function public.xoa_tai_khoan(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.la_quan_tri() then raise exception 'Chỉ Quản trị được xóa tài khoản.'; end if;
  delete from auth.users where id = any(p_ids) and id <> auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.xoa_tai_khoan(uuid[]) from public, anon;
grant execute on function public.xoa_tai_khoan(uuid[]) to authenticated;

-- ---------- 4. BẢO MẬT (Row Level Security) ----------

alter table public.mo_dun           enable row level security;
alter table public.nguoi_dung       enable row level security;
alter table public.quyen            enable row level security;
alter table public.nguoi_dung_quyen enable row level security;
alter table public.cau_hinh         enable row level security;
alter table public.diem_truong      enable row level security;
alter table public.lop              enable row level security;
alter table public.hoc_sinh         enable row level security;

drop policy if exists md_doc on public.mo_dun;
create policy md_doc on public.mo_dun for select to authenticated using (true);

-- Tài khoản: xem hồ sơ mình (kể cả khi chờ duyệt); người đã duyệt xem được danh sách (họ tên người ghi, GVCN…)
-- Tự sửa họ tên của mình; Quản trị sửa mọi người.
drop policy if exists nd_doc on public.nguoi_dung;
drop policy if exists nd_sua on public.nguoi_dung;
create policy nd_doc on public.nguoi_dung for select to authenticated using (id = auth.uid() or public.da_duyet());
create policy nd_sua on public.nguoi_dung for update to authenticated
  using (id = auth.uid() or public.la_quan_tri()) with check (id = auth.uid() or public.la_quan_tri());

drop policy if exists q_doc on public.quyen;
create policy q_doc on public.quyen for select to authenticated using (true);

drop policy if exists ndq_doc on public.nguoi_dung_quyen;
drop policy if exists ndq_ghi on public.nguoi_dung_quyen;
create policy ndq_doc on public.nguoi_dung_quyen for select to authenticated using (nguoi_dung_id = auth.uid() or public.da_duyet());
create policy ndq_ghi on public.nguoi_dung_quyen for all to authenticated using (public.la_quan_tri()) with check (public.la_quan_tri());

drop policy if exists ch_doc on public.cau_hinh;
drop policy if exists ch_sua on public.cau_hinh;
create policy ch_doc on public.cau_hinh for select to authenticated using (public.da_duyet());
create policy ch_sua on public.cau_hinh for update to authenticated using (public.la_quan_tri()) with check (public.la_quan_tri());

-- Điểm trường, lớp, học sinh: người có quyền cần đến học sinh được xem; quyền "hs.quan_ly" được sửa
drop policy if exists dt_doc on public.diem_truong;
drop policy if exists dt_ghi on public.diem_truong;
create policy dt_doc on public.diem_truong for select to authenticated using (public.xem_hoc_sinh());
create policy dt_ghi on public.diem_truong for all to authenticated using (public.co_quyen('hs.quan_ly')) with check (public.co_quyen('hs.quan_ly'));

drop policy if exists lop_doc on public.lop;
drop policy if exists lop_ghi on public.lop;
create policy lop_doc on public.lop for select to authenticated using (public.xem_hoc_sinh());
create policy lop_ghi on public.lop for all to authenticated using (public.co_quyen('hs.quan_ly')) with check (public.co_quyen('hs.quan_ly'));

drop policy if exists hs_doc on public.hoc_sinh;
drop policy if exists hs_ghi on public.hoc_sinh;
create policy hs_doc on public.hoc_sinh for select to authenticated using (public.xem_hoc_sinh());
create policy hs_ghi on public.hoc_sinh for all to authenticated using (public.co_quyen('hs.quan_ly')) with check (public.co_quyen('hs.quan_ly'));

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- 5. QUYỀN & CẤU HÌNH CỦA NỀN TẢNG ----------

insert into public.quyen (ma, phan_he, ten, mo_ta, thu_tu, mac_dinh, xem_hoc_sinh) values
  ('hs.quan_ly', 'quan_tri', 'Quản lý học sinh', 'Thêm, sửa, xóa điểm trường, lớp, học sinh; phân công GV chủ nhiệm', 1, '{bgh}', true)
on conflict (ma) do update set phan_he = excluded.phan_he, ten = excluded.ten, mo_ta = excluded.mo_ta,
  thu_tu = excluded.thu_tu, mac_dinh = excluded.mac_dinh, xem_hoc_sinh = excluded.xem_hoc_sinh;

insert into public.cau_hinh (khoa, gia_tri, ten, mo_ta, kieu, phan_he, thu_tu) values
  ('chung.hk1_bat_dau',       '"09-05"', 'Ngày bắt đầu học kỳ I',  'Tháng-ngày, vd 09-05. Dùng cho thống kê theo học kỳ.', 'thang_ngay', 'chung', 1),
  ('chung.hk2_bat_dau',       '"01-16"', 'Ngày bắt đầu học kỳ II', 'Tháng-ngày, vd 01-16.', 'thang_ngay', 'chung', 2),
  ('chung.nam_hoc_ket_thuc',  '"05-31"', 'Ngày kết thúc năm học',  'Tháng-ngày, vd 05-31.', 'thang_ngay', 'chung', 3)
on conflict (khoa) do update set ten = excluded.ten, mo_ta = excluded.mo_ta, kieu = excluded.kieu,
  phan_he = excluded.phan_he, thu_tu = excluded.thu_tu;

insert into public.mo_dun (ma, ten, phien_ban) values ('nen_tang', 'Nền tảng', 1)
on conflict (ma) do update set ten = excluded.ten, phien_ban = excluded.phien_ban, cai_luc = now();

commit;

select 'Đã cài NỀN TẢNG. Tiếp theo chạy các file phân hệ (10-, 20-, 30-…).' as ket_qua;
