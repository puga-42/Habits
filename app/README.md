# Habits — Expo client

React Native client for the Habits app.

See [`../CONTEXT.md`](../CONTEXT.md) for the architecture and vocabulary, and
[`../WIREFRAMES.md`](../WIREFRAMES.md) for the screens.

## Run

```bash
npm install         # first time only
npm start           # Expo Go (scan QR with iPhone Camera)
npm run ios         # iOS simulator
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

## Config

Copy `.env.example` to `.env` and fill in your remote Supabase project's URL and anon key.

## Database

The app runs against a **remote Supabase project** (not local). To apply migrations:

```bash
npx supabase db push          # push pending migrations to the remote project
npx supabase db push --dry-run  # preview what would run
```

## Layout

- `app/` — Expo Router routes (file-based). `(tabs)/` is the bottom-tab group.
- `components/` — themed UI primitives from the Expo template.
- `lib/` — Supabase client and shared logic.
- `assets/`, `constants/`, `hooks/` — assets, theme, and shared hooks.
