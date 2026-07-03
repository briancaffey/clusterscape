#!/usr/bin/env node
// Logo → 3D model pipeline, via inference.club (home-lab#33 v0.4 track).
//
// For every icon in public/logos/manifest.json without a GLB in
// public/models/, ask inference.club to run TRELLIS image→3D, download the
// GLB, and flip `model: true` so the scene renders the real 3D asset instead
// of the holo-coin fallback.
//
//   ICLUB_TOKEN=$(~/git/home-cluster/scripts/vault-secret.sh inference-club-api) \
//   ICLUB_URL=http://localhost:8001 node scripts/trellis-pipeline.mjs [slug…]
//
// Contract (see inference.club backend/apps/inference/openapi.yaml):
//   GET  /v1/models                      → pick id where service_type=="mesh"
//   POST /v1/3d/generations  multipart   → image + model + options(JSON str)
//        blocks ~30s when warm           ← { data:[{url}], metadata:{…} }
//   GET  <data[0].url>                   → GLB bytes (Bearer auth)
//
// Requires: a token (Dashboard → Settings → Token, or ORM-minted locally)
// and at least one online provider serving a mesh model — otherwise the
// backend answers 404 no_provider (e.g. trellis2 is scaled-to-0 by default).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const BASE = (process.env.ICLUB_URL ?? "http://localhost:8001").replace(/\/$/, "");
const TOKEN = process.env.ICLUB_TOKEN;
const MODEL_OVERRIDE = process.env.ICLUB_MESH_MODEL;
const RESOLUTION = process.env.TRELLIS_RESOLUTION ?? "512";
const only = process.argv.slice(2); // optional slug filter

if (!TOKEN) {
  console.error(
    "ICLUB_TOKEN is required (mint in inference.club Dashboard → Settings → Token;\n" +
      "store it in Vaultwarden as `inference-club-api` and pass via vault-secret.sh).",
  );
  process.exit(1);
}
const auth = { Authorization: `Bearer ${TOKEN}` };

const manifestPath = "public/logos/manifest.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
mkdirSync("public/models", { recursive: true });

// -- pick the mesh model ------------------------------------------------------
let model = MODEL_OVERRIDE;
if (!model) {
  const res = await fetch(`${BASE}/v1/models`, { headers: auth });
  if (!res.ok) {
    console.error(`GET /v1/models → ${res.status} — is the backend up and the token valid?`);
    process.exit(1);
  }
  const models = (await res.json()).data ?? [];
  const mesh = models.find((m) => m.service_type === "mesh");
  if (!mesh) {
    console.error(
      "No online mesh model (TRELLIS) found in /v1/models — bring one up first\n" +
        "(TRELLIS on spark via inference-club-agent, or the local stub agent).",
    );
    process.exit(1);
  }
  model = mesh.id;
}
console.error(`mesh model: ${model} @ ${BASE}`);

// -- generate, slug by slug ---------------------------------------------------
const slugs = [
  ...new Set(
    Object.values(manifest.namespaces)
      .map((e) => e.slug)
      .filter((s) => only.length === 0 || only.includes(s)),
  ),
];

let made = 0, cached = 0, failed = 0;
for (const slug of slugs) {
  const glbPath = `public/models/${slug}.glb`;
  const pngPath = `public/logos/${slug}.png`;
  if (existsSync(glbPath)) { cached++; continue; }
  if (!existsSync(pngPath)) continue;

  process.stderr.write(`→ ${slug} … `);
  const form = new FormData();
  form.append("image", new Blob([readFileSync(pngPath)], { type: "image/png" }), `${slug}.png`);
  form.append("model", model);
  form.append("options", JSON.stringify({ resolution: RESOLUTION }));
  // inference.club extensions: keep the batch organized in one collection
  form.append("collection", "clusterscape");
  form.append("visibility", "UNLISTED");

  try {
    const res = await fetch(`${BASE}/v1/3d/generations`, {
      method: "POST",
      headers: auth,
      body: form,
      signal: AbortSignal.timeout(300_000), // cold model loads are slow
    });
    if (!res.ok) {
      console.error(`✗ ${res.status} ${(await res.text()).slice(0, 200)}`);
      failed++;
      continue;
    }
    const out = await res.json();
    const url = out.data?.[0]?.url;
    if (!url) { console.error(`✗ no asset url in response`); failed++; continue; }
    const glb = await fetch(url.startsWith("http") ? url : `${BASE}${url}`, { headers: auth });
    if (!glb.ok) { console.error(`✗ asset fetch ${glb.status}`); failed++; continue; }
    writeFileSync(glbPath, Buffer.from(await glb.arrayBuffer()));
    const m = out.metadata ?? {};
    console.error(`✓ ${glbPath} (${m.vertices ?? "?"} verts, seed ${m.seed ?? "?"})`);
    made++;
  } catch (e) {
    console.error(`✗ ${e.message}`);
    failed++;
  }
}

// -- flip manifest flags for whatever now exists ------------------------------
for (const entry of Object.values(manifest.namespaces)) {
  entry.model = existsSync(`public/models/${entry.slug}.glb`) || undefined;
  if (!entry.model) delete entry.model;
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.error(`done: ${made} generated, ${cached} cached, ${failed} failed — manifest updated`);
