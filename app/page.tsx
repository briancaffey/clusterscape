"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { StaticProvider, LiveProvider, type DataProvider } from "@/model/types";
import { useStore } from "@/state/store";
import { Hud } from "@/ui/Hud";

const Scene = dynamic(() => import("@/scene/Scene").then((m) => m.Scene), { ssr: false });

export default function Page() {
  const snapshot = useStore((s) => s.snapshot);
  const setSnapshot = useStore((s) => s.setSnapshot);
  const setLogos = useStore((s) => s.setLogos);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    // DataProvider seam: ?live=1 talks to the bridge (same-origin or
    // NEXT_PUBLIC_BRIDGE_URL); default is the committed static snapshot.
    const params = new URLSearchParams(window.location.search);
    const live = params.get("live") === "1";
    const provider: DataProvider = live
      ? new LiveProvider(process.env.NEXT_PUBLIC_BRIDGE_URL ?? "")
      : new StaticProvider(`${base}/data/cluster.json`);

    provider
      .getSnapshot()
      .then(setSnapshot)
      .catch((e) => setError(String(e)));
    const unsub = provider.subscribe?.(setSnapshot);

    fetch(`${base}/logos/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => m && setLogos(m))
      .catch(() => {});

    return () => unsub?.();
  }, [setSnapshot, setLogos]);

  return (
    <main>
      {snapshot ? (
        <Scene />
      ) : (
        <div className="loading">
          {error ? (
            <div>
              <p>failed to load snapshot: {error}</p>
              <p className="dim">
                expected at /data/cluster.json — run `npm run snapshot`, and make
                sure you&apos;re on the right port (another app may own this one)
              </p>
            </div>
          ) : (
            "loading cluster…"
          )}
        </div>
      )}
      <Hud />
    </main>
  );
}
