const fs = require('node:fs');
const path = require('node:path');
const pptxgen = require('pptxgenjs');
const SHAPE = new pptxgen().ShapeType;

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const FONT = 'Malgun Gothic';
const C = {
  ink: '17202A',
  muted: '667085',
  paper: 'F7F8FA',
  white: 'FFFFFF',
  blue: '3157D5',
  blueSoft: 'E9EEFF',
  coral: 'F26B5E',
  coralSoft: 'FDEBE8',
  mint: '29A37A',
  mintSoft: 'E4F5EF',
  yellow: 'F3C94A',
  line: 'D9DEE8',
};

const mobileSource = path.join(DOCS, 'MOBILE-USER-MANUAL.md');
const desktopSource = path.join(DOCS, 'DESKTOP-USER-MANUAL.md');
for (const source of [mobileSource, desktopSource]) {
  if (!fs.existsSync(source) || fs.readFileSync(source, 'utf8').trim().length === 0) {
    throw new Error(`Manual source is missing or empty: ${source}`);
  }
}

function createDeck(subject) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Tessellation Studio';
  pptx.company = 'JIE Inc.';
  pptx.subject = subject;
  pptx.title = subject;
  pptx.lang = 'ko-KR';
  pptx.theme = {
    headFontFace: FONT,
    bodyFontFace: FONT,
    lang: 'ko-KR',
  };
  pptx.defineSlideMaster({
    title: 'MANUAL',
    background: { color: C.paper },
    objects: [
      { rect: { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: C.blue }, line: { color: C.blue } } },
      { text: { text: 'TESSELLATION STUDIO', options: { x: 0.55, y: 7.08, w: 3.2, h: 0.18, fontFace: FONT, fontSize: 8, bold: true, color: C.muted, charSpacing: 1.2, margin: 0 } } },
      { text: { text: 'USER MANUAL', options: { x: 10.85, y: 7.08, w: 1.9, h: 0.18, fontFace: FONT, fontSize: 8, bold: true, align: 'right', color: C.muted, charSpacing: 1.2, margin: 0 } } },
    ],
    slideNumber: { x: 12.8, y: 7.04, w: 0.25, h: 0.2, color: C.muted, fontFace: FONT, fontSize: 8, align: 'right' },
  });
  return pptx;
}

function addTitle(slide, eyebrow, title, subtitle) {
  slide.addText(eyebrow, { x: 0.65, y: 0.48, w: 2.9, h: 0.24, fontFace: FONT, fontSize: 10, bold: true, color: C.blue, charSpacing: 1.5, margin: 0 });
  slide.addText(title, { x: 0.65, y: 0.86, w: 11.7, h: 0.55, fontFace: FONT, fontSize: 27, bold: true, color: C.ink, breakLine: false, margin: 0, fit: 'shrink' });
  if (subtitle) slide.addText(subtitle, { x: 0.67, y: 1.49, w: 11.4, h: 0.34, fontFace: FONT, fontSize: 11.5, color: C.muted, margin: 0, fit: 'shrink' });
}

function addBulletList(slide, items, x, y, w, options = {}) {
  const gap = options.gap || 0.62;
  items.forEach((item, index) => {
    const top = y + index * gap;
    slide.addShape(SHAPE.ellipse, { x, y: top + 0.09, w: 0.16, h: 0.16, fill: { color: options.color || C.blue }, line: { color: options.color || C.blue } });
    slide.addText(item, { x: x + 0.3, y: top, w: w - 0.3, h: gap - 0.06, fontFace: FONT, fontSize: options.fontSize || 15, color: C.ink, breakLine: false, margin: 0, fit: 'shrink', valign: 'mid' });
  });
}

function addCard(slide, x, y, w, h, number, title, body, accent = C.blue) {
  slide.addShape(SHAPE.roundRect, { x, y, w, h, rectRadius: 0.06, fill: { color: C.white }, line: { color: C.line, width: 1 } });
  slide.addShape(SHAPE.ellipse, { x: x + 0.28, y: y + 0.28, w: 0.48, h: 0.48, fill: { color: accent }, line: { color: accent } });
  slide.addText(String(number), { x: x + 0.28, y: y + 0.35, w: 0.48, h: 0.2, fontFace: FONT, fontSize: 11, bold: true, align: 'center', color: C.white, margin: 0 });
  slide.addText(title, { x: x + 0.92, y: y + 0.25, w: w - 1.18, h: 0.38, fontFace: FONT, fontSize: 16, bold: true, color: C.ink, margin: 0, fit: 'shrink' });
  slide.addText(body, { x: x + 0.3, y: y + 0.9, w: w - 0.6, h: h - 1.15, fontFace: FONT, fontSize: 11.5, color: C.muted, valign: 'top', breakLine: false, margin: 0, fit: 'shrink' });
}

