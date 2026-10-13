create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('resident', 'worker', 'dispatcher', 'admin', 'analyst');
create type public.account_status as enum ('active', 'suspended', 'invited');
create type public.report_status as enum ('submitted', 'validated', 'pending_assignment', 'assigned', 'in_progress', 'completed', 'needs_review', 'partially_completed', 'inaccessible', 'rejected_duplicate', 'reopened');
create type public.report_category as enum ('overflowing_bin', 'missed_collection', 'litter_hotspot', 'illegal_dumping', 'recyclable_material', 'other');
create type public.priority_label as enum ('low', 'medium', 'high', 'urgent');
create type public.report_source as enum ('resident', 'worker', 'sensor_simulated');
create type public.route_plan_status as enum ('proposed', 'approved', 'in_progress', 'completed');
create type public.stop_outcome as enum ('pending', 'started', 'completed', 'partially_completed', 'inaccessible', 'needs_follow_up');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'resident',
  status public.account_status not null default 'active',
  display_name text not null default '',
  phone text,
  language text not null default 'en' check (language in ('en', 'hi', 'kn')),
  notification_prefs jsonb not null default '{"inApp":true,"email":false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  boundary extensions.geography(MultiPolygon, 4326) not null,
  rules jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.depots (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid not null references public.service_areas(id),
  name text not null,
  location extensions.geography(Point, 4326) not null,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid not null references public.service_areas(id),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  home_depot_id uuid references public.depots(id),
  service_area_id uuid references public.service_areas(id),
  name text not null,
  vehicle_type text not null,
  capacity numeric not null check (capacity > 0),
  is_available boolean not null default true,
  access_restrictions jsonb not null default '[]'::jsonb,
  accepted_categories public.report_category[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.waste_reports (
  id uuid primary key default gen_random_uuid(),
  report_code text unique,
  reporter_id uuid references public.profiles(id) on delete set null,
  service_area_id uuid references public.service_areas(id),
  category public.report_category not null,
  description text not null check (char_length(description) between 8 and 2000),
  location extensions.geography(Point, 4326) not null,
  address text,
  photo_path text,
  priority_score numeric not null default 0 check (priority_score between 0 and 100),
  priority_label public.priority_label not null default 'low',
  priority_factors jsonb not null default '[]'::jsonb,
  status public.report_status not null default 'submitted',
  source public.report_source not null default 'resident',
  duplicate_of uuid references public.waste_reports(id),
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index waste_reports_status_created_idx on public.waste_reports(status, created_at desc);
create index waste_reports_area_status_idx on public.waste_reports(service_area_id, status);
create index waste_reports_location_gist_idx on public.waste_reports using gist(location);
create index waste_reports_reporter_created_idx on public.waste_reports(reporter_id, created_at desc);

create table public.classification_results (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.waste_reports(id) on delete cascade,
  predicted_category public.report_category not null,
  waste_type text not null,
  confidence numeric not null check (confidence between 0 and 1),
  visible_evidence text not null default '',
  warnings jsonb not null default '[]'::jsonb,
  model_version text not null,
  latency_ms integer,
  fallback boolean not null default false,
  reviewed_category public.report_category,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index classification_results_report_created_idx on public.classification_results(report_id, created_at desc);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.waste_reports(id),
  worker_id uuid not null references public.profiles(id),
  team_id uuid references public.teams(id),
  vehicle_id uuid references public.vehicles(id),
  due_at timestamptz not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(report_id, worker_id, created_at)
);
create index assignments_worker_due_idx on public.assignments(worker_id, due_at);

create table public.route_plans (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid not null references public.service_areas(id),
  plan_date date not null,
  shift_start time not null,
  shift_end time not null,
  algorithm_version text not null,
  metrics jsonb not null default '{}'::jsonb,
  unassigned jsonb not null default '[]'::jsonb,
  status public.route_plan_status not null default 'proposed',
  approved_by uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (shift_end > shift_start)
);

create table public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_plan_id uuid not null references public.route_plans(id) on delete cascade,
  report_id uuid not null references public.waste_reports(id),
  vehicle_id uuid not null references public.vehicles(id),
  sequence integer not null check (sequence > 0),
  eta timestamptz,
  service_minutes integer not null default 8 check (service_minutes >= 0),
  capacity_units numeric not null default 1 check (capacity_units >= 0),
  outcome public.stop_outcome not null default 'pending',
  note text,
  evidence_photo_path text,
  completed_at timestamptz,
  distance_to_stop_m numeric,
  unique(route_plan_id, vehicle_id, sequence),
  unique(route_plan_id, report_id)
);
create index route_stops_vehicle_sequence_idx on public.route_stops(vehicle_id, sequence);

create table public.status_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.waste_reports(id) on delete cascade,
  from_status public.report_status,
  to_status public.report_status not null,
  actor_id uuid references public.profiles(id),
  actor_role public.user_role,
  note text,
  created_at timestamptz not null default now()
);
create index status_events_report_created_idx on public.status_events(report_id, created_at);

create table public.bins (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid references public.service_areas(id),
  code text not null unique,
  location extensions.geography(Point, 4326) not null,
  is_simulated boolean not null default true,
  flagged_anomaly text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index bins_location_gist_idx on public.bins using gist(location);

create table public.sensor_readings (
  id uuid primary key default gen_random_uuid(),
  bin_id uuid not null references public.bins(id) on delete cascade,
  fill_level numeric not null check (fill_level between 0 and 100),
  observed_at timestamptz not null,
  is_simulated boolean not null default true,
  is_valid boolean not null default false,
  validation_note text,
  created_at timestamptz not null default now()
);
create index sensor_readings_bin_observed_idx on public.sensor_readings(bin_id, observed_at desc);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.waste_reports(id) on delete cascade,
  resident_id uuid not null references public.profiles(id),
  rating smallint not null check (rating between 1 and 5),
  resolved boolean not null,
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null check (kind in ('received', 'assigned', 'resolved', 'urgent', 'overdue')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id text not null,
  change jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log(created_at desc);

create table public.travel_matrix_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  origin_lat numeric not null,
  origin_lng numeric not null,
  destination_lat numeric not null,
  destination_lng numeric not null,
  distance_m numeric not null,
  duration_s numeric not null,
  provider text not null,
  is_approximate boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index travel_matrix_cache_expiry_idx on public.travel_matrix_cache(expires_at);

create table public.worker_locations (
  worker_id uuid primary key references public.profiles(id) on delete cascade,
  location extensions.geography(Point, 4326) not null,
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index worker_locations_expiry_idx on public.worker_locations(expires_at);
create index worker_locations_gist_idx on public.worker_locations using gist(location);

create table public.system_settings (
  id boolean primary key default true check (id),
  ai_confidence_threshold numeric not null default 0.65 check (ai_confidence_threshold between 0 and 1),
  priority_weights jsonb not null default '{"category":10,"age":10,"sensitive":10,"repeat":10,"fill":10}'::jsonb,
  fuel_per_km_l numeric not null default 0.22,
  emission_kg_per_l numeric not null default 2.68,
  retention_days integer not null default 90 check (retention_days > 0),
  duplicate_radius_m integer not null default 50 check (duplicate_radius_m > 0),
  duplicate_window_hours integer not null default 72 check (duplicate_window_hours > 0),
  updated_at timestamptz not null default now()
);
insert into public.system_settings(id) values (true) on conflict (id) do nothing;

create sequence public.report_code_seq start 1;
create function public.assign_report_code() returns trigger language plpgsql as $$
begin
  if new.report_code is null then
    new.report_code := 'EB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.report_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
create trigger waste_reports_code before insert on public.waste_reports for each row execute function public.assign_report_code();

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger service_areas_touch before update on public.service_areas for each row execute function public.touch_updated_at();
create trigger vehicles_touch before update on public.vehicles for each row execute function public.touch_updated_at();
create trigger waste_reports_touch before update on public.waste_reports for each row execute function public.touch_updated_at();
create trigger route_plans_touch before update on public.route_plans for each row execute function public.touch_updated_at();

create function public.create_resident_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, role, status, display_name)
  values (new.id, 'resident', 'active', coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_resident_profile();

create function public.current_user_role() returns public.user_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid()) and status = 'active'
$$;
create function public.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_user_role() in ('worker', 'dispatcher', 'admin', 'analyst'), false)
$$;
create function public.can_view_report(target_report uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    public.current_user_role() is not null and (
      public.current_user_role() in ('dispatcher', 'admin', 'analyst')
      or exists (select 1 from public.waste_reports r where r.id = target_report and r.reporter_id = (select auth.uid()))
      or (public.current_user_role() = 'worker' and exists (select 1 from public.assignments a where a.report_id = target_report and a.worker_id = (select auth.uid())))
    ),
    false
  )
$$;

create function public.reject_immutable_change() returns trigger language plpgsql as $$
begin
  raise exception 'This record is immutable';
end;
$$;
create trigger status_events_immutable before update or delete on public.status_events for each row execute function public.reject_immutable_change();
create trigger audit_log_immutable before update or delete on public.audit_log for each row execute function public.reject_immutable_change();

alter table public.profiles enable row level security;
alter table public.service_areas enable row level security;
alter table public.depots enable row level security;
alter table public.teams enable row level security;
alter table public.vehicles enable row level security;
alter table public.waste_reports enable row level security;
alter table public.classification_results enable row level security;
alter table public.assignments enable row level security;
alter table public.route_plans enable row level security;
alter table public.route_stops enable row level security;
alter table public.status_events enable row level security;
alter table public.bins enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.feedback enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;
alter table public.travel_matrix_cache enable row level security;
alter table public.worker_locations enable row level security;
alter table public.system_settings enable row level security;

create policy profiles_self_read on public.profiles for select to authenticated using ((id = (select auth.uid()) and status = 'active') or public.current_user_role() in ('dispatcher', 'admin'));
create policy profiles_admin_manage on public.profiles for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy service_areas_authenticated_read on public.service_areas for select to authenticated using (true);
create policy service_areas_admin_manage on public.service_areas for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy depots_staff_read on public.depots for select to authenticated using (public.is_staff());
create policy depots_admin_manage on public.depots for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy teams_staff_read on public.teams for select to authenticated using (public.is_staff());
create policy teams_admin_manage on public.teams for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy vehicles_staff_read on public.vehicles for select to authenticated using (public.is_staff());
create policy vehicles_admin_manage on public.vehicles for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy reports_scoped_read on public.waste_reports for select to authenticated using (public.can_view_report(id));
create policy reports_create on public.waste_reports for insert to authenticated with check (public.current_user_role() in ('resident', 'worker') and (reporter_id = (select auth.uid()) or (public.current_user_role() = 'worker' and reporter_id is null)));
create policy reports_staff_update on public.waste_reports for update to authenticated using (public.current_user_role() in ('worker', 'dispatcher', 'admin')) with check (public.current_user_role() in ('worker', 'dispatcher', 'admin'));
create policy classifications_scoped_read on public.classification_results for select to authenticated using (public.can_view_report(report_id));
create policy classifications_staff_insert on public.classification_results for insert to authenticated with check (public.current_user_role() in ('dispatcher', 'admin'));
create policy classifications_staff_update on public.classification_results for update to authenticated using (public.current_user_role() in ('dispatcher', 'admin')) with check (public.current_user_role() in ('dispatcher', 'admin'));
create policy assignments_scoped_read on public.assignments for select to authenticated using (worker_id = (select auth.uid()) or public.current_user_role() in ('dispatcher', 'admin'));
create policy assignments_dispatch_manage on public.assignments for all to authenticated using (public.current_user_role() in ('dispatcher', 'admin')) with check (public.current_user_role() in ('dispatcher', 'admin'));
create policy route_plans_staff_read on public.route_plans for select to authenticated using (public.current_user_role() in ('worker', 'dispatcher', 'admin', 'analyst'));
create policy route_plans_dispatch_manage on public.route_plans for all to authenticated using (public.current_user_role() in ('dispatcher', 'admin')) with check (public.current_user_role() in ('dispatcher', 'admin'));
create policy route_stops_scoped_read on public.route_stops for select to authenticated using (exists (select 1 from public.assignments a where a.report_id = route_stops.report_id and a.worker_id = (select auth.uid())) or public.current_user_role() in ('dispatcher', 'admin', 'analyst'));
create policy route_stops_worker_update on public.route_stops for update to authenticated using (public.current_user_role() in ('worker', 'dispatcher', 'admin') and (public.current_user_role() <> 'worker' or exists (select 1 from public.assignments a where a.report_id = route_stops.report_id and a.worker_id = (select auth.uid())))) with check (public.current_user_role() in ('worker', 'dispatcher', 'admin'));
create policy status_events_scoped_read on public.status_events for select to authenticated using (public.can_view_report(report_id));
create policy status_events_actor_insert on public.status_events for insert to authenticated with check (actor_id = (select auth.uid()) or public.current_user_role() = 'admin');
create policy bins_staff_read on public.bins for select to authenticated using (public.is_staff());
create policy bins_admin_manage on public.bins for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy sensor_readings_staff_read on public.sensor_readings for select to authenticated using (public.is_staff());
create policy feedback_owner_read on public.feedback for select to authenticated using (public.current_user_role() is not null and (resident_id = (select auth.uid()) or public.current_user_role() in ('dispatcher', 'admin')));
create policy feedback_owner_create on public.feedback for insert to authenticated with check (resident_id = (select auth.uid()) and exists (select 1 from public.waste_reports r where r.id = report_id and r.reporter_id = (select auth.uid())));
create policy notifications_owner_manage on public.notifications for all to authenticated using (public.current_user_role() is not null and user_id = (select auth.uid())) with check (public.current_user_role() is not null and user_id = (select auth.uid()));
create policy audit_admin_read on public.audit_log for select to authenticated using (public.current_user_role() = 'admin');
create policy audit_admin_insert on public.audit_log for insert to authenticated with check (public.current_user_role() = 'admin');
create policy travel_cache_staff_read on public.travel_matrix_cache for select to authenticated using (public.is_staff());
create policy worker_locations_dispatch_read on public.worker_locations for select to authenticated using (public.current_user_role() in ('dispatcher', 'admin'));
create policy worker_locations_self_manage on public.worker_locations for all to authenticated using (worker_id = (select auth.uid()) and public.current_user_role() = 'worker') with check (worker_id = (select auth.uid()) and public.current_user_role() = 'worker');
create policy system_settings_staff_read on public.system_settings for select to authenticated using (public.current_user_role() in ('dispatcher', 'admin', 'analyst'));
create policy system_settings_admin_manage on public.system_settings for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 8000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy report_photos_owner_read on storage.objects for select to authenticated using (
  bucket_id = 'report-photos' and exists (
    select 1 from public.waste_reports r
    where r.photo_path = name and public.can_view_report(r.id)
  )
);
create policy report_photos_reporter_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'report-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
);
