/**
 * FURNITURE MODEL GENERATOR
 * Generates high-fidelity GLB models from Three.js geometry.
 * Run with: node scripts/generate-models.mjs
 * 
 * Uses Three.js BufferGeometry serialization and manually builds
 * GLB binary containers since GLTFExporter needs browser APIs.
 */

import * as THREE from 'three';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'public', 'models');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Geometry Helpers ──────────────────────────────────────────

function toFloat32Array(geo) {
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');
  const idx = geo.getIndex();
  return { pos, norm, idx };
}

function hexToRGB(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b, 1.0];
}

/**
 * Build a proper GLB binary from a Three.js Group.
 * This manually constructs the glTF JSON + binary buffer.
 */
function buildGLB(group) {
  const meshes = [];
  group.traverse(child => {
    if (child.isMesh) {
      meshes.push(child);
    }
  });

  if (meshes.length === 0) return null;

  // Collect all geometry data
  const allBufferData = [];
  let byteOffset = 0;
  const accessors = [];
  const bufferViews = [];
  const gltfMeshes = [];
  const gltfNodes = [];
  const gltfMaterials = [];
  const materialMap = new Map();

  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i];
    const geo = mesh.geometry.clone();
    
    // Apply mesh transform to geometry
    geo.applyMatrix4(mesh.matrixWorld);
    
    // Ensure normals
    if (!geo.getAttribute('normal')) {
      geo.computeVertexNormals();
    }

    const posAttr = geo.getAttribute('position');
    const normAttr = geo.getAttribute('normal');
    const indexAttr = geo.getIndex();

    // Get material color
    const mat = mesh.material;
    const color = mat.color ? [mat.color.r, mat.color.g, mat.color.b, 1.0] : [0.5, 0.5, 0.5, 1.0];
    const roughness = mat.roughness ?? 0.5;
    const metalness = mat.metalness ?? 0.1;
    
    const matKey = `${color.join(',')}_${roughness}_${metalness}`;
    let matIdx;
    if (materialMap.has(matKey)) {
      matIdx = materialMap.get(matKey);
    } else {
      matIdx = gltfMaterials.length;
      materialMap.set(matKey, matIdx);
      gltfMaterials.push({
        pbrMetallicRoughness: {
          baseColorFactor: color,
          metallicFactor: metalness,
          roughnessFactor: roughness,
        },
        doubleSided: false,
      });
    }

    // Position buffer
    const posData = new Float32Array(posAttr.array);
    const posBytes = posData.byteLength;
    const posBVIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: posBytes,
      target: 34962 // ARRAY_BUFFER
    });
    
    // Compute bounding box for accessor
    let minPos = [Infinity, Infinity, Infinity];
    let maxPos = [-Infinity, -Infinity, -Infinity];
    for (let j = 0; j < posData.length; j += 3) {
      minPos[0] = Math.min(minPos[0], posData[j]);
      minPos[1] = Math.min(minPos[1], posData[j+1]);
      minPos[2] = Math.min(minPos[2], posData[j+2]);
      maxPos[0] = Math.max(maxPos[0], posData[j]);
      maxPos[1] = Math.max(maxPos[1], posData[j+1]);
      maxPos[2] = Math.max(maxPos[2], posData[j+2]);
    }
    
    const posAccIdx = accessors.length;
    accessors.push({
      bufferView: posBVIdx,
      componentType: 5126, // FLOAT
      count: posAttr.count,
      type: 'VEC3',
      min: minPos,
      max: maxPos,
    });
    allBufferData.push(Buffer.from(posData.buffer));
    byteOffset += posBytes;
    // Pad to 4-byte boundary
    const posPad = (4 - (posBytes % 4)) % 4;
    if (posPad > 0) {
      allBufferData.push(Buffer.alloc(posPad));
      byteOffset += posPad;
      bufferViews[posBVIdx].byteLength = posBytes; // keep original
    }

    // Normal buffer
    const normData = new Float32Array(normAttr.array);
    const normBytes = normData.byteLength;
    const normBVIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: normBytes,
      target: 34962
    });
    const normAccIdx = accessors.length;
    accessors.push({
      bufferView: normBVIdx,
      componentType: 5126,
      count: normAttr.count,
      type: 'VEC3',
    });
    allBufferData.push(Buffer.from(normData.buffer));
    byteOffset += normBytes;
    const normPad = (4 - (normBytes % 4)) % 4;
    if (normPad > 0) {
      allBufferData.push(Buffer.alloc(normPad));
      byteOffset += normPad;
    }

    // Index buffer (if exists)
    const primitive = {
      attributes: {
        POSITION: posAccIdx,
        NORMAL: normAccIdx,
      },
      material: matIdx,
    };

    if (indexAttr) {
      const idxArray = indexAttr.count > 65535
        ? new Uint32Array(indexAttr.array)
        : new Uint16Array(indexAttr.array);
      const idxBytes = idxArray.byteLength;
      const idxBVIdx = bufferViews.length;
      bufferViews.push({
        buffer: 0,
        byteOffset,
        byteLength: idxBytes,
        target: 34963 // ELEMENT_ARRAY_BUFFER
      });
      const idxAccIdx = accessors.length;
      accessors.push({
        bufferView: idxBVIdx,
        componentType: indexAttr.count > 65535 ? 5125 : 5123, // UNSIGNED_INT or UNSIGNED_SHORT
        count: indexAttr.count,
        type: 'SCALAR',
      });
      allBufferData.push(Buffer.from(idxArray.buffer));
      byteOffset += idxBytes;
      const idxPad = (4 - (idxBytes % 4)) % 4;
      if (idxPad > 0) {
        allBufferData.push(Buffer.alloc(idxPad));
        byteOffset += idxPad;
      }
      primitive.indices = idxAccIdx;
    }

    gltfMeshes.push({
      primitives: [primitive],
    });
    
    gltfNodes.push({
      mesh: i,
    });
  }

  // Build glTF JSON
  const gltf = {
    asset: { version: '2.0', generator: 'coworking-model-gen' },
    scene: 0,
    scenes: [{ nodes: gltfNodes.map((_, i) => i) }],
    nodes: gltfNodes,
    meshes: gltfMeshes,
    materials: gltfMaterials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: byteOffset }],
  };

  const jsonStr = JSON.stringify(gltf);
  const jsonBuf = Buffer.from(jsonStr, 'utf8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const jsonChunk = Buffer.concat([
    jsonBuf,
    Buffer.alloc(jsonPad, 0x20), // pad with spaces
  ]);

  const binBuf = Buffer.concat(allBufferData);
  const binPad = (4 - (binBuf.length % 4)) % 4;
  const binChunk = Buffer.concat([
    binBuf,
    Buffer.alloc(binPad, 0x00),
  ]);

  // GLB header: magic + version + total length
  const headerLen = 12;
  const jsonChunkHeaderLen = 8;
  const binChunkHeaderLen = 8;
  const totalLen = headerLen + jsonChunkHeaderLen + jsonChunk.length + binChunkHeaderLen + binChunk.length;

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); // magic: "glTF"
  header.writeUInt32LE(2, 4);          // version
  header.writeUInt32LE(totalLen, 8);   // total length

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // "JSON"

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binChunk.length, 0);
  binChunkHeader.writeUInt32LE(0x004E4942, 4); // "BIN\0"

  return Buffer.concat([header, jsonChunkHeader, jsonChunk, binChunkHeader, binChunk]);
}

