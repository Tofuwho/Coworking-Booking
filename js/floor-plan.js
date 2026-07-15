/* ─────────────────────────────────────────────────────────
   JOBSTREET-STYLE MASTER-DETAIL WORKSPACE MANAGER & BOOKING ENGINE
   ───────────────────────────────────────────────────────── */
const GRID = 40;
const DESK_W = 60, DESK_H = 40;
const ROOM_W = 120, ROOM_H = 80;

let tiles = [];
let nextDeskNum = 1;
let nextRoomNum = 1;
let selectedTileId = null;
let tileIdCounter = 0;

let adminFilter = 'all';
let customerFilter = 'all';
let adminSearchQuery = '';
let customerSearchQuery = '';

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

function updateStats() {
  const statDesks = document.getElementById('stat-desks');
  const statRooms = document.getElementById('stat-rooms');
  const statBooked = document.getElementById('stat-booked');

  const deskCount = tiles.filter(t => t.type === 'desk').length;
  const roomCount = tiles.filter(t => t.type === 'room').length;
  const bookedCount = tiles.filter(t => t.status === 'booked').length;

  if (statDesks) statDesks.textContent = deskCount;
  if (statRooms) statRooms.textContent = roomCount;
  if (statBooked) statBooked.textContent = bookedCount;
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ─────────────────────────────────────────────────────────
   View Switching (Admin vs Customer)
───────────────────────────────────────────────────────── */
const tabBtns = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.view-container');

function switchView(name) {
  tabBtns.forEach(b => {
    const active = b.dataset.view === name;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });

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

function hasDeco(tileId) {
  try {
    const deco = localStorage.getItem('cw_room_' + tileId);
    if (deco) {
      const p = JSON.parse(deco);
      return p.items && p.items.length > 0;
    }
  } catch (_) {}
  return false;
}

/* ─────────────────────────────────────────────────────────
   Starter Preset Floor Plan
───────────────────────────────────────────────────────── */
function loadPresetFloorPlan() {
  tiles = [
    { id: 'tile-1', type: 'desk', x: 80,  y: 80,  width: 60,  height: 40, status: 'available', label: 'Hot Desk 1', capacity: 1, description: 'Standard Ergonomic Desk with Dual Monitors and Power Outlets' },
    { id: 'tile-2', type: 'desk', x: 80,  y: 160, width: 60,  height: 40, status: 'available', label: 'Hot Desk 2', capacity: 1, description: 'Quiet Hot Desk near the Window' },
    { id: 'tile-3', type: 'desk', x: 180, y: 80,  width: 60,  height: 40, status: 'booked',    label: 'Hot Desk 3', capacity: 1, description: 'Standing Desk with Memory Height Adjustment' },
    { id: 'tile-4', type: 'desk', x: 180, y: 160, width: 60,  height: 40, status: 'available', label: 'Hot Desk 4', capacity: 1, description: 'Hot Desk adjacent to Coffee Station' },
    { id: 'tile-5', type: 'room', x: 320, y: 80,  width: 120, height: 80, status: 'available', label: 'Executive Office 1', capacity: 6, description: 'High-end executive meeting room fitted with 65-inch 4K screen and glass walls' },
    { id: 'tile-6', type: 'room', x: 480, y: 80,  width: 120, height: 80, status: 'booked',    label: 'Glass Conference Room', capacity: 10, description: 'Large conference suite with presentation whiteboard and acoustic wood slats' },
    { id: 'tile-7', type: 'room', x: 320, y: 200, width: 120, height: 80, status: 'available', label: 'Breakout Lounge', capacity: 8, description: 'Casual soft-seating lounge with espresso station and neon art' },
  ];
  nextDeskNum = 5;
  nextRoomNum = 4;
  tileIdCounter = 7;
  selectedTileId = 'tile-5';
  save();
  render();
  showToast('Loaded Starter Layout');
}

const loadPresetBtn = document.getElementById('load-preset-floor-chip');
if (loadPresetBtn) loadPresetBtn.addEventListener('click', loadPresetFloorPlan);

const clearFloorBtn = document.getElementById('clear-floor-btn');
if (clearFloorBtn) {
  clearFloorBtn.addEventListener('click', () => {
    if (tiles.length === 0) return;
    tiles = [];
    selectedTileId = null;
    save();
    render();
    showToast('Cleared floor plan');
  });
}

/* ─────────────────────────────────────────────────────────
   Add New Workspace Buttons (Admin)
───────────────────────────────────────────────────────── */
const addDeskBtn = document.getElementById('add-desk-btn');
const addRoomBtn = document.getElementById('add-room-btn');

if (addDeskBtn) {
  addDeskBtn.addEventListener('click', () => {
    tileIdCounter++;
    const id = 'tile-' + tileIdCounter;
    const label = 'Hot Desk ' + nextDeskNum++;
    const x = snap(80 + (tiles.length % 5) * 80);
    const y = snap(80 + Math.floor(tiles.length / 5) * 60);
    tiles.push({ id, type: 'desk', x, y, width: DESK_W, height: DESK_H, status: 'available', label, capacity: 1, description: 'Standard Single Person Hot Desk Spot' });
    selectedTileId = id;
    save();
    render();
    showToast(`Created ${label}`);
  });
}

if (addRoomBtn) {
  addRoomBtn.addEventListener('click', () => {
    tileIdCounter++;
    const id = 'tile-' + tileIdCounter;
    const label = 'Meeting Room ' + nextRoomNum++;
    const x = snap(320 + (tiles.length % 3) * 140);
    const y = snap(80 + Math.floor(tiles.length / 3) * 100);
    tiles.push({ id, type: 'room', x, y, width: ROOM_W, height: ROOM_H, status: 'available', label, capacity: 6, description: 'Private Office Room suite' });
    selectedTileId = id;
    save();
    render();
    showToast(`Created ${label}`);
  });
}

/* ─────────────────────────────────────────────────────────
   Search & Filter Event Listeners
───────────────────────────────────────────────────────── */
const adminSearch = document.getElementById('admin-search-input');
const customerSearch = document.getElementById('customer-search-input');

if (adminSearch) {
  adminSearch.addEventListener('input', e => {
    adminSearchQuery = e.target.value.toLowerCase();
    renderAdminCards();
  });
}

if (customerSearch) {
  customerSearch.addEventListener('input', e => {
    customerSearchQuery = e.target.value.toLowerCase();
    renderCustomerCards();
  });
}

document.querySelectorAll('.filter-chip[data-admin-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip[data-admin-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    adminFilter = btn.dataset.adminFilter;
    renderAdminCards();
  });
});

