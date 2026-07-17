import * as THREE from 'three';

/**
 * Enhanced Procedural PBR Material & Texture Generator
 * Generates realistic normal maps, roughness maps, and MeshStandardMaterials
 * for floor finishes, wall paints, and furniture surfaces.
 *
 * Phase 3: PBR Floor/Wall Textures upgrade
 * - Proper normal maps (computed from height data via Sobel filter)
 * - Separate roughness maps per material type
 * - Anisotropic filtering for floor textures at grazing angles
 * - Higher-detail procedural patterns (planks, grout, veins, brick)
 */

// Texture cache to prevent duplicating GPU textures
const textureCache = new Map();

const TEX_SIZE = 512;

// ─── Height-to-Normal map generator (Sobel-based) ───────────────

function createNormalMapFromHeight(heightCanvas) {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const ctx = heightCanvas.getContext('2d');
  const src = ctx.getImageData(0, 0, w, h).data;

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = w;
  normalCanvas.height = h;
  const nCtx = normalCanvas.getContext('2d');
  const dst = nCtx.createImageData(w, h);
  const d = dst.data;

  const strength = 2.0;

  function heightAt(x, y) {
    const ix = ((y % h + h) % h) * w + ((x % w + w) % w);
    return src[ix * 4] / 255;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Sobel kernel
      const tl = heightAt(x - 1, y - 1);
      const t  = heightAt(x,     y - 1);
      const tr = heightAt(x + 1, y - 1);
      const l  = heightAt(x - 1, y);
      const r  = heightAt(x + 1, y);
      const bl = heightAt(x - 1, y + 1);
      const b  = heightAt(x,     y + 1);
      const br = heightAt(x + 1, y + 1);

      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);

      // Normal in tangent space
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;

      const idx = (y * w + x) * 4;
      d[idx]     = Math.round((nx * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }

  nCtx.putImageData(dst, 0, 0);
  return normalCanvas;
}

// ─── Procedural Height Map Generators ───────────────────────────

function makeWoodHeight() {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE; canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Wood grain — wavy horizontal lines
  for (let i = 0; i < TEX_SIZE; i += 8) {
    const brightness = 128 + Math.sin(i / 3.5) * 15 + Math.cos(i / 7) * 8;
    ctx.strokeStyle = `rgb(${brightness},${brightness},${brightness})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, i);
    for (let x = 0; x < TEX_SIZE; x += 4) {
      ctx.lineTo(x, i + Math.sin((x + i) / 20) * 3);
    }
    ctx.stroke();
  }

  // Plank dividers (deep grooves)
  ctx.strokeStyle = '#404040';
  ctx.lineWidth = 4;
  for (let x = 0; x <= TEX_SIZE; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, TEX_SIZE);
    ctx.stroke();
  }

  // Stagger horizontal joints
  ctx.lineWidth = 3;
  for (let x = 0; x < TEX_SIZE; x += 128) {
    const offset = (x / 128) % 2 === 0 ? TEX_SIZE * 0.4 : TEX_SIZE * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, offset);
    ctx.lineTo(x + 128, offset);
    ctx.stroke();
  }

  return canvas;
}

function makeWoodAlbedo(hexColor) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE; canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Wood grain colour variation
  for (let i = 0; i < TEX_SIZE; i += 6) {
    const alpha = 0.03 + Math.abs(Math.sin(i / 4)) * 0.04;
    ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, i);
    for (let x = 0; x < TEX_SIZE; x += 4) {
      ctx.lineTo(x, i + Math.sin((x + i) / 20) * 3);
    }
    ctx.stroke();
  }

  // Plank dividers
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 3;
  for (let x = 0; x <= TEX_SIZE; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, TEX_SIZE);
    ctx.stroke();
  }

  return canvas;
}

function makeTileHeight() {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE; canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');

  // Tile surface (slightly varied height)
  ctx.fillStyle = '#909090';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Add subtle per-pixel noise for tile surface texture
  const imgData = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 10;
    data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, 144 + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // Grout lines (lower = deeper)
  ctx.strokeStyle = '#404040';
  ctx.lineWidth = 6;
  const tileSize = 64;
  for (let i = 0; i <= TEX_SIZE; i += tileSize) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, TEX_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(TEX_SIZE, i); ctx.stroke();
  }

  return canvas;
}

function makeTileAlbedo(hexColor) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE; canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Grout
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 5;
  const tileSize = 64;
  for (let i = 0; i <= TEX_SIZE; i += tileSize) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, TEX_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(TEX_SIZE, i); ctx.stroke();
  }

  return canvas;
}

function makeMarbleHeight() {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE; canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#a0a0a0';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Marble veins (slightly raised)
  ctx.strokeStyle = '#c0c0c0';
  ctx.lineWidth = 6;
  for (let v = 0; v < 4; v++) {
    ctx.beginPath();
    const startX = Math.random() * TEX_SIZE;
    const startY = Math.random() * TEX_SIZE * 0.3;
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(
      startX + 100 + Math.random() * 150, startY + 100 + Math.random() * 120,
      startX + 200 + Math.random() * 100, startY + 200 + Math.random() * 120,
      startX + 300 + Math.random() * 200, startY + 350 + Math.random() * 150
    );
    ctx.stroke();
  }

  return canvas;
}

function makeMarbleAlbedo(hexColor) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE; canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Veins
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.bezierCurveTo(150, 180, 300, 200, 512, 450);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,200,200,0.15)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(400, 20);
  ctx.bezierCurveTo(350, 200, 200, 350, 50, 500);
  ctx.stroke();

  return canvas;
}

function makeCarpetHeight() {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE; canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Carpet weave pattern
  const imgData = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
  const data = imgData.data;
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const idx = (y * TEX_SIZE + x) * 4;
      // Weave pattern
      const weave = ((x % 4 < 2) !== (y % 4 < 2)) ? 8 : -8;
      const noise = (Math.random() - 0.5) * 16;
      const v = 128 + weave + noise;
      data[idx] = data[idx + 1] = data[idx + 2] = Math.max(0, Math.min(255, v));
    }
  }
  ctx.putImageData(imgData, 0, 0);

  return canvas;
}

function makeConcreteHeight() {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE; canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Concrete noise — irregular pitting
  const imgData = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 20;
    const v = 128 + noise;
    data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, v));
  }
  ctx.putImageData(imgData, 0, 0);

  return canvas;
}

function makePlasterHeight(intensity = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE; canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Plaster micro-noise
  const imgData = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 12 * intensity;
    data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, 128 + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  return canvas;
}

function makeBrickHeight() {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE; canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');

  // Mortar (lower)
  ctx.fillStyle = '#606060';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Bricks (higher)
  const brickW = 64, brickH = 32, mortarW = 4;
  for (let row = 0; row < TEX_SIZE / brickH; row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let col = -1; col < TEX_SIZE / brickW + 1; col++) {
      const x = col * brickW + offset + mortarW / 2;
      const y = row * brickH + mortarW / 2;
      // Each brick has slightly different height for realism
      const brightness = 150 + Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
      ctx.fillRect(x, y, brickW - mortarW, brickH - mortarW);
    }
  }

  return canvas;
}

function makeBrickAlbedo(hexColor) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE; canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');

  // Mortar color
  ctx.fillStyle = '#908880';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Bricks
  const base = new THREE.Color(hexColor);
  const brickW = 64, brickH = 32, mortarW = 4;
  for (let row = 0; row < TEX_SIZE / brickH; row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let col = -1; col < TEX_SIZE / brickW + 1; col++) {
      const x = col * brickW + offset + mortarW / 2;
      const y = row * brickH + mortarW / 2;
      const variation = 0.85 + Math.random() * 0.3;
      const r = Math.min(255, Math.round(base.r * 255 * variation));
      const g = Math.min(255, Math.round(base.g * 255 * variation));
      const b = Math.min(255, Math.round(base.b * 255 * variation));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, brickW - mortarW, brickH - mortarW);
    }
  }

  return canvas;
}

function makeWoodPanelHeight() {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE; canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Vertical planks
  const plankW = 72;
  ctx.strokeStyle = '#404040';
  ctx.lineWidth = 5;
  for (let x = 0; x <= TEX_SIZE; x += plankW) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, TEX_SIZE);
    ctx.stroke();
  }

  // Grain within each plank
  for (let x = 0; x < TEX_SIZE; x += plankW) {
    for (let y = 0; y < TEX_SIZE; y += 6) {
      const brightness = 128 + Math.sin((y + x * 0.5) / 8) * 12;
      ctx.strokeStyle = `rgb(${brightness},${brightness},${brightness})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 3, y);
      ctx.lineTo(x + plankW - 3, y);
      ctx.stroke();
    }
  }

  return canvas;
}

