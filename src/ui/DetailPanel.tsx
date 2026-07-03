"use client";

// Click anything in the scene -> everything the snapshot knows about it,
// including its typed relationships (click those to hop the graph) and
// recent events touching it.

import { useMemo } from "react";
import { useStore, nsColor } from "@/state/store";

export function DetailPanel() {
  const snapshot = useStore((s) => s.snapshot);
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
                : snapshot.workloads.find(
                    (w) => w.kind.toLowerCase() === kind && w.ns === ns && w.name === name,
                  );

    const related = snapshot.edges.filter((e) => e.from === selected || e.to === selected);
    const events = snapshot.events
      .filter((e) => (name ?? rest) === e.name || e.name.startsWith((name ?? rest) + "-"))
      .slice(-8);
    return { kind, ns, name: name ?? rest, entity, related, events };
  }, [snapshot, selected]);

  if (!detail) return null;

  return (
    <aside className="hud panel">
      <div className="panel-head">
        <span className="chip" style={{ background: detail.ns ? nsColor(detail.ns) : "#4a5c7a" }}>
          {detail.kind}
        </span>
        <h2>{detail.name}</h2>
        <button className="close" onClick={() => setSelected(null)}>
          ×
        </button>
      </div>
      {detail.ns && <p className="dim">namespace {detail.ns}</p>}

      {detail.entity ? (
        <pre>{JSON.stringify(detail.entity, null, 2)}</pre>
      ) : (
        <p className="dim">not in snapshot</p>
      )}

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
}
