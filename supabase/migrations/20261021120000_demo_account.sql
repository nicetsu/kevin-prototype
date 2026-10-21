-- =====================================================================
-- KeviN · บัญชีตัวอย่าง (demo) ให้คนที่ยังไม่มีบัญชีเข้าไปลองใช้ (21 ต.ค. 2026)
--
-- มติเจ้าของ (doc/DECISIONS.md):
--   - **บัญชีเดียวใช้ร่วมกัน** — ไม่สร้างบัญชีต่อคน จึง**ไม่แตะด่านรหัสเชิญเลย**
--     บัญชี demo สมัครผ่านรหัสเชิญตามปกติหนึ่งใบ
--   - แก้ได้ทุกอย่าง · **กดเข้า demo ทุกครั้ง = ล้างแล้วใส่ข้อมูลตัวอย่างใหม่**
--     + ตีสามล้างอีกรอบกันเหนียว
--   - ผู้ช่วย: แชต 3 + โทร 3 ต่อเครื่องต่อวัน · บวกเพดานรวมทั้ง demo
--
-- ⚠️ ไม่มี security definer ตัวใหม่เลยโดยตั้งใจ — ทุกฟังก์ชันที่นี่รันด้วยสิทธิ์
--    ของคนเรียกและผ่าน RLS ตามปกติ · ด่าน "ต้องเป็นบัญชี demo เท่านั้น" อยู่ใน
--    ตัวฟังก์ชัน **ไม่ใช่ที่หน้าเว็บ** (ใครก็ยิง /rest/v1/rpc/reset_demo ตรงได้)
-- =====================================================================

-- ---------------------------------------------------------------------
-- บัญชีไหนคือ demo · แถวเดียว
--
-- ที่เก็บเป็นตารางแทนฝัง uuid ในฟังก์ชัน เพราะสร้างบัญชีใหม่ (เช่นลบแล้วสมัครใหม่)
-- จะได้แก้แถวเดียว ไม่ต้องไล่แก้ทุกฟังก์ชัน
-- ---------------------------------------------------------------------
create table public.demo_account (
  only_one boolean primary key default true check (only_one),
  user_id  uuid not null unique references auth.users(id) on delete cascade
);

alter table public.demo_account enable row level security;
-- อ่านได้อย่างเดียว · uuid ของบัญชี demo ไม่ใช่ความลับ (ปุ่มหน้า login พาใครก็ได้เข้าไป)
-- ฟังก์ชันข้างล่างเป็น invoker จึงต้องอ่านตารางนี้ได้ด้วยสิทธิ์ของคนเรียก
create policy read_all on public.demo_account for select to authenticated using (true);

create or replace function public.demo_user_id()
returns uuid language sql stable set search_path = public, pg_temp as $$
  select user_id from public.demo_account
$$;

-- ---------------------------------------------------------------------
-- โควตาผู้ช่วยของ demo · นับต่อเครื่อง (cookie) ต่อวันไทย
--
-- ⚠️ ล้าง cookie แล้วได้สิทธิ์ใหม่ — เจ้าของรู้และยอมรับ · ตัวที่กันโควตา Gemini
--    รั่วจริงคือ **เพดานรวม** ที่ส่งมาจาก route (lib/demo.ts)
-- ⚠️ `reset_demo()` **ไม่แตะตารางนี้** — ไม่งั้นกดเข้า demo ใหม่ = เติมโควตาเต็ม
-- ---------------------------------------------------------------------
create table public.demo_usage (
  device text not null check (char_length(device) between 8 and 64),
  day    date not null,
  kind   text not null check (kind in ('chat', 'voice')),
  n      int  not null default 0 check (n >= 0),
  primary key (device, day, kind)
);

alter table public.demo_usage enable row level security;
create policy demo_only on public.demo_usage for all to authenticated
  using (auth.uid() = public.demo_user_id())
  with check (auth.uid() = public.demo_user_id());

