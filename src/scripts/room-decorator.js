import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { animate as animeAnimate, stagger, remove as animeRemove } from 'animejs';
import { CATEGORIES, FLOOR_MATS, WALL_MATS, FURNITURE, PRESETS, SVG_ICONS } from './catalog-data.js';
import { getFloorMaterial, getWallMaterial, getFurnitureMaterial } from './utils/materials.js';
import { checkAABBCollision, checkGridBounds } from './utils/collision.js';
import { exportRoomLayoutJSON, openJSONImportPicker } from './utils/export-import.js';
import { disposeScene } from './utils/cleanup.js';
import { fetchRoomState, saveRoomState, subscribeToRoom } from './backend.js';
import '/css/style.css';

/* ═══════════════════════════════════════════════════════════════
   ROOM DECORATOR ENGINE — DUAL MODE (THREE.JS 3D + CANVAS 2D FALLBACK)
   ═══════════════════════════════════════════════════════════════ */

const CELL = 1;
const WALL_H = 3.2;
let GRID_W = 8;
let GRID_D = 6;

let state = { floor:'light-wood', leftWall:'white', rightWall:'warm-beige', items:[], nextId:1, gridW:8, gridD:6 };
let mode = 'idle';
let placingType = null, placingRot = 0;
let selectedId = null;
let ghostPos = null;
let currentZoom = 1.0;

let controls = null;
let animFrameId = null;
let gltfLoader = new GLTFLoader();
let composer = null;
let postProcessingEnabled = true;

// First-person walkthrough mode
let isFirstPerson = false;
let fpControls = null;
let moveState = { forward: false, backward: false, left: false, right: false };
let savedOrbitState = null;
const FP_SPEED = 3.0;
const FP_EYE_HEIGHT = 1.6;
const fpVelocity = new THREE.Vector3();
const fpDirection = new THREE.Vector3();
let fpClock = new THREE.Clock();

let draggingItem = null;
let itemDragStartPos = null;
let isItemMoved = false;

// Surface Selection meshes
let leftWallMesh = null, rightWallMesh = null;

// Undo stack
let history = [], histIdx = -1;

const params = new URLSearchParams(location.search);
const ROOM_ID = params.get('room') || 'default-room';
const ROOM_NAME = decodeURIComponent(params.get('name') || 'Room Decorator');
const ACCESS_MODE = params.get('mode') || 'edit'; // 'edit' for Admin, 'view' for User
const STATE_KEY = 'cw_room_' + ROOM_ID;

let isWebGL = false;
let canvas2D = null, ctx2D = null;

function saveState(){
  saveRoomState(ROOM_ID, state);
}

async function loadState(){
  const remoteState = await fetchRoomState(ROOM_ID);
  if (remoteState) {
    Object.assign(state, remoteState);
    GRID_W = state.gridW || 8;
    GRID_D = state.gridD || 6;
  }
}

function applyPreset(presetId) {
  if (typeof PRESETS === 'undefined') return;
  const preset = PRESETS.find(p => p.id === presetId);
  if (!preset) return;
  state.floor = preset.floor;
  state.leftWall = preset.leftWall;
  state.rightWall = preset.rightWall;
  state.gridW = preset.gridW;
  state.gridD = preset.gridD;
  GRID_W = preset.gridW;
  GRID_D = preset.gridD;
  state.items = JSON.parse(JSON.stringify(preset.items));
  state.nextId = state.items.length + 1;
  selectedId = null;
  saveState();
  updateCanvasResizersUI();
  buildSidebar();
  if (isWebGL && scene) {
    buildRoom();
    rebuildItems();
  } else {
    renderCanvas2D();
  }
  pushHistory();
  showToast(`Loaded ${preset.name}`);
}

function clearRoom() {
  state.items = [];
  selectedId = null;
  saveState();
  if (isWebGL && scene) rebuildItems();
  else renderCanvas2D();
  pushHistory();
  showToast('Cleared all items');
}

function pushHistory(){
  const snap=JSON.stringify({items:state.items,nextId:state.nextId});
  history=history.slice(0,histIdx+1); history.push(snap);
  if(history.length>50){history.shift();histIdx--;}
  histIdx=history.length-1; updateUndoRedo();
}

function undo(){
  if(histIdx<=0)return; histIdx--;
  const s=JSON.parse(history[histIdx]); state.items=s.items; state.nextId=s.nextId;
  selectedId=null; saveState(); 
  if(isWebGL) rebuildItems(); else renderCanvas2D();
  updateToolbar(); showToast('Undo');
}

function redo(){
  if(histIdx>=history.length-1)return; histIdx++;
  const s=JSON.parse(history[histIdx]); state.items=s.items; state.nextId=s.nextId;
  selectedId=null; saveState(); 
  if(isWebGL) rebuildItems(); else renderCanvas2D();
  updateToolbar(); showToast('Redo');
}

function updateUndoRedo(){
  const uBtn = document.getElementById('undo-btn');
  const rBtn = document.getElementById('redo-btn');
  if(uBtn) uBtn.disabled = histIdx<=0;
  if(rBtn) rBtn.disabled = histIdx>=history.length-1;
}

function updateToolbar() {
  updateUndoRedo();
  const rotBtn = document.getElementById('rotate-btn');
  const delBtn = document.getElementById('delete-btn');
  if (rotBtn) rotBtn.disabled = !selectedId && mode !== 'placing';
  if (delBtn) delBtn.disabled = !selectedId;
}

/* Three.js Engine Variables */
let container, scene, camera, renderer, hemiLight, dirLight;
let roomGroup, itemsGroup, ghostGroup, highlightGroup;
let raycaster, mouse, floorPlane;

function getGridFromMouse(e) {
  if (!renderer || !camera || !raycaster || !floorPlane) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const target = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(floorPlane, target)) {
    const gx = Math.floor(target.x);
    const gz = Math.floor(target.z);
    return { gx, gz };
  }
  return null;
}

