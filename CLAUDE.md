# zanviq-homepage — notes for Claude

Claude manages the site's **content** (projects, profile) as well as the code.
The user hands over a project (repo, folder, notes); Claude writes it up and
publishes it.

## Content: always through `tools/zanviq.mjs`

Talks to the live admin API at https://www.zanviq.dev with a bearer token
(`~/.config/zanviq/token` locally, `ADMIN_API_TOKEN` in the hosting app's env).
Never edit `/mnt/homepage` on the Pi directly — the API keeps `meta.json`,
timestamps and slugs consistent.

```bash
node tools/zanviq.mjs status          # token + API check
node tools/zanviq.mjs pull            # live -> content/ (git-ignored working copy)
node tools/zanviq.mjs new <slug>      # scaffold a hidden draft
node tools/zanviq.mjs push <slug>     # content/ -> live (creates if new)
node tools/zanviq.mjs publish <slug>
```

Workflow for a new project the user gives:

1. `pull` first so `content/` matches live (the user also edits in the
   browser admin; pushing a stale copy overwrites their changes).
2. `new <slug>`, then write `meta.json`, `body.ko.md`, `body.en.md`. Korean is
   the primary text; write English yourself (no need for the Gemini button).
3. Put screenshots in `content/projects/<slug>/images/` and reference them as
   `images/<file>` (markdown or `cover`); `push` uploads and rewrites them.
4. `push <slug>` — it stays hidden (`published: false`). Show the user
   `https://www.zanviq.dev/projects/<slug>` and publish only after they OK it.

Deleting (`delete <slug> --yes`) is permanent — confirm with the user first.

## Code changes

The site is an app on TwoMES Hosting (https://hosting.zanviq.dev), slug
`homepage`, compose mode, storage = existing `/mnt/homepage`, domain
`www.zanviq.dev` -> `frontend:3000`. Deploy rules follow
https://github.com/Zanviq/HOSTING/blob/main/docs/app-contract.md; use the
`twomes-hosting` MCP to check and deploy.

- Pushing to `main` triggers a webhook deploy (auto_deploy on, auto_rollback on).
  Don't report "pushed" as "deployed" — confirm with
  `app_status("homepage")` / `wait_deployment`, then `curl https://www.zanviq.dev/api/health`.
- Manual redeploy: `deploy_and_wait(slug="homepage")`; rollback with
  `deploy(slug, commit_sha=<last good>)`.
- Env vars (`ADMIN_*`, `JWT_SECRET`, `GEMINI_API_KEY`, `DATA_DIR`) live in the
  platform: `set_env("homepage", {...})`, applied from the next deploy. Never
  commit `.env`.
- Don't add `cloudflared`, `ports:` or `container_name` to the compose file.
- The old `zanviq-homepage` compose project on the Pi (with its own
  cloudflared) was stopped, not removed; don't start it again.

Frontend: `node node_modules/next/dist/bin/next build` in `frontend/` (npx is
broken in this Windows shell). Local Python isn't set up; backend is checked
in its container on the Pi.
