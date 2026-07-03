"use client";

// First-visit welcome: what you're looking at, and whether it's alive.

import { useStore } from "@/state/store";

export function Welcome() {
  const show = useStore((s) => s.showWelcome);
  const setShow = useStore((s) => s.setShowWelcome);
  const snapshot = useStore((s) => s.snapshot);
  const dataMode = useStore((s) => s.dataMode);
  if (!show || !snapshot) return null;

  const captured = new Date(snapshot.meta.capturedAt).toLocaleString();
  const dismiss = () => {
    window.localStorage.setItem("clusterscape-welcome-seen", "1");
    setShow(false);
  };

  return (
    <div className="welcome-backdrop" onClick={dismiss}>
      <div className="welcome" onClick={(e) => e.stopPropagation()}>
        <h1>Welcome to clusterscape</h1>
        <p>
          You&apos;re looking at a real Kubernetes home lab — Brian&apos;s <em>home-cluster</em> —
          rendered as a place instead of a table.
        </p>
        {dataMode === "live" ? (
          <p className="mode mode-live">
            ● LIVE — this view is connected to the cluster and refreshes itself
            every ~20 seconds. What you see is what&apos;s running right now.
          </p>
        ) : (
          <p className="mode mode-static">
            ◼ STATIC SNAPSHOT — a frozen moment of the cluster, captured{" "}
            <strong>{captured}</strong>. Nothing here updates; the live version
            runs inside the cluster itself.
          </p>
        )}
        <ul>
          <li><strong>Floating islands</strong> are machines — the glowing pillar is a GPU, tinted by its temperature; the golden halo marks the control plane</li>
          <li><strong>Glass tanks</strong> show real RAM and disk utilization</li>
          <li><strong>Little crystals</strong> are pods, grouped into tinted namespace pads under their service&apos;s logo; shape = workload kind</li>
          <li><strong>Rings</strong> above are Services; the <strong>arc of portals</strong> out front are Ingresses; <strong>slabs</strong> at the rim are volumes, docked where the bytes physically live</li>
        </ul>
        <p className="dim">
          Hover anything to identify it · click for full details and relationships ·{" "}
          <kbd>1</kbd> isometric · <kbd>2</kbd> first person · <kbd>3</kbd> third person ·{" "}
          <kbd>T</kbd> day/night
        </p>
        <button className="welcome-go" onClick={dismiss}>
          explore →
        </button>
      </div>
    </div>
  );
}
