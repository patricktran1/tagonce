# TagOnce production architecture

## Design principle

AI transforms content. Deterministic application code owns identity resolution, validation, credentials, scheduling, retries, and publishing.

## Recommended services

- React application for the user interface
- PostgreSQL for workspaces, entities, campaigns, and publish history
- Object storage for media
- Server-side OAuth callback handlers
- Encrypted credential vault
- Durable job queue for scheduled publishing
- Worker processes for platform adapters
- Webhook endpoint for platform status updates
- Structured AI endpoint for platform copy generation

## Core tables

### workspaces
- id
- name
- owner_id
- created_at

### workspace_members
- workspace_id
- user_id
- role

### mention_entities
- id
- workspace_id
- display_name
- entity_type
- description
- website_url
- auto_tag_approved
- created_at
- updated_at

### mention_platform_accounts
- id
- mention_entity_id
- platform
- platform_display_name
- platform_handle
- platform_entity_id
- platform_urn
- profile_url
- verification_status
- verified_at

### campaigns
- id
- workspace_id
- title
- master_text
- status
- scheduled_for
- created_by
- created_at
- updated_at

### campaign_mentions
- campaign_id
- mention_entity_id

### content_variants
- id
- campaign_id
- platform
- title
- body
- hashtags
- mention_payload
- status
- updated_at

### publish_jobs
- id
- content_variant_id
- scheduled_for
- status
- attempt_count
- idempotency_key
- platform_post_id
- published_url
- error_code
- error_message

## Publishing lifecycle

1. Validate connected account and token state.
2. Validate text and media against the platform adapter.
3. Resolve every mention into a native identifier or explicit fallback.
4. Create an idempotency key.
5. Upload media.
6. Publish the platform payload.
7. Persist external post identifiers.
8. Retry transient failures without republishing successful jobs.
9. Display partial success accurately.

## Security boundaries

- OAuth tokens stay on the server.
- Refresh tokens are encrypted at rest.
- Browser clients receive connection status, never secrets.
- Workspace membership is enforced in the database.
- Publishing actions are written to an audit log.
- AI output cannot directly invoke platform APIs.
