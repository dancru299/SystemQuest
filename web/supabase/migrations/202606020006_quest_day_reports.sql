create table if not exists public.quest_day_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  quest_day_id uuid not null references public.quest_days(id) on delete cascade,
  day_number integer not null check (day_number >= 1),
  overall_completion_percent integer not null default 0 check (overall_completion_percent between 0 and 100),
  time_spent_minutes integer not null default 0 check (time_spent_minutes between 0 and 1440),
  blockers text,
  outcome text,
  notes text,
  evidence_url text,
  mission_reports jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quest_day_id),
  unique (quest_id, day_number)
);

create index if not exists quest_day_reports_user_submitted_idx
on public.quest_day_reports (user_id, submitted_at desc);

create index if not exists quest_day_reports_quest_day_idx
on public.quest_day_reports (quest_id, day_number);

drop trigger if exists quest_day_reports_set_updated_at on public.quest_day_reports;
create trigger quest_day_reports_set_updated_at
before update on public.quest_day_reports
for each row execute function public.set_updated_at();

alter table public.quest_day_reports enable row level security;

drop policy if exists "quest_day_reports_select_own" on public.quest_day_reports;
create policy "quest_day_reports_select_own"
on public.quest_day_reports for select
using (user_id = (select auth.uid()));

drop policy if exists "quest_day_reports_insert_own" on public.quest_day_reports;
create policy "quest_day_reports_insert_own"
on public.quest_day_reports for insert
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.quests q
    where q.id = quest_day_reports.quest_id
      and q.user_id = (select auth.uid())
  )
);

drop policy if exists "quest_day_reports_update_own" on public.quest_day_reports;
create policy "quest_day_reports_update_own"
on public.quest_day_reports for update
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "quest_day_reports_delete_own" on public.quest_day_reports;
create policy "quest_day_reports_delete_own"
on public.quest_day_reports for delete
using (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