/*
 * หักโควตาหนึ่งครั้ง · คืน 'ok' | 'device' (เครื่องนี้หมด) | 'global' (ทั้ง demo หมด)
 * | 'not_demo' (ไม่ใช่บัญชี demo — route ไม่ควรเรียกมาเลย)
 *
 * เพดานส่งมาจาก route ไม่ได้ฝังที่นี่ จะได้จูนได้โดยไม่ต้องทำ migration
 * · คนที่ยิง rpc นี้ตรงด้วยเพดานสูง ๆ ไม่ได้อะไร เพราะไม่ได้เรียก Gemini
 *
 * นับเครื่องด้วย upsert ที่มี `where n < cap` — สองคำขอพร้อมกันจากเครื่องเดียว
 * ผ่านได้ไม่เกินเพดาน (แบบเดียวกับ claim_due_reminders) · เพดานรวมเป็น
 * select แล้วค่อยเทียบ จึงเกินได้นิดหน่อยตอนคนกดพร้อมกันมาก ๆ ซึ่งยอมได้
 */
create or replace function public.demo_take(p_device text, p_kind text, p_per_device int, p_global int)
returns text language plpgsql volatile set search_path = public, pg_temp as $$
declare
  v_day   date := (now() at time zone 'Asia/Bangkok')::date;
  v_total int;
  v_n     int;
begin
  if auth.uid() is distinct from public.demo_user_id() then
    return 'not_demo';
  end if;

  select coalesce(sum(n), 0) into v_total
    from public.demo_usage where day = v_day and kind = p_kind;
  if v_total >= p_global then
    return 'global';
  end if;

  insert into public.demo_usage as u (device, day, kind, n)
  values (p_device, v_day, p_kind, 1)
  on conflict (device, day, kind) do update set n = u.n + 1 where u.n < p_per_device
  returning n into v_n;

  if v_n is null then
    return 'device';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.demo_take(text, text, int, int) from public, anon;
grant execute on function public.demo_take(text, text, int, int) to authenticated;

-- ---------------------------------------------------------------------
-- ล้างบัญชี demo แล้วใส่ข้อมูลตัวอย่างใหม่
--
-- เรียกได้สองทาง: บัญชี demo เอง (ปุ่มหน้า login) · หรือ cron ตอนตีสาม (postgres)
-- ⚠️ **ด่านบรรทัดแรกคือเส้นชีวิต** — ฟังก์ชันนี้ลบข้อมูลทั้งบัญชี ถ้าผู้ใช้จริง
--    เรียกได้ มันจะลบของ demo ไม่ได้ (RLS กัน) แต่ด่านนี้ทำให้ไม่ต้องพึ่งข้อนั้น
--
-- ทุกวันที่นับจาก "วันนี้" ตอนที่ล้าง — demo จึงดูมีชีวิตทุกวัน ไม่ใช่ตารางของเดือนที่แล้ว
-- ⚠️ ชื่อ Area ต้องตรงกับชุดใน handle_new_user() — คนดู demo ควรเห็นสิ่งที่ผู้ใช้ใหม่เห็น
-- ---------------------------------------------------------------------
create or replace function public.reset_demo()
returns void language plpgsql volatile set search_path = public, pg_temp as $$
declare
  u       uuid := public.demo_user_id();
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  -- จันทร์ของสัปดาห์ที่ 0 ของเทอม · ย้อนไป 6 สัปดาห์ ให้ดูเหมือนอยู่กลางเทอม
  v_term  date := (date_trunc('week', (now() at time zone 'Asia/Bangkok')) - interval '6 weeks')::date;
  v_weeks int[] := array(select generate_series(0, 15));
  a_class uuid; a_comp uuid; a_pers uuid; a_gen uuid;
  p_dsa uuid; p_disc uuid; p_db uuid; p_eng uuid; p_stat uuid;
  p_hack uuid; p_port uuid; p_gen uuid; p_health uuid;
  e_hack uuid;
