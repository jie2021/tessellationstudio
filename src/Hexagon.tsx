import React from 'react';

interface Props {
  tilePathData: string;
  colorA: string;
  colorB: string;
  RADIUS: number;
  CENTER: number;
  range?: number;
}

export default function Hexagon({ tilePathData, colorA, colorB, RADIUS, CENTER, range = 12 }: Props) {
  const tiles: React.ReactNode[] = [];
  const stepX = RADIUS * 1.5;
  const stepY = Math.sqrt(3) * RADIUS;

  for (let r = -range; r < range; r++) {
    for (let c = -range; c < range; c++) {
      const worldX = c * stepX;
      const worldY = r * stepY + (Math.abs(c) % 2 !== 0 ? stepY / 2 : 0);
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

  return <>{tiles}</>;
}
