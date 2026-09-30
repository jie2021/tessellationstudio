// App.tsx
// Main application component for Tessellation Studio.
// - Manages global UI state (selected shape, colors, zoom, demo modes, editor state).
// - Computes base vertices for regular shapes and maintains editable edge control points.
// - Delegates shape-specific editing, demo steps, and control rendering to
//   `Square.tsx`, `Hexagon.tsx`, and `Triangle.tsx` helper exports.
// - Exposes export-to-PNG logic which inlines computed styles before rasterizing.
// Shape-specific behavior (paired-edge updates and demo assembly) lives in the
// shape modules; this file owns shared SVG path generation and UI coordination.
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Square, 
  Hexagon, 
  Triangle, 
  RotateCcw, 
  Download, 
  Layers, 
  Palette,
  Move,
  Info,
  Grid3X3,
  Menu,
  X,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

import SquareShape, { applySquareEdit, Point as SquarePoint, buildSquareDemoTiles, renderSquareControls, startSquareDemo, stopSquareDemo, nextSquareStep, prevSquareStep, getSquareDemoText as squareGetDemoText, squareAutoAdvance } from './Square';
import HexagonShape, { applyHexagonEdit, renderHexagonControls, startHexagonDemo, stopHexagonDemo, nextHexagonStep, prevHexagonStep, getHexagonDemoText, hexagonAutoAdvance } from './Hexagon';
import TriangleShape, { initTrianglePaths, applyTriangleEdit, Point as TriPoint, startTriangleDemo, stopTriangleDemo, renderTriangleControls, nextTriangleStep, prevTriangleStep, getTriangleDemoText, triangleAutoAdvance } from './Triangle';

// --- Types ---

type ShapeType = 'triangle' | 'square' | 'hexagon';

interface Point {
  x: number;
  y: number;
}

/** Visible rectangle in SVG-local coordinates (before the translate+scale transform). */
export interface ViewBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// --- Constants ---

const CANVAS_SIZE = 400;
const PADDING = 80;
const CENTER = CANVAS_SIZE / 2;
const RADIUS = (CANVAS_SIZE - PADDING * 2) / 2;

// --- Utilities ---

// Compute the vertex coordinates for a centered regular polygon used as the
// starting guideline for editing. The `type` selects side-count and a start
// angle so that triangles/squares/hexagons align visually with the editor.
// Returns absolute coordinates in the editor SVG coordinate space.
const getBaseVertices = (type: ShapeType): Point[] => {
  const vertices: Point[] = [];
  let sides = 0;
  let startAngle = 0;

  if (type === 'square') {
    sides = 4;
    startAngle = -Math.PI / 4;
  } else if (type === 'hexagon') {
    sides = 6;
    startAngle = 0;
  } else if (type === 'triangle') {
    sides = 3;
    startAngle = -Math.PI / 2;
  }

  for (let i = 0; i < sides; i++) {
    const angle = startAngle + (i * 2 * Math.PI) / sides;
    vertices.push({
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
    });
  }
  return vertices;
};

// --- Components ---

const serializePatternSvg = (svgEl: SVGSVGElement) => {
  const { width, height } = svgEl.getBoundingClientRect();
  const exportWidth = Math.round(width) || 1200;
  const exportHeight = Math.round(height) || 800;
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(exportWidth));
  clone.setAttribute('height', String(exportHeight));
  clone.style.opacity = '1';

  const backgroundColor = svgEl.parentElement
    ? getComputedStyle(svgEl.parentElement).backgroundColor
    : '#fafafa';
  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('width', String(exportWidth));
  background.setAttribute('height', String(exportHeight));
  background.setAttribute('fill', backgroundColor === 'rgba(0, 0, 0, 0)' ? '#fafafa' : backgroundColor);
  clone.insertBefore(background, clone.firstChild);

  return {
    svgText: new XMLSerializer().serializeToString(clone),
    width: exportWidth,
    height: exportHeight,
  };
};

const getCurveDisplayPoint = (start: Point, end: Point, controls: Point[], pointIdx: number, useCurve: boolean): Point => {
  if (!useCurve || controls.length === 0) return controls[pointIdx];

  const t = (pointIdx + 1) / (controls.length + 1);
  if (controls.length === 1) {
    const control = controls[0];
    const inverseT = 1 - t;
    return {
      x: inverseT * inverseT * start.x + 2 * inverseT * t * control.x + t * t * end.x,
      y: inverseT * inverseT * start.y + 2 * inverseT * t * control.y + t * t * end.y,
    };
  }

  const firstControl = controls[0];
  const lastControl = controls[controls.length - 1];
  const inverseT = 1 - t;
  return {
    x: inverseT ** 3 * start.x + 3 * inverseT ** 2 * t * firstControl.x + 3 * inverseT * t ** 2 * lastControl.x + t ** 3 * end.x,
    y: inverseT ** 3 * start.y + 3 * inverseT ** 2 * t * firstControl.y + 3 * inverseT * t ** 2 * lastControl.y + t ** 3 * end.y,
  };
};

