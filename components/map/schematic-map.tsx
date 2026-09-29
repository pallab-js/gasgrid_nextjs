"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Layers, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZONE_STROKE } from "@/lib/constants";
import type { MapData } from "@/lib/repo/mapdata";
import type { Role } from "@/lib/schema";
import { NodeDrawer } from "@/components/network/node-drawer";

const CATEGORY_COLOR: Record<string, string> = {
  DOMESTIC: "#5865f2",
  COMMERCIAL: "#ec48bd",
  INDUSTRIAL: "#f0b429",
  CNG: "#00b0f4",
  INSTITUTIONAL: "#35ed7e",
};

const STATUS_CHIP: Record<string, string> = {
  operational: "border-success/60 text-success",
  maintenance: "border-warning/70 text-warning",
  isolated: "border-muted-foreground/50 text-muted-foreground",
  faulty: "border-destructive text-destructive",
  planned: "border-info/70 text-info",
};

const STATUS_DOT: Record<string, string> = {
  operational: "bg-success",
  maintenance: "bg-warning",
  isolated: "bg-muted-foreground/50",
  faulty: "bg-destructive",
  planned: "bg-info",
};

const CLUSTER_ZOOM = 13; // below this, consumers render as grid clusters

export function SchematicMap({
  initial,
  role,
}: {
  initial: MapData;
  role: Role;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<number, import("leaflet").Marker>>(new Map());
  const consumersRef = useRef<import("leaflet").LayerGroup | null>(null);
  const liveNodesRef = useRef(initial.nodes);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const centerOnNode = useCallback((id: number) => {
    const node = liveNodesRef.current.find((n) => n.id === id);
    const map = mapRef.current;
    if (!node || !map) return;
    map.flyTo([node.lat, node.lng], Math.max(map.getZoom(), 13.5), {
      duration: 0.6,
    });
  }, []);

  /* open drawer + centre when arriving with ?node=id (after the map is ready) */
  useEffect(() => {
    if (!ready) return;
    const id = Number(
      new URLSearchParams(window.location.search).get("node") ?? 0
    );
    if (id <= 0) return;
    const t = setTimeout(() => {
      setSelectedId(id);
      centerOnNode(id);
    }, 0);
    return () => clearTimeout(t);
  }, [ready, centerOnNode]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;
    const markers = markersRef.current;

    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !containerRef.current) return;
      await import("leaflet/dist/leaflet.css");

      const map = L.map(containerRef.current, {
        crs: L.CRS.Simple,
        minZoom: 11,
        maxZoom: 15,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        attributionControl: false,
        zoomControl: false,
      });
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      mapRef.current = map;

      map.fitBounds(L.latLngBounds(initial.boundary), {
        padding: [40, 40],
        maxZoom: 13,
      });

      /* layers */
      const boundaryLayer = L.layerGroup();
      L.polygon(initial.boundary, {
        color: "#5865f2",
        weight: 1.5,
        opacity: 0.7,
        dashArray: "7 7",
        fillColor: "#5865f2",
        fillOpacity: 0.03,
        interactive: false,
      }).addTo(boundaryLayer);

      const pipelineLayer = L.layerGroup();
      for (const s of initial.segments) {
        const isolated = s.status === "isolated" || s.status === "faulty";
        const dashed = s.status === "maintenance" || s.status === "planned";
        const line = L.polyline(s.path, {
          color: isolated
            ? "var(--destructive, #ec48bd)"
            : (ZONE_STROKE as Record<string, string>)[s.zone] ?? "#5865f2",
          weight: 1.5 + Math.min(s.diameterMm / 45, 5),
          opacity: 0.85,
          dashArray: dashed ? "7 5" : undefined,
        });
        line.bindTooltip(`Ø ${s.diameterMm} mm · ${s.zone} zone`, {
          sticky: true,
          className: "gas-map-tooltip",
        });
        line.addTo(pipelineLayer);
      }

      const stationLayer = L.layerGroup();
      const makeIcon = (n: MapData["nodes"][number]) => {
        const dot = STATUS_DOT[n.status] ?? "bg-muted-foreground";
        const chip = STATUS_CHIP[n.status] ?? "border-border text-muted-foreground";
        return L.divIcon({
          className: "gas-map-marker",
          html: `<div class="gas-map-chip ${chip}">
              <span class="gas-map-dot ${dot}"></span>
              <span class="gas-map-code">${n.code}</span>
              ${n.openAlarms > 0 ? `<span class="gas-map-alarm">${n.openAlarms}</span>` : ""}
            </div>`,
          iconSize: [0, 0],
        });
      };
      const stationNodes = initial.nodes.filter((n) =>
        ["CGS", "DPRS", "CNG", "MRS", "IPRS", "ODORISER"].includes(n.kind)
      );
      const nonRtu = initial.nodes.filter(
        (n) => !["CGS", "DPRS", "CNG", "MRS", "IPRS", "ODORISER"].includes(n.kind)
      );
      for (const n of [...stationNodes, ...nonRtu]) {
        const marker = L.marker([n.lat, n.lng], {
          icon: makeIcon(n),
          keyboard: false,
          riseOnHover: true,
        });
        marker.on("click", () => setSelectedId(n.id));
        marker.addTo(stationLayer);
        markersRef.current.set(n.id, marker);
      }

      /* consumer dots with grid clustering */
      const consumerLayer = L.layerGroup();
      consumersRef.current = consumerLayer;
      const renderConsumers = () => {
        consumerLayer.clearLayers();
        const zoom = map.getZoom();
        const latFactor = Math.pow(2, zoom);
        if (zoom >= CLUSTER_ZOOM) {
          for (const c of initial.consumers) {
            L.circleMarker([c.lat, c.lng], {
              radius: 3,
              color: CATEGORY_COLOR[c.category] ?? "#5865f2",
              weight: 1,
              fillColor: CATEGORY_COLOR[c.category] ?? "#5865f2",
              fillOpacity: 0.55,
              opacity: 0.8,
            })
              .bindTooltip(c.category, { className: "gas-map-tooltip" })
              .addTo(consumerLayer);
          }
        } else {
          const cell = 56 / latFactor; // ~56 px grid
          const buckets = new Map<
            string,
            { lat: number; lng: number; n: number; cat: Record<string, number> }
          >();
          for (const c of initial.consumers) {
            const key = `${Math.floor(c.lat / cell)}:${Math.floor(c.lng / cell)}`;
            const b = buckets.get(key) ?? { lat: 0, lng: 0, n: 0, cat: {} };
            b.lat += c.lat;
            b.lng += c.lng;
            b.n += 1;
            b.cat[c.category] = (b.cat[c.category] ?? 0) + 1;
            buckets.set(key, b);
          }
          for (const b of buckets.values()) {
            const dominant = Object.entries(b.cat).sort((a, z) => z[1] - a[1])[0];
            const marker = L.circleMarker([b.lat / b.n, b.lng / b.n], {
              radius: 5 + Math.min(b.n, 40) * 0.45,
              color: CATEGORY_COLOR[dominant[0]] ?? "#5865f2",
              weight: 1.5,
              fillColor: CATEGORY_COLOR[dominant[0]] ?? "#5865f2",
              fillOpacity: 0.35,
            });
            marker.bindTooltip(`${b.n} consumers`, {
              className: "gas-map-tooltip",
            });
            marker.addTo(consumerLayer);
          }
        }
      };
      renderConsumers();
      map.on("zoomend", renderConsumers);

      boundaryLayer.addTo(map);
      pipelineLayer.addTo(map);
      consumerLayer.addTo(map);
      stationLayer.addTo(map);

      L.control
        .layers(
          undefined,
          {
            "City boundary": boundaryLayer,
            "Pipeline routes": pipelineLayer,
            Stations: stationLayer,
            Consumers: consumerLayer,
          },
          { collapsed: false }
        )
        .addTo(map);

      setReady(true);
    })();

    return () => {
      disposed = true;
      const map = mapRef.current;
      mapRef.current = null;
      markers.clear();
      if (map) map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* live node badges (status ring, alarm count) */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/live/nodes", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const body = (await res.json()) as { nodes: MapData["nodes"] };
        if (!alive) return;
        liveNodesRef.current = body.nodes;
        const byId = new Map(body.nodes.map((n) => [n.id, n]));
        for (const [id, marker] of markersRef.current) {
          const n = byId.get(id);
          if (!n) continue;
          const dot = STATUS_DOT[n.status] ?? "bg-muted-foreground";
          const chip = STATUS_CHIP[n.status] ?? "border-border text-muted-foreground";
          const el = marker.getElement()?.querySelector(".gas-map-chip");
          if (!el) continue;
          el.className = `gas-map-chip ${chip}`;
          const dotEl = el.querySelector(".gas-map-dot");
          if (dotEl) dotEl.className = `gas-map-dot ${dot}`;
          const alarmEl = el.querySelector(".gas-map-alarm");
          if (n.openAlarms > 0) {
            if (alarmEl) alarmEl.textContent = String(n.openAlarms);
            else
              el.insertAdjacentHTML(
                "beforeend",
                `<span class="gas-map-alarm">${n.openAlarms}</span>`
              );
          } else if (alarmEl) {
            alarmEl.remove();
          }
        }
      } catch {
        /* transient */
      }
    };
    const id = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ready]);

  const recenter = async () => {
    const L = (await import("leaflet")).default;
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(L.latLngBounds(initial.boundary), {
      padding: [40, 40],
      maxZoom: 13,
    });
  };

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="gas-map-container absolute inset-0 h-full w-full"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="pointer-events-none absolute top-3 left-3 z-[500] flex flex-col gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-xs text-muted-foreground shadow-xl backdrop-blur">
          <Layers className="size-3.5" aria-hidden />
          Offline schematic · no tile server · {initial.consumers.length}{" "}
          consumers · {initial.segments.length} segments
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="pointer-events-auto h-8 w-fit text-xs"
          onClick={recenter}
        >
          <LocateFixed className="size-3.5" />
          Fit network
        </Button>
      </div>

      <NodeDrawer
        nodeId={selectedId}
        role={role}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
