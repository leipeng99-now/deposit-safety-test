-- ============================================================
-- 存款安全感测试 · Supabase 数据库初始化脚本
-- 使用方法：Supabase 控制台 → 左侧 SQL Editor → New query
--           粘贴本文件全部内容 → Run
-- ============================================================

-- 1. 密码表
create table if not exists test_passwords (
  code text primary key,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. 密码使用记录表（每密码 × 每设备）
create table if not exists password_usage (
  code text not null,
  device_id text not null,
  uses int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (code, device_id)
);

-- 3. 开启 RLS 行级安全
alter table test_passwords enable row level security;
alter table password_usage enable row level security;

create policy "anon 读有效密码" on test_passwords
  for select to anon using (active = true);

create policy "anon 读使用记录" on password_usage
  for select to anon using (true);

create policy "anon 插入使用记录" on password_usage
  for insert to anon with check (true);

create policy "anon 更新使用记录" on password_usage
  for update to anon using (true) with check (true);

-- 4. 校验密码是否有效（返回 boolean）
create or replace function check_password(p_code text)
returns boolean
language sql security definer set search_path = public as $$
  select exists (
    select 1 from test_passwords where code = upper(p_code) and active
  );
$$;

-- 5. 查询某密码在某设备的剩余次数
create or replace function get_remaining_uses(p_code text, p_device text, p_max int default 3)
returns int
language sql security definer set search_path = public as $$
  select greatest(0, p_max - coalesce((
    select uses from password_usage
    where code = upper(p_code) and device_id = p_device
  ), 0));
$$;

-- 6. 消耗一次测试机会（原子操作）
--    返回：-1 密码无效 / -2 次数已用完 / 1..3 消耗后的已用次数
create or replace function consume_test_use(p_code text, p_device text, p_max int default 3)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_uses int;
begin
  if not exists (select 1 from test_passwords where code = upper(p_code) and active) then
    return -1;
  end if;

  insert into password_usage (code, device_id, uses)
  values (upper(p_code), p_device, 0)
  on conflict (code, device_id) do nothing;

  select uses into v_uses
  from password_usage
  where code = upper(p_code) and device_id = p_device
  for update;

  if v_uses >= p_max then
    return -2;
  end if;

  update password_usage
  set uses = uses + 1, updated_at = now()
  where code = upper(p_code) and device_id = p_device;

  return v_uses + 1;
end $$;

-- 7. 授权匿名用户执行这三个函数
grant execute on function check_password(text) to anon;
grant execute on function get_remaining_uses(text, text, int) to anon;
grant execute on function consume_test_use(text, text, int) to anon;

-- 8. 预置密码池（与前端 config.js 一致）
insert into test_passwords (code) values
  ('CKAQ-2601'), ('CKAQ-2602'), ('CKAQ-2603'), ('CKAQ-2604'), ('CKAQ-2605'),
  ('CKAQ-2606'), ('CKAQ-2607'), ('CKAQ-2608'), ('CKAQ-2609'), ('CKAQ-2610'),
  ('CKAQ-2611'), ('CKAQ-2612'), ('CKAQ-2613'), ('CKAQ-2614'), ('CKAQ-2615'),
  ('CKAQ-2616'), ('CKAQ-2617'), ('CKAQ-2618'), ('CKAQ-2619'), ('CKAQ-2620'),
  ('CKAQ-2621'), ('CKAQ-2622'), ('CKAQ-2623'), ('CKAQ-2624'), ('CKAQ-2625'),
  ('CKAQ-2626'), ('CKAQ-2627'), ('CKAQ-2628'), ('CKAQ-2629'), ('CKAQ-2630'),
  ('CKAQ-2631'), ('CKAQ-2632'), ('CKAQ-2633'), ('CKAQ-2634'), ('CKAQ-2635'),
  ('CKAQ-2636'), ('CKAQ-2637'), ('CKAQ-2638'), ('CKAQ-2639'), ('CKAQ-2640'),
  ('CKAQ-2641'), ('CKAQ-2642'), ('CKAQ-2643'), ('CKAQ-2644'), ('CKAQ-2645'),
  ('CKAQ-2646'), ('CKAQ-2647'), ('CKAQ-2648'), ('CKAQ-2649'), ('CKAQ-2650')
on conflict (code) do nothing;

-- 完成！以后想作废某个密码：
-- update test_passwords set active = false where code = 'CKAQ-2601';
-- 以后想新增密码：
-- insert into test_passwords (code) values ('CKAQ-2701');
