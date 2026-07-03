"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { StaticProvider } from "@/model/types";
import { useStore } from "@/state/store";
import { Hud } from "@/ui/Hud";

const Scene = dynamic(() => import("@/scene/Scene").then((m) => m.Scene), { ssr: false });

export default function Page() {
  const snapshot = useStore((s) => s.snapshot);
  const setSnapshot = useStore((s) => s.setSnapshot);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // DataProvider seam: swap StaticProvider for a live bridge later without
    // touching the scene.
    const provider = new StaticProvider(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/cluster.json`,
    );
    provider
      .getSnapshot()
      .then(setSnapshot)
      .catch((e) => setError(String(e)));
  }, [setSnapshot]);

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
