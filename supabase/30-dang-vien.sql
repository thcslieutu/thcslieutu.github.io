-- =====================================================================
--  ỨNG DỤNG QUẢN LÝ NHÀ TRƯỜNG – 30. PHÂN HỆ ĐẢNG VIÊN
--  Cần chạy 00-nen-tang.sql trước.
--  Gồm: đợt khảo sát, bài nộp ảnh minh chứng (1–3 ảnh), kho ảnh riêng tư "minh-chung".
--
--  Cách chạy: Supabase → SQL Editor → New query → dán toàn bộ → Run.
--  Chạy lại nhiều lần vẫn an toàn (không mất dữ liệu). Có lỗi thì tự hủy, không thay đổi gì.
-- =====================================================================
begin;

do $$ begin
  if to_regclass('public.quyen') is null then
    raise exception 'Chưa cài nền tảng: hãy chạy file 00-nen-tang.sql trước.';
  end if;
end $$;

-- ---------- 1. QUYỀN (khai báo trước vì các hàm bên dưới dùng đến) ----------
insert into public.quyen (ma, phan_he, ten, mo_ta, thu_tu, mac_dinh, xem_hoc_sinh, thanh_vien) values
  ('dv.dang_vien', 'dang_vien', 'Là đảng viên',      'Nhận các đợt khảo sát, nộp ảnh minh chứng. Quản trị cũng phải tick ô này nếu là đảng viên.', 1, '{}', false, true),
  ('dv.quan_ly',   'dang_vien', 'Quản lý khảo sát',  'Tạo đợt khảo sát, xem ai đã nộp / chưa nộp, xem ảnh minh chứng, tổng hợp.', 2, '{}', false, false)
on conflict (ma) do update set phan_he = excluded.phan_he, ten = excluded.ten, mo_ta = excluded.mo_ta, thu_tu = excluded.thu_tu,
  mac_dinh = excluded.mac_dinh, xem_hoc_sinh = excluded.xem_hoc_sinh, thanh_vien = excluded.thanh_vien;

-- ---------- 2. BẢNG ----------
create table if not exists public.ks_dot (
  id         bigint generated always as identity primary key,
  ten        text not null,
  huong_dan  text,
  link       text,
  han_chot   timestamptz,
  so_anh     smallint not null default 1 check (so_anh between 1 and 3),     -- số ảnh tối thiểu
  doi_tuong  text not null default 'tat_ca' check (doi_tuong in ('tat_ca','chon')),
  dang_mo    boolean not null default true,
  tao_boi    uuid references public.nguoi_dung(id) on delete set null default auth.uid(),
  tao_luc    timestamptz not null default now()
);
-- Đảng viên được giao (khi doi_tuong = 'chon')
create table if not exists public.ks_dot_nguoi (
  dot_id        bigint not null references public.ks_dot(id) on delete cascade,
  nguoi_dung_id uuid   not null references public.nguoi_dung(id) on delete cascade,
  primary key (dot_id, nguoi_dung_id)
);
-- Bài nộp minh chứng
create table if not exists public.ks_nop (
  id            bigint generated always as identity primary key,
  dot_id        bigint not null references public.ks_dot(id) on delete cascade,
  nguoi_dung_id uuid   not null references public.nguoi_dung(id) on delete cascade,
  anh           text[] not null default '{}',           -- đường dẫn ảnh trong kho 'minh-chung'
  anh_da_xoa    boolean not null default false,         -- ảnh đã được dọn (vẫn giữ kết quả)
  ghi_chu       text,
  nop_luc       timestamptz not null default now(),
  sua_luc       timestamptz,
  unique (dot_id, nguoi_dung_id),
  constraint ks_nop_so_anh check (anh_da_xoa or cardinality(anh) between 1 and 3)
);
create index if not exists ks_nop_dot_idx on public.ks_nop(dot_id);

-- ---------- 3. HÀM ----------
-- Người p_nguoi có phải đảng viên (được tick "Là đảng viên", tài khoản đã duyệt)
create or replace function public.dv_la_dang_vien(p_nguoi uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.nguoi_dung_quyen x join public.nguoi_dung nd on nd.id = x.nguoi_dung_id
                 where x.nguoi_dung_id = p_nguoi and x.quyen = 'dv.dang_vien' and nd.chuc_vu <> 'cho_duyet')
$$;
create or replace function public.ks_duoc_giao(p_dot bigint, p_nguoi uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.dv_la_dang_vien(p_nguoi) and exists (
    select 1 from public.ks_dot d where d.id = p_dot
      and (d.doi_tuong = 'tat_ca' or exists (select 1 from public.ks_dot_nguoi x where x.dot_id = d.id and x.nguoi_dung_id = p_nguoi)))
$$;
create or replace function public.ks_dang_mo(p_dot bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select dang_mo from public.ks_dot where id = p_dot), false)
$$;

