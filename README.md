# zanviq-homepage

Personal portfolio & writing site for **www.zanviq.dev** — self-hosted on a
Raspberry Pi, exposed through a Cloudflare Tunnel.

- **Frontend** — Next.js 16 (App Router) + Tailwind, editorial/bright design,
  KO/EN toggle (English by default), markdown rendering with images.
- **Backend** — FastAPI. File-based storage (markdown + images), JWT-cookie
  auth for a single admin.
- **Content** — everything lives on disk at `/mnt/hdd/homepage` (bind-mounted
  into the backend container). No database.

The canonical origin is defined once in `frontend/src/lib/site.ts`; metadata,
`robots.txt` and `sitemap.xml` all derive from it. Change the domain there.

## Architecture

```
Cloudflare Tunnel (TUNNEL_TOKEN)  ->  frontend (Next.js :3000)
                                         │  /api/* rewritten to ↓
                                      backend (FastAPI :8000)
                                         │
                                      /mnt/hdd/homepage  (markdown + images)
```

The tunnel points **only** at the frontend. Next.js rewrites every `/api/*`
request to the backend over the internal Docker network, so session cookies
stay first-party on `www.zanviq.dev`.

## Editing the site

There is no visible login button. Visit **`https://www.zanviq.dev/login`**
directly and sign in with the credentials from `.env`. After login you can:

- `/admin` — dashboard: create / edit / delete projects, drag to reorder, and
  toggle per-project visibility with the eye icon (unpublished projects stay
  visible to you, hidden from the public site and the sitemap)
- `/admin/profile` — edit the About section, avatar, tagline, links, plus the
  Timeline and Qualifications entries (each item individually hideable)
- In-browser markdown editor with live preview and drag-and-drop image upload
- **Translate** button — KO → EN via Gemini, field by field. Only appears when
  `GEMINI_API_KEY` is set in `.env`.

## Setup

1. Copy the env template and fill it in:

   ```bash
   cp .env.example .env
   # set TUNNEL_TOKEN, ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET
   # optional: GEMINI_API_KEY to enable the KO -> EN translate button
   ```

   Generate a strong `JWT_SECRET`:

   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```

2. Create the data directory on the Pi:

   ```bash
   sudo mkdir -p /mnt/hdd/homepage
   sudo chown -R 1000:1000 /mnt/hdd/homepage
   ```

3. In the Cloudflare Zero Trust dashboard, point the tunnel's public hostname
   `www.zanviq.dev` to `http://frontend:3000`.

4. Build and run:

   ```bash
   docker compose up -d --build
   ```

## Data layout

```
/mnt/hdd/homepage/
├── about/
│   ├── profile.json          name, taglines, links, avatar,
│   │                         history (Timeline), qualifications
│   ├── about.ko.md
│   ├── about.en.md
│   └── images/
└── projects/
    └── <slug>/
        ├── meta.json         titles, summaries, tags, links, cover,
        │                     published, order, timestamps
        ├── body.ko.md
        ├── body.en.md
        └── images/
```

Back up the site by copying `/mnt/hdd/homepage`. That's it.
