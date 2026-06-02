# Supabase Setup

If the app shows `Could not find the table 'public.profiles' in the schema cache`, the database migrations have not been applied to the Supabase project used by `.env.local`, or the API schema cache has not reloaded yet.

Run these files in Supabase Dashboard -> SQL Editor, in this exact order:

1. `supabase/migrations/202606020001_initial_schema.sql`
2. `supabase/migrations/202606020002_system_ai_settings.sql`
3. `supabase/migrations/202606020003_backfill_profiles.sql`
4. `supabase/migrations/202606020004_ai_settings_token_default.sql`
5. `supabase/migrations/202606020005_lock_future_quest_days.sql`
6. `supabase/migrations/202606020006_quest_day_reports.sql`
7. `supabase/migrations/202606020007_adaptive_planning_foundation.sql`

These files end with:

```sql
notify pgrst, 'reload schema';
```

After running them, restart the Next.js dev server and refresh the browser.

Quick verification SQL:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles', 'quests', 'quest_days', 'quest_day_reports', 'quest_goal_revisions', 'xp_log', 'ai_analyze_events', 'system_ai_settings')
order by table_name;
```

Expected tables:

- `ai_analyze_events`
- `profiles`
- `quest_day_reports`
- `quest_days`
- `quest_goal_revisions`
- `quests`
- `system_ai_settings`
- `xp_log`