export default function App() {
  const [shapeType, setShapeType] = useState<ShapeType>('square');
  const [edgePaths, setEdgePaths] = useState<Record<number, Point[]>>({});
  const [activePoint, setActivePoint] = useState<{ edgeIdx: number; pointIdx: number } | null>(null);
  const [colorA, setColorA] = useState('#6366f1');
  const [colorB, setColorB] = useState('#ffffff');
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  // Triangle symmetry is fixed to clockwise by default
  const TRI_SYMMETRY: 'cw' = 'cw';
  const [useCurve, setUseCurve] = useState(true);
  const [transformType, setTransformType] = useState<'rotate90' | 'rotate120' | 'translate' | 'glide' | 'free'>('rotate90');
  const [demoMode, setDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const demoIntervalRef = React.useRef<number | null>(null);
  const [demoCenters, setDemoCenters] = useState<{cx:number, cy:number}[]>([]);
  // Square demo state: show construction steps (base, 90°,180°,270°)
  const [squareDemoMode, setSquareDemoMode] = useState(false);
  const [squareDemoStep, setSquareDemoStep] = useState(0);
  const squareDemoIntervalRef = React.useRef<number | null>(null);

  // Control whether the Edge Editor overlay is shown.
  const [showEditor, setShowEditor] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPageScrollLocked, setIsPageScrollLocked] = useState(false);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ w: 1920, h: 1080 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const compute = () => {
      setOffset({ x: window.innerWidth / 2 - CENTER, y: window.innerHeight / 2 - CENTER });
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = isPageScrollLocked ? 'hidden' : '';
    document.body.style.overflow = isPageScrollLocked ? 'hidden' : '';

    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isPageScrollLocked]);

  // Compute the visible rectangle in SVG-local coordinates.
  // The SVG content is transformed by: translate(offset) scale(zoom)
  // So SVG-local x = (screen_x - offset.x) / zoom
  const viewBounds = useMemo<ViewBounds>(() => ({
    left:   -offset.x / zoom,
    top:    -offset.y / zoom,
    right:  (viewportSize.w - offset.x) / zoom,
    bottom: (viewportSize.h - offset.y) / zoom,
  }), [offset.x, offset.y, zoom, viewportSize.w, viewportSize.h]);

  const baseVertices = useMemo(() => getBaseVertices(shapeType), [shapeType]);

  // Initialize edge paths if empty
  const currentEdgePaths = useMemo(() => {
    const paths: Record<number, Point[]> = { ...edgePaths };
    const numEdges = shapeType === 'square' ? 4 : shapeType === 'hexagon' ? 6 : 3;

    // Delegate triangle initialization to helper when appropriate
    if (shapeType === 'triangle') {
      const tri = initTrianglePaths(baseVertices as TriPoint[], RADIUS, TRI_SYMMETRY);
      for (let i = 0; i < numEdges; i++) {
        if (!paths[i]) paths[i] = tri[i];
      }
      return paths;
    }

    // Default: one midpoint for non-triangle shapes
    for (let i = 0; i < numEdges; i++) {
      if (!paths[i]) {
        const v1 = baseVertices[i];
        const v2 = baseVertices[(i + 1) % numEdges];
        paths[i] = [ { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 } ];
      }
    }
    return paths;
  }, [shapeType, baseVertices, edgePaths]);

  // --- Refs for stable handleMouseMove (avoids re-creating the callback on every drag frame) ---
  const currentEdgePathsRef = useRef(currentEdgePaths);
  const activePointRef = useRef(activePoint);
  const shapeTypeRef = useRef(shapeType);
  const baseVerticesRef = useRef(baseVertices);
  const transformTypeRef = useRef(transformType);
  const editorRectRef = useRef<DOMRect | null>(null);
  const pendingPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  currentEdgePathsRef.current = currentEdgePaths;
  activePointRef.current = activePoint;
  shapeTypeRef.current = shapeType;
  baseVerticesRef.current = baseVertices;
  transformTypeRef.current = transformType;

  const resetPaths = () => setEdgePaths({});

  const handleStopDemo = () => stopTriangleDemo({ setDemoMode, setDemoStep, demoIntervalRef });

  // --- Square demo controls ---
  // Delegated to `src/Square.tsx` via `startSquareDemo` / `stopSquareDemo` helpers.

  // When switching to square, default the transform type to 90° rotation
  useEffect(() => {
    if (shapeType === 'square') setTransformType('rotate90');
    if (shapeType === 'hexagon') setTransformType('rotate120');
  }, [shapeType]);

  // When the transform type changes, reset any edited control points
  // so the new transform mode starts from the guideline defaults.
  useEffect(() => {
    resetPaths();
    setActivePoint(null);
  }, [transformType]);

  // stopSquareDemo is provided by Square.tsx when needed.

  // Allow many translation reveal steps; cap is generous (4 rotations + 80 translations)
  // next/prev delegated to Square.tsx helpers

  // cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (demoIntervalRef.current) {
        window.clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
    };
  }, []);

  // Per-shape auto-advance: only run the shape-specific autoAdvance helper
  // so triangle/square/hexagon can control when to jump to the "full" state.
  useEffect(() => {
    if (shapeType === 'triangle') {
      triangleAutoAdvance(demoMode, demoStep, demoCenters.length, setDemoStep);
    } else if (shapeType === 'square') {
      try { squareAutoAdvance(demoMode, demoStep, demoCenters.length, setDemoStep); } catch (e) {}
    } else if (shapeType === 'hexagon' && (transformType === 'translate' || transformType === 'rotate120' || transformType === 'free')) {
      try { hexagonAutoAdvance(demoMode, demoStep, demoCenters.length, setDemoStep); } catch (e) {}
    } else if (shapeType === 'hexagon' && transformType === 'glide') {
      try { hexagonAutoAdvance(demoMode, demoStep, 0, setDemoStep); } catch (e) {}
    }
  }, [shapeType, demoMode, demoStep, demoCenters.length]);

  const nextDemoStep = () => {
    if (shapeType === 'triangle') return nextTriangleStep(setDemoStep);
    if (shapeType === 'hexagon') return nextHexagonStep(setDemoStep);
    return nextTriangleStep(setDemoStep);
  };
  const prevDemoStep = () => {
    if (shapeType === 'triangle') return prevTriangleStep(setDemoStep);
    if (shapeType === 'hexagon') return prevHexagonStep(setDemoStep);
    return prevTriangleStep(setDemoStep);
  };

  const getDemoText = (step: number) => {
    if (shapeType === 'triangle') return getTriangleDemoText(step, TRI_SYMMETRY);
    if (shapeType === 'hexagon') return getHexagonDemoText(step, transformType as 'rotate120' | 'translate' | 'glide' | 'free');
    return getTriangleDemoText(step, TRI_SYMMETRY);
  };

  const getSquareDemoText = (step: number) => squareGetDemoText(step, transformType as 'rotate90' | 'translate' | 'glide');

  const handleMouseDown = (edgeIdx: number, pointIdx: number) => {
    editorRectRef.current = document.getElementById('editor-svg')?.getBoundingClientRect() ?? null;
    const nextActivePoint = { edgeIdx, pointIdx };
    activePointRef.current = nextActivePoint;
    setActivePoint(nextActivePoint);
  };

  const updateDraggedPoint = useCallback((clientX: number, clientY: number) => {
    const ap = activePointRef.current;
    if (!ap) return;

    const rect = editorRectRef.current;
    if (!rect || rect.width === 0 || rect.height === 0) return;

    // Convert client coordinates into the SVG's internal 0..CANVAS_SIZE coordinate
    // system taking into account the element's displayed bounding box. This keeps
    // pointer control stable even when the SVG is scaled by CSS/layout.
    const x = (clientX - rect.left) * (CANVAS_SIZE / rect.width);
    const y = (clientY - rect.top) * (CANVAS_SIZE / rect.height);

    const curPaths = currentEdgePathsRef.current;
    const st = shapeTypeRef.current;
    const bv = baseVerticesRef.current;
    const tt = transformTypeRef.current;

    // Update the edge control points immutably. We base the edit on the
    // pre-computed `currentEdgePaths` (which contains defaults if user hasn't
    // edited anything) to avoid surprising mutations from a stale `prev`.
    setEdgePaths(() => {
      const newPaths = { ...curPaths };
      const points = [...newPaths[ap.edgeIdx]];
      points[ap.pointIdx] = { x, y };
      newPaths[ap.edgeIdx] = points;

      // Delegate triangle-specific edit behavior
      if (st === 'triangle') {
        return applyTriangleEdit(newPaths, ap, bv as TriPoint[], TRI_SYMMETRY);
      }

      // Delegate square-specific edit behavior
      if (st === 'square') {
        return applySquareEdit(newPaths, ap, bv as SquarePoint[], TRI_SYMMETRY, tt as 'rotate90' | 'translate' | 'glide', CENTER);
      }

      // Delegate hexagon-specific edit behavior
      if (st === 'hexagon') {
        return applyHexagonEdit(newPaths, ap, bv as Point[], tt as any);
      }

      return newPaths;
    });
  }, []);

  // Pointer events can arrive faster than the display refresh rate. Keep only
  // the latest coordinates and commit at most one React update per frame.
  const handleMouseMove = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (!activePointRef.current) return;

    const pointer = 'touches' in event ? event.touches[0] : event;
    if (!pointer) return;
    pendingPointerRef.current = { clientX: pointer.clientX, clientY: pointer.clientY };

    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const pending = pendingPointerRef.current;
      pendingPointerRef.current = null;
      if (pending) updateDraggedPoint(pending.clientX, pending.clientY);
    });
  }, [updateDraggedPoint]);

  const handleMouseUp = () => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    const pending = pendingPointerRef.current;
    pendingPointerRef.current = null;
    if (pending) updateDraggedPoint(pending.clientX, pending.clientY);
    editorRectRef.current = null;
    activePointRef.current = null;
    setActivePoint(null);
  };

  // Add a control point to a free-mode hexagon edge through its context-menu gesture.
  // Inserts the new point sorted by its projection (t) along the edge,
  // then rotates all interactive-edge points to update the paired edge.
  const handleAddHexagonPoint = useCallback((edgeIdx: number, clientX: number, clientY: number) => {
    const svg = document.getElementById('editor-svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left) * (CANVAS_SIZE / rect.width);
    const y = (clientY - rect.top) * (CANVAS_SIZE / rect.height);

    const bv = baseVerticesRef.current;
    const v0 = bv[edgeIdx];
    const v1 = bv[(edgeIdx + 1) % 6];
    const ex = v1.x - v0.x, ey = v1.y - v0.y;
    const len2 = ex * ex + ey * ey || 1;
    const tNew = ((x - v0.x) * ex + (y - v0.y) * ey) / len2;

    setEdgePaths(() => {
      const newPaths = { ...currentEdgePathsRef.current };

      // Insert the new point at the correct sorted position along the edge
      const curPoints = [...(newPaths[edgeIdx] || [])];
      let insertIdx = curPoints.length;
      for (let i = 0; i < curPoints.length; i++) {
        const ti = ((curPoints[i].x - v0.x) * ex + (curPoints[i].y - v0.y) * ey) / len2;
        if (tNew < ti) { insertIdx = i; break; }
      }
      curPoints.splice(insertIdx, 0, { x, y });
      newPaths[edgeIdx] = curPoints;

      // Rotate all interactive-edge points to paired edge
      const freePairMap: Record<number, { paired: number; pivotIdx: number }> = {
        0: { paired: 1, pivotIdx: 1 },
        2: { paired: 3, pivotIdx: 3 },
        4: { paired: 5, pivotIdx: 5 },
      };
      const mapping = freePairMap[edgeIdx];
      if (mapping) {
        const pivot = bv[mapping.pivotIdx];
        const angle = -(2 * Math.PI) / 3;
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        newPaths[mapping.paired] = curPoints.map((pt: Point) => {
          const dx = pt.x - pivot.x, dy = pt.y - pivot.y;
          return { x: pivot.x + cosA * dx - sinA * dy, y: pivot.y + sinA * dx + cosA * dy };
        }).reverse();
      }
      return newPaths;
    });
  }, []);
  const tilePathData = useMemo(() => {
    if (baseVertices.length === 0) return '';
    let d = `M ${baseVertices[0].x} ${baseVertices[0].y}`;
    const numEdges = baseVertices.length;

    // Build an SVG path string for a single tile by iterating each polygon edge
    // and appending one of:
    // - Quadratic Bézier (`Q`) when there is a single control point
    // - Cubic Bézier (`C`) when there are two or more control points
    // - Straight line (`L`) when in straight mode or when no control points
    // The generated path is closed with `Z` so it can be filled/stroked.
    for (let i = 0; i < numEdges; i++) {
      const v2 = baseVertices[(i + 1) % numEdges];
      const points = currentEdgePaths[i];

      if (useCurve) {
        if (points.length === 1) {
          // Quadratic Bezier: one control point
          d += ` Q ${points[0].x} ${points[0].y} ${v2.x} ${v2.y}`;
        } else if (points.length >= 2) {
          // Cubic Bezier: two control points
          d += ` C ${points[0].x} ${points[0].y} ${points[points.length - 1].x} ${points[points.length - 1].y} ${v2.x} ${v2.y}`;
        } else {
          d += ` L ${v2.x} ${v2.y}`;
        }
      } else {
        // Straight mode: pass through each control point as a waypoint
        points.forEach(p => { d += ` L ${p.x} ${p.y}`; });
        d += ` L ${v2.x} ${v2.y}`;
      }
    }
    d += ' Z';
    return d;
  }, [baseVertices, currentEdgePaths, useCurve]);

  // Precompute square demo tiles (delegated to Square.tsx)
  const squareDemoTiles = useMemo(() =>
    buildSquareDemoTiles({ squareDemoMode, squareDemoStep, baseVertices, colorA, colorB, transformType: transformType as 'rotate90' | 'translate' | 'glide', RADIUS }),
    [squareDemoMode, squareDemoStep, baseVertices, colorA, colorB, transformType, RADIUS]
  );

  return (
    <div className={`min-h-screen flex flex-col lg:flex-row bg-neutral-50 lg:overflow-hidden font-sans ${isPageScrollLocked ? 'overflow-hidden' : ''}`}>
      {/* Sidebar Controls */}
      {isMenuOpen && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setIsMenuOpen(false)}
          className="fixed inset-0 z-40 bg-neutral-900/30 backdrop-blur-[2px] lg:hidden"
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[min(88vw,24rem)] bg-white border-r border-neutral-200 p-6 sm:p-8 flex flex-col gap-8 shadow-xl overflow-y-auto transition-transform duration-300 ease-out lg:relative lg:inset-auto lg:z-20 lg:w-96 lg:translate-x-0 lg:border-r lg:p-8 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <header className="flex items-start justify-between gap-4">
          <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-neutral-900 leading-none">
            Tessellation <span className="text-indigo-600">Studio</span>
          </h1>
          <p className="text-sm text-neutral-500 mt-3 leading-relaxed">
            도형의 변을 자유롭게 변형하여 아름다운 반복 패턴을 만들어보세요.
          </p>
          </div>
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setIsMenuOpen(false)}
            className="shrink-0 rounded-xl p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 lg:hidden"
          >
            <X size={22} />
          </button>
        </header>

        <div className="space-y-8">
          <section className="space-y-4">
            <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Layers size={14} /> 1. 기본 도형 선택
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'triangle', icon: Triangle, label: '삼각형' },
                { id: 'square', icon: Square, label: '사각형' },
                { id: 'hexagon', icon: Hexagon, label: '육각형' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setShapeType(t.id as ShapeType); resetPaths(); }}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 ${
                    shapeType === t.id 
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-inner' 
                      : 'border-neutral-100 bg-neutral-50 text-neutral-400 hover:border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  <t.icon size={28} strokeWidth={shapeType === t.id ? 2.5 : 2} />
                  <span className="text-[11px] font-bold mt-2 tracking-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Palette size={14} /> 2. 도형 색상
            </label>
            <div className="flex gap-3 flex-wrap">
              <div className="flex flex-row gap-8">
                <div>
                  <div className="text-[10px] text-neutral-400 mb-2">Primary</div>
                  <div className="flex gap-2">
                    {['#6366f1', '#ec4899'].map(c => (
                      <button aria-label={`Set primary color to ${c}`}
                        key={c}
                        onClick={() => setColorA(c)}
                        className={`w-10 h-10 rounded-xl border-4 transition-all hover:scale-110 active:scale-95 ${colorA === c ? 'border-white ring-2 ring-indigo-600 shadow-lg' : 'border-transparent shadow-sm'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-neutral-100 shadow-sm hover:border-neutral-300 transition-colors">
                      <input aria-label='Set custom primary color'
                        type="color" 
                        value={colorA} 
                        onChange={(e) => setColorA(e.target.value)}
                        className="absolute inset-0 w-full h-full scale-150 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-neutral-400 mb-2">Secondary</div>
                  <div className="flex gap-2">
                    {['#ffffff',  '#fde68a'].map(c => (
                      <button aria-label={`Set secondary color to ${c}`}
                        key={c}
                        onClick={() => setColorB(c)}
                        className={`w-10 h-10 rounded-xl border-4 transition-all hover:scale-110 active:scale-95 ${colorB === c ? 'border-white ring-2 ring-indigo-600 shadow-lg' : 'border-transparent shadow-sm'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-neutral-100 shadow-sm hover:border-neutral-300 transition-colors">
                      <input aria-label='Set custom secondary color'
                        type="color" 
                        value={colorB} 
                        onChange={(e) => setColorB(e.target.value)}
                        className="absolute inset-0 w-full h-full scale-150 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Move size={14} /> 3. 변 형태
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([{ val: false, label: '직선' }, { val: true, label: '곡선' }] as const).map(opt => (
                <button
                  key={String(opt.val)}
                  onClick={() => setUseCurve(opt.val)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 ${
                    useCurve === opt.val
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-inner'
                      : 'border-neutral-100 bg-neutral-50 text-neutral-400 hover:border-neutral-200'
                  }`}
                >
                  <span className="text-[11px] font-black tracking-tight">{opt.label}</span>
                </button>
              ))}
            </div>
          </section>

          {shapeType === 'square' && (
            <section className="space-y-4">
              <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                <RotateCcw size={14} /> 4. 변형 종류
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'rotate90', label: '90도 회전' },
                  { id: 'translate', label: '평행 이동' },
                  { id: 'glide', label: '미끄럼 반사' },
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setTransformType(opt.id as any)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 ${
                      transformType === opt.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-inner'
                        : 'border-neutral-100 bg-neutral-50 text-neutral-400 hover:border-neutral-200'
                    }`}
                  >
                    <span className="text-[11px] font-black tracking-tight">{opt.label}</span>
                  </button>
                ))}
              </div>
              
            </section>
          )}

          {shapeType === 'hexagon' && (
            <section className="space-y-4">
              <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                <RotateCcw size={14} /> 4. 변형 종류
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'rotate120', label: '120도 회전' },
                  { id: 'translate', label: '평행 이동' },
                  { id: 'glide', label: '미끄럼 반사' },
                  { id: 'free', label: '자유형' },
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setTransformType(opt.id as any)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 ${
                      transformType === opt.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-inner'
                        : 'border-neutral-100 bg-neutral-50 text-neutral-400 hover:border-neutral-200'
                    }`}
                  >
                    <span className="text-[11px] font-black tracking-tight">{opt.label}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Info size={14} /> {shapeType === 'square'|| shapeType === 'hexagon' ? '5' : '4'}. 사용 방법
            </label>
            <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-100 space-y-3">
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
                <p className="text-xs text-neutral-600 leading-relaxed">우측 에디터의 <span className="font-bold text-indigo-600">파란색 조절점</span>을 드래그하세요.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  변형된 모양이 배경에 실시간으로 반복됩니다.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">3</div>
                <p className="text-xs text-neutral-600 leading-relaxed">완성된 패턴을 저장하거나 초기화할 수 있습니다.</p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-auto pt-8 border-t border-neutral-100 flex flex-col gap-3">
          <button 
            onClick={resetPaths}
            className="flex items-center justify-center gap-2 w-full py-4 px-4 bg-neutral-100 text-neutral-700 rounded-2xl font-bold text-sm hover:bg-neutral-200 transition-all active:scale-[0.98]"
          >
            <RotateCcw size={18} /> 설정 초기화
          </button>
          <button 
            className="flex items-center justify-center gap-2 w-full py-4 px-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-[0.98]"
            onClick={() => {
              const svgEl = document.getElementById('tessellation-svg') as SVGSVGElement | null;
              if (!svgEl) return;
              const { svgText, width, height } = serializePatternSvg(svgEl);
              const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
              const url    = URL.createObjectURL(blob);

              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width  = width * 2;   // 2× for retina
                canvas.height = height * 2;
                const ctx = canvas.getContext('2d')!;
                ctx.scale(2, 2);
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);

                canvas.toBlob((pngBlob) => {
                  if (!pngBlob) return;
                  const pngUrl = URL.createObjectURL(pngBlob);
                  const a = document.createElement('a');
                  a.download = `tessellation-${shapeType}.png`;
                  a.href = pngUrl;
                  a.click();
                  window.setTimeout(() => URL.revokeObjectURL(pngUrl), 0);
                }, 'image/png');
              };
              img.src = url;
            }}
          >
            <Download size={18} /> 패턴 이미지 저장
          </button>
          <button
            onClick={() => {
              const svgEl = document.getElementById('tessellation-svg') as SVGSVGElement | null;
              if (!svgEl) return;
              const { svgText } = serializePatternSvg(svgEl);
              const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
              const url    = URL.createObjectURL(blob);

              const a = document.createElement('a');
              a.href = url;
              a.download = `tessellation-${shapeType}.svg`;
              a.click();
              window.setTimeout(() => URL.revokeObjectURL(url), 0);
            }}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white text-neutral-700 rounded-2xl font-bold text-sm hover:bg-neutral-100 transition-all border border-neutral-100"
          >
            <Download size={18} /> 패턴 벡터 이미지 저장
          </button>
        </div>

        <div className="pt-6 border-t border-neutral-100 text-center">
          <a
            href="https://jie.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex flex-col items-center gap-1 text-neutral-400 hover:text-indigo-600 transition-colors duration-200"
          >
            <span className="text-[13px] font-bold tracking-tight group-hover:text-indigo-600">JIE Inc.</span>
            <span className="text-[10px] tracking-wide">© {new Date().getFullYear()} JIE Inc. All rights reserved.</span>
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col bg-white lg:h-screen lg:overflow-hidden">
        <div className="relative z-30 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            aria-label="메뉴 열기"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(true)}
            className="rounded-xl p-2 text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            <Menu size={24} />
          </button>
          <span className="text-sm font-bold tracking-tight text-neutral-900">
            Tessellation <span className="text-indigo-600">Studio</span>
          </span>
          <button
            type="button"
            aria-label={isPageScrollLocked ? '페이지 스크롤 잠금 해제' : '페이지 스크롤 잠금'}
            aria-pressed={isPageScrollLocked}
            title={isPageScrollLocked ? '페이지 스크롤 잠금 해제' : '페이지 스크롤 잠금'}
            onClick={() => setIsPageScrollLocked((locked) => !locked)}
            className={`rounded-xl p-2 transition-colors ${isPageScrollLocked ? 'bg-indigo-100 text-indigo-600' : 'text-neutral-700 hover:bg-neutral-100'}`}
          >
            {isPageScrollLocked ? <Lock size={21} /> : <Unlock size={21} />}
          </button>
        </div>
        {/* Tessellation Preview (Background) */}
        <div className="absolute inset-0 z-0 overflow-hidden bg-neutral-50">
          <svg id="tessellation-svg" className="w-full h-full transition-opacity duration-500">
              <defs>
                <path id="tessellation-tile" d={tilePathData} />
              </defs>
              <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
                {shapeType === 'square' && (
                  squareDemoMode ? squareDemoTiles : (
                    <SquareShape colorA={colorA} colorB={colorB} RADIUS={RADIUS} CENTER={CENTER} triSymmetry={TRI_SYMMETRY} transformType={transformType as 'rotate90' | 'translate' | 'glide'} viewBounds={viewBounds} />
                  )
                )}
                {shapeType === 'hexagon' && (
                  <HexagonShape colorA={colorA} colorB={colorB} RADIUS={RADIUS} CENTER={CENTER} transformType={transformType as 'rotate120' | 'translate' | 'glide' | 'free'} demoMode={demoMode} demoStep={demoStep} demoCenters={demoCenters} viewBounds={viewBounds} />
                )}
                {shapeType === 'triangle' && (
                  <TriangleShape colorA={colorA} colorB={colorB} RADIUS={RADIUS} CENTER={CENTER} triSymmetry={TRI_SYMMETRY} demoMode={demoMode} demoStep={demoStep} demoCenters={demoCenters} viewBounds={viewBounds} />
                )}
              </g>
          </svg>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-end lg:contents">
        {/* Editor Overlay (hidden during demo and during square demo) */}
        {!demoMode && !squareDemoMode && (
          <div className={`flex-none lg:flex-1 flex items-center justify-center z-10 p-2.5 sm:p-8 lg:pointer-events-none ${isPageScrollLocked ? 'touch-none' : ''}`}>
            <div className="relative pointer-events-auto w-[calc(100vw-20px)] max-w-[464px] sm:w-auto">
            <AnimatePresence mode="wait">
              {showEditor && (
              <motion.div 
                key={shapeType}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                className="w-full bg-white/10 backdrop-blur-xl p-2.5 sm:p-8 rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] border border-white/50"
              >
                <svg 
                  id="editor-svg"
                  width={CANVAS_SIZE} 
                  height={CANVAS_SIZE} 
                  className="w-full h-auto cursor-crosshair overflow-visible"
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchMove={handleMouseMove}
                  onTouchEnd={handleMouseUp}
                  onContextMenu={e => e.preventDefault()}
                >
                  {/* Base Grid Lines */}
                  {showGrid && (
                    <g className="stroke-neutral-200 stroke-1">
                      {baseVertices.map((v, i) => {
                        const nextV = baseVertices[(i + 1) % baseVertices.length];
                        return <line key={i} x1={v.x} y1={v.y} x2={nextV.x} y2={nextV.y} strokeDasharray="8 8" />;
                      })}
                    </g>
                  )}

                  {/* The Shape Path */}
                  <path 
                    d={tilePathData} 
                    fill={colorA} 
                    fillOpacity="0.15"
                    stroke={colorA} 
                    strokeWidth="4"
                    strokeLinejoin="round"
                    className="transition-colors duration-300"
                  />

                  {/* Control Points */}
                  {Object.entries(currentEdgePaths).map(([edgeIdx, points]) => {
                    const ei = Number(edgeIdx);

                    if (shapeType === 'triangle') {
                      const edgeStart = baseVertices[ei];
                      const edgeEnd = baseVertices[(ei + 1) % baseVertices.length];
                      const displayPoints = (points as Point[]).map((point, pointIdx) => getCurveDisplayPoint(edgeStart, edgeEnd, points as Point[], pointIdx, useCurve));
                      return renderTriangleControls({ ei, points: points as Point[], displayPoints, activePoint, triSymmetry: TRI_SYMMETRY, handleMouseDown });
                    }

                    // Non-triangle shapes: special-case square so bottom edge is draggable
                    // and the paired edge is shown orange and non-interactive
                    if (shapeType === 'square') {
                      const edgeStart = baseVertices[ei];
                      const edgeEnd = baseVertices[(ei + 1) % baseVertices.length];
                      const displayPoints = (points as Point[]).map((point, pointIdx) => getCurveDisplayPoint(edgeStart, edgeEnd, points as Point[], pointIdx, useCurve));
                      return renderSquareControls({ ei, points: points as Point[], displayPoints, activePoint, triSymmetry: TRI_SYMMETRY, transformType: transformType as 'rotate90' | 'translate' | 'glide', handleMouseDown });
                    }

                    // Hexagon-specific controls
                    if (shapeType === 'hexagon') {
                      const edgeStart = baseVertices[ei];
                      const edgeEnd = baseVertices[(ei + 1) % baseVertices.length];
                      const displayPoints = (points as Point[]).map((point, pointIdx) => getCurveDisplayPoint(edgeStart, edgeEnd, points as Point[], pointIdx, useCurve));
                      return renderHexagonControls({
                        ei,
                        points: points as Point[],
                        displayPoints,
                        activePoint,
                        transformType: transformType as any,
                        handleMouseDown,
                        baseVertices,
                        onAddPoint: transformType === 'free' ? handleAddHexagonPoint : undefined,
                      });
                    }

                    // Fallback for other non-triangle shapes
                    return (
                      <g key={edgeIdx}>
                        {(points as Point[]).map((p, pointIdx) => (
                          <motion.circle
                            key={pointIdx}
                            cx={p.x}
                            cy={p.y}
                            r={activePoint?.edgeIdx === ei && activePoint?.pointIdx === pointIdx ? 12 : 8}
                            initial={false}
                            animate={{
                              r: activePoint?.edgeIdx === ei && activePoint?.pointIdx === pointIdx ? 12 : 8,
                              fill: activePoint?.edgeIdx === ei && activePoint?.pointIdx === pointIdx ? '#4f46e5' : '#6366f1'
                            }}
                            className={`stroke-white stroke-[3px] shadow-lg ${
                              activePoint && activePoint.edgeIdx !== ei ? 'pointer-events-none opacity-50 cursor-default' :
                              'cursor-move'
                            }`}
                            onMouseDown={() => handleMouseDown(ei, pointIdx)}
                            onTouchStart={() => handleMouseDown(ei, pointIdx)}
                          />
                        ))}
                      </g>
                    );
                  })}

                  {/* Vertices (Static) */}
                  {baseVertices.map((v, i) => (
                    <rect
                      key={i}
                      x={v.x - 5}
                      y={v.y - 5}
                      width={10}
                      height={10}
                      rx={2}
                      className="fill-neutral-300"
                    />
                  ))}
                </svg>
              </motion.div>
              )}
            </AnimatePresence>
            
            <button
              type="button"
              onClick={() => setShowEditor((visible) => !visible)}
              aria-expanded={showEditor}
              aria-label={showEditor ? '기본 도형 편집기 접기' : '기본 도형 편집기 펼치기'}
              className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-2 whitespace-nowrap bg-white px-5 py-2.5 rounded-full shadow-xl border border-neutral-100 text-[12px] font-black tracking-[0.2em] text-neutral-400 uppercase transition-colors hover:text-indigo-600"
            >
              <Move size={12} className="text-indigo-600" />
              기본 도형 편집기
              {showEditor ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            </div>
          </div>
        )}

        {/* Demo explanatory overlay (fixed bottom-center; no vertical animation) */}
        {demoMode && (
          <div className="absolute inset-0 pointer-events-none z-40">
            <AnimatePresence>
              <motion.div
                key={`demo-text-${demoStep}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute bottom-36 left-1/2 -translate-x-1/2 flex w-[calc(100vw-20px)] max-w-[48rem] flex-col items-center gap-2 rounded-2xl border border-neutral-100 bg-white/95 px-3 py-3 text-sm font-medium text-neutral-700 shadow-lg pointer-events-auto sm:flex-row sm:gap-3 sm:px-5"
              >
                <div className="w-full text-center sm:max-w-[48ch]">{getDemoText(demoStep)}</div>
                  <div className="flex w-full items-center justify-center gap-2 sm:ml-2 sm:w-auto">
                  <button onClick={prevDemoStep} className="px-3 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200">이전</button>
                  <button onClick={nextDemoStep} className="px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">다음</button>
                  <button onClick={handleStopDemo} className="px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600">종료</button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Square demo overlay */}
        {squareDemoMode && (
          <div className="absolute inset-0 pointer-events-none z-40">
            <AnimatePresence>
              <motion.div
                key={`sqdemo-text-${squareDemoStep}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute bottom-36 left-1/2 -translate-x-1/2 flex w-[calc(100vw-20px)] max-w-[48rem] flex-col items-center gap-2 rounded-2xl border border-neutral-100 bg-white/95 px-3 py-3 text-sm font-medium text-neutral-700 shadow-lg pointer-events-auto sm:flex-row sm:gap-3 sm:px-5"
              >
                <div className="w-full text-center sm:max-w-[48ch]">{getSquareDemoText(squareDemoStep)}</div>
                <div className="flex w-full items-center justify-center gap-2 sm:ml-2 sm:w-auto">
                  <button onClick={() => prevSquareStep(setSquareDemoStep)} className="px-3 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200">이전</button>
                  <button onClick={() => nextSquareStep(setSquareDemoStep)} className="px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">다음</button>
                  <button onClick={() => stopSquareDemo({ setSquareDemoMode, setSquareDemoStep, squareDemoIntervalRef })} className="px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600">종료</button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Floating Toolbar */}
        <div className="relative mx-auto mt-2.5 mb-[calc(3rem+5px+env(safe-area-inset-bottom))] sm:mb-0 sm:absolute sm:bottom-10 sm:left-1/2 sm:-translate-x-1/2 z-30 flex w-[calc(100vw-20px)] max-w-max flex-wrap items-center justify-center gap-2 sm:gap-4 bg-white/80 backdrop-blur-xl px-3 sm:px-6 py-2 sm:py-3 rounded-3xl shadow-2xl border border-neutral-200/50">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowGrid(!showGrid)}
              className={`p-2.5 rounded-xl transition-all ${showGrid ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-neutral-400 hover:bg-neutral-100'}`}
              title="가이드 라인 토글"
            >
              <Grid3X3 size={20} />
            </button>
          </div>
          <div className="w-px h-8 bg-neutral-200" />
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Zoom</span>
            <input aria-label='input'
              type="range" 
              min="0.5" 
              max="2" 
              step="0.1" 
              value={zoom} 
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-24 sm:w-32 accent-indigo-600"
            />
          </div>
          <div className="w-px h-8 bg-neutral-200" />
          <div className="w-px h-8 bg-neutral-200" />
          {!demoMode && (
            <button
              onClick={() => {
                if (shapeType === 'triangle') startTriangleDemo({ setShapeType, setDemoCenters, setDemoMode, setDemoStep, demoIntervalRef, RADIUS });
                else if (shapeType === 'square') startSquareDemo({ setShapeType, setSquareDemoMode, setSquareDemoStep, setShowEditor });
                else if (shapeType === 'hexagon') startHexagonDemo({ setShapeType, setDemoCenters, setDemoMode, setDemoStep, demoIntervalRef, RADIUS, transformType: transformType as 'rotate120' | 'translate' | 'glide' | 'free' });
              }}
              className="px-3 py-2 rounded-full font-bold text-sm transition bg-indigo-600 text-white hover:bg-indigo-700"
              title="설명하기"
            >
              설명하기
            </button>
          )}

          <p className="text-xs font-bold text-neutral-700 whitespace-nowrap">
            {shapeType === 'triangle' ? '정삼각형' : shapeType === 'square' ? '정사각형' : '정육각형'} 패턴
          </p>
        </div>

        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .font-display {
          font-family: 'Pretendard Variable', Pretendard, sans-serif;
        }

        @media print {
          aside { display: none; }
          main { width: 100%; height: 100vh; background: white; }
          .absolute { position: relative; }
          .z-10, .z-30 { display: none; }
          .opacity-30 { opacity: 1; }
          .bg-neutral-50 { background: white; }
        }

        input[type="range"] {
          -webkit-appearance: none;
          background: #e5e7eb;
          height: 4px;
          border-radius: 2px;
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          background: #4f46e5;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
      ` }} />
    </div>
  );
}
