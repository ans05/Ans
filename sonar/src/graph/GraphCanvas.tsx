"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { EntityType } from "@/domain/types";
import { neighborIds, type GraphView, type ViewLink, type ViewNode } from "@/network/graph";
import { glyphPath, LINK_DISTANCE, nodeRadius, TYPE_COLOR } from "./theme";

interface SimNode extends ViewNode, d3.SimulationNodeDatum {
  r: number;
}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  type: ViewLink["type"];
  weight: number;
}

export interface GraphCanvasProps {
  view: GraphView;
  selectedId: string | null;
  focus: { id: string; nonce: number } | null;
  /** Bump to re-frame the whole graph (after load, scene change, "Fit" button). */
  fitNonce: number;
  /** True when a bottom-sheet panel covers the lower part of the canvas (mobile). */
  bottomInset: boolean;
  onSelect: (id: string | null) => void;
  onHover: (hover: { id: string; x: number; y: number } | null) => void;
}

/**
 * Force-directed graph. d3 owns the SVG subtree; React only supplies data.
 * Node objects persist across renders so expanding the graph keeps the
 * existing layout stable and new nodes bloom outward from their neighbours.
 */
export default function GraphCanvas({ view, selectedId, focus, fitNonce, bottomInset, onSelect, onHover }: GraphCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const live = useRef({
    sim: null as d3.Simulation<SimNode, SimLink> | null,
    nodes: new Map<string, SimNode>(),
    links: [] as SimLink[],
    zoom: null as d3.ZoomBehavior<SVGSVGElement, unknown> | null,
    size: { w: 800, h: 600 },
    hover: null as string | null,
    selected: null as string | null,
    view,
    k: 1,
  });
  // Latest callbacks without re-binding d3 handlers.
  const cb = useRef({ onSelect, onHover });
  cb.current = { onSelect, onHover };

  // ── One-time setup: svg layers, zoom, simulation, resize ────────────
  useEffect(() => {
    const L = live.current;
    const svg = d3.select(svgRef.current!);
    svg.selectAll("*").remove();
    const root = svg.append("g").attr("class", "viewport");
    root.append("g").attr("class", "links");
    root.append("g").attr("class", "nodes");

    L.zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 3])
      .on("zoom", (e) => {
        root.attr("transform", e.transform.toString());
        if (Math.abs(e.transform.k - L.k) > 0.05) {
          L.k = e.transform.k;
          applyLabelVisibility();
        }
      });
    svg.call(L.zoom).on("dblclick.zoom", null);
    svg.on("click", (e) => {
      if (e.target === svgRef.current) cb.current.onSelect(null);
    });

    L.sim = d3
      .forceSimulation<SimNode>()
      .force("charge", d3.forceManyBody<SimNode>().strength((d) => -180 - d.r * 9).distanceMax(520))
      .force("collide", d3.forceCollide<SimNode>().radius((d) => d.r + 16).strength(0.9))
      .force("x", d3.forceX(0).strength(0.035))
      .force("y", d3.forceY(0).strength(0.045))
      .alphaDecay(0.035)
      .on("tick", tick);

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const prev = L.size;
      L.size = { w: width, h: height };
      svg.attr("viewBox", `0 0 ${width} ${height}`);
      // Keep world origin near the centre on first layout.
      if (!svg.property("__centered")) {
        svg.call(L.zoom!.transform, d3.zoomIdentity.translate(width / 2, height / 2));
        svg.property("__centered", true);
      } else {
        // Keep whatever was at the centre at the centre (panel opening, window resize).
        const k = d3.zoomTransform(svgRef.current!).k;
        svg.call(L.zoom!.translateBy, (width - prev.w) / 2 / k, (height - prev.h) / 2 / k);
      }
    });
    ro.observe(wrapRef.current!);

    function tick() {
      root
        .select(".links")
        .selectAll<SVGLineElement, SimLink>("line")
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);
      root
        .select(".nodes")
        .selectAll<SVGGElement, SimNode>("g.node")
        .attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    }

    function applyLabelVisibility() {
      root.select(".nodes").selectAll<SVGGElement, SimNode>("g.node").classed("zoomed", L.k > 1.15);
    }

    return () => {
      L.sim?.stop();
      ro.disconnect();
      svg.on(".zoom", null);
    };
  }, []);

  // ── Data sync: join nodes/links, restart simulation ─────────────────
  useEffect(() => {
    const L = live.current;
    if (!L.sim || !svgRef.current) return;
    L.view = view;
    const svg = d3.select(svgRef.current);
    const root = svg.select<SVGGElement>(".viewport");

    // Persist node objects; place newcomers beside an existing neighbour.
    const next = new Map<string, SimNode>();
    const placed = (id: string) => L.nodes.get(id);
    for (const n of view.nodes) {
      const prev = L.nodes.get(n.id);
      const r = nodeRadius(n.type, n.degree);
      if (prev) {
        Object.assign(prev, n, { r });
        next.set(n.id, prev);
        continue;
      }
      const anchor = view.links
        .map((l) => (l.source === n.id ? l.target : l.target === n.id ? l.source : null))
        .map((id) => (id ? placed(id) : undefined))
        .find((p) => p && p.x != null);
      const a = Math.random() * Math.PI * 2;
      next.set(n.id, {
        ...n, r,
        x: (anchor?.x ?? 0) + Math.cos(a) * 24,
        y: (anchor?.y ?? 0) + Math.sin(a) * 24,
      });
    }
    L.nodes = next;
    const nodes = [...next.values()];
    const links: SimLink[] = view.links.map((l) => ({
      id: l.id, type: l.type, weight: l.weight,
      source: next.get(l.source)!, target: next.get(l.target)!,
    }));
    L.links = links;

    // Links
    root
      .select(".links")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(links, (d) => d.id)
      .join(
        (enter) => enter.append("line").attr("class", "link").attr("stroke-opacity", 0).call((s) => s.transition().duration(500).attr("stroke-opacity", null)),
        (update) => update,
        (exit) => exit.transition().duration(250).attr("stroke-opacity", 0).remove(),
      )
      .attr("data-type", (d) => d.type)
      .attr("stroke-width", (d) => 0.8 + d.weight * 1.6);

    // Nodes
    const sel = root
      .select(".nodes")
      .selectAll<SVGGElement, SimNode>("g.node")
      .data(nodes, (d) => d.id)
      .join(
        (enter) => {
          const g = enter
            .append("g")
            .attr("class", "node")
            .attr("tabindex", 0)
            .attr("role", "button")
            .attr("transform", (d) => `translate(${d.x},${d.y})`);
          const body = g.append("g").attr("class", "body");
          body.append("path").attr("class", "glyph");
          body.append("circle").attr("class", "ring");
          g.append("text").attr("class", "label").attr("text-anchor", "middle");
          return g;
        },
        (update) => update,
        (exit) => exit.transition().duration(220).style("opacity", 0).remove(),
      );

    sel
      .attr("data-type", (d) => d.type)
      .attr("aria-label", (d) => `${d.type}: ${d.name}`)
      .attr("class", (d) => `node t-${d.type}`)
      .on("click", (e, d) => {
        e.stopPropagation();
        cb.current.onSelect(d.id);
      })
      .on("keydown", (e, d) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          cb.current.onSelect(d.id);
        }
      })
      .on("pointerenter focus", (e, d) => setHover(d.id, e))
      .on("pointermove", (e, d) => setHover(d.id, e))
      .on("pointerleave blur", () => setHover(null))
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (e, d) => {
            if (!e.active) L.sim!.alphaTarget(0.25).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (e, d) => {
            d.fx = e.x;
            d.fy = e.y;
          })
          .on("end", (e, d) => {
            if (!e.active) L.sim!.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );
    sel.select<SVGPathElement>("path.glyph").attr("d", (d) => glyphPath(d.type, d.r)).attr("fill", (d) => TYPE_COLOR[d.type]);
    sel.select<SVGCircleElement>("circle.ring").attr("r", (d) => d.r + 6);
    sel.select<SVGTextElement>("text.label").attr("y", (d) => d.r + 17).text((d) => d.name);

    // Simulation
    L.sim.nodes(nodes);
    L.sim.force(
      "link",
      d3
        .forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance((d) => LINK_DISTANCE[d.type])
        .strength((d) => 0.25 + d.weight * 0.35),
    );
    L.sim.alpha(0.7).restart();
    applyClasses();

    function setHover(id: string | null, e?: Event) {
      L.hover = id;
      applyClasses();
      if (id && e instanceof PointerEvent) {
        const box = wrapRef.current!.getBoundingClientRect();
        cb.current.onHover({ id, x: e.clientX - box.left, y: e.clientY - box.top });
      } else if (id) {
        const n = L.nodes.get(id);
        const box = wrapRef.current!.getBoundingClientRect();
        const t = d3.zoomTransform(svgRef.current!);
        cb.current.onHover(n ? { id, x: t.applyX(n.x ?? 0), y: t.applyY(n.y ?? 0) } : null);
        void box;
      } else cb.current.onHover(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // ── Highlight / dim without touching the simulation ─────────────────
  function applyClasses() {
    const L = live.current;
    if (!svgRef.current) return;
    const focusId = L.hover ?? L.selected;
    const keep = focusId ? neighborIds(L.view.links, focusId) : null;
    const root = d3.select(svgRef.current);
    root.selectAll<SVGGElement, SimNode>("g.node")
      .classed("dim", (d) => !!keep && !keep.has(d.id))
      .classed("hot", (d) => !!keep && keep.has(d.id) && d.id !== focusId)
      .classed("selected", (d) => d.id === L.selected)
      .classed("hovered", (d) => d.id === L.hover)
      .classed("zoomed", L.k > 1.15);
    root.selectAll<SVGLineElement, SimLink>("line.link")
      .classed("dim", (d) => !!focusId && (d.source as SimNode).id !== focusId && (d.target as SimNode).id !== focusId)
      .classed("flow", (d) => !!focusId && ((d.source as SimNode).id === focusId || (d.target as SimNode).id === focusId));
  }

  useEffect(() => {
    live.current.selected = selectedId;
    applyClasses();
  }, [selectedId]);

  // ── Camera: frame everything ─────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const L = live.current;
    const timer = setTimeout(() => {
      const ns = [...L.nodes.values()].filter((n) => n.x != null && n.y != null);
      if (!ns.length || !L.zoom) return;
      const x0 = d3.min(ns, (n) => n.x! - n.r)!, x1 = d3.max(ns, (n) => n.x! + n.r)!;
      const y0 = d3.min(ns, (n) => n.y! - n.r)!, y1 = d3.max(ns, (n) => n.y! + n.r + 20)!;
      const { w, h } = L.size;
      const k = Math.max(0.35, Math.min(1.3, 0.82 / Math.max((x1 - x0) / w, (y1 - y0) / h)));
      const t = d3.zoomIdentity.translate(w / 2, h / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
      d3.select(svgRef.current!).transition().duration(800).ease(d3.easeCubicInOut).call(L.zoom.transform, t);
    }, 900); // wait for the force layout to mostly settle
    return () => clearTimeout(timer);
  }, [fitNonce]);

  // ── Camera: fly to a node ────────────────────────────────────────────
  useEffect(() => {
    if (!focus || !svgRef.current) return;
    const L = live.current;
    const timer = setTimeout(() => {
      const n = L.nodes.get(focus.id);
      if (!n || n.x == null || n.y == null || !L.zoom) return;
      const { w, h } = L.size;
      const k = Math.max(1.1, Math.min(1.6, d3.zoomTransform(svgRef.current!).k));
      const cx = w / 2;
      // On mobile the bottom sheet (52dvh) covers the lower stage; centre in what's left.
      const cy = bottomInset ? Math.max(60, (h - window.innerHeight * 0.52) / 2) : h / 2;
      const t = d3.zoomIdentity.translate(cx, cy).scale(k).translate(-n.x, -n.y);
      d3.select(svgRef.current!).transition().duration(900).ease(d3.easeCubicInOut).call(L.zoom.transform, t);
    }, 380); // let freshly-added neighbours settle first
    return () => clearTimeout(timer);
  }, [focus, bottomInset]);

  return (
    <div ref={wrapRef} className="graph-wrap absolute inset-0">
      <svg ref={svgRef} className="h-full w-full touch-none select-none" role="group" aria-label="Music industry network graph" />
    </div>
  );
}

export type { EntityType };