function addPill(slide, text, x, y, w, color, soft) {
  slide.addShape(SHAPE.roundRect, { x, y, w, h: 0.4, rectRadius: 0.06, fill: { color: soft }, line: { color: soft } });
  slide.addText(text, { x, y: y + 0.09, w, h: 0.17, fontFace: FONT, fontSize: 10, bold: true, align: 'center', color, margin: 0, fit: 'shrink' });
}

function addPattern(slide, x, y, scale = 1) {
  const size = 0.78 * scale;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const even = (row + col) % 2 === 0;
      const color = even ? C.blue : C.coral;
      slide.addShape(SHAPE.hexagon, {
        x: x + col * size * 0.76,
        y: y + row * size * 0.66 + (col % 2 ? size * 0.33 : 0),
        w: size,
        h: size * 0.88,
        fill: { color, transparency: even ? 3 : 8 },
        line: { color: C.white, transparency: 45, width: 0.7 },
        rotate: even ? 0 : 30,
      });
    }
  }
}

function addPhone(slide, x, y, w, h) {
  slide.addShape(SHAPE.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: C.ink }, line: { color: C.ink } });
  slide.addShape(SHAPE.roundRect, { x: x + 0.11, y: y + 0.14, w: w - 0.22, h: h - 0.28, rectRadius: 0.08, fill: { color: C.paper }, line: { color: C.paper } });
  slide.addShape(SHAPE.roundRect, { x: x + w * 0.34, y: y + 0.06, w: w * 0.32, h: 0.11, rectRadius: 0.04, fill: { color: C.ink }, line: { color: C.ink } });
  slide.addShape(SHAPE.rect, { x: x + 0.12, y: y + 0.25, w: w - 0.24, h: 0.48, fill: { color: C.white }, line: { color: C.line } });
  slide.addText('☰', { x: x + 0.25, y: y + 0.36, w: 0.25, h: 0.18, fontFace: FONT, fontSize: 13, bold: true, color: C.ink, margin: 0 });
  slide.addText('Tessellation Studio', { x: x + 0.65, y: y + 0.36, w: w - 1.3, h: 0.18, fontFace: FONT, fontSize: 9.5, bold: true, align: 'center', color: C.ink, margin: 0, fit: 'shrink' });
  slide.addText('▣', { x: x + w - 0.52, y: y + 0.36, w: 0.25, h: 0.18, fontFace: FONT, fontSize: 12, bold: true, color: C.blue, margin: 0 });
  addPattern(slide, x + 0.25, y + 1.0, 0.68);
  slide.addShape(SHAPE.ellipse, { x: x + w * 0.34, y: y + h * 0.43, w: w * 0.32, h: w * 0.32, fill: { color: C.blueSoft, transparency: 12 }, line: { color: C.blue, width: 1.5 } });
  slide.addShape(SHAPE.ellipse, { x: x + w * 0.45, y: y + h * 0.48, w: 0.18, h: 0.18, fill: { color: C.blue }, line: { color: C.white, width: 1 } });
  slide.addShape(SHAPE.roundRect, { x: x + 0.28, y: y + h - 0.78, w: w - 0.56, h: 0.42, rectRadius: 0.07, fill: { color: C.white, transparency: 6 }, line: { color: C.line } });
  slide.addText('격자    Zoom    설명하기', { x: x + 0.43, y: y + h - 0.64, w: w - 0.86, h: 0.16, fontFace: FONT, fontSize: 8.5, bold: true, align: 'center', color: C.ink, margin: 0, fit: 'shrink' });
}

