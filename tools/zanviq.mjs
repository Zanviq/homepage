#!/usr/bin/env node
// zanviq.mjs — command-line content manager for www.zanviq.dev.
//
// Talks to the live admin API with a bearer token, and mirrors content into a
// local working copy that has the same layout as the server's data volume:
//
//   content/projects/<slug>/meta.json    titles, summaries, tags, links, ...
//   content/projects/<slug>/body.ko.md
//   content/projects/<slug>/body.en.md
//   content/projects/<slug>/images/*     local images (uploaded on push)
//   content/about/profile.json
//   content/about/about.ko.md
//   content/about/about.en.md
//
// Markdown (and `cover`) may reference local files as `images/<name>`; push
// uploads them and rewrites the references to the served /api/media URL.
//
// Auth: ZANVIQ_API_TOKEN env var, or the file ~/.config/zanviq/token.
// Target: ZANVIQ_URL env var (default https://www.zanviq.dev).
//
// Run `node tools/zanviq.mjs help` for the command list.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = (process.env.ZANVIQ_URL || "https://www.zanviq.dev").replace(/\/+$/, "");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "content");
const PROJECTS = join(ROOT, "projects");
const ABOUT = join(ROOT, "about");

// Fields of ProjectInput / ProfileInput (backend/models.py) that live in the
// JSON file; bodies live in the .md files.
const PROJECT_FIELDS = [
  "title_ko", "title_en", "summary_ko", "summary_en",
  "tags", "links", "cover", "published", "order",
];
const PROFILE_FIELDS = [
  "name", "tagline_ko", "tagline_en", "avatar", "links", "history", "qualifications",
];

const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
};

// ── HTTP ────────────────────────────────────────────────────────────────────

function token() {
  if (process.env.ZANVIQ_API_TOKEN) return process.env.ZANVIQ_API_TOKEN.trim();
  const file = join(homedir(), ".config", "zanviq", "token");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  die("No API token. Set ZANVIQ_API_TOKEN or write it to ~/.config/zanviq/token");
}

