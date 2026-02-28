// Square.tsx
// Renders tiled square assemblies and provides square-specific helpers:
// - `applySquareEdit`: enforces pairing/mirroring/translation rules for square edges
//   depending on `transformType` ('rotate90' | 'translate' | 'glide').
// - `renderSquareControls`: draws control points and sets their interactive rules
//   (driven/paired/interactive) to match the current transform mode.
// - `buildSquareDemoTiles`: constructs the demo assembly steps and reveal
//   sequencing used by the main App demo controls.
// All functions assume the tile path (`tilePathData`) is already computed by App.
import React from 'react';
import { motion } from 'motion/react';

interface Props {
  tilePathData: string;
  colorA: string;
  colorB: string;
  RADIUS: number;
  CENTER: number;
  range?: number;
  triSymmetry?: 'cw' | 'ccw';
  transformType?: 'rotate90' | 'translate' | 'glide';
}

export default function Square({ tilePathData, colorA, colorB, RADIUS, CENTER, range = 12, triSymmetry = 'cw', transformType = 'rotate90' }: Props) {
  // Build base square vertices (matching App.getBaseVertices for square)
  const sides = 4;
  const startAngle = -Math.PI / 4;
  const baseVertices: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = startAngle + (i * 2 * Math.PI) / sides;
    baseVertices.push({ x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) });
  }

  // pivot = bottom-right vertex (max x+y)
  let pivot = baseVertices[0];
  let maxSum = pivot.x + pivot.y;
  for (const v of baseVertices) {
    const s = v.x + v.y;
    if (s > maxSum) { pivot = v; maxSum = s; }
  }

  const rotatePoint = (p: { x: number; y: number }, angleDeg: number, cx: number, cy: number) => {
    const a = (angleDeg * Math.PI) / 180;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const rx = Math.cos(a) * dx - Math.sin(a) * dy;
    const ry = Math.sin(a) * dx + Math.cos(a) * dy;
    return { x: cx + rx, y: cy + ry };
  };

  // Compute bounding box of the assembled patch (consider rotation only when appropriate)
  // This bounding box is used to pick spacing when tiling a patch across
  // the plane. For translate/glide we simply use the single-tile bbox; for
  // rotation-based assemblies we simulate rotating vertices about the pivot to
  // get the full extents of the assembled patch.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const angles = transformType === 'translate' ? [0] : [0, 90, 180, 270];
  // For glide mode we do not assemble by rotation; use single tile bbox
  if (transformType === 'glide' || transformType === 'translate') {
    for (const v of baseVertices) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }
  } else {
    for (let k = 0; k < angles.length; k++) {
      const angle = angles[k];
      for (const v of baseVertices) {
        const rp = rotatePoint(v, angle, pivot.x, pivot.y);
        if (rp.x < minX) minX = rp.x;
        if (rp.y < minY) minY = rp.y;
        if (rp.x > maxX) maxX = rp.x;
        if (rp.y > maxY) maxY = rp.y;
      }
    }
  }

  // Fallback to single-tile step if bbox calculation fails
  const width = (isFinite(maxX) && isFinite(minX)) ? Math.max(1, maxX - minX) : RADIUS * Math.SQRT2;
  const height = (isFinite(maxY) && isFinite(minY)) ? Math.max(1, maxY - minY) : RADIUS * Math.SQRT2;

  // Also compute explicit base tile size for translate patch offsets
  let baseMinX = Infinity, baseMinY = Infinity, baseMaxX = -Infinity, baseMaxY = -Infinity;
  for (const v of baseVertices) {
    if (v.x < baseMinX) baseMinX = v.x;
    if (v.y < baseMinY) baseMinY = v.y;
    if (v.x > baseMaxX) baseMaxX = v.x;
    if (v.y > baseMaxY) baseMaxY = v.y;
  }
  const baseW = Math.max(1, baseMaxX - baseMinX);
  const baseH = Math.max(1, baseMaxY - baseMinY);

  const tiles: React.ReactNode[] = [];
  // Use patch-size spacing (2× base tile) for translate/glide to match demo patch spacing
  const stepX = (transformType === 'translate' || transformType === 'glide') ? baseW * 2 : width;
  const stepY = (transformType === 'translate' || transformType === 'glide') ? baseH * 2 : height;
  for (let r = -range; r < range; r++) {
    for (let c = -range; c < range; c++) {
      const tx = c * stepX - CENTER;
      const ty = r * stepY - CENTER;
      // For each assembly cell, render rotated copies about the pivot unless translate-only mode
      if (transformType === 'glide') {
        // Build 4-piece glide patch and render it with translations + reflections
        const guideCx = baseVertices.reduce((s, v) => s + v.x, 0) / baseVertices.length;
        const guideCy = baseVertices.reduce((s, v) => s + v.y, 0) / baseVertices.length;
        const glidePieces = [
          // piece offsets use single tile spacing (base tile) — unified background fill A,B,B,A
          { dx: 0, dy: 0, flipH: false, flipV: false, fill: colorA },
          { dx: 0, dy: -height, flipH: true, flipV: false, fill: colorB },
          { dx: -width, dy: 0, flipH: false, flipV: true, fill: colorB },
          { dx: -width, dy: -height, flipH: true, flipV: true, fill: colorA },
        ];
        for (let ai = 0; ai < glidePieces.length; ai++) {
          const p = glidePieces[ai];
          let t = `translate(${tx + p.dx}, ${ty + p.dy})`;
          if (p.flipH || p.flipV) {
            const sx = p.flipH ? -1 : 1;
            const sy = p.flipV ? -1 : 1;
            t += ` translate(${guideCx}, ${guideCy}) scale(${sx}, ${sy}) translate(${-guideCx}, ${-guideCy})`;
          }
          tiles.push(
            <path
              key={`sq-${r}-${c}-g-${ai}`}
              d={tilePathData}
              transform={t}
              fill={p.fill}
              stroke="#000"
              strokeWidth="0.5"
            />
          );
        }
      } else {
        if (transformType === 'translate') {
          // Render a 4-piece patch at each cell using A,B,A,B ordering
          const patchOffsets = [
            { dx: 0, dy: 0, fill: colorA },
            { dx: 0, dy: -baseH, fill: colorB },
            { dx: -baseW, dy: -baseH, fill: colorA },
            { dx: -baseW, dy: 0, fill: colorB },
          ];
          for (let pi = 0; pi < patchOffsets.length; pi++) {
            const off = patchOffsets[pi];
            tiles.push(
              <path
                key={`sq-${r}-${c}-t-${pi}`}
                d={tilePathData}
                transform={`translate(${tx + off.dx}, ${ty + off.dy})`}
                fill={off.fill}
                stroke="#000"
                strokeWidth="0.5"
              />
            );
          }
        } else {
          const renderAngles = angles;
          for (let ai = 0; ai < renderAngles.length; ai++) {
            const angle = renderAngles[ai];
            const wedgeFill = (ai % 2 === 0) ? colorA : colorB;
            tiles.push(
              <path
                key={`sq-${r}-${c}-${ai}`}
                d={tilePathData}
                transform={`translate(${tx}, ${ty}) rotate(${angle}, ${pivot.x}, ${pivot.y})`}
                fill={wedgeFill}
                stroke="#000"
                strokeWidth="0.5"
              />
            );
          }
        }
      }
    }
  }

  return <>{tiles}</>;
}

