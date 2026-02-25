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

  // Fallback to single-tile step if bbox calculation fails
  const width = (isFinite(maxX) && isFinite(minX)) ? Math.max(1, maxX - minX) : RADIUS * Math.SQRT2;
  const height = (isFinite(maxY) && isFinite(minY)) ? Math.max(1, maxY - minY) : RADIUS * Math.SQRT2;

  const tiles: React.ReactNode[] = [];
  for (let r = -range; r < range; r++) {
    for (let c = -range; c < range; c++) {
      const tx = c * width - CENTER;
      const ty = r * height - CENTER;
      // For each assembly cell, render rotated copies about the pivot unless translate-only mode
      const renderAngles = angles;
      for (let ai = 0; ai < renderAngles.length; ai++) {
        const angle = renderAngles[ai];
        tiles.push(
          <path
            key={`sq-${r}-${c}-${ai}`}
            d={tilePathData}
            transform={`translate(${tx}, ${ty}) rotate(${angle}, ${pivot.x}, ${pivot.y})`}
            fill={(r + c) % 2 === 0 ? colorA : colorB}
            stroke="#000"
            strokeWidth="0.5"
          />
        );
      }
    }
  }

  return <>{tiles}</>;
}
