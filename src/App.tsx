// App.tsx
// Main application component for Tessellation Studio.
// - Manages global UI state (selected shape, colors, zoom, demo modes, editor state).
// - Computes base vertices for regular shapes and maintains editable edge control points.
// - Delegates shape-specific editing, demo steps, and control rendering to
//   `Square.tsx`, `Hexagon.tsx`, and `Triangle.tsx` helper exports.
// - Exposes export-to-PNG logic which inlines computed styles before rasterizing.
// NOTE: This file contains only UI wiring and shared utilities; shape-specific
// behavior (paired-edge updates, demo assembly) lives in the shape modules.
import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  Grid3X3
} from 'lucide-react';

import SquareShape, { applySquareEdit, Point as SquarePoint, buildSquareDemoTiles, renderSquareControls, startSquareDemo, stopSquareDemo, nextSquareStep, prevSquareStep, getSquareDemoText as squareGetDemoText } from './Square';
import HexagonShape, { applyHexagonEdit, renderHexagonControls, startHexagonDemo, stopHexagonDemo, nextHexagonStep, prevHexagonStep, getHexagonDemoText } from './Hexagon';
import TriangleShape, { initTrianglePaths, applyTriangleEdit, Point as TriPoint, startTriangleDemo, stopTriangleDemo, renderTriangleControls, nextTriangleStep, prevTriangleStep, getTriangleDemoText, triangleAutoAdvance } from './Triangle';

// --- Types ---

type ShapeType = 'triangle' | 'square' | 'hexagon';

