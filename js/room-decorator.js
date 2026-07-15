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

// Camera panning & furniture dragging states
let cameraOffset = { x: 0, z: 0 };
let isPanDragging = false;
let panStartMouse = { x: 0, y: 0 };

let draggingItem = null;
let itemDragStartPos = null;
let isItemMoved = false;

// Undo stack
let history = [], histIdx = -1;

const params = new URLSearchParams(location.search);
const ROOM_ID = params.get('room') || 'default-room';
const ROOM_NAME = decodeURIComponent(params.get('name') || 'Room Decorator');
const STATE_KEY = 'cw_room_' + ROOM_ID;

let isWebGL = false;
let canvas2D = null, ctx2D = null;

function saveState(){ try{localStorage.setItem(STATE_KEY,JSON.stringify(state))}catch(e){} }
function loadState(){
  try{
    const r=localStorage.getItem(STATE_KEY);
    if(r){
      const s=JSON.parse(r);
      Object.assign(state,s);
      GRID_W=state.gridW||8; GRID_D=state.gridD||6;
    }
  }catch(e){}
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
  cameraOffset = { x: 0, z: 0 };
  state.items = JSON.parse(JSON.stringify(preset.items));
  state.nextId = state.items.length + 1;
  selectedId = null;
  saveState();
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
    scene.background = new THREE.Color('#0c0c10');

    const rect = container.getBoundingClientRect();
    const w = rect.width || window.innerWidth || 800;
    const h = rect.height || (window.innerHeight - 52) || 600;
    const aspect = w / h;

    const baseFrust = (Math.max(GRID_W, GRID_D) * 0.75 + 2) * currentZoom;
    camera = new THREE.OrthographicCamera(-baseFrust*aspect, baseFrust*aspect, baseFrust, -baseFrust, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:'high-performance' });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 0.95);
    scene.add(hemiLight);

    dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(15, 22, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.left = -20; dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20; dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.camera.near = 0.5; dirLight.shadow.camera.far = 100;
    scene.add(dirLight);

    roomGroup = new THREE.Group(); scene.add(roomGroup);
    itemsGroup = new THREE.Group(); scene.add(itemsGroup);
    ghostGroup = new THREE.Group(); scene.add(ghostGroup);
    highlightGroup = new THREE.Group(); scene.add(highlightGroup);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    floorPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);

    // Mouse Move (Handles Hovering, Camera Panning, and Furniture Dragging)
    renderer.domElement.addEventListener('mousemove', e => {
      // 1. Camera Panning Drag
      if(isPanDragging){
        const dx = e.clientX - panStartMouse.x;
        const dy = e.clientY - panStartMouse.y;
        panStartMouse = { x: e.clientX, y: e.clientY };
        
        const panFactor = 0.018 * currentZoom;
        cameraOffset.x -= (dx - dy) * panFactor;
        cameraOffset.z -= (-dx - dy) * panFactor;
        updateCamera();
        renderer.domElement.style.cursor = 'grabbing';
        return;
      }

      const grid = getGridFromMouse(e);
      if(!grid) return;
      ghostPos = grid;

      // 2. Furniture Dragging
      if(draggingItem && grid){
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
        const onFloor = isOnFloor(grid.gx, grid.gz);
        const hovered = onFloor ? getItemAt(grid.gx, grid.gz) : null;
        renderer.domElement.style.cursor = hovered ? 'grab' : 'default';
      }
    });

    // Mouse Down Handler
    renderer.domElement.addEventListener('mousedown', e => {
      const grid = getGridFromMouse(e);

      // Right Click (RMB) -> Delete item or Cancel Placement
      if(e.button === 2){
        e.preventDefault();
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

      // Left Click (LMB) -> Place, Start Furniture Drag, or Start Camera Pan
      if(e.button === 0){
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
          // Clicked existing furniture -> Start furniture drag
          selectedId = clickedItem.id;
          draggingItem = clickedItem;
          itemDragStartPos = { gx: clickedItem.gx, gy: clickedItem.gy };
          isItemMoved = false;
          updateSelection();
          updateToolbar();
          const name = FURNITURE[clickedItem.type]?.name || 'Item';
          setStatus(`Dragging ${name}`);
        } else {
          // Clicked empty space -> Start camera pan drag
          selectedId = null;
          isPanDragging = true;
          panStartMouse = { x: e.clientX, y: e.clientY };
          updateSelection();
          updateToolbar();
          setStatus('Ready');
        }
      }
    });

    // Mouse Up Handler
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
        if(isPanDragging){
          isPanDragging = false;
          renderer.domElement.style.cursor = 'default';
        }
      }
    });

    renderer.domElement.addEventListener('mouseleave', () => {
      ghostPos = null;
      updateGhost();
    });

    renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

    // Uniform Zoom In / Zoom Out
    renderer.domElement.addEventListener('wheel', e => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
      currentZoom = Math.max(0.4, Math.min(2.5, currentZoom * zoomFactor));
      updateCamera();
    }, {passive:false});

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
      const mat = new THREE.MeshStandardMaterial({color:col, roughness:0.5, metalness:0.05});
      const tile = new THREE.Mesh(geo, mat);
      tile.position.set(x+0.5, -0.03, z+0.5);
      tile.receiveShadow = true;
      roomGroup.add(tile);
    }
  }

  const subGeo = new THREE.BoxGeometry(GRID_W+0.2, 0.15, GRID_D+0.2);
  const subMat = new THREE.MeshStandardMaterial({color:'#1a1a20', roughness:0.9});
  const subFloor = new THREE.Mesh(subGeo, subMat);
  subFloor.position.set(GRID_W/2, -0.135, GRID_D/2);
  roomGroup.add(subFloor);

  const lwGeo = new THREE.BoxGeometry(0.1, WALL_H, GRID_D);
  const lwMat = new THREE.MeshStandardMaterial({color:lwm.hex, roughness:0.6, metalness:0.02, side:THREE.DoubleSide});
  const leftWall = new THREE.Mesh(lwGeo, lwMat);
  leftWall.position.set(-0.05, WALL_H/2, GRID_D/2);
  leftWall.receiveShadow = true;
  roomGroup.add(leftWall);

  const rwGeo = new THREE.BoxGeometry(GRID_W, WALL_H, 0.1);
  const rwMat = new THREE.MeshStandardMaterial({color:rwm.hex, roughness:0.6, metalness:0.02, side:THREE.DoubleSide});
  const rightWall = new THREE.Mesh(rwGeo, rwMat);
  rightWall.position.set(GRID_W/2, WALL_H/2, -0.05);
  rightWall.receiveShadow = true;
  roomGroup.add(rightWall);

  const blGeo = new THREE.BoxGeometry(0.12, 0.12, GRID_D+0.1);
  const blMat = new THREE.MeshStandardMaterial({color:'#444', roughness:0.5});
  const bl = new THREE.Mesh(blGeo, blMat);
  bl.position.set(0.01, 0.06, GRID_D/2);
  roomGroup.add(bl);

  const brGeo = new THREE.BoxGeometry(GRID_W+0.1, 0.12, 0.12);
  const brMat = new THREE.MeshStandardMaterial({color:'#444', roughness:0.5});
  const br = new THREE.Mesh(brGeo, brMat);
  br.position.set(GRID_W/2, 0.06, 0.01);
  roomGroup.add(br);

  const cpGeo = new THREE.BoxGeometry(0.14, WALL_H+0.05, 0.14);
  const cpMat = new THREE.MeshStandardMaterial({color:'#888', roughness:0.4});
  const cp = new THREE.Mesh(cpGeo, cpMat);
  cp.position.set(-0.02, WALL_H/2, -0.02);
  roomGroup.add(cp);

  const cmGeo1 = new THREE.BoxGeometry(0.14, 0.08, GRID_D+0.1);
  const cmMat = new THREE.MeshStandardMaterial({color:'#999', roughness:0.4});
  const cm1 = new THREE.Mesh(cmGeo1, cmMat);
  cm1.position.set(0.02, WALL_H+0.01, GRID_D/2);
  roomGroup.add(cm1);

  const cmGeo2 = new THREE.BoxGeometry(GRID_W+0.1, 0.08, 0.14);
  const cm2Mat = new THREE.MeshStandardMaterial({color:'#999', roughness:0.4});
  const cm2Mesh = new THREE.Mesh(cmGeo2, cm2Mat);
  cm2Mesh.position.set(GRID_W/2, WALL_H+0.01, 0.02);
  roomGroup.add(cm2Mesh);

  const gridLineMat = new THREE.LineBasicMaterial({color:0x000000, transparent:true, opacity:0.1});
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
  const frust = (maxDim * 0.75 + 2) * currentZoom;
  
  if(container){
    const rect = container.getBoundingClientRect();
    const w = rect.width || window.innerWidth || 800;
    const h = rect.height || (window.innerHeight - 52) || 600;
    const aspect = w / h;
    camera.left = -frust * aspect;
    camera.right = frust * aspect;
    camera.top = frust;
    camera.bottom = -frust;
  }
  
  const cx = GRID_W/2 + cameraOffset.x;
  const cz = GRID_D/2 + cameraOffset.z;

  camera.position.set(cx + maxDim * 1.2, maxDim * 1.2, cz + maxDim * 1.2);
  camera.lookAt(cx, 0.5, cz);
  camera.updateProjectionMatrix();

  if(dirLight){
    dirLight.position.set(cx + 10, 20, cz + 12);
    dirLight.target.position.set(cx, 0, cz);
    if(dirLight.target.parent !== scene) scene.add(dirLight.target);
  }
}

