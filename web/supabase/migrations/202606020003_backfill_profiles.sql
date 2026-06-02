insert into public.profiles (id, email, display_name, avatar_url)
select
  users.id,
  coalesce(users.email, ''),
  coalesce(
    users.raw_user_meta_data->>'display_name',
    users.raw_user_meta_data->>'full_name',
    split_part(coalesce(users.email, 'Adventurer'), '@', 1)
  ),
  users.raw_user_meta_data->>'avatar_url'
from auth.users
where not exists (
  select 1
  from public.profiles profiles
  where profiles.id = users.id
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
