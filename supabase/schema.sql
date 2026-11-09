-- =====================================================================
--  PHẦN MỀM QUẢN LÝ VI PHẠM HỌC SINH – CƠ SỞ DỮ LIỆU SUPABASE
--  Cách dùng: Supabase Dashboard → SQL Editor → New query → dán toàn bộ
--  file này → Run. Có thể chạy lại nhiều lần mà không mất dữ liệu.
-- =====================================================================

-- ---------- 1. BẢNG ----------

create table if not exists public.lop (
  id         bigint generated always as identity primary key,
  ten_lop    text not null unique,
  khoi       smallint,
  created_at timestamptz not null default now()
);

create table if not exists public.hoc_sinh (
  id         bigint generated always as identity primary key,
  ho_ten     text not null,
  lop_id     bigint not null references public.lop(id) on delete cascade,
  dang_hoc   boolean not null default true,      -- false = đã nghỉ học / chuyển trường
  created_at timestamptz not null default now()
);
create index if not exists hoc_sinh_lop_idx on public.hoc_sinh(lop_id);

-- Hình thức vi phạm (danh mục)
create table if not exists public.loai_vi_pham (
  id        bigint generated always as identity primary key,
  ten       text not null unique,
  nhom      text,                                  -- vd: Nề nếp, Học tập, Đạo đức
  muc_do    smallint not null default 1 check (muc_do between 1 and 3), -- 1 nhẹ, 2 TB, 3 nặng
  diem_tru  numeric(4,1) not null default 0,
  dang_dung boolean not null default true,
  thu_tu    int not null default 0
);

-- Tài khoản người dùng (gắn với Supabase Auth)
create table if not exists public.nguoi_dung (
  id      uuid primary key references auth.users(id) on delete cascade,
  email   text,
  ho_ten  text,
  vai_tro text not null default 'cho_duyet'
          check (vai_tro in ('cho_duyet','gv','bgh','admin'))
);

-- Vi phạm
create table if not exists public.vi_pham (
  id              bigint generated always as identity primary key,
  hoc_sinh_id     bigint not null references public.hoc_sinh(id) on delete cascade,
  loai_id         bigint not null references public.loai_vi_pham(id),
  thoi_gian       timestamptz not null default now(),   -- tự động = lúc ghi nhận
  ghi_chu         text,
  nguoi_ghi       uuid references auth.users(id) on delete set null,
  trang_thai      text not null default 'chua_xu_ly'
                  check (trang_thai in ('chua_xu_ly','dang_xu_ly','da_xu_ly')),
  bien_phap       text,
  nguoi_xu_ly     uuid references auth.users(id) on delete set null,
  thoi_gian_xu_ly timestamptz
);
create index if not exists vi_pham_thoi_gian_idx  on public.vi_pham(thoi_gian desc);
create index if not exists vi_pham_hoc_sinh_idx   on public.vi_pham(hoc_sinh_id);
create index if not exists vi_pham_trang_thai_idx on public.vi_pham(trang_thai);

-- ---------- 2. HÀM PHÂN QUYỀN ----------

create or replace function public.vai_tro_hien_tai() returns text
language sql stable security definer set search_path = public as $$
  select vai_tro from public.nguoi_dung where id = auth.uid()
$$;

create or replace function public.co_quyen() returns boolean      -- GV, BGH, Quản trị
language sql stable security definer set search_path = public as $$
  select coalesce(public.vai_tro_hien_tai() in ('gv','bgh','admin'), false)
$$;

create or replace function public.la_bgh() returns boolean        -- BGH, Quản trị
language sql stable security definer set search_path = public as $$
  select coalesce(public.vai_tro_hien_tai() in ('bgh','admin'), false)
$$;

create or replace function public.la_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.vai_tro_hien_tai() = 'admin', false)
$$;

-- ---------- 3. TRIGGER ----------

-- Tự tạo hồ sơ khi có người đăng ký. Người đầu tiên = Quản trị, sau đó = Chờ duyệt.
create or replace function public.tao_nguoi_dung() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.nguoi_dung (id, email, ho_ten, vai_tro)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'ho_ten',''), split_part(new.email,'@',1)),
    case when exists (select 1 from public.nguoi_dung) then 'cho_duyet' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_tao_nguoi_dung on auth.users;
create trigger trg_tao_nguoi_dung
  after insert on auth.users
  for each row execute function public.tao_nguoi_dung();

-- Khóa thời gian vi phạm = thời điểm ghi trên máy chủ; tự ghi người xử lý.
create or replace function public.vi_pham_truoc_ghi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.thoi_gian       := now();
    new.nguoi_ghi       := coalesce(auth.uid(), new.nguoi_ghi);
    new.trang_thai      := 'chua_xu_ly';
    new.bien_phap       := null;
    new.nguoi_xu_ly     := null;
    new.thoi_gian_xu_ly := null;
  else
    new.thoi_gian := old.thoi_gian;      -- không cho sửa thời gian vi phạm
    new.nguoi_ghi := old.nguoi_ghi;
    if new.trang_thai is distinct from old.trang_thai
       or new.bien_phap is distinct from old.bien_phap then
      if new.trang_thai = 'chua_xu_ly' then
        new.nguoi_xu_ly := null;
        new.thoi_gian_xu_ly := null;
      else
        new.nguoi_xu_ly := auth.uid();
        new.thoi_gian_xu_ly := now();
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_vi_pham_truoc_ghi on public.vi_pham;
create trigger trg_vi_pham_truoc_ghi
  before insert or update on public.vi_pham
  for each row execute function public.vi_pham_truoc_ghi();