// ─── Helper Geometry Factories ─────────────────────────────────

function makeMat(color, roughness = 0.5, metalness = 0.1) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function boxMesh(w, h, d, color, roughness = 0.5, metalness = 0.1) {
  const geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  return new THREE.Mesh(geo, makeMat(color, roughness, metalness));
}

function cylinderMesh(rTop, rBot, h, segs, color, roughness = 0.4, metalness = 0.2) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  return new THREE.Mesh(geo, makeMat(color, roughness, metalness));
}

function sphereMesh(r, color, roughness = 0.4, metalness = 0.2) {
  const geo = new THREE.SphereGeometry(r, 12, 8);
  return new THREE.Mesh(geo, makeMat(color, roughness, metalness));
}

// ─── MODEL BUILDERS ───────────────────────────────────────────

function buildOfficeChair() {
  const group = new THREE.Group();
  const baseColor = '#3a3a42';
  
  // Star base legs
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const leg = boxMesh(0.28, 0.02, 0.04, baseColor, 0.3, 0.6);
    leg.position.set(Math.cos(angle) * 0.14, 0.02, Math.sin(angle) * 0.14);
    leg.rotation.y = angle;
    group.add(leg);
    const caster = sphereMesh(0.022, '#222', 0.4, 0.3);
    caster.position.set(Math.cos(angle) * 0.26, 0.022, Math.sin(angle) * 0.26);
    group.add(caster);
  }
  
  const post = cylinderMesh(0.025, 0.03, 0.22, 10, '#555', 0.3, 0.7);
  post.position.y = 0.2;
  group.add(post);
  
  const seat = boxMesh(0.48, 0.05, 0.48, '#2d2d35', 0.7, 0.05);
  seat.position.y = 0.34;
  group.add(seat);
  
  const cushion = boxMesh(0.42, 0.03, 0.42, '#4a4a52', 0.8, 0.02);
  cushion.position.y = 0.37;
  group.add(cushion);
  
  const back = boxMesh(0.44, 0.38, 0.04, '#3a3a45', 0.7, 0.05);
  back.position.set(0, 0.55, -0.22);
  back.rotation.x = 0.08;
  group.add(back);
  
  const backCushion = boxMesh(0.36, 0.28, 0.025, '#4a4a55', 0.8, 0.02);
  backCushion.position.set(0, 0.53, -0.19);
  backCushion.rotation.x = 0.08;
  group.add(backCushion);
  
  for (const side of [-1, 1]) {
    const armPost = cylinderMesh(0.014, 0.014, 0.13, 8, baseColor, 0.3, 0.6);
    armPost.position.set(side * 0.23, 0.41, -0.05);
    group.add(armPost);
    const armPad = boxMesh(0.05, 0.02, 0.16, '#555', 0.6, 0.1);
    armPad.position.set(side * 0.23, 0.49, -0.05);
    group.add(armPad);
  }
  
  return group;
}

