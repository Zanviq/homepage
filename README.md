# zanviq-homepage

Personal portfolio & writing site for **zanviq.dev** — self-hosted on a
Raspberry Pi, exposed through a Cloudflare Tunnel.

- **Frontend** — Next.js 16 (App Router) + Tailwind, editorial/bright design,
  KO/EN toggle, markdown rendering with images.
- **Backend** — FastAPI. File-based storage (markdown + images), JWT-cookie
  auth for a single admin.
- **Content** — everything lives on disk at `/mnt/HDD/homepage` (bind-mounted
  into the backend container). No database.

## Architecture

```
Cloudflare Tunnel (TUNNEL_TOKEN)  ->  frontend (Next.js :3000)
                                         │  /api/* rewritten to ↓
                                      backend (FastAPI :8000)
                                         │
                                      /mnt/HDD/homepage  (markdown + images)
```

The tunnel points **only** at the frontend. Next.js rewrites every `/api/*`
request to the backend over the internal Docker network, so session cookies
stay first-party on `zanviq.dev`.

## Editing the site

There is no visible login button. Visit **`https://zanviq.dev/login`**
directly and sign in with the credentials from `.env`. After login you can:

- `/admin` — dashboard: create / edit / delete projects
- `/admin/profile` — edit the About section, avatar, tagline, links
- In-browser markdown editor with live preview and drag-and-drop image upload

## Setup

1. Copy the env template and fill it in:

   ```bash
   cp .env.example .env
   # set TUNNEL_TOKEN, ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET
   ```

   Generate a strong `JWT_SECRET`:

   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```

2. Create the data directory on the Pi:

   ```bash
   sudo mkdir -p /mnt/HDD/homepage
   sudo chown -R 1000:1000 /mnt/HDD/homepage
   ```

3. In the Cloudflare Zero Trust dashboard, point the tunnel's public hostname
   `zanviq.dev` (and `www`) to `http://frontend:3000`.

4. Build and run:

   ```bash
   docker compose up -d --build
   ```

## Data layout

```
/mnt/HDD/homepage/
├── about/
│   ├── profile.json          name, taglines, links, avatar
│   ├── about.ko.md
│   ├── about.en.md
│   └── images/
└── projects/
    └── <slug>/
        ├── meta.json         titles, summaries, tags, links, cover, ...
        ├── body.ko.md
        ├── body.en.md
        └── images/
```

Back up the site by copying `/mnt/HDD/homepage`. That's it.
