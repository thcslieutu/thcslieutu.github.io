-- =====================================================================
--  PHẦN MỀM QUẢN LÝ VI PHẠM HỌC SINH – CƠ SỞ DỮ LIỆU SUPABASE (phiên bản 2)
--  Dùng cho CÀI MỚI và NÂNG CẤP từ phiên bản 1:
--  Supabase Dashboard → SQL Editor → New query → dán toàn bộ file → Run.
--  Chạy lại nhiều lần không mất dữ liệu.
-- =====================================================================

-- View phụ thuộc vào các bảng; xóa trước, tạo lại ở cuối.
drop view if exists public.v_vi_pham;

-- ---------- 1. BẢNG ----------

-- Điểm trường (không bắt buộc – trường chỉ có một điểm thì để trống)
create table if not exists public.diem_truong (
  id      bigint generated always as identity primary key,
  ten     text not null unique,
  thu_tu  int not null default 0
);

-- Tài khoản người dùng (gắn với Supabase Auth)
create table if not exists public.nguoi_dung (
  id      uuid primary key references auth.users(id) on delete cascade,
  email   text,
  ho_ten  text,
  vai_tro text not null default 'cho_duyet'
);
alter table public.nguoi_dung add column if not exists diem_truong_id bigint;   -- điểm trường của Tổng phụ trách (trống = toàn trường)
alter table public.nguoi_dung drop constraint if exists nguoi_dung_vai_tro_check;
alter table public.nguoi_dung add constraint nguoi_dung_vai_tro_check
  check (vai_tro in ('cho_duyet','gv','gvcn','tpt','bgh','admin'));
alter table public.nguoi_dung drop constraint if exists nguoi_dung_diem_truong_id_fkey;
alter table public.nguoi_dung add constraint nguoi_dung_diem_truong_id_fkey
  foreign key (diem_truong_id) references public.diem_truong(id) on delete restrict;

create table if not exists public.lop (
  id         bigint generated always as identity primary key,
  ten_lop    text not null unique,
  khoi       smallint,
  created_at timestamptz not null default now()
);
alter table public.lop add column if not exists diem_truong_id bigint;
alter table public.lop add column if not exists gvcn_id uuid;              -- giáo viên chủ nhiệm
alter table public.lop drop constraint if exists lop_diem_truong_id_fkey;
alter table public.lop add constraint lop_diem_truong_id_fkey
  foreign key (diem_truong_id) references public.diem_truong(id) on delete set null;
alter table public.lop drop constraint if exists lop_gvcn_id_fkey;
alter table public.lop add constraint lop_gvcn_id_fkey
  foreign key (gvcn_id) references public.nguoi_dung(id) on delete set null;
create index if not exists lop_diem_truong_idx on public.lop(diem_truong_id);
create index if not exists lop_gvcn_idx on public.lop(gvcn_id);

create table if not exists public.hoc_sinh (
  id         bigint generated always as identity primary key,
  ho_ten     text not null,
  lop_id     bigint not null,
  dang_hoc   boolean not null default true,      -- false = đã nghỉ học / chuyển trường
  created_at timestamptz not null default now()
);
-- Không cho xóa lớp còn học sinh (phiên bản 1 xóa dây chuyền)
alter table public.hoc_sinh drop constraint if exists hoc_sinh_lop_id_fkey;
alter table public.hoc_sinh add constraint hoc_sinh_lop_id_fkey
  foreign key (lop_id) references public.lop(id) on delete restrict;
create index if not exists hoc_sinh_lop_idx on public.hoc_sinh(lop_id);

-- Hình thức vi phạm (danh mục)
create table if not exists public.loai_vi_pham (
  id        bigint generated always as identity primary key,
  ten       text not null unique,
  nhom      text,                                  -- vd: Nề nếp, Học tập, Đạo đức
  muc_do    smallint not null default 1 check (muc_do between 1 and 3), -- 1 nhẹ, 2 TB, 3 nặng (chỉ BGH xử lý)
  diem_tru  numeric(4,1) not null default 0,
  dang_dung boolean not null default true,
  thu_tu    int not null default 0
);
alter table public.loai_vi_pham add column if not exists pham_vi text not null default 'hoc_sinh';  -- 'hoc_sinh' | 'lop'
alter table public.loai_vi_pham drop constraint if exists loai_vi_pham_pham_vi_check;
alter table public.loai_vi_pham add constraint loai_vi_pham_pham_vi_check check (pham_vi in ('hoc_sinh','lop'));