function initThreeEngine() {
  if (typeof THREE === 'undefined') return false;

  try {
    container = document.getElementById('canvas-area');
    if (!container) return false;

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#eaf0f6');

    const w = container.clientWidth || window.innerWidth || 800;
    const h = container.clientHeight || (window.innerHeight - 52) || 600;
    const aspect = (w > 0 && h > 0) ? (w / h) : (16 / 9);

    const maxDim = Math.max(GRID_W, GRID_D);
    const cx = GRID_W / 2;
    const cz = GRID_D / 2;

    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(cx + maxDim * 1.4, maxDim * 1.4, cz + maxDim * 1.4);
    camera.lookAt(cx, 0.5, cz);

    renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:'high-performance' });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    container.appendChild(renderer.domElement);

    // Three.js OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(cx, 0.5, cz);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 3;
    controls.maxDistance = 45;
    controls.update();

    hemiLight = new THREE.HemisphereLight(0xffffff, 0x3d3d4e, 0.55);
    scene.add(hemiLight);

    dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(15, 24, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    dirLight.shadow.camera.left = -30; dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30; dirLight.shadow.camera.bottom = -30;
    dirLight.shadow.camera.near = 0.5; dirLight.shadow.camera.far = 150;
    scene.add(dirLight);

    // ── HDRI Environment Map (async — scene renders immediately, upgrades when loaded)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    new RGBELoader().load('/hdri/studio_small.hdr', (hdrTexture) => {
      const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
      scene.environment = envMap;
      hdrTexture.dispose();
      pmremGenerator.dispose();
    });

    roomGroup = new THREE.Group(); scene.add(roomGroup);
    itemsGroup = new THREE.Group(); scene.add(itemsGroup);
    ghostGroup = new THREE.Group(); scene.add(ghostGroup);
    highlightGroup = new THREE.Group(); scene.add(highlightGroup);

    // ── Post-Processing Pipeline ────────────────────────────────────
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));

      // Bloom pass tuned to threshold 1.0 so background and walls do NOT bloom into fog
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        0.06,  // strength — subtle highlights only
        0.25,  // radius
        1.0    // threshold — threshold >= 1.0 prevents background/wall bloom fog
      );
      composer.addPass(bloomPass);

      // OutputPass for correct color space output
      composer.addPass(new OutputPass());
    } catch (e) {
      console.warn('Post-processing setup failed, using direct rendering:', e);
      composer = null;
      postProcessingEnabled = false;
    }

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    floorPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);

    renderer.domElement.addEventListener('mousemove', e => {
      const grid = getGridFromMouse(e);
      if(!grid) return;
      ghostPos = grid;

      if(draggingItem && grid){
        if(controls) controls.enabled = false;
        if(canPlace(draggingItem.type, grid.gx, grid.gz, draggingItem.rotation, draggingItem.id)){
          if(draggingItem.gx !== grid.gx || draggingItem.gy !== grid.gz){
            draggingItem.gx = grid.gx;
            draggingItem.gy = grid.gz;
            isItemMoved = true;
            rebuildItems();
          }
        }
        renderer.domElement.style.cursor = 'move';
        return;
      }

      updateGhost();

      if(mode==='placing'){
        renderer.domElement.style.cursor = 'crosshair';
      } else {
        // Hover raycasting against walls or floor
        raycaster.setFromCamera(mouse, camera);
        const wallIntersects = raycaster.intersectObjects([leftWallMesh, rightWallMesh].filter(Boolean));
        const onFloor = isOnFloor(grid.gx, grid.gz);
        const hoveredItem = onFloor ? getItemAt(grid.gx, grid.gz) : null;

        if(hoveredItem || wallIntersects.length > 0){
          renderer.domElement.style.cursor = 'pointer';
        } else {
          renderer.domElement.style.cursor = 'default';
        }
      }
    });

    renderer.domElement.addEventListener('mousedown', e => {
      if (ACCESS_MODE === 'view') return;

      const grid = getGridFromMouse(e);

      // Right Click -> Delete item or Cancel Placement
      if(e.button === 2){
        e.preventDefault();
        closeSurfacePopover();
        if(mode === 'placing'){
          cancelPlacing();
        } else if(grid && isOnFloor(grid.gx, grid.gz)){
          const targetItem = getItemAt(grid.gx, grid.gz);
          if(targetItem){
            selectedId = targetItem.id;
            deleteSelected();
          } else {
            selectedId = null;
            updateSelection();
            updateToolbar();
          }
        }
        return;
      }

      // Left Click -> Raycast Walls, Floor, or Furniture Drag
      if(e.button === 0){
        raycaster.setFromCamera(mouse, camera);

        // Check wall raycasting first
        const wallIntersects = raycaster.intersectObjects([leftWallMesh, rightWallMesh].filter(Boolean));
        if(mode === 'idle' && wallIntersects.length > 0){
          const hitMesh = wallIntersects[0].object;
          if(hitMesh === leftWallMesh){
            openSurfacePopover('leftWall');
            return;
          } else if(hitMesh === rightWallMesh){
            openSurfacePopover('rightWall');
            return;
          }
        }

        if(mode === 'placing' && placingType && grid){
          if(canPlace(placingType, grid.gx, grid.gz, placingRot)){
            const def = FURNITURE[placingType];
            state.items.push({
              id:'item-'+state.nextId++,
              type:placingType,
              gx:grid.gx, gy:grid.gz,
              rotation: placingRot,
            });
            pushHistory(); saveState(); rebuildItems();
            showToast(`Placed ${def.name}`);
          } else {
            showToast('Cannot place here — obstacle');
          }
          return;
        }

        const clickedItem = (grid && isOnFloor(grid.gx, grid.gz)) ? getItemAt(grid.gx, grid.gz) : null;

        if(clickedItem){
          closeSurfacePopover();
          selectedId = clickedItem.id;
          draggingItem = clickedItem;
          itemDragStartPos = { gx: clickedItem.gx, gy: clickedItem.gy };
          isItemMoved = false;
          if (controls) controls.enabled = false;
          updateSelection();
          updateToolbar();
          const name = FURNITURE[clickedItem.type]?.name || 'Item';
          setStatus(`Dragging ${name}`);
        } else if(grid && isOnFloor(grid.gx, grid.gz) && mode === 'idle'){
          // Clicked empty floor space -> Open Floor Material Picker
          openSurfacePopover('floor');
        } else {
          closeSurfacePopover();
          selectedId = null;
          updateSelection();
          updateToolbar();
          setStatus('Ready');
        }
      }
    });

    window.addEventListener('mouseup', e => {
      if(e.button === 0){
        if(draggingItem){
          if(isItemMoved){
            pushHistory();
            saveState();
            const name = FURNITURE[draggingItem.type]?.name || 'Item';
            showToast(`Moved ${name}`);
          }
          draggingItem = null;
          isItemMoved = false;
          renderer.domElement.style.cursor = 'default';
        }
        if (controls) controls.enabled = true;
      }
    });

    renderer.domElement.addEventListener('mouseleave', () => {
      ghostPos = null;
      updateGhost();
    });

    renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

    isWebGL = true;
    return true;
  } catch (err) {
    console.warn('WebGL initialization failed, falling back to 2D Isometric Engine:', err);
    isWebGL = false;
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ROOM GEOMETRY (3D WEBGL)
   ═══════════════════════════════════════════════════════════════ */
function buildRoom(){
  if(!roomGroup) return;
  while(roomGroup.children.length) roomGroup.remove(roomGroup.children[0]);

  const fm = FLOOR_MATS[state.floor] || FLOOR_MATS['light-wood'];
  const lwm = WALL_MATS[state.leftWall] || WALL_MATS['white'];
  const rwm = WALL_MATS[state.rightWall] || WALL_MATS['warm-beige'];

  for(let x=0; x<GRID_W; x++){
    for(let z=0; z<GRID_D; z++){
      const isAlt = (x+z)%2===0;
      const col = isAlt ? fm.hex : fm.alt;
      const geo = new THREE.BoxGeometry(0.98, 0.06, 0.98);
      const mat = getFloorMaterial(state.floor, col);
      const tile = new THREE.Mesh(geo, mat);
      tile.position.set(x+0.5, -0.03, z+0.5);
      tile.receiveShadow = true;
      roomGroup.add(tile);
    }
  }

  const subGeo = new THREE.BoxGeometry(GRID_W+0.2, 0.15, GRID_D+0.2);
  const subMat = new THREE.MeshStandardMaterial({color:'#14141a', roughness:0.9});
  const subFloor = new THREE.Mesh(subGeo, subMat);
  subFloor.position.set(GRID_W/2, -0.135, GRID_D/2);
  roomGroup.add(subFloor);

  const lwGeo = new THREE.BoxGeometry(0.1, WALL_H, GRID_D);
  const lwMat = getWallMaterial(state.leftWall, lwm.hex);
  leftWallMesh = new THREE.Mesh(lwGeo, lwMat);
  leftWallMesh.position.set(-0.05, WALL_H/2, GRID_D/2);
  leftWallMesh.receiveShadow = !lwm.transparent;
  roomGroup.add(leftWallMesh);

  const rwGeo = new THREE.BoxGeometry(GRID_W, WALL_H, 0.1);
  const rwMat = getWallMaterial(state.rightWall, rwm.hex);
  rightWallMesh = new THREE.Mesh(rwGeo, rwMat);
  rightWallMesh.position.set(GRID_W/2, WALL_H/2, -0.05);
  rightWallMesh.receiveShadow = !rwm.transparent;
  roomGroup.add(rightWallMesh);

  const blGeo = new THREE.BoxGeometry(0.12, 0.12, GRID_D+0.1);
  const blMat = new THREE.MeshStandardMaterial({color:'#3a3a42', roughness:0.5});
  const bl = new THREE.Mesh(blGeo, blMat);
  bl.position.set(0.01, 0.06, GRID_D/2);
  roomGroup.add(bl);

  const brGeo = new THREE.BoxGeometry(GRID_W+0.1, 0.12, 0.12);
  const brMat = new THREE.MeshStandardMaterial({color:'#3a3a42', roughness:0.5});
  const br = new THREE.Mesh(brGeo, brMat);
  br.position.set(GRID_W/2, 0.06, 0.01);
  roomGroup.add(br);

  const cpGeo = new THREE.BoxGeometry(0.14, WALL_H+0.05, 0.14);
  const cpMat = new THREE.MeshStandardMaterial({color:'#666670', roughness:0.4});
  const cp = new THREE.Mesh(cpGeo, cpMat);
  cp.position.set(-0.02, WALL_H/2, -0.02);
  roomGroup.add(cp);

  const cmGeo1 = new THREE.BoxGeometry(0.14, 0.08, GRID_D+0.1);
  const cmMat = new THREE.MeshStandardMaterial({color:'#888894', roughness:0.4});
  const cm1 = new THREE.Mesh(cmGeo1, cmMat);
  cm1.position.set(0.02, WALL_H+0.01, GRID_D/2);
  roomGroup.add(cm1);

  const cmGeo2 = new THREE.BoxGeometry(GRID_W+0.1, 0.08, 0.14);
  const cm2Mat = new THREE.MeshStandardMaterial({color:'#888894', roughness:0.4});
  const cm2Mesh = new THREE.Mesh(cmGeo2, cm2Mat);
  cm2Mesh.position.set(GRID_W/2, WALL_H+0.01, 0.02);
  roomGroup.add(cm2Mesh);

  const gridLineMat = new THREE.LineBasicMaterial({color:0x000000, transparent:true, opacity:0.12});
  for(let x=0; x<=GRID_W; x++){
    const pts = [new THREE.Vector3(x,0.005,0), new THREE.Vector3(x,0.005,GRID_D)];
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    roomGroup.add(new THREE.Line(g, gridLineMat));
  }
  for(let z=0; z<=GRID_D; z++){
    const pts = [new THREE.Vector3(0,0.005,z), new THREE.Vector3(GRID_W,0.005,z)];
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    roomGroup.add(new THREE.Line(g, gridLineMat));
  }

  updateCamera();
}

function updateCamera(){
  if(!camera) return;
  const maxDim = Math.max(GRID_W, GRID_D);
  const cx = GRID_W / 2;
  const cz = GRID_D / 2;
  
  if(container && camera && camera.isPerspectiveCamera){
    const w = container.clientWidth || window.innerWidth || 800;
    const h = container.clientHeight || (window.innerHeight - 52) || 600;
    const aspect = (w > 0 && h > 0) ? (w / h) : (16 / 9);
    if (camera.aspect !== aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
  }

  if (controls) {
    controls.target.set(cx, 0.5, cz);
    controls.update();
  }

  if(dirLight){
    const shadowR = Math.max(30, maxDim * 3);
    dirLight.position.set(cx + 15, 25, cz + 15);
    dirLight.target.position.set(cx, 0, cz);
    dirLight.shadow.camera.left = -shadowR;
    dirLight.shadow.camera.right = shadowR;
    dirLight.shadow.camera.top = shadowR;
    dirLight.shadow.camera.bottom = -shadowR;
    dirLight.shadow.camera.updateProjectionMatrix();
    if(dirLight.target.parent !== scene) scene.add(dirLight.target);
  }
}

/* ═══════════════════════════════════════════════════════════════
   ANIME.JS V4 COMPATIBILITY HELPER
   ═══════════════════════════════════════════════════════════════ */
function safeAnimate(targets, params) {
  if (typeof animeAnimate !== 'function') return;
  const opts = { ...params };
  if (opts.easing && !opts.ease) opts.ease = opts.easing;
  try {
    return animeAnimate(targets, opts);
  } catch (err) {
    console.warn('Anime.js animation fallback:', err);
  }
}

function safeStagger(val, options) {
  try {
    if (typeof stagger === 'function') {
      return stagger(val, options);
    }
  } catch (_) {}
  return 0;
}

/* ═══════════════════════════════════════════════════════════════
   SURFACE MATERIAL POPOVER (INTERACTIVE WALL & FLOOR CLICKING)
   ═══════════════════════════════════════════════════════════════ */
function openSurfacePopover(type) {
  const popover = document.getElementById('surface-popover');
  const title = document.getElementById('surface-title');
  const swatchList = document.getElementById('surface-swatch-list');
  if (!popover || !swatchList) return;

  let label = 'Surface Material';
  let mats = {};
  let currentKey = '';

  if (type === 'leftWall') {
    label = 'Left Wall Paint';
    mats = WALL_MATS;
    currentKey = state.leftWall;
  } else if (type === 'rightWall') {
    label = 'Right Wall Paint';
    mats = WALL_MATS;
    currentKey = state.rightWall;
  } else if (type === 'floor') {
    label = 'Floor Finish';
    mats = FLOOR_MATS;
    currentKey = state.floor;
  }

  if (title) title.textContent = label;

  let html = '';
  for (const [id, m] of Object.entries(mats)) {
    html += `<div class="swatch${currentKey === id ? ' active' : ''}" data-popover-type="${type}" data-swatch-id="${id}" title="${m.name}" style="background:${m.hex}"></div>`;
  }
  swatchList.innerHTML = html;

  swatchList.querySelectorAll('.swatch').forEach(s => {
    s.addEventListener('click', () => {
      const sType = s.dataset.popoverType;
      const sId = s.dataset.swatchId;

      if (sType === 'leftWall') state.leftWall = sId;
      else if (sType === 'rightWall') state.rightWall = sId;
      else if (sType === 'floor') state.floor = sId;

      saveState();
      if (isWebGL) buildRoom(); else renderCanvas2D();
      showToast(`${mats[sId].name} applied`);
      closeSurfacePopover();
    });
  });

  popover.classList.add('active');
  if (typeof anime !== 'undefined') {
    safeAnimate(popover, {
      scale: [0.8, 1],
      opacity: [0, 1],
      duration: 400,
      ease: 'outQuint'
    });
    safeAnimate(swatchList.querySelectorAll('.swatch'), {
      scale: [0, 1],
      delay: safeStagger(25),
      duration: 350,
      ease: 'outBack'
    });
  }
}

function closeSurfacePopover() {
  const popover = document.getElementById('surface-popover');
  if (!popover || !popover.classList.contains('active')) return;
  if (typeof anime !== 'undefined') {
    safeAnimate(popover, {
      scale: [1, 0.85],
      opacity: [1, 0],
      duration: 200,
      ease: 'inQuad',
      onComplete: () => popover.classList.remove('active'),
      complete: () => popover.classList.remove('active')
    });
  } else {
    popover.classList.remove('active');
  }
}

const closeBtn = document.getElementById('close-surface-btn');
if (closeBtn) closeBtn.addEventListener('click', closeSurfacePopover);

/* ═══════════════════════════════════════════════════════════════
   ON-CANVAS ROOM RESIZERS (WIDTH & DEPTH HANDLES)
   ═══════════════════════════════════════════════════════════════ */
function setupCanvasResizers() {
  const sizeW = document.getElementById('canvas-size-w');
  const sizeD = document.getElementById('canvas-size-d');
  const valW = document.getElementById('resizer-w-val');
  const valD = document.getElementById('resizer-d-val');

  if (sizeW) {
    sizeW.value = GRID_W;
    if (valW) valW.textContent = GRID_W;
    sizeW.addEventListener('input', () => {
      GRID_W = parseInt(sizeW.value);
      state.gridW = GRID_W;
      if (valW) valW.textContent = GRID_W;
      state.items = state.items.filter(item => {
        const d = getRotDims(item.type, item.rotation);
        return item.gx + d.gw <= GRID_W && item.gy + d.gd <= GRID_D;
      });
      saveState();
      if (isWebGL) { buildRoom(); rebuildItems(); } else renderCanvas2D();
      showToast(`Width: ${GRID_W}m`);
    });
  }

  if (sizeD) {
    sizeD.value = GRID_D;
    if (valD) valD.textContent = GRID_D;
    sizeD.addEventListener('input', () => {
      GRID_D = parseInt(sizeD.value);
      state.gridD = GRID_D;
      if (valD) valD.textContent = GRID_D;
      state.items = state.items.filter(item => {
        const d = getRotDims(item.type, item.rotation);
        return item.gx + d.gw <= GRID_W && item.gy + d.gd <= GRID_D;
      });
      saveState();
      if (isWebGL) { buildRoom(); rebuildItems(); } else renderCanvas2D();
      showToast(`Depth: ${GRID_D}m`);
    });
  }
}

function updateCanvasResizersUI() {
  const sizeW = document.getElementById('canvas-size-w');
  const sizeD = document.getElementById('canvas-size-d');
  const valW = document.getElementById('resizer-w-val');
  const valD = document.getElementById('resizer-d-val');
  if (sizeW) sizeW.value = GRID_W;
  if (sizeD) sizeD.value = GRID_D;
  if (valW) valW.textContent = GRID_W;
  if (valD) valD.textContent = GRID_D;
}

/* ═══════════════════════════════════════════════════════════════
   GLTF MODEL CACHE — loads once, clones per instance
   ═══════════════════════════════════════════════════════════════ */
const modelCache = new Map();       // modelUrl → THREE.Group (template)
const modelLoadingSet = new Set();  // URLs currently being fetched

function loadAndCacheModel(modelUrl) {
  if (modelCache.has(modelUrl) || modelLoadingSet.has(modelUrl)) return;
  modelLoadingSet.add(modelUrl);
  gltfLoader.load(modelUrl, (gltf) => {
    const template = gltf.scene;
    template.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    modelCache.set(modelUrl, template);
    modelLoadingSet.delete(modelUrl);
    // Rebuild so any items waiting for this model get the real mesh
    rebuildItems();
  }, undefined, (err) => {
    console.warn(`Failed to load model ${modelUrl}:`, err);
    modelLoadingSet.delete(modelUrl);
  });
}

function createGLTFMesh(def, gx, gz, rotation, opacity) {
  const modelUrl = def.modelUrl;
  const template = modelCache.get(modelUrl);
  if (!template) {
    // Kick off async load; caller will use primitive fallback for now
    loadAndCacheModel(modelUrl);
    return null;
  }

  const clone = template.clone(true);
  // Deep-clone materials so instances don't share mutation
  clone.traverse(child => {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
      if (opacity != null && opacity < 1) {
        child.material.transparent = true;
        child.material.opacity = opacity;
      }
    }
  });

  // Compute model AABB and scale to fit the grid cell dimensions
  const box = new THREE.Box3().setFromObject(clone);
  const modelSize = box.getSize(new THREE.Vector3());
  const modelCenter = box.getCenter(new THREE.Vector3());

  const targetW = def.gw;
  const targetD = def.gd;
  const scaleX = modelSize.x > 0.001 ? targetW / modelSize.x : 1;
  const scaleZ = modelSize.z > 0.001 ? targetD / modelSize.z : 1;
  const uniformScale = Math.min(scaleX, scaleZ);
  clone.scale.setScalar(uniformScale);

  // Recalculate after scale
  const scaledBox = new THREE.Box3().setFromObject(clone);
  const scaledSize = scaledBox.getSize(new THREE.Vector3());
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

  // Center the model within the grid cell and sit it on the floor
  let gw = def.gw, gd = def.gd;
  const rotSteps = ((rotation||0)/90)%4;
  for(let i=0;i<rotSteps;i++){ const t=gw; gw=gd; gd=t; }

  const wrapper = new THREE.Group();
  clone.position.set(
    -scaledCenter.x + gw / 2,
    -scaledBox.min.y,
    -scaledCenter.z + gd / 2
  );
  wrapper.add(clone);

  // Apply rotation around the center of the grid footprint
  if (rotSteps > 0) {
    const pivot = new THREE.Group();
    clone.position.x -= gw / 2;
    clone.position.z -= gd / 2;
    pivot.add(clone);
    pivot.rotation.y = -rotSteps * (Math.PI / 2);
    pivot.position.set(gw / 2, 0, gd / 2);
    wrapper.add(pivot);
  }

  wrapper.position.set(gx, 0, gz);
  wrapper.userData = { type: null, gx, gz, gw, gd, rotation: rotation||0 };
  return wrapper;
}

/* ═══════════════════════════════════════════════════════════════
   FURNITURE MESH (3D WEBGL) — GLTF models with primitive fallback
   ═══════════════════════════════════════════════════════════════ */
function createFurnitureMesh(type, gx, gz, rotation, opacity){
  if(typeof FURNITURE === 'undefined') return null;
  const def = FURNITURE[type];
  if(!def) return null;

  // Try GLTF model first
  if (def.modelUrl) {
    const gltfMesh = createGLTFMesh(def, gx, gz, rotation, opacity);
    if (gltfMesh) {
      gltfMesh.userData.type = type;
      return gltfMesh;
    }
    // Model not loaded yet — fall through to primitive
  }

  // ── Primitive fallback (original box-based rendering) ──
  const group = new THREE.Group();
  const alpha = opacity != null ? opacity : 1;

  let gw = def.gw, gd = def.gd;
  const rotSteps = ((rotation||0)/90)%4;

  def.parts.forEach(p => {
    let px=p.dx, pz=p.dy, pw=p.w, pd=p.d;
    let rpx=px, rpz=pz, rpw=pw, rpd=pd;
    let rgw=def.gw, rgd=def.gd;
    for(let i=0;i<rotSteps;i++){
      const newpx = rgd - rpz - rpd;
      const newpz = rpx;
      const newpw = rpd;
      const newpd = rpw;
      rpx=newpx; rpz=newpz; rpw=newpw; rpd=newpd;
      const tmp=rgw; rgw=rgd; rgd=tmp;
    }

    const isGlassPart = ['#7ac8e2', '#b2d4e0', '#78b0d0', '#90c8e8', '#7aa4c4'].includes(p.color.toLowerCase());
    const partAlpha = isGlassPart ? 0.45 * alpha : alpha;

    const geo = new THREE.BoxGeometry(rpw, p.h, rpd);
    const mat = new THREE.MeshStandardMaterial({
      color: p.color,
      roughness: isGlassPart ? 0.1 : 0.55,
      metalness: isGlassPart ? 0.9 : 0.08,
      transparent: partAlpha < 1,
      opacity: partAlpha,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(rpx + rpw/2, p.dz + p.h/2, rpz + rpd/2);
    mesh.castShadow = !isGlassPart;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  gw = def.gw; gd = def.gd;
  for(let i=0;i<rotSteps;i++){ const t=gw; gw=gd; gd=t; }

  group.position.set(gx, 0, gz);
  group.userData = { type, gx, gz, gw, gd, rotation: rotation||0 };
  return group;
}

function rebuildItems(){
  if(!itemsGroup) return;
  while(itemsGroup.children.length) {
    const c = itemsGroup.children[0];
    disposeGroup(c);
    itemsGroup.remove(c);
  }
  state.items.forEach(item => {
    const mesh = createFurnitureMesh(item.type, item.gx, item.gy, item.rotation);
    if(mesh){ mesh.userData.itemId = item.id; itemsGroup.add(mesh); }
  });
  updateSelection();
}

function disposeGroup(group){
  group.traverse(child => {
    if(child.geometry) child.geometry.dispose();
    if(child.material){
      if(Array.isArray(child.material)) child.material.forEach(m=>m.dispose());
      else child.material.dispose();
    }
  });
}

function updateSelection(){
  if(!highlightGroup) return;
  while(highlightGroup.children.length){
    const c=highlightGroup.children[0];
    disposeGroup(c);
    highlightGroup.remove(c);
  }

  if(!selectedId) return;
  const item = state.items.find(i=>i.id===selectedId);
  if(!item) return;
  const def = FURNITURE[item.type];
  if(!def) return;

  let gw=def.gw, gd=def.gd;
  const rotSteps=((item.rotation||0)/90)%4;
  for(let i=0;i<rotSteps;i++){const t=gw;gw=gd;gd=t;}

  const boxGeo = new THREE.BoxGeometry(gw+0.06, 0.02, gd+0.06);
  const boxMat = new THREE.MeshBasicMaterial({color:0x7c3aed, transparent:true, opacity:0.35});
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.set(item.gx + gw/2, 0.01, item.gy + gd/2);
  highlightGroup.add(box);

  const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(gw+0.08, 0.15, gd+0.08));
  const edgesMat = new THREE.LineBasicMaterial({color:0x7c3aed, linewidth:2});
  const edges = new THREE.LineSegments(edgesGeo, edgesMat);
  edges.position.set(item.gx + gw/2, 0.08, item.gy + gd/2);
  highlightGroup.add(edges);
}

function updateGhost(){
  if(!ghostGroup) return;
  while(ghostGroup.children.length){
    const c=ghostGroup.children[0];
    disposeGroup(c);
    ghostGroup.remove(c);
  }

  if(mode === 'placing' && placingType && ghostPos){
    const valid = canPlace(placingType, ghostPos.gx, ghostPos.gz, placingRot);
    const mesh = createFurnitureMesh(placingType, ghostPos.gx, ghostPos.gz, placingRot, valid?0.55:0.25);
    if(mesh) ghostGroup.add(mesh);

    const def = FURNITURE[placingType];
    let gw=def.gw, gd=def.gd;
    const rs=((placingRot||0)/90)%4;
    for(let i=0;i<rs;i++){const t=gw;gw=gd;gd=t;}

    const hlGeo = new THREE.PlaneGeometry(gw, gd);
    const hlMat = new THREE.MeshBasicMaterial({
      color: valid ? 0x7c3aed : 0xef4444,
      transparent:true, opacity:0.2, side:THREE.DoubleSide
    });
    const hl = new THREE.Mesh(hlGeo, hlMat);
    hl.rotation.x = -Math.PI/2;
    hl.position.set(ghostPos.gx + gw/2, 0.02, ghostPos.gz + gd/2);
    ghostGroup.add(hl);
  } else if(mode === 'idle' && ghostPos && isOnFloor(ghostPos.gx, ghostPos.gz)){
    const hlGeo = new THREE.PlaneGeometry(0.96, 0.96);
    const hlMat = new THREE.MeshBasicMaterial({color:0x7c3aed, transparent:true, opacity:0.08, side:THREE.DoubleSide});
    const hl = new THREE.Mesh(hlGeo, hlMat);
    hl.rotation.x = -Math.PI/2;
    hl.position.set(ghostPos.gx+0.5, 0.02, ghostPos.gz+0.5);
    ghostGroup.add(hl);
  }
}

/* ═══════════════════════════════════════════════════════════════
   CANVAS 2D FALLBACK ENGINE (FOR NON-WEBGL BROWSERS)
   ═══════════════════════════════════════════════════════════════ */
function initCanvas2DEngine() {
  container = document.getElementById('canvas-area');
  if(!container) return;

  canvas2D = document.createElement('canvas');
  canvas2D.style.display = 'block';
  canvas2D.style.width = '100%';
  canvas2D.style.height = '100%';
  container.appendChild(canvas2D);
  ctx2D = canvas2D.getContext('2d');

  function resizeCanvas2D() {
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rw = rect.width || window.innerWidth || 800;
    const rh = rect.height || (window.innerHeight - 52) || 600;
    canvas2D.width = rw * dpr;
    canvas2D.height = rh * dpr;
    renderCanvas2D();
  }
  window.addEventListener('resize', resizeCanvas2D);
  resizeCanvas2D();

  canvas2D.addEventListener('mousemove', e => {
    if(isPanDragging){
      const dx = e.clientX - panStartMouse.x;
      const dy = e.clientY - panStartMouse.y;
      panStartMouse = { x: e.clientX, y: e.clientY };
      cameraOffset.x -= dx * 0.02;
      cameraOffset.z -= dy * 0.02;
      renderCanvas2D();
      return;
    }

    const grid = getIsoGridFromMouse2D(e);
    if(grid) {
      ghostPos = grid;

      if(draggingItem){
        if(canPlace(draggingItem.type, grid.gx, grid.gz, draggingItem.rotation, draggingItem.id)){
          if(draggingItem.gx !== grid.gx || draggingItem.gy !== grid.gz){
            draggingItem.gx = grid.gx;
            draggingItem.gy = grid.gz;
            isItemMoved = true;
          }
        }
      }
      renderCanvas2D();
      canvas2D.style.cursor = mode==='placing' ? 'crosshair' : (getItemAt(grid.gx, grid.gz) ? 'grab' : 'default');
    }
  });

  canvas2D.addEventListener('mousedown', e => {
    const grid = getIsoGridFromMouse2D(e);

    if(e.button === 2){
      e.preventDefault();
      closeSurfacePopover();
      if(mode === 'placing'){
        cancelPlacing();
      } else if(grid && isOnFloor(grid.gx, grid.gz)){
        const targetItem = getItemAt(grid.gx, grid.gz);
        if(targetItem){
          selectedId = targetItem.id;
          deleteSelected();
        } else {
          selectedId = null;
        }
      }
      renderCanvas2D();
      return;
    }

    if(e.button === 0){
      if(mode==='placing' && placingType && grid){
        if(canPlace(placingType, grid.gx, grid.gz, placingRot)){
          const def = FURNITURE[placingType];
          state.items.push({
            id:'item-'+state.nextId++,
            type:placingType,
            gx:grid.gx, gy:grid.gz,
            rotation: placingRot
          });
          pushHistory(); saveState(); renderCanvas2D();
          showToast(`Placed ${def.name}`);
        }
        return;
      }

      const clickedItem = (grid && isOnFloor(grid.gx, grid.gz)) ? getItemAt(grid.gx, grid.gz) : null;
      if(clickedItem){
        closeSurfacePopover();
        selectedId = clickedItem.id;
        draggingItem = clickedItem;
        isItemMoved = false;
      } else if(grid && isOnFloor(grid.gx, grid.gz) && mode==='idle'){
        openSurfacePopover('floor');
      } else {
        closeSurfacePopover();
        selectedId = null;
        isPanDragging = true;
        panStartMouse = { x: e.clientX, y: e.clientY };
      }
      updateToolbar();
      renderCanvas2D();
    }
  });
}

function getIsoGridFromMouse2D(e){
  if(!canvas2D) return null;
  const rect = canvas2D.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const mx = (e.clientX - rect.left) * dpr;
  const my = (e.clientY - rect.top) * dpr;

  const tileW = 56 * dpr * currentZoom;
  const tileH = 28 * dpr * currentZoom;
  const originX = canvas2D.width / 2 + cameraOffset.x * tileW;
  const originY = 160 * dpr + cameraOffset.z * tileH;

  const dx = mx - originX;
  const dy = my - originY;

  const gx = Math.floor((dx / (tileW / 2) + dy / (tileH / 2)) / 2);
  const gz = Math.floor((dy / (tileH / 2) - dx / (tileW / 2)) / 2);
  return { gx, gz };
}

function renderCanvas2D(){
  if(!ctx2D || !canvas2D) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas2D.width;
  const h = canvas2D.height;
  ctx2D.clearRect(0, 0, w, h);

  ctx2D.fillStyle = '#0c0c10';
  ctx2D.fillRect(0, 0, w, h);

  const tileW = 56 * dpr * currentZoom;
  const tileH = 28 * dpr * currentZoom;
  const wallH = 140 * dpr * currentZoom;
  const originX = w / 2 + cameraOffset.x * tileW;
  const originY = 160 * dpr + cameraOffset.z * tileH;

  function iso(gx, gz){
    return {
      x: originX + (gx - gz) * (tileW / 2),
      y: originY + (gx + gz) * (tileH / 2)
    };
  }

  // Draw Left Wall
  const p0 = iso(0, 0);
  const pL = iso(0, GRID_D);
  const pR = iso(GRID_W, 0);

  const lwm = WALL_MATS[state.leftWall] || WALL_MATS['white'];
  const rwm = WALL_MATS[state.rightWall] || WALL_MATS['warm-beige'];

  ctx2D.save();
  if (lwm.transparent) ctx2D.globalAlpha = lwm.opacity || 0.4;
  ctx2D.beginPath();
  ctx2D.moveTo(p0.x, p0.y);
  ctx2D.lineTo(pL.x, pL.y);
  ctx2D.lineTo(pL.x, pL.y - wallH);
  ctx2D.lineTo(p0.x, p0.y - wallH);
  ctx2D.closePath();
  ctx2D.fillStyle = lwm.hex;
  ctx2D.fill();
  ctx2D.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx2D.stroke();
  ctx2D.restore();

  // Draw Right Wall
  ctx2D.save();
  if (rwm.transparent) ctx2D.globalAlpha = rwm.opacity || 0.4;
  ctx2D.beginPath();
  ctx2D.moveTo(p0.x, p0.y);
  ctx2D.lineTo(pR.x, pR.y);
  ctx2D.lineTo(pR.x, pR.y - wallH);
  ctx2D.lineTo(p0.x, p0.y - wallH);
  ctx2D.closePath();
  ctx2D.fillStyle = rwm.hex;
  ctx2D.fill();
  ctx2D.stroke();
  ctx2D.restore();

  // Draw Floor Tiles
  const fm = FLOOR_MATS[state.floor] || FLOOR_MATS['light-wood'];
  for(let x=0; x<GRID_W; x++){
    for(let z=0; z<GRID_D; z++){
      const top = iso(x, z);
      const right = iso(x+1, z);
      const bottom = iso(x+1, z+1);
      const left = iso(x, z+1);

      ctx2D.beginPath();
      ctx2D.moveTo(top.x, top.y);
      ctx2D.lineTo(right.x, right.y);
      ctx2D.lineTo(bottom.x, bottom.y);
      ctx2D.lineTo(left.x, left.y);
      ctx2D.closePath();

      const isAlt = (x+z)%2===0;
      ctx2D.fillStyle = isAlt ? fm.hex : fm.alt;
      ctx2D.fill();
      ctx2D.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx2D.stroke();
    }
  }

  const sorted = [...state.items].sort((a,b)=>(a.gx+a.gy) - (b.gx+b.gy));
  sorted.forEach(item => {
    drawItem2D(item, iso, tileW, tileH, dpr);
  });

  if(mode==='placing' && placingType && ghostPos && isOnFloor(ghostPos.gx, ghostPos.gz)){
    drawItem2D({
      type: placingType,
      gx: ghostPos.gx,
      gy: ghostPos.gz,
      rotation: placingRot,
      isGhost: true
    }, iso, tileW, tileH, dpr);
  }
}

function drawItem2D(item, iso, tileW, tileH, dpr){
  const def = FURNITURE[item.type];
  if(!def) return;

  const {gw, gd} = getRotDims(item.type, item.rotation);
  const height3D = 35 * dpr * currentZoom;

  ctx2D.save();
  if(item.isGhost) ctx2D.globalAlpha = 0.5;

  if(item.id === selectedId){
    const top = iso(item.gx, item.gy);
    const right = iso(item.gx+gw, item.gy);
    const bottom = iso(item.gx+gw, item.gy+gd);
    const left = iso(item.gx, item.gy+gd);
    ctx2D.beginPath();
    ctx2D.moveTo(top.x, top.y);
    ctx2D.lineTo(right.x, right.y);
    ctx2D.lineTo(bottom.x, bottom.y);
    ctx2D.lineTo(left.x, left.y);
    ctx2D.closePath();
    ctx2D.strokeStyle = '#7c3aed';
    ctx2D.lineWidth = 3 * dpr;
    ctx2D.stroke();
  }

  const top = iso(item.gx, item.gy);
  const right = iso(item.gx+gw, item.gy);
  const bottom = iso(item.gx+gw, item.gy+gd);
  const left = iso(item.gx, item.gy+gd);

  ctx2D.beginPath();
  ctx2D.moveTo(top.x, top.y - height3D);
  ctx2D.lineTo(right.x, right.y - height3D);
  ctx2D.lineTo(bottom.x, bottom.y - height3D);
  ctx2D.lineTo(left.x, left.y - height3D);
  ctx2D.closePath();
  ctx2D.fillStyle = def.parts[0]?.color || '#555';
  ctx2D.fill();
  ctx2D.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx2D.stroke();

  ctx2D.beginPath();
  ctx2D.moveTo(left.x, left.y);
  ctx2D.lineTo(bottom.x, bottom.y);
  ctx2D.lineTo(bottom.x, bottom.y - height3D);
  ctx2D.lineTo(left.x, left.y - height3D);
  ctx2D.closePath();
  ctx2D.fillStyle = 'rgba(0,0,0,0.25)';
  ctx2D.fill();

  ctx2D.beginPath();
  ctx2D.moveTo(right.x, right.y);
  ctx2D.lineTo(bottom.x, bottom.y);
  ctx2D.lineTo(bottom.x, bottom.y - height3D);
  ctx2D.lineTo(right.x, right.y - height3D);
  ctx2D.closePath();
  ctx2D.fillStyle = 'rgba(0,0,0,0.15)';
  ctx2D.fill();

  ctx2D.font = `600 ${Math.max(10, 12 * currentZoom) * dpr}px sans-serif`;
  ctx2D.fillStyle = '#ffffff';
  ctx2D.textAlign = 'center';
  ctx2D.textBaseline = 'middle';
  ctx2D.fillText(def.name || 'Item', (top.x + bottom.x)/2, (top.y + bottom.y)/2 - height3D);

  ctx2D.restore();
}

/* ═══════════════════════════════════════════════════════════════
   COLLISION & GRID UTILS
   ═══════════════════════════════════════════════════════════════ */
function isOnFloor(gx,gz){ return gx>=0 && gz>=0 && gx<GRID_W && gz<GRID_D; }

function getRotDims(type, rotation){
  if(typeof FURNITURE === 'undefined') return {gw:1, gd:1};
  const def = FURNITURE[type]; if(!def) return {gw:1, gd:1};
  let gw=def.gw, gd=def.gd;
  const rs = ((rotation||0)/90)%4;
  for(let i=0;i<rs;i++){const t=gw;gw=gd;gd=t;}
  return {gw,gd};
}

function canPlace(type, gx, gz, rot, excludeId){
  return !checkAABBCollision(
    { type, gx, gy: gz, rotation: rot },
    state.items,
    FURNITURE,
    GRID_W,
    GRID_D,
    excludeId
  );
}

function getItemAt(gx, gz){
  for(let i=state.items.length-1;i>=0;i--){
    const item=state.items[i];
    const d=getRotDims(item.type, item.rotation);
    if(gx>=item.gx && gx<item.gx+d.gw && gz>=item.gy && gz<item.gy+d.gd) return item;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if(e.key==='Escape'){
    closeSurfacePopover();
    if(mode==='placing') cancelPlacing();
    else { selectedId=null; updateSelection(); updateToolbar(); setStatus('Ready'); }
    if(!isWebGL) renderCanvas2D();
    return;
  }
  if((e.key==='r'||e.key==='R') && !e.ctrlKey && !e.metaKey){
    if(mode==='placing'){
      placingRot=(placingRot+90)%360;
      if(isWebGL) updateGhost(); else renderCanvas2D();
      showToast('Rotated preview');
    }
    else if(selectedId) rotateSelected();
    return;
  }
  if(e.key==='Delete'||e.key==='Backspace'){ if(selectedId) deleteSelected(); return; }
  if((e.ctrlKey||e.metaKey) && e.key==='z'){ e.preventDefault(); undo(); return; }
  if((e.ctrlKey||e.metaKey) && (e.key==='y'||(e.shiftKey&&e.key==='z'))){ e.preventDefault(); redo(); return; }
});

/* ═══════════════════════════════════════════════════════════════
   ACTIONS & TOOLBAR
   ═══════════════════════════════════════════════════════════════ */
function startPlacing(type){
  closeSurfacePopover();
  mode='placing'; placingType=type; placingRot=0;
  selectedId=null; updateSelection(); updateToolbar(); updateCatalogHL();
  setStatus(`Click floor to place ${FURNITURE[type].name} · R rotate · Esc cancel`);
  if(renderer && renderer.domElement) renderer.domElement.style.cursor='crosshair';
}

function cancelPlacing(){
  mode='idle'; placingType=null; ghostPos=null;
  if(isWebGL) updateGhost(); else renderCanvas2D();
  updateCatalogHL();
  setStatus('Ready');
  if(renderer && renderer.domElement) renderer.domElement.style.cursor='default';
}

function rotateSelected(){
  const item=state.items.find(i=>i.id===selectedId);
  if(!item) return;
  const newRot=((item.rotation||0)+90)%360;
  if(canPlace(item.type, item.gx, item.gy, newRot, item.id)){
    item.rotation=newRot; pushHistory(); saveState(); 
    if(isWebGL) rebuildItems(); else renderCanvas2D();
    showToast('Rotated');
  } else showToast('Cannot rotate — no space');
}

function deleteSelected(){
  const item=state.items.find(i=>i.id===selectedId);
  if(!item) return;
  state.items=state.items.filter(i=>i.id!==selectedId);
  const name=FURNITURE[item.type]?.name||'Item';
  selectedId=null; pushHistory(); saveState();
  if(isWebGL) rebuildItems(); else renderCanvas2D();
  updateToolbar();
  setStatus('Ready'); showToast(`Removed ${name}`);
}

/* ═══════════════════════════════════════════════════════════════
   CLEAN & UNCLUTTERED SIDEBAR (ONLY TEMPLATES & FURNITURE)
   ═══════════════════════════════════════════════════════════════ */
function buildSidebar(){
  const el = document.getElementById('sidebar-scroll');
  if(!el) return;
  let h = '';

  // Presets Section
  if(typeof PRESETS !== 'undefined' && PRESETS.length > 0) {
    h += `<div class="section"><div class="section-title">${SVG_ICONS.sparkle} Room Templates</div>
      <div class="catalog-grid">`;
    for(const p of PRESETS){
      h += `<button class="catalog-item" data-preset="${p.id}">
        <span class="item-icon">${p.icon}</span>
        <span class="item-name">${p.name}</span>
      </button>`;
    }
    h += `<button class="catalog-item" id="clear-room-btn" style="border-color:var(--danger);color:#fca5a5;">
        <span class="item-icon">${SVG_ICONS.trash}</span>
        <span class="item-name">Clear Room</span>
      </button>`;
    h += `</div></div>`;
  }

  // Furniture Catalog Section
  if(typeof CATEGORIES !== 'undefined' && typeof FURNITURE !== 'undefined') {
    for(const cat of CATEGORIES){
      const items = Object.entries(FURNITURE).filter(([,f])=>f.cat===cat.id);
      if(!items.length) continue;
      h += `<div class="section"><div class="section-title">${cat.icon} ${cat.name}</div><div class="catalog-grid">`;
      for(const [id,f] of items){
        h += `<button class="catalog-item" data-furniture="${id}" id="cat-${id}">
          <span class="item-icon">${f.icon}</span>
          <span class="item-name">${f.name}</span>
          <span class="item-size">${f.gw}×${f.gd}</span>
        </button>`;
      }
      h += '</div></div>';
    }
  }

  el.innerHTML = h;

  if (typeof animeAnimate === 'function') {
    safeAnimate(el.querySelectorAll('.catalog-item, .section-title'), {
      opacity: [0, 1],
      translateY: [15, 0],
      scale: [0.96, 1],
      delay: safeStagger(20),
      duration: 450,
      ease: 'outQuint'
    });
  }

  // Event bindings
  el.querySelectorAll('.catalog-item[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  const clearBtn = document.getElementById('clear-room-btn');
  if(clearBtn) clearBtn.addEventListener('click', clearRoom);

  el.querySelectorAll('.catalog-item[data-furniture]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const type=btn.dataset.furniture;
      if(mode==='placing' && placingType===type) cancelPlacing();
      else startPlacing(type);
    });
  });
}

function updateCatalogHL(){
  document.querySelectorAll('.catalog-item').forEach(el=>{
    el.classList.toggle('active', mode==='placing' && el.dataset.furniture===placingType);
  });
}

function setStatus(t){
  const el = document.getElementById('status-text');
  if(el) el.textContent = t;
}

function showToast(msg){
  const el=document.getElementById('toast');
  if(!el) return;
  el.textContent=msg; el.classList.add('show');
  
  if (typeof animeRemove === 'function') {
    animeRemove(el);
    safeAnimate(el, {
      translateY: [35, 0],
      opacity: [0, 1],
      scale: [0.88, 1],
      duration: 450,
      ease: 'outQuint'
    });

    clearTimeout(el._t);
    el._t = setTimeout(() => {
      safeAnimate(el, {
        translateY: [0, 20],
        opacity: [1, 0],
        scale: [1, 0.9],
        duration: 350,
        ease: 'inCubic',
        onComplete: () => el.classList.remove('show'),
        complete: () => el.classList.remove('show')
      });
    }, 1800);
  } else {
    clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),1800);
  }
}

