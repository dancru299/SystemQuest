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

  if p_day_number < 1 or p_day_number > v_quest.total_days then
    raise exception 'QUEST_DAY_NOT_FOUND';
  end if;

  if p_day_number > v_quest.current_day_number then
    raise exception 'QUEST_DAY_LOCKED';
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

    if p_day_number = v_quest.current_day_number then
      update public.quests
      set current_day_number = least(total_days, p_day_number + 1)
      where id = p_quest_id
      returning * into v_quest;
    end if;

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
    'streak_max', v_profile.streak_max,
    'current_day_number', v_quest.current_day_number
  );
end;
$$;

grant execute on function public.toggle_mission_completion(uuid, integer, text, boolean, text) to authenticated;

notify pgrst, 'reload schema';