-- ---------- 4. VIEW TỔNG HỢP (tuân theo RLS của người xem) ----------

drop view if exists public.v_vi_pham;
create view public.v_vi_pham with (security_invoker = true) as
select vp.id, vp.hoc_sinh_id, vp.loai_id, vp.thoi_gian, vp.ghi_chu, vp.nguoi_ghi,
       vp.trang_thai, vp.bien_phap, vp.nguoi_xu_ly, vp.thoi_gian_xu_ly,
       hs.ho_ten, hs.lop_id, l.ten_lop, l.khoi,
       lv.ten as ten_vi_pham, lv.nhom, lv.muc_do, lv.diem_tru,
       ng.ho_ten as ten_nguoi_ghi,
       nx.ho_ten as ten_nguoi_xu_ly
from public.vi_pham vp
join public.hoc_sinh hs     on hs.id = vp.hoc_sinh_id
join public.lop l           on l.id  = hs.lop_id
join public.loai_vi_pham lv on lv.id = vp.loai_id
left join public.nguoi_dung ng on ng.id = vp.nguoi_ghi
left join public.nguoi_dung nx on nx.id = vp.nguoi_xu_ly;

-- ---------- 5. BẢO MẬT (Row Level Security) ----------

alter table public.lop          enable row level security;
alter table public.hoc_sinh     enable row level security;
alter table public.loai_vi_pham enable row level security;
alter table public.nguoi_dung   enable row level security;
alter table public.vi_pham      enable row level security;

-- Danh mục: ai có quyền đều xem; BGH/Quản trị thêm – sửa – xóa
drop policy if exists lop_doc on public.lop;
drop policy if exists lop_ghi on public.lop;
create policy lop_doc on public.lop for select to authenticated using (public.co_quyen());
create policy lop_ghi on public.lop for all    to authenticated using (public.la_bgh()) with check (public.la_bgh());

drop policy if exists hs_doc on public.hoc_sinh;
drop policy if exists hs_ghi on public.hoc_sinh;
create policy hs_doc on public.hoc_sinh for select to authenticated using (public.co_quyen());
create policy hs_ghi on public.hoc_sinh for all    to authenticated using (public.la_bgh()) with check (public.la_bgh());

drop policy if exists loai_doc on public.loai_vi_pham;
drop policy if exists loai_ghi on public.loai_vi_pham;
create policy loai_doc on public.loai_vi_pham for select to authenticated using (public.co_quyen());
create policy loai_ghi on public.loai_vi_pham for all    to authenticated using (public.la_bgh()) with check (public.la_bgh());

-- Người dùng: xem hồ sơ mình (kể cả khi chờ duyệt); chỉ Quản trị cấp quyền
drop policy if exists nd_doc on public.nguoi_dung;
drop policy if exists nd_sua on public.nguoi_dung;
create policy nd_doc on public.nguoi_dung for select to authenticated using (id = auth.uid() or public.co_quyen());
create policy nd_sua on public.nguoi_dung for update to authenticated using (public.la_admin()) with check (public.la_admin());

-- Vi phạm: GV/BGH ghi nhận; chỉ BGH xử lý; người ghi được hủy trong 15 phút
drop policy if exists vp_doc on public.vi_pham;
drop policy if exists vp_them on public.vi_pham;
drop policy if exists vp_sua on public.vi_pham;
drop policy if exists vp_xoa on public.vi_pham;
create policy vp_doc  on public.vi_pham for select to authenticated using (public.co_quyen());
create policy vp_them on public.vi_pham for insert to authenticated with check (public.co_quyen());
create policy vp_sua  on public.vi_pham for update to authenticated using (public.la_bgh()) with check (public.la_bgh());
create policy vp_xoa  on public.vi_pham for delete to authenticated using (
  public.la_bgh()
  or (nguoi_ghi = auth.uid() and thoi_gian > now() - interval '15 minutes')
);

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- 6. DỮ LIỆU MẪU: HÌNH THỨC VI PHẠM (sửa lại trong phần mềm) ----------

insert into public.loai_vi_pham (ten, nhom, muc_do, diem_tru, thu_tu) values
  ('Đi học trễ',                         'Nề nếp',   1, 1, 1),
  ('Không mặc đồng phục đúng quy định',  'Nề nếp',   1, 1, 2),
  ('Không đeo khăn quàng / huy hiệu',    'Nề nếp',   1, 1, 3),
  ('Không học bài, không làm bài tập',   'Học tập',  1, 1, 4),
  ('Nói chuyện, làm việc riêng trong giờ','Học tập', 1, 1, 5),
  ('Sử dụng điện thoại trái quy định',   'Học tập',  2, 2, 6),
  ('Vắng không phép',                    'Nề nếp',   2, 2, 7),
  ('Bỏ tiết, trốn học',                  'Nề nếp',   2, 3, 8),
  ('Xả rác, không giữ vệ sinh',          'Nề nếp',   1, 1, 9),
  ('Gây mất trật tự, đùa giỡn nguy hiểm','Đạo đức',  2, 2, 10),
  ('Vô lễ với thầy cô, nhân viên',       'Đạo đức',  3, 5, 11),
  ('Đánh nhau, gây gổ',                  'Đạo đức',  3, 5, 12),
  ('Phá hoại tài sản nhà trường',        'Đạo đức',  3, 5, 13),
  ('Hút thuốc lá, thuốc lá điện tử',     'Đạo đức',  3, 5, 14)
on conflict (ten) do nothing;
