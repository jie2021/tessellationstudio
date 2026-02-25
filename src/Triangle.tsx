import React from 'react';
import { motion } from 'motion/react';

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

export type Point = { x: number; y: number };

export function initTrianglePaths(baseVertices: Point[], RADIUS: number, triSymmetry: 'cw' | 'ccw') {
  const paths: Record<number, Point[]> = {};
  const driven = 1; // bottom edge
  const paired = triSymmetry === 'cw' ? (driven + 2) % 3 : (driven + 1) % 3;
  const spare = [0,1,2].find(x => x !== driven && x !== paired)!;

  const makeSymmetric = (a: Point, b: Point) => {
    const mmx = (a.x + b.x) / 2;
    const mmy = (a.y + b.y) / 2;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.sqrt(ex * ex + ey * ey) || 1;
    const nx = -ey / len;
    const ny = ex / len;
    const offset = Math.max(30, RADIUS * 0.12);
    return [
      { x: mmx + nx * offset, y: mmy + ny * offset },
      { x: mmx - nx * offset, y: mmy - ny * offset },
    ];
  };

  for (let i = 0; i < 3; i++) {
    const v1 = baseVertices[i];
    const v2 = baseVertices[(i + 1) % 3];
    const mx = (v1.x + v2.x) / 2;
    const my = (v1.y + v2.y) / 2;
    if (i === driven) {
      paths[i] = [{ x: mx, y: my }];
    } else if (i === spare) {
      paths[i] = makeSymmetric(v1, v2);
    } else {
      paths[i] = [{ x: mx, y: my }];
    }
  }
  return paths;
}

export function applyTriangleEdit(newPaths: Record<number, Point[]>, activePoint: { edgeIdx: number; pointIdx: number } | null, baseVertices: Point[], triSymmetry: 'cw' | 'ccw') {
  if (!activePoint) return newPaths;
  const driven = 1;
  const paired = triSymmetry === 'cw' ? (driven + 2) % 3 : (driven + 1) % 3;
  const spare = [0,1,2].find(x => x !== driven && x !== paired)!;

  // If editing the driven edge (bottom), update the paired edge accordingly
  if (activePoint.edgeIdx === driven) {
    const v0 = baseVertices[driven];
    const v1 = baseVertices[(driven + 1) % 3];
    const pv0 = baseVertices[paired];
    const pv1 = baseVertices[(paired + 1) % 3];

    const drivenPts = newPaths[driven];
    const pairedPts = drivenPts.map((_p, idx) => {
      const cp = drivenPts[idx];
      const edgeLen2 = (v1.x - v0.x) ** 2 + (v1.y - v0.y) ** 2;
      const t = edgeLen2 > 0
        ? ((cp.x - v0.x) * (v1.x - v0.x) + (cp.y - v0.y) * (v1.y - v0.y)) / edgeLen2
        : 0.5;
      const ex = v1.x - v0.x, ey = v1.y - v0.y;
      const len = Math.sqrt(edgeLen2) || 1;
      const nx = -ey / len, ny = ex / len;
      const d = (cp.x - v0.x) * nx + (cp.y - v0.y) * ny;

      const tPaired = 1 - t;
      const baseX = pv0.x + tPaired * (pv1.x - pv0.x);
      const baseY = pv0.y + tPaired * (pv1.y - pv0.y);
      const pex = pv1.x - pv0.x, pey = pv1.y - pv0.y;
      const plen = Math.sqrt(pex ** 2 + pey ** 2) || 1;
      const pnx = -pey / plen, pny = pex / plen;
      return {
        x: baseX + (-d) * pnx,
        y: baseY + (-d) * pny,
      };
    });
    newPaths[paired] = pairedPts;
  }

  // If editing the spare edge, mirror within that edge only.
  if (activePoint.edgeIdx === spare) {
    const pts = newPaths[spare];
    if (pts && pts.length >= 2) {
      const v0 = baseVertices[spare];
      const v1 = baseVertices[(spare + 1) % 3];
      const mx = (v0.x + v1.x) / 2;
      const my = (v0.y + v1.y) / 2;
      const movedIdx = activePoint.pointIdx;
      const otherIdx = movedIdx === 0 ? 1 : 0;
      pts[otherIdx] = { x: 2 * mx - pts[movedIdx].x, y: 2 * my - pts[movedIdx].y };
      newPaths[spare] = pts;
    }
  }

  return newPaths;
}