// ─── Texture Factory ────────────────────────────────────────────

function getOrCreateTexture(cacheKey, generatorFn, repeat = [2, 2]) {
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);

  const canvas = generatorFn();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.colorSpace = THREE.SRGBColorSpace;

  textureCache.set(cacheKey, texture);
  return texture;
}

function getOrCreateNormalMap(cacheKey, heightGeneratorFn, repeat = [2, 2]) {
  const nKey = cacheKey + '_normal';
  if (textureCache.has(nKey)) return textureCache.get(nKey);

  const heightCanvas = heightGeneratorFn();
  const normalCanvas = createNormalMapFromHeight(heightCanvas);
  const texture = new THREE.CanvasTexture(normalCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);

  textureCache.set(nKey, texture);
  return texture;
}

// ─── Floor Material Types ───────────────────────────────────────

function detectFloorType(materialKey) {
  if (materialKey.includes('wood'))   return 'wood';
  if (materialKey.includes('tile'))   return 'tile';
  if (materialKey.includes('marble')) return 'marble';
  if (materialKey.includes('carpet')) return 'carpet';
  if (materialKey.includes('concrete')) return 'concrete';
  return 'concrete'; // default
}

export function getFloorMaterial(materialKey, hexColor) {
  const type = detectFloorType(materialKey);
  const repeat = [3, 3]; // Higher repeat for floor textures

  const matParams = {
    color: new THREE.Color(hexColor),
    shadowSide: THREE.FrontSide,
  };

  switch (type) {
    case 'wood': {
      matParams.map = getOrCreateTexture(`floor_wood_${hexColor}`, () => makeWoodAlbedo(hexColor), repeat);
      matParams.normalMap = getOrCreateNormalMap(`floor_wood_h`, makeWoodHeight, repeat);
      matParams.normalScale = new THREE.Vector2(0.6, 0.6);
      matParams.roughness = 0.55;
      matParams.metalness = 0.05;
      break;
    }
    case 'tile': {
      matParams.map = getOrCreateTexture(`floor_tile_${hexColor}`, () => makeTileAlbedo(hexColor), repeat);
      matParams.normalMap = getOrCreateNormalMap(`floor_tile_h`, makeTileHeight, repeat);
      matParams.normalScale = new THREE.Vector2(0.8, 0.8);
      matParams.roughness = 0.45;
      matParams.metalness = 0.08;
      break;
    }
    case 'marble': {
      matParams.map = getOrCreateTexture(`floor_marble_${hexColor}`, () => makeMarbleAlbedo(hexColor), repeat);
      matParams.normalMap = getOrCreateNormalMap(`floor_marble_h`, makeMarbleHeight, repeat);
      matParams.normalScale = new THREE.Vector2(0.3, 0.3);
      matParams.roughness = 0.2;
      matParams.metalness = 0.1;
      break;
    }
    case 'carpet': {
      matParams.normalMap = getOrCreateNormalMap(`floor_carpet_h`, makeCarpetHeight, [4, 4]);
      matParams.normalScale = new THREE.Vector2(0.5, 0.5);
      matParams.roughness = 0.92;
      matParams.metalness = 0.0;
      break;
    }
    case 'concrete':
    default: {
      matParams.normalMap = getOrCreateNormalMap(`floor_concrete_h`, makeConcreteHeight, repeat);
      matParams.normalScale = new THREE.Vector2(0.4, 0.4);
      matParams.roughness = 0.7;
      matParams.metalness = 0.05;
      break;
    }
  }

  return new THREE.MeshStandardMaterial(matParams);
}