-- Vi phạm
create table if not exists public.vi_pham (
  id              bigint generated always as identity primary key,
  hoc_sinh_id     bigint,                                  -- trống = vi phạm của cả lớp
  lop_id          bigint,                                  -- lớp TẠI THỜI ĐIỂM vi phạm
  loai_id         bigint not null references public.loai_vi_pham(id),
  thoi_gian       timestamptz not null default now(),      -- lúc xảy ra vi phạm (người ghi chọn, mặc định = lúc ghi)
  tao_luc         timestamptz default now(),               -- lúc bấm Ghi nhận (máy chủ ghi)
  ghi_chu         text,
  nguoi_ghi       uuid references auth.users(id) on delete set null,
  trang_thai      text not null default 'chua_xu_ly'
                  check (trang_thai in ('chua_xu_ly','dang_xu_ly','da_xu_ly')),
  bien_phap       text,
  nguoi_xu_ly     uuid references auth.users(id) on delete set null,
  thoi_gian_xu_ly timestamptz
);

-- Nâng cấp dữ liệu phiên bản 1 (tạm gỡ trigger để không bị chặn)
drop trigger if exists trg_vi_pham_truoc_ghi on public.vi_pham;
alter table public.vi_pham add column if not exists lop_id bigint;
alter table public.vi_pham add column if not exists tao_luc timestamptz;
update public.vi_pham vp set lop_id = hs.lop_id
  from public.hoc_sinh hs where vp.lop_id is null and hs.id = vp.hoc_sinh_id;
update public.vi_pham set tao_luc = thoi_gian where tao_luc is null;
alter table public.vi_pham alter column lop_id set not null;
alter table public.vi_pham alter column tao_luc set default now();
alter table public.vi_pham alter column tao_luc set not null;
alter table public.vi_pham alter column hoc_sinh_id drop not null;

-- Không cho xóa học sinh / lớp đã có vi phạm (giữ lịch sử)
alter table public.vi_pham drop constraint if exists vi_pham_hoc_sinh_id_fkey;
alter table public.vi_pham add constraint vi_pham_hoc_sinh_id_fkey
  foreign key (hoc_sinh_id) references public.hoc_sinh(id) on delete restrict;
alter table public.vi_pham drop constraint if exists vi_pham_lop_id_fkey;
alter table public.vi_pham add constraint vi_pham_lop_id_fkey
  foreign key (lop_id) references public.lop(id) on delete restrict;

create index if not exists vi_pham_thoi_gian_idx  on public.vi_pham(thoi_gian desc);
create index if not exists vi_pham_tao_luc_idx    on public.vi_pham(tao_luc desc);
create index if not exists vi_pham_hoc_sinh_idx   on public.vi_pham(hoc_sinh_id);
create index if not exists vi_pham_lop_idx        on public.vi_pham(lop_id);
create index if not exists vi_pham_trang_thai_idx on public.vi_pham(trang_thai);

-- ---------- 2. HÀM PHÂN QUYỀN ----------

create or replace function public.vai_tro_hien_tai() returns text
language sql stable security definer set search_path = public as $$
  select vai_tro from public.nguoi_dung where id = auth.uid()
$$;

create or replace function public.co_quyen() returns boolean      -- mọi tài khoản đã được duyệt
language sql stable security definer set search_path = public as $$
  select coalesce(public.vai_tro_hien_tai() in ('gv','gvcn','tpt','bgh','admin'), false)
$$;

create or replace function public.la_bgh() returns boolean        -- BGH, Quản trị
language sql stable security definer set search_path = public as $$
  select coalesce(public.vai_tro_hien_tai() in ('bgh','admin'), false)
$$;

create or replace function public.la_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.vai_tro_hien_tai() = 'admin', false)
$$;