begin
  if u is null then
    raise exception 'demo_account_missing';
  end if;
  -- ⚠️ `current_user` ไม่ใช่ `session_user` — ทดสอบแล้ว session_user ของการเชื่อมต่อ
  --    ที่สลับ role มาเป็น authenticated ยังเป็น postgres อยู่ ด่านจะเปิดเงียบ ๆ
  --    แล้วเหลือแค่ RLS ที่กันไว้ให้ (21 ต.ค. 2026)
  if auth.uid() is distinct from u and current_user <> 'postgres' then
    raise exception 'not_demo' using errcode = '42501';
  end if;

  -- ---- ล้าง · ลูกตาม cascade แต่เขียนให้ครบทุกตารางที่มี user_id ----
  delete from public.push_subscriptions where user_id = u;
  delete from public.conversations      where user_id = u;   -- messages · tool_calls ตาม
  delete from public.time_offsets       where user_id = u;
  delete from public.event_agenda       where user_id = u;
  delete from public.items              where user_id = u;
  delete from public.events             where user_id = u;
  delete from public.project_schedules  where user_id = u;
  delete from public.projects           where user_id = u;
  delete from public.areas              where user_id = u;

  -- ---- Area สี่ใบ (ชุดเดียวกับ handle_new_user) ----
  insert into public.areas (user_id, name, color, sort_order, description) values
    (u, 'Class', 'class', 0, 'วิชาที่ลงทะเบียนเรียนเทอมนี้ · การบ้าน รายงาน สอบ คาบเรียน') returning id into a_class;
  insert into public.areas (user_id, name, color, sort_order, description) values
    (u, 'Competition', 'comp', 1, 'การแข่งขัน แฮกกาธอน ประกวด และงานที่สมัครเข้าร่วมเอง') returning id into a_comp;
  insert into public.areas (user_id, name, color, sort_order, description) values
    (u, 'Personal', 'pers', 2, 'โปรเจกต์ของตัวเอง งานอดิเรก และการพัฒนาตัวเอง') returning id into a_pers;
  insert into public.areas (user_id, name, color, sort_order, description) values
    (u, 'General', 'gen', 3, 'เรื่องส่วนตัว สุขภาพ การเงิน นัดหมาย · และของที่ยังไม่รู้ว่าจะจัดไว้ตรงไหน') returning id into a_gen;

  -- ---- โปรเจกต์ · description = รหัสวิชา (สมมติ ไม่ผูกกับมหาวิทยาลัยจริง) ----
  insert into public.projects (user_id, area_id, name, description, sort_order) values
    (u, a_class, 'โครงสร้างข้อมูลและอัลกอริทึม', 'CPE201', 0) returning id into p_dsa;
  insert into public.projects (user_id, area_id, name, description, sort_order) values
    (u, a_class, 'คณิตศาสตร์ดิสครีต', 'CPE211', 1) returning id into p_disc;
  insert into public.projects (user_id, area_id, name, description, sort_order) values
    (u, a_class, 'ระบบฐานข้อมูล', 'CPE231', 2) returning id into p_db;
  insert into public.projects (user_id, area_id, name, description, sort_order) values
    (u, a_class, 'ภาษาอังกฤษเพื่อการสื่อสาร', 'LNG102', 3) returning id into p_eng;
  insert into public.projects (user_id, area_id, name, description, sort_order) values
    (u, a_class, 'สถิติวิศวกรรม', 'CPE221', 4) returning id into p_stat;
  insert into public.projects (user_id, area_id, name, sort_order) values
    (u, a_comp, 'แฮกกาธอน Smart Campus', 0) returning id into p_hack;
  insert into public.projects (user_id, area_id, name, sort_order) values
    (u, a_pers, 'เว็บพอร์ตโฟลิโอ', 0) returning id into p_port;
  insert into public.projects (user_id, area_id, name, sort_order) values
    (u, a_gen, 'ทั่วไป', 0) returning id into p_gen;
  insert into public.projects (user_id, area_id, name, sort_order) values
    (u, a_gen, 'สุขภาพ', 1) returning id into p_health;

  -- ---- กิจวัตร (คาบเรียน) · 0 = จันทร์ ----
  insert into public.project_schedules
    (user_id, project_id, day_of_week, start_time, end_time, location, label, start_date, week_offsets) values
    (u, p_dsa,  0, '09:00', '12:00', 'ENG-401', 'บรรยาย', v_term, v_weeks),
    (u, p_dsa,  2, '13:00', '15:00', 'LAB-2',   'ปฏิบัติ', v_term, v_weeks),
    (u, p_disc, 1, '09:30', '11:00', 'ENG-305', 'บรรยาย', v_term, v_weeks),
    (u, p_disc, 3, '09:30', '11:00', 'ENG-305', 'บรรยาย', v_term, v_weeks),
    (u, p_db,   1, '13:00', '16:00', 'ENG-402', 'บรรยาย', v_term, v_weeks),
    (u, p_db,   4, '09:00', '12:00', 'LAB-3',   'ปฏิบัติ', v_term, v_weeks),
    (u, p_eng,  3, '13:00', '15:00', 'ONLINE',  'บรรยาย', v_term, v_weeks),
    (u, p_stat, 2, '09:00', '11:00', 'ENG-301', 'บรรยาย', v_term, v_weeks),
    (u, p_stat, 4, '13:00', '15:00', 'ENG-301', 'บรรยาย', v_term, v_weeks),
    (u, p_health, 5, '07:00', '08:00', 'สวนสาธารณะ', 'วิ่ง', v_term, v_weeks);

  -- ---- กิจกรรมครั้งเดียว ----
  insert into public.events (user_id, project_id, title, starts_at, ends_at, location, label) values
    (u, p_dsa, 'ติวสอบกับเพื่อน',
      ((v_today + 1) + time '18:00') at time zone 'Asia/Bangkok',
      ((v_today + 1) + time '20:00') at time zone 'Asia/Bangkok', 'ห้องสมุดชั้น 3', null),
    (u, p_dsa, 'สอบกลางภาค',
      ((v_today + 12) + time '09:00') at time zone 'Asia/Bangkok',
      ((v_today + 12) + time '12:00') at time zone 'Asia/Bangkok', 'หอประชุมใหญ่', 'สอบ'),
    (u, p_gen, 'นัดทำฟัน',
      ((v_today + 5) + time '16:00') at time zone 'Asia/Bangkok',
      ((v_today + 5) + time '17:00') at time zone 'Asia/Bangkok', 'คลินิกทันตกรรม', null);

  insert into public.events (user_id, project_id, title, body, starts_at, ends_at, location, label) values
    (u, p_hack, 'Smart Campus Hackathon', 'ทีม 4 คน · เอาโน้ตบุ๊กกับสายชาร์จไปด้วย',
      ((v_today + 9) + time '09:00') at time zone 'Asia/Bangkok',
      ((v_today + 10) + time '17:00') at time zone 'Asia/Bangkok', 'อาคารนวัตกรรม', 'onsite')
    returning id into e_hack;

  insert into public.event_agenda (user_id, event_id, day_offset, start_time, end_time, title) values
    (u, e_hack, 0, '09:00', null,    'ลงทะเบียน + เปิดงาน'),
    (u, e_hack, 0, '10:00', null,    'เริ่มลงมือทำ'),
    (u, e_hack, 0, '18:00', '19:00', 'เมนเทอร์เดินดูงาน'),
    (u, e_hack, 1, '13:00', null,    'ส่งงาน'),
    (u, e_hack, 1, '14:00', null,    'นำเสนอ 5 นาทีต่อทีม'),
    (u, e_hack, 1, '16:30', null,    'ประกาศผล');

  -- ---- งาน · การเตือน · โน้ต ----
  insert into public.items (user_id, project_id, type, title, due_at, done_at) values
    -- เลยกำหนด · ให้คนดูเห็นกลุ่ม "เลยกำหนด"
    (u, p_disc, 'task', 'แบบฝึกหัดบทที่ 5', ((v_today - 1) + time '23:59') at time zone 'Asia/Bangkok', null),
    -- วันนี้
    (u, p_dsa,  'task', 'การบ้าน Linked List', (v_today + time '23:59') at time zone 'Asia/Bangkok', null),
    (u, p_disc, 'task', 'Quiz 3 ออนไลน์', (v_today + time '10:00') at time zone 'Asia/Bangkok', now()),
    -- ข้างหน้า
    (u, p_stat, 'task', 'Problem Set 4', ((v_today + 1) + time '12:00') at time zone 'Asia/Bangkok', null),
    (u, p_dsa,  'task', 'Lab 6 Binary Tree', ((v_today + 2) + time '23:59') at time zone 'Asia/Bangkok', null),
    (u, p_hack, 'task', 'ส่งไอเดียรอบแรก', ((v_today + 3) + time '23:59') at time zone 'Asia/Bangkok', null),
    (u, p_db,   'task', 'ER Diagram โปรเจกต์กลุ่ม', ((v_today + 4) + time '23:59') at time zone 'Asia/Bangkok', null),
    (u, p_db,   'task', 'รายงานกลุ่ม Normalization', ((v_today + 6) + time '23:59') at time zone 'Asia/Bangkok', null),
    (u, p_eng,  'task', 'อัดวิดีโอพรีเซนต์ 3 นาที', ((v_today + 7) + time '23:59') at time zone 'Asia/Bangkok', null),
    (u, p_hack, 'task', 'ทำ pitch deck', ((v_today + 8) + time '20:00') at time zone 'Asia/Bangkok', null),
    -- ไม่มีกำหนด
    (u, p_port, 'task', 'ออกแบบหน้า About', null, null),
    (u, p_port, 'task', 'ย้ายเว็บขึ้น Vercel', null, null);

  insert into public.items (user_id, project_id, type, title, remind_at) values
    (u, p_gen, 'reminder', 'จ่ายค่าหอ', ((v_today + 2) + time '09:00') at time zone 'Asia/Bangkok'),
    (u, p_gen, 'reminder', 'โทรหาแม่', ((v_today + 1) + time '20:00') at time zone 'Asia/Bangkok');

  insert into public.items (user_id, project_id, type, title, body) values
    (u, p_dsa, 'shortnote', 'ข้อสอบกลางภาค', 'อาจารย์บอกว่าเน้น Tree กับ Graph · เปิดชีตได้ 1 แผ่น A4'),
    (u, p_hack, 'shortnote', 'ไอเดียที่คุยกับทีม', 'แอปจองห้องอ่านหนังสือ + แจ้งเตือนเมื่อห้องว่าง');
