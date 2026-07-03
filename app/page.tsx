"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { StaticProvider } from "@/model/types";
import { useStore } from "@/state/store";
import { Hud } from "@/ui/Hud";

const Scene = dynamic(() => import("@/scene/Scene").then((m) => m.Scene), { ssr: false });

export default function Page() {
  const snapshot = useStore((s) => s.snapshot);
  const setSnapshot = useStore((s) => s.setSnapshot);

  useEffect(() => {
    // DataProvider seam: swap StaticProvider for a live bridge later without
    // touching the scene.
    const provider = new StaticProvider(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/cluster.json`,
    );
    provider.getSnapshot().then(setSnapshot).catch(console.error);
  }, [setSnapshot]);

  return (
    <main>
      {snapshot ? <Scene /> : <div className="loading">loading cluster…</div>}
      <Hud />
    </main>
  );
}