export function startDemo(params: {
  setShapeType: (s: 'triangle' | 'square' | 'hexagon') => void;
  setDemoCenters: React.Dispatch<React.SetStateAction<{cx:number, cy:number}[]>>;
  setDemoMode: React.Dispatch<React.SetStateAction<boolean>>;
  setDemoStep: React.Dispatch<React.SetStateAction<number>>;
  demoIntervalRef: React.MutableRefObject<number | null>;
  RADIUS: number;
}) {
  const { setShapeType, setDemoCenters, setDemoMode, setDemoStep, demoIntervalRef, RADIUS } = params;
  setShapeType('triangle');
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
  setDemoStep(1);
}

export function stopDemo(params: {
  setDemoMode: React.Dispatch<React.SetStateAction<boolean>>;
  setDemoStep: React.Dispatch<React.SetStateAction<number>>;
  demoIntervalRef: React.MutableRefObject<number | null>;
}) {
  const { setDemoMode, setDemoStep, demoIntervalRef } = params;
  setDemoMode(false);
  setDemoStep(0);
  if (demoIntervalRef.current) {
    window.clearInterval(demoIntervalRef.current);
    demoIntervalRef.current = null;
  }
}

// Triangle-specific helper API (named to make intent explicit)
export function startTriangleDemo(params: Parameters<typeof startDemo>[0]) {
  return startDemo(params);
}

export function stopTriangleDemo(params: Parameters<typeof stopDemo>[0]) {
  return stopDemo(params);
}

export function nextTriangleStep(setter: React.Dispatch<React.SetStateAction<number>>) {
  setter(prev => Math.min(prev + 1, 6 + 80));
}

export function prevTriangleStep(setter: React.Dispatch<React.SetStateAction<number>>) {
  setter(prev => Math.max(prev - 1, 0));
}

export function getTriangleDemoText(step: number, triSymmetry: 'cw' | 'ccw') {
  if (step === 0) return '데모 준비 중... (다음 버튼을 눌러 시작하세요)';
  if (step === 1) return '변형된 도형을 준비합니다.';
  if (step >= 2 && step <= 6) {
    const k = step - 1;
    const angle = k * 60 * (triSymmetry === 'cw' ? 1 : -1);
    return `기준점을 기준으로 ${angle}도 회전합니다.`;
  }
  const hexes = Math.max(0, step - 6);
  if (hexes === 0) return '중앙 육각형 완성 — 다음 버튼을 눌러 주변 육각형을 하나씩 추가하세요.';
  return `주변 육각형 #${hexes}는 밀어서 복사합니다.`;
}

export function triangleAutoAdvance(demoMode: boolean, demoStep: number, demoCentersLength: number, setDemoStep: React.Dispatch<React.SetStateAction<number>>) {
  if (!demoMode) return;
  if (demoStep <= 12) return;
  if (demoCentersLength >= 13) {
    const full = 6 + demoCentersLength;
    if (demoStep !== full) setDemoStep(full);
  }
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

export function renderTriangleControls(params: {
  ei: number;
  points: Point[];
  activePoint: { edgeIdx: number; pointIdx: number } | null;
  triSymmetry: 'cw' | 'ccw';
  handleMouseDown: (edgeIdx: number, pointIdx: number) => void;
}) {
  const { ei, points, activePoint, triSymmetry, handleMouseDown } = params;
  const driven = 1;
  const paired = triSymmetry === 'cw' ? (driven + 2) % 3 : (driven + 1) % 3;
  const spare = [0,1,2].find(x => x !== driven && x !== paired)!;

  // Only render driven, paired and spare edges in triangle mode
  if (![driven, paired, spare].includes(ei)) return null;

  return (
    <g key={String(ei)}>
      {points.map((p, pointIdx) => {
        const isDriven = ei === driven;
        const isPaired = ei === paired;
        const isSpare = ei === spare;

        let fill = isPaired ? '#f59e0b' : isDriven ? '#2563eb' : (isSpare ? (pointIdx === 0 ? '#2563eb' : '#60a5fa') : '#6366f1');
        const interactive = !isPaired && !(isSpare && pointIdx === 1);
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
