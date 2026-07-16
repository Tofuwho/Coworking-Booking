import * as THREE from 'three';

/**
 * Procedural PBR Material & Texture Generator
 * Generates realistic bump maps, roughness maps, and MeshStandardMaterials
 * for floor finishes, wall paints, and furniture surfaces.
 */

// Texture cache to prevent duplicating GPU textures
const textureCache = new Map();

function createProceduralCanvasTexture(type, hexColor, bumpIntensity = 1) {
  const cacheKey = `${type}_${hexColor}_${bumpIntensity}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, 512, 512);

  if (type === 'wood') {
    // Wood grain procedural pattern
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 512; i += 16) {
      ctx.beginPath();
      ctx.moveTo(0, i + Math.sin(i / 10) * 8);
      ctx.lineTo(512, i + Math.sin(i / 10) * 8);
      ctx.stroke();
    }
    // Planks
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 3;
    for (let x = 0; x <= 512; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
  } else if (type === 'tile') {
    // Ceramic / Slate Tile Grid
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
  } else if (type === 'marble') {
    // Polished Marble Veins
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.bezierCurveTo(150, 180, 300, 200, 512, 450);
    ctx.stroke();
  } else if (type === 'plaster') {
    // Subtly textured plaster wall
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 12 * bumpIntensity;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
      data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);

  textureCache.set(cacheKey, texture);
  return texture;
}

export function getFloorMaterial(materialKey, hexColor) {
  const bumpMap = createProceduralCanvasTexture(
    materialKey.includes('wood') ? 'wood' : materialKey.includes('tile') ? 'tile' : 'marble',
    hexColor
  );

  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hexColor),
    roughness: materialKey.includes('marble') ? 0.25 : 0.65,
    metalness: materialKey.includes('marble') ? 0.1 : 0.05,
    bumpMap: bumpMap,
    bumpScale: 0.02,
    shadowSide: THREE.FrontSide,
  });
}

export function getWallMaterial(materialKey, hexColor) {
  const bumpMap = createProceduralCanvasTexture('plaster', hexColor, 1.2);

  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hexColor),
    roughness: 0.85,
    metalness: 0.02,
    bumpMap: bumpMap,
    bumpScale: 0.015,
    side: THREE.DoubleSide,
  });
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
