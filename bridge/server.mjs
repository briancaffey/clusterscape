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
import { dirname, join } from "node:path";

const PORT = Number(process.env.PORT ?? 4301);
const INTERVAL = Number(process.env.INTERVAL_MS ?? 20000);
const SNAPSHOT_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "snapshot.mjs");

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
  } else {
    res.writeHead(404, cors);
    res.end("clusterscape bridge: /api/snapshot or /api/stream");
  }
}).listen(PORT, () => console.error(`[bridge] listening on :${PORT}, collecting every ${INTERVAL / 1000}s`));
