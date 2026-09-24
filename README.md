# zanviq-homepage

Personal portfolio & writing site for **www.zanviq.dev** — self-hosted on a
Raspberry Pi, exposed through a Cloudflare Tunnel.

- **Frontend** — Next.js 16 (App Router) + Tailwind, editorial/bright design,
  KO/EN toggle (English by default), markdown rendering with images.
- **Backend** — FastAPI. File-based storage (markdown + images), JWT-cookie
  auth for a single admin.
- **Content** — everything lives on disk at `/mnt/homepage` (bind-mounted into
  the backend container). No database.

The canonical origin is defined once in `frontend/src/lib/site.ts`; metadata,
`robots.txt` and `sitemap.xml` all derive from it. Change the domain there.

## Architecture

```
Cloudflare Tunnel (TUNNEL_TOKEN)  ->  frontend (Next.js :3000)
                                         │  /api/* rewritten to ↓
                                      backend (FastAPI :8000)
                                         │
                                      /mnt/homepage  (markdown + images)
                                         │  ext4 loop image on the HDD
                                      /mnt/HDD/homepage/homepage.img
```

The tunnel points **only** at the frontend. Next.js rewrites every `/api/*`
request to the backend over the internal Docker network, so session cookies
stay first-party on `www.zanviq.dev`.

## Drive (`/drive`)

The **Drive** button in the header opens a full-screen driving game built
with three.js from the same content: the start gantry carries the name and
tagline, blue gantries and roadside plates are the timeline by year, project
covers sit on billboards, and the lakeside lookout holds the About text.
Drive up to a sign and press **E** (or tap the prompt) to read it.

- Code: `frontend/src/drive/` (world, physics, audio, effects) and
  `frontend/src/components/drive/` (HUD, menus, touch controls).
- Assets: `frontend/public/drive-assets/` — the car is the Ferrari 458 Italia
  model by vicent091036 from the three.js examples (Draco-compressed glTF);
  ground textures are Poly Haven (CC0), resized to 512–1024 px.
- Covers are loaded as `/api/media/...?w=1024` — the backend serves cached
  WebP thumbnails for `?w=256|512|1024` (Pillow, cached under
  `/data/.cache/thumbs`).
- Keyboard (WASD/arrows, Space, E, C, R, Tab, Esc), gamepads and on-screen
  touch controls are supported; quality is auto-picked and resolution adapts
  to the frame rate.

## Editing the site

There is no visible login button. Visit **`https://www.zanviq.dev/login`**
directly and sign in with the credentials from `.env`. After login you can:

- `/admin` — dashboard: create / edit / delete projects, drag to reorder, and
  toggle per-project visibility with the eye icon (unpublished projects stay
  visible to you, hidden from the public site and the sitemap)
- `/admin/profile` — edit the About section, avatar, tagline, links, plus the
  Timeline and Qualifications entries (each item individually hideable)
- In-browser markdown editor with live preview and drag-and-drop image upload
- **Translate** button — KO → EN via Gemini. Opens a checklist of every field
  and every markdown paragraph (select all / clear all / missing-EN-only), so
  only the parts you pick are translated; the rest of the English text stays
  as it is. Only appears when `GEMINI_API_KEY` is set in `.env`.

### From the command line

`tools/zanviq.mjs` (Node 18+, no dependencies) edits the same content through
the API with a bearer token — set `ADMIN_API_TOKEN` in the Pi's `.env`, and
put the same value in `~/.config/zanviq/token` (or `ZANVIQ_API_TOKEN`) on the
machine running the CLI.

```bash
node tools/zanviq.mjs pull              # live site -> content/ (git-ignored)
node tools/zanviq.mjs new my-project    # scaffold a hidden draft
node tools/zanviq.mjs push my-project   # upload (local images/* included)
node tools/zanviq.mjs publish my-project
node tools/zanviq.mjs help
```

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

2. Create the data volume on the Pi. The external HDD is NTFS, which has no
   real POSIX permissions, so — as with the other services on this box — the
   content lives in an ext4 loop image on top of it:

   ```bash
   sudo mkdir -p /mnt/HDD/homepage /mnt/homepage
   sudo truncate -s 20G /mnt/HDD/homepage/homepage.img   # sparse
   sudo mkfs.ext4 -L homepage /mnt/HDD/homepage/homepage.img
   ```

   Then make it survive reboots by adding to `/etc/fstab`:

   ```
   /mnt/HDD/homepage/homepage.img /mnt/homepage ext4 loop,noatime,nofail,x-systemd.requires=/mnt/HDD 0 0
   ```

   ```bash
   sudo systemctl daemon-reload && sudo mount /mnt/homepage
   ```

   The backend container runs as root, so no `chown` is needed.

3. In the Cloudflare Zero Trust dashboard, point the tunnel's public hostname
   `www.zanviq.dev` to `http://frontend:3000`.

4. Build and run:

   ```bash
   docker compose up -d --build
   ```

## Data layout

```
/mnt/homepage/
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

Back up the site by copying `/mnt/homepage`, or snapshot the whole volume by
copying `/mnt/HDD/homepage/homepage.img` while it is unmounted. That's it.
