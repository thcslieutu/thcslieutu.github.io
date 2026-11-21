-- =====================================================================
--  ỨNG DỤNG QUẢN LÝ NHÀ TRƯỜNG – 30. PHÂN HỆ BÁO CÁO
--  Cần chạy 00-nen-tang.sql trước.
--  Gồm: đợt báo cáo giao cho mọi CB-GV-NV theo nhóm (tất cả, chức vụ, GV chủ nhiệm, Đảng viên…)
--       hoặc từng người; bài nộp 1–3 tệp (ảnh, PDF, Word, Excel, PowerPoint);
--       người tạo đợt nhận xét: Đạt / Cần sửa (người nộp sửa và nộp lại).
--
--  Thay cho phân hệ "Đảng viên – khảo sát" (file 30-dang-vien.sql cũ). Nếu đã chạy file cũ,
--  file này tự CHUYỂN dữ liệu cũ sang (đợt khảo sát cũ → đợt báo cáo giao cho nhóm Đảng viên).
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

-- ---------- 1. QUYỀN ----------
insert into public.quyen (ma, phan_he, ten, mo_ta, thu_tu, mac_dinh, xem_hoc_sinh, thanh_vien) values
  ('bc.quan_ly',    'bao_cao', 'Tạo đợt báo cáo',        'Tạo đợt báo cáo, xem bài nộp và nhận xét các đợt do mình tạo.', 1, '{bgh}', false, false),
  ('bc.xem_tat_ca', 'bao_cao', 'Quản lý mọi đợt báo cáo', 'Xem, sửa, nhận xét mọi đợt báo cáo (kể cả đợt do người khác tạo); tổng hợp toàn trường.', 2, '{bgh}', false, false),
  -- Nhóm "thành viên": dùng để giao báo cáo theo nhóm. Quản trị không tự có, phải tick riêng.
  ('dv.dang_vien',  'nhom',    'Là đảng viên',            'Thuộc nhóm Đảng viên (để giao báo cáo cho nhóm Đảng viên).', 1, '{}', false, true)
on conflict (ma) do update set phan_he = excluded.phan_he, ten = excluded.ten, mo_ta = excluded.mo_ta, thu_tu = excluded.thu_tu,
  mac_dinh = excluded.mac_dinh, xem_hoc_sinh = excluded.xem_hoc_sinh, thanh_vien = excluded.thanh_vien;

-- ---------- 2. CHUYỂN DỮ LIỆU TỪ PHÂN HỆ "ĐẢNG VIÊN – KHẢO SÁT" CŨ (nếu có) ----------
do $$ begin
  if to_regclass('public.ks_dot') is not null and to_regclass('public.bc_dot') is null then
    -- Gỡ các hàm cũ (kéo theo các chính sách bảo mật cũ đang dùng chúng)
    drop function if exists public.ks_anh_cua_minh_dot_mo(text) cascade;
    drop function if exists public.ks_duoc_giao(bigint, uuid) cascade;
    drop function if exists public.ks_dang_mo(bigint) cascade;
    drop function if exists public.ks_nop_truoc_ghi() cascade;
    drop function if exists public.dv_la_dang_vien(uuid) cascade;
    alter table public.ks_dot       rename to bc_dot;
    alter table public.ks_dot_nguoi rename to bc_dot_nguoi;
    alter table public.ks_nop       rename to bc_nop;
    alter table public.bc_dot rename column so_anh to so_tep;
    alter table public.bc_dot add column nhom text[] not null default '{}';
    update public.bc_dot set nhom = '{q:dv.dang_vien}' where doi_tuong = 'tat_ca';   -- "tất cả đảng viên" → nhóm Đảng viên
    alter table public.bc_dot drop column doi_tuong;
    -- Người quản lý khảo sát cũ → quản lý mọi đợt báo cáo
    insert into public.nguoi_dung_quyen (nguoi_dung_id, quyen)
      select x.nguoi_dung_id, q from public.nguoi_dung_quyen x, unnest(array['bc.quan_ly','bc.xem_tat_ca']) q
      where x.quyen = 'dv.quan_ly' on conflict do nothing;
  end if;
