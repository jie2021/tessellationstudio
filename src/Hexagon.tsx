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
    // return projection and normal info for flexible mapping
    return { t, d, projx, projy, ndx, ndy };
  };

  // Determine paired edge index depending on transform type
  let paired = -1;
  // mappingMode controls whether the pairing acts as a translate or glide reflection
  let mappingMode: 'translate' | 'glide' | 'rotate120' = transformType === 'rotate120' ? 'rotate120' : transformType;
  if (transformType === 'rotate120') {
    // map odd -> previous even: 1->0,3->2,5->4
    if (ei % 2 === 1) paired = (ei + 5) % 6; else return newPaths;
  } else if (transformType === 'translate') {
    // translate: interactive edges remain 1,3,5 and pair with opposite edges
    if ([1,3,5].includes(ei)) paired = (ei + 3) % 6; else return newPaths;
  } else {
    // glide mode: use requested pairing
    // New pairing (visible edge numbers):
    // 2<->5 -> indices 1<->4 : translation
    // 3<->4 -> indices 2<->3 : glide reflection
    // 6<->1 -> indices 5<->0 : glide reflection
    // expose interactive controls on edges 2,3,6 (indices 1,2,5)
    if ([1,2,5].includes(ei)) {
      if (ei === 1) { paired = 4; mappingMode = 'translate'; }
      else if (ei === 2) { paired = 3; mappingMode = 'glide'; }
      else if (ei === 5) { paired = 0; mappingMode = 'glide'; }
    } else return newPaths;
  }

  const moved = pts[activePoint.pointIdx];
  const { t, d, projx, projy } = computeTD(ei, moved);

  // compute target base point on paired edge
  const pv0 = baseVertices[paired];
  const pv1 = baseVertices[(paired + 1) % 6];
  const pex = pv1.x - pv0.x, pey = pv1.y - pv0.y;
  const plen = Math.sqrt(pex*pex + pey*pey) || 1;
  // decide mapping depending on mappingMode
  if (mappingMode === 'rotate120') {
    // rotation pairing: heuristic mapping and flip side
    const tPaired = 1 - t;
    const dPaired = -d;
    const baseX = pv0.x + tPaired * pex;
    const baseY = pv0.y + tPaired * pey;
    const nx = -pey / plen; const ny = pex / plen;
    const target = { x: baseX + dPaired * nx, y: baseY + dPaired * ny };
    newPaths[paired] = [{ x: target.x, y: target.y }];
  } else if (mappingMode === 'translate') {
    // pure translation: compute the delta of the moved control relative
    // to the original midpoint of its edge, and apply that same delta
    // to the midpoint of the paired (opposite) edge — this matches
    // the square translate behavior (pure translation, no mirror)
    const mv0 = baseVertices[ei];
    const mv1 = baseVertices[(ei + 1) % 6];
    const movedBaseMidX = mv0.x + (mv1.x - mv0.x) * 0.5;
    const movedBaseMidY = mv0.y + (mv1.y - mv0.y) * 0.5;
    const deltaX = moved.x - movedBaseMidX;
    const deltaY = moved.y - movedBaseMidY;

    const pairedMidX = pv0.x + pex * 0.5;
    const pairedMidY = pv0.y + pey * 0.5;
    const target = { x: pairedMidX + deltaX, y: pairedMidY + deltaY };
    newPaths[paired] = [{ x: target.x, y: target.y }];
  } else if (mappingMode === 'glide') {
    // glide (reflection + translation): mirror across edge normal, preserve along-edge t
    const tPaired = t;
    const dPaired = -d;
    const baseX = pv0.x + tPaired * pex;
    const baseY = pv0.y + tPaired * pey;
    const nx = -pey / plen; const ny = pex / plen;
    const target = { x: baseX + dPaired * nx, y: baseY + dPaired * ny };
    newPaths[paired] = [{ x: target.x, y: target.y }];
  }
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

  // interactive edges vary by transform mode. For glide expose controls for edges 1,2,5
  // (user-visible edges 2,3,6) so pairs become 2<->5,3<->4,6<->1
  const interactiveEdges = transformType === 'glide' ? [1,2,5] : [1,3,5];
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
  
  const demoTiles: React.ReactNode[] = [];
  if (transformType==='rotate120') {
    if(!demoMode){
      demoStep = 80;
    }
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
  }else if (transformType === 'translate' ) {
    // Build a 3-piece patch by translating the base tile twice along
    // a chosen edge-direction, then tile that 3-piece patch across the
    // plane using the same spacing as rotate120 so the motif matches.
    if (!demoMode) demoStep = 80;

    // base vertices (centered at CENTER)
    const baseVertsT: { x: number; y: number }[] = [];
    const startAngleT = 0;
    for (let i = 0; i < 6; i++) {
      const angle = startAngleT + (i * 2 * Math.PI) / 6;
      baseVertsT.push({ x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) });
    }
    const pivotT = baseVertsT[5];

    // derive a translation vector from the midpoint of edge 0 (center-to-center)
    const centerX = CENTER;
    const centerY = CENTER;
    const m0x = (baseVertsT[0].x + baseVertsT[1].x) * 0.5;
    const m0y = (baseVertsT[0].y + baseVertsT[1].y) * 0.5;
    const m1x = (baseVertsT[1].x + baseVertsT[2].x) * 0.5;
    const m1y = (baseVertsT[1].y + baseVertsT[2].y) * 0.5;
    const v0x = 2 * (m0x - centerX);
    const v0y = 2 * (m0y - centerY);
    const v1x = 2 * (m1x - centerX);
    const v1y = 2 * (m1y - centerY);

    // piece offsets: base, translate along base-edge, translate along CCW-adjacent edge
    const pieceOffsets = [ [0,0], [v0x, v0y], [v1x, v1y] ];

    // show assembly at origin using centroid alignment so it matches tiled patches
    const avgOx = (pieceOffsets[0][0] + pieceOffsets[1][0] + pieceOffsets[2][0]) / 3;
    const avgOy = (pieceOffsets[0][1] + pieceOffsets[1][1] + pieceOffsets[2][1]) / 3;
    const piecesToShow = Math.min(3, Math.max(1, demoStep));
    for (let k = 0; k < piecesToShow; k++) {
      const ox = pieceOffsets[k][0];
      const oy = pieceOffsets[k][1];
      const tx = -avgOx + ox;
      const ty = -avgOy + oy;
      demoTiles.push(
        <path
          key={`hex-demo-center-${k}`}
          d={tilePathData}
          transform={`translate(${tx}, ${ty})`}
          fill={k % 2 === 0 ? colorA : colorB}
          stroke="#000"
          strokeWidth="0.5"
        />
      );
    }

    

    // after assembly steps, reveal translated patches across the same hex grid used by rotate120
    if (demoStep > 3) {
      const hexToShow = demoStep - 3;
      const s = RADIUS * 1.5;
      const stepX = s;
      const stepY = s * Math.sqrt(3) * 2;
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
      // compute centroid of piece offsets so we can place the patch
      const avgOx = (pieceOffsets[0][0] + pieceOffsets[1][0] + pieceOffsets[2][0]) / 3;
      const avgOy = (pieceOffsets[0][1] + pieceOffsets[1][1] + pieceOffsets[2][1]) / 3;
      for (let i = 0; i < reveal; i++) {
        const { cx, cy } = centers[i];
        for (let k = 0; k < 3; k++) {
          const ox = pieceOffsets[k][0];
          const oy = pieceOffsets[k][1];
          const tx = (cx + (ox - avgOx));
          const ty = cy + (oy - avgOy);
          demoTiles.push(
            <path
              key={`hex-demo-fill-${i}-${k}`}
              d={tilePathData}
              transform={`translate(${tx}, ${ty})`}
              fill={k % 2 === 0 ? colorA : colorB}
              stroke="#000"
              strokeWidth="0.5"
            />
          );
        }
      }
    }
  }else if (transformType === 'glide') {
    if (!demoMode) demoStep = 480;
    // 기본 조각으로 평행 이동만 해서 배경을 모두 채웁니다.
    // Compute lattice centers using opposite-edge directions (same as demo starter)
    const centerX = 0;
    const centerY = 0;
    const bv: { x: number; y: number }[] = [];
    const startAngle = 0;
    for (let i = 0; i < 6; i++) {
      const angle = startAngle + (i * 2 * Math.PI) / 6;
      bv.push({ x: centerX + RADIUS * Math.cos(angle), y: centerY + RADIUS * Math.sin(angle) });
    }
    const m0x = (bv[0].x + bv[1].x) * 0.5;
    const m0y = (bv[0].y + bv[1].y) * 0.5;
    const m1x = (bv[1].x + bv[2].x) * 0.5;
    const m1y = (bv[1].y + bv[2].y) * 0.5;
    // scale basis vectors so centers are spaced by full patch size
    const v0x = 2 * (m0x - centerX);
    const v0y = 2 * (m0y - centerY);
    const v1x = 2 * (m1x - centerX);
    const v1y = 2 * (m1y - centerY);

    const demoRange = 8;
    const centers: {cx:number, cy:number, col:number, row:number}[] = [];
    for (let row = -demoRange; row <= demoRange; row++) {
      for (let col = -demoRange; col <= demoRange; col++) {
        const hexCX = col * v0x + row * v1x;
        const hexCY = col * v0y + row * v1y;
        centers.push({ cx: hexCX, cy: hexCY, col, row });
      }
    }
    centers.sort((a,b) => (Math.hypot(a.cx, a.cy) - Math.hypot(b.cx, b.cy)));

    // render a single base tile at each center (tilePathData is centered at (CENTER,CENTER))
    // use centers[0] as the reference tile (#1)
    const refCol = centers[0]?.col ?? 0;
    const refRow = centers[0]?.row ?? 0;
    // decide which centers to render in demoMode. For glide demo we want a
    // custom reveal sequence: show tiles numbered 1,3,4,6 at demo steps 1..4
    // respectively (these are one-based indices into the distance-sorted
    // `centers` array). After step 4, fall back to revealing the first N.
    const selectedCenters: {cx:number, cy:number, col:number, row:number}[] = (() => {
      if (demoMode && typeof demoStep === 'number' && demoStep > 0) {
        if (demoStep >= 1 && demoStep <= 4) {
          const mapping = [0, 2, 3, 5]; // one-based 1,3,4,6 -> zero-based indices
          const indices = mapping.slice(0, demoStep).filter(i => i < centers.length);
          // preserve order and return the mapped centers cumulatively so earlier
          // revealed tiles remain visible as steps advance
          return indices.map(i => centers[i]);
        }
        const centersCount = Math.min(centers.length, demoStep);
        return centers.slice(0, centersCount);
      }
      return centers;
    })();

    for (let i = 0; i < selectedCenters.length; i++) {
      const { cx, cy, col, row } = selectedCenters[i];
      const tx = cx - CENTER;
      const ty = cy - CENTER;
      // compute hex-grid step distance to reference and use its parity for color
      const dx0 = col - refCol;
      const dy0 = row - refRow;
      const stepsForColor = Math.round((Math.abs(dx0) + Math.abs(dy0) + Math.abs(dx0 + dy0)) / 2);
      const bgFill = (stepsForColor % 2 === 1) ? colorA : colorB;
      // decide whether this column should be mirrored: odd columns (relative to ref) are mirrored
      const colOffset = col - refCol;
      const shouldMirror = Math.abs(colOffset) % 2 === 1;
      if (!shouldMirror) {
        demoTiles.push(
          <path
            key={`hex-demo-glide-bg-${i}`}
            d={tilePathData}
            transform={`translate(${tx}, ${ty})`}
            fill={bgFill}
            opacity={1}
            stroke="#000"
            strokeWidth="0.5"
          />
        );
      } else {
        // mirror horizontally about the tile center (vertical line at x = cx)
        // mapping derived so tile local point (x,y) -> (-x + (cx + CENTER + shiftX), y + cy - CENTER)
        // add a small rightward offset of RADIUS/3 for mirrored (odd) columns
        // achieved with: translate(-(cx + CENTER + shiftX), cy - CENTER) scale(-1,1)
        const shiftX = RADIUS / 3;
        const mirrorTransform = `translate(${-(cx + CENTER - shiftX)}, ${cy - CENTER}) scale(-1,1)`;
        demoTiles.push(
          <path
            key={`hex-demo-glide-bg-${i}`}
            d={tilePathData}
            transform={mirrorTransform}
            fill={bgFill}
            opacity={1}
            stroke="#000"
            strokeWidth="0.5"
          />
        );
      }
      // labels removed for glide demo (numeric index, pixel distance, axial steps)
    }
  }
  return <>{demoTiles}</>;
}
  


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
    // use translations along opposite-edge directions (no staggering)
    // compute base midpoints and derive two basis vectors (use origin)
    const centerX = 0;
    const centerY = 0;
    const bv: { x: number; y: number }[] = [];
    const startAngle = 0;
    for (let i = 0; i < 6; i++) {
      const angle = startAngle + (i * 2 * Math.PI) / 6;
      bv.push({ x: centerX + RADIUS * Math.cos(angle), y: centerY + RADIUS * Math.sin(angle) });
    }
    const m0x = (bv[0].x + bv[1].x) * 0.5;
    const m0y = (bv[0].y + bv[1].y) * 0.5;
    const m1x = (bv[1].x + bv[2].x) * 0.5;
    const m1y = (bv[1].y + bv[2].y) * 0.5;
    // scale basis vectors by 3 so centers are spaced by full patch size
    const v0x = 3 * 2 * (m0x - centerX);
    const v0y = 3 * 2 * (m0y - centerY);
    const v1x = 3 * 2 * (m1x - centerX);
    const v1y = 3 * 2 * (m1y - centerY);
    const demoRange = 4;
    for (let row = -demoRange; row <= demoRange; row++) {
      for (let col = -demoRange; col <= demoRange; col++) {
        if (row === 0 && col === 0) continue;
        const hexCX = col * v0x + row * v1x;
        const hexCY = col * v0y + row * v1y;
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
    return `수평/수직 평행이동으로 채웁니다 — #${add}`;
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