document.querySelectorAll('.filter-chip[data-customer-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip[data-customer-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    customerFilter = btn.dataset.customerFilter;
    renderCustomerCards();
  });
});

/* ─────────────────────────────────────────────────────────
   Rendering Engine
───────────────────────────────────────────────────────── */
function render() {
  updateStats();
  renderAdminCards();
  renderAdminCanvas();
  renderAdminDetail();
  renderCustomerCards();
  renderCustomerCanvas();
  renderCustomerDetail();
}

/* ── ADMIN: Master Feed Cards ────────────────────────────── */
function renderAdminCards() {
  const feed = document.getElementById('admin-cards-feed');
  if (!feed) return;
  feed.innerHTML = '';

  const filtered = tiles.filter(t => {
    if (adminFilter === 'room' && t.type !== 'room') return false;
    if (adminFilter === 'desk' && t.type !== 'desk') return false;
    if (adminSearchQuery && !t.label.toLowerCase().includes(adminSearchQuery)) return false;
    return true;
  });

  if (filtered.length === 0) {
    feed.innerHTML = `<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:24px;">No spots found</div>`;
    return;
  }

  filtered.forEach(t => {
    const isSel = t.id === selectedTileId;
    const isDeco = hasDeco(t.id);

    const card = document.createElement('div');
    card.className = 'spot-card' + (isSel ? ' active' : '');
    card.innerHTML = `
      <div class="card-top">
        <span class="card-title">${t.label}</span>
        <span class="card-badge ${t.type === 'room' ? 'type-room' : 'type-desk'}">${t.type === 'room' ? 'Room' : 'Desk'}</span>
      </div>
      <div class="card-meta">
        <span class="status-indicator">
          <span class="dot ${t.status === 'booked' ? 'booked' : 'available'}"></span>
          ${t.status === 'booked' ? 'Reserved' : 'Available'}
        </span>
        <span>Capacity: ${t.capacity || (t.type === 'room' ? 6 : 1)}</span>
        ${isDeco ? `<span class="badge-3d"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></polygon> 3D</span>` : ''}
      </div>
    `;

    card.addEventListener('click', () => {
      selectedTileId = t.id;
      renderAdminCards();
      renderAdminCanvas();
      renderAdminDetail();
    });

    feed.appendChild(card);
  });
}