-- Người đang đăng nhập có được xử lý vi phạm (lớp, hình thức) này không?
--   BGH, Quản trị: mọi vi phạm.
--   GV chủ nhiệm: vi phạm KHÔNG phải mức Nặng của lớp mình chủ nhiệm.
--   Tổng phụ trách: vi phạm KHÔNG phải mức Nặng thuộc điểm trường được giao (không giao = toàn trường).
create or replace function public.co_the_xu_ly(p_lop_id bigint, p_loai_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.la_bgh() then true
    when coalesce((select muc_do from public.loai_vi_pham where id = p_loai_id), 1) >= 3 then false
    else exists (
      select 1
      from public.nguoi_dung nd
      join public.lop l on l.id = p_lop_id
      where nd.id = auth.uid()
        and (   (nd.vai_tro = 'gvcn' and l.gvcn_id = nd.id)
             or (nd.vai_tro = 'tpt'  and (nd.diem_truong_id is null or nd.diem_truong_id = l.diem_truong_id)))
    )
  end
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

-- Kiểm tra và khóa dữ liệu vi phạm trên máy chủ.
create or replace function public.vi_pham_truoc_ghi() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  so_ngay_lui constant int := 7;   -- GV được lùi ngày vi phạm tối đa bao nhiêu ngày (khớp js/config.js)
  v_pham_vi text;
begin
  if tg_op = 'INSERT' then
    select pham_vi into v_pham_vi from public.loai_vi_pham where id = new.loai_id;
    if new.hoc_sinh_id is not null then
      if v_pham_vi = 'lop' then
        raise exception 'Hình thức này là vi phạm của cả lớp, không ghi cho từng học sinh.';
      end if;
      select lop_id into new.lop_id from public.hoc_sinh where id = new.hoc_sinh_id;   -- lớp tại thời điểm ghi
    else
      if new.lop_id is null then raise exception 'Chưa chọn lớp.'; end if;
      if v_pham_vi is distinct from 'lop' then
        raise exception 'Hình thức này là vi phạm của học sinh, hãy chọn học sinh.';
      end if;
    end if;

    new.tao_luc := now();
    if new.thoi_gian is null or new.thoi_gian > now() then new.thoi_gian := now(); end if;
    if auth.uid() is not null and not public.la_bgh()
       and new.thoi_gian < now() - make_interval(days => so_ngay_lui) then
      raise exception 'Chỉ được ghi vi phạm xảy ra trong % ngày gần đây.', so_ngay_lui;
    end if;

    new.nguoi_ghi       := coalesce(auth.uid(), new.nguoi_ghi);
    new.trang_thai      := 'chua_xu_ly';
    new.bien_phap       := null;
    new.nguoi_xu_ly     := null;
    new.thoi_gian_xu_ly := null;
  else
    new.tao_luc   := old.tao_luc;
    new.nguoi_ghi := old.nguoi_ghi;
    -- Người không phải BGH chỉ được đổi trạng thái và biện pháp xử lý
    if auth.uid() is not null and not public.la_bgh() then
      new.thoi_gian   := old.thoi_gian;
      new.hoc_sinh_id := old.hoc_sinh_id;
      new.lop_id      := old.lop_id;
      new.loai_id     := old.loai_id;
      new.ghi_chu     := old.ghi_chu;
    end if;
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

create trigger trg_vi_pham_truoc_ghi
  before insert or update on public.vi_pham
  for each row execute function public.vi_pham_truoc_ghi();

-- ---------- 4. VIEW TỔNG HỢP (tuân theo RLS của người xem) ----------

create view public.v_vi_pham with (security_invoker = true) as
select vp.id, vp.hoc_sinh_id, vp.lop_id, vp.loai_id, vp.thoi_gian, vp.tao_luc, vp.ghi_chu, vp.nguoi_ghi,
       vp.trang_thai, vp.bien_phap, vp.nguoi_xu_ly, vp.thoi_gian_xu_ly,
       hs.ho_ten, l.ten_lop, l.khoi, l.diem_truong_id, dt.ten as ten_diem_truong,
       lv.ten as ten_vi_pham, lv.nhom, lv.muc_do, lv.diem_tru, lv.pham_vi,
       ng.ho_ten as ten_nguoi_ghi,
       nx.ho_ten as ten_nguoi_xu_ly
from public.vi_pham vp
left join public.hoc_sinh hs     on hs.id = vp.hoc_sinh_id
join public.lop l                on l.id  = vp.lop_id
left join public.diem_truong dt  on dt.id = l.diem_truong_id
join public.loai_vi_pham lv      on lv.id = vp.loai_id
left join public.nguoi_dung ng   on ng.id = vp.nguoi_ghi
left join public.nguoi_dung nx   on nx.id = vp.nguoi_xu_ly;

-- ---------- 5. BẢO MẬT (Row Level Security) ----------

alter table public.diem_truong  enable row level security;
alter table public.lop          enable row level security;
alter table public.hoc_sinh     enable row level security;
alter table public.loai_vi_pham enable row level security;
alter table public.nguoi_dung   enable row level security;
alter table public.vi_pham      enable row level security;

-- Danh mục: ai đã được duyệt đều xem; BGH/Quản trị thêm – sửa – xóa
drop policy if exists dt_doc on public.diem_truong;
drop policy if exists dt_ghi on public.diem_truong;
create policy dt_doc on public.diem_truong for select to authenticated using (public.co_quyen());
create policy dt_ghi on public.diem_truong for all    to authenticated using (public.la_bgh()) with check (public.la_bgh());

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

-- Vi phạm: mọi người được duyệt đều ghi nhận; xử lý theo phân quyền; người ghi được hủy trong 15 phút
drop policy if exists vp_doc on public.vi_pham;
drop policy if exists vp_them on public.vi_pham;
drop policy if exists vp_sua on public.vi_pham;
drop policy if exists vp_xoa on public.vi_pham;
create policy vp_doc  on public.vi_pham for select to authenticated using (public.co_quyen());
create policy vp_them on public.vi_pham for insert to authenticated with check (public.co_quyen());
create policy vp_sua  on public.vi_pham for update to authenticated
  using (public.co_the_xu_ly(lop_id, loai_id)) with check (public.co_the_xu_ly(lop_id, loai_id));
create policy vp_xoa  on public.vi_pham for delete to authenticated using (
  public.la_bgh()
  or (nguoi_ghi = auth.uid() and tao_luc > now() - interval '15 minutes')
);

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- 6. DỮ LIỆU MẪU: HÌNH THỨC VI PHẠM (sửa lại trong phần mềm) ----------
-- Chỉ thêm các mục chưa có tên trùng; không ghi đè danh mục đang dùng.

insert into public.loai_vi_pham (ten, nhom, muc_do, diem_tru, thu_tu, pham_vi) values
  ('Đi học trễ',                         'Nề nếp',   1, 1, 1,  'hoc_sinh'),
  ('Không mặc đồng phục đúng quy định',  'Nề nếp',   1, 1, 2,  'hoc_sinh'),
  ('Không đeo khăn quàng / huy hiệu',    'Nề nếp',   1, 1, 3,  'hoc_sinh'),
  ('Không học bài, không làm bài tập',   'Học tập',  1, 1, 4,  'hoc_sinh'),
  ('Nói chuyện, làm việc riêng trong giờ','Học tập', 1, 1, 5,  'hoc_sinh'),
  ('Sử dụng điện thoại trái quy định',   'Học tập',  2, 2, 6,  'hoc_sinh'),
  ('Vắng không phép',                    'Nề nếp',   2, 2, 7,  'hoc_sinh'),
  ('Bỏ tiết, trốn học',                  'Nề nếp',   2, 3, 8,  'hoc_sinh'),
  ('Xả rác, không giữ vệ sinh',          'Nề nếp',   1, 1, 9,  'hoc_sinh'),
  ('Gây mất trật tự, đùa giỡn nguy hiểm','Đạo đức',  2, 2, 10, 'hoc_sinh'),
  ('Vô lễ với thầy cô, nhân viên',       'Đạo đức',  3, 5, 11, 'hoc_sinh'),
  ('Đánh nhau, gây gổ',                  'Đạo đức',  3, 5, 12, 'hoc_sinh'),
  ('Phá hoại tài sản nhà trường',        'Đạo đức',  3, 5, 13, 'hoc_sinh'),
  ('Hút thuốc lá, thuốc lá điện tử',     'Đạo đức',  3, 5, 14, 'hoc_sinh'),
  ('Lớp không trực nhật, phòng học bẩn', 'Nề nếp',   1, 2, 20, 'lop'),
  ('Lớp mất trật tự trong giờ học',      'Nề nếp',   1, 2, 21, 'lop'),
  ('Lớp xếp hàng, tập trung chậm',       'Nề nếp',   1, 1, 22, 'lop'),
  ('Lớp không tắt điện, quạt khi ra về', 'Nề nếp',   1, 1, 23, 'lop')
on conflict (ten) do nothing;
