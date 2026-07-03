#!/usr/bin/env node
// The live bridge: the same collector as `npm run snapshot`, on a loop, over
// HTTP. The scene consumes it through LiveProvider (?live=1) and receives a
// fresh full snapshot via SSE after every collection — the document shape is
// identical to the static file, so static and live stay the same app.
//
//   node bridge/server.mjs            # :4301, collects every 20s
//   INTERVAL_MS=5000 PORT=9999 node bridge/server.mjs
//
// Needs kubectl (current kubeconfig) + prometheus.lan, i.e. run it on the
// laptop or in-cluster with a read-only ServiceAccount (v0.3: manifests in
// the home-cluster repo, deployed by Argo CD like everything else).
//
// v0.3 upgrade path: swap the polling loop for K8s watch streams and emit
// deltas instead of full documents — LiveProvider's subscribe() contract
// already covers it.

import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";
import { readFileSync, existsSync, statSync } from "node:fs";

const PORT = Number(process.env.PORT ?? 4301);
const INTERVAL = Number(process.env.INTERVAL_MS ?? 20000);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT_SCRIPT = join(ROOT, "scripts", "snapshot.mjs");
// When set (the container image sets it to the exported site), the bridge
// also serves the app itself — one process, site + live API, same origin.
const STATIC_DIR = process.env.SERVE_STATIC ?? null;
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain",
  ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".webp": "image/webp",
};

let current = null;
const clients = new Set();

function collect() {
  try {
    // the snapshot script writes public/data/cluster.json — reuse it verbatim
    execFileSync("node", [SNAPSHOT_SCRIPT], { stdio: ["ignore", "ignore", "inherit"] });
    current = JSON.parse(
      execFileSync("cat", [join(dirname(SNAPSHOT_SCRIPT), "..", "public", "data", "cluster.json")], {
        maxBuffer: 256 * 1024 * 1024,
      }).toString(),
    );
    const frame = `data: ${JSON.stringify(current)}\n\n`;
    for (const res of clients) res.write(frame);
    console.error(`[bridge] snapshot ${current.meta.capturedAt} → ${clients.size} client(s)`);
  } catch (e) {
    console.error(`[bridge] collect failed: ${e.message}`);
  }
}

collect();
setInterval(collect, INTERVAL);

createServer((req, res) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  };
  if (req.url === "/api/snapshot") {
    res.writeHead(current ? 200 : 503, { "Content-Type": "application/json", ...cors });
    res.end(current ? JSON.stringify(current) : '{"error":"no snapshot yet"}');
  } else if (req.url === "/api/stream") {
    res.writeHead(200, { "Content-Type": "text/event-stream", Connection: "keep-alive", ...cors });
    res.write(":\n\n");
    if (current) res.write(`data: ${JSON.stringify(current)}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
  } else if (STATIC_DIR) {
    const url = (req.url ?? "/").split("?")[0];
    let file = normalize(join(STATIC_DIR, url === "/" ? "index.html" : decodeURIComponent(url)));
    if (!file.startsWith(normalize(STATIC_DIR))) {
      res.writeHead(403, cors);
      return res.end();
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
    if (!existsSync(file)) file = join(STATIC_DIR, "index.html"); // SPA-ish fallback
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream", ...cors });
    res.end(readFileSync(file));
  } else {
    res.writeHead(404, cors);
    res.end("clusterscape bridge: /api/snapshot or /api/stream");
  }
}).listen(PORT, () => console.error(`[bridge] listening on :${PORT}, collecting every ${INTERVAL / 1000}s`));