-- Khóa dữ liệu bài nộp trên máy chủ
create or replace function public.ks_nop_truoc_ghi() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_so smallint;
begin
  if tg_op = 'INSERT' then
    new.nguoi_dung_id := coalesce(auth.uid(), new.nguoi_dung_id);
    new.nop_luc := now(); new.sua_luc := null; new.anh_da_xoa := false;
  else
    if pg_trigger_depth() > 1 then return new; end if;
    new.dot_id := old.dot_id; new.nguoi_dung_id := old.nguoi_dung_id; new.nop_luc := old.nop_luc;
    if auth.uid() is not null and not public.co_quyen('dv.quan_ly') then new.anh_da_xoa := old.anh_da_xoa; end if;
    if new.anh is distinct from old.anh or new.ghi_chu is distinct from old.ghi_chu then new.sua_luc := now(); end if;
  end if;
  if not new.anh_da_xoa then
    select so_anh into v_so from public.ks_dot where id = new.dot_id;
    if cardinality(new.anh) < coalesce(v_so, 1) then
      raise exception 'Đợt này cần ít nhất % ảnh minh chứng.', v_so;
    end if;
    if auth.uid() is not null and exists (select 1 from unnest(new.anh) a where a not like new.nguoi_dung_id::text || '/%') then
      raise exception 'Ảnh minh chứng không hợp lệ.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_ks_nop_truoc_ghi on public.ks_nop;
create trigger trg_ks_nop_truoc_ghi before insert or update on public.ks_nop
  for each row execute function public.ks_nop_truoc_ghi();

-- ---------- 4. BẢO MẬT ----------
alter table public.ks_dot       enable row level security;
alter table public.ks_dot_nguoi enable row level security;
alter table public.ks_nop       enable row level security;

drop policy if exists ksd_doc on public.ks_dot;
drop policy if exists ksd_ghi on public.ks_dot;
create policy ksd_doc on public.ks_dot for select to authenticated
  using (public.co_quyen('dv.quan_ly') or public.ks_duoc_giao(id, auth.uid()));
create policy ksd_ghi on public.ks_dot for all to authenticated
  using (public.co_quyen('dv.quan_ly')) with check (public.co_quyen('dv.quan_ly'));

drop policy if exists ksn_doc on public.ks_dot_nguoi;
drop policy if exists ksn_ghi on public.ks_dot_nguoi;
create policy ksn_doc on public.ks_dot_nguoi for select to authenticated
  using (public.co_quyen('dv.quan_ly') or nguoi_dung_id = auth.uid());
create policy ksn_ghi on public.ks_dot_nguoi for all to authenticated
  using (public.co_quyen('dv.quan_ly')) with check (public.co_quyen('dv.quan_ly'));

-- Bài nộp: người nộp xem/sửa/xóa bài của mình khi đợt còn mở; quản lý xem tất cả, dọn ảnh, xóa
drop policy if exists ksp_doc on public.ks_nop;
drop policy if exists ksp_them on public.ks_nop;
drop policy if exists ksp_sua on public.ks_nop;
drop policy if exists ksp_xoa on public.ks_nop;
create policy ksp_doc  on public.ks_nop for select to authenticated
  using (nguoi_dung_id = auth.uid() or public.co_quyen('dv.quan_ly'));
create policy ksp_them on public.ks_nop for insert to authenticated
  with check (public.ks_dang_mo(dot_id) and public.ks_duoc_giao(dot_id, auth.uid()));
create policy ksp_sua  on public.ks_nop for update to authenticated
  using ((nguoi_dung_id = auth.uid() and public.ks_dang_mo(dot_id)) or public.co_quyen('dv.quan_ly'))
  with check ((nguoi_dung_id = auth.uid() and public.ks_dang_mo(dot_id)) or public.co_quyen('dv.quan_ly'));
create policy ksp_xoa  on public.ks_nop for delete to authenticated
  using ((nguoi_dung_id = auth.uid() and public.ks_dang_mo(dot_id)) or public.co_quyen('dv.quan_ly'));

grant select, insert, update, delete on public.ks_dot, public.ks_dot_nguoi, public.ks_nop to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- 5. KHO ẢNH MINH CHỨNG (riêng tư, tối đa 1 MB/ảnh; phần mềm đã nén còn ~300 KB) ----------
-- Đường dẫn ảnh: <mã người nộp>/<mã đợt>/<tên file>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('minh-chung', 'minh-chung', false, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.ks_anh_cua_minh_dot_mo(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select split_part(p_name, '/', 1) = auth.uid()::text
     and split_part(p_name, '/', 2) ~ '^\d+$'
     and public.ks_dang_mo(split_part(p_name, '/', 2)::bigint)
     and public.ks_duoc_giao(split_part(p_name, '/', 2)::bigint, auth.uid())
$$;

drop policy if exists mc_doc  on storage.objects;
drop policy if exists mc_them on storage.objects;
drop policy if exists mc_xoa  on storage.objects;
create policy mc_doc  on storage.objects for select to authenticated
  using (bucket_id = 'minh-chung' and (split_part(name, '/', 1) = auth.uid()::text or public.co_quyen('dv.quan_ly')));
create policy mc_them on storage.objects for insert to authenticated
  with check (bucket_id = 'minh-chung' and public.ks_anh_cua_minh_dot_mo(name));
create policy mc_xoa  on storage.objects for delete to authenticated
  using (bucket_id = 'minh-chung' and (public.ks_anh_cua_minh_dot_mo(name) or public.co_quyen('dv.quan_ly')));

insert into public.mo_dun (ma, ten, phien_ban) values ('dang_vien', 'Đảng viên', 1)
on conflict (ma) do update set ten = excluded.ten, phien_ban = excluded.phien_ban, cai_luc = now();

commit;

select 'Đã cài phân hệ ĐẢNG VIÊN.' as ket_qua;