function buildStandingDesk() {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const x = side * 0.75;
    const vert = boxMesh(0.06, 0.65, 0.06, '#3d3d42', 0.3, 0.7);
    vert.position.set(x, 0.325, 0);
    group.add(vert);
    const foot = boxMesh(0.08, 0.03, 0.4, '#3d3d42', 0.3, 0.7);
    foot.position.set(x, 0.015, 0);
    group.add(foot);
  }
  const beam = boxMesh(1.5, 0.035, 0.035, '#3d3d42', 0.3, 0.7);
  beam.position.y = 0.35;
  group.add(beam);
  const desktop = boxMesh(1.8, 0.04, 0.8, '#d0c4b4', 0.4, 0.02);
  desktop.position.y = 0.67;
  group.add(desktop);
  const tray = boxMesh(0.5, 0.03, 0.1, '#555', 0.5, 0.3);
  tray.position.set(0, 0.6, -0.28);
  group.add(tray);
  return group;
}

function buildSimpleDesk() {
  const group = new THREE.Group();
  const positions = [[-0.85, -0.4], [-0.85, 0.4], [0.85, -0.4], [0.85, 0.4]];
  for (const [x, z] of positions) {
    const leg = cylinderMesh(0.022, 0.028, 0.42, 8, '#745a3a', 0.5, 0.05);
    leg.position.set(x, 0.21, z);
    group.add(leg);
  }
  const desktop = boxMesh(1.86, 0.05, 0.9, '#8c6f4a', 0.4, 0.03);
  desktop.position.y = 0.44;
  group.add(desktop);
  const panel = boxMesh(1.82, 0.2, 0.02, '#745a3a', 0.5, 0.05);
  panel.position.set(0, 0.32, -0.44);
  group.add(panel);
  return group;
}