async function api(method, path, body) {
  const headers = { Authorization: `Bearer ${token()}`, "User-Agent": "zanviq-cli" };
  let payload = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> HTTP ${res.status}: ${data?.detail ?? text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function uploadImage(target, filePath) {
  const mime = MIME[extname(filePath).toLowerCase()];
  if (!mime) die(`Unsupported image type: ${filePath}`);
  const form = new FormData();
  form.append("file", new Blob([readFileSync(filePath)], { type: mime }), basename(filePath));
  const path = target === "about" ? "/api/profile/images" : `/api/projects/${enc(target)}/images`;
  return (await api("POST", path, form)).url;
}

// ── local files ─────────────────────────────────────────────────────────────

const enc = encodeURIComponent;
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const readText = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n", "utf8");
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

function writeProjectDir(dir, project) {
  mkdirSync(join(dir, "images"), { recursive: true });
  writeJson(join(dir, "meta.json"), pick(project, ["slug", ...PROJECT_FIELDS]));
  writeFileSync(join(dir, "body.ko.md"), project.body_ko ?? "", "utf8");
  writeFileSync(join(dir, "body.en.md"), project.body_en ?? "", "utf8");
}

function readProjectDir(dir) {
  const metaPath = join(dir, "meta.json");
  if (!existsSync(metaPath)) die(`No meta.json in ${dir}`);
  const meta = readJson(metaPath);
  return {
    ...pick(meta, PROJECT_FIELDS),
    body_ko: readText(join(dir, "body.ko.md")),
    body_en: readText(join(dir, "body.en.md")),
  };
}

// Upload every `images/<file>` referenced from the given text fields, and
// rewrite the references to the returned media URL. Returns true if any
// reference was rewritten.
async function uploadLocalImages(target, dir, record, fields) {
  const cache = new Map();
  const pattern = /(^|[("'\s])images\/([^)"'\s]+)/g;
  let changed = false;
  for (const field of fields) {
    const value = record[field];
    if (typeof value !== "string" || !value.includes("images/")) continue;
    const names = [...value.matchAll(pattern)].map((m) => m[2]);
    for (const name of names) {
      if (cache.has(name)) continue;
      const file = join(dir, "images", decodeURIComponent(name));
      if (!existsSync(file)) continue; // not a local file — leave untouched
      const url = await uploadImage(target, file);
      console.log(`  uploaded images/${name} -> ${url}`);
      cache.set(name, url);
    }
    const next = value.replace(pattern, (all, pre, name) =>
      cache.has(name) ? `${pre}${cache.get(name)}` : all,
    );
    if (next !== value) {
      record[field] = next;
      changed = true;
    }
  }
  return changed;
}

// ── commands ────────────────────────────────────────────────────────────────

async function cmdStatus() {
  const { authenticated } = await api("GET", "/api/auth/session");
  const projects = await api("GET", "/api/projects");
  const { available } = await api("GET", "/api/translate/available");
  console.log(`site:        ${BASE_URL}`);
  console.log(`token auth:  ${authenticated ? "ok" : "REJECTED"}`);
  console.log(`projects:    ${projects.length}`);
  console.log(`translate:   ${available ? "available" : "not configured"}`);
  if (!authenticated) process.exitCode = 1;
}

async function cmdList() {
  const projects = await api("GET", "/api/projects");
  for (const p of projects) {
    const state = p.published ? "public" : "hidden";
    console.log(`${String(p.order).padStart(3)}  ${state.padEnd(6)}  ${p.slug.padEnd(40)}  ${p.title_ko || p.title_en}`);
  }
}

async function cmdPull(args) {
  const all = args.length === 0 || args.includes("--all");
  const wanted = args.filter((a) => !a.startsWith("--"));

  if (all || wanted.includes("card")) {
    const card = await api("GET", "/api/card");
    mkdirSync(ABOUT, { recursive: true });
    if (card) {
      writeJson(join(ABOUT, "card.json"), card);
      console.log(`pulled card -> ${join(ABOUT, "card.json")}`);
    } else console.log("card: none saved yet (the site uses the default design)");
  }

  if (all || wanted.includes("profile")) {
    const profile = await api("GET", "/api/profile");
    mkdirSync(join(ABOUT, "images"), { recursive: true });
    writeJson(join(ABOUT, "profile.json"), pick(profile, PROFILE_FIELDS));
    writeFileSync(join(ABOUT, "about.ko.md"), profile.about_ko ?? "", "utf8");
    writeFileSync(join(ABOUT, "about.en.md"), profile.about_en ?? "", "utf8");
    console.log(`pulled profile -> ${ABOUT}`);
  }

  const slugs = all
    ? (await api("GET", "/api/projects")).map((p) => p.slug)
    : wanted.filter((s) => s !== "profile" && s !== "card");
  for (const slug of slugs) {
    const project = await api("GET", `/api/projects/${enc(slug)}`);
    writeProjectDir(join(PROJECTS, slug), project);
    console.log(`pulled ${slug}`);
  }
}

async function cmdPush(args) {
  if (args.length === 0) die("usage: push <slug|profile> [...]");
  for (const name of args) {
    if (name === "profile") await pushProfile();
    else if (name === "card") await pushCard();
    else await pushProject(name);
  }
}

async function pushProfile() {
  const profile = {
    ...readJson(join(ABOUT, "profile.json")),
    about_ko: readText(join(ABOUT, "about.ko.md")),
    about_en: readText(join(ABOUT, "about.en.md")),
  };
  if (await uploadLocalImages("about", ABOUT, profile, ["about_ko", "about_en", "avatar"])) {
    writeJson(join(ABOUT, "profile.json"), pick(profile, PROFILE_FIELDS));
    writeFileSync(join(ABOUT, "about.ko.md"), profile.about_ko, "utf8");
    writeFileSync(join(ABOUT, "about.en.md"), profile.about_en, "utf8");
  }
  await api("PUT", "/api/profile", profile);
  console.log("pushed profile");
}

async function pushCard() {
  const file = join(ABOUT, "card.json");
  if (!existsSync(file)) die("No content/about/card.json — run: pull card");
  const { updated_at: _u, ...card } = readJson(file);
  void _u;
  await api("PUT", "/api/card", card);
  console.log("pushed card");
}

async function pushProject(slug) {
  let dir = join(PROJECTS, slug);
  const project = readProjectDir(dir);

  let exists = true;
  try {
    await api("GET", `/api/projects/${enc(slug)}`);
  } catch (e) {
    if (e.status !== 404) throw e;
    exists = false;
  }

  if (!exists) {
    // Create first (images need the project folder to exist server-side).
    const created = await api("POST", "/api/projects", { ...project, slug });
    console.log(`created ${created.slug}`);
    if (created.slug !== slug) {
      const newDir = join(PROJECTS, created.slug);
      renameSync(dir, newDir);
      dir = newDir;
      console.log(`  slug taken — local folder renamed to ${created.slug}`);
    }
    slug = created.slug;
  }

  const fields = ["body_ko", "body_en", "cover"];
  if (await uploadLocalImages(slug, dir, project, fields) || !exists) {
    writeProjectDir(dir, { slug, ...project });
  }
  await api("PUT", `/api/projects/${enc(slug)}`, project);
  console.log(`pushed ${slug} (${project.published === false ? "hidden" : "public"})`);
}

async function cmdVisibility(args, published) {
  if (args.length === 0) die(`usage: ${published ? "publish" : "unpublish"} <slug> [...]`);
  for (const slug of args) {
    await api("POST", `/api/projects/${enc(slug)}/visibility`, { published });
    const metaPath = join(PROJECTS, slug, "meta.json");
    if (existsSync(metaPath)) writeJson(metaPath, { ...readJson(metaPath), published });
    console.log(`${slug}: ${published ? "public" : "hidden"}`);
  }
}

async function cmdReorder(args) {
  if (args.length === 0) die("usage: reorder <slug> <slug> ... (full desired order)");
  const current = (await api("GET", "/api/projects")).map((p) => p.slug);
  const missing = current.filter((s) => !args.includes(s));
  const unknown = args.filter((s) => !current.includes(s));
  if (unknown.length) die(`Unknown slugs: ${unknown.join(", ")}`);
  // Anything not mentioned keeps its relative order, after the listed ones.
  await api("POST", "/api/projects/reorder", { slugs: [...args, ...missing] });
  console.log([...args, ...missing].map((s, i) => `${i}  ${s}`).join("\n"));
}

async function cmdDelete(args) {
  const slugs = args.filter((a) => a !== "--yes");
  if (!args.includes("--yes") || slugs.length === 0) {
    die("usage: delete <slug> [...] --yes   (permanently removes the project and its images)");
  }
  for (const slug of slugs) {
    await api("DELETE", `/api/projects/${enc(slug)}`);
    console.log(`deleted ${slug} (local copy in content/ left untouched)`);
  }
}

async function cmdUpload(args) {
  const [target, ...files] = args;
  if (!target || files.length === 0) die("usage: upload <slug|about> <file> [...]");
  for (const file of files) console.log(await uploadImage(target, resolve(file)));
}

async function cmdNew(args) {
  const [slug] = args;
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) die("usage: new <slug>   (lowercase a-z, 0-9, -)");
  const dir = join(PROJECTS, slug);
  if (existsSync(dir)) die(`${dir} already exists`);
  writeProjectDir(dir, {
    slug,
    title_ko: "", title_en: "", summary_ko: "", summary_en: "",
    tags: [], links: [], cover: "", published: false, order: 999,
    body_ko: "", body_en: "",
  });
  console.log(`scaffolded ${dir} (published: false). Fill it in, then: push ${slug}`);
}

function cmdLocal() {
  if (!existsSync(PROJECTS)) return console.log("(no local projects — run pull)");
  for (const slug of readdirSync(PROJECTS)) console.log(slug);
}

const HELP = `zanviq content CLI  (${BASE_URL})

  status                       check token + API reachability
  list                         list projects on the live site (incl. hidden)
  pull [slug|profile|card ...] download to content/ (no args = everything)
  push <slug|profile|card> ... upload from content/; creates the project if new,
                               uploads local images/* references first
  new <slug>                   scaffold content/projects/<slug> (hidden draft)
  publish <slug> [...]         make visible on the public site
  unpublish <slug> [...]       hide from the public site
  reorder <slug> ...           set display order (unlisted keep their order after)
  upload <slug|about> <file>   upload an image, print its URL
  delete <slug> [...] --yes    permanently delete a project
  local                        list projects in content/`;

// ── main ────────────────────────────────────────────────────────────────────

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
const commands = {
  status: cmdStatus,
  list: cmdList,
  pull: cmdPull,
  push: cmdPush,
  new: cmdNew,
  publish: (a) => cmdVisibility(a, true),
  unpublish: (a) => cmdVisibility(a, false),
  reorder: cmdReorder,
  upload: cmdUpload,
  delete: cmdDelete,
  local: cmdLocal,
};

if (!cmd || cmd === "help" || !commands[cmd]) {
  console.log(HELP);
  process.exit(cmd && cmd !== "help" ? 1 : 0);
}

try {
  await commands[cmd](args);
} catch (e) {
  die(e.message);
}