// Global Micro-Animations for Room Decorator Buttons & Controls
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.icon-btn, .back-btn, .catalog-item');
  if (btn && typeof animeAnimate === 'function') {
    safeAnimate(btn, {
      scale: [0.92, 1],
      duration: 300,
      ease: 'outQuint'
    });
  }
});

function onResize(){
  if(isWebGL && renderer && camera && container) {
    const w = container.clientWidth || window.innerWidth || 800;
    const h = container.clientHeight || (window.innerHeight - 52) || 600;
    if (w > 0 && h > 0) {
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
      updateCamera();
    }
  }
}
window.addEventListener('resize', onResize);

function animate(){
  animFrameId = requestAnimationFrame(animate);
  try {
    // First-person movement processing
    if (isFirstPerson && fpControls && fpControls.isLocked) {
      const delta = fpClock.getDelta();
      fpVelocity.x = 0;
      fpVelocity.z = 0;
      fpDirection.z = Number(moveState.forward) - Number(moveState.backward);
      fpDirection.x = Number(moveState.right) - Number(moveState.left);
      fpDirection.normalize();

      if (moveState.forward || moveState.backward) fpVelocity.z -= fpDirection.z * FP_SPEED * delta;
      if (moveState.left || moveState.right) fpVelocity.x -= fpDirection.x * FP_SPEED * delta;

      fpControls.moveRight(-fpVelocity.x);
      fpControls.moveForward(-fpVelocity.z);

      // Clamp to room bounds
      const margin = 0.3;
      camera.position.x = Math.max(margin, Math.min(GRID_W - margin, camera.position.x));
      camera.position.z = Math.max(margin, Math.min(GRID_D - margin, camera.position.z));
      camera.position.y = FP_EYE_HEIGHT;
    }

    if (controls && !isFirstPerson) controls.update();
    if (isWebGL && renderer && scene && camera) {
      if (composer && postProcessingEnabled) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    }
  } catch (err) {
    console.warn('Render frame warning:', err);
  }
}

