import React from 'react';

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

export default function Rectangle({ tilePathData, colorA, colorB, RADIUS, CENTER, range = 12, triSymmetry = 'cw', transformType = 'rotate90' }: Props) {
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
          // Render a 4-piece patch at each cell using A,B,B,A ordering
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
  const driven = 3; // bottom edge

  // When the top edge is edited
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