function addDesktop(slide, x, y, w, h) {
  slide.addShape(SHAPE.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: C.ink }, line: { color: C.ink } });
  slide.addShape(SHAPE.rect, { x: x + 0.12, y: y + 0.16, w: w - 0.24, h: h - 0.42, fill: { color: C.paper }, line: { color: C.paper } });
  slide.addShape(SHAPE.rect, { x: x + 0.12, y: y + 0.16, w: w * 0.28, h: h - 0.42, fill: { color: C.white }, line: { color: C.line } });
  slide.addText('Tessellation\nStudio', { x: x + 0.34, y: y + 0.45, w: w * 0.22, h: 0.62, fontFace: FONT, fontSize: 16, bold: true, color: C.ink, margin: 0, fit: 'shrink' });
  ['도형 선택', '색상', '변 형태', '변형 종류'].forEach((label, index) => {
    slide.addShape(SHAPE.roundRect, { x: x + 0.32, y: y + 1.38 + index * 0.68, w: w * 0.2, h: 0.43, rectRadius: 0.05, fill: { color: index === 0 ? C.blueSoft : C.paper }, line: { color: index === 0 ? C.blue : C.line } });
    slide.addText(label, { x: x + 0.4, y: y + 1.51 + index * 0.68, w: w * 0.16, h: 0.15, fontFace: FONT, fontSize: 8.5, bold: true, align: 'center', color: index === 0 ? C.blue : C.muted, margin: 0 });
  });
  addPattern(slide, x + w * 0.34, y + 0.65, 0.9);
  slide.addShape(SHAPE.ellipse, { x: x + w * 0.57, y: y + h * 0.32, w: 1.45, h: 1.45, fill: { color: C.blueSoft, transparency: 10 }, line: { color: C.blue, width: 1.5 } });
  slide.addShape(SHAPE.ellipse, { x: x + w * 0.66, y: y + h * 0.43, w: 0.22, h: 0.22, fill: { color: C.blue }, line: { color: C.white, width: 1 } });
  slide.addShape(SHAPE.line, { x: x + w * 0.48, y: y + h - 0.2, w: w * 0.04, h: 0.55, line: { color: C.ink, width: 4 } });
  slide.addShape(SHAPE.trapezoid, { x: x + w * 0.42, y: y + h + 0.23, w: w * 0.16, h: 0.25, rotate: 180, fill: { color: C.ink }, line: { color: C.ink } });
}

function addCover(pptx, edition, subtitle, device) {
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  slide.addShape(SHAPE.rect, { x: 0, y: 0, w: 8.25, h: 7.5, fill: { color: C.white }, line: { color: C.white } });
  addPill(slide, edition, 0.78, 0.76, 1.65, C.blue, C.blueSoft);
  slide.addText('Tessellation\nStudio', { x: 0.78, y: 1.48, w: 6.1, h: 1.55, fontFace: FONT, fontSize: 38, bold: true, color: C.ink, margin: 0, breakLine: false, fit: 'shrink' });
  slide.addText('사용 매뉴얼', { x: 0.8, y: 3.25, w: 4.5, h: 0.55, fontFace: FONT, fontSize: 25, bold: true, color: C.blue, margin: 0 });
  slide.addText(subtitle, { x: 0.8, y: 4.02, w: 6.45, h: 0.82, fontFace: FONT, fontSize: 15, color: C.muted, breakLine: false, margin: 0, fit: 'shrink' });
  slide.addText('도형의 변을 바꾸고, 반복 패턴을 만들고, 이미지로 저장하세요.', { x: 0.8, y: 5.43, w: 6.4, h: 0.55, fontFace: FONT, fontSize: 12, color: C.ink, margin: 0, fit: 'shrink' });
  slide.addShape(SHAPE.rect, { x: 8.25, y: 0, w: 5.08, h: 7.5, fill: { color: C.ink }, line: { color: C.ink } });
  addPattern(slide, 8.55, 0.25, 1.28);
  if (device === 'mobile') addPhone(slide, 9.47, 1.08, 2.55, 5.62);
  else addDesktop(slide, 8.72, 1.65, 4.1, 3.75);
  slide.addText('JIE Inc.', { x: 0.8, y: 6.82, w: 2, h: 0.22, fontFace: FONT, fontSize: 10, bold: true, color: C.muted, margin: 0 });
}

function addOverviewSlide(pptx, edition, device, labels) {
  const slide = pptx.addSlide('MANUAL');
  addTitle(slide, `${edition} · 01`, '한눈에 보는 작업 화면', '설정 → 편집 → 미리보기 → 저장의 흐름으로 구성됩니다.');
  if (device === 'mobile') addPhone(slide, 0.9, 2.05, 2.45, 4.4);
  else addDesktop(slide, 0.85, 2.45, 5.25, 3.25);
  addBulletList(slide, labels, device === 'mobile' ? 4.2 : 6.85, 2.12, device === 'mobile' ? 7.65 : 5.4, { gap: 0.78, fontSize: 14 });
}