/* ═══════════════════════════════════════════════════════════════
   FIRST-PERSON WALKTHROUGH MODE
   ═══════════════════════════════════════════════════════════════ */
function toggleFirstPerson() {
  if (!isWebGL || !renderer || !camera) return;

  if (isFirstPerson) {
    exitFirstPerson();
  } else {
    enterFirstPerson();
  }
}

function enterFirstPerson() {
  // Save orbit state for returning
  savedOrbitState = {
    position: camera.position.clone(),
    target: controls ? controls.target.clone() : new THREE.Vector3(GRID_W/2, 0.5, GRID_D/2),
  };

  // Disable orbit controls
  if (controls) controls.enabled = false;

  // Create PointerLock controls
  fpControls = new PointerLockControls(camera, renderer.domElement);

  // Set camera to center of room at eye height
  camera.position.set(GRID_W / 2, FP_EYE_HEIGHT, GRID_D / 2);
  camera.lookAt(GRID_W / 2, FP_EYE_HEIGHT, 0);

  fpControls.addEventListener('lock', () => {
    // Hide overlay instructions when pointer is locked
    const overlay = document.getElementById('fp-overlay');
    if (overlay) overlay.classList.remove('active');
  });

  fpControls.addEventListener('unlock', () => {
    // When pointer lock is lost, show the lock prompt again
    const overlay = document.getElementById('fp-overlay');
    if (overlay && isFirstPerson) overlay.classList.add('active');
  });

  // Lock pointer
  fpControls.lock();
  fpClock.start();
  isFirstPerson = true;

  // Show crosshair
  const crosshair = document.getElementById('fp-crosshair');
  if (crosshair) crosshair.classList.add('active');

  // Update button state
  const btn = document.getElementById('walkthrough-btn');
  if (btn) btn.classList.add('active');

  // Hide edit UI in walkthrough
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.style.display = 'none';
  document.querySelectorAll('.canvas-resizer').forEach(el => el.style.display = 'none');

  // WASD listeners
  document.addEventListener('keydown', onFPKeyDown);
  document.addEventListener('keyup', onFPKeyUp);

  showToast('Walkthrough mode — WASD to move, mouse to look, ESC to exit');
}

