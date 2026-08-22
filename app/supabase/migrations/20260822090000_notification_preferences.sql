create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default true,
  due_reminders_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;

create or replace function public.get_my_notification_preferences()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  insert into public.notification_preferences (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  return (select jsonb_build_object('push_enabled', push_enabled, 'due_reminders_enabled', due_reminders_enabled) from public.notification_preferences where user_id = auth.uid());
end; $$;

create or replace function public.update_my_notification_preferences(push_enabled_input boolean, due_reminders_enabled_input boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  insert into public.notification_preferences (user_id, push_enabled, due_reminders_enabled)
  values (auth.uid(), push_enabled_input, due_reminders_enabled_input)
  on conflict (user_id) do update set push_enabled = excluded.push_enabled, due_reminders_enabled = excluded.due_reminders_enabled, updated_at = now();
  return jsonb_build_object('push_enabled', push_enabled_input, 'due_reminders_enabled', due_reminders_enabled_input);
end; $$;
grant execute on function public.get_my_notification_preferences() to authenticated;
grant execute on function public.update_my_notification_preferences(boolean, boolean) to authenticated;
