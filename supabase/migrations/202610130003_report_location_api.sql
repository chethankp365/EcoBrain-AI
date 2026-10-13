alter table public.waste_reports
  add column latitude double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  add column longitude double precision generated always as (extensions.st_x(location::extensions.geometry)) stored;

create function public.service_area_for_point(point_latitude double precision, point_longitude double precision)
returns table (id uuid, name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select area.id, area.name
  from public.service_areas as area
  where area.is_active
    and extensions.st_covers(
      area.boundary::extensions.geometry,
      extensions.st_setsrid(extensions.st_makepoint(point_longitude, point_latitude), 4326)
    )
  order by area.created_at
  limit 1
$$;

grant execute on function public.service_area_for_point(double precision, double precision)
to authenticated, service_role;

create function public.record_new_report_status() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.status_events (report_id, to_status, actor_id, actor_role, note)
  values (
    new.id,
    new.status,
    new.reporter_id,
    case when new.source = 'worker' then 'worker'::public.user_role else 'resident'::public.user_role end,
    'Report submitted'
  );
  return new;
end;
$$;

create trigger waste_reports_initial_status_event
after insert on public.waste_reports
for each row execute function public.record_new_report_status();

create function public.set_report_status(
  target_report_id uuid,
  next_status public.report_status,
  actor_profile_id uuid,
  actor_user_role public.user_role,
  event_note text
)
returns public.waste_reports
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_report public.waste_reports;
  previous_status public.report_status;
begin
  select status into previous_status
  from public.waste_reports
  where id = target_report_id
  for update;

  if not found then
    raise exception 'Report not found';
  end if;

  update public.waste_reports
  set status = next_status
  where id = target_report_id
  returning * into updated_report;

  insert into public.status_events (
    report_id, from_status, to_status, actor_id, actor_role, note
  )
  values (
    target_report_id,
    previous_status,
    next_status,
    actor_profile_id,
    actor_user_role,
    event_note
  );

  return updated_report;
end;
$$;

revoke all on function public.set_report_status(uuid, public.report_status, uuid, public.user_role, text)
from public, anon, authenticated;
grant execute on function public.set_report_status(uuid, public.report_status, uuid, public.user_role, text)
to service_role;
