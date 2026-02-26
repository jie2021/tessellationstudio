import React from 'react';
import { motion } from 'motion/react';

export type Point = { x: number; y: number };

export function applyHexagonEdit(newPaths: Record<number, Point[]>, activePoint: { edgeIdx: number; pointIdx: number } | null, baseVertices: Point[], transformType: 'rotate120' | 'translate' | 'glide') {
  if (!activePoint) return newPaths;
  const ei = activePoint.edgeIdx;
  const pts = newPaths[ei];
  if (!pts || pts.length === 0) return newPaths;

  // helper to compute projection t and signed distance d from edge
  const computeTD = (edgeIdx: number, p: Point) => {
    const v0 = baseVertices[edgeIdx];
    const v1 = baseVertices[(edgeIdx + 1) % 6];
    const ex = v1.x - v0.x, ey = v1.y - v0.y;
    const len2 = ex*ex + ey*ey || 1;
    const t = ((p.x - v0.x) * ex + (p.y - v0.y) * ey) / len2;
    const projx = v0.x + t * ex;
    const projy = v0.y + t * ey;
    const nx = -ey; const ny = ex; // perpendicular (not normalized)
    const nlen = Math.sqrt(nx*nx + ny*ny) || 1;
    const ndx = nx / nlen; const ndy = ny / nlen;
    const d = (p.x - projx) * ndx + (p.y - projy) * ndy;
    return { t, d };
  };

  // Determine paired edge index depending on transform type
  let paired = -1;
  if (transformType === 'rotate120') {
    // map odd -> previous even: 1->0,3->2,5->4
    if (ei % 2 === 1) paired = (ei + 5) % 6; else return newPaths;
  } else {
    // translate/glide: control edges are 1,3,5 and paired are opposite edges (i+3)%6
    if ([1,3,5].includes(ei)) paired = (ei + 3) % 6; else return newPaths;
  }

  const moved = pts[activePoint.pointIdx];
  const { t, d } = computeTD(ei, moved);

  // compute target base point on paired edge
  const pv0 = baseVertices[paired];
  const pv1 = baseVertices[(paired + 1) % 6];
  const pex = pv1.x - pv0.x, pey = pv1.y - pv0.y;
  const plen = Math.sqrt(pex*pex + pey*pey) || 1;
  // decide t mapping
  let tPaired = t;
  let dPaired = d;
  if (transformType === 'rotate120') {
    tPaired = 1 - t; // heuristic mapping for rotation pairing
    dPaired = -d;    // flip side
  } else {
    // translate/glide: opposite edge, keep same t but invert normal
    tPaired = t;
    dPaired = -d;
  }

  const baseX = pv0.x + tPaired * pex;
  const baseY = pv0.y + tPaired * pey;
  const nx = -pey / plen; const ny = pex / plen;
  const target = { x: baseX + dPaired * nx, y: baseY + dPaired * ny };

  newPaths[paired] = [{ x: target.x, y: target.y }];
  return newPaths;
}

