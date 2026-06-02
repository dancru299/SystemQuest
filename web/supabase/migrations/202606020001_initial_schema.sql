create extension if not exists "pgcrypto";

do $$
begin
  create type public.quest_status as enum ('active', 'completed', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.quest_generation_status as enum ('full', 'partial');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.xp_reason as enum (
    'mission_complete',
    'day_complete',
    'streak_bonus',
    'quest_complete'
  );
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(255) unique not null,
  display_name varchar(100) not null,
  avatar_url text,
  xp_total integer not null default 0 check (xp_total >= 0),
  level integer not null default 1 check (level between 1 and 5),
  streak_current integer not null default 0 check (streak_current >= 0),
  streak_max integer not null default 0 check (streak_max >= 0),
  last_active_date date,
  timezone varchar(60) not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(200) not null,
  main_goal text not null,
  total_days integer not null check (total_days between 1 and 30),
  phases jsonb not null default '[]'::jsonb,
  ai_raw_plan text,
  status public.quest_status not null default 'active',
  generation_status public.quest_generation_status not null default 'full',
  generated_up_to_day integer not null default 0,
  start_date date,
  current_day_number integer not null default 1 check (current_day_number >= 1),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quest_days (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  day_number integer not null check (day_number >= 1),
  title varchar(200) not null,
  mentor_speech text,
  missions jsonb not null default '[]'::jsonb,
  completed_mission_ids jsonb not null default '[]'::jsonb,
  is_day_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quest_id, day_number)
);

create table if not exists public.xp_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason public.xp_reason not null,
  reference_id uuid not null,
  idempotency_key varchar(160) not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_analyze_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists quests_user_status_created_idx on public.quests (user_id, status, created_at desc);
create index if not exists quest_days_quest_day_idx on public.quest_days (quest_id, day_number);
create index if not exists xp_log_user_created_idx on public.xp_log (user_id, created_at desc);
create index if not exists ai_analyze_user_local_date_idx on public.ai_analyze_events (user_id, local_date);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists quests_set_updated_at on public.quests;
create trigger quests_set_updated_at
before update on public.quests
for each row execute function public.set_updated_at();

drop trigger if exists quest_days_set_updated_at on public.quest_days;
create trigger quest_days_set_updated_at
before update on public.quest_days
for each row execute function public.set_updated_at();

create or replace function public.calculate_level(p_xp integer)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(p_xp, 0) >= 7000 then 5
    when coalesce(p_xp, 0) >= 3500 then 4
    when coalesce(p_xp, 0) >= 1500 then 3
    when coalesce(p_xp, 0) >= 500 then 2
    else 1
  end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'Adventurer'), '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.quests enable row level security;
alter table public.quest_days enable row level security;
alter table public.xp_log enable row level security;
alter table public.ai_analyze_events enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "quests_select_own" on public.quests;
create policy "quests_select_own"
on public.quests for select
using (user_id = auth.uid());

drop policy if exists "quests_insert_own" on public.quests;
create policy "quests_insert_own"
on public.quests for insert
with check (user_id = auth.uid());

drop policy if exists "quests_update_own" on public.quests;
create policy "quests_update_own"
on public.quests for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "quest_days_select_own" on public.quest_days;
create policy "quest_days_select_own"
on public.quest_days for select
using (
  exists (
    select 1
    from public.quests q
    where q.id = quest_days.quest_id
      and q.user_id = auth.uid()
  )
);

drop policy if exists "quest_days_insert_own" on public.quest_days;
create policy "quest_days_insert_own"
on public.quest_days for insert
with check (
  exists (
    select 1
    from public.quests q
    where q.id = quest_days.quest_id
      and q.user_id = auth.uid()
  )
);

drop policy if exists "quest_days_update_own" on public.quest_days;
create policy "quest_days_update_own"
on public.quest_days for update
using (
  exists (
    select 1
    from public.quests q
    where q.id = quest_days.quest_id
      and q.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.quests q
    where q.id = quest_days.quest_id
      and q.user_id = auth.uid()
  )
);

drop policy if exists "xp_log_select_own" on public.xp_log;
create policy "xp_log_select_own"
on public.xp_log for select
using (user_id = auth.uid());

drop policy if exists "ai_events_select_own" on public.ai_analyze_events;
create policy "ai_events_select_own"
on public.ai_analyze_events for select
using (user_id = auth.uid());

drop policy if exists "ai_events_insert_own" on public.ai_analyze_events;
create policy "ai_events_insert_own"
on public.ai_analyze_events for insert
with check (user_id = auth.uid());

