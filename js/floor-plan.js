/* ─────────────────────────────────────────────────────────
   STRICT RBAC ENGINE & JOBSTREET MASTER-DETAIL WORKSPACE PORTAL
   ───────────────────────────────────────────────────────── */
const GRID = 40;
const DESK_W = 60, DESK_H = 40;
const ROOM_W = 120, ROOM_H = 80;

let tiles = [];
let nextDeskNum = 1;
let nextRoomNum = 1;
let selectedTileId = null;
let tileIdCounter = 0;

// Role-Based Access Control State ('admin' vs 'user')
let currentRole = localStorage.getItem('cw_role') || 'admin';

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
   STRICT RBAC (ROLE-BASED ACCESS CONTROL) SWITCHER
───────────────────────────────────────────────────────── */
const roleBtns = document.querySelectorAll('.tab-btn[data-role]');
const views = document.querySelectorAll('.view-container');

function switchRole(role) {
  currentRole = role;
  try { localStorage.setItem('cw_role', role); } catch(_) {}

  roleBtns.forEach(b => {
    const active = b.dataset.role === role;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  const roleIndicator = document.getElementById('role-indicator');
  const adminHeaderActions = document.getElementById('admin-header-actions');

  if (role === 'admin') {
    if (roleIndicator) roleIndicator.textContent = 'Admin Mode (Edit & Decorate)';
    if (adminHeaderActions) adminHeaderActions.style.display = 'flex';
  } else {
    if (roleIndicator) roleIndicator.textContent = 'User Mode (View & Reserve)';
    if (adminHeaderActions) adminHeaderActions.style.display = 'none';
  }

  views.forEach(v => {
    const isTarget = (role === 'admin' && v.id === 'view-admin') || (role === 'user' && v.id === 'view-customer');
    v.classList.toggle('active', isTarget);
  });

  selectedTileId = null;
  render();
}

roleBtns.forEach(btn => {
  btn.addEventListener('click', () => switchRole(btn.dataset.role));
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
  if (currentRole !== 'admin') {
    showToast('Unauthorized: Admin access required');
    return;
  }
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
    if (currentRole !== 'admin') {
      showToast('Unauthorized action');
      return;
    }
    if (tiles.length === 0) return;
    tiles = [];
    selectedTileId = null;
    save();
    render();
    showToast('Cleared floor plan');
  });
}

/* ─────────────────────────────────────────────────────────
   Admin Workspace Additions
───────────────────────────────────────────────────────── */
const addDeskBtn = document.getElementById('add-desk-btn');
const addRoomBtn = document.getElementById('add-room-btn');

if (addDeskBtn) {
  addDeskBtn.addEventListener('click', () => {
    if (currentRole !== 'admin') return;
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
    if (currentRole !== 'admin') return;
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
  if (currentRole === 'admin') {
    renderAdminCards();
    renderAdminDetail();
  } else {
    renderCustomerCards();
    renderCustomerDetail();
  }
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
        ${t.type === 'room' ? `<span class="badge-3d" title="Click to Decorate 3D"><svg viewBox="0 0 24 24"><path d="M12 2l10 6.5v7L12 22 2 15.5v-7L12 2z"/><path d="M12 22v-9.5"/><path d="M22 8.5l-10 5-10-5"/></svg> ${isDeco ? 'Decorated 3D' : 'Decorate 3D'}</span>` : ''}
      </div>
    `;

    const badge3d = card.querySelector('.badge-3d');
    if (badge3d) {
      badge3d.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `room-decorator.html?room=${encodeURIComponent(t.id)}&name=${encodeURIComponent(t.label)}&mode=edit`;
      });
    }

    card.addEventListener('click', () => {
      selectedTileId = t.id;
      renderAdminCards();
      renderAdminDetail();
    });

    feed.appendChild(card);
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
  const admin3DBtn = document.getElementById('admin-begin-3d-btn');

  const editLabel = document.getElementById('edit-label');
  const editType = document.getElementById('edit-type');
  const editStatus = document.getElementById('edit-status');
  const editCapacity = document.getElementById('edit-capacity');
  const editDesc = document.getElementById('edit-description');

  if (titleEl) titleEl.textContent = t.label;
  if (typeBadge) typeBadge.textContent = t.type === 'room' ? 'Private Meeting Suite' : 'Hot Desk Spot';
  if (coordsEl) coordsEl.textContent = `Workspace ID: ${t.id} · Category: ${t.type.toUpperCase()}`;

  // Dedicated Admin Button: Begin 3D Decorating (mode=edit)
  if (admin3DBtn) {
    if (t.type === 'room') {
      admin3DBtn.style.display = 'inline-flex';
      admin3DBtn.onclick = () => {
        window.location.href = `room-decorator.html?room=${encodeURIComponent(t.id)}&name=${encodeURIComponent(t.label)}&mode=edit`;
      };
    } else {
      admin3DBtn.style.display = 'none';
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
      if (currentRole !== 'admin') return;
      if (editLabel && editLabel.value.trim()) t.label = editLabel.value.trim();
      if (editType) {
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
      if (currentRole !== 'admin') return;
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
      if (currentRole !== 'admin') return;
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
        ${t.type === 'room' ? `<span class="badge-3d" title="Click to View 3D Room Tour"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View 3D</span>` : ''}
      </div>
    `;

    const badge3d = card.querySelector('.badge-3d');
    if (badge3d) {
      badge3d.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `room-decorator.html?room=${encodeURIComponent(t.id)}&name=${encodeURIComponent(t.label)}&mode=view`;
      });
    }

    card.addEventListener('click', () => {
      selectedTileId = t.id;
      renderCustomerCards();
      renderCustomerDetail();
    });

    feed.appendChild(card);
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
  const user3DBtn = document.getElementById('user-view-3d-btn');
  const confirmBtn = document.getElementById('cust-confirm-btn');

  if (titleEl) titleEl.textContent = t.label;
  if (typeBadge) typeBadge.textContent = t.type === 'room' ? 'Private Meeting Suite' : 'Hot Desk Spot';
  if (statusBadge) {
    statusBadge.textContent = t.status === 'booked' ? '🔴 Reserved / Unavailable' : '🟢 Available Now';
    statusBadge.style.color = t.status === 'booked' ? 'var(--danger)' : 'var(--success)';
  }
  if (descEl) descEl.textContent = t.description || 'Modern ergonomic workspace spot with high-speed Internet and coffee amenities.';

  // Dedicated User Button: View 3D Interactive Room (mode=view)
  if (user3DBtn) {
    if (t.type === 'room') {
      user3DBtn.style.display = 'inline-flex';
      user3DBtn.onclick = () => {
        window.location.href = `room-decorator.html?room=${encodeURIComponent(t.id)}&name=${encodeURIComponent(t.label)}&mode=view`;
      };
    } else {
      user3DBtn.style.display = 'none';
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

// Initialization
load();
if (tiles.length === 0) {
  loadPresetFloorPlan();
} else {
  switchRole(currentRole);
}