function addQuickStartSlide(pptx, edition, steps) {
  const slide = pptx.addSlide('MANUAL');
  addTitle(slide, `${edition} · 02`, '처음부터 저장까지', '아래 순서대로 진행하면 첫 패턴을 빠르게 완성할 수 있습니다.');
  const accents = [C.blue, C.coral, C.mint, C.blue, C.coral, C.mint];
  steps.forEach((step, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    addCard(slide, 0.7 + col * 4.18, 2.05 + row * 2.15, 3.72, 1.72, index + 1, step[0], step[1], accents[index]);
  });
}

function addEditingSlide(pptx, edition, title, subtitle, points, device) {
  const slide = pptx.addSlide('MANUAL');
  addTitle(slide, `${edition} · 03`, title, subtitle);
  slide.addShape(SHAPE.roundRect, { x: 0.8, y: 2.0, w: 5.05, h: 4.35, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line } });
  slide.addShape(SHAPE.hexagon, { x: 1.85, y: 2.55, w: 2.95, h: 2.95, fill: { color: C.blueSoft, transparency: 5 }, line: { color: C.blue, width: 2.5 } });
  [[2.12, 3.24], [3.17, 2.63], [4.35, 3.33]].forEach(([x, y]) => {
    slide.addShape(SHAPE.ellipse, { x, y, w: 0.32, h: 0.32, fill: { color: C.blue }, line: { color: C.white, width: 1.2 } });
  });
  slide.addShape(SHAPE.line, { x: 3.32, y: 3.1, w: 1.22, h: 1.35, line: { color: C.coral, width: 2.5, beginArrowType: 'none', endArrowType: 'triangle' } });
  slide.addText(device === 'mobile' ? '누른 채 이동' : '클릭한 채 이동', { x: 2.95, y: 4.7, w: 1.6, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, align: 'center', color: C.coral, margin: 0 });
  addBulletList(slide, points, 6.45, 2.1, 5.9, { gap: 0.72, fontSize: 14 });
}

function addTransformSlide(pptx, edition) {
  const slide = pptx.addSlide('MANUAL');
  addTitle(slide, `${edition} · 04`, '도형과 변형 규칙', '변형 규칙에 따라 직접 편집하는 변과 자동 계산되는 대응 변이 달라집니다.');
  const data = [
    ['삼각형', '기본 대칭', '세 방향으로 자연스럽게 연결'],
    ['사각형', '90° 회전', '회전된 변으로 연결'],
    ['사각형', '평행 이동', '마주 보는 변으로 연결'],
    ['사각형', '미끄럼 반사', '이동과 반사를 결합'],
    ['육각형', '120° 회전', '세 방향 회전 대칭'],
    ['육각형', '자유형', '세 쌍의 변을 자유롭게 편집'],
  ];
  data.forEach((item, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 0.72 + col * 4.17;
    const y = 2.02 + row * 2.12;
    const accent = [C.blue, C.coral, C.mint][col];
    slide.addShape(index === 0 ? SHAPE.triangle : index < 4 ? SHAPE.rect : SHAPE.hexagon, { x, y: y + 0.18, w: 0.72, h: 0.72, fill: { color: accent }, line: { color: accent } });
    slide.addText(item[0], { x: x + 0.95, y, w: 2.65, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.muted, margin: 0 });
    slide.addText(item[1], { x: x + 0.95, y: y + 0.42, w: 2.65, h: 0.34, fontFace: FONT, fontSize: 16, bold: true, color: C.ink, margin: 0, fit: 'shrink' });
    slide.addText(item[2], { x: x + 0.95, y: y + 0.92, w: 2.65, h: 0.58, fontFace: FONT, fontSize: 10.5, color: C.muted, margin: 0, fit: 'shrink' });
  });
  addPill(slide, '육각형에는 평행 이동과 미끄럼 반사도 제공됩니다.', 3.98, 6.28, 5.4, C.blue, C.blueSoft);
}

