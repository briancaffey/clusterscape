# clusterscape — plan

A 3D explorer for the home cluster. Walk around your Kubernetes resources,
hover for X-ray vision, trace a request from ingress portal to pod crystal to
the disk its data sleeps on. Educational first, beautiful always, read-only
(for now).

## Why

Headlamp answers "what is the state?" in tables. clusterscape answers "what
IS this thing?" spatially: placement (which machine), containment (namespace
→ workload → pod), flow (ingress → service → pod), and gravity (volumes pin
apps to disks). A home lab is a *place* — this renders it as one.

## Principles

1. **One model, many worlds.** Everything renders from `ClusterSnapshot` — a
   normalized graph (entities + typed edges), never raw K8s API objects. Any
   data source that can emit the model gets the whole scene for free.
2. **Static and live are the same app.** `DataProvider` is the seam:
   `getSnapshot()` (v1, JSON file) and optional `subscribe()` (later, SSE from
   an in-cluster bridge). The GitHub Pages build is simply the static provider
   pointed at a committed snapshot.
3. **Deterministic layout.** `layoutScene(snapshot)` is a pure function —
   same state, same scene. Live mode later = tween between two layout results.
4. **Calm by default, X-ray on demand.** The resting scene is a diorama;
   edges/beams/labels appear on hover/selection. Never a hairball.
5. **Public-safe pipeline.** The snapshot script sanitizes at capture time
   (no secrets/env/annotations, tailnet + tskey redaction) because snapshots
   are committed to a public repo. Trust the script, verify in CI later.

## Visual language (v1)

| thing | form |
|---|---|
| machine (Node) | floating hex island on an arc; size ∝ pods; control-plane centered; spark offset lower + farther (other subnet); red-tinted when NotReady |
| GPU | cyan "reactor" core column + light on the island |
| namespace | tinted pad (disc) inset into the deck; stable golden-angle hue |
| pod | luminous rounded crystal on its pad; red pulse = unhealthy; cyan spike = GPU claim |
| service | slim ring hovering over its pods; beams to pods on hover |
| ingress | portal ring on a front "gateway rail"; beam to backend service on hover; violet = tailscale, green = traefik |
| PVC | translucent crystal slab docked at island rim (local-path = physically pinned); height ∝ log(capacity) |
| events | text in the detail panel (v1); 3D ripples later |

Cameras: `1` isometric orthographic (MapControls), `2` first-person free-fly
(pointer lock, WASD/E/Q/Shift). Postprocessing: bloom + vignette, ACES.

## Roadmap

### v0.1 — static diorama (this repo, now)
- [x] snapshot script (kubectl → sanitized `public/data/cluster.json`)
- [x] model types + typed edge graph + deterministic layout
- [x] islands/pods/services/ingresses/volumes + hover/select + detail panel
- [x] iso + fps cameras, keyboard toggle
- [x] static export + GitHub Pages workflow
- [ ] screenshot in README

### v0.2 — legibility & polish
- [ ] namespace legend + filter (click to isolate a namespace)
- [ ] focus camera on selection (`f`), breadcrumb trail for graph hops
- [ ] workload grouping ring around owned pods; DaemonSet ghosting across islands
- [ ] search palette (`/` fuzzy find → fly to entity)
- [ ] instanced pod rendering + LOD text (perf headroom for busier clusters)
- [ ] labels/annotations in snapshot (allowlisted), pod-label-accurate service selection

### v0.3 — live bridge (the real-time seam becomes real)
- [ ] `bridge/`: tiny in-cluster deployment, read-only RBAC (get/list/watch),
      K8s watch streams → normalized snapshot deltas over SSE
- [ ] `LiveProvider` implements `subscribe()`; scene tweens layout changes
      (pods born/die = crystals grow/shatter; rollout = wave across a pad)
- [ ] host it in-cluster at `clusterscape.lan` (Argo CD app, of course)
- [ ] event ripples: Warning events pulse rings at the involved entity

### v0.4 — the story layer (cross-system flows)
- [ ] Forgejo webhook → bridge: a push renders as a comet from a "forge"
      monument to the runner island; Argo CD app health/sync from its API;
      Harbor push = cargo arriving at a registry dock
- [ ] trace mode: pick an ingress host, animate a request particle through
      portal → service ring → pod → volume
- [ ] Prometheus adapter: CPU/RAM as island heat-shimmer, VRAM as reactor
      brightness (vram-reporter!)

### v0.5 — inside the services (walk INTO an app)
- [ ] per-service interior dioramas via app APIs: Paperless = gallery of
      floating documents, Navidrome = album wall, Immich = photo garden,
      Jellyfin = theater, Forgejo = repo trees, Harbor = container port
- [ ] doorways: walk a pod crystal in fps mode → interior scene loads

### Later / ideas parking lot
- VR (WebXR is nearly free in three.js), guided tours ("what happens when I
  git push?"), time scrubbing between snapshots, sound design, action mode
  (opt-in mutations — restart pod as a physical gesture), multi-cluster.

## Architecture

```
scripts/snapshot.mjs      kubectl → sanitize → public/data/cluster.json
src/model/types.ts        ClusterSnapshot + typed ids + DataProvider seam
src/model/layout.ts       pure snapshot → positions (islands/pads/spirals)
src/state/store.ts        zustand: snapshot, hover, selection, camera mode
src/scene/*               R3F entities; each subscribes to the store
src/ui/*                  DOM layer: HUD, tooltip, detail panel
app/*                     Next.js shell (static export)
bridge/                   (v0.3) in-cluster SSE bridge, RBAC-scoped
```

Repo lives on Forgejo (`brian/clusterscape`), mirrored to GitHub for Pages.
Work tracked in `brian/home-lab` issues.