interface Point {
  x: number;
  y: number;
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

export default function App() {
  // Inline computed SVG styles into style attributes to preserve appearance when serializing.
  // Why: When we serialize the SVG for export we want computed CSS (colors, strokes,
  // fonts, etc.) baked into each element so the exported raster matches the on-screen
  // appearance even outside the app's CSS environment.
  // Implementation notes:
  // - Iterates all descendant nodes and copies a small whitelist of CSS properties
  //   into an inline `style` attribute.
  // - Wrapped in try/catch per node because getComputedStyle can throw on some nodes
  //   (e.g. foreignObjects or inaccessible cross-origin fonts in certain browsers).
  const inlineStyles = (el: Element) => {
    if (typeof window === 'undefined') return el;
    const nodes = el.querySelectorAll('*');
    const props = ['fill','stroke','opacity','stroke-width','fill-opacity','stroke-opacity','stroke-linejoin','stroke-linecap','stroke-miterlimit','font-size','font-family','font-weight','mix-blend-mode'];
    nodes.forEach(node => {
      try {
        const cs = window.getComputedStyle(node as Element);
        const stylePairs: string[] = [];
        for (const p of props) {
          const v = cs.getPropertyValue(p);
          if (v) stylePairs.push(`${p}:${v}`);
        }
        if (stylePairs.length) (node as HTMLElement).setAttribute('style', stylePairs.join(';'));
      } catch (e) {
        // ignore nodes that can't compute styles
      }
    });
  };
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
  const [transformType, setTransformType] = useState<'rotate90' | 'rotate120' | 'translate' | 'glide'>('rotate90');
  const [demoMode, setDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const demoIntervalRef = React.useRef<number | null>(null);
  const [demoCenters, setDemoCenters] = useState<{cx:number, cy:number}[]>([]);
  // Square demo state: show construction steps (base, 90°,180°,270°)
  const [squareDemoMode, setSquareDemoMode] = useState(false);
  const [squareDemoStep, setSquareDemoStep] = useState(0);
  const squareDemoIntervalRef = React.useRef<number | null>(null);

  // Control whether the Edge Editor overlay is shown. Default: hidden.
  const [showEditor, setShowEditor] = useState(false);

  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const compute = () => setOffset({ x: window.innerWidth / 2 - CENTER, y: window.innerHeight / 2 - CENTER });
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

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
    };
  }, []);

  // If there are 7 or more surrounding hexes, when demo reaches the
  // surrounding-hexes phase (demoStep > 6) skip incremental reveal and
  // immediately show all surrounding hexes by advancing demoStep to full.
  useEffect(() => {
    triangleAutoAdvance(demoMode, demoStep, demoCenters.length, setDemoStep);
  }, [demoMode, demoStep, demoCenters.length]);

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
    if (shapeType === 'hexagon') return getHexagonDemoText(step, transformType as 'rotate120' | 'translate' | 'glide');
    return getTriangleDemoText(step, TRI_SYMMETRY);
  };

  const getSquareDemoText = (step: number) => squareGetDemoText(step, transformType as 'rotate90' | 'translate' | 'glide');

  const handleMouseDown = (edgeIdx: number, pointIdx: number) => {
    setActivePoint({ edgeIdx, pointIdx });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!activePoint) return;

    const svg = document.getElementById('editor-svg');
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Convert client coordinates into the SVG's internal 0..CANVAS_SIZE coordinate
    // system taking into account the element's displayed bounding box. This keeps
    // pointer control stable even when the SVG is scaled by CSS/layout.
    const x = (clientX - rect.left) * (CANVAS_SIZE / rect.width);
    const y = (clientY - rect.top) * (CANVAS_SIZE / rect.height);

    // Update the edge control points immutably. We base the edit on the
    // pre-computed `currentEdgePaths` (which contains defaults if user hasn't
    // edited anything) to avoid surprising mutations from a stale `prev`.
    setEdgePaths(prev => {
      const newPaths = { ...currentEdgePaths };
      const points = [...newPaths[activePoint.edgeIdx]];
      points[activePoint.pointIdx] = { x, y };
      newPaths[activePoint.edgeIdx] = points;

      // Delegate triangle-specific edit behavior
      if (shapeType === 'triangle') {
        // applyTriangleEdit will return a newPaths object with any triangle-specific
        // paired/mirror updates applied.
        return applyTriangleEdit(newPaths, activePoint, baseVertices as TriPoint[], TRI_SYMMETRY);
      }

      // Delegate square-specific edit behavior
      if (shapeType === 'square') {
        return applySquareEdit(newPaths, activePoint, baseVertices as SquarePoint[], TRI_SYMMETRY, transformType as 'rotate90' | 'translate' | 'glide', CENTER);
      }

        // Delegate hexagon-specific edit behavior
        if (shapeType === 'hexagon') {
          return applyHexagonEdit(newPaths, activePoint, baseVertices as Point[], transformType as any);
        }

      return newPaths;
    });
  }, [activePoint, currentEdgePaths]);

  const handleMouseUp = () => setActivePoint(null);

  // Generate the full path for one tile
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
    buildSquareDemoTiles({ squareDemoMode, squareDemoStep, tilePathData, baseVertices, colorA, colorB, transformType: transformType as 'rotate90' | 'translate' | 'glide', RADIUS }),
    [squareDemoMode, squareDemoStep, tilePathData, baseVertices, colorA, colorB, transformType, RADIUS]
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-neutral-50 lg:overflow-hidden font-sans">
      {/* Sidebar Controls */}
      <aside className="w-full lg:w-96 bg-white border-b lg:border-b-0 lg:border-r border-neutral-200 p-8 flex flex-col gap-8 z-20 shadow-xl lg:h-screen lg:overflow-y-auto">
        <header>
          <h1 className="text-3xl font-display font-bold tracking-tight text-neutral-900 leading-none">
            Tessellation <span className="text-indigo-600">Studio</span>
          </h1>
          <p className="text-sm text-neutral-500 mt-3 leading-relaxed">
            도형의 변을 자유롭게 변형하여 아름다운 반복 패턴을 만들어보세요.
          </p>
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
                      <button
                        key={c}
                        onClick={() => setColorA(c)}
                        className={`w-10 h-10 rounded-xl border-4 transition-all hover:scale-110 active:scale-95 ${colorA === c ? 'border-white ring-2 ring-indigo-600 shadow-lg' : 'border-transparent shadow-sm'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-neutral-100 shadow-sm hover:border-neutral-300 transition-colors">
                      <input 
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
                      <button
                        key={c}
                        onClick={() => setColorB(c)}
                        className={`w-10 h-10 rounded-xl border-4 transition-all hover:scale-110 active:scale-95 ${colorB === c ? 'border-white ring-2 ring-indigo-600 shadow-lg' : 'border-transparent shadow-sm'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-neutral-100 shadow-sm hover:border-neutral-300 transition-colors">
                      <input 
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
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'rotate120', label: '120도 회전' },
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

          {/* triangle symmetry option removed; default clockwise */}

          <section className="space-y-4">
            <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Info size={14} /> {shapeType === 'square' ? '5' : '4'}. 사용 방법
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
              {/* demo button removed from sidebar per request */}
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
              const { width, height } = svgEl.getBoundingClientRect();
              const w = Math.round(width)  || 1200;
              const h = Math.round(height) || 800;

              // Clone and make fully opaque for export
              const clone = svgEl.cloneNode(true) as SVGSVGElement;
              clone.setAttribute('width',  String(w));
              clone.setAttribute('height', String(h));
              clone.style.opacity = '1';

              // Inline background colour (use computed background of parent if available)
              const parent = svgEl.parentElement;
              let bgColor = '#fafafa';
              try { if (parent) { const cb = getComputedStyle(parent).backgroundColor; if (cb && cb !== 'rgba(0, 0, 0, 0)') bgColor = cb; } } catch (e) {}
              const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              bg.setAttribute('width',  String(w));
              bg.setAttribute('height', String(h));
              bg.setAttribute('fill', bgColor);
              clone.insertBefore(bg, clone.firstChild);

              // Inline computed styles so exported SVG matches on-screen rendering
              inlineStyles(clone);

              const svgStr = new XMLSerializer().serializeToString(clone);
              const blob   = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
              const url    = URL.createObjectURL(blob);

              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width  = w * 2;   // 2× for retina
                canvas.height = h * 2;
                const ctx = canvas.getContext('2d')!;
                ctx.scale(2, 2);
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);

                const a = document.createElement('a');
                a.download = `tessellation-${shapeType}.png`;
                a.href = canvas.toDataURL('image/png');
                a.click();
              };
              img.src = url;
            }}
          >
            <Download size={18} /> 패턴 이미지 저장
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col bg-white lg:h-screen lg:overflow-hidden">
        {/* Tessellation Preview (Background) */}
        <div className="absolute inset-0 z-0 overflow-hidden bg-neutral-50">
          <svg id="tessellation-svg" className="w-full h-full transition-opacity duration-500">
              <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
                {shapeType === 'square' && (
                  squareDemoMode ? squareDemoTiles : (
                    <SquareShape tilePathData={tilePathData} colorA={colorA} colorB={colorB} RADIUS={RADIUS} CENTER={CENTER} triSymmetry={TRI_SYMMETRY} transformType={transformType as 'rotate90' | 'translate' | 'glide'} />
                  )
                )}
                {shapeType === 'hexagon' && (
                  <HexagonShape tilePathData={tilePathData} colorA={colorA} colorB={colorB} RADIUS={RADIUS} CENTER={CENTER} transformType={transformType as 'rotate120' | 'translate' | 'glide'} demoMode={demoMode} demoStep={demoStep} demoCenters={demoCenters} />
                )}
                {shapeType === 'triangle' && (
                  <TriangleShape tilePathData={tilePathData} colorA={colorA} colorB={colorB} RADIUS={RADIUS} CENTER={CENTER} triSymmetry={TRI_SYMMETRY} demoMode={demoMode} demoStep={demoStep} demoCenters={demoCenters} />
                )}
              </g>
          </svg>
        </div>

        {/* Editor Overlay (hidden during demo and during square demo) */}
        {!demoMode && !squareDemoMode && (
          <div className="flex-1 flex items-center justify-center z-10 p-8 pointer-events-none">
            <div className="relative pointer-events-auto">
            <AnimatePresence mode="wait">
              <motion.div 
                key={shapeType}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                className="bg-white/90 backdrop-blur-xl p-8 rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] border border-white/50"
              >
                <svg 
                  id="editor-svg"
                  width={CANVAS_SIZE} 
                  height={CANVAS_SIZE} 
                  className="cursor-crosshair overflow-visible"
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchMove={handleMouseMove}
                  onTouchEnd={handleMouseUp}
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
                      return renderTriangleControls({ ei, points: points as Point[], activePoint, triSymmetry: TRI_SYMMETRY, handleMouseDown });
                    }

                    // Non-triangle shapes: special-case square so bottom edge is draggable
                    // and the paired edge is shown orange and non-interactive
                    if (shapeType === 'square') {
                      return renderSquareControls({ ei, points: points as Point[], activePoint, triSymmetry: TRI_SYMMETRY, transformType: transformType as 'rotate90' | 'translate' | 'glide', handleMouseDown });
                    }

                    // Hexagon-specific controls
                    if (shapeType === 'hexagon') {
                      return renderHexagonControls({ ei, points: points as Point[], activePoint, transformType: transformType as any, handleMouseDown });
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
            </AnimatePresence>
            
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white px-5 py-2.5 rounded-full shadow-xl border border-neutral-100 text-[10px] font-black tracking-[0.2em] text-neutral-400 uppercase">
              <Move size={12} className="text-indigo-600" /> Edge Editor
            </div>
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
                className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-white/95 px-5 py-3 rounded-2xl shadow-lg border border-neutral-100 text-sm font-medium text-neutral-700 flex items-center gap-3 pointer-events-auto"
              >
                <div className="max-w-[48ch] text-center">{getDemoText(demoStep)}</div>
                  <div className="ml-2 flex items-center gap-2">
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
                className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-white/95 px-5 py-3 rounded-2xl shadow-lg border border-neutral-100 text-sm font-medium text-neutral-700 flex items-center gap-3 pointer-events-auto"
              >
                <div className="max-w-[48ch] text-center">{getSquareDemoText(squareDemoStep)}</div>
                <div className="ml-2 flex items-center gap-2">
                  <button onClick={() => prevSquareStep(setSquareDemoStep)} className="px-3 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200">이전</button>
                  <button onClick={() => nextSquareStep(setSquareDemoStep)} className="px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">다음</button>
                  <button onClick={() => stopSquareDemo({ setSquareDemoMode, setSquareDemoStep, squareDemoIntervalRef })} className="px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600">종료</button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Floating Toolbar */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-white/80 backdrop-blur-xl px-6 py-3 rounded-3xl shadow-2xl border border-neutral-200/50">
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
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Zoom</span>
            <input 
              type="range" 
              min="0.5" 
              max="2" 
              step="0.1" 
              value={zoom} 
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-32 accent-indigo-600"
            />
          </div>
          <div className="w-px h-8 bg-neutral-200" />
          <div className="w-px h-8 bg-neutral-200" />
          {!demoMode && (
            <button
              onClick={() => {
                if (shapeType === 'triangle') startTriangleDemo({ setShapeType, setDemoCenters, setDemoMode, setDemoStep, demoIntervalRef, RADIUS });
                else if (shapeType === 'square') startSquareDemo({ setShapeType, setSquareDemoMode, setSquareDemoStep, setShowEditor });
                else if (shapeType === 'hexagon') startHexagonDemo({ setShapeType, setDemoCenters, setDemoMode, setDemoStep, demoIntervalRef, RADIUS, transformType: transformType as 'rotate120' | 'translate' | 'glide' });
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

        {/* demo button now in toolbar; centered demo button removed */}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap');
        
        .font-display {
          font-family: 'Space Grotesk', sans-serif;
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
