#!/usr/bin/env node
// Logo → 3D model pipeline (home-lab#33 v0.4 track).
//
// For every icon in public/logos/manifest.json that doesn't yet have a GLB in
// public/models/, ask the in-cluster TRELLIS image-to-3D service to generate
// one, then flip `model: true` in the manifest so the scene renders the real
// 3D asset instead of the holo-coin fallback.
//
//   TRELLIS_URL=https://trellis.lan node scripts/trellis-pipeline.mjs
//
// TRELLIS (services/trellis in the home-cluster repo) is GPU-heavy and not
// always running — this script is designed to be run opportunistically when
// it is. The scene degrades gracefully: coin when no GLB, model when present.
// TODO(v0.4): confirm the request/response shape against the deployed TRELLIS
// API (multipart image upload → GLB bytes) and add a flux touch-up step that
// pre-processes flat logos into shaded "objects" for better 3D lifts.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // LAN mkcert cert
const TRELLIS = process.env.TRELLIS_URL ?? "https://trellis.lan";

const manifestPath = "public/logos/manifest.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
mkdirSync("public/models", { recursive: true });

try {
  const ping = await fetch(`${TRELLIS}/health`, { signal: AbortSignal.timeout(4000) });
  if (!ping.ok) throw new Error(`health ${ping.status}`);
} catch (e) {
  console.error(`TRELLIS unreachable at ${TRELLIS} (${e.message}) — start it and re-run.`);
  process.exit(1);
}

const entries = Object.entries(manifest.namespaces);
for (const [ns, entry] of entries) {
  const glb = `public/models/${entry.slug}.glb`;
  const png = `public/logos/${entry.slug}.png`;
  if (entry.model && existsSync(glb)) continue;
  if (!existsSync(png)) continue;

  console.error(`→ ${entry.slug} (${ns})…`);
  const form = new FormData();
  form.append("image", new Blob([readFileSync(png)], { type: "image/png" }), `${entry.slug}.png`);
  const res = await fetch(`${TRELLIS}/v1/image-to-3d`, { method: "POST", body: form });
  if (!res.ok) {
    console.error(`  ✗ ${res.status} ${await res.text().catch(() => "")}`);
    continue;
  }
  writeFileSync(glb, Buffer.from(await res.arrayBuffer()));
  entry.model = true;
  console.error(`  ✓ ${glb}`);
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.error("manifest updated");
