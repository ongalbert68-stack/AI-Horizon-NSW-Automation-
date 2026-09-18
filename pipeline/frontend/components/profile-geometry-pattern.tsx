"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { Geometry } from "@/lib/api/types";

interface NormalizedPoint {
  id: number;
  x: number;
  y: number;
  r: number;
}

type RenderMode = "line" | "area" | "dots";

interface ProfileGeometryPatternProps {
  geometry: Geometry | null | undefined;
  specMetric?: string | null;
  specLimit?: string | null;
  className?: string;
  canvasClassName?: string;
}

function classifyPattern(pattern: string): RenderMode {
  const p = pattern.toLowerCase();
  if (/line|bead|trace|dam|perimeter|path|seal/.test(p)) return "line";
  if (/area|fill|region|pad|blob|zone/.test(p)) return "area";
  return "dots";
}

function niceStep(range: number, targetLines: number): number {
  if (range <= 0) return 1;
  const raw = range / targetLines;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return step * mag;
}

function formatCoord(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function pathLength(points: NormalizedPoint[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

function convexHull(points: NormalizedPoint[]): NormalizedPoint[] {
  if (points.length < 3) return points;
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: NormalizedPoint, a: NormalizedPoint, b: NormalizedPoint) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: NormalizedPoint[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: NormalizedPoint[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

function shoelaceArea(poly: NormalizedPoint[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function expandHull(hull: NormalizedPoint[], dist: number): NormalizedPoint[] {
  if (hull.length < 3 || dist <= 0) return hull;
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  return hull.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    return { ...p, x: p.x + (dx / d) * dist, y: p.y + (dy / d) * dist };
  });
}

export function ProfileGeometryPattern({
  geometry,
  specMetric,
  specLimit,
  className = "",
  canvasClassName,
}: ProfileGeometryPatternProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = React.useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [showNumbers, setShowNumbers] = React.useState<boolean>(false);
  const [cursorCoord, setCursorCoord] = React.useState<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const points: NormalizedPoint[] = React.useMemo(() => {
    if (!geometry) return [];
    const rawList = geometry.profile ?? geometry.points ?? [];
    if (!Array.isArray(rawList) || rawList.length === 0) return [];
    return rawList.map((p, idx) => {
      const x = p.cx ?? p.x ?? 0;
      const y = p.cy ?? p.y ?? 0;
      const r = p.r && p.r > 0 ? p.r : 0.5;
      const id = p.index ?? idx;
      return { id, x, y, r };
    });
  }, [geometry]);

  if (!geometry || points.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground ${className}`}>
        <p className="font-medium">No pattern geometry defined</p>
        <p className="text-[11px] text-muted-foreground/70">
          This dispense profile does not carry nominal coordinates.
        </p>
      </div>
    );
  }

  const requestedMode = classifyPattern(geometry.pattern);
  const mode: RenderMode =
    (requestedMode === "line" && points.length < 2) || (requestedMode === "area" && points.length < 3)
      ? "dots"
      : requestedMode;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const rs = points.map((p) => p.r);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const spanX = Math.max(maxX - minX, 0.001);
  const spanY = Math.max(maxY - minY, 0.001);
  const actualMaxR = Math.max(...rs, 0.2);
  const avgR = rs.reduce((s, r) => s + r, 0) / rs.length;

  // Responsive container pixel dimensions (fallback before first observer measurement)
  const width = containerSize.width || 1200;
  const height = containerSize.height || 540;

  // Compact dot scaling: deposit radius capped at ~14px on screen to keep dots compact
  // with abundant negative space across the plane.
  const TARGET_DOT_RADIUS_PX = 14;
  const dotScaleCap = TARGET_DOT_RADIUS_PX / actualMaxR;

  // Also ensure spread-out points fit comfortably inside the container with margin
  const paddingPx = 80;
  const fitScaleX = (width - paddingPx * 2) / Math.max(spanX + actualMaxR * 2, 0.01);
  const fitScaleY = (height - paddingPx * 2) / Math.max(spanY + actualMaxR * 2, 0.01);

  const scale = Math.max(Math.min(dotScaleCap, fitScaleX, fitScaleY), 0.0001);

  // Coordinate spans that match the container aspect ratio 1:1 -> Zero letterboxing!
  const viewW = width / scale;
  const viewH = height / scale;

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const vbMinX = midX - viewW / 2;
  const vbMinY = midY - viewH / 2;

  const hoveredPoint = hoveredIndex !== null ? points.find((p) => p.id === hoveredIndex) : null;

  // Calibrated coordinate grid step across the Cartesian plane
  const gridStep = niceStep(viewH, 8);

  const gridLinesX: number[] = [];
  const startX = Math.floor(vbMinX / gridStep) * gridStep;
  const endX = vbMinX + viewW;
  for (let gx = startX; gx <= endX + gridStep * 0.01; gx += gridStep) {
    gridLinesX.push(Number(gx.toFixed(6)));
  }

  const gridLinesY: number[] = [];
  const startY = Math.floor(vbMinY / gridStep) * gridStep;
  const endY = vbMinY + viewH;
  for (let gy = startY; gy <= endY + gridStep * 0.01; gy += gridStep) {
    gridLinesY.push(Number(gy.toFixed(6)));
  }

  const hull = mode === "area" ? expandHull(convexHull(points), avgR) : [];
  const areaValue = mode === "area" && hull.length >= 3 ? shoelaceArea(hull) : 0;
  const lengthValue = mode === "line" ? pathLength(points) : 0;

  const statText =
    mode === "line"
      ? `${points.length} waypoints · ~${formatCoord(lengthValue)} path length`
      : mode === "area"
        ? `${points.length} vertices · ~${formatCoord(areaValue)} area`
        : `${points.length} deposit${points.length === 1 ? "" : "s"}`;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Pattern metadata summary header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[11px] uppercase tracking-wider">
            {geometry.pattern}
          </Badge>
          <span className="text-muted-foreground">{statText}</span>
        </div>
        <div className="flex items-center gap-3">
          {geometry.width && geometry.height && (
            <Badge variant="outline" className="font-mono text-[11px] text-muted-foreground">
              BBox: {geometry.width} &times; {geometry.height}
            </Badge>
          )}
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span>Grid: 1 div = {gridStep} units</span>
            {specMetric && specLimit && (
              <Badge variant="secondary" className="text-[10px]">
                {specMetric} {specLimit}
              </Badge>
            )}
          </div>

          {/* Discreet toggle: only show numbers if user explicitly clicks */}
          <button
            type="button"
            onClick={() => setShowNumbers(!showNumbers)}
            className="text-[11px] text-muted-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
          >
            {showNumbers ? "Hide numbers" : "Show numbers"}
          </button>
        </div>
      </div>

      {/* SVG Canvas with Full-Span Cartesian Substrate Plane */}
      <div
        ref={containerRef}
        onMouseMove={(e) => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const cx = vbMinX + ((e.clientX - rect.left) / (rect.width || 1)) * viewW;
          const cy = vbMinY + ((e.clientY - rect.top) / (rect.height || 1)) * viewH;
          setCursorCoord({ x: cx, y: cy });
        }}
        onMouseLeave={() => setCursorCoord(null)}
        className={`relative flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-inner dark:bg-zinc-950 ${
          canvasClassName ?? "h-[500px] md:h-[560px] lg:h-[620px]"
        }`}
      >
        <div className="relative min-h-0 flex-1">
          <svg
            viewBox={`${vbMinX} ${vbMinY} ${viewW} ${viewH}`}
            className="size-full select-none"
            preserveAspectRatio="none"
          >
            <defs>
              {/* Radial gradient for nominal fluid deposit */}
              <radialGradient id="deposit-gradient" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
                <stop offset="60%" stopColor="#0284c7" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.7" />
              </radialGradient>

              {/* Highlighted dot gradient on hover */}
              <radialGradient id="deposit-highlight" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#a5f3fc" />
                <stop offset="65%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#0891b2" />
              </radialGradient>

              {/* Glowing effect */}
              <filter id="deposit-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation={actualMaxR * 0.3} result="glow" />
                <feComposite in="SourceGraphic" in2="glow" operator="over" />
              </filter>
            </defs>

            {/* Calibrated Cartesian coordinate grid lines spanning edge-to-edge */}
            {gridLinesX.map((gx) => {
              const isOrigin = Math.abs(gx) < gridStep * 0.001;
              return (
                <line
                  key={`gx-${gx}`}
                  x1={gx}
                  y1={vbMinY}
                  x2={gx}
                  y2={vbMinY + viewH}
                  stroke={isOrigin ? "#0284c7" : "#27272a"}
                  strokeWidth={isOrigin ? 1.5 : 1}
                  strokeOpacity={isOrigin ? 0.8 : 0.65}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {gridLinesY.map((gy) => {
              const isOrigin = Math.abs(gy) < gridStep * 0.001;
              return (
                <line
                  key={`gy-${gy}`}
                  x1={vbMinX}
                  y1={gy}
                  x2={vbMinX + viewW}
                  y2={gy}
                  stroke={isOrigin ? "#0284c7" : "#27272a"}
                  strokeWidth={isOrigin ? 1.5 : 1}
                  strokeOpacity={isOrigin ? 0.8 : 0.65}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {/* Coordinate tick labels along bottom border */}
            {gridLinesX.map((gx) => {
              const isOrigin = Math.abs(gx) < gridStep * 0.001;
              return (
                <text
                  key={`tx-${gx}`}
                  x={gx}
                  y={vbMinY + viewH - 8 / scale}
                  textAnchor="middle"
                  fill={isOrigin ? "#38bdf8" : "#71717a"}
                  fontSize={10 / scale}
                  fontFamily="monospace"
                  className="pointer-events-none select-none"
                >
                  {formatCoord(gx)}
                </text>
              );
            })}

            {/* Coordinate tick labels along left border */}
            {gridLinesY.map((gy) => {
              const isOrigin = Math.abs(gy) < gridStep * 0.001;
              return (
                <text
                  key={`ty-${gy}`}
                  x={vbMinX + 10 / scale}
                  y={gy}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fill={isOrigin ? "#38bdf8" : "#71717a"}
                  fontSize={10 / scale}
                  fontFamily="monospace"
                  className="pointer-events-none select-none"
                >
                  {formatCoord(gy)}
                </text>
              );
            })}

            {/* Origin indicator (0,0) if in view */}
            {vbMinX <= 0 && 0 <= vbMinX + viewW && vbMinY <= 0 && 0 <= vbMinY + viewH && (
              <g className="pointer-events-none select-none">
                <circle cx={0} cy={0} r={2.5 / scale} fill="#38bdf8" fillOpacity={0.8} />
                <text
                  x={5 / scale}
                  y={-5 / scale}
                  fill="#38bdf8"
                  fontSize={10 / scale}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  (0,0)
                </text>
              </g>
            )}

            {/* Subtle Gantry Dispense Path (polyline) */}
            {points.length > 1 && (
              <polyline
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#0284c7"
                strokeWidth={1.5}
                strokeDasharray={`${actualMaxR * 0.4} ${actualMaxR * 0.3}`}
                strokeOpacity="0.45"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Area mode polygon footprint */}
            {mode === "area" && hull.length >= 3 && (
              <polygon
                points={hull.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="#0369a1"
                fillOpacity="0.25"
                stroke="#38bdf8"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Line mode continuous bead footprint */}
            {mode === "line" && points.length >= 2 && (
              <polyline
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#0284c7"
                strokeWidth={actualMaxR * 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="0.4"
              />
            )}

            {/* Clean Precision Deposits (Compact size, NO default numbers on dots) */}
            {points.map((pt, i) => {
              const isHovered = hoveredIndex === pt.id;
              return (
                <g
                  key={pt.id}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredIndex(pt.id)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Outer hover ring indicator */}
                  {isHovered && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={pt.r * 1.35}
                      fill="none"
                      stroke="#a5f3fc"
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}

                  {/* Nominal deposit fluid body */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={pt.r}
                    fill={isHovered ? "url(#deposit-highlight)" : "url(#deposit-gradient)"}
                    stroke={isHovered ? "#ffffff" : "#38bdf8"}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    vectorEffect="non-scaling-stroke"
                    filter={isHovered ? "url(#deposit-glow)" : undefined}
                  />

                  {/* Substrate contact core / nozzle target crosshair */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={Math.max(pt.r * 0.15, 0.05)}
                    fill="#ffffff"
                    fillOpacity="0.9"
                  />

                  {/* Numbers are hidden UNLESS user explicitly toggled showNumbers */}
                  {showNumbers && (
                    <text
                      x={pt.x}
                      y={pt.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize={pt.r * 0.75}
                      fontWeight="700"
                      fontFamily="monospace"
                      className="pointer-events-none select-none"
                    >
                      {i + 1}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Dynamic Inspection Footer: constant height h-8 to completely eliminate layout shifts */}
        <div className="flex h-8 items-center justify-between border-t border-zinc-800/80 bg-zinc-950/95 px-3 font-mono text-[11px]">
          <div className="flex items-center gap-4">
            {hoveredPoint ? (
              <div className="flex items-center gap-3 text-sky-400">
                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-bold text-sky-300">
                  Deposit #{points.findIndex((p) => p.id === hoveredPoint.id) + 1}
                </span>
                <span>
                  X: <span className="font-semibold text-zinc-100">{formatCoord(hoveredPoint.x)}</span>
                </span>
                <span>
                  Y: <span className="font-semibold text-zinc-100">{formatCoord(hoveredPoint.y)}</span>
                </span>
                <span>
                  Radius: <span className="font-semibold text-zinc-100">{formatCoord(hoveredPoint.r)}</span>
                </span>
              </div>
            ) : cursorCoord ? (
              <div className="flex items-center gap-3 text-zinc-400">
                <span className="text-zinc-500">Cartesian Plane:</span>
                <span>
                  X: <span className="font-semibold text-zinc-200">{formatCoord(cursorCoord.x)}</span>
                </span>
                <span>
                  Y: <span className="font-semibold text-zinc-200">{formatCoord(cursorCoord.y)}</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-zinc-500">
                <span>Cartesian Substrate Plane</span>
                <span>&middot;</span>
                <span>1 div = {gridStep} units</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-zinc-500">
            <span>Plane: {formatCoord(viewW)} &times; {formatCoord(viewH)}</span>
            <span>&middot;</span>
            <span>{points.length} deposits</span>
          </div>
        </div>
      </div>
    </div>
  );
}
