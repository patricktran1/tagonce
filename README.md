# TagOnce

**Mention once. Publish everywhere.**

TagOnce is a working front-end MVP for creating one master social post, mapping people and companies once, generating platform-native variants, and preflighting every mention before publishing.

The current release deliberately uses local persistence and mock publishing adapters so it runs without paid AI credits, OAuth credentials, or a backend. The architecture is designed to accept real platform adapters and a hosted database next.

## What works now

- Master campaign composer
- Cross-platform mention directory
- Reusable person, company, brand, and organization identities
- Platform-specific handles and IDs
- Mention readiness matrix
- Facebook, LinkedIn, Instagram, X, Threads, TikTok, and YouTube variants
- Deterministic hashtag generation
- Editable platform previews
- Optional image upload and preview
- Simulated multi-platform publishing queue
- Campaign history
- Brand voice defaults
- Browser persistence through `localStorage`
- Responsive desktop and mobile layouts
- Unit tests for mention resolution and content constraints

## Local setup

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Validation

```bash
npm run build
npm test
npm run lint
```

## Application structure

```text
src/
  components/
    AddEntityModal.tsx
    CampaignsPage.tsx
    ComposePage.tsx
    Header.tsx
    MentionDirectory.tsx
    PlatformMark.tsx
    SettingsPage.tsx
    Sidebar.tsx
  data/
    demo.ts
  lib/
    contentEngine.ts
    platformAdapters.ts
    storage.ts
  App.tsx
  types.ts
```

## Core model

A mention is not stored as a plain `@handle`. It is stored as a reusable entity with platform-specific mappings.

```ts
interface MentionEntity {
  id: string;
  displayName: string;
  type: 'person' | 'company' | 'brand' | 'organization';
  mappings: Partial<Record<Platform, PlatformMapping>>;
}
```

The content engine resolves each entity separately for each platform and returns one of four states:

- `resolved`
- `plain_text`
- `missing`
- `unsupported`

The UI never silently pretends a plain-text handle is a native clickable tag.

## Publishing architecture

`src/lib/platformAdapters.ts` defines the adapter boundary:

```ts
interface PlatformAdapter {
  platform: Platform;
  validate(variant: PlatformVariant): string[];
  publish(variant: PlatformVariant): Promise<PublishResult>;
}
```

The current implementation is a mock adapter. Each official integration can replace it without rewriting the composer, mention directory, campaign model, or preflight UI.

## Next production milestones

1. Add authentication and workspace persistence with Supabase or PostgreSQL.
2. Encrypt OAuth credentials on the server, never in browser storage.
3. Add official platform OAuth connections.
4. Replace mock adapters one platform at a time.
5. Add a durable publish queue with idempotency keys and retries.
6. Add structured AI generation behind a server endpoint.
7. Add analytics normalization and scheduling.

## Environment variables

No environment variables are required for this MVP. See `.env.example` for the planned production variables.

## Product naming

`TagOnce` is the working product name. Complete trademark, app-store, social-handle, and domain clearance before public launch.