function exitFirstPerson() {
  if (fpControls) {
    fpControls.unlock();
    fpControls.dispose();
    fpControls = null;
  }

  isFirstPerson = false;
  moveState.forward = moveState.backward = moveState.left = moveState.right = false;

  // Restore orbit camera
  if (savedOrbitState) {
    camera.position.copy(savedOrbitState.position);
    if (controls) {
      controls.target.copy(savedOrbitState.target);
      controls.enabled = true;
      controls.update();
    }
    savedOrbitState = null;
  }

  // Hide crosshair and overlay
  const crosshair = document.getElementById('fp-crosshair');
  if (crosshair) crosshair.classList.remove('active');
  const overlay = document.getElementById('fp-overlay');
  if (overlay) overlay.classList.remove('active');

  // Update button state
  const btn = document.getElementById('walkthrough-btn');
  if (btn) btn.classList.remove('active');

  // Restore sidebar (unless in view mode)
  if (ACCESS_MODE !== 'view') {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = '';
    document.querySelectorAll('.canvas-resizer').forEach(el => el.style.display = '');
  }

  document.removeEventListener('keydown', onFPKeyDown);
  document.removeEventListener('keyup', onFPKeyUp);

  showToast('Returned to orbit view');
}

function onFPKeyDown(e) {
  // Hide instructions overlay on any movement key press
  const overlay = document.getElementById('fp-overlay');
  if (overlay) overlay.classList.remove('active');

  switch (e.code) {
    case 'KeyW': case 'ArrowUp': moveState.forward = true; break;
    case 'KeyS': case 'ArrowDown': moveState.backward = true; break;
    case 'KeyA': case 'ArrowLeft': moveState.left = true; break;
    case 'KeyD': case 'ArrowRight': moveState.right = true; break;
    case 'Escape':
      exitFirstPerson();
      e.preventDefault();
      e.stopPropagation();
      break;
  }
}