export type Point = { x: number; y: number };

export function applySquareEdit(newPaths: Record<number, Point[]>, activePoint: { edgeIdx: number; pointIdx: number } | null, baseVertices: Point[], triSymmetry: 'cw' | 'ccw', transformType: 'rotate90' | 'translate' | 'glide', CENTER: number) {
  if (!activePoint) return newPaths;
  // Edge indices (with startAngle -PI/4): 0=right,1=top,2=left,3=bottom
  // `driven` is the edge that is treated as the user-editable primary edge
  // (bottom edge in this layout). Other edges are updated based on the
  // configured `transformType` to preserve tiling rules.
  const driven = 3; // bottom edge

  // When the top edge is edited
  // Behavior depends on `transformType`:
  // - `translate`: move bottom edge by the same delta as the top midpoint
  // - `glide`: compute mirrored point across the tile guide centroid and
  //   then project/reflect onto the bottom edge line to produce a glide
  //   reflection mapping
  // - `rotate90`: compute the 90° rotated offset and apply it to the
  //   corresponding right/left edge midpoint
  if (activePoint.edgeIdx === 1) {
    const topIdx = 1;
    if (transformType === 'translate') {
      const tv0 = baseVertices[topIdx];
      const tv1 = baseVertices[(topIdx + 1) % 4];
      const tmx = (tv0.x + tv1.x) / 2;
      const tmy = (tv0.y + tv1.y) / 2;
      const tcp = newPaths[topIdx][0];
      const tvx = tcp.x - tmx;
      const tvy = tcp.y - tmy;

      const bottomIdx = driven;
      const bv0 = baseVertices[bottomIdx];
      const bv1 = baseVertices[(bottomIdx + 1) % 4];
      const bmx = (bv0.x + bv1.x) / 2;
      const bmy = (bv0.y + bv1.y) / 2;
      newPaths[bottomIdx] = [{ x: bmx + tvx, y: bmy + tvy }];
    } else if (transformType === 'glide') {
      const tcp = newPaths[topIdx][0];
      const bottomIdx = driven;
      const guideCx = baseVertices.reduce((s, v) => s + v.x, 0) / baseVertices.length;
      const guideCy = baseVertices.reduce((s, v) => s + v.y, 0) / baseVertices.length;
      const mirrored = { x: 2 * guideCx - tcp.x, y: 2 * guideCy - tcp.y };

      const bv0 = baseVertices[bottomIdx];
      const bv1 = baseVertices[(bottomIdx + 1) % 4];
      const ax = bv0.x, ay = bv0.y;
      const bx = bv1.x, by = bv1.y;
      const abx = bx - ax, aby = by - ay;
      const abLen2 = (abx * abx + aby * aby) || 1;
      const apx = mirrored.x - ax, apy = mirrored.y - ay;
      const t = (apx * abx + apy * aby) / abLen2;
      const projx = ax + t * abx;
      const projy = ay + t * aby;
      const reflectX = 2 * projx - mirrored.x;
      const reflectY = 2 * projy - mirrored.y;
      newPaths[bottomIdx] = [{ x: reflectX, y: reflectY }];
    } else {
      const rightIdx = triSymmetry === 'cw' ? 0 : 2;
      const tv0 = baseVertices[topIdx];
      const tv1 = baseVertices[(topIdx + 1) % 4];
      const tmx = (tv0.x + tv1.x) / 2;
      const tmy = (tv0.y + tv1.y) / 2;
      const tcp = newPaths[topIdx][0];
      const tvx = tcp.x - tmx;
      const tvy = tcp.y - tmy;
      const trad = Math.PI / 2;
      const trx = Math.cos(trad) * tvx - Math.sin(trad) * tvy;
      const try_ = Math.sin(trad) * tvx + Math.cos(trad) * tvy;

      const rp0 = baseVertices[rightIdx];
      const rp1 = baseVertices[(rightIdx + 1) % 4];
      const rmx = (rp0.x + rp1.x) / 2;
      const rmy = (rp0.y + rp1.y) / 2;
      newPaths[rightIdx] = [{ x: rmx + trx, y: rmy + try_ }];
    }
  }

  // If the user drags the right edge
  // For translate/glide, propagate the same delta or mirrored projection
  // to the opposite (left) edge so the patch remains consistent.
  const rightIdxForTranslate = triSymmetry === 'cw' ? 0 : 2;
  const leftIdx = 2;
  if (activePoint.edgeIdx === rightIdxForTranslate) {
    if (transformType === 'translate') {
      const rp0 = baseVertices[rightIdxForTranslate];
      const rp1 = baseVertices[(rightIdxForTranslate + 1) % 4];
      const rmx = (rp0.x + rp1.x) / 2;
      const rmy = (rp0.y + rp1.y) / 2;
      const rcp = newPaths[rightIdxForTranslate][0];
      const rvx = rcp.x - rmx;
      const rvy = rcp.y - rmy;

      const lv0 = baseVertices[leftIdx];
      const lv1 = baseVertices[(leftIdx + 1) % 4];
      const lmx = (lv0.x + lv1.x) / 2;
      const lmy = (lv0.y + lv1.y) / 2;
      newPaths[leftIdx] = [{ x: lmx + rvx, y: lmy + rvy }];
    } else if (transformType === 'glide') {
      const rcp = newPaths[rightIdxForTranslate][0];
      const guideCx = baseVertices.reduce((s, v) => s + v.x, 0) / baseVertices.length;
      const guideCy = baseVertices.reduce((s, v) => s + v.y, 0) / baseVertices.length;
      const mirrored = { x: 2 * guideCx - rcp.x, y: 2 * guideCy - rcp.y };

      const lv0 = baseVertices[leftIdx];
      const lv1 = baseVertices[(leftIdx + 1) % 4];
      const ax = lv0.x, ay = lv0.y;
      const bx = lv1.x, by = lv1.y;
      const abx = bx - ax, aby = by - ay;
      const abLen2 = (abx * abx + aby * aby) || 1;
      const apx = mirrored.x - ax, apy = mirrored.y - ay;
      const t = (apx * abx + apy * aby) / abLen2;
      const projx = ax + t * abx;
      const projy = ay + t * aby;
      const reflectX = 2 * projx - mirrored.x;
      const reflectY = 2 * projy - mirrored.y;
      newPaths[leftIdx] = [{ x: reflectX, y: reflectY }];
    }
  }

  // When the bottom edge (driven) is edited, update the left edge midpoint
  // The driven edge movement is interpreted in terms of along-edge parameter t
  // and normal offset d; we rotate that offset by 90° to compute the left
  // edge midpoint delta so the assembled patch preserves local continuity.
  if (activePoint.edgeIdx === driven) {
    const leftIdx = 2;
    const bv0 = baseVertices[driven];
    const bv1 = baseVertices[(driven + 1) % 4];
    const bmx = (bv0.x + bv1.x) / 2;
    const bmy = (bv0.y + bv1.y) / 2;
    const drivenPts = newPaths[driven];
    if (drivenPts && drivenPts.length > 0) {
      let cp = drivenPts[0];
      if (drivenPts.length >= 2) cp = { x: (drivenPts[0].x + drivenPts[1].x) / 2, y: (drivenPts[0].y + drivenPts[1].y) / 2 };
      const dvx = cp.x - bmx;
      const dvy = cp.y - bmy;
      const ang = Math.PI / 2;
      const lx = Math.cos(ang) * dvx - Math.sin(ang) * dvy;
      const ly = Math.sin(ang) * dvx + Math.cos(ang) * dvy;
      const lv0 = baseVertices[leftIdx];
      const lv1 = baseVertices[(leftIdx + 1) % 4];
      const lmx = (lv0.x + lv1.x) / 2;
      const lmy = (lv0.y + lv1.y) / 2;
      newPaths[leftIdx] = [{ x: lmx + lx, y: lmy + ly }];
    }
  }

  return newPaths;
}

