// Deterministic 3D layout: snapshot -> positions. Pure function of the
// snapshot so a given cluster state always renders the same scene (and later,
// live graph changes can tween between two layout results).
//
// Spatial metaphor:
//   - each machine is a floating hexagonal island on an arc, sized by RAM
//   - pods stand on their island, clustered into circular namespace pads
//   - services hover as rings above the centroid of the pods they select
//   - ingresses form a "gateway rail" at the front, beaming to services
//   - PVCs dock as crystal slabs at the rim of the island they're pinned to
//   - spark sits farther out and lower (other subnet, often offline)

import type { ClusterSnapshot } from "./types";
import { ids } from "./types";

export interface Placement {
  position: [number, number, number];
  scale: number;
}

export interface IslandLayout {
  node: string;
  position: [number, number, number];
  radius: number;
  pads: { ns: string; center: [number, number, number]; radius: number }[];
}

export interface SceneLayout {
  islands: IslandLayout[];
  placements: Map<string, Placement>; // entity id -> where it lives
}

const ISLAND_GAP = 26;

export function layoutScene(snap: ClusterSnapshot): SceneLayout {
  const placements = new Map<string, Placement>();
  const islands: IslandLayout[] = [];

  // --- islands on a shallow arc, control-plane in the middle --------------
  const order = [...snap.nodes].sort((a, b) => {
    const rank = (n: typeof a) => (n.roles.includes("control-plane") ? 0 : n.arch === "arm64" ? 2 : 1);
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });
  const mid = (order.length - 1) / 2;
  order.forEach((node, i) => {
    const off = i - mid;
    const arm = node.arch === "arm64"; // spark: farther, lower, "across the gap"
    const podsHere = snap.pods.filter((p) => p.node === node.name);
    const radius = Math.max(7, 4 + Math.sqrt(podsHere.length) * 1.9);
    const position: [number, number, number] = [
      off * ISLAND_GAP * (arm ? 1.45 : 1),
      arm ? -3 : 0,
      Math.abs(off) * 6 + (arm ? 14 : 0),
    ];
    placements.set(ids.node(node.name), { position, scale: radius });

    // --- namespace pads via phyllotaxis on the island ----------------------
    const nss = [...new Set(podsHere.map((p) => p.ns))].sort();
    const pads: IslandLayout["pads"] = [];
    nss.forEach((ns, j) => {
      const nsPods = podsHere.filter((p) => p.ns === ns);
      const padR = Math.max(1.2, Math.sqrt(nsPods.length) * 0.95);
      const a = j * 2.399963; // golden angle
      const r = nss.length === 1 ? 0 : (radius - padR - 1.4) * Math.sqrt((j + 0.6) / nss.length);
      const center: [number, number, number] = [
        position[0] + Math.cos(a) * r,
        position[1],
        position[2] + Math.sin(a) * r,
      ];
      pads.push({ ns, center, radius: padR });

      // --- pods in a spiral inside the pad ---------------------------------
      nsPods
        .sort((x, y) => x.name.localeCompare(y.name))
        .forEach((p, k) => {
          const pa = k * 2.399963;
          const pr = padR * 0.78 * Math.sqrt((k + 0.5) / Math.max(nsPods.length, 1));
          placements.set(ids.pod(p.ns, p.name), {
            position: [center[0] + Math.cos(pa) * pr, center[1] + 0.55, center[2] + Math.sin(pa) * pr],
            scale: 1,
          });
        });
    });
    islands.push({ node: node.name, position, radius, pads });
  });

  // --- services hover above the centroid of their pods ---------------------
  const selectEdges = snap.edges.filter((e) => e.type === "selects");
  for (const svc of snap.services) {
    const sid = ids.service(svc.ns, svc.name);
    const podPos = selectEdges
      .filter((e) => e.from === sid)
      .map((e) => placements.get(e.to)?.position)
      .filter((p): p is [number, number, number] => !!p);
    if (podPos.length === 0) continue; // headless/unmatched: skip in 3D, still in panel
    const c = podPos
      .reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0])
      .map((v) => v / podPos.length) as [number, number, number];
    placements.set(sid, { position: [c[0], c[1] + 3.4, c[2]], scale: 1 });
  }

  // --- ingress gateway arc wrapping the front of the diorama ---------------
  // (an arc composes far better in iso view than a straight rail; sorted by
  // host so neighbors read alphabetically when you sweep the mouse)
  const routed = snap.ingresses
    .filter((i) => i.className !== "tailscale")
    .sort((a, b) => (a.hosts[0] ?? a.name).localeCompare(b.hosts[0] ?? b.name));
  // anchor on the amd64 "mainland" (spark sits apart and would drag the arc
  // off-frame) and face the default camera quadrant (+x,+z).
  const arm64 = new Set(snap.nodes.filter((n) => n.arch === "arm64").map((n) => n.name));
  const mainland = islands.filter((il) => !arm64.has(il.node));
  const anchor = mainland.length > 0 ? mainland : islands;
  const center = anchor
    .reduce((a, il) => [a[0] + il.position[0], 0, a[2] + il.position[2]], [0, 0, 0])
    .map((v) => v / Math.max(anchor.length, 1)) as [number, number, number];
  const arcR =
    Math.max(...anchor.map((il) => Math.hypot(il.position[0] - center[0], il.position[2] - center[2]) + il.radius)) +
    8;
  const span = Math.min(Math.PI * 0.8, (routed.length * 2.6) / arcR);
  routed.forEach((ing, i) => {
    const t = routed.length === 1 ? 0.5 : i / (routed.length - 1);
    const a = Math.PI / 4 - span / 2 + t * span; // toward the default camera
    placements.set(ids.ingress(ing.ns, ing.name), {
      position: [center[0] + Math.cos(a) * arcR, 3.6, center[2] + Math.sin(a) * arcR],
      scale: 1,
    });
  });

  // --- PVC slabs docked at the rim of their pinned island -------------------
  const pinned = snap.edges.filter((e) => e.type === "pinned-to");
  const perNode = new Map<string, number>();
  for (const c of snap.pvcs) {
    const cid = ids.pvc(c.ns, c.name);
    const nodeId = pinned.find((e) => e.from === cid)?.to;
    const island = islands.find((il) => nodeId === ids.node(il.node));
    if (!island) continue;
    const n = perNode.get(island.node) ?? 0;
    perNode.set(island.node, n + 1);
    const a = Math.PI * 0.75 + n * 0.5;
    placements.set(cid, {
      position: [
        island.position[0] + Math.cos(a) * (island.radius + 1.6),
        island.position[1] - 0.4,
        island.position[2] + Math.sin(a) * (island.radius + 1.6),
      ],
      scale: Math.max(0.7, Math.log10(Math.max(c.capacityBytes, 1e9) / 1e9) * 0.8 + 0.7),
    });
  }

  return { islands, placements };
}