create or replace function public.toggle_mission_completion(
  p_quest_id uuid,
  p_day_number integer,
  p_mission_id text,
  p_completed boolean,
  p_client_event_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quest public.quests%rowtype;
  v_day public.quest_days%rowtype;
  v_profile public.profiles%rowtype;
  v_mission jsonb;
  v_completed_ids jsonb;
  v_was_completed boolean;
  v_was_day_completed boolean;
  v_all_main_completed boolean;
  v_xp_gained integer := 0;
  v_inserted_amount integer;
  v_today date;
  v_new_streak integer;
  v_quest_completed boolean := false;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_quest
  from public.quests
  where id = p_quest_id
    and user_id = v_user_id
    and status in ('active', 'completed');

  if not found then
    raise exception 'QUEST_NOT_FOUND';
  end if;

  select * into v_day
  from public.quest_days
  where quest_id = p_quest_id
    and day_number = p_day_number
  for update;

  if not found then
    raise exception 'QUEST_DAY_NOT_FOUND';
  end if;

  select elem into v_mission
  from jsonb_array_elements(v_day.missions) elem
  where elem->>'id' = p_mission_id
  limit 1;

  if v_mission is null then
    raise exception 'MISSION_NOT_FOUND';
  end if;

  v_completed_ids := coalesce(v_day.completed_mission_ids, '[]'::jsonb);
  v_was_completed := v_completed_ids ? p_mission_id;
  v_was_day_completed := v_day.is_day_completed;

  if p_completed and not v_was_completed then
    v_completed_ids := v_completed_ids || to_jsonb(p_mission_id);

    insert into public.xp_log (user_id, amount, reason, reference_id, idempotency_key)
    values (
      v_user_id,
      coalesce((v_mission->>'xp_reward')::integer, case v_mission->>'type' when 'bonus' then 30 when 'rest' then 20 else 50 end),
      'mission_complete',
      v_day.id,
      v_user_id::text || ':' || v_day.id::text || ':' || p_mission_id || ':complete'
    )
    on conflict (idempotency_key) do nothing
    returning amount into v_inserted_amount;

    v_xp_gained := v_xp_gained + coalesce(v_inserted_amount, 0);
  elsif not p_completed and v_was_completed then
    select coalesce(jsonb_agg(value), '[]'::jsonb) into v_completed_ids
    from jsonb_array_elements_text(v_completed_ids) as ids(value)
    where ids.value <> p_mission_id;
  end if;

  select coalesce(bool_and(v_completed_ids ? (mission->>'id')), false)
  into v_all_main_completed
  from jsonb_array_elements(v_day.missions) mission
  where mission->>'type' = 'main';

  update public.quest_days
  set
    completed_mission_ids = v_completed_ids,
    is_day_completed = v_all_main_completed,
    completed_at = case
      when v_all_main_completed and completed_at is null then now()
      when not v_all_main_completed then null
      else completed_at
    end
  where id = v_day.id
  returning * into v_day;

  if v_all_main_completed and not v_was_day_completed then
    insert into public.xp_log (user_id, amount, reason, reference_id, idempotency_key)
    values (
      v_user_id,
      100,
      'day_complete',
      v_day.id,
      v_user_id::text || ':' || v_day.id::text || ':day-complete'
    )
    on conflict (idempotency_key) do nothing
    returning amount into v_inserted_amount;

    v_xp_gained := v_xp_gained + coalesce(v_inserted_amount, 0);

    select * into v_profile
    from public.profiles
    where id = v_user_id
    for update;

    v_today := timezone(coalesce(v_profile.timezone, 'Asia/Ho_Chi_Minh'), now())::date;

    if v_profile.last_active_date is null or v_profile.last_active_date < (v_today - 1) then
      v_new_streak := 1;
    elsif v_profile.last_active_date = (v_today - 1) then
      v_new_streak := v_profile.streak_current + 1;
    else
      v_new_streak := v_profile.streak_current;
    end if;

    update public.profiles
    set
      streak_current = v_new_streak,
      streak_max = greatest(streak_max, v_new_streak),
      last_active_date = greatest(coalesce(last_active_date, v_today), v_today)
    where id = v_user_id
    returning * into v_profile;

    if v_new_streak > 0 and v_new_streak % 7 = 0 and v_profile.last_active_date = v_today then
      insert into public.xp_log (user_id, amount, reason, reference_id, idempotency_key)
      values (
        v_user_id,
        200,
        'streak_bonus',
        v_day.id,
        v_user_id::text || ':' || v_today::text || ':streak:' || v_new_streak::text
      )
      on conflict (idempotency_key) do nothing
      returning amount into v_inserted_amount;

      v_xp_gained := v_xp_gained + coalesce(v_inserted_amount, 0);
    end if;
  end if;

  if v_all_main_completed then
    if not exists (
      select 1
      from public.quest_days
      where quest_id = p_quest_id
        and is_day_completed = false
    ) then
      update public.quests
      set status = 'completed', completed_at = coalesce(completed_at, now())
      where id = p_quest_id
        and status <> 'completed'
      returning true into v_quest_completed;

      if coalesce(v_quest_completed, false) then
        insert into public.xp_log (user_id, amount, reason, reference_id, idempotency_key)
        values (
          v_user_id,
          500,
          'quest_complete',
          p_quest_id,
          v_user_id::text || ':' || p_quest_id::text || ':quest-complete'
        )
        on conflict (idempotency_key) do nothing
        returning amount into v_inserted_amount;

        v_xp_gained := v_xp_gained + coalesce(v_inserted_amount, 0);
      end if;
    end if;
  end if;

  if v_xp_gained <> 0 then
    update public.profiles
    set
      xp_total = xp_total + v_xp_gained,
      level = public.calculate_level(xp_total + v_xp_gained)
    where id = v_user_id
    returning * into v_profile;
  else
    select * into v_profile
    from public.profiles
    where id = v_user_id;
  end if;

  return jsonb_build_object(
    'quest_day', to_jsonb(v_day),
    'xp_gained', v_xp_gained,
    'xp_total', v_profile.xp_total,
    'level', v_profile.level,
    'streak_current', v_profile.streak_current,
    'streak_max', v_profile.streak_max
  );
end;
$$;

grant execute on function public.toggle_mission_completion(uuid, integer, text, boolean, text) to authenticated;

notify pgrst, 'reload schema';