end;
$$;

revoke all on function public.reset_demo() from public, anon;
grant execute on function public.reset_demo() to authenticated;

-- ---------------------------------------------------------------------
-- กันบัญชี demo ถูกยึด
--
-- ⚠️ คนที่อยู่ในบัญชี demo ถือ session ของมันจริง ๆ · เปิดคอนโซลแล้วเรียก
--    `supabase.auth.updateUser({ password })` ได้ทันที — ถ้าไม่กันตรงนี้
--    ใครคนหนึ่งเปลี่ยนรหัสแล้วปุ่ม demo พังสำหรับทุกคนจนกว่าเจ้าของจะมาแก้
--    แอปไม่มีปุ่มเปลี่ยนรหัสก็ไม่ช่วย เพราะ Auth API เปิดอยู่เสมอ
--
-- ⚠️ **ต้องเป็น security definer** — trigger นี้ยิงด้วย role ของ Auth
--    (`supabase_auth_admin`) ซึ่งไม่ใช่ authenticated · ถ้าเป็น invoker มันจะ
--    อ่าน `demo_account` ไม่เห็น (RLS) แล้ว**ไม่กันอะไรเลยแบบเงียบ ๆ** หรือแย่กว่า
--    คือไม่มีสิทธิ์ SELECT แล้ว**ทุกการล็อกอินของทุกคนล้ม** (ล็อกอินอัปเดต
--    `last_sign_in_at` บนตารางนี้) · revoke ครบตามกฎ และ trigger ไม่เช็ก EXECUTE
-- ---------------------------------------------------------------------
create or replace function public.lock_demo_credentials()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.id = (select user_id from public.demo_account)
     and (new.email is distinct from old.email
          or new.encrypted_password is distinct from old.encrypted_password
          or new.phone is distinct from old.phone) then
    raise exception 'demo_account_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.lock_demo_credentials() from public, anon, authenticated;

create trigger lock_demo_credentials
  before update on auth.users
  for each row execute function public.lock_demo_credentials();

-- ---------------------------------------------------------------------
-- ตีสามห้านาทีไทย (20:05 UTC) ล้างอีกรอบ · ห้านาทีหลัง kevin-housekeeping
-- ไม่มีบัญชี demo ก็ข้ามเงียบ ๆ ไม่ใช่ error ทุกคืน
-- ---------------------------------------------------------------------
select cron.schedule('kevin-demo-reset', '5 20 * * *', $CRON$
  select public.reset_demo() where public.demo_user_id() is not null;
$CRON$);