function onFPKeyUp(e) {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': moveState.forward = false; break;
    case 'KeyS': case 'ArrowDown': moveState.backward = false; break;
    case 'KeyA': case 'ArrowLeft': moveState.left = false; break;
    case 'KeyD': case 'ArrowRight': moveState.right = false; break;
  }
}

/* ═══════════════════════════════════════════════════════════════
   DOM INITIALIZATION
   ═══════════════════════════════════════════════════════════════ */
async function startApp() {
  const titleEl = document.getElementById('room-title');
  if(titleEl) titleEl.textContent = ROOM_NAME;

  await loadState();

  if((!state.items || state.items.length === 0) && typeof PRESETS !== 'undefined'){
    const starter = PRESETS.find(p=>p.id==='office') || PRESETS[0];
    if(starter){
      state.floor = starter.floor;
      state.leftWall = starter.leftWall;
      state.rightWall = starter.rightWall;
      state.gridW = starter.gridW;
      state.gridD = starter.gridD;
      state.items = JSON.parse(JSON.stringify(starter.items));
      state.nextId = starter.items.length + 1;
      saveState();
    }
  }

  currentZoom = 1.0;
  GRID_W = state.gridW || 8;
  GRID_D = state.gridD || 6;

  setupCanvasResizers();
  buildSidebar();

  if (ACCESS_MODE === 'view') {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'none';
    
    document.querySelectorAll('.canvas-resizer').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.toolbar-group').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.divider').forEach(el => el.style.display = 'none');
    
    const statusText = document.getElementById('status-text');
    if (statusText) {
      statusText.innerHTML = '👁️ 3D Virtual Tour (View Only)';
      statusText.style.background = 'rgba(124, 58, 237, 0.2)';
      statusText.style.color = '#c084fc';
      statusText.style.border = '1px solid rgba(124, 58, 237, 0.4)';
    }
  }

  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  const rotBtn = document.getElementById('rotate-btn');
  const delBtn = document.getElementById('delete-btn');
  const exportBtn = document.getElementById('export-json-btn');
  const importBtn = document.getElementById('import-json-btn');

  if(undoBtn) undoBtn.addEventListener('click', undo);
  if(redoBtn) redoBtn.addEventListener('click', redo);
  if(rotBtn) rotBtn.addEventListener('click', ()=>{
    if(mode==='placing'){
      placingRot=(placingRot+90)%360;
      if(isWebGL) updateGhost(); else renderCanvas2D();
      showToast('Rotated preview');
    }
    else if(selectedId) rotateSelected();
  });
  if(delBtn) delBtn.addEventListener('click', ()=>{ if(selectedId) deleteSelected(); });

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportRoomLayoutJSON(state, ROOM_NAME);
      showToast('Exported Room Layout JSON');
    });
  }

  if (importBtn) {
    importBtn.addEventListener('click', () => {
      openJSONImportPicker(
        (importedState) => {
          state.gridW = importedState.gridW || state.gridW;
          state.gridD = importedState.gridD || state.gridD;
          GRID_W = state.gridW;
          GRID_D = state.gridD;
          state.floor = importedState.floor || state.floor;
          state.leftWall = importedState.leftWall || state.leftWall;
          state.rightWall = importedState.rightWall || state.rightWall;
          state.items = importedState.items || [];
          state.nextId = state.items.length + 1;
          selectedId = null;
          saveState();
          updateCanvasResizersUI();
          buildSidebar();
          if (isWebGL) {
            buildRoom();
            rebuildItems();
          } else {
            renderCanvas2D();
          }
          pushHistory();
          showToast(`Imported ${importedState.roomName || 'Layout'}`);
        },
        (err) => showToast(`Import error: ${err}`)
      );
    });
  }

  // Walkthrough button
  const walkthroughBtn = document.getElementById('walkthrough-btn');
  if (walkthroughBtn) {
    walkthroughBtn.addEventListener('click', toggleFirstPerson);
  }

  // Overlay click → re-lock pointer in walkthrough mode
  const fpOverlay = document.getElementById('fp-overlay');
  if (fpOverlay) {
    fpOverlay.addEventListener('click', () => {
      if (isFirstPerson && fpControls) {
        fpControls.lock();
        fpOverlay.classList.remove('active');
      }
    });
  }

  if (initThreeEngine()) {
    buildRoom();
    rebuildItems();
    onResize();
    updateCamera();
    pushHistory();
    updateToolbar();
    animate();

    // In view mode, keep walkthrough button visible for virtual tour
    if (ACCESS_MODE === 'view' && walkthroughBtn) {
      walkthroughBtn.parentElement.style.display = '';
    }
  } else {
    initCanvas2DEngine();
    pushHistory();
    updateToolbar();
  }

  // Subscribe to real-time changes for this room from other clients/tabs
  subscribeToRoom(ROOM_ID, (newState) => {
    if (newState) {
      Object.assign(state, newState);
      GRID_W = state.gridW || 8;
      GRID_D = state.gridD || 6;
      if (isWebGL && scene) {
        buildRoom();
        rebuildItems();
      } else {
        renderCanvas2D();
      }
    }
  });

  // Reveal page after init (anti-FOUC)
  document.body.classList.add('ready');
}

// Memory Cleanup on Page Unload / Disposer
window.addEventListener('beforeunload', () => {
  disposeScene(scene, renderer, controls, animFrameId);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
