"use client";

// Click anything in the scene -> everything the snapshot knows about it:
// hardware gauges for machines, aggregate views for namespaces, raw facts +
// typed relationships (click to hop the graph) + recent events for the rest.

import { useMemo } from "react";
import { useStore, nsColor } from "@/state/store";

const fmtBytes = (b: number | null | undefined) => {
  if (b == null) return "—";
  const u = ["B", "KiB", "MiB", "GiB", "TiB"];
  let i = 0, v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${u[i]}`;
};

export function DetailPanel() {
  const snapshot = useStore((s) => s.snapshot);
  const logos = useStore((s) => s.logos);
  const selected = useStore((s) => s.selected);
  const setSelected = useStore((s) => s.setSelected);

  const detail = useMemo(() => {
    if (!snapshot || !selected) return null;
    const [kind, rest] = selected.split(":", 2);
    const [ns, name] = rest.includes("/") ? rest.split("/", 2) : [null, rest];

    const entity: object | undefined =
      kind === "node"
        ? snapshot.nodes.find((n) => n.name === rest)
        : kind === "pod"
          ? snapshot.pods.find((p) => p.ns === ns && p.name === name)
          : kind === "service"
            ? snapshot.services.find((s) => s.ns === ns && s.name === name)
            : kind === "ingress"
              ? snapshot.ingresses.find((i) => i.ns === ns && i.name === name)
              : kind === "pvc"
                ? snapshot.pvcs.find((c) => c.ns === ns && c.name === name)
                : kind === "namespace"
                  ? undefined
                  : snapshot.workloads.find(
                      (w) => w.kind.toLowerCase() === kind && w.ns === ns && w.name === name,
                    );

    const related = snapshot.edges.filter((e) => e.from === selected || e.to === selected);
    const events = snapshot.events
      .filter((e) => (name ?? rest) === e.name || e.name.startsWith((name ?? rest) + "-"))
      .slice(-8);
    return { kind, ns, name: name ?? rest, entity, related, events };
  }, [snapshot, selected]);

  if (!detail || !snapshot) return null;
  const metrics = detail.kind === "node" ? snapshot.metrics?.nodes?.[detail.name] : null;
  const vram =
    detail.kind === "pod"
      ? snapshot.metrics?.podVram?.filter((v) => v.pod === detail.name)
      : null;

  return (
    <aside className="hud panel">
      <div className="panel-head">
        <span
          className="chip"
          style={{
            background:
              detail.kind === "namespace"
                ? nsColor(detail.name)
                : detail.ns
                  ? nsColor(detail.ns)
                  : "#4a5c7a",
          }}
        >
          {detail.kind}
        </span>
        <h2>{detail.name}</h2>
        <button className="close" onClick={() => setSelected(null)}>
          ×
        </button>
      </div>
      {detail.ns && <p className="dim">namespace {detail.ns}</p>}

      {detail.kind === "namespace" && <NamespaceView ns={detail.name} />}

      {metrics && (
        <>
          <h3>hardware</h3>
          <Gauge label="memory" used={metrics.memUsedBytes} total={metrics.memTotalBytes} />
          <Gauge label="disk /" used={metrics.diskUsedBytes} total={metrics.diskTotalBytes} />
          {metrics.cpuPct != null && (
            <Gauge label="cpu" pct={metrics.cpuPct} text={`${metrics.cpuPct.toFixed(1)}%`} />
          )}
          <p className="dim">
            {metrics.cpuTempC != null && `cpu ${metrics.cpuTempC.toFixed(0)}°C`}
            {metrics.gpuTempC != null && ` · gpu ${metrics.gpuTempC.toFixed(0)}°C`}
            {metrics.gpuUtilPct != null && ` · gpu util ${metrics.gpuUtilPct.toFixed(0)}%`}
          </p>
        </>
      )}

      {vram && vram.length > 0 && (
        <>
          <h3>gpu memory</h3>
          {vram.map((v, i) => (
            <p key={i}>{fmtBytes(v.bytes)} <span className="dim">on {v.node}</span></p>
          ))}
        </>
      )}

      {detail.entity ? (
        <pre>{JSON.stringify(detail.entity, null, 2)}</pre>
      ) : detail.kind !== "namespace" ? (
        <p className="dim">not in snapshot</p>
      ) : null}

      {detail.related.length > 0 && (
        <>
          <h3>relationships</h3>
          <ul>
            {detail.related.map((e, i) => {
              const target = e.from === selected ? e.to : e.from;
              const dir = e.from === selected ? "→" : "←";
              return (
                <li key={i}>
                  <span className="dim">
                    {dir} {e.type}
                  </span>{" "}
                  <button className="link" onClick={() => setSelected(target)}>
                    {target}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {detail.events.length > 0 && (
        <>
          <h3>recent events</h3>
          <ul className="events">
            {detail.events.map((e, i) => (
              <li key={i} className={e.type === "Warning" ? "warn" : ""}>
                <span className="dim">{e.reason}</span> {e.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );

  function NamespaceView({ ns }: { ns: string }) {
    const s = snapshot!;
    const pods = s.pods.filter((p) => p.ns === ns);
    const workloads = s.workloads.filter((w) => w.ns === ns);
    const services = s.services.filter((x) => x.ns === ns);
    const pvcs = s.pvcs.filter((c) => c.ns === ns);
    const slug = logos?.namespaces[ns]?.slug;
    const healthy = pods.filter((p) => p.phase === "Running" && p.ready).length;
    return (
      <>
        {slug && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ns-logo" src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logos/${slug}.png`} alt="" />
        )}
        <h3>contents</h3>
        <p>
          {workloads.length} workloads · {pods.length} pods ({healthy} healthy) · {services.length}{" "}
          services · {pvcs.length} volumes
        </p>
        <ul>
          {workloads.map((w) => {
            const id = `${w.kind.toLowerCase()}:${w.ns}/${w.name}`;
            return (
              <li key={id}>
                <span className="dim">{w.kind}</span>{" "}
                <button className="link" onClick={() => setSelected(id)}>
                  {w.name}
                </button>{" "}
                <span className="dim">
                  {w.replicasReady}/{w.replicasDesired}
                </span>
              </li>
            );
          })}
        </ul>
      </>
    );
  }
}

function Gauge({
  label,
  used,
  total,
  pct,
  text,
}: {
  label: string;
  used?: number | null;
  total?: number | null;
  pct?: number;
  text?: string;
}) {
  const p = pct ?? (used != null && total ? (used / total) * 100 : null);
  if (p == null) return null;
  return (
    <div className="gauge">
      <span className="gauge-label">{label}</span>
      <div className="gauge-track">
        <div
          className="gauge-fill"
          style={{ width: `${Math.min(p, 100)}%`, background: p > 90 ? "#ff5468" : p > 75 ? "#ffb020" : "#4da3ff" }}
        />
      </div>
      <span className="gauge-text">{text ?? `${fmtBytes(used)} / ${fmtBytes(total)}`}</span>
    </div>
  );
}