/* ═══════════════════════════════════════════════════════════════
   FURNITURE MESH (3D WEBGL)
   ═══════════════════════════════════════════════════════════════ */
function createFurnitureMesh(type, gx, gz, rotation, opacity){
  if(typeof FURNITURE === 'undefined') return null;
  const def = FURNITURE[type];
  if(!def) return null;
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

    const geo = new THREE.BoxGeometry(rpw, p.h, rpd);
    const mat = new THREE.MeshStandardMaterial({
      color: p.color,
      roughness: 0.65,
      metalness: 0.05,
      transparent: alpha < 1,
      opacity: alpha,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(rpx + rpw/2, p.dz + p.h/2, rpz + rpd/2);
    mesh.castShadow = true;
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

    // Right Click -> Delete or Cancel
    if(e.button === 2){
      e.preventDefault();
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

    // Left Click -> Place, Drag Furniture, or Pan Camera
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
        selectedId = clickedItem.id;
        draggingItem = clickedItem;
        isItemMoved = false;
      } else {
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

  // Background
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

  // Draw Right Wall
  ctx2D.beginPath();
  ctx2D.moveTo(p0.x, p0.y);
  ctx2D.lineTo(pR.x, pR.y);
  ctx2D.lineTo(pR.x, pR.y - wallH);
  ctx2D.lineTo(p0.x, p0.y - wallH);
  ctx2D.closePath();
  ctx2D.fillStyle = rwm.hex;
  ctx2D.fill();
  ctx2D.stroke();

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

  // Items Depth Sorting
  const sorted = [...state.items].sort((a,b)=>(a.gx+a.gy) - (b.gx+b.gy));
  sorted.forEach(item => {
    drawItem2D(item, iso, tileW, tileH, dpr);
  });

  // Ghost placement preview
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
  const p = iso(item.gx, item.gy);

  const height3D = 35 * dpr * currentZoom;

  ctx2D.save();
  if(item.isGhost) ctx2D.globalAlpha = 0.5;

  // Selection ring
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

  // Draw Base Cuboid
  const top = iso(item.gx, item.gy);
  const right = iso(item.gx+gw, item.gy);
  const bottom = iso(item.gx+gw, item.gy+gd);
  const left = iso(item.gx, item.gy+gd);

  // Top Face
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

  // Left Face
  ctx2D.beginPath();
  ctx2D.moveTo(left.x, left.y);
  ctx2D.lineTo(bottom.x, bottom.y);
  ctx2D.lineTo(bottom.x, bottom.y - height3D);
  ctx2D.lineTo(left.x, left.y - height3D);
  ctx2D.closePath();
  ctx2D.fillStyle = 'rgba(0,0,0,0.25)';
  ctx2D.fill();

  // Right Face
  ctx2D.beginPath();
  ctx2D.moveTo(right.x, right.y);
  ctx2D.lineTo(bottom.x, bottom.y);
  ctx2D.lineTo(bottom.x, bottom.y - height3D);
  ctx2D.lineTo(right.x, right.y - height3D);
  ctx2D.closePath();
  ctx2D.fillStyle = 'rgba(0,0,0,0.15)';
  ctx2D.fill();

  // Label Emoji
  ctx2D.font = `${Math.max(12, 16 * currentZoom) * dpr}px sans-serif`;
  ctx2D.textAlign = 'center';
  ctx2D.textBaseline = 'middle';
  ctx2D.fillText(def.emoji || '🪑', (top.x + bottom.x)/2, (top.y + bottom.y)/2 - height3D);

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
  const {gw,gd} = getRotDims(type, rot);
  if(gx<0||gz<0||gx+gw>GRID_W||gz+gd>GRID_D) return false;
  for(const item of state.items){
    if(item.id===excludeId) continue;
    const d = getRotDims(item.type, item.rotation);
    if(gx<item.gx+d.gw && gx+gw>item.gx && gz<item.gy+d.gd && gz+gd>item.gy) return false;
  }
  return true;
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
   SIDEBAR & UI
   ═══════════════════════════════════════════════════════════════ */
function buildSidebar(){
  const el = document.getElementById('sidebar-scroll');
  if(!el) return;
  let h = '';

  // Presets Section
  if(typeof PRESETS !== 'undefined' && PRESETS.length > 0) {
    h += `<div class="section"><div class="section-title">✨ Room Templates</div>
      <div class="catalog-grid">`;
    for(const p of PRESETS){
      h += `<button class="catalog-item" data-preset="${p.id}">
        <span class="item-emoji">${p.icon}</span>
        <span class="item-name">${p.name}</span>
      </button>`;
    }
    h += `<button class="catalog-item" id="clear-room-btn" style="border-color:var(--danger);color:#fca5a5;">
        <span class="item-emoji">🗑️</span>
        <span class="item-name">Clear Room</span>
      </button>`;
    h += `</div></div>`;
  }

  // Size controls
  h += `<div class="section"><div class="section-title">📐 Room Size</div>
    <div class="size-control">
      <label>Width</label>
      <input type="range" id="size-w" min="4" max="16" value="${GRID_W}">
      <span class="size-val" id="size-w-val">${GRID_W}</span>
    </div>
    <div class="size-control">
      <label>Depth</label>
      <input type="range" id="size-d" min="4" max="16" value="${GRID_D}">
      <span class="size-val" id="size-d-val">${GRID_D}</span>
    </div>
  </div>`;

  // Surfaces
  if(typeof FLOOR_MATS !== 'undefined' && typeof WALL_MATS !== 'undefined') {
    h += '<div class="section"><div class="section-title">🎨 Surfaces</div>';
    h += '<div class="subsection"><span class="subsection-label">Floor</span><div class="swatch-row">';
    for(const [id,m] of Object.entries(FLOOR_MATS)){
      h += `<div class="swatch${state.floor===id?' active':''}" data-floor="${id}" title="${m.name}" style="background:${m.hex}"></div>`;
    }
    h += '</div></div>';
    h += '<div class="subsection"><span class="subsection-label">Left Wall</span><div class="swatch-row">';
    for(const [id,m] of Object.entries(WALL_MATS)){
      h += `<div class="swatch${state.leftWall===id?' active':''}" data-lwall="${id}" title="${m.name}" style="background:${m.hex}"></div>`;
    }
    h += '</div></div>';
    h += '<div class="subsection"><span class="subsection-label">Right Wall</span><div class="swatch-row">';
    for(const [id,m] of Object.entries(WALL_MATS)){
      h += `<div class="swatch${state.rightWall===id?' active':''}" data-rwall="${id}" title="${m.name}" style="background:${m.hex}"></div>`;
    }
    h += '</div></div></div>';
  }

  // Furniture Catalog
  if(typeof CATEGORIES !== 'undefined' && typeof FURNITURE !== 'undefined') {
    for(const cat of CATEGORIES){
      const items = Object.entries(FURNITURE).filter(([,f])=>f.cat===cat.id);
      if(!items.length) continue;
      h += `<div class="section"><div class="section-title">${cat.icon} ${cat.name}</div><div class="catalog-grid">`;
      for(const [id,f] of items){
        h += `<button class="catalog-item" data-furniture="${id}" id="cat-${id}">
          <span class="item-emoji">${f.emoji}</span>
          <span class="item-name">${f.name}</span>
          <span class="item-size">${f.gw}×${f.gd}</span>
        </button>`;
      }
      h += '</div></div>';
    }
  }

  el.innerHTML = h;

  // Event bindings
  el.querySelectorAll('.catalog-item[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  const clearBtn = document.getElementById('clear-room-btn');
  if(clearBtn) clearBtn.addEventListener('click', clearRoom);

  const sizeW = document.getElementById('size-w');
  const sizeD = document.getElementById('size-d');
  if(sizeW){
    sizeW.addEventListener('input', ()=>{
      const valEl = document.getElementById('size-w-val');
      if(valEl) valEl.textContent = sizeW.value;
      GRID_W = parseInt(sizeW.value);
      state.gridW = GRID_W;
      state.items = state.items.filter(item => {
        const d = getRotDims(item.type, item.rotation);
        return item.gx + d.gw <= GRID_W && item.gy + d.gd <= GRID_D;
      });
      saveState();
      if(isWebGL){ buildRoom(); rebuildItems(); } else renderCanvas2D();
      showToast(`Width: ${GRID_W}`);
    });
  }
  if(sizeD){
    sizeD.addEventListener('input', ()=>{
      const valEl = document.getElementById('size-d-val');
      if(valEl) valEl.textContent = sizeD.value;
      GRID_D = parseInt(sizeD.value);
      state.gridD = GRID_D;
      state.items = state.items.filter(item => {
        const d = getRotDims(item.type, item.rotation);
        return item.gx + d.gw <= GRID_W && item.gy + d.gd <= GRID_D;
      });
      saveState();
      if(isWebGL){ buildRoom(); rebuildItems(); } else renderCanvas2D();
      showToast(`Depth: ${GRID_D}`);
    });
  }

  el.querySelectorAll('.swatch[data-floor]').forEach(s=>{
    s.addEventListener('click', ()=>{
      state.floor=s.dataset.floor; saveState();
      if(isWebGL) buildRoom(); else renderCanvas2D();
      el.querySelectorAll('.swatch[data-floor]').forEach(x=>x.classList.toggle('active',x.dataset.floor===state.floor));
      showToast(`Floor: ${FLOOR_MATS[state.floor].name}`);
    });
  });
  el.querySelectorAll('.swatch[data-lwall]').forEach(s=>{
    s.addEventListener('click', ()=>{
      state.leftWall=s.dataset.lwall; saveState();
      if(isWebGL) buildRoom(); else renderCanvas2D();
      el.querySelectorAll('.swatch[data-lwall]').forEach(x=>x.classList.toggle('active',x.dataset.lwall===state.leftWall));
      showToast(`Left wall: ${WALL_MATS[state.leftWall].name}`);
    });
  });
  el.querySelectorAll('.swatch[data-rwall]').forEach(s=>{
    s.addEventListener('click', ()=>{
      state.rightWall=s.dataset.rwall; saveState();
      if(isWebGL) buildRoom(); else renderCanvas2D();
      el.querySelectorAll('.swatch[data-rwall]').forEach(x=>x.classList.toggle('active',x.dataset.rwall===state.rightWall));
      showToast(`Right wall: ${WALL_MATS[state.rightWall].name}`);
    });
  });

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
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),1800);
}

function onResize(){
  if(isWebGL && renderer && camera) {
    const rect = container.getBoundingClientRect();
    const w = rect.width || window.innerWidth || 800;
    const h = rect.height || (window.innerHeight - 52) || 600;
    renderer.setSize(w, h);
    updateCamera();
  }
}
window.addEventListener('resize', onResize);

function animate(){
  requestAnimationFrame(animate);
  if(isWebGL && renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/* ═══════════════════════════════════════════════════════════════
   DOM INITIALIZATION
   ═══════════════════════════════════════════════════════════════ */
function startApp() {
  const titleEl = document.getElementById('room-title');
  if(titleEl) titleEl.textContent = ROOM_NAME;

  loadState();

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

  GRID_W = state.gridW || 8;
  GRID_D = state.gridD || 6;

  buildSidebar();

  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  const rotBtn = document.getElementById('rotate-btn');
  const delBtn = document.getElementById('delete-btn');

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

  if (initThreeEngine()) {
    onResize();
    buildRoom();
    rebuildItems();
    pushHistory();
    updateToolbar();
    animate();
  } else {
    initCanvas2DEngine();
    pushHistory();
    updateToolbar();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