/* ── ADMIN: Visual Floor Canvas ──────────────────────────── */
function renderAdminCanvas() {
  const adminCanvas = document.getElementById('admin-canvas');
  if (!adminCanvas) return;
  adminCanvas.querySelectorAll('.tile').forEach(el => el.remove());

  tiles.forEach(t => {
    const el = document.createElement('div');
    const isSel = t.id === selectedTileId;
    el.className = 'tile type-' + t.type + (t.status === 'booked' ? ' status-booked' : '') + (isSel ? ' selected' : '');
    el.style.left = t.x + 'px';
    el.style.top = t.y + 'px';
    el.style.width = t.width + 'px';
    el.style.height = t.height + 'px';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = t.label;
    el.appendChild(labelSpan);

    if (t.type === 'room') {
      if (hasDeco(t.id)) {
        const badge = document.createElement('span');
        badge.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> 3D';
        badge.style.cssText = 'position:absolute;bottom:3px;left:5px;font-size:9px;font-weight:600;display:flex;align-items:center;gap:2px;background:rgba(0,0,0,0.4);padding:1px 5px;border-radius:4px;';
        el.appendChild(badge);
      }

      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        window.location.href = 'room-decorator.html?room=' + encodeURIComponent(t.id) + '&name=' + encodeURIComponent(t.label);
      });
    }

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedTileId = t.id;
      renderAdminCards();
      renderAdminCanvas();
      renderAdminDetail();
    });

    adminCanvas.appendChild(el);
  });
}

/* ── ADMIN: Detail Description & Form Panel ───────────────── */
function renderAdminDetail() {
  const emptyDetail = document.getElementById('admin-empty-detail');
  const detailContent = document.getElementById('admin-detail-content');
  
  if (!selectedTileId || !tiles.some(t => t.id === selectedTileId)) {
    if (emptyDetail) emptyDetail.style.display = 'flex';
    if (detailContent) detailContent.style.display = 'none';
    return;
  }

  const t = tiles.find(ti => ti.id === selectedTileId);
  if (emptyDetail) emptyDetail.style.display = 'none';
  if (detailContent) detailContent.style.display = 'flex';

  const titleEl = document.getElementById('detail-title');
  const typeBadge = document.getElementById('detail-type-badge');
  const coordsEl = document.getElementById('detail-coords');
  const launch3DBtn = document.getElementById('detail-launch-3d');

  const editLabel = document.getElementById('edit-label');
  const editType = document.getElementById('edit-type');
  const editStatus = document.getElementById('edit-status');
  const editCapacity = document.getElementById('edit-capacity');
  const editDesc = document.getElementById('edit-description');

  if (titleEl) titleEl.textContent = t.label;
  if (typeBadge) typeBadge.textContent = t.type === 'room' ? 'Private Meeting Room' : 'Hot Desk';
  if (coordsEl) coordsEl.textContent = `Grid Coordinates: X ${t.x}px, Y ${t.y}px (${t.width}×${t.height}px)`;

  if (launch3DBtn) {
    if (t.type === 'room') {
      launch3DBtn.style.display = 'inline-flex';
      launch3DBtn.onclick = () => {
        window.location.href = 'room-decorator.html?room=' + encodeURIComponent(t.id) + '&name=' + encodeURIComponent(t.label);
      };
    } else {
      launch3DBtn.style.display = 'none';
    }
  }

  if (editLabel) editLabel.value = t.label;
  if (editType) editType.value = t.type;
  if (editStatus) editStatus.value = t.status;
  if (editCapacity) editCapacity.value = t.capacity || (t.type === 'room' ? 6 : 1);
  if (editDesc) editDesc.value = t.description || '';

  // Form Save Button
  const saveBtn = document.getElementById('save-spot-btn');
  if (saveBtn) {
    saveBtn.onclick = () => {
      if (editLabel && editLabel.value.trim()) t.label = editLabel.value.trim();
      if (editType) {
        const oldType = t.type;
        t.type = editType.value;
        const d = dims(t.type);
        t.width = d.width; t.height = d.height;
      }
      if (editStatus) t.status = editStatus.value;
      if (editCapacity) t.capacity = parseInt(editCapacity.value) || 1;
      if (editDesc) t.description = editDesc.value;

      save();
      render();
      showToast(`Saved changes for ${t.label}`);
    };
  }

  // Form Duplicate Button
  const dupBtn = document.getElementById('duplicate-spot-btn');
  if (dupBtn) {
    dupBtn.onclick = () => {
      tileIdCounter++;
      const dupId = 'tile-' + tileIdCounter;
      const dupLabel = t.label + ' (Copy)';
      const x = snap(t.x + 40);
      const y = snap(t.y + 40);
      tiles.push({
        id: dupId, type: t.type, x, y, width: t.width, height: t.height,
        status: 'available', label: dupLabel, capacity: t.capacity, description: t.description
      });
      selectedTileId = dupId;
      save();
      render();
      showToast(`Duplicated ${dupLabel}`);
    };
  }

  // Form Delete Button
  const delBtn = document.getElementById('delete-spot-btn');
  if (delBtn) {
    delBtn.onclick = () => {
      const name = t.label;
      tiles = tiles.filter(ti => ti.id !== t.id);
      selectedTileId = null;
      save();
      render();
      showToast(`Deleted ${name}`);
    };
  }
}

