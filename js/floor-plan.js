/* ─────────────────────────────────────────────────────────
   FLOOR PLAN MANAGEMENT (Index.html logic)
───────────────────────────────────────────────────────── */
const GRID = 40;
const DESK_W = 60, DESK_H = 40;
const ROOM_W = 120, ROOM_H = 80;

let tiles = [];
let nextDeskNum = 1;
let nextRoomNum = 1;
let selectedTileId = null;
let tileIdCounter = 0;

// Persistence
function save() {
  try {
    localStorage.setItem('cw_tiles', JSON.stringify(tiles));
    localStorage.setItem('cw_counters', JSON.stringify({ d: nextDeskNum, r: nextRoomNum, c: tileIdCounter }));
  } catch (_) {}
}

function load() {
  try {
    const raw = localStorage.getItem('cw_tiles');
    const counters = localStorage.getItem('cw_counters');
    if (raw) tiles = JSON.parse(raw);
    if (counters) {
      const c = JSON.parse(counters);
      nextDeskNum = c.d;
      nextRoomNum = c.r;
      tileIdCounter = c.c;
    }
  } catch (_) {}
}

/* ─────────────────────────────────────────────────────────
   View Switching
───────────────────────────────────────────────────────── */
const tabBtns = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.view-container');

function switchView(name) {
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.view === name));
  views.forEach(v => {
    const isTarget = v.id === 'view-' + name;
    v.classList.toggle('active', isTarget);
  });
  selectedTileId = null;
  render();
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

/* ─────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────── */
function snap(v) { return Math.round(v / GRID) * GRID; }

function dims(type) {
  return type === 'desk'
    ? { width: DESK_W, height: DESK_H }
    : { width: ROOM_W, height: ROOM_H };
}

function overlaps(x, y, w, h, excludeId) {
  return tiles.some(t => {
    if (t.id === excludeId) return false;
    return x < t.x + t.width && x + w > t.x && y < t.y + t.height && y + h > t.y;
  });
}

/* ─────────────────────────────────────────────────────────
   Rendering
───────────────────────────────────────────────────────── */
const adminCanvas = document.getElementById('admin-canvas');
const customerCanvas = document.getElementById('customer-canvas');
const adminEmpty = document.getElementById('admin-empty');
const customerEmpty = document.getElementById('customer-empty');
const confirmBtn = document.getElementById('confirm-btn');
const customerHint = document.getElementById('customer-hint');

function render() {
  renderAdmin();
  renderCustomer();
}

function renderAdmin() {
  if (!adminCanvas) return;
  adminCanvas.querySelectorAll('.tile').forEach(el => el.remove());
  if (adminEmpty) adminEmpty.style.display = tiles.length === 0 ? 'flex' : 'none';

  tiles.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tile type-' + t.type + (t.status === 'booked' ? ' status-booked' : '');
    el.style.left = t.x + 'px';
    el.style.top = t.y + 'px';
    el.style.width = t.width + 'px';
    el.style.height = t.height + 'px';
    el.dataset.id = t.id;

    // Label
    const labelSpan = document.createElement('span');
    labelSpan.textContent = t.label;
    el.appendChild(labelSpan);

    // Delete Button (×)
    const delBtn = document.createElement('span');
    delBtn.textContent = '×';
    delBtn.className = 'tile-delete-btn';
    delBtn.style.cssText = 'position:absolute;top:2px;right:4px;font-size:14px;line-height:1;opacity:0.6;padding:1px 4px;border-radius:3px;cursor:pointer;z-index:5;';
    delBtn.title = 'Delete tile';
    delBtn.addEventListener('mouseenter', () => delBtn.style.opacity = '1');
    delBtn.addEventListener('mouseleave', () => delBtn.style.opacity = '0.6');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      tiles = tiles.filter(ti => ti.id !== t.id);
      save();
      render();
    });
    el.appendChild(delBtn);

    // Check if room has decorations
    if (t.type === 'room') {
      try {
        const deco = localStorage.getItem('cw_room_' + t.id);
        if (deco) {
          const parsed = JSON.parse(deco);
          if (parsed.items && parsed.items.length > 0) {
            const badge = document.createElement('span');
            badge.textContent = '🎨';
            badge.style.cssText = 'position:absolute;bottom:3px;left:5px;font-size:10px;';
            badge.title = parsed.items.length + ' items decorated in 3D';
            el.appendChild(badge);
          }
        }
      } catch (_) {}

      // Double-click room tiles to open 3D decorator
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.location.href = 'room-decorator.html?room=' + encodeURIComponent(t.id) + '&name=' + encodeURIComponent(t.label);
      });
      el.title = 'Double-click to open 3D Room Decorator (or click × to delete)';
    } else {
      el.title = 'Desk (Click × to delete)';
    }

    adminCanvas.appendChild(el);
  });
}