function buildSofa() {
  const group = new THREE.Group();
  const base = boxMesh(1.7, 0.18, 0.72, '#48364e', 0.75, 0.02);
  base.position.set(0, 0.18, 0);
  group.add(base);
  for (const side of [-0.42, 0.42]) {
    const c = boxMesh(0.74, 0.09, 0.58, '#58425e', 0.85, 0.01);
    c.position.set(side, 0.31, 0.03);
    group.add(c);
  }
  const back = boxMesh(1.72, 0.4, 0.11, '#48364e', 0.75, 0.02);
  back.position.set(0, 0.47, -0.31);
  group.add(back);
  for (const side of [-0.42, 0.42]) {
    const bc = boxMesh(0.72, 0.28, 0.07, '#58425e', 0.85, 0.01);
    bc.position.set(side, 0.47, -0.23);
    group.add(bc);
  }
  for (const s of [-1, 1]) {
    const arm = boxMesh(0.09, 0.26, 0.7, '#48364e', 0.75, 0.02);
    arm.position.set(s * 0.86, 0.34, 0);
    group.add(arm);
  }
  for (const x of [-0.76, 0.76]) {
    for (const z of [-0.26, 0.26]) {
      const leg = cylinderMesh(0.018, 0.018, 0.09, 8, '#2a2028', 0.4, 0.3);
      leg.position.set(x, 0.045, z);
      group.add(leg);
    }
  }
  return group;
}

function buildArmchair() {
  const group = new THREE.Group();
  const base = boxMesh(0.7, 0.18, 0.7, '#365072', 0.75, 0.02);
  base.position.set(0, 0.17, 0);
  group.add(base);
  const seat = boxMesh(0.56, 0.08, 0.56, '#446288', 0.85, 0.01);
  seat.position.set(0, 0.3, 0.03);
  group.add(seat);
  const back = boxMesh(0.62, 0.4, 0.09, '#365072', 0.75, 0.02);
  back.position.set(0, 0.46, -0.31);
  back.rotation.x = 0.07;
  group.add(back);
  const bc = boxMesh(0.5, 0.28, 0.05, '#446288', 0.85, 0.01);
  bc.position.set(0, 0.44, -0.25);
  bc.rotation.x = 0.07;
  group.add(bc);
  for (const s of [-1, 1]) {
    const arm = boxMesh(0.09, 0.2, 0.64, '#365072', 0.75, 0.02);
    arm.position.set(s * 0.36, 0.31, 0);
    group.add(arm);
  }
  for (const x of [-0.27, 0.27]) {
    for (const z of [-0.27, 0.27]) {
      const leg = cylinderMesh(0.018, 0.018, 0.08, 8, '#2a2a30', 0.3, 0.5);
      leg.position.set(x, 0.04, z);
      group.add(leg);
    }
  }
  return group;
}

function buildPottedPlant() {
  const group = new THREE.Group();
  const pot = cylinderMesh(0.17, 0.13, 0.22, 12, '#785032', 0.7, 0.05);
  pot.position.y = 0.11;
  group.add(pot);
  const rim = cylinderMesh(0.19, 0.18, 0.025, 12, '#6e4628', 0.7, 0.05);
  rim.position.y = 0.235;
  group.add(rim);
  const soil = cylinderMesh(0.16, 0.16, 0.02, 12, '#3a2a1a', 0.9, 0);
  soil.position.y = 0.22;
  group.add(soil);
  const leafPositions = [
    [0, 0.46, 0, 0.15], [0.07, 0.4, 0.05, 0.11], [-0.07, 0.42, -0.04, 0.12],
    [0.04, 0.52, -0.05, 0.1], [-0.05, 0.5, 0.06, 0.09], [0, 0.58, 0, 0.08],
  ];
  for (const [x, y, z, r] of leafPositions) {
    const leaf = sphereMesh(r, '#2c782c', 0.8, 0.01);
    leaf.position.set(x, y, z);
    group.add(leaf);
  }
  const trunk = cylinderMesh(0.018, 0.022, 0.2, 6, '#5a4020', 0.8, 0.02);
  trunk.position.set(0, 0.33, 0);
  group.add(trunk);
  return group;
}

function buildBookshelf() {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const panel = boxMesh(0.04, 1.5, 0.62, '#58442a', 0.5, 0.03);
    panel.position.set(side * 0.9, 0.75, 0);
    group.add(panel);
  }
  const shelfHeights = [0.02, 0.32, 0.62, 0.92, 1.22, 1.48];
  for (const h of shelfHeights) {
    const shelf = boxMesh(1.76, 0.025, 0.62, '#685234', 0.5, 0.03);
    shelf.position.set(0, h, 0);
    group.add(shelf);
  }
  const backPanel = boxMesh(1.78, 1.5, 0.015, '#4a3a24', 0.6, 0.02);
  backPanel.position.set(0, 0.75, -0.3);
  group.add(backPanel);
  const bookColors = ['#366288', '#b85436', '#467258', '#a84444', '#547294', '#8a6e3e'];
  let bi = 0;
  for (let s = 0; s < 4; s++) {
    const baseY = shelfHeights[s] + 0.025;
    const sh = shelfHeights[s + 1] - shelfHeights[s] - 0.05;
    let x = -0.8;
    while (x < 0.72) {
      const bw = 0.06 + (bi * 37 % 7) * 0.01;
      const bh = sh * (0.6 + (bi * 53 % 10) * 0.04);
      const book = boxMesh(bw, bh, 0.42, bookColors[bi % bookColors.length], 0.7, 0.02);
      book.position.set(x + bw / 2, baseY + bh / 2, 0.02);
      group.add(book);
      x += bw + 0.01;
      bi++;
    }
  }
  return group;
}

