import React from 'react';

interface Props {
  tilePathData: string;
  colorA: string;
  colorB: string;
  RADIUS: number;
  CENTER: number;
  range?: number;
  triSymmetry?: 'cw' | 'ccw';
}

export default function Rectangle({ tilePathData, colorA, colorB, RADIUS, CENTER, range = 12, triSymmetry = 'cw' }: Props) {
  const tiles: React.ReactNode[] = [];
  const side = RADIUS * Math.sqrt(2);
  for (let r = -range; r < range; r++) {
    for (let c = -range; c < range; c++) {
      const tx = c * side - CENTER;
      const ty = r * side - CENTER;
      // Keep rotation pattern compatible with triSymmetry: for 'cw' use (r+c),
      // for 'ccw' invert column parity so mirrored tiling matches editor expectation.
      const rotBase = triSymmetry === 'cw' ? (r + c) : (r - c);
      const rot = (rotBase % 4) * 90;
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
  return <>{tiles}</>;
}