function addToolsSlide(pptx, edition, mobile) {
  const slide = pptx.addSlide('MANUAL');
  addTitle(slide, `${edition} · 05`, '색상과 하단 도구 모음', '패턴의 인상과 화면 표시를 작업 중에도 즉시 조정할 수 있습니다.');
  addCard(slide, 0.75, 2.05, 3.75, 3.95, 'A', 'Primary / Secondary', 'Primary는 주 패턴과 윤곽 색상, Secondary는 교차 타일 색상입니다. 준비된 색상 또는 사용자 지정 색상을 선택하세요.', C.coral);
  slide.addShape(SHAPE.ellipse, { x: 1.25, y: 4.55, w: 0.56, h: 0.56, fill: { color: C.blue }, line: { color: C.white, width: 2 } });
  slide.addShape(SHAPE.ellipse, { x: 1.95, y: 4.55, w: 0.56, h: 0.56, fill: { color: 'EC4899' }, line: { color: C.white, width: 2 } });
  slide.addShape(SHAPE.ellipse, { x: 2.65, y: 4.55, w: 0.56, h: 0.56, fill: { color: 'FDE68A' }, line: { color: C.white, width: 2 } });
  addCard(slide, 4.78, 2.05, 3.75, 3.95, 'B', '격자와 Zoom', '격자는 편집기의 기준선을 표시합니다. Zoom은 배경 반복 패턴을 0.5배에서 2배까지 조절합니다.', C.blue);
  slide.addShape(SHAPE.line, { x: 5.4, y: 4.82, w: 2.15, h: 0, line: { color: C.line, width: 4 } });
  slide.addShape(SHAPE.ellipse, { x: 6.2, y: 4.64, w: 0.36, h: 0.36, fill: { color: C.blue }, line: { color: C.white, width: 1.5 } });
  addCard(slide, 8.8, 2.05, 3.75, 3.95, 'C', mobile ? '설명하기와 잠금' : '설명하기', mobile ? '설명하기로 반복 원리를 단계별 확인합니다. 편집할 때는 스크롤 잠금을 켜 안정적으로 드래그하세요.' : '설명하기로 반복 원리를 단계별 확인합니다. 이전, 다음, 종료 버튼으로 제어하세요.', C.mint);
}

function addFreeformSlide(pptx, edition, mobile) {
  const slide = pptx.addSlide('MANUAL');
  addTitle(slide, `${edition} · 06`, '육각형 자유형', '편집 가능한 세 변에 조절점을 추가해 더 복잡한 타일을 만들 수 있습니다.');
  const steps = mobile
    ? [['육각형 선택', '변형 종류에서 자유형을 선택합니다.'], ['변 길게 누르기', '파란 점선으로 표시된 편집 가능 변을 길게 누릅니다.'], ['새 점 드래그', '추가된 파란 조절점을 원하는 위치로 움직입니다.']]
    : [['육각형 선택', '변형 종류에서 자유형을 선택합니다.'], ['마우스 오른쪽 클릭', '파란 점선 위의 원하는 위치를 오른쪽 클릭합니다.'], ['새 점 드래그', '추가된 파란 조절점을 원하는 위치로 움직입니다.']];
  steps.forEach((step, index) => addCard(slide, 0.85 + index * 4.15, 2.08, 3.55, 2.05, index + 1, step[0], step[1], [C.blue, C.coral, C.mint][index]));
  slide.addShape(SHAPE.line, { x: 1.3, y: 5.35, w: 10.6, h: 0, line: { color: C.blue, width: 7, transparency: 76, dash: 'dash' } });
  [2.2, 5.0, 7.8, 10.6].forEach((x) => slide.addShape(SHAPE.ellipse, { x, y: 5.16, w: 0.38, h: 0.38, fill: { color: C.blue }, line: { color: C.white, width: 1.2 } }));
  slide.addText(mobile ? '기기에서 길게 누르기가 브라우저 메뉴로 처리되면 Android 앱에서 다시 시도하세요.' : '파란 점선은 점을 추가할 수 있는 변을 나타냅니다.', { x: 2.0, y: 6.08, w: 9.3, h: 0.42, fontFace: FONT, fontSize: 11.5, color: C.muted, align: 'center', margin: 0, fit: 'shrink' });
}