function buildFloorLamp() {
  const group = new THREE.Group();
  const basePlate = cylinderMesh(0.14, 0.15, 0.02, 14, '#3a3a40', 0.3, 0.7);
  basePlate.position.y = 0.01;
  group.add(basePlate);
  const pole = cylinderMesh(0.013, 0.016, 1.08, 8, '#333', 0.3, 0.8);
  pole.position.y = 0.55;
  group.add(pole);
  const shade = cylinderMesh(0.02, 0.18, 0.2, 14, '#e8d888', 0.6, 0.05);
  shade.position.y = 1.16;
  group.add(shade);
  const bulb = sphereMesh(0.035, '#fffae0', 0.2, 0.0);
  bulb.position.y = 1.08;
  group.add(bulb);
  return group;
}

function buildCoffeeMachine() {
  const group = new THREE.Group();
  const body = boxMesh(0.48, 0.4, 0.43, '#2c2c30', 0.4, 0.3);
  body.position.set(0, 0.23, 0);
  group.add(body);
  const top = boxMesh(0.4, 0.18, 0.28, '#444', 0.4, 0.3);
  top.position.set(0, 0.53, -0.04);
  group.add(top);
  const tray = boxMesh(0.36, 0.02, 0.28, '#555', 0.3, 0.5);
  tray.position.set(0, 0.04, 0.05);
  group.add(tray);
  const display = boxMesh(0.14, 0.06, 0.01, '#1a3a5a', 0.2, 0.1);
  display.position.set(0, 0.46, 0.22);
  group.add(display);
  for (let i = 0; i < 3; i++) {
    const btn = cylinderMesh(0.013, 0.013, 0.008, 8, '#888', 0.3, 0.5);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(-0.08 + i * 0.08, 0.37, 0.22);
    group.add(btn);
  }
  return group;
}

function buildConfTable() {
  const group = new THREE.Group();
  const top = boxMesh(2.8, 0.055, 1.8, '#664c36', 0.35, 0.04);
  top.position.set(0, 0.39, 0);
  group.add(top);
  for (const side of [-1, 1]) {
    const ped = boxMesh(0.15, 0.35, 1.1, '#463224', 0.4, 0.05);
    ped.position.set(side * 1.02, 0.18, 0);
    group.add(ped);
    const foot = boxMesh(0.28, 0.025, 1.3, '#463224', 0.4, 0.05);
    foot.position.set(side * 1.02, 0.013, 0);
    group.add(foot);
  }
  return group;
}

function buildRoundTable() {
  const group = new THREE.Group();
  const pedestal = cylinderMesh(0.055, 0.09, 0.35, 10, '#745a3a', 0.45, 0.05);
  pedestal.position.y = 0.175;
  group.add(pedestal);
  const base = cylinderMesh(0.17, 0.19, 0.025, 14, '#745a3a', 0.45, 0.05);
  base.position.y = 0.013;
  group.add(base);
  const top = cylinderMesh(0.38, 0.38, 0.035, 20, '#8c6f4a', 0.4, 0.03);
  top.position.y = 0.38;
  group.add(top);
  return group;
}

function buildFilingCabinet() {
  const group = new THREE.Group();
  const body = boxMesh(0.58, 0.83, 0.58, '#55555d', 0.4, 0.4);
  body.position.set(0, 0.415, 0);
  group.add(body);
  for (let i = 0; i < 3; i++) {
    const dy = 0.13 + i * 0.25;
    const face = boxMesh(0.5, 0.19, 0.015, '#777780', 0.35, 0.45);
    face.position.set(0, dy, 0.29);
    group.add(face);
    const handle = boxMesh(0.1, 0.015, 0.015, '#999', 0.2, 0.7);
    handle.position.set(0, dy, 0.31);
    group.add(handle);
  }
  return group;
}

