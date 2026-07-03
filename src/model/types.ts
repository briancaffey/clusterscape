// The snapshot document model. Everything the scene renders derives from
// this — the shape is deliberately independent of raw Kubernetes API objects
// so that live providers (watch streams, app APIs) can emit the same model.

export interface ClusterSnapshot {
  meta: {
    capturedAt: string;
    clusterName: string;
    counts: Record<string, number>;
  };
  nodes: NodeInfo[];
  namespaces: { name: string }[];
  workloads: Workload[];
  pods: PodInfo[];
  services: ServiceInfo[];
  ingresses: IngressInfo[];
  pvcs: PvcInfo[];
  pvs: PvInfo[];
  events: EventInfo[];
  edges: Edge[];
}

export interface NodeInfo {
  name: string;
  box: string;
  roles: string[];
  arch: string;
  os: string;
  kubelet: string;
  internalIP: string;
  ready: boolean;
  capacity: { cpu: number; memoryBytes: number; pods: number; gpus: number };
  gpuModel: string | null;
}

export interface Workload {
  kind: "Deployment" | "StatefulSet" | "DaemonSet";
  ns: string;
  name: string;
  replicasDesired: number;
  replicasReady: number;
  images: string[];
  annotations: Record<string, string>;
}

export interface PodInfo {
  ns: string;
  name: string;
  node: string | null;
  phase: string;
  ready: boolean;
  restarts: number;
  ownerKind: string | null;
  ownerName: string | null;
  gpu: boolean;
  containers: { name: string; image: string; ports: number[] }[];
  pvcs: string[];
  startTime: string | null;
}

export interface ServiceInfo {
  ns: string;
  name: string;
  type: string;
  clusterIP: string | null;
  ports: { port: number; targetPort: number | string; protocol: string }[];
  selector: Record<string, string> | null;
}

export interface IngressInfo {
  ns: string;
  name: string;
  className: string | null;
  hosts: string[];
  backends: { host: string; path: string; serviceName: string; port: number | string | null }[];
  annotations: Record<string, string>;
}

export interface PvcInfo {
  ns: string;
  name: string;
  storageClass: string | null;
  capacityBytes: number;
  accessModes: string[];
  volumeName: string | null;
  status: string;
}

export interface PvInfo {
  name: string;
  capacityBytes: number;
  storageClass: string | null;
  claim: string | null;
  node: string | null;
  hostPath: string | null;
}

export interface EventInfo {
  ns: string;
  kind: string;
  name: string;
  type: string;
  reason: string;
  message: string;
  count: number;
  lastTimestamp: string | null;
}

export type EdgeType = "runs-on" | "owns" | "selects" | "routes-to" | "mounts" | "pinned-to";
export interface Edge {
  type: EdgeType;
  from: string; // typed id, e.g. "pod:ns/name"
  to: string;
}

/** Typed entity id helpers — must match scripts/snapshot.mjs. */
export const ids = {
  node: (name: string) => `node:${name}`,
  pod: (ns: string, name: string) => `pod:${ns}/${name}`,
  workload: (kind: string, ns: string, name: string) => `${kind.toLowerCase()}:${ns}/${name}`,
  service: (ns: string, name: string) => `service:${ns}/${name}`,
  ingress: (ns: string, name: string) => `ingress:${ns}/${name}`,
  pvc: (ns: string, name: string) => `pvc:${ns}/${name}`,
};

/**
 * DataProvider is the seam between the scene and the world. V1 ships the
 * static provider; a live provider later implements subscribe() over SSE /
 * websocket against an in-cluster bridge and the scene animates the deltas.
 */
export interface DataProvider {
  getSnapshot(): Promise<ClusterSnapshot>;
  subscribe?(onChange: (next: ClusterSnapshot) => void): () => void;
}

export class StaticProvider implements DataProvider {
  constructor(private url: string) {}
  async getSnapshot(): Promise<ClusterSnapshot> {
    const res = await fetch(this.url);
    if (!res.ok) throw new Error(`snapshot fetch failed: ${res.status}`);
    return res.json();
  }
}
