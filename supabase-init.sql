-- Homework Tracker / Supabase initialization script
-- Execute in Supabase SQL Editor

begin;

create table if not exists public.classes (
  id bigint generated always as identity primary key,
  name varchar(100) not null unique,
  class_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists classes_name_idx on public.classes(name);

create table if not exists public.students (
  id bigint generated always as identity primary key,
  class_id bigint not null references public.classes(id) on delete cascade,
  name varchar(100) not null,
  student_code varchar(50) not null,
  avatar_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists students_class_id_idx on public.students(class_id);
create index if not exists students_student_code_idx on public.students(student_code);
create index if not exists students_name_idx on public.students(name);

create table if not exists public.subjects (
  id bigint generated always as identity primary key,
  class_id bigint not null references public.classes(id) on delete cascade,
  name varchar(100) not null,
  subject_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists subjects_class_id_idx on public.subjects(class_id);
create index if not exists subjects_name_idx on public.subjects(name);

create table if not exists public.homework_records (
  id bigint generated always as identity primary key,
  class_id bigint not null references public.classes(id) on delete cascade,
  student_id bigint not null references public.students(id) on delete cascade,
  subject_id bigint not null references public.subjects(id) on delete cascade,
  submit_date varchar(10) not null,
  submit_time timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists homework_records_class_id_idx on public.homework_records(class_id);
create index if not exists homework_records_student_id_idx on public.homework_records(student_id);
create index if not exists homework_records_subject_id_idx on public.homework_records(subject_id);
create index if not exists homework_records_submit_date_idx on public.homework_records(submit_date);
create unique index if not exists homework_records_unique_idx on public.homework_records(student_id, subject_id, submit_date);

create table if not exists public.homework_exemptions (
  id bigint generated always as identity primary key,
  class_id bigint not null references public.classes(id) on delete cascade,
  student_id bigint not null references public.students(id) on delete cascade,
  subject_id bigint not null references public.subjects(id) on delete cascade,
  exempt_date varchar(10) not null,
  reason varchar(255),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists homework_exemptions_class_id_idx on public.homework_exemptions(class_id);
create index if not exists homework_exemptions_student_id_idx on public.homework_exemptions(student_id);
create index if not exists homework_exemptions_subject_id_idx on public.homework_exemptions(subject_id);
create index if not exists homework_exemptions_date_idx on public.homework_exemptions(exempt_date);
create index if not exists homework_exemptions_unique_idx on public.homework_exemptions(student_id, subject_id, exempt_date);

create table if not exists public.system_configs (
  id bigint generated always as identity primary key,
  class_id bigint references public.classes(id) on delete cascade,
  scan_start_time varchar(5) not null default '07:00',
  scan_end_time varchar(5) not null default '12:00',
  alert_continuous_days int not null default 3,
  reminder_broadcast_times int not null default 1,
  reminder_schedule_times text,
  reminder_poll_interval_minutes int not null default 5,
  student_reminder_voice_enabled boolean not null default true,
  global_task_status varchar(20) not null default 'semester',
  today_override_date varchar(10),
  today_override_status varchar(20) default 'auto',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.system_configs
add column if not exists reminder_broadcast_times int not null default 1;

alter table public.system_configs
add column if not exists reminder_schedule_times text;

alter table public.system_configs
add column if not exists reminder_poll_interval_minutes int not null default 5;

alter table public.system_configs
add column if not exists student_reminder_voice_enabled boolean not null default true;

-- Upgrade path: ensure duplicate submissions are prevented at DB level.
drop index if exists public.homework_records_unique_idx;
create unique index if not exists homework_records_unique_idx
on public.homework_records(student_id, subject_id, submit_date);

create index if not exists system_configs_class_id_idx on public.system_configs(class_id);

create table if not exists public.health_check (
  id bigint generated always as identity primary key,
  updated_at timestamptz default now()
);

-- Dev setup: disable RLS on core tables to allow anon key CRUD.
-- If you plan to go to production, replace this with explicit RLS policies.
alter table public.classes disable row level security;
alter table public.students disable row level security;
alter table public.subjects disable row level security;
alter table public.homework_records disable row level security;
alter table public.homework_exemptions disable row level security;
alter table public.system_configs disable row level security;

-- Ensure one global config row exists (class_id is null)
insert into public.system_configs (class_id)
select null
where not exists (
  select 1 from public.system_configs where class_id is null
);

-- Dev testing default: current global polling interval set to 1 minute.
update public.system_configs
set reminder_poll_interval_minutes = 1
where class_id is null;

commit;