function buildLDesk() {
  const group = new THREE.Group();
  const mainTop = boxMesh(1.84, 0.04, 0.88, '#785e3a', 0.4, 0.03);
  mainTop.position.set(0, 0.43, -0.44);
  group.add(mainTop);
  const sideTop = boxMesh(0.88, 0.04, 0.94, '#785e3a', 0.4, 0.03);
  sideTop.position.set(-0.48, 0.43, 0.44);
  group.add(sideTop);
  const legPositions = [[-0.86, -0.84], [0.86, -0.84], [-0.86, 0.86], [-0.04, -0.02]];
  for (const [x, z] of legPositions) {
    const leg = boxMesh(0.05, 0.42, 0.05, '#58442a', 0.5, 0.05);
    leg.position.set(x, 0.21, z);
    group.add(leg);
  }
  return group;
}

function buildBeanBag() {
  const group = new THREE.Group();
  const body = sphereMesh(0.28, '#aa5a32', 0.85, 0.01);
  body.scale.set(1, 0.6, 1);
  body.position.y = 0.17;
  group.add(body);
  const back = sphereMesh(0.2, '#964e2a', 0.85, 0.01);
  back.scale.set(1, 0.65, 0.55);
  back.position.set(0, 0.3, -0.08);
  group.add(back);
  return group;
}

function buildWaterCooler() {
  const group = new THREE.Group();
  const base = boxMesh(0.4, 0.53, 0.4, '#b8c4d0', 0.4, 0.3);
  base.position.set(0, 0.265, 0);
  group.add(base);
  const jug = cylinderMesh(0.13, 0.13, 0.36, 10, '#4488cc', 0.15, 0.05);
  jug.position.y = 0.72;
  group.add(jug);
  const cap = cylinderMesh(0.04, 0.13, 0.035, 10, '#3377bb', 0.2, 0.05);
  cap.position.y = 0.55;
  group.add(cap);
  const tray = boxMesh(0.18, 0.025, 0.1, '#999', 0.3, 0.5);
  tray.position.set(0, 0.14, 0.24);
  group.add(tray);
  return group;
}

function buildMiniFridge() {
  const group = new THREE.Group();
  const body = boxMesh(0.58, 0.73, 0.56, '#28282c', 0.4, 0.35);
  body.position.set(0, 0.365, 0);
  group.add(body);
  const handle = boxMesh(0.025, 0.16, 0.025, '#888', 0.2, 0.7);
  handle.position.set(0.21, 0.43, 0.295);
  group.add(handle);
  return group;
}

// ─── EXPORT ALL MODELS ─────────────────────────────────────────

const MODELS = {
  'office-chair': buildOfficeChair,
  'standing-desk': buildStandingDesk,
  'simple-desk': buildSimpleDesk,
  'sofa': buildSofa,
  'armchair': buildArmchair,
  'potted-plant': buildPottedPlant,
  'bookshelf': buildBookshelf,
  'floor-lamp': buildFloorLamp,
  'coffee-machine': buildCoffeeMachine,
  'conf-table': buildConfTable,
  'round-table': buildRoundTable,
  'filing-cabinet': buildFilingCabinet,
  'l-desk': buildLDesk,
  'bean-bag': buildBeanBag,
  'water-cooler': buildWaterCooler,
  'mini-fridge': buildMiniFridge,
};

console.log('Generating furniture models...\n');

for (const [name, builder] of Object.entries(MODELS)) {
  const group = builder();
  // Update world matrices before export
  group.updateMatrixWorld(true);
  
  const glb = buildGLB(group);
  if (glb) {
    const outputPath = path.join(OUTPUT_DIR, `${name}.glb`);
    fs.writeFileSync(outputPath, glb);
    console.log(`  ✓ ${name}.glb (${(glb.length / 1024).toFixed(1)} KB)`);
  } else {
    console.log(`  ✗ ${name}: no meshes found`);
  }
}

console.log(`\nDone! ${Object.keys(MODELS).length} models written to ${OUTPUT_DIR}`);
