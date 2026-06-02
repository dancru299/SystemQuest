alter table public.profiles
add column if not exists is_admin boolean not null default false;

create table if not exists public.system_ai_settings (
  id boolean primary key default true check (id),
  provider_priority text[] not null default array['gemini', 'openai', 'anthropic'],
  gemini_api_key text,
  gemini_model text not null default 'gemini-3.5-flash',
  openai_api_key text,
  openai_model text not null default 'gpt-4.1-mini',
  anthropic_api_key text,
  anthropic_model text not null default 'claude-sonnet-4-20250514',
  system_prompt text,
  temperature numeric(3, 2) not null default 0.35 check (temperature >= 0 and temperature <= 2),
  max_tokens integer not null default 4000 check (max_tokens between 512 and 16000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.system_ai_settings (id)
values (true)
on conflict (id) do nothing;

drop trigger if exists system_ai_settings_set_updated_at on public.system_ai_settings;
create trigger system_ai_settings_set_updated_at
before update on public.system_ai_settings
for each row execute function public.set_updated_at();

alter table public.system_ai_settings enable row level security;

drop policy if exists "system_ai_settings_no_direct_access" on public.system_ai_settings;
create policy "system_ai_settings_no_direct_access"
on public.system_ai_settings
as restrictive
for all
using (false)
with check (false);

notify pgrst, 'reload schema';