function addSaveSlide(pptx, edition, mobile) {
  const slide = pptx.addSlide('MANUAL');
  addTitle(slide, `${edition} · 07`, '초기화와 파일 저장', '용도에 맞춰 PNG 또는 SVG를 선택하세요.');
  addCard(slide, 0.8, 2.05, 3.7, 3.85, '↺', '설정 초기화', '현재 도형의 변 편집 결과만 기본 형태로 되돌립니다. 색상과 Zoom 값은 유지됩니다.', C.muted);
  addCard(slide, 4.82, 2.05, 3.7, 3.85, 'P', 'PNG 이미지', '현재 패턴 영역을 2배 해상도의 이미지로 저장합니다. 문서, 발표 자료, 메신저에 적합합니다.', C.coral);
  addCard(slide, 8.84, 2.05, 3.7, 3.85, 'S', 'SVG 벡터', '확대해도 선명한 벡터 파일입니다. 인쇄와 디자인 편집 작업에 적합합니다.', C.mint);
  slide.addText(mobile ? '저장 위치는 Android 버전과 브라우저 설정에 따라 다릅니다. 다운로드 목록 또는 Downloads 폴더를 확인하세요.' : '웹 브라우저에서는 기본 다운로드 폴더를 확인하세요. Windows 앱은 시스템 다운로드 처리 방식에 따라 알림이 표시될 수 있습니다.', { x: 1.05, y: 6.28, w: 11.2, h: 0.44, fontFace: FONT, fontSize: 11, color: C.muted, align: 'center', margin: 0, fit: 'shrink' });
}

function addTroubleshootingSlide(pptx, edition, items) {
  const slide = pptx.addSlide('MANUAL');
  addTitle(slide, `${edition} · 08`, '문제가 생겼을 때', '대부분은 편집 상태, 설명 모드 또는 화면 표시 설정에서 해결할 수 있습니다.');
  items.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 0.8 + col * 6.15;
    const y = 2.0 + row * 2.1;
    slide.addShape(SHAPE.roundRect, { x, y, w: 5.65, h: 1.72, rectRadius: 0.06, fill: { color: C.white }, line: { color: C.line } });
    slide.addText('Q', { x: x + 0.25, y: y + 0.25, w: 0.45, h: 0.35, fontFace: FONT, fontSize: 17, bold: true, color: C.coral, align: 'center', margin: 0 });
    slide.addText(item[0], { x: x + 0.85, y: y + 0.22, w: 4.45, h: 0.38, fontFace: FONT, fontSize: 14, bold: true, color: C.ink, margin: 0, fit: 'shrink' });
    slide.addText(item[1], { x: x + 0.85, y: y + 0.79, w: 4.45, h: 0.58, fontFace: FONT, fontSize: 10.5, color: C.muted, margin: 0, fit: 'shrink' });
  });
}

async function buildMobile() {
  const pptx = createDeck('Tessellation Studio 모바일 사용 매뉴얼');
  addCover(pptx, 'MOBILE', 'Android 앱 · 모바일 웹 브라우저', 'mobile');
  addOverviewSlide(pptx, 'MOBILE', 'mobile', [
    '왼쪽 메뉴에서 도형·색상·변형을 설정합니다.',
    '오른쪽 자물쇠로 페이지 스크롤을 잠급니다.',
    '중앙 편집기에서 파란 조절점을 터치해 움직입니다.',
    '배경 패턴으로 결과를 실시간 확인합니다.',
    '하단에서 격자·Zoom·설명 모드를 조절합니다.',
  ]);
  addQuickStartSlide(pptx, 'MOBILE', [
    ['메뉴 열기', '상단 왼쪽 메뉴 버튼을 누릅니다.'],
    ['도형 선택', '삼각형, 사각형, 육각형 중 하나를 고릅니다.'],
    ['스타일 설정', '색상, 직선/곡선, 변형 종류를 정합니다.'],
    ['스크롤 잠금', '메뉴를 닫고 오른쪽 자물쇠를 잠급니다.'],
    ['터치 편집', '파란 조절점을 누른 채 움직입니다.'],
    ['파일 저장', '메뉴에서 PNG 또는 SVG로 저장합니다.'],
  ]);
  addEditingSlide(pptx, 'MOBILE', '터치로 변 편집하기', '스크롤 잠금을 켜면 화면 이동 없이 조절점을 안정적으로 움직일 수 있습니다.', [
    '파란색 조절점은 직접 움직일 수 있습니다.',
    '회색 꼭짓점은 기준점이며 고정되어 있습니다.',
    '대응되는 변은 선택한 규칙에 따라 자동 계산됩니다.',
    '직선은 꺾이는 점, 곡선은 곡률 제어점으로 동작합니다.',
    '편집기 제목을 눌러 접거나 다시 펼칠 수 있습니다.',
  ], 'mobile');
  addTransformSlide(pptx, 'MOBILE');
  addToolsSlide(pptx, 'MOBILE', true);
  addFreeformSlide(pptx, 'MOBILE', true);
  addSaveSlide(pptx, 'MOBILE', true);
  addTroubleshootingSlide(pptx, 'MOBILE', [
    ['드래그할 때 화면도 움직여요', '상단 오른쪽 자물쇠를 눌러 스크롤을 잠급니다.'],
    ['편집기가 보이지 않아요', '편집기 제목을 눌러 펼치거나 설명 모드를 종료합니다.'],
    ['저장 파일을 찾을 수 없어요', '다운로드 알림, Downloads 폴더와 브라우저 권한을 확인합니다.'],
    ['패턴 크기가 맞지 않아요', '하단 Zoom 슬라이더로 0.5배~2배 범위에서 조절합니다.'],
  ]);
  await pptx.writeFile({ fileName: path.join(DOCS, 'Tessellation-Studio-Mobile-User-Manual.pptx') });
}

