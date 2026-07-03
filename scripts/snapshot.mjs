#!/usr/bin/env node
// Capture a sanitized snapshot of the cluster into public/data/cluster.json.
//
// This file is committed and served from a PUBLIC page, so sanitization is
// not optional:
//   - Secrets/ConfigMaps are never read at all
//   - container env is dropped entirely (values can embed credentials)
//   - annotations pass an allowlist (k3s node-args carries the join token;
//     last-applied can embed anything)
//   - a final global pass redacts tailnet MagicDNS suffixes and tskey- tokens
//
// Usage: node scripts/snapshot.mjs   (needs kubectl + current kubeconfig)

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const get = (kind, flags = ["-A"]) =>
  JSON.parse(
    execFileSync("kubectl", ["get", kind, ...flags, "-o", "json"], {
      maxBuffer: 256 * 1024 * 1024,
    }),
  ).items;

const ANNOTATION_ALLOWLIST = [/^gethomepage\.dev\//, /^argocd\.argoproj\.io\/sync-wave$/];
const pickAnnotations = (meta) =>
  Object.fromEntries(
    Object.entries(meta?.annotations ?? {}).filter(([k]) =>
      ANNOTATION_ALLOWLIST.some((re) => re.test(k)),
    ),
  );

const qty = (s) => {
  // kubernetes quantity -> number (bytes or count); good enough for display
  if (s == null) return 0;
  const m = String(s).match(/^([0-9.]+)(Ki|Mi|Gi|Ti|k|M|G|T|m)?$/);
  if (!m) return Number(s) || 0;
  const n = Number(m[1]);
  const mult = { Ki: 2 ** 10, Mi: 2 ** 20, Gi: 2 ** 30, Ti: 2 ** 40, k: 1e3, M: 1e6, G: 1e9, T: 1e12, m: 1e-3 }[m[2]] ?? 1;
  return n * mult;
};

console.error("capturing cluster state…");

const nodes = get("nodes", []).map((n) => ({
  name: n.metadata.name,
  box: n.metadata.labels?.["inference-club.com/box"] ?? n.metadata.name,
  roles: Object.keys(n.metadata.labels ?? {})
    .filter((l) => l.startsWith("node-role.kubernetes.io/"))
    .map((l) => l.split("/")[1]),
  arch: n.status.nodeInfo.architecture,
  os: n.status.nodeInfo.osImage,
  kubelet: n.status.nodeInfo.kubeletVersion,
  internalIP: (n.status.addresses ?? []).find((a) => a.type === "InternalIP")?.address ?? "",
  ready: (n.status.conditions ?? []).some((c) => c.type === "Ready" && c.status === "True"),
  capacity: {
    cpu: Number(n.status.capacity?.cpu ?? 0),
    memoryBytes: qty(n.status.capacity?.memory),
    pods: Number(n.status.capacity?.pods ?? 0),
    gpus: Number(n.status.capacity?.["nvidia.com/gpu"] ?? 0),
  },
  gpuModel: n.metadata.labels?.["nvidia.com/gpu.product"] ?? null,
}));

const namespaces = get("namespaces", []).map((ns) => ({ name: ns.metadata.name }));

const workloadOf = (kind) => (w) => ({
  kind,
  ns: w.metadata.namespace,
  name: w.metadata.name,
  replicasDesired: w.spec.replicas ?? (kind === "DaemonSet" ? w.status.desiredNumberScheduled : 1) ?? 1,
  replicasReady: w.status.readyReplicas ?? w.status.numberReady ?? 0,
  images: [...new Set((w.spec.template?.spec?.containers ?? []).map((c) => c.image))],
  annotations: pickAnnotations(w.metadata),
});

const workloads = [
  ...get("deployments").map(workloadOf("Deployment")),
  ...get("statefulsets").map(workloadOf("StatefulSet")),
  ...get("daemonsets").map(workloadOf("DaemonSet")),
];

const pods = get("pods").map((p) => {
  const owner = p.metadata.ownerReferences?.[0];
  const restarts = (p.status.containerStatuses ?? []).reduce((a, c) => a + (c.restartCount ?? 0), 0);
  return {
    ns: p.metadata.namespace,
    name: p.metadata.name,
    node: p.spec.nodeName ?? null,
    phase: p.status.phase ?? "Unknown",
    ready:
      (p.status.containerStatuses ?? []).length > 0 &&
      (p.status.containerStatuses ?? []).every((c) => c.ready),
    restarts,
    ownerKind: owner?.kind ?? null,
    ownerName: owner?.name ?? null,
    gpu: (p.spec.containers ?? []).some((c) => c.resources?.limits?.["nvidia.com/gpu"]),
    containers: (p.spec.containers ?? []).map((c) => ({
      name: c.name,
      image: c.image,
      ports: (c.ports ?? []).map((x) => x.containerPort),
    })),
    pvcs: (p.spec.volumes ?? [])
      .filter((v) => v.persistentVolumeClaim)
      .map((v) => v.persistentVolumeClaim.claimName),
    startTime: p.status.startTime ?? null,
  };
});

const services = get("services").map((s) => ({
  ns: s.metadata.namespace,
  name: s.metadata.name,
  type: s.spec.type,
  clusterIP: s.spec.clusterIP === "None" ? null : s.spec.clusterIP,
  ports: (s.spec.ports ?? []).map((p) => ({ port: p.port, targetPort: p.targetPort, protocol: p.protocol })),
  selector: s.spec.selector ?? null,
}));

const ingresses = get("ingresses").map((i) => ({
  ns: i.metadata.namespace,
  name: i.metadata.name,
  className: i.spec.ingressClassName ?? null,
  hosts: (i.spec.rules ?? []).map((r) => r.host).filter(Boolean),
  backends: (i.spec.rules ?? []).flatMap((r) =>
    (r.http?.paths ?? []).map((p) => ({
      host: r.host ?? "",
      path: p.path ?? "/",
      serviceName: p.backend?.service?.name ?? "",
      port: p.backend?.service?.port?.number ?? p.backend?.service?.port?.name ?? null,
    })),
  ),
  annotations: pickAnnotations(i.metadata),
}));

const pvcs = get("pvc").map((c) => ({
  ns: c.metadata.namespace,
  name: c.metadata.name,
  storageClass: c.spec.storageClassName ?? null,
  capacityBytes: qty(c.status.capacity?.storage ?? c.spec.resources?.requests?.storage),
  accessModes: c.spec.accessModes ?? [],
  volumeName: c.spec.volumeName ?? null,
  status: c.status.phase,
}));

const pvs = get("pv", []).map((v) => ({
  name: v.metadata.name,
  capacityBytes: qty(v.spec.capacity?.storage),
  storageClass: v.spec.storageClassName ?? null,
  claim: v.spec.claimRef ? `${v.spec.claimRef.namespace}/${v.spec.claimRef.name}` : null,
  node:
    v.spec.nodeAffinity?.required?.nodeSelectorTerms?.[0]?.matchExpressions?.find(
      (e) => e.key === "kubernetes.io/hostname",
    )?.values?.[0] ?? null,
  hostPath: v.spec.hostPath?.path ?? v.spec.local?.path ?? null,
}));

const events = get("events")
  .filter((e) => e.type === "Warning" || e.reason === "Started" || e.reason === "Pulled")
  .slice(-400)
  .map((e) => ({
    ns: e.metadata.namespace,
    kind: e.involvedObject?.kind ?? "",
    name: e.involvedObject?.name ?? "",
    type: e.type,
    reason: e.reason,
    message: e.message ?? "",
    count: e.count ?? 1,
    lastTimestamp: e.lastTimestamp ?? e.eventTime ?? null,
  }));

// ---- edges (typed relationships; the scene draws these) --------------------
const id = {
  node: (n) => `node:${n}`,
  pod: (p) => `pod:${p.ns}/${p.name}`,
  workload: (w) => `${w.kind.toLowerCase()}:${w.ns}/${w.name}`,
  service: (s) => `service:${s.ns}/${s.name}`,
  ingress: (i) => `ingress:${i.ns}/${i.name}`,
  pvc: (ns, name) => `pvc:${ns}/${name}`,
};
const edges = [];
for (const p of pods) {
  if (p.node) edges.push({ type: "runs-on", from: id.pod(p), to: id.node(p.node) });
  for (const c of p.pvcs) edges.push({ type: "mounts", from: id.pod(p), to: id.pvc(p.ns, c) });
}
for (const w of workloads) {
  for (const p of pods) {
    if (p.ns !== w.ns) continue;
    // Deployment owns ReplicaSet owns Pod — match by name prefix; SS/DS own directly
    const owns =
      (w.kind === "Deployment" && p.ownerKind === "ReplicaSet" && p.ownerName?.startsWith(w.name + "-")) ||
      (p.ownerKind === w.kind && p.ownerName === w.name);
    if (owns) edges.push({ type: "owns", from: id.workload(w), to: id.pod(p) });
  }
}
for (const s of services) {
  if (!s.selector) continue;
  for (const p of pods) {
    if (p.ns !== s.ns) continue;
    // selector match needs pod labels; approximate via owner workload name — v1
    // keeps pod labels out of the snapshot, so match on service name === owner
    // prefix OR selector.app === owner name (covers this repo's conventions).
    const sel = s.selector.app ?? s.selector["app.kubernetes.io/name"] ?? null;
    if (sel && (p.ownerName?.startsWith(sel) || p.name.startsWith(sel)))
      edges.push({ type: "selects", from: id.service(s), to: id.pod(p) });
  }
}
for (const i of ingresses)
  for (const b of i.backends)
    if (b.serviceName)
      edges.push({ type: "routes-to", from: id.ingress(i), to: id.service({ ns: i.ns, name: b.serviceName }) });
for (const c of pvcs) {
  if (c.volumeName) {
    const pv = pvs.find((v) => v.name === c.volumeName);
    if (pv?.node) edges.push({ type: "pinned-to", from: id.pvc(c.ns, c.name), to: id.node(pv.node) });
  }
}

const snapshot = {
  meta: {
    capturedAt: new Date().toISOString(),
    clusterName: "home-cluster",
    counts: {
      nodes: nodes.length, namespaces: namespaces.length, workloads: workloads.length,
      pods: pods.length, services: services.length, ingresses: ingresses.length, pvcs: pvcs.length,
    },
  },
  nodes, namespaces, workloads, pods, services, ingresses, pvcs, pvs, events, edges,
};

// ---- final redaction pass over the serialized document ---------------------
let json = JSON.stringify(snapshot, null, 1);
json = json
  .replace(/([a-z0-9-]+)\.[a-z0-9-]+\.ts\.net/gi, "$1.<tailnet>.ts.net")
  .replace(/tskey-[A-Za-z0-9-_]+/g, "tskey-<redacted>")
  .replace(/100\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, "100.x.x.x");

mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/cluster.json", json);
console.error(
  `wrote public/data/cluster.json — ${nodes.length} nodes, ${pods.length} pods, ` +
    `${services.length} services, ${edges.length} edges`,
);