function renderCustomer() {
  if (!customerCanvas) return;
  customerCanvas.querySelectorAll('.tile').forEach(el => el.remove());
  if (customerEmpty) customerEmpty.style.display = tiles.length === 0 ? 'flex' : 'none';

  const hasSelection = selectedTileId !== null;
  if (confirmBtn) confirmBtn.disabled = !hasSelection;
  if (customerHint) {
    customerHint.textContent = hasSelection
      ? 'Click "Confirm booking" to finalize'
      : 'Click an available spot to select it';
  }

  tiles.forEach(t => {
    const el = document.createElement('div');
    let statusClass = 'status-' + t.status;
    if (t.id === selectedTileId) statusClass = 'status-selected';
    el.className = 'tile ' + statusClass;
    el.style.left = t.x + 'px';
    el.style.top = t.y + 'px';
    el.style.width = t.width + 'px';
    el.style.height = t.height + 'px';
    el.textContent = t.label;
    el.dataset.id = t.id;

    if (t.status === 'available') {
      el.addEventListener('click', () => {
        selectedTileId = (selectedTileId === t.id) ? null : t.id;
        renderCustomer();
      });
    }

    customerCanvas.appendChild(el);
  });
}

/* ─────────────────────────────────────────────────────────
   Confirm booking
───────────────────────────────────────────────────────── */
if (confirmBtn) {
  confirmBtn.addEventListener('click', () => {
    if (!selectedTileId) return;
    const t = tiles.find(ti => ti.id === selectedTileId);
    if (t) t.status = 'booked';
    selectedTileId = null;
    save();
    render();
  });
}

/* ─────────────────────────────────────────────────────────
   Drag & Drop (Admin)
───────────────────────────────────────────────────────── */
const dropGhost = document.getElementById('drop-ghost');
let dragType = null;

document.querySelectorAll('.palette-item').forEach(item => {
  item.addEventListener('dragstart', e => {
    dragType = item.dataset.type;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', dragType);
  });
});

if (adminCanvas) {
  adminCanvas.addEventListener('dragover', e => {
    if (!dragType) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    const rect = adminCanvas.getBoundingClientRect();
    const { width, height } = dims(dragType);
    const x = snap(e.clientX - rect.left + adminCanvas.parentElement.scrollLeft - width / 2);
    const y = snap(e.clientY - rect.top + adminCanvas.parentElement.scrollTop - height / 2);

    if (dropGhost) {
      dropGhost.style.left = x + 'px';
      dropGhost.style.top = y + 'px';
      dropGhost.style.width = width + 'px';
      dropGhost.style.height = height + 'px';
      dropGhost.style.display = 'block';
      dropGhost.style.borderColor = overlaps(x, y, width, height) ? '#ef4444' : '#7c3aed';
    }
  });

  adminCanvas.addEventListener('dragleave', e => {
    const rect = adminCanvas.getBoundingClientRect();
    if (e.clientX <= rect.left || e.clientX >= rect.right ||
        e.clientY <= rect.top || e.clientY >= rect.bottom) {
      if (dropGhost) dropGhost.style.display = 'none';
    }
  });

  adminCanvas.addEventListener('drop', e => {
    e.preventDefault();
    if (dropGhost) dropGhost.style.display = 'none';
    if (!dragType) return;

    const rect = adminCanvas.getBoundingClientRect();
    const { width, height } = dims(dragType);
    const x = snap(e.clientX - rect.left + adminCanvas.parentElement.scrollLeft - width / 2);
    const y = snap(e.clientY - rect.top + adminCanvas.parentElement.scrollTop - height / 2);

    if (x < 0 || y < 0 || x + width > 1200 || y + height > 800) { dragType = null; return; }
    if (overlaps(x, y, width, height)) { dragType = null; return; }

    tileIdCounter++;
    const id = 'tile-' + tileIdCounter;
    let label;
    if (dragType === 'desk') {
      label = 'Desk ' + nextDeskNum;
      nextDeskNum++;
    } else {
      label = 'Room ' + nextRoomNum;
      nextRoomNum++;
    }

    tiles.push({ id, type: dragType, x, y, width, height, status: 'available', label });
    dragType = null;
    save();
    render();
  });
}

document.addEventListener('dragend', () => {
  dragType = null;
  if (dropGhost) dropGhost.style.display = 'none';
});

// Init
load();
render();
