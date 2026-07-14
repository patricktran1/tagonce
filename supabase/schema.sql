-- Planned production schema. The local MVP does not require Supabase.

create extension if not exists pgcrypto;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists mention_entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  display_name text not null,
  entity_type text not null check (entity_type in ('person', 'company', 'brand', 'organization')),
  description text,
  website_url text,
  auto_tag_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mention_platform_accounts (
  id uuid primary key default gen_random_uuid(),
  mention_entity_id uuid not null references mention_entities(id) on delete cascade,
  platform text not null,
  platform_display_name text,
  platform_handle text,
  platform_entity_id text,
  platform_urn text,
  profile_url text,
  verification_status text not null default 'unverified',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mention_entity_id, platform)
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  master_text text not null,
  status text not null default 'draft',
  scheduled_for timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_mentions (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  mention_entity_id uuid not null references mention_entities(id) on delete cascade,
  primary key (campaign_id, mention_entity_id)
);

create table if not exists content_variants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  platform text not null,
  title text,
  body text not null,
  hashtags jsonb not null default '[]'::jsonb,
  mention_payload jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, platform)
);

create table if not exists publish_jobs (
  id uuid primary key default gen_random_uuid(),
  content_variant_id uuid not null references content_variants(id) on delete cascade,
  scheduled_for timestamptz,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  idempotency_key text not null unique,
  platform_post_id text,
  published_url text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
