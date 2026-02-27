const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, '..', 'public', 'tstudio.png');
const outPath = path.join(__dirname, '..', 'public', 'favicon.ico');

if (!fs.existsSync(pngPath)) {
  console.error('Source PNG not found at', pngPath);
  process.exit(2);
}

const png = fs.readFileSync(pngPath);
// minimal PNG IHDR parsing to get width/height (big-endian at offset 16)
let width = 32, height = 32;
try {
  if (png.length > 24 && png.toString('ascii', 12, 16) === 'IHDR') {
    width = png.readUInt32BE(16);
    height = png.readUInt32BE(20);
  }
} catch (e) {
  // fallback to 32x32
}

const count = 1;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type = icon
header.writeUInt16LE(count, 4);

const dir = Buffer.alloc(16);
const wByte = width >= 256 ? 0 : width;
const hByte = height >= 256 ? 0 : height;
dir.writeUInt8(wByte, 0);
dir.writeUInt8(hByte, 1);
dir.writeUInt8(0, 2); // color count
dir.writeUInt8(0, 3); // reserved
dir.writeUInt16LE(0, 4); // planes (0 for PNG inside ICO)
dir.writeUInt16LE(32, 6); // bit count (32 for RGBA PNG)
dir.writeUInt32LE(png.length, 8); // bytes in resource
const imageOffset = header.length + dir.length * count;
dir.writeUInt32LE(imageOffset, 12);

const out = Buffer.concat([header, dir, png]);
fs.writeFileSync(outPath, out);
console.log('Wrote', outPath, ' (', png.length, 'bytes,', width + 'x' + height, ')');
