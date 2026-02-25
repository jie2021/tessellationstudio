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

import Rectangle, { applySquareEdit, Point as RectPoint } from './Rectangle';
import HexagonShape from './Hexagon';
import TriangleShape, { initTrianglePaths, applyTriangleEdit, Point as TriPoint } from './Triangle';

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
  // Inline computed SVG styles into style attributes to preserve appearance when serializing
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
  // Triangle symmetry mode: which edge maps to which
  // 'cw':  edge i -> edge (i+2)%3 (60° CW rotation around triangle center)
  // 'ccw': edge i -> edge (i+1)%3 (60° CCW rotation around triangle center)
  const [triSymmetry, setTriSymmetry] = useState<'cw' | 'ccw'>('cw');
  const [useCurve, setUseCurve] = useState(true);
  const [transformType, setTransformType] = useState<'rotate90' | 'translate' | 'glide'>('rotate90');
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
      const tri = initTrianglePaths(baseVertices as TriPoint[], RADIUS, triSymmetry);
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

  const stopDemo = () => {
    setDemoMode(false);
    setDemoStep(0);
    if (demoIntervalRef.current) {
      window.clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
  };

  const startDemo = () => {
    // Ensure triangle mode and reset editor
    setShapeType('triangle');
    // Use the current edited shape for the demo (do not reset paths)
    // prepare demo centers (sorted by distance) and start at step 0
    const s = RADIUS * Math.sqrt(3);
    const stepX = s * 1.5;
    const stepY = s * Math.sqrt(3);
    const demoRange = 4;
    const centers: {cx:number, cy:number}[] = [];
    for (let row = -demoRange; row <= demoRange; row++) {
      for (let col = -demoRange; col <= demoRange; col++) {
        if (row === 0 && col === 0) continue;
        const hexCX = col * stepX;
        const hexCY = row * stepY + (col % 2 !== 0 ? stepY / 2 : 0);
        centers.push({cx: hexCX, cy: hexCY});
      }
    }
    centers.sort((a,b) => (Math.hypot(a.cx, a.cy) - Math.hypot(b.cx, b.cy)));
    setDemoCenters(centers);
    setDemoMode(true);
    setDemoStep(0);
  };

  // --- Square demo controls ---
  const startSquareDemo = () => {
    setShapeType('square');
    setSquareDemoMode(true);
    setSquareDemoStep(1);
    // Ensure editor is hidden while demo runs
    try { setShowEditor(false); } catch(e) {}
  };

  // When switching to square, default the transform type to 90° rotation
  useEffect(() => {
    if (shapeType === 'square') setTransformType('rotate90');
  }, [shapeType]);

  // When the transform type changes, reset any edited control points
  // so the new transform mode starts from the guideline defaults.
  useEffect(() => {
    resetPaths();
    setActivePoint(null);
  }, [transformType]);

  const stopSquareDemo = () => {
    setSquareDemoMode(false);
    setSquareDemoStep(0);
    if (squareDemoIntervalRef.current) {
      window.clearInterval(squareDemoIntervalRef.current);
      squareDemoIntervalRef.current = null;
    }
  };

  // Allow many translation reveal steps; cap is generous (4 rotations + 80 translations)
  const nextSquareStep = () => setSquareDemoStep(s => Math.min(s + 1, 4 + 80));
  const prevSquareStep = () => setSquareDemoStep(s => Math.max(s - 1, 1));

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
    if (!demoMode) return;
    // only apply when we've moved past the central 6-triangle explanation
    if (demoStep <= 12) return;
    if (demoCenters.length >= 13) {
      const full = 6 + demoCenters.length;
      if (demoStep !== full) setDemoStep(full);
    }
  }, [demoMode, demoStep, demoCenters.length]);

  const nextDemoStep = () => {
    const max = 6 + demoCenters.length;
    setDemoStep(prev => Math.min(prev + 1, max));
  };

  const prevDemoStep = () => {
    setDemoStep(prev => Math.max(prev - 1, 0));
  };

  const getDemoText = (step: number) => {
    if (step === 0) return '데모 준비 중... (다음 버튼을 눌러 시작하세요)';
    // Step 1: prepare the edited tile
    if (step === 1) return '변형된 도형을 준비합니다.';
    if (step >= 2 && step <= 6) {
      const k = step - 1;
      const angle = k * 60 * (triSymmetry === 'cw' ? 1 : -1);
      return `기준점을 기준으로 ${angle}도 회전합니다.`;
    }
    const hexes = Math.max(0, step - 6);
    if (hexes === 0) return '중앙 육각형 완성 — 다음 버튼을 눌러 주변 육각형을 하나씩 추가하세요.';
    return `주변 육각형 #${hexes}는 밀어서 복사합니다.`;
  };

  const getSquareDemoText = (step: number) => {
    if (step <= 0) return '데모 준비 중... (다음 버튼을 눌러 시작하세요)';
    if (transformType === 'translate') {
      if (step === 1) return '기본 도형을 표시합니다.';
      if (step >= 2 && step <= 4) return `기준점을 기준으로 동일한 도형을 평행이동으로 복사합니다 (스텝 ${step - 1}).`;
      const add = Math.max(0, step - 4);
      return `주변을 평행이동으로 채웁니다 — 추가 패치 #${add}`;
    }

    if (step === 1) return '기본 도형을 표시합니다.';
    if (step === 2) return '오른쪽 하단 꼭지점을 기준으로 90도 회전합니다.';
    if (step === 3) return '같은 기준점에서 180도 회전합니다.';
    if (step === 4) return '같은 기준점에서 270도 회전합니다.';
    const add = step - 4;
    return `주변을 평행이동으로 채웁니다 — 추가 패치 #${add}`;
  };

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

    const x = (clientX - rect.left) * (CANVAS_SIZE / rect.width);
    const y = (clientY - rect.top) * (CANVAS_SIZE / rect.height);

    setEdgePaths(prev => {
      const newPaths = { ...currentEdgePaths };
      const points = [...newPaths[activePoint.edgeIdx]];
      points[activePoint.pointIdx] = { x, y };
      newPaths[activePoint.edgeIdx] = points;

      // Delegate triangle-specific edit behavior
      if (shapeType === 'triangle') {
        // applyTriangleEdit will return a newPaths object with any triangle-specific
        // paired/mirror updates applied.
        return applyTriangleEdit(newPaths, activePoint, baseVertices as TriPoint[], triSymmetry);
      }

      // Delegate square-specific edit behavior
      if (shapeType === 'square') {
        return applySquareEdit(newPaths, activePoint, baseVertices as RectPoint[], triSymmetry, transformType, CENTER);
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

  // Precompute square demo tiles (rotated copies around bottom-right pivot)
  const squareDemoTiles = useMemo(() => {
    if (!squareDemoMode || shapeType !== 'square') return null;
    if (!baseVertices || baseVertices.length === 0) return null;
    // pivot = bottom-right vertex (max x+y)
    let pivot = baseVertices[0];
    for (const v of baseVertices) {
      if (v.x + v.y > pivot.x + pivot.y) pivot = v;
    }

    // Compute bounding box of the assembled 4-rotation patch to determine translation grid
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const rotatePoint = (p: { x: number; y: number }, angleDeg: number, cx: number, cy: number) => {
      const a = (angleDeg * Math.PI) / 180;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const rx = Math.cos(a) * dx - Math.sin(a) * dy;
      const ry = Math.sin(a) * dx + Math.cos(a) * dy;
      return { x: cx + rx, y: cy + ry };
    };
    for (let k = 0; k < 4; k++) {
      const angle = transformType === 'translate' ? 0 : k * 90;
      for (const v of baseVertices) {
        const rp = rotatePoint(v, angle, pivot.x, pivot.y);
        if (rp.x < minX) minX = rp.x;
        if (rp.y < minY) minY = rp.y;
        if (rp.x > maxX) maxX = rp.x;
        if (rp.y > maxY) maxY = rp.y;
      }
    }

    const width = (isFinite(maxX) && isFinite(minX)) ? Math.max(1, maxX - minX) : RADIUS * Math.SQRT2;
    const height = (isFinite(maxY) && isFinite(minY)) ? Math.max(1, maxY - minY) : RADIUS * Math.SQRT2;

    const arr: React.ReactNode[] = [];

    // Show the central assembly: for rotate mode reveal 1..4 rotated wedges;
    // for translate mode show only a single tile (no 4-piece assembly).
    const n = transformType === 'translate' ? 1 : Math.min(4, Math.max(1, squareDemoStep));
    for (let k = 0; k < n; k++) {
      const angle = transformType === 'translate' ? 0 : k * 90;
      const wedgeFill = (k % 2 === 0) ? colorA : colorB;
      arr.push(
        <path
          key={`sqdemo-center-${k}`}
          d={tilePathData}
          transform={`rotate(${angle}, ${pivot.x}, ${pivot.y})`}
          fill={wedgeFill}
          fillOpacity={1}
          stroke="#000"
          strokeWidth={0.5}
        />
      );
    }

    // If step > 4, reveal translated assemblies one by one
    if (squareDemoStep > 4) {
      const range = 4; // grid radius for revealed assemblies
      const centers: {cx:number, cy:number}[] = [];
      for (let r = -range; r <= range; r++) {
        for (let c = -range; c <= range; c++) {
          const cx = c * width;
          const cy = r * height;
          // skip central (0,0) — already shown
          if (Math.abs(cx) < 1e-6 && Math.abs(cy) < 1e-6) continue;
          centers.push({ cx, cy });
        }
      }
      centers.sort((a,b) => (Math.hypot(a.cx, a.cy) - Math.hypot(b.cx, b.cy)));

      const requested = squareDemoStep - 4;
      // If requested reveal index reaches 9 or more, show all at once
      const reveal = (requested >= 9) ? centers.length : Math.min(centers.length, requested);
      for (let i = 0; i < reveal; i++) {
        const { cx, cy } = centers[i];
        const tx = cx - 0; // we translate the whole assembly to (cx,cy) relative to pivot
        const ty = cy - 0;
        // For translated assemblies: in translate mode place a single tile; in rotate mode place 4 rotated wedges
        if (transformType === 'translate') {
          arr.push(
            <path
              key={`sqdemo-${i}-0`}
              d={tilePathData}
              transform={`translate(${tx}, ${ty}) rotate(0, ${pivot.x}, ${pivot.y})`}
              fill={i % 2 === 0 ? colorA : colorB}
              fillOpacity={1}
              stroke="#000"
              strokeWidth={0.5}
            />
          );
        } else {
          for (let k = 0; k < 4; k++) {
            const angle = k * 90;
            const wedgeFill = (k % 2 === 0) ? colorA : colorB;
            arr.push(
              <path
                key={`sqdemo-${i}-${k}`}
                d={tilePathData}
                transform={`translate(${tx}, ${ty}) rotate(${angle}, ${pivot.x}, ${pivot.y})`}
                fill={wedgeFill}
                fillOpacity={1}
                stroke="#000"
                strokeWidth={0.5}
              />
            );
          }
        }
      }
    }

    // pivot marker for demo clarity
    arr.push(
      <g key="sqdemo-pivot" pointerEvents="none">
        <circle cx={pivot.x} cy={pivot.y} r={8} fill="#ef4444" stroke="#fff" strokeWidth={2} />
        <circle cx={pivot.x} cy={pivot.y} r={4} fill="#fff" />
        <text x={pivot.x + 12} y={pivot.y + 4} fontSize={12} fill="#111" fontWeight={600}>기준점</text>
      </g>
    );

    return arr;
  }, [squareDemoMode, squareDemoStep, tilePathData, baseVertices, colorA]);

  // Logic for tiling.
  // The tile path is drawn centered at (CENTER, CENTER) in 0-CANVAS_SIZE coordinate space.
  // We render <path> elements directly with translate(worldX - CENTER, worldY - CENTER)
  // so the tile's center moves to (worldX, worldY) in world space.
  // This avoids the <symbol>+<use> viewBox scaling issue that caused overlapping tiles.
  const renderTessellation = () => {
    const tiles: React.ReactNode[] = [];
    const range = 12;

    if (shapeType === 'square') {
      // Square tiling.
      // By default use side = RADIUS * sqrt(2) and rotate by 90° per cell.
      // In translate mode use the tile's bounding-box width/height as the translation step
      // so background tiling matches the demo (translation-only) behavior.
      const defaultSide = RADIUS * Math.sqrt(2);
      let stepX = defaultSide;
      let stepY = defaultSide;
      if (transformType === 'translate') {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const v of baseVertices) {
          if (v.x < minX) minX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.x > maxX) maxX = v.x;
          if (v.y > maxY) maxY = v.y;
        }
        stepX = Math.max(1, maxX - minX);
        stepY = Math.max(1, maxY - minY);
      }

      // compute the square guideline centroid for reflection operations
      const guideCx = baseVertices.reduce((s, v) => s + v.x, 0) / baseVertices.length;
      const guideCy = baseVertices.reduce((s, v) => s + v.y, 0) / baseVertices.length;

      for (let r = -range; r < range; r++) {
        for (let c = -range; c < range; c++) {
          const tx = c * stepX - CENTER;
          const ty = r * stepY - CENTER;
          if (transformType === 'translate') {
            tiles.push(
              <path
                key={`sq-${r}-${c}`}
                d={tilePathData}
                transform={`translate(${tx}, ${ty}) rotate(0, ${CENTER}, ${CENTER})`}
                fill={(r + c) % 2 === 0 ? colorA : colorB}
                stroke="#000"
                strokeWidth="0.5"
              />
            );
          } else if (transformType === 'glide') {
            // Glide tiling: reflect first then translate.
            // If translation step is vertical-dominant, do left-right reflection (scale(-1,1)).
            // If translation step is horizontal-dominant, do top-bottom reflection (scale(1,-1)).
            const verticalDominant = Math.abs(stepY) >= Math.abs(stepX);
            if (verticalDominant) {
              // reflect left-right about the guideline center, then translate
              const tstr = `translate(${tx}, ${ty}) translate(${guideCx}, ${guideCy}) scale(-1,1) translate(${-guideCx}, ${-guideCy})`;
              tiles.push(
                <path
                  key={`sq-${r}-${c}`}
                  d={tilePathData}
                  transform={tstr}
                  fill={(r + c) % 2 === 0 ? colorA : colorB}
                  stroke="#000"
                  strokeWidth="0.5"
                />
              );
            } else {
              // reflect top-bottom about the guideline center, then translate
              const tstr = `translate(${tx}, ${ty}) translate(${guideCx}, ${guideCy}) scale(1,-1) translate(${-guideCx}, ${-guideCy})`;
              tiles.push(
                <path
                  key={`sq-${r}-${c}`}
                  d={tilePathData}
                  transform={tstr}
                  fill={(r + c) % 2 === 0 ? colorA : colorB}
                  stroke="#000"
                  strokeWidth="0.5"
                />
              );
            }
          } else {
            const rot = ((r + c) % 4) * 90;
            tiles.push(
              <path
                key={`sq-${r}-${c}`}
                d={tilePathData}
                transform={`translate(${tx}, ${ty}) rotate(${rot}, ${CENTER}, ${CENTER})`}
                fill={(r + c) % 2 === 0 ? colorA : colorB}
                stroke="#000"
                strokeWidth="0.5"
              />
            );
          }
        }
      }
    } else if (shapeType === 'hexagon') {
      // Flat-top hexagon: stepX = 3R/2, stepY = R*sqrt(3)
      // Apply 60° rotation symmetry based on column index
      const stepX = RADIUS * 1.5;
      const stepY = Math.sqrt(3) * RADIUS;
      for (let r = -range; r < range; r++) {
        for (let c = -range; c < range; c++) {
          const worldX = c * stepX;
          const worldY = r * stepY + (Math.abs(c) % 2 !== 0 ? stepY / 2 : 0);
          // Rotate by 60° per column to create rotational symmetry pattern
          const rot = ((r + c) % 6) * 60;
          tiles.push(
            <path
              key={`hex-${r}-${c}`}
              d={tilePathData}
              transform={`translate(${worldX - CENTER}, ${worldY - CENTER}) rotate(${rot}, ${CENTER}, ${CENTER})`}
              fill={(((r + Math.abs(c)) % 3 + 3) % 3) === 0 ? colorA : colorB}
              stroke="#000"
              strokeWidth="0.5"
            />
          );
        }
      }
    } else if (shapeType === 'triangle') {
      // ============================================================
      // Triangular tessellation — hexagon-based tiling strategy
      // ============================================================
      //
      // STRATEGY (CW mode):
      //   Take the editor triangle and rotate it 0°,60°,120°,180°,240°,300° around
      //   its bottom-right vertex V1 = (CENTER+hs, CENTER+R/2).
      //   These 6 copies form one regular hexagon whose center = V1.
      //   Then tile the plane with this hexagon.
      //
      //   CCW mode: same but rotate -60° increments (equivalent, just flipped labeling).
      //
      // Editor UP-triangle (circumradius R, centroid = (CENTER, CENTER)):
      //   V0 = (CENTER,       CENTER - R  )  ← apex (top)
      //   V1 = (CENTER + hs,  CENTER + R/2)  ← bottom-right  ← PIVOT for hexagon
      //   V2 = (CENTER - hs,  CENTER + R/2)  ← bottom-left
      //   where hs = R√3/2
      //
      // Hexagon center = V1 = (CENTER+hs, CENTER+R/2) in editor space.
      // Hexagon circumradius = side length s = R√3.
      //
      // For flat-top hexagonal tiling of hexagon-centers (pointy-top hex arrangement of centers):
      //   stepX = s * sqrt(3)      = R√3 * √3    = 3R
      //   stepY = s * 3/2          = R√3 * 3/2   = 3R√3/2
      //   offset every other column by stepY/2
      //
      // Actually our hexagons are "pointy-top" (since V1 is a corner of the hex).
      // For pointy-top hex grid:
      //   stepX = s * √3           (horizontal distance between hex centers)
      //   stepY = s * 3/2          (vertical distance between same-column hex centers)
      //   odd columns offset down by stepY/2
      //   where s = R√3 (hex circumradius = side of original triangle)
      //
      // Placing the 6-triangle hexagon:
      //   The hexagon center in WORLD space is at (hexCX, hexCY).
      //   The k-th triangle (k=0..5) is the editor tile rotated by k*rotDir*60° around V1,
      //   then the whole assembly is translated so that V1 moves to (hexCX, hexCY).
      //
      //   SVG transform for tile k of hexagon at (hexCX, hexCY):
      //     Step 1: rotate the tile k*rotDir*60° around V1 = (CENTER+hs, CENTER+R/2)
      //     Step 2: translate V1 → (hexCX, hexCY)
      //             i.e. translate by (hexCX - (CENTER+hs), hexCY - (CENTER+R/2))
      //
      //   Combined SVG transform (applied right-to-left in SVG):
      //     "translate(tx, ty) rotate(angleDeg, pivotX, pivotY)"
      //   where:
      //     pivotX = CENTER+hs, pivotY = CENTER+R/2   (= V1 in editor coords)
      //     angleDeg = k * rotDir * 60
      //     tx = hexCX - (CENTER+hs)
      //     ty = hexCY - (CENTER+R/2)

      const hs = RADIUS * Math.sqrt(3) / 2;  // R√3/2
      const s  = RADIUS * Math.sqrt(3);       // side = R√3

      // Pivot = V1 (bottom-right) for CW, V2 (bottom-left) for CCW
      const pivotX = triSymmetry === 'cw' ? CENTER + hs : CENTER - hs;
      const pivotY = CENTER + RADIUS / 2;

      // Flat-top hex tiling (our hex has vertices at 0°,60°,...,300° → flat top/bottom)
      //   Circumradius S = s = R√3
      //   Cross-column horizontal step = S × 3/2 = 3R√3/2
      //   Same-column vertical step    = S × √3  = 3R
      //   Odd columns shifted down by stepY/2 = 3R/2
      const stepX = s * 1.5;            // 3R√3/2 ≈ 311.8
      const stepY = s * Math.sqrt(3);   // 3R     = 360

      const rotDir = triSymmetry === 'cw' ? 1 : -1;

      // Color alternation for the 6 wedges: alternate between primary and secondary
      const wedgeColors = [colorA, colorB, colorA, colorB, colorA, colorB];

      if (demoMode) {
        // Demo sequence: 0..6 build central hex one triangle at a time,
        // then reveal surrounding hexagons one-by-one.
        const centerHexCX = 0;
        const centerHexCY = 0;
        const tx0 = centerHexCX - pivotX;
        const ty0 = centerHexCY - pivotY;

        // show up to demoStep triangles on the central hex
        const trianglesToShow = Math.min(6, demoStep);
        for (let k = 0; k < trianglesToShow; k++) {
          const angleDeg = k * rotDir * 60;
          tiles.push(
            <path
              key={`demo-center-${k}`}
              d={tilePathData}
              transform={`translate(${tx0}, ${ty0}) rotate(${angleDeg}, ${pivotX}, ${pivotY})`}
              fill={wedgeColors[k]}
              stroke="#000"
              strokeWidth="0.5"
            />
          );
        }

        // Show pivot marker only when explaining rotation (steps 1..6)
        if (demoStep >= 1 && demoStep <= 6) {
          const pivotWorldX = pivotX + tx0;
          const pivotWorldY = pivotY + ty0;
          tiles.push(
            <g key={`demo-pivot`} pointerEvents="none">
              <circle cx={pivotWorldX} cy={pivotWorldY} r={8} fill="#ef4444" stroke="#fff" strokeWidth={2} />
              <circle cx={pivotWorldX} cy={pivotWorldY} r={4} fill="#fff" />
              <text x={pivotWorldX + 12} y={pivotWorldY + 4} fontSize={12} fill="#111" fontWeight={600}>기준점</text>
            </g>
          );
        }

        if (demoStep > 6) {
          const hexToShow = demoStep - 6; // how many hexagons to reveal
          const centersToShow = demoCenters.slice(0, Math.min(hexToShow, demoCenters.length));
          for (let i = 0; i < centersToShow.length; i++) {
            const { cx, cy } = centersToShow[i];
            const tx = cx - pivotX;
            const ty = cy - pivotY;
            for (let k = 0; k < 6; k++) {
              const angleDeg = k * rotDir * 60;
              tiles.push(
                <path
                  key={`demo-hex-${i}-${k}`}
                  d={tilePathData}
                  transform={`translate(${tx}, ${ty}) rotate(${angleDeg}, ${pivotX}, ${pivotY})`}
                  fill={wedgeColors[k]}
                  stroke="#000"
                  strokeWidth="0.5"
                />
              );
            }
          }
        }
        
      } else {
        for (let row = -range; row < range; row++) {
          for (let col = -range; col < range; col++) {
            // Hex center in world space
            const hexCX = col * stepX;
            const hexCY = row * stepY + (col % 2 !== 0 ? stepY / 2 : 0);

            const tx = hexCX - pivotX;
            const ty = hexCY - pivotY;

            for (let k = 0; k < 6; k++) {
              const angleDeg = k * rotDir * 60;
              tiles.push(
                <path
                  key={`tri-${row}-${col}-${k}`}
                  d={tilePathData}
                  transform={`translate(${tx}, ${ty}) rotate(${angleDeg}, ${pivotX}, ${pivotY})`}
                  fill={wedgeColors[k]}
                  stroke="#000"
                  strokeWidth="0.5"
                />
              );
            }
          }
        }
      }
    }

    return tiles;
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-neutral-50 lg:overflow-hidden font-sans">
      {/* Sidebar Controls */}
      <aside className="w-full lg:w-96 bg-white border-b lg:border-b-0 lg:border-r border-neutral-200 p-8 flex flex-col gap-8 z-20 shadow-xl lg:h-screen lg:overflow-y-auto">
        <header>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-widest mb-4">
            <Grid3X3 size={12} /> Interactive Design Tool
          </div>
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
              <Palette size={14} /> 2. 테마 색상
            </label>
            <div className="flex gap-3 flex-wrap">
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-[10px] text-neutral-400 mb-2">Primary</div>
                  <div className="flex gap-2">
                    {['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'].map(c => (
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
                    {['#ffffff', '#f3f4f6', '#fafafa', '#fde68a', '#d1fae5'].map(c => (
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
              {([{ val: false, label: '직선', desc: 'Straight' }, { val: true, label: '곡선', desc: 'Bezier' }] as const).map(opt => (
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
                  <span className="text-[9px] mt-0.5 opacity-60">{opt.desc}</span>
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
              <p className="text-[11px] text-neutral-400 leading-relaxed bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                90도 회전 선택 시 현재 테셀레이션에 적용된 회전이 선택됩니다. 평행 이동과 미끄럼 반사는 추후에 조절점 변경 방식으로 지원됩니다.
              </p>
            </section>
          )}

          {shapeType === 'triangle' && (
            <section className="space-y-4">
              <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                <RotateCcw size={14} /> 4. 변 대칭 모드
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'cw',  label: 'CW 60°',  desc: '시계방향' },
                  { id: 'ccw', label: 'CCW 60°', desc: '반시계' },
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setTriSymmetry(opt.id); resetPaths(); }}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 ${
                      triSymmetry === opt.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-inner'
                        : 'border-neutral-100 bg-neutral-50 text-neutral-400 hover:border-neutral-200'
                    }`}
                  >
                    <span className="text-[11px] font-black tracking-tight">{opt.label}</span>
                    <span className="text-[9px] mt-0.5 opacity-60">{opt.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                한 변을 드래그하면 대응 변이 자동으로 반전되어 테셀레이션이 완성됩니다.
              </p>
            </section>
          )}

          <section className="space-y-4">
            <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Info size={14} /> {shapeType === 'triangle' || shapeType === 'square' ? '5' : '4'}. 사용 방법
            </label>
            <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-100 space-y-3">
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
                <p className="text-xs text-neutral-600 leading-relaxed">우측 에디터의 <span className="font-bold text-indigo-600">파란색 조절점</span>을 드래그하세요.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  {transformType === 'translate' ? '선택한 "평행 이동" 모드에서는 회전 과정을 생략하고 평행 이동(translation)만으로 타일을 배치합니다 — 타일이 서로 회전하지 않고 평행 이동으로 복사됩니다.' : '변형된 모양이 배경에 실시간으로 반복됩니다.'}
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
                    <Rectangle tilePathData={tilePathData} colorA={colorA} colorB={colorB} RADIUS={RADIUS} CENTER={CENTER} triSymmetry={triSymmetry} transformType={transformType} />
                  )
                )}
                {shapeType === 'hexagon' && (
                  <HexagonShape tilePathData={tilePathData} colorA={colorA} colorB={colorB} RADIUS={RADIUS} CENTER={CENTER} />
                )}
                {shapeType === 'triangle' && (
                  <TriangleShape tilePathData={tilePathData} colorA={colorA} colorB={colorB} RADIUS={RADIUS} CENTER={CENTER} triSymmetry={triSymmetry} demoMode={demoMode} demoStep={demoStep} demoCenters={demoCenters} />
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
                      const driven = 1;
                      const paired = triSymmetry === 'cw' ? (driven + 2) % 3 : (driven + 1) % 3;
                      const spare = [0,1,2].find(x => x !== driven && x !== paired)!;

                      // Only render driven, paired and spare edges in triangle mode
                      if (![driven, paired, spare].includes(ei)) return null;

                      return (
                        <g key={edgeIdx}>
                          {(points as Point[]).map((p, pointIdx) => {
                            const isDriven = ei === driven;
                            const isPaired = ei === paired;
                            const isSpare = ei === spare;

                            // Visuals: driven = solid blue, spare = two blues (one active,
                            // one mirrored), paired = orange (auto-updated)
                            let fill = isPaired ? '#f59e0b' : isDriven ? '#2563eb' : (isSpare ? (pointIdx === 0 ? '#2563eb' : '#60a5fa') : '#6366f1');

                            // Interactivity: paired edge points are non-interactive. For
                            // spare edge, allow dragging the first point (index 0) and
                            // mirror the second; driven edge (bottom) remains draggable.
                            const interactive = !isPaired && !(isSpare && pointIdx === 1);
                            // Make interactive (draggable) points blue; auto-updated remain orange
                            if (interactive) fill = '#2563eb';

                            return (
                              <motion.circle
                                key={pointIdx}
                                cx={p.x}
                                cy={p.y}
                                r={activePoint?.edgeIdx === ei && activePoint?.pointIdx === pointIdx ? 12 : 8}
                                initial={false}
                                animate={{ r: activePoint?.edgeIdx === ei && activePoint?.pointIdx === pointIdx ? 12 : 8, fill }}
                                className={`stroke-white stroke-[3px] shadow-lg ${
                                  !interactive ? 'pointer-events-none cursor-default' :
                                  activePoint && activePoint.edgeIdx !== ei ? 'pointer-events-none cursor-default' :
                                  'cursor-move'
                                }`}
                                onMouseDown={!interactive ? undefined : () => handleMouseDown(ei, pointIdx)}
                                onTouchStart={!interactive ? undefined : () => handleMouseDown(ei, pointIdx)}
                              />
                            );
                          })}
                        </g>
                      );
                    }

                    // Non-triangle shapes: special-case square so bottom edge is draggable
                    // and the paired edge is shown orange and non-interactive
                    if (shapeType === 'square') {
                      const driven = 3; // bottom edge
                      const paired = triSymmetry === 'cw' ? (driven + 1) % 4 : (driven + 3) % 4; // cw -> right(0), ccw -> left(2)
                      const leftIdx = 2;
                      const topIdx = 1;
                      const rightIdx = triSymmetry === 'cw' ? 0 : 2;
                      return (
                        <g key={edgeIdx}>
                          {(points as Point[]).map((p, pointIdx) => {
                            const isDriven = ei === driven;
                            const isPaired = ei === paired;
                            const isLeft = ei === leftIdx;
                            // Determine interactivity and fill color.
                            let interactive = !isPaired && !(activePoint && activePoint.edgeIdx !== ei);

                            // If translate or glide mode is active, only allow top and right edges to be interactive
                            if (transformType === 'translate' || transformType === 'glide') {
                              interactive = (ei === topIdx || ei === rightIdx) && !(activePoint && activePoint.edgeIdx !== ei);
                            }

                            // In 90° rotation mode, left edge should NOT be interactive
                            if (transformType === 'rotate90' && ei === leftIdx) {
                              interactive = false;
                            }

                            // Fill color rules: interactive -> blue; non-interactive left/bottom/paired -> orange; fallback gray
                            let fill = '#6366f1';
                            if (interactive) {
                              fill = '#2563eb';
                            } else if (ei === leftIdx || ei === driven || isPaired) {
                              fill = '#f59e0b';
                            }

                            return (
                              <motion.circle
                                key={pointIdx}
                                cx={p.x}
                                cy={p.y}
                                r={activePoint?.edgeIdx === ei && activePoint?.pointIdx === pointIdx ? 12 : 8}
                                initial={false}
                                animate={{ r: activePoint?.edgeIdx === ei && activePoint?.pointIdx === pointIdx ? 12 : 8, fill }}
                                className={`stroke-white stroke-[3px] shadow-lg ${
                                  !interactive ? 'pointer-events-none cursor-default' :
                                  activePoint && activePoint.edgeIdx !== ei ? 'pointer-events-none opacity-50 cursor-default' :
                                  'cursor-move'
                                }`}
                                onMouseDown={!interactive ? undefined : () => handleMouseDown(ei, pointIdx)}
                                onTouchStart={!interactive ? undefined : () => handleMouseDown(ei, pointIdx)}
                              />
                            );
                          })}
                        </g>
                      );
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
                  <button onClick={stopDemo} className="px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600">종료</button>
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
                  <button onClick={prevSquareStep} className="px-3 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200">이전</button>
                  <button onClick={nextSquareStep} className="px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">다음</button>
                  <button onClick={stopSquareDemo} className="px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600">종료</button>
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
              onClick={() => { if (shapeType === 'triangle') startDemo(); else if (shapeType === 'square') startSquareDemo(); }}
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