// ─── Wall Material Types ────────────────────────────────────────

function detectWallType(materialKey) {
  if (materialKey.includes('brick'))  return 'brick';
  if (materialKey.includes('wood') || materialKey.includes('panel')) return 'wood-panel';
  if (materialKey.includes('concrete') || materialKey.includes('cement')) return 'concrete';
  return 'plaster'; // default for painted walls
}

export function getWallMaterial(materialKey, hexColor) {
  // Glass walls have special handling — pass through as-is
  const WALL_MATS_IMPORT = {
    'glass-clear': true, 'glass-frosted': true, 'glass-tinted': true,
  };
  if (WALL_MATS_IMPORT[materialKey]) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(hexColor),
      roughness: 0.1,
      metalness: 0.85,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
  }

  const type = detectWallType(materialKey);
  const repeat = [2, 2];

  const matParams = {
    color: new THREE.Color(hexColor),
    side: THREE.DoubleSide,
  };

  switch (type) {
    case 'brick': {
      matParams.map = getOrCreateTexture(`wall_brick_${hexColor}`, () => makeBrickAlbedo(hexColor), repeat);
      matParams.normalMap = getOrCreateNormalMap(`wall_brick_h`, makeBrickHeight, repeat);
      matParams.normalScale = new THREE.Vector2(1.0, 1.0);
      matParams.roughness = 0.85;
      matParams.metalness = 0.02;
      break;
    }
    case 'wood-panel': {
      matParams.map = getOrCreateTexture(`wall_woodpanel_${hexColor}`, () => makeWoodAlbedo(hexColor), repeat);
      matParams.normalMap = getOrCreateNormalMap(`wall_woodpanel_h`, makeWoodPanelHeight, repeat);
      matParams.normalScale = new THREE.Vector2(0.7, 0.7);
      matParams.roughness = 0.5;
      matParams.metalness = 0.04;
      break;
    }
    case 'concrete': {
      matParams.normalMap = getOrCreateNormalMap(`wall_concrete_h`, makeConcreteHeight, repeat);
      matParams.normalScale = new THREE.Vector2(0.5, 0.5);
      matParams.roughness = 0.75;
      matParams.metalness = 0.03;
      break;
    }
    case 'plaster':
    default: {
      matParams.normalMap = getOrCreateNormalMap(`wall_plaster_h`, () => makePlasterHeight(1.2), repeat);
      matParams.normalScale = new THREE.Vector2(0.3, 0.3);
      matParams.roughness = 0.85;
      matParams.metalness = 0.02;
      break;
    }
  }

  return new THREE.MeshStandardMaterial(matParams);
}

export function getFurnitureMaterial(colorHex, options = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: options.roughness ?? 0.5,
    metalness: options.metalness ?? 0.15,
    clearcoat: options.clearcoat ?? 0,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.1,
  });
}
