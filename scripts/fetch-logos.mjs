#!/usr/bin/env node
// Download service logos referenced by public/logos/manifest.json from the
// dashboard-icons project (same icon set Homepage uses). Skips slugs that are
// already present; 404s are reported, not fatal — custom/in-house services
// (hermes, rampart, hnfm…) simply have no badge until an icon is dropped into
// public/logos/<slug>.png by hand or the manifest points somewhere real.

import { writeFileSync, existsSync, readFileSync } from "node:fs";

const BASE = "https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/png";
const manifest = JSON.parse(readFileSync("public/logos/manifest.json", "utf8"));
const slugs = [...new Set(Object.values(manifest.namespaces).map((e) => e.slug))];

let ok = 0, skipped = 0, missing = [];
for (const slug of slugs) {
  const dest = `public/logos/${slug}.png`;
  if (existsSync(dest)) { skipped++; continue; }
  const res = await fetch(`${BASE}/${slug}.png`);
  if (!res.ok) { missing.push(slug); continue; }
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  ok++;
  console.error(`✓ ${slug}`);
}
console.error(`done: ${ok} fetched, ${skipped} cached${missing.length ? `, missing: ${missing.join(", ")}` : ""}`);
