-- =====================================================================
--  ỨNG DỤNG QUẢN LÝ NHÀ TRƯỜNG – 20. PHÂN HỆ CHUYÊN CẦN
--  Cần chạy 00-nen-tang.sql và 10-vi-pham.sql trước
--  (học sinh vắng được ghi bằng các hình thức vi phạm có đánh dấu "Chuyên cần").
--  Gồm: đánh dấu lớp nghỉ theo buổi, quyền dùng phân hệ.
--
--  Cách chạy: Supabase → SQL Editor → New query → dán toàn bộ → Run.
--  Chạy lại nhiều lần vẫn an toàn (không mất dữ liệu). Có lỗi thì tự hủy, không thay đổi gì.
-- =====================================================================
begin;

do $$ begin
  if to_regclass('public.vi_pham') is null then
    raise exception 'Chưa cài phân hệ Vi phạm: hãy chạy 00-nen-tang.sql và 10-vi-pham.sql trước.';
  end if;
end $$;

-- Mặc định mọi lớp đều học; chỉ đánh dấu lớp NGHỈ ở buổi nào. Lớp nghỉ không tính vào thống kê chuyên cần buổi đó.
create table if not exists public.lop_nghi (
  ngay    date   not null,
  buoi    text   not null check (buoi in ('sang','chieu')),
  lop_id  bigint not null references public.lop(id) on delete cascade,
  nguoi   uuid   references public.nguoi_dung(id) on delete set null default auth.uid(),
  luc     timestamptz not null default now(),
  primary key (ngay, buoi, lop_id)
);
create index if not exists lop_nghi_lop_idx on public.lop_nghi(lop_id);

create or replace function public.lop_nghi_truoc_them() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.nguoi := coalesce(auth.uid(), new.nguoi); new.luc := now();
  return new;
end $$;
drop trigger if exists trg_lop_nghi_truoc_them on public.lop_nghi;
create trigger trg_lop_nghi_truoc_them before insert on public.lop_nghi
  for each row execute function public.lop_nghi_truoc_them();

alter table public.lop_nghi enable row level security;
drop policy if exists ln_doc on public.lop_nghi;
drop policy if exists ln_them on public.lop_nghi;
drop policy if exists ln_xoa on public.lop_nghi;
create policy ln_doc  on public.lop_nghi for select to authenticated using (public.co_quyen('cc.su_dung'));
create policy ln_them on public.lop_nghi for insert to authenticated with check (public.co_quyen('cc.su_dung'));
create policy ln_xoa  on public.lop_nghi for delete to authenticated using (public.co_quyen('cc.su_dung'));
grant select, insert, delete on public.lop_nghi to authenticated;

insert into public.quyen (ma, phan_he, ten, mo_ta, thu_tu, mac_dinh, xem_hoc_sinh) values
  ('cc.su_dung', 'chuyen_can', 'Dùng phân hệ Chuyên cần', 'Ghi nhận học sinh vắng, cúp tiết; xem báo cáo chuyên cần; đánh dấu lớp nghỉ.', 1, '{giao_vien,tong_phu_trach,bgh}', true)
on conflict (ma) do update set phan_he = excluded.phan_he, ten = excluded.ten, mo_ta = excluded.mo_ta,
  thu_tu = excluded.thu_tu, mac_dinh = excluded.mac_dinh, xem_hoc_sinh = excluded.xem_hoc_sinh;

insert into public.mo_dun (ma, ten, phien_ban) values ('chuyen_can', 'Chuyên cần', 1)
on conflict (ma) do update set ten = excluded.ten, phien_ban = excluded.phien_ban, cai_luc = now();

commit;

select 'Đã cài phân hệ CHUYÊN CẦN.' as ket_qua;