end $$;
delete from public.quyen where ma = 'dv.quan_ly';
delete from public.mo_dun where ma = 'dang_vien';
drop policy if exists mc_doc  on storage.objects;
drop policy if exists mc_them on storage.objects;
drop policy if exists mc_xoa  on storage.objects;

-- ---------- 3. BẢNG ----------
create table if not exists public.bc_dot (
  id         bigint generated always as identity primary key,
  ten        text not null,
  huong_dan  text,
  link       text,                                      -- đường link kèm theo (biểu mẫu, khảo sát…), không bắt buộc
  han_chot   timestamptz,
  so_tep     smallint not null default 1 check (so_tep between 1 and 3),   -- số tệp tối thiểu phải nộp
  nhom       text[] not null default '{}',              -- nhóm được giao: 'tat_ca', 'cv:giao_vien', 'gvcn', 'q:dv.dang_vien'…
  dang_mo    boolean not null default true,
  tao_boi    uuid references public.nguoi_dung(id) on delete set null default auth.uid(),
  tao_luc    timestamptz not null default now()
);
-- Người được giao thêm (chọn từng người)
create table if not exists public.bc_dot_nguoi (
  dot_id        bigint not null references public.bc_dot(id) on delete cascade,
  nguoi_dung_id uuid   not null references public.nguoi_dung(id) on delete cascade,
  primary key (dot_id, nguoi_dung_id)
);
-- Bài nộp
create table if not exists public.bc_nop (
  id            bigint generated always as identity primary key,
  dot_id        bigint not null references public.bc_dot(id) on delete cascade,
  nguoi_dung_id uuid   not null references public.nguoi_dung(id) on delete cascade,
  anh           text[] not null default '{}',           -- đường dẫn tệp (ảnh, PDF, Word…) trong kho 'minh-chung'
  anh_da_xoa    boolean not null default false,         -- tệp đã được dọn (vẫn giữ kết quả)
  ghi_chu       text,
  nop_luc       timestamptz not null default now(),
  sua_luc       timestamptz,
  unique (dot_id, nguoi_dung_id)
);
alter table public.bc_nop add column if not exists trang_thai  text not null default 'da_nop';
alter table public.bc_nop add column if not exists nhan_xet    text;
alter table public.bc_nop add column if not exists nguoi_duyet uuid references public.nguoi_dung(id) on delete set null;
alter table public.bc_nop add column if not exists duyet_luc   timestamptz;
alter table public.bc_nop drop constraint if exists bc_nop_trang_thai_check;
alter table public.bc_nop add constraint bc_nop_trang_thai_check check (trang_thai in ('da_nop','dat','can_sua'));
alter table public.bc_nop drop constraint if exists ks_nop_so_anh;
alter table public.bc_nop drop constraint if exists bc_nop_so_tep;
alter table public.bc_nop add constraint bc_nop_so_tep check (anh_da_xoa or cardinality(anh) between 1 and 3);
create index if not exists bc_nop_dot_idx on public.bc_nop(dot_id);
create index if not exists bc_dot_tao_boi_idx on public.bc_dot(tao_boi);

-- ---------- 4. HÀM ----------
-- Người p_nguoi có được giao đợt p_dot không (thuộc một nhóm được giao, hoặc được chọn riêng)
create or replace function public.bc_duoc_giao(p_dot bigint, p_nguoi uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bc_dot d join public.nguoi_dung nd on nd.id = p_nguoi and nd.chuc_vu <> 'cho_duyet'
    where d.id = p_dot and (
         'tat_ca' = any(d.nhom)
      or ('cv:' || nd.chuc_vu) = any(d.nhom)
      or ('gvcn' = any(d.nhom) and exists (select 1 from public.lop l where l.gvcn_id = p_nguoi))
      or exists (select 1 from public.nguoi_dung_quyen x where x.nguoi_dung_id = p_nguoi and ('q:' || x.quyen) = any(d.nhom))
      or exists (select 1 from public.bc_dot_nguoi g where g.dot_id = d.id and g.nguoi_dung_id = p_nguoi)))
