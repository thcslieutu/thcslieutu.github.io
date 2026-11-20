-- =====================================================================
--  ỨNG DỤNG QUẢN LÝ NHÀ TRƯỜNG – 10. PHÂN HỆ VI PHẠM
--  Cần chạy 00-nen-tang.sql trước.
--  Gồm: hình thức vi phạm, biện pháp xử lý, vi phạm, phân công xử lý theo điểm trường.
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

-- ---------- 1. BẢNG ----------

-- Hình thức vi phạm
create table if not exists public.loai_vi_pham (
  id          bigint generated always as identity primary key,
  ten         text not null unique,
  nhom        text,                                                   -- vd: Nề nếp, Học tập, Đạo đức
  pham_vi     text not null default 'hoc_sinh' check (pham_vi in ('hoc_sinh','lop')),   -- ghi cho học sinh / cả lớp
  muc_do      smallint not null default 1 check (muc_do between 1 and 3),               -- 1 Nhẹ, 2 Trung bình, 3 Nặng
  diem_tru    numeric(4,1) not null default 0,
  chuyen_can  text check (chuyen_can in ('co_phep','khong_phep','cup_tiet')),           -- dùng cho phân hệ Chuyên cần
  dang_dung   boolean not null default true,
  thu_tu      int not null default 0
);

-- Biện pháp xử lý (nút chọn nhanh). Vi phạm lưu biện pháp dạng chữ nên sửa danh mục không ảnh hưởng vi phạm cũ.
create table if not exists public.bien_phap (
  id        bigint generated always as identity primary key,
  ten       text not null unique,
  nhom      text,
  thu_tu    int not null default 0,
  dang_dung boolean not null default true
);

-- Vi phạm
create table if not exists public.vi_pham (
  id               bigint generated always as identity primary key,
  hoc_sinh_id      bigint references public.hoc_sinh(id) on delete cascade,   -- trống = vi phạm của cả lớp
  lop_id           bigint not null references public.lop(id) on delete cascade, -- lớp TẠI THỜI ĐIỂM vi phạm
  loai_id          bigint not null references public.loai_vi_pham(id),
  diem_tru         numeric(4,1),                              -- điểm trừ chốt lúc ghi nhận
  thoi_gian        timestamptz not null default now(),        -- lúc xảy ra (người ghi chọn, mặc định = lúc ghi)
  tao_luc          timestamptz not null default now(),        -- lúc bấm Ghi nhận (máy chủ ghi)
  ghi_chu          text,
  nguoi_ghi        uuid references auth.users(id) on delete set null,
  trang_thai       text not null default 'chua_xu_ly' check (trang_thai in ('chua_xu_ly','dang_xu_ly','da_xu_ly')),
  bien_phap        text,
  nguoi_xu_ly      uuid references auth.users(id) on delete set null,
  thoi_gian_xu_ly  timestamptz
);
create index if not exists vi_pham_thoi_gian_idx  on public.vi_pham(thoi_gian desc);
create index if not exists vi_pham_tao_luc_idx    on public.vi_pham(tao_luc desc);
create index if not exists vi_pham_hoc_sinh_idx   on public.vi_pham(hoc_sinh_id);
create index if not exists vi_pham_lop_idx        on public.vi_pham(lop_id);
create index if not exists vi_pham_loai_idx       on public.vi_pham(loai_id);
create index if not exists vi_pham_trang_thai_idx on public.vi_pham(trang_thai);
create index if not exists vi_pham_nguoi_ghi_idx  on public.vi_pham(nguoi_ghi, tao_luc desc);

-- Phạm vi xử lý theo điểm trường của người có quyền "vp.xu_ly" (không có dòng nào = toàn trường)
create table if not exists public.vp_pham_vi (
  nguoi_dung_id  uuid   not null references public.nguoi_dung(id) on delete cascade,
  diem_truong_id bigint not null references public.diem_truong(id) on delete cascade,
  primary key (nguoi_dung_id, diem_truong_id)
);

-- ---------- 2. HÀM ----------

create or replace function public.vp_la_chuyen_can(p_loai bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select chuyen_can is not null from public.loai_vi_pham where id = p_loai), false)
$$;

