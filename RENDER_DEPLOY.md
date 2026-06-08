# Deploying to Render

This project is **TanStack Start** (SSR + server functions). It must run as a
**Render Web Service** (Node), not a Static Site.

## One-click (Blueprint)

`render.yaml` is included. In Render: **New → Blueprint → connect this repo**.
Fill in the secret env vars when prompted.

## Manual setup

**New → Web Service** → connect repo → use these settings:

| Setting             | Value                                    |
| ------------------- | ---------------------------------------- |
| Runtime             | Node                                     |
| Node version        | 20 (set env `NODE_VERSION=20`)           |
| Build Command       | `npm install && npm run build:node`      |
| Start Command       | `npm start`                              |
| Health check path   | `/`                                      |

### Required environment variables

Set these in **Settings → Environment**:

```
NITRO_PRESET=node-server
PORT=10000
VITE_SUPABASE_URL=...           # from your Supabase project
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_URL=...                # same value as VITE_SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY=...    # same value as VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=...   # server-only, never expose
```

Add any additional secrets the app uses (LOVABLE_API_KEY, payment keys, etc.).

## How the build works

- `npm run build:node` sets `NITRO_PRESET=node-server` so Nitro emits a Node
  server bundle instead of a Cloudflare Worker.
- Output goes to `dist/server` (Node entry: `dist/server/index.mjs`) and
  `dist/client` (static assets, served by the same Node process).
- `npm start` runs the Node server. It listens on `process.env.PORT`.

## Routing / refresh

Do **not** add `public/_redirects` or any SPA fallback file. The Node server
handles all routes (SSR + client navigation + deep-link refresh) natively.

## Why not Static Site?

A Static Site cannot run server functions, Supabase auth middleware, or
`/api/public/*` webhook handlers. Using one would break login, admin features,
and any server-side data fetching.