$$;
-- Người đang đăng nhập có quản lý đợt này không (người tạo có quyền tạo đợt, hoặc quyền quản lý mọi đợt)
create or replace function public.bc_quan_ly_dot(p_dot bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.co_quyen('bc.xem_tat_ca')
      or (public.co_quyen('bc.quan_ly') and exists (select 1 from public.bc_dot where id = p_dot and tao_boi = auth.uid()))
$$;
create or replace function public.bc_dang_mo(p_dot bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select dang_mo from public.bc_dot where id = p_dot), false)
$$;
-- Người đang đăng nhập còn được nộp / sửa bài của đợt này không (đợt đang mở, hoặc bài bị yêu cầu sửa)
create or replace function public.bc_con_duoc_nop(p_dot bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.bc_duoc_giao(p_dot, auth.uid())
     and (public.bc_dang_mo(p_dot)
          or exists (select 1 from public.bc_nop where dot_id = p_dot and nguoi_dung_id = auth.uid() and trang_thai = 'can_sua'))
$$;
-- Các đợt được giao cho người đang đăng nhập
create or replace function public.bc_dot_cua_toi() returns setof bigint
language sql stable security definer set search_path = public as $$
  select d.id from public.bc_dot d where public.bc_duoc_giao(d.id, auth.uid())
$$;
-- Danh sách người được giao của các đợt mình quản lý: (dot_id, nguoi_dung_id)
create or replace function public.bc_ds_giao()
returns table (dot_id bigint, nguoi_dung_id uuid)
language sql stable security definer set search_path = public as $$
  select d.id, nd.id from public.bc_dot d cross join public.nguoi_dung nd
  where public.bc_quan_ly_dot(d.id) and public.bc_duoc_giao(d.id, nd.id)
$$;
-- Những người đang là GV chủ nhiệm (để xem trước số người khi giao cho nhóm "GV chủ nhiệm")
create or replace function public.bc_ds_gvcn() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct gvcn_id from public.lop where gvcn_id is not null and public.da_duyet()
$$;
revoke all on function public.bc_dot_cua_toi(), public.bc_ds_giao(), public.bc_ds_gvcn() from public, anon;
grant execute on function public.bc_dot_cua_toi(), public.bc_ds_giao(), public.bc_ds_gvcn() to authenticated;

-- Đợt: người tạo luôn là người đang đăng nhập, không đổi được
create or replace function public.bc_dot_truoc_ghi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.tao_boi := coalesce(auth.uid(), new.tao_boi); new.tao_luc := now();
  else new.tao_boi := old.tao_boi; new.tao_luc := old.tao_luc; end if;
  return new;
end $$;
drop trigger if exists trg_bc_dot_truoc_ghi on public.bc_dot;
create trigger trg_bc_dot_truoc_ghi before insert or update on public.bc_dot
  for each row execute function public.bc_dot_truoc_ghi();

-- Bài nộp: khóa dữ liệu trên máy chủ
create or replace function public.bc_nop_truoc_ghi() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_so smallint; v_ql boolean;
begin
  if tg_op = 'INSERT' then
    new.nguoi_dung_id := coalesce(auth.uid(), new.nguoi_dung_id);
    new.nop_luc := now(); new.sua_luc := null; new.anh_da_xoa := false;
    new.trang_thai := 'da_nop'; new.nhan_xet := null; new.nguoi_duyet := null; new.duyet_luc := null;
  else
    if pg_trigger_depth() > 1 then return new; end if;
    new.dot_id := old.dot_id; new.nguoi_dung_id := old.nguoi_dung_id; new.nop_luc := old.nop_luc;
    v_ql := auth.uid() is null or public.bc_quan_ly_dot(old.dot_id);
    if new.anh is distinct from old.anh or new.ghi_chu is distinct from old.ghi_chu then new.sua_luc := now(); else new.sua_luc := old.sua_luc; end if;
    if not v_ql then
      -- Người nộp: không tự đổi nhận xét / trạng thái; sửa bài thì bài trở lại "chờ xem"
      new.anh_da_xoa := old.anh_da_xoa; new.nhan_xet := old.nhan_xet;
      new.nguoi_duyet := old.nguoi_duyet; new.duyet_luc := old.duyet_luc;
      new.trang_thai := case when new.sua_luc is distinct from old.sua_luc then 'da_nop' else old.trang_thai end;
    elsif new.trang_thai is distinct from old.trang_thai or new.nhan_xet is distinct from old.nhan_xet then
      new.nguoi_duyet := auth.uid(); new.duyet_luc := now();
    else
      new.nguoi_duyet := old.nguoi_duyet; new.duyet_luc := old.duyet_luc;
    end if;
  end if;
  if not new.anh_da_xoa then
    select so_tep into v_so from public.bc_dot where id = new.dot_id;
    if cardinality(new.anh) < coalesce(v_so, 1) then
      raise exception 'Đợt này cần ít nhất % tệp minh chứng.', v_so;
    end if;
    if auth.uid() is not null and exists (select 1 from unnest(new.anh) a where a not like new.nguoi_dung_id::text || '/' || new.dot_id || '/%') then
      raise exception 'Tệp minh chứng không hợp lệ.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_ks_nop_truoc_ghi on public.bc_nop;
drop trigger if exists trg_bc_nop_truoc_ghi on public.bc_nop;
create trigger trg_bc_nop_truoc_ghi before insert or update on public.bc_nop
  for each row execute function public.bc_nop_truoc_ghi();

-- ---------- 5. BẢO MẬT ----------
alter table public.bc_dot       enable row level security;
alter table public.bc_dot_nguoi enable row level security;
alter table public.bc_nop       enable row level security;

drop policy if exists ksd_doc on public.bc_dot;
drop policy if exists ksd_ghi on public.bc_dot;
drop policy if exists bcd_doc on public.bc_dot;
drop policy if exists bcd_them on public.bc_dot;
drop policy if exists bcd_sua on public.bc_dot;
drop policy if exists bcd_xoa on public.bc_dot;
-- (Viết thẳng điều kiện theo cột tao_boi để người tạo thấy ngay đợt vừa tạo)
create policy bcd_doc  on public.bc_dot for select to authenticated
  using (tao_boi = auth.uid() or public.co_quyen('bc.xem_tat_ca') or public.bc_duoc_giao(id, auth.uid()));
create policy bcd_them on public.bc_dot for insert to authenticated with check (public.co_quyen('bc.quan_ly') or public.co_quyen('bc.xem_tat_ca'));
create policy bcd_sua  on public.bc_dot for update to authenticated
  using (public.co_quyen('bc.xem_tat_ca') or (public.co_quyen('bc.quan_ly') and tao_boi = auth.uid()))
  with check (public.co_quyen('bc.xem_tat_ca') or (public.co_quyen('bc.quan_ly') and tao_boi = auth.uid()));
create policy bcd_xoa  on public.bc_dot for delete to authenticated
  using (public.co_quyen('bc.xem_tat_ca') or (public.co_quyen('bc.quan_ly') and tao_boi = auth.uid()));

drop policy if exists ksn_doc on public.bc_dot_nguoi;
drop policy if exists ksn_ghi on public.bc_dot_nguoi;
drop policy if exists bcn_doc on public.bc_dot_nguoi;
drop policy if exists bcn_ghi on public.bc_dot_nguoi;
create policy bcn_doc on public.bc_dot_nguoi for select to authenticated using (public.bc_quan_ly_dot(dot_id) or nguoi_dung_id = auth.uid());
create policy bcn_ghi on public.bc_dot_nguoi for all to authenticated using (public.bc_quan_ly_dot(dot_id)) with check (public.bc_quan_ly_dot(dot_id));

drop policy if exists ksp_doc on public.bc_nop;
drop policy if exists ksp_them on public.bc_nop;
drop policy if exists ksp_sua on public.bc_nop;
drop policy if exists ksp_xoa on public.bc_nop;
drop policy if exists bcp_doc on public.bc_nop;
drop policy if exists bcp_them on public.bc_nop;
drop policy if exists bcp_sua on public.bc_nop;
drop policy if exists bcp_xoa on public.bc_nop;
create policy bcp_doc  on public.bc_nop for select to authenticated using (nguoi_dung_id = auth.uid() or public.bc_quan_ly_dot(dot_id));
create policy bcp_them on public.bc_nop for insert to authenticated with check (public.bc_dang_mo(dot_id) and public.bc_duoc_giao(dot_id, auth.uid()));
create policy bcp_sua  on public.bc_nop for update to authenticated
  using ((nguoi_dung_id = auth.uid() and public.bc_con_duoc_nop(dot_id)) or public.bc_quan_ly_dot(dot_id))
  with check (nguoi_dung_id = auth.uid() or public.bc_quan_ly_dot(dot_id));
create policy bcp_xoa  on public.bc_nop for delete to authenticated
  using ((nguoi_dung_id = auth.uid() and public.bc_dang_mo(dot_id)) or public.bc_quan_ly_dot(dot_id));

grant select, insert, update, delete on public.bc_dot, public.bc_dot_nguoi, public.bc_nop to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- 6. KHO TỆP MINH CHỨNG (riêng tư) ----------
-- Ảnh được phần mềm nén còn ~300 KB; PDF, Word, Excel, PowerPoint tối đa 5 MB/tệp.
-- Đường dẫn: <mã người nộp>/<mã đợt>/<mã>.jpg  hoặc  <mã người nộp>/<mã đợt>/<mã>__<tên tệp>.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('minh-chung', 'minh-chung', false, 5242880, array[
  'image/jpeg','image/png','image/webp',
  'application/pdf',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

-- Mã đợt trong đường dẫn tệp (null nếu đường dẫn sai dạng)
create or replace function public.bc_dot_cua_tep(p_name text) returns bigint
language sql immutable as $$
  select case when split_part(p_name, '/', 2) ~ '^\d{1,15}$' then split_part(p_name, '/', 2)::bigint end
$$;
create policy mc_doc  on storage.objects for select to authenticated
  using (bucket_id = 'minh-chung' and (split_part(name, '/', 1) = auth.uid()::text or public.bc_quan_ly_dot(public.bc_dot_cua_tep(name))));
create policy mc_them on storage.objects for insert to authenticated
  with check (bucket_id = 'minh-chung' and split_part(name, '/', 1) = auth.uid()::text and public.bc_con_duoc_nop(public.bc_dot_cua_tep(name)));
create policy mc_xoa  on storage.objects for delete to authenticated
  using (bucket_id = 'minh-chung' and ((split_part(name, '/', 1) = auth.uid()::text and public.bc_con_duoc_nop(public.bc_dot_cua_tep(name)))
                                       or public.bc_quan_ly_dot(public.bc_dot_cua_tep(name))));

insert into public.mo_dun (ma, ten, phien_ban) values ('bao_cao', 'Báo cáo', 1)
on conflict (ma) do update set ten = excluded.ten, phien_ban = excluded.phien_ban, cai_luc = now();

commit;

select 'Đã cài phân hệ BÁO CÁO.' as ket_qua;
