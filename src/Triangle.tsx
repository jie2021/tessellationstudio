import React from 'react';

interface Center { cx: number; cy: number }

interface Props {
  tilePathData: string;
  colorA: string;
  colorB: string;
  RADIUS: number;
  CENTER: number;
  triSymmetry: 'cw' | 'ccw';
  demoMode: boolean;
  demoStep: number;
  demoCenters: Center[];
  range?: number;
}

export default function Triangle({ tilePathData, colorA, colorB, RADIUS, CENTER, triSymmetry, demoMode, demoStep, demoCenters, range = 12 }: Props) {
  const tiles: React.ReactNode[] = [];

  const hs = RADIUS * Math.sqrt(3) / 2;  // R√3/2
  const s  = RADIUS * Math.sqrt(3);       // side = R√3

  const pivotX = triSymmetry === 'cw' ? CENTER + hs : CENTER - hs;
  const pivotY = CENTER + RADIUS / 2;

  const stepX = s * 1.5;
  const stepY = s * Math.sqrt(3);

  const rotDir = triSymmetry === 'cw' ? 1 : -1;
  const wedgeColors = [colorA, colorB, colorA, colorB, colorA, colorB];

  if (demoMode) {
    const centerHexCX = 0;
    const centerHexCY = 0;
    const tx0 = centerHexCX - pivotX;
    const ty0 = centerHexCY - pivotY;

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
      const hexToShow = demoStep - 6;
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

  return <>{tiles}</>;
}