-- Người đang đăng nhập có được XEM vi phạm loại này không
create or replace function public.vp_duoc_xem(p_loai bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.co_quyen('vp.ghi_nhan') or public.co_quyen('vp.xu_ly') or public.co_quyen('vp.xu_ly_tat_ca')
      or (public.co_quyen('cc.su_dung') and public.vp_la_chuyen_can(p_loai))
$$;

-- Người đang đăng nhập có được XỬ LÝ vi phạm (lớp, hình thức) này không
--   "vp.xu_ly_tat_ca": mọi vi phạm, kể cả mức Nặng.
--   "vp.xu_ly": vi phạm KHÔNG phải mức Nặng, trong các điểm trường được giao (không giao = toàn trường).
--   GV chủ nhiệm (có quyền "vp.ghi_nhan"): vi phạm KHÔNG phải mức Nặng của lớp mình chủ nhiệm.
create or replace function public.vp_co_the_xu_ly(p_lop bigint, p_loai bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.co_quyen('vp.xu_ly_tat_ca') then true
    when coalesce((select muc_do from public.loai_vi_pham where id = p_loai), 1) >= 3 then false
    when public.co_quyen('vp.xu_ly') and (
           not exists (select 1 from public.vp_pham_vi where nguoi_dung_id = auth.uid())
           or exists (select 1 from public.vp_pham_vi x join public.lop l on l.id = p_lop
                      where x.nguoi_dung_id = auth.uid() and x.diem_truong_id = l.diem_truong_id)) then true
    when public.co_quyen('vp.ghi_nhan') and exists (select 1 from public.lop where id = p_lop and gvcn_id = auth.uid()) then true
    else false
  end
$$;

-- ---------- 3. TRIGGER: kiểm tra và khóa dữ liệu trên máy chủ ----------
create or replace function public.vi_pham_truoc_ghi() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_loai record;
  v_cu record;
  v_ngay_lui int := public.cau_hinh_so('vp.so_ngay_lui', 7)::int;
  v_bgh boolean := auth.uid() is null or public.co_quyen('vp.xu_ly_tat_ca');
begin
  if tg_op = 'INSERT' then
    select * into v_loai from public.loai_vi_pham where id = new.loai_id;
    if not found then raise exception 'Hình thức vi phạm không tồn tại.'; end if;
    if new.hoc_sinh_id is not null then
      if v_loai.pham_vi = 'lop' then raise exception 'Hình thức này là vi phạm của cả lớp, không ghi cho từng học sinh.'; end if;
      select lop_id into new.lop_id from public.hoc_sinh where id = new.hoc_sinh_id;   -- lớp tại thời điểm ghi
    else
      if new.lop_id is null then raise exception 'Chưa chọn lớp.'; end if;
      if v_loai.pham_vi <> 'lop' then raise exception 'Hình thức này là vi phạm của học sinh, hãy chọn học sinh.'; end if;
    end if;

    new.tao_luc  := now();
    new.diem_tru := v_loai.diem_tru;                                   -- chốt điểm trừ lúc ghi
    if new.thoi_gian is null or new.thoi_gian > now() then new.thoi_gian := now(); end if;
    if not v_bgh and new.thoi_gian < now() - make_interval(days => v_ngay_lui) then
      raise exception 'Chỉ được ghi vi phạm xảy ra trong % ngày gần đây.', v_ngay_lui;
    end if;
    new.nguoi_ghi := coalesce(auth.uid(), new.nguoi_ghi);

    -- Chuyên cần: mỗi học sinh chỉ có MỘT vi phạm chuyên cần trong một buổi (sáng < 12 giờ ≤ chiều, giờ Việt Nam)
    if v_loai.chuyen_can is not null and new.hoc_sinh_id is not null then
      perform pg_advisory_xact_lock(hashtext('chuyen_can'), new.hoc_sinh_id::int);
      select lv.ten, vp.thoi_gian, nd.ho_ten as nguoi into v_cu
        from public.vi_pham vp
        join public.loai_vi_pham lv on lv.id = vp.loai_id and lv.chuyen_can is not null
        left join public.nguoi_dung nd on nd.id = vp.nguoi_ghi
        where vp.hoc_sinh_id = new.hoc_sinh_id
          and (vp.thoi_gian at time zone 'Asia/Ho_Chi_Minh')::date = (new.thoi_gian at time zone 'Asia/Ho_Chi_Minh')::date
          and (extract(hour from vp.thoi_gian at time zone 'Asia/Ho_Chi_Minh') < 12) = (extract(hour from new.thoi_gian at time zone 'Asia/Ho_Chi_Minh') < 12)
        limit 1;
      if found then
        raise exception 'Học sinh % đã được ghi “%” lúc % buổi % ngày %. Mỗi buổi chỉ ghi một vi phạm chuyên cần cho một học sinh.',
          (select ho_ten from public.hoc_sinh where id = new.hoc_sinh_id), v_cu.ten,
          to_char(v_cu.thoi_gian at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI'),
          case when extract(hour from v_cu.thoi_gian at time zone 'Asia/Ho_Chi_Minh') < 12 then 'sáng' else 'chiều' end,
          to_char(v_cu.thoi_gian at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') || coalesce(' (người ghi: ' || v_cu.nguoi || ')', '');
      end if;
    end if;

    new.trang_thai := 'chua_xu_ly'; new.bien_phap := null; new.nguoi_xu_ly := null; new.thoi_gian_xu_ly := null;
    if v_loai.chuyen_can = 'co_phep' then           -- nghỉ có phép: chỉ để thống kê, không cần xử lý
      new.trang_thai := 'da_xu_ly'; new.bien_phap := 'Nghỉ có phép – không cần xử lý';
      new.nguoi_xu_ly := new.nguoi_ghi; new.thoi_gian_xu_ly := now();
    end if;
  else
    if pg_trigger_depth() > 1 then return new; end if;   -- cập nhật do khóa ngoại (vd xóa tài khoản người ghi)
    new.tao_luc := old.tao_luc; new.nguoi_ghi := old.nguoi_ghi;
    -- Điểm trừ giữ như lúc ghi; chỉ tính lại khi người có quyền đổi sang hình thức khác
    if new.loai_id is distinct from old.loai_id and v_bgh then
      select diem_tru into new.diem_tru from public.loai_vi_pham where id = new.loai_id;
    else
      new.diem_tru := old.diem_tru;
    end if;
    if not v_bgh then   -- người xử lý thường chỉ đổi trạng thái và biện pháp
      new.thoi_gian := old.thoi_gian; new.hoc_sinh_id := old.hoc_sinh_id; new.lop_id := old.lop_id;
      new.loai_id := old.loai_id; new.ghi_chu := old.ghi_chu;
    end if;
    if new.trang_thai is distinct from old.trang_thai or new.bien_phap is distinct from old.bien_phap then
      if new.trang_thai = 'chua_xu_ly' then new.nguoi_xu_ly := null; new.thoi_gian_xu_ly := null;
      else new.nguoi_xu_ly := auth.uid(); new.thoi_gian_xu_ly := now(); end if;
    else
      new.nguoi_xu_ly := old.nguoi_xu_ly; new.thoi_gian_xu_ly := old.thoi_gian_xu_ly;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_vi_pham_truoc_ghi on public.vi_pham;
create trigger trg_vi_pham_truoc_ghi before insert or update on public.vi_pham
  for each row execute function public.vi_pham_truoc_ghi();

-- ---------- 4. VIEW TỔNG HỢP (tuân theo phân quyền của người xem) ----------
drop view if exists public.v_vi_pham;
create view public.v_vi_pham with (security_invoker = true) as
select vp.id, vp.hoc_sinh_id, vp.lop_id, vp.loai_id, vp.thoi_gian, vp.tao_luc, vp.ghi_chu, vp.nguoi_ghi,
       vp.trang_thai, vp.bien_phap, vp.nguoi_xu_ly, vp.thoi_gian_xu_ly,
       hs.ho_ten, l.ten_lop, l.khoi, l.diem_truong_id, dt.ten as ten_diem_truong,
       lv.ten as ten_vi_pham, lv.nhom, lv.muc_do, coalesce(vp.diem_tru, lv.diem_tru) as diem_tru, lv.pham_vi, lv.chuyen_can,
       ng.ho_ten as ten_nguoi_ghi, nx.ho_ten as ten_nguoi_xu_ly
from public.vi_pham vp
left join public.hoc_sinh hs    on hs.id = vp.hoc_sinh_id
join public.lop l               on l.id  = vp.lop_id
left join public.diem_truong dt on dt.id = l.diem_truong_id
join public.loai_vi_pham lv     on lv.id = vp.loai_id
left join public.nguoi_dung ng  on ng.id = vp.nguoi_ghi
left join public.nguoi_dung nx  on nx.id = vp.nguoi_xu_ly;

-- ---------- 5. BẢO MẬT ----------
alter table public.loai_vi_pham enable row level security;
alter table public.bien_phap    enable row level security;
alter table public.vi_pham      enable row level security;
alter table public.vp_pham_vi   enable row level security;

drop policy if exists lvp_doc on public.loai_vi_pham;
drop policy if exists lvp_ghi on public.loai_vi_pham;
create policy lvp_doc on public.loai_vi_pham for select to authenticated using (public.xem_hoc_sinh());
create policy lvp_ghi on public.loai_vi_pham for all to authenticated using (public.co_quyen('vp.hinh_thuc')) with check (public.co_quyen('vp.hinh_thuc'));

drop policy if exists bp_doc on public.bien_phap;
drop policy if exists bp_ghi on public.bien_phap;
create policy bp_doc on public.bien_phap for select to authenticated using (public.xem_hoc_sinh());
create policy bp_ghi on public.bien_phap for all to authenticated using (public.co_quyen('vp.bien_phap')) with check (public.co_quyen('vp.bien_phap'));

drop policy if exists vp_doc on public.vi_pham;
drop policy if exists vp_them on public.vi_pham;
drop policy if exists vp_sua on public.vi_pham;
drop policy if exists vp_xoa on public.vi_pham;
create policy vp_doc  on public.vi_pham for select to authenticated using (public.vp_duoc_xem(loai_id));
create policy vp_them on public.vi_pham for insert to authenticated with check (
  public.co_quyen('vp.ghi_nhan') or (public.co_quyen('cc.su_dung') and public.vp_la_chuyen_can(loai_id)));
create policy vp_sua  on public.vi_pham for update to authenticated
  using (public.vp_co_the_xu_ly(lop_id, loai_id)) with check (public.vp_co_the_xu_ly(lop_id, loai_id));
create policy vp_xoa  on public.vi_pham for delete to authenticated using (
  public.co_quyen('vp.xu_ly_tat_ca')
  or (nguoi_ghi = auth.uid() and tao_luc > now() - make_interval(hours => public.cau_hinh_so('vp.gio_duoc_huy', 4)::int)));

drop policy if exists pv_doc on public.vp_pham_vi;
drop policy if exists pv_ghi on public.vp_pham_vi;
create policy pv_doc on public.vp_pham_vi for select to authenticated using (public.da_duyet());
create policy pv_ghi on public.vp_pham_vi for all to authenticated using (public.la_quan_tri()) with check (public.la_quan_tri());

grant select, insert, update, delete on public.loai_vi_pham, public.bien_phap, public.vi_pham, public.vp_pham_vi to authenticated;
grant select on public.v_vi_pham to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- 6. QUYỀN & CẤU HÌNH CỦA PHÂN HỆ ----------
insert into public.quyen (ma, phan_he, ten, mo_ta, thu_tu, mac_dinh, xem_hoc_sinh) values
  ('vp.ghi_nhan',    'vi_pham', 'Ghi nhận vi phạm',        'Ghi nhận vi phạm, xem danh sách và thống kê. GV chủ nhiệm được xử lý vi phạm Nhẹ, Trung bình của lớp mình.', 1, '{giao_vien,tong_phu_trach,bgh}', true),
  ('vp.xu_ly',       'vi_pham', 'Xử lý vi phạm',           'Xử lý vi phạm Nhẹ, Trung bình toàn trường, hoặc các điểm trường được giao.', 2, '{tong_phu_trach}', true),
  ('vp.xu_ly_tat_ca','vi_pham', 'Xử lý mọi vi phạm',       'Xử lý mọi vi phạm kể cả mức Nặng; sửa, xóa vi phạm; ghi lùi ngày không giới hạn.', 3, '{bgh}', true),
  ('vp.hinh_thuc',   'vi_pham', 'Sửa hình thức vi phạm',   'Thêm, sửa danh mục hình thức vi phạm (mức độ, điểm trừ, chuyên cần).', 4, '{bgh}', true),
  ('vp.bien_phap',   'vi_pham', 'Sửa biện pháp xử lý',     'Thêm, sửa danh mục biện pháp xử lý (nút chọn nhanh).', 5, '{}', true)
on conflict (ma) do update set phan_he = excluded.phan_he, ten = excluded.ten, mo_ta = excluded.mo_ta,
  thu_tu = excluded.thu_tu, mac_dinh = excluded.mac_dinh, xem_hoc_sinh = excluded.xem_hoc_sinh;

insert into public.cau_hinh (khoa, gia_tri, ten, mo_ta, kieu, phan_he, thu_tu) values
  ('vp.gio_duoc_huy', '4', 'Số giờ được tự hủy vi phạm vừa ghi', 'Người ghi được hủy vi phạm của mình trong bao nhiêu giờ.', 'so', 'vi_pham', 1),
  ('vp.so_ngay_lui',  '7', 'Số ngày được ghi lùi',              'Người ghi được chọn ngày vi phạm lùi tối đa bao nhiêu ngày (người có quyền “Xử lý mọi vi phạm” không giới hạn).', 'so', 'vi_pham', 2)
on conflict (khoa) do update set ten = excluded.ten, mo_ta = excluded.mo_ta, kieu = excluded.kieu,
  phan_he = excluded.phan_he, thu_tu = excluded.thu_tu;

-- ---------- 7. DỮ LIỆU MẪU (chỉ thêm khi danh mục còn trống; sửa lại trong phần mềm) ----------
insert into public.bien_phap (ten, nhom, thu_tu)
select v.ten, v.nhom, v.thu_tu from (values
  ('Nhắc nhở',                     'Biện pháp kỷ luật', 1),
  ('Phê bình',                     'Biện pháp kỷ luật', 2),
  ('Yêu cầu viết bản tự kiểm điểm','Biện pháp kỷ luật', 3),
  ('Khuyên bảo, động viên',        'Hỗ trợ khắc phục',  4),
  ('Tư vấn tâm lý học đường',      'Hỗ trợ khắc phục',  5),
  ('Thông báo PHHS',               'Phối hợp gia đình', 6),
  ('Mời PHHS đến trường',          'Phối hợp gia đình', 7)
) as v(ten, nhom, thu_tu)
where not exists (select 1 from public.bien_phap);

insert into public.loai_vi_pham (ten, nhom, muc_do, diem_tru, thu_tu, pham_vi, chuyen_can)
select v.* from (values
  ('Đi học trễ',                          'Nề nếp',     1, 1.0, 1,  'hoc_sinh', null),
  ('Không mặc đồng phục đúng quy định',   'Nề nếp',     1, 1.0, 2,  'hoc_sinh', null),
  ('Không đeo khăn quàng / huy hiệu',     'Nề nếp',     1, 1.0, 3,  'hoc_sinh', null),
  ('Không học bài, không làm bài tập',    'Học tập',    1, 1.0, 4,  'hoc_sinh', null),
  ('Nói chuyện, làm việc riêng trong giờ','Học tập',    1, 1.0, 5,  'hoc_sinh', null),
  ('Sử dụng điện thoại trái quy định',    'Học tập',    2, 2.0, 6,  'hoc_sinh', null),
  ('Xả rác, không giữ vệ sinh',           'Nề nếp',     1, 1.0, 7,  'hoc_sinh', null),
  ('Gây mất trật tự, đùa giỡn nguy hiểm', 'Đạo đức',    2, 2.0, 8,  'hoc_sinh', null),
  ('Vô lễ với thầy cô, nhân viên',        'Đạo đức',    3, 5.0, 9,  'hoc_sinh', null),
  ('Đánh nhau, gây gổ',                   'Đạo đức',    3, 5.0, 10, 'hoc_sinh', null),
  ('Phá hoại tài sản nhà trường',         'Đạo đức',    3, 5.0, 11, 'hoc_sinh', null),
  ('Hút thuốc lá, thuốc lá điện tử',      'Đạo đức',    3, 5.0, 12, 'hoc_sinh', null),
  ('Nghỉ có phép',                        'Chuyên cần', 1, 0.0, 13, 'hoc_sinh', 'co_phep'),
  ('Nghỉ không phép',                     'Chuyên cần', 2, 2.0, 14, 'hoc_sinh', 'khong_phep'),
  ('Cúp tiết, trốn học',                  'Chuyên cần', 2, 3.0, 15, 'hoc_sinh', 'cup_tiet'),
  ('Lớp không trực nhật, phòng học bẩn',  'Nề nếp',     1, 2.0, 20, 'lop', null),
  ('Lớp mất trật tự trong giờ học',       'Nề nếp',     1, 2.0, 21, 'lop', null),
  ('Lớp xếp hàng, tập trung chậm',        'Nề nếp',     1, 1.0, 22, 'lop', null),
  ('Lớp không tắt điện, quạt khi ra về',  'Nề nếp',     1, 1.0, 23, 'lop', null)
) as v(ten, nhom, muc_do, diem_tru, thu_tu, pham_vi, chuyen_can)
where not exists (select 1 from public.loai_vi_pham);

insert into public.mo_dun (ma, ten, phien_ban) values ('vi_pham', 'Vi phạm', 1)
on conflict (ma) do update set ten = excluded.ten, phien_ban = excluded.phien_ban, cai_luc = now();

commit;

select 'Đã cài phân hệ VI PHẠM.' as ket_qua;