export function renderHexagonControls(params: {
  ei: number;
  points: Point[];
  activePoint: { edgeIdx: number; pointIdx: number } | null;
  transformType: 'rotate120' | 'translate' | 'glide';
  handleMouseDown: (edgeIdx: number, pointIdx: number) => void;
}) {
  const { ei, points, activePoint, transformType, handleMouseDown } = params;
  // Interactive control edges:
  // - rotate120: odd edges (1,3,5) are interactive; pairs are even edges (0,2,4)
  // - translate/glide: interactive edges are 1,3,5 and paired are opposite edges (i+3)%6

  const interactiveEdges = transformType === 'rotate120' ? [1,3,5] : [1,3,5];
  const isInteractiveEdge = interactiveEdges.includes(ei);

  return (
    <g key={String(ei)}>
      {points.map((p, pointIdx) => {
        // determine pairedness
        let isPaired = false;
        if (transformType === 'rotate120') {
          isPaired = (ei % 2 === 0); // even edges are paired/non-interactive
        } else {
          // for translate/glide, opposite edges are paired
          isPaired = !isInteractiveEdge;
        }

        let interactive = isInteractiveEdge && !isPaired;
        // Fill colors: interactive -> blue; paired/non-interactive -> orange; fallback gray
        let fill = '#6366f1';
        if (interactive) fill = '#2563eb';
        else if (isPaired) fill = '#f59e0b';

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

interface Props {
  tilePathData: string;
  colorA: string;
  colorB: string;
  RADIUS: number;
  CENTER: number;
  range?: number;
  transformType?: 'rotate120' | 'translate' | 'glide';
  demoMode?: boolean;
  demoStep?: number;
  demoCenters?: { cx: number; cy: number }[];
}

export default function Hexagon({ tilePathData, colorA, colorB, RADIUS, CENTER, range = 12, transformType, demoMode = false, demoStep = 0, demoCenters = [] }: Props) {
  // For background, if not in demo mode, show a large patch of tiles to illustrate the pattern
  if(!demoMode){
      demoStep = 80;
  }
  const demoTiles: React.ReactNode[] = [];
  // Recompute base vertices local to tile
  const baseVerts: { x: number; y: number }[] = [];
  const startAngle = 0;
  for (let i = 0; i < 6; i++) {
    const angle = startAngle + (i * 2 * Math.PI) / 6;
    baseVerts.push({ x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) });
  }
  const pivot = transformType === 'rotate120' ? baseVerts[5] : baseVerts[0];

  // center patch assembly at origin
  const tx0 = 0 - pivot.x;
  const ty0 = 0 - pivot.y;

  // show up to three rotated pieces
  const piecesToShow = Math.min(3, Math.max(1, demoStep));
  for (let k = 0; k < piecesToShow; k++) {
    const angle = k * 120; // clockwise rotations
    demoTiles.push(
      <path
        key={`hex-demo-center-${k}`}
        d={tilePathData}
        transform={`translate(${tx0}, ${ty0}) rotate(${angle}, ${pivot.x}, ${pivot.y})`}
        fill={k % 2 === 0 ? colorA : colorB}
        stroke="#000"
        strokeWidth="0.5"
      />
    );
  }

  // pivot marker during rotation explanation steps
  if (demoStep >= 1 && demoStep <= 3) {
    const pivotWorldX = pivot.x + tx0;
    const pivotWorldY = pivot.y + ty0;
    demoTiles.push(
      <g key={`hex-demo-pivot`} pointerEvents="none">
        <circle cx={pivotWorldX} cy={pivotWorldY} r={8} fill="#ef4444" stroke="#fff" strokeWidth={2} />
        <circle cx={pivotWorldX} cy={pivotWorldY} r={4} fill="#fff" />
        <text x={pivotWorldX + 12} y={pivotWorldY + 4} fontSize={12} fill="#111" fontWeight={600}>기준점</text>
      </g>
    );
  }

  // After assembling the 3-piece patch, reveal translations to fill surrounding tiles
  if (demoStep > 3) {
    const hexToShow = demoStep - 3;
    // Build hex grid centers (triangle-style) and pick nearest N
    const s = RADIUS * 1.5;
    const stepX = s ;
    const stepY = s * Math.sqrt(3)*2;
    const demoRange = 8;
    const centers: {cx:number, cy:number}[] = [];
    for (let row = -demoRange; row <= demoRange; row++) {
      for (let col = -demoRange; col <= demoRange; col++) {
        if (row === 0 && col === 0) continue;
        const hexCX = col * stepX;
        const hexCY = row * stepY + (col % 2 !== 0 ? stepY / 2 : 0);
        centers.push({ cx: hexCX, cy: hexCY });
      }
    }
    centers.sort((a,b) => (Math.hypot(a.cx, a.cy) - Math.hypot(b.cx, b.cy)));

    const reveal = Math.min(hexToShow, centers.length);
    for (let i = 0; i < reveal; i++) {
      const { cx, cy } = centers[i];
      const tx = cx - pivot.x;
      const ty = cy - pivot.y;
      // render the assembled 3-piece patch translated to center
      for (let k = 0; k < 3; k++) {
        const angle = k * 120;
        demoTiles.push(
          <path
            key={`hex-demo-fill-${i}-${k}`}
            d={tilePathData}
            transform={`translate(${tx}, ${ty}) rotate(${angle}, ${pivot.x}, ${pivot.y})`}
            fill={k % 2 === 0 ? colorA : colorB}
            stroke="#000"
            strokeWidth="0.5"
          />
        );
      }
    }
  }

  return <>{demoTiles}</>;
}

// (removed) buildHexagonDemoTiles: unused helper removed to reduce bundle size

export function startHexagonDemo(params: {
  setShapeType: (s: 'triangle' | 'square' | 'hexagon') => void;
  setDemoCenters: React.Dispatch<React.SetStateAction<{cx:number, cy:number}[]>>;
  setDemoMode: React.Dispatch<React.SetStateAction<boolean>>;
  setDemoStep: React.Dispatch<React.SetStateAction<number>>;
  demoIntervalRef: React.MutableRefObject<number | null>;
  RADIUS: number;
  transformType?: 'rotate120' | 'translate' | 'glide';
}) {
  const { setShapeType, setDemoCenters, setDemoMode, setDemoStep, demoIntervalRef, RADIUS, transformType } = params;
  setShapeType('hexagon');
  // For rotate120, only vertical translations: steps of 3 * side length (RADIUS)
  const centers: {cx:number, cy:number}[] = [];
  if (transformType === 'rotate120') {
    const step = 3 * RADIUS;
    const maxN = 20;
    for (let n = 1; n <= maxN; n++) {
      centers.push({ cx: 0, cy: -n * step });
      centers.push({ cx: 0, cy: n * step });
    }
    centers.sort((a,b) => (Math.abs(a.cy) - Math.abs(b.cy)));
  } else {
    const s = RADIUS * Math.sqrt(3);
    const stepX = s * 1.5;
    const stepY = s * Math.sqrt(3);
    const demoRange = 4;
    for (let row = -demoRange; row <= demoRange; row++) {
      for (let col = -demoRange; col <= demoRange; col++) {
        if (row === 0 && col === 0) continue;
        const hexCX = col * stepX;
        const hexCY = row * stepY + (col % 2 !== 0 ? stepY / 2 : 0);
        centers.push({cx: hexCX, cy: hexCY});
      }
    }
    centers.sort((a,b) => (Math.hypot(a.cx, a.cy) - Math.hypot(b.cx, b.cy)));
  }
  setDemoCenters(centers);
  setDemoMode(true);
  setDemoStep(1);
}

export function stopHexagonDemo(params: {
  setDemoMode: React.Dispatch<React.SetStateAction<boolean>>;
  setDemoStep: React.Dispatch<React.SetStateAction<number>>;
  demoIntervalRef: React.MutableRefObject<number | null>;
}) {
  const { setDemoMode, setDemoStep, demoIntervalRef } = params;
  setDemoMode(false);
  setDemoStep(0);
  if (demoIntervalRef.current) { window.clearInterval(demoIntervalRef.current); demoIntervalRef.current = null; }
}

export function nextHexagonStep(setter: React.Dispatch<React.SetStateAction<number>>) {
  setter(s => Math.min(s + 1, 3 + 80));
}

export function prevHexagonStep(setter: React.Dispatch<React.SetStateAction<number>>) {
  setter(s => Math.max(s - 1, 1));
}

export function getHexagonDemoText(step: number, transformType: 'rotate120' | 'translate' | 'glide') {
  if (step <= 0) return '데모 준비 중... (다음 버튼을 눌러 시작하세요)';
  if (transformType === 'translate') {
    if (step === 1) return '기본 도형을 표시합니다.';
    const add = Math.max(0, step - 1);
    return `주변을 평행이동으로 채웁니다 — #${add}`;
  }
  if (transformType === 'glide') {
    if (step === 1) return '기본 도형을 표시합니다.';
    if (step === 2) return '미끄럼 반사로 복사합니다.';
    const add = step - 2;
    return `주변을 평행이동으로 채웁니다 — #${add}`;
  }
  if (step === 1) return '기본 도형을 표시합니다.';
  if (step === 2) return '기준점을 기준으로 120도 회전합니다.';
  if (step === 3) return '기준점을 기준으로 240도 회전합니다.';
  const add = step - 3;
  return `주변을 평행이동으로 채웁니다 — #${add}`;
}