/* ── CUSTOMER: Master Feed Cards ─────────────────────────── */
function renderCustomerCards() {
  const feed = document.getElementById('customer-cards-feed');
  if (!feed) return;
  feed.innerHTML = '';

  const filtered = tiles.filter(t => {
    if (customerFilter === 'room' && t.type !== 'room') return false;
    if (customerFilter === 'desk' && t.type !== 'desk') return false;
    if (customerSearchQuery && !t.label.toLowerCase().includes(customerSearchQuery)) return false;
    return true;
  });

  if (filtered.length === 0) {
    feed.innerHTML = `<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:24px;">No available spots matching criteria</div>`;
    return;
  }

  filtered.forEach(t => {
    const isSel = t.id === selectedTileId;
    const isDeco = hasDeco(t.id);

    const card = document.createElement('div');
    card.className = 'spot-card' + (isSel ? ' active' : '');
    card.innerHTML = `
      <div class="card-top">
        <span class="card-title">${t.label}</span>
        <span class="card-badge ${t.type === 'room' ? 'type-room' : 'type-desk'}">${t.type === 'room' ? 'Room' : 'Desk'}</span>
      </div>
      <div class="card-meta">
        <span class="status-indicator">
          <span class="dot ${t.status === 'booked' ? 'booked' : 'available'}"></span>
          ${t.status === 'booked' ? 'Reserved' : 'Available'}
        </span>
        <span>Seats: ${t.capacity || (t.type === 'room' ? 6 : 1)}</span>
        ${isDeco ? `<span class="badge-3d"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></polygon> 3D Tour</span>` : ''}
      </div>
    `;

    card.addEventListener('click', () => {
      selectedTileId = t.id;
      renderCustomerCards();
      renderCustomerCanvas();
      renderCustomerDetail();
    });

    feed.appendChild(card);
  });
}

/* ── CUSTOMER: Visual Floor Canvas ────────────────────────── */
function renderCustomerCanvas() {
  const customerCanvas = document.getElementById('customer-canvas');
  if (!customerCanvas) return;
  customerCanvas.querySelectorAll('.tile').forEach(el => el.remove());

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

    if (t.status === 'available') {
      el.addEventListener('click', () => {
        selectedTileId = (selectedTileId === t.id) ? null : t.id;
        renderCustomerCards();
        renderCustomerCanvas();
        renderCustomerDetail();
      });
    }

    customerCanvas.appendChild(el);
  });
}

/* ── CUSTOMER: Detail & Booking CTA Panel ─────────────────── */
function renderCustomerDetail() {
  const emptyDetail = document.getElementById('customer-empty-detail');
  const detailContent = document.getElementById('customer-detail-content');

  if (!selectedTileId || !tiles.some(t => t.id === selectedTileId)) {
    if (emptyDetail) emptyDetail.style.display = 'flex';
    if (detailContent) detailContent.style.display = 'none';
    return;
  }

  const t = tiles.find(ti => ti.id === selectedTileId);
  if (emptyDetail) emptyDetail.style.display = 'none';
  if (detailContent) detailContent.style.display = 'flex';

  const titleEl = document.getElementById('cust-title');
  const typeBadge = document.getElementById('cust-type-badge');
  const statusBadge = document.getElementById('cust-status-badge');
  const descEl = document.getElementById('cust-description');
  const link3D = document.getElementById('cust-3d-link');
  const confirmBtn = document.getElementById('cust-confirm-btn');

  if (titleEl) titleEl.textContent = t.label;
  if (typeBadge) typeBadge.textContent = t.type === 'room' ? 'Private Meeting Suite' : 'Hot Desk Spot';
  if (statusBadge) {
    statusBadge.textContent = t.status === 'booked' ? '🔴 Reserved / Unavailable' : '🟢 Available Now';
    statusBadge.style.color = t.status === 'booked' ? 'var(--danger)' : 'var(--success)';
  }
  if (descEl) descEl.textContent = t.description || 'Modern ergonomic workspace spot with high-speed Internet and coffee amenities.';

  if (link3D) {
    if (t.type === 'room') {
      link3D.style.display = 'inline-flex';
      link3D.href = 'room-decorator.html?room=' + encodeURIComponent(t.id) + '&name=' + encodeURIComponent(t.label);
    } else {
      link3D.style.display = 'none';
    }
  }

  if (confirmBtn) {
    confirmBtn.disabled = t.status === 'booked';
    confirmBtn.onclick = () => {
      if (t.status === 'available') {
        t.status = 'booked';
        const name = t.label;
        save();
        render();
        showToast(`Reserved ${name} successfully! 🎉`);
      }
    };
  }
}

// Init
load();
if (tiles.length === 0) {
  loadPresetFloorPlan();
} else {
  render();
}