export function renderSquareControls(params: {
  ei: number;
  points: Point[];
  activePoint: { edgeIdx: number; pointIdx: number } | null;
  triSymmetry: 'cw' | 'ccw';
  transformType: 'rotate90' | 'translate' | 'glide';
  handleMouseDown: (edgeIdx: number, pointIdx: number) => void;
}) {
  const { ei, points, activePoint, triSymmetry, transformType, handleMouseDown } = params;
  const driven = 3; // bottom edge
  const paired = triSymmetry === 'cw' ? (driven + 1) % 4 : (driven + 3) % 4;
  const leftIdx = 2;
  const topIdx = 1;
  const rightIdx = triSymmetry === 'cw' ? 0 : 2;

  return (
    <g key={String(ei)}>
      {points.map((p, pointIdx) => {
        const isDriven = ei === driven;
        const isPaired = ei === paired;
        const isLeft = ei === leftIdx;
        let interactive = !isPaired && !(activePoint && activePoint.edgeIdx !== ei);

        if (transformType === 'translate' || transformType === 'glide') {
          interactive = (ei === topIdx || ei === rightIdx) && !(activePoint && activePoint.edgeIdx !== ei);
        }
        if (transformType === 'rotate90' && ei === leftIdx) interactive = false;

        let fill = '#6366f1';
        if (interactive) fill = '#2563eb';
        else if (ei === leftIdx || ei === driven || isPaired) fill = '#f59e0b';

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

export function buildSquareDemoTiles(params: {
  squareDemoMode: boolean;
  squareDemoStep: number;
  tilePathData: string;
  baseVertices: Point[];
  colorA: string;
  colorB: string;
  transformType: 'rotate90' | 'translate' | 'glide';
  RADIUS: number;
}) : React.ReactNode[] | null {
  const { squareDemoMode, squareDemoStep, tilePathData, baseVertices, colorA, colorB, transformType, RADIUS } = params;
  if (!squareDemoMode) return null;
  if (!baseVertices || baseVertices.length === 0) return null;

  // pivot = top-left vertex (min x+y) — demo uses top-left for clarity
  let pivot = baseVertices[0];
  for (const v of baseVertices) {
    if (v.x + v.y < pivot.x + pivot.y) pivot = v;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const rotatePoint = (p: { x: number; y: number }, angleDeg: number, cx: number, cy: number) => {
    const a = (angleDeg * Math.PI) / 180;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const rx = Math.cos(a) * dx - Math.sin(a) * dy;
    const ry = Math.sin(a) * dx + Math.cos(a) * dy;
    return { x: cx + rx, y: cy + ry };
  };

  if (transformType === 'translate' || transformType === 'glide') {
    for (const v of baseVertices) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }
  } else {
    for (let k = 0; k < 4; k++) {
      const angle = k * 90;
      for (const v of baseVertices) {
        const rp = rotatePoint(v, angle, pivot.x, pivot.y);
        if (rp.x < minX) minX = rp.x;
        if (rp.y < minY) minY = rp.y;
        if (rp.x > maxX) maxX = rp.x;
        if (rp.y > maxY) maxY = rp.y;
      }
    }
  }

  const width = (isFinite(maxX) && isFinite(minX)) ? Math.max(1, maxX - minX) : RADIUS * Math.SQRT2;
  const height = (isFinite(maxY) && isFinite(minY)) ? Math.max(1, maxY - minY) : RADIUS * Math.SQRT2;

  let baseMinX = Infinity, baseMinY = Infinity, baseMaxX = -Infinity, baseMaxY = -Infinity;
  for (const v of baseVertices) {
    if (v.x < baseMinX) baseMinX = v.x;
    if (v.y < baseMinY) baseMinY = v.y;
    if (v.x > baseMaxX) baseMaxX = v.x;
    if (v.y > baseMaxY) baseMaxY = v.y;
  }
  const baseW = Math.max(1, baseMaxX - baseMinX);
  const baseH = Math.max(1, baseMaxY - baseMinY);
  const patchW = baseW * 2;
  const patchH = baseH * 2;

  const arr: React.ReactNode[] = [];

  if (transformType === 'translate' || transformType === 'glide') {
    const offsets: {dx:number, dy:number, fill:string}[] = [];
    offsets.push({ dx: 0, dy: 0, fill: colorA });
    if (squareDemoStep >= 2) offsets.push({ dx: 0, dy: -height, fill: colorB });
    if (squareDemoStep >= 3) offsets.push({ dx: -width, dy: -height, fill: colorA });
    if (squareDemoStep >= 4) offsets.push({ dx: -width, dy: 0, fill: colorB });

    for (let i = 0; i < offsets.length; i++) {
      const { dx, dy, fill } = offsets[i];
      if (transformType === 'translate') {
        arr.push(
          <path key={`sqdemo-center-patch-${i}`} d={tilePathData} transform={`translate(${dx}, ${dy})`} fill={fill} fillOpacity={1} stroke="#000" strokeWidth={0.5} />
        );
      } else {
        const guideCx = baseVertices.reduce((s, v) => s + v.x, 0) / baseVertices.length;
        const guideCy = baseVertices.reduce((s, v) => s + v.y, 0) / baseVertices.length;
        const glidePieces = [
          { dx: 0, dy: 0, flipH: false, flipV: false, fill: colorA },
          { dx: 0, dy: -height, flipH: true, flipV: false, fill: colorB },
          { dx: -width, dy: 0, flipH: false, flipV: true, fill: colorB },
          { dx: -width, dy: -height, flipH: true, flipV: true, fill: colorA },
        ];
        const p = glidePieces[i];
        let t = `translate(${p.dx}, ${p.dy})`;
        if (p.flipH || p.flipV) {
          const sx = p.flipH ? -1 : 1;
          const sy = p.flipV ? -1 : 1;
          t += ` translate(${guideCx}, ${guideCy}) scale(${sx}, ${sy}) translate(${-guideCx}, ${-guideCy})`;
        }
        arr.push(<path key={`sqdemo-center-patch-${i}`} d={tilePathData} transform={t} fill={p.fill} fillOpacity={1} stroke="#000" strokeWidth={0.5} />);
      }
    }
  } else {
    const n = Math.min(4, Math.max(1, squareDemoStep));
    for (let k = 0; k < n; k++) {
      const angle = k * 90;
      const wedgeFill = (k % 2 === 0) ? colorA : colorB;
      arr.push(<path key={`sqdemo-center-${k}`} d={tilePathData} transform={`rotate(${angle}, ${pivot.x}, ${pivot.y})`} fill={wedgeFill} fillOpacity={1} stroke="#000" strokeWidth={0.5} />);
    }
  }

  if (squareDemoStep > 4) {
    const range = 4;
    const centers: {cx:number, cy:number}[] = [];
    const spacingX = patchW;
    const spacingY = patchH;
    for (let r = -range; r <= range; r++) {
      for (let c = -range; c <= range; c++) {
        const cx = c * spacingX;
        const cy = r * spacingY;
        if (Math.abs(cx) < 1e-6 && Math.abs(cy) < 1e-6) continue;
        centers.push({ cx, cy });
      }
    }
    centers.sort((a,b) => (Math.hypot(a.cx, a.cy) - Math.hypot(b.cx, b.cy)));

    const requested = squareDemoStep - 4;
    const reveal = (requested >= 9) ? centers.length : Math.min(centers.length, requested);
    for (let i = 0; i < reveal; i++) {
      const { cx, cy } = centers[i];
      const tx = cx - 0;
      const ty = cy - 0;
      if (transformType === 'translate' || transformType === 'glide') {
        if (transformType === 'translate') {
          const patchOffsets: {dx:number, dy:number, fill:string}[] = [];
          patchOffsets.push({ dx: 0, dy: 0, fill: colorA });
          patchOffsets.push({ dx: 0, dy: -baseH, fill: colorB });
          patchOffsets.push({ dx: -baseW, dy: -baseH, fill: colorA });
          patchOffsets.push({ dx: -baseW, dy: 0, fill: colorB });
          const includeCount = Math.min(patchOffsets.length, Math.max(1, squareDemoStep));
          for (let j = 0; j < includeCount; j++) {
            const off = patchOffsets[j];
            arr.push(<path key={`sqdemo-${i}-patch-${j}`} d={tilePathData} transform={`translate(${tx + off.dx}, ${ty + off.dy})`} fill={off.fill} fillOpacity={1} stroke="#000" strokeWidth={0.5} />);
          }
        } else {
          const glidePieces = [
            { dx: 0, dy: 0, flipH: false, flipV: false, fill: colorA },
            { dx: 0, dy: -baseH, flipH: true,  flipV: false, fill: colorB },
            { dx: -baseW, dy: 0, flipH: false, flipV: true,  fill: colorB },
            { dx: -baseW, dy: -baseH, flipH: true, flipV: true,  fill: colorA },
          ];
          const guideCx = baseVertices.reduce((s, v) => s + v.x, 0) / baseVertices.length;
          const guideCy = baseVertices.reduce((s, v) => s + v.y, 0) / baseVertices.length;
          const includeCount = Math.min(glidePieces.length, Math.max(1, squareDemoStep));
          for (let j = 0; j < includeCount; j++) {
            const off = glidePieces[j];
            let t = `translate(${tx + off.dx}, ${ty + off.dy})`;
            if (off.flipH || off.flipV) {
              const sx = off.flipH ? -1 : 1;
              const sy = off.flipV ? -1 : 1;
              t += ` translate(${guideCx}, ${guideCy}) scale(${sx}, ${sy}) translate(${-guideCx}, ${-guideCy})`;
            }
            arr.push(<path key={`sqdemo-${i}-patch-${j}`} d={tilePathData} transform={t} fill={off.fill} fillOpacity={1} stroke="#000" strokeWidth={0.5} />);
          }
        }
      } else {
        for (let k = 0; k < 4; k++) {
          const angle = k * 90;
          const wedgeFill = (k % 2 === 0) ? colorA : colorB;
          arr.push(<path key={`sqdemo-${i}-${k}`} d={tilePathData} transform={`translate(${tx}, ${ty}) rotate(${angle}, ${pivot.x}, ${pivot.y})`} fill={wedgeFill} fillOpacity={1} stroke="#000" strokeWidth={0.5} />);
        }
      }
    }
  }

  arr.push(
    <g key="sqdemo-pivot" pointerEvents="none">
      <circle cx={pivot.x} cy={pivot.y} r={8} fill="#ef4444" stroke="#fff" strokeWidth={2} />
      <circle cx={pivot.x} cy={pivot.y} r={4} fill="#fff" />
      <text x={pivot.x + 12} y={pivot.y + 4} fontSize={12} fill="#111" fontWeight={600}>기준점</text>
    </g>
  );

  return arr;
}

export function startSquareDemo(params: {
  setShapeType: (s: 'triangle' | 'square' | 'hexagon') => void;
  setSquareDemoMode: React.Dispatch<React.SetStateAction<boolean>>;
  setSquareDemoStep: React.Dispatch<React.SetStateAction<number>>;
  setShowEditor: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { setShapeType, setSquareDemoMode, setSquareDemoStep, setShowEditor } = params;
  setShapeType('square');
  setSquareDemoMode(true);
  setSquareDemoStep(1);
  try { setShowEditor(false); } catch (e) {}
}

export function stopSquareDemo(params: {
  setSquareDemoMode: React.Dispatch<React.SetStateAction<boolean>>;
  setSquareDemoStep: React.Dispatch<React.SetStateAction<number>>;
  squareDemoIntervalRef: React.MutableRefObject<number | null>;
}) {
  const { setSquareDemoMode, setSquareDemoStep, squareDemoIntervalRef } = params;
  setSquareDemoMode(false);
  setSquareDemoStep(0);
  if (squareDemoIntervalRef.current) {
    window.clearInterval(squareDemoIntervalRef.current);
    squareDemoIntervalRef.current = null;
  }
}

export function nextSquareStep(setter: React.Dispatch<React.SetStateAction<number>>) {
  setter(s => Math.min(s + 1, 4 + 80));
}

export function prevSquareStep(setter: React.Dispatch<React.SetStateAction<number>>) {
  setter(s => Math.max(s - 1, 1));
}

export function getSquareDemoText(step: number, transformType: 'rotate90' | 'translate' | 'glide') {
  if (step <= 0) return '데모 준비 중... (다음 버튼을 눌러 시작하세요)';
  if (transformType === 'translate') {
    if (step === 1) return '기본 도형을 표시합니다.';
    const add = Math.max(0, step - 1);
    return `주변을 평행이동으로 채웁니다 — #${add}`;
  }
  if (transformType === 'glide') {
    if (step === 1) return '기본 도형을 표시합니다.';
    if (step === 2) return '미끄럼 반사로 위에 붙입니다.';
    if (step === 3) return '미끄럼 반사로 왼쪽에 붙입니다.';
    if (step === 4) return '미끄럼 반사로 위 왼쪽에 붙입니다.';
    const add = step - 4;
    return `주변을 평행이동으로 채웁니다 — #${add}`;
  }
  if (step === 1) return '기본 도형을 표시합니다.';
  if (step === 2) return '기준점을 기준으로 90도 회전합니다.';
  if (step === 3) return '기준점을 기준으로 180도 회전합니다.';
  if (step === 4) return '기준점을 기준으로 270도 회전합니다.';
  const add = step - 4;
  return `주변을 평행이동으로 채웁니다 — #${add}`;
}