async function buildDesktop() {
  const pptx = createDeck('Tessellation Studio 데스크톱 사용 매뉴얼');
  addCover(pptx, 'DESKTOP', 'Windows Electron 앱 · 데스크톱 웹 브라우저', 'desktop');
  addOverviewSlide(pptx, 'DESKTOP', 'desktop', [
    '왼쪽 설정 패널에서 작업 조건을 선택합니다.',
    '중앙 편집기에서 파란 조절점을 마우스로 움직입니다.',
    '배경에서 반복 결과를 실시간 확인합니다.',
    '하단에서 격자·Zoom·설명 모드를 제어합니다.',
    '왼쪽 패널 하단에서 PNG 또는 SVG로 저장합니다.',
  ]);
  addQuickStartSlide(pptx, 'DESKTOP', [
    ['도형 선택', '삼각형, 사각형, 육각형 중 하나를 고릅니다.'],
    ['색상 선택', 'Primary와 Secondary 색상을 정합니다.'],
    ['변 형태 선택', '직선 또는 곡선을 선택합니다.'],
    ['변형 선택', '도형에 맞는 회전, 이동, 반사를 고릅니다.'],
    ['마우스 편집', '파란 조절점을 클릭한 채 움직입니다.'],
    ['파일 저장', '왼쪽 패널에서 PNG 또는 SVG로 저장합니다.'],
  ]);
  addEditingSlide(pptx, 'DESKTOP', '마우스로 변 편집하기', '직접 편집하는 변과 자동 계산되는 대응 변을 구분해 작업하세요.', [
    '파란색 조절점을 클릭한 채 움직입니다.',
    '회색 꼭짓점은 기준점이며 고정되어 있습니다.',
    '대응되는 변은 회전·이동·반사 규칙으로 자동 변경됩니다.',
    '직선은 꺾이는 점, 곡선은 곡률 제어점으로 동작합니다.',
    '편집기 제목을 클릭해 접거나 다시 펼칠 수 있습니다.',
  ], 'desktop');
  addTransformSlide(pptx, 'DESKTOP');
  addToolsSlide(pptx, 'DESKTOP', false);
  addFreeformSlide(pptx, 'DESKTOP', false);
  addSaveSlide(pptx, 'DESKTOP', false);
  addTroubleshootingSlide(pptx, 'DESKTOP', [
    ['조절점이 움직이지 않아요', '파란 조절점인지 확인하고 설명 모드를 종료합니다.'],
    ['패턴이 화면 밖으로 커졌어요', '하단 Zoom 슬라이더를 왼쪽으로 이동합니다.'],
    ['저장 결과가 예상과 달라요', '설명 모드를 종료하고 패턴과 색상을 다시 확인합니다.'],
    ['Windows 메뉴가 없어요', '모든 기능은 왼쪽 설정 패널과 하단 도구 모음에 있습니다.'],
  ]);
  await pptx.writeFile({ fileName: path.join(DOCS, 'Tessellation-Studio-Desktop-User-Manual.pptx') });
}

Promise.all([buildMobile(), buildDesktop()])
  .then(() => console.log('Created mobile and desktop user manual presentations.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });