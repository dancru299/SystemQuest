alter table public.quests
  add column if not exists goal_contract jsonb not null default '{}'::jsonb,
  add column if not exists roadmap jsonb not null default '[]'::jsonb,
  add column if not exists goal_version integer not null default 1 check (goal_version >= 1),
  add column if not exists generated_window_days integer not null default 7 check (generated_window_days between 1 and 14);

do $$
begin
  alter table public.quests drop constraint if exists quests_total_days_check;
  alter table public.quests
    add constraint quests_total_days_check check (total_days between 1 and 7300);
exception
  when duplicate_object then null;
end $$;

update public.quests
set
  goal_contract = case
    when goal_contract = '{}'::jsonb then jsonb_build_object(
      'objective', main_goal,
      'deadline', 'Trong ' || total_days::text || ' ngay',
      'targetDurationDays', total_days,
      'constraints', '[]'::jsonb,
      'successCriteria', jsonb_build_array('Hoan thanh muc tieu chinh dung han.'),
      'nonNegotiables', jsonb_build_array('Muc tieu va deadline cua version hien tai.')
    )
    else goal_contract
  end,
  roadmap = case
    when roadmap = '[]'::jsonb then coalesce(phases, '[]'::jsonb)
    else roadmap
  end,
  generated_window_days = least(greatest(generated_up_to_day, 1), 7)
where true;

create table if not exists public.quest_goal_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  goal_contract jsonb not null,
  roadmap jsonb not null default '[]'::jsonb,
  reason text,
  created_at timestamptz not null default now(),
  unique (quest_id, version_number)
);

create index if not exists quest_goal_revisions_user_created_idx
on public.quest_goal_revisions (user_id, created_at desc);

alter table public.quest_goal_revisions enable row level security;

drop policy if exists "quest_goal_revisions_select_own" on public.quest_goal_revisions;
create policy "quest_goal_revisions_select_own"
on public.quest_goal_revisions for select
using (user_id = (select auth.uid()));

drop policy if exists "quest_goal_revisions_insert_own" on public.quest_goal_revisions;
create policy "quest_goal_revisions_insert_own"
on public.quest_goal_revisions for insert
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.quests q
    where q.id = quest_goal_revisions.quest_id
      and q.user_id = (select auth.uid())
  )
);

insert into public.quest_goal_revisions (user_id, quest_id, version_number, goal_contract, roadmap, reason)
select user_id, id, goal_version, goal_contract, roadmap, 'Initial adaptive planning contract'
from public.quests q
where not exists (
  select 1
  from public.quest_goal_revisions r
  where r.quest_id = q.id
    and r.version_number = q.goal_version
);

notify pgrst, 'reload schema';
