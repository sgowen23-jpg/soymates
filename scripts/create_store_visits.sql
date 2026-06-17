-- store_visits table
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Session A of the Coverage feature build.

create table if not exists store_visits (
  -- upsert key: system-assigned, unique, stable across weekly re-exports of the same cycle
  schedule_id          bigint primary key,

  -- scheduling system secondary ID (stored, not used for joins)
  schedule_people_id   bigint,

  -- join key: matches stores.location_id_dist (~97% of rows; ~3% out-of-territory, kept per keep-everything rule)
  location_no          bigint,

  -- store identity (denormalised — same pattern as bnb_26wk; avoids join overhead in Coverage queries)
  store_name           text,
  state                text,           -- VIC / SA / NSW / QLD / WA
  group_name           text,           -- banner group, e.g. "INDIES IGA MEDIUM (AU)"

  -- visit identity
  rep                  text,
  cycle                text,           -- e.g. "2026 Cycle 1"
  schedule_state       text,           -- Successful / Scheduled / Cancelled / No Show
                                       -- ALL states stored. UI defaults to Successful.
                                       -- Non-Successful rows are the actuals side of Session E plan-vs-actual.
  date_scheduled       date,           -- day-grain; only daily-resolution source across all four data feeds
  work_type            text,
  schedule_type        text,

  -- timing
  start_task           timestamptz,
  end_task             timestamptz,
  budgeted_duration    integer,        -- minutes
  actual_duration      integer,        -- minutes (Reported Minutes column)
  timer_minutes        integer,        -- raw timer (may differ from reported)
  kms                  numeric(6,1),

  -- activity
  forms                integer,
  photos               integer,
  schedule_comment     text,
  manager_comment      text,

  -- metadata
  last_modified        timestamptz,
  uploaded_at          timestamptz not null default now()
);

create index if not exists store_visits_location_no_idx on store_visits (location_no);
create index if not exists store_visits_rep_cycle_idx   on store_visits (rep, cycle);
create index if not exists store_visits_date_idx        on store_visits (date_scheduled);
