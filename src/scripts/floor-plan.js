import { animate as animeAnimate, stagger, remove as animeRemove } from 'animejs';
import {
  fetchAllSpots,
  saveAllSpots,
  upsertSingleSpot,
  deleteSingleSpot,
  setSpotBookingStatus,
  createBooking,
  fetchBookingsForSpot,
  fetchUserBookings,
  cancelBooking,
  subscribeToSpots,
  signUpWithEmail,
  signInWithEmail,
  signOut,
  getCurrentUser,
  getUserProfile,
  subscribeToAuthChanges,
  isSupabaseConfigured
} from './backend.js';
import '/css/style.css';

/* ─────────────────────────────────────────────────────────
   STRICT RBAC ENGINE & JOBSTREET MASTER-DETAIL WORKSPACE PORTAL
   WITH SHARED REALTIME BACKEND INTEGRATION
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

// Shared Backend Persistence
function save() {
  saveAllSpots(tiles, { d: nextDeskNum, r: nextRoomNum, c: tileIdCounter });
}

async function load() {
  const remoteSpots = await fetchAllSpots();
  if (remoteSpots && Array.isArray(remoteSpots)) {
    tiles = remoteSpots;
  }
  try {
    const counters = localStorage.getItem('cw_counters');
    if (counters) {
      const c = JSON.parse(counters);
      nextDeskNum = c.d || 1;
      nextRoomNum = c.r || 1;
      tileIdCounter = c.c || tiles.length;
    }
  } catch (_) {}
}

/* ─────────────────────────────────────────────────────────
   ANIME.JS V4 COMPATIBILITY HELPER
───────────────────────────────────────────────────────── */
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

function animateCounter(el, targetVal) {
  if (!el) return;
  const currentVal = parseInt(el.textContent) || 0;
  if (currentVal === targetVal && el._hasAnimated) return;
  el._hasAnimated = true;
  if (typeof animeAnimate === 'function') {
    const obj = { val: currentVal };
    safeAnimate(obj, {
      val: targetVal,
      round: 1,
      duration: 650,
      ease: 'outExpo',
      onUpdate: () => { el.textContent = Math.round(obj.val); },
      update: () => { el.textContent = Math.round(obj.val); }
    });
  } else {
    el.textContent = targetVal;
  }
}

function updateStats() {
  const statDesks = document.getElementById('stat-desks');
  const statRooms = document.getElementById('stat-rooms');
  const statBooked = document.getElementById('stat-booked');

  const deskCount = tiles.filter(t => t.type === 'desk').length;
  const roomCount = tiles.filter(t => t.type === 'room').length;
  const bookedCount = tiles.filter(t => t.status === 'booked').length;

  animateCounter(statDesks, deskCount);
  animateCounter(statRooms, roomCount);
  animateCounter(statBooked, bookedCount);
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');

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
    }, 2200);
  } else {
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2200);
  }
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
    if (active && typeof anime !== 'undefined') {
      safeAnimate(b, {
        scale: [0.94, 1],
        duration: 350,
        ease: 'outQuint'
      });
    }
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
    if (isTarget) {
      v.classList.add('active');
      if (typeof animeAnimate === 'function') {
        safeAnimate(v, {
          opacity: [0, 1],
          translateY: [16, 0],
          scale: [0.98, 1],
          duration: 400,
          ease: 'outCubic'
        });
      }
    } else {
      v.classList.remove('active');
    }
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

function getPriceForDuration(durationHours) {
  const d = parseInt(durationHours) || 2;
  if (d === 1) return 15;
  if (d === 2) return 25;
  if (d === 4) return 45;
  return 80;
}

/* ─────────────────────────────────────────────────────────
   Starter Preset Floor Plan
───────────────────────────────────────────────────────── */
async function loadPresetFloorPlan() {
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
  await saveAllSpots(tiles, { d: nextDeskNum, r: nextRoomNum, c: tileIdCounter });
  render();

  showToast('Loaded Starter Layout');
}

const loadPresetBtn = document.getElementById('load-preset-floor-chip');
const heroLoadPresetBtn = document.getElementById('hero-load-preset-btn');
if (loadPresetBtn) loadPresetBtn.addEventListener('click', loadPresetFloorPlan);
if (heroLoadPresetBtn) heroLoadPresetBtn.addEventListener('click', loadPresetFloorPlan);

const clearFloorBtn = document.getElementById('clear-floor-btn');
if (clearFloorBtn) {
  clearFloorBtn.addEventListener('click', async () => {
    if (currentRole !== 'admin') {
      showToast('Unauthorized action');
      return;
    }
    if (tiles.length === 0) return;
    const oldTiles = [...tiles];
    tiles = [];
    selectedTileId = null;
    await saveAllSpots([]);
    for (const t of oldTiles) {
      deleteSingleSpot(t.id);
    }
    render();
    showToast('Cleared floor plan');
  });
}

/* ─────────────────────────────────────────────────────────
   Admin Workspace Additions
───────────────────────────────────────────────────────── */
const addDeskBtn = document.getElementById('add-desk-btn');
const heroAddDeskBtn = document.getElementById('hero-add-desk-btn');
const addRoomBtn = document.getElementById('add-room-btn');
const heroAddRoomBtn = document.getElementById('hero-add-room-btn');

async function handleCreateDesk() {
  if (currentRole !== 'admin') return;
  tileIdCounter++;
  const id = 'tile-' + tileIdCounter;
  const label = 'Hot Desk ' + nextDeskNum++;
  const x = snap(80 + (tiles.length % 5) * 80);
  const y = snap(80 + Math.floor(tiles.length / 5) * 60);
  const newSpot = { id, type: 'desk', x, y, width: DESK_W, height: DESK_H, status: 'available', label, capacity: 1, description: 'Standard Single Person Hot Desk Spot' };
  tiles.push(newSpot);
  selectedTileId = id;
  await upsertSingleSpot(newSpot);
  save();
  render();
  showToast(`Created ${label}`);
}

async function handleCreateRoom() {
  if (currentRole !== 'admin') return;
  tileIdCounter++;
  const id = 'tile-' + tileIdCounter;
  const label = 'Meeting Room ' + nextRoomNum++;
  const x = snap(320 + (tiles.length % 3) * 140);
  const y = snap(80 + Math.floor(tiles.length / 3) * 100);
  const newSpot = { id, type: 'room', x, y, width: ROOM_W, height: ROOM_H, status: 'available', label, capacity: 6, description: 'Private Office Room suite' };
  tiles.push(newSpot);
  selectedTileId = id;
  await upsertSingleSpot(newSpot);
  save();
  render();
  showToast(`Created ${label}`);
}

if (addDeskBtn) addDeskBtn.addEventListener('click', handleCreateDesk);
if (heroAddDeskBtn) heroAddDeskBtn.addEventListener('click', handleCreateDesk);

if (addRoomBtn) addRoomBtn.addEventListener('click', handleCreateRoom);
if (heroAddRoomBtn) heroAddRoomBtn.addEventListener('click', handleCreateRoom);

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

  if (typeof animeAnimate === 'function') {
    safeAnimate(feed.querySelectorAll('.spot-card'), {
      opacity: [0, 1],
      translateY: [24, 0],
      scale: [0.94, 1],
      delay: safeStagger(45),
      duration: 500,
      ease: 'outQuint'
    });
  }
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
  if (detailContent) {
    detailContent.style.display = 'flex';
    if (typeof animeAnimate === 'function') {
      safeAnimate(detailContent.children, {
        opacity: [0, 1],
        translateX: [25, 0],
        delay: safeStagger(55),
        duration: 550,
        ease: 'outQuint'
      });
    }
  }

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

  // Save Button
  const saveBtn = document.getElementById('save-spot-btn');
  if (saveBtn) {
    saveBtn.onclick = async () => {
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

      await upsertSingleSpot(t);
      save();
      render();
      showToast(`Saved changes for ${t.label}`);
    };
  }

  // Duplicate Button
  const dupBtn = document.getElementById('duplicate-spot-btn');
  if (dupBtn) {
    dupBtn.onclick = async () => {
      if (currentRole !== 'admin') return;
      tileIdCounter++;
      const dupId = 'tile-' + tileIdCounter;
      const dupLabel = t.label + ' (Copy)';
      const x = snap(t.x + 40);
      const y = snap(t.y + 40);
      const dupSpot = {
        id: dupId, type: t.type, x, y, width: t.width, height: t.height,
        status: 'available', label: dupLabel, capacity: t.capacity, description: t.description
      };
      tiles.push(dupSpot);
      selectedTileId = dupId;
      await upsertSingleSpot(dupSpot);
      save();
      render();
      showToast(`Duplicated ${dupLabel}`);
    };
  }

  // Delete Button
  const delBtn = document.getElementById('delete-spot-btn');
  if (delBtn) {
    delBtn.onclick = async () => {
      if (currentRole !== 'admin') return;
      const name = t.label;
      const spotIdToDelete = t.id;
      tiles = tiles.filter(ti => ti.id !== spotIdToDelete);
      selectedTileId = null;
      await deleteSingleSpot(spotIdToDelete);
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

  if (typeof animeAnimate === 'function') {
    safeAnimate(feed.querySelectorAll('.spot-card'), {
      opacity: [0, 1],
      translateY: [24, 0],
      scale: [0.94, 1],
      delay: safeStagger(45),
      duration: 500,
      ease: 'outQuint'
    });
  }
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
  if (detailContent) {
    detailContent.style.display = 'flex';
    if (typeof animeAnimate === 'function') {
      safeAnimate(detailContent.children, {
        opacity: [0, 1],
        translateX: [25, 0],
        delay: safeStagger(55),
        duration: 550,
        ease: 'outQuint'
      });
    }
  }

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
        openBookingModal(t);
      }
    };
  }
}

/* ─────────────────────────────────────────────────────────
   Time-Slot Picker & Pricing Calculation
───────────────────────────────────────────────────────── */
function getSelectedTimeRange() {
  const dateInput = document.getElementById('cust-booking-date');
  const timeSelect = document.getElementById('cust-start-time');
  const durationSelect = document.getElementById('cust-duration');

  const todayStr = new Date().toISOString().split('T')[0];
  const dateStr = dateInput?.value || todayStr;
  const timeStr = timeSelect?.value || '10:00';
  const durationHours = parseInt(durationSelect?.value) || 2;

  const startsAt = new Date(`${dateStr}T${timeStr}:00`);
  const endsAt = new Date(startsAt.getTime() + durationHours * 3600 * 1000);
  const price = getPriceForDuration(durationHours);

  return { startsAt, endsAt, durationHours, price, dateStr, timeStr };
}

function updateTimeSummary() {
  const summarySlot = document.getElementById('summary-time-slot');
  const summaryPrice = document.getElementById('summary-total-price');

  if (!summarySlot || !summaryPrice) return;

  const { startsAt, endsAt, price } = getSelectedTimeRange();
  const formatTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });

  summarySlot.textContent = `${formatDate(startsAt)}, ${formatTime(startsAt)} – ${formatTime(endsAt)}`;
  summaryPrice.textContent = `$${price}.00`;
}

function setupTimePicker() {
  const dateInput = document.getElementById('cust-booking-date');
  const timeSelect = document.getElementById('cust-start-time');
  const durationSelect = document.getElementById('cust-duration');

  if (dateInput) {
    const todayStr = new Date().toISOString().split('T')[0];
    dateInput.value = todayStr;
    dateInput.min = todayStr;
    dateInput.addEventListener('change', updateTimeSummary);
  }
  if (timeSelect) timeSelect.addEventListener('change', updateTimeSummary);
  if (durationSelect) durationSelect.addEventListener('change', updateTimeSummary);

  updateTimeSummary();
}

/* ─────────────────────────────────────────────────────────
   Interactive Glassmorphism Booking Modal Dialog
───────────────────────────────────────────────────────── */
function openBookingModal(tile) {
  const modal = document.getElementById('booking-modal');
  const workspaceName = document.getElementById('modal-workspace-name');
  const workspaceInfo = document.getElementById('modal-workspace-info');
  const priceVal = document.getElementById('modal-price-val');

  if (!modal) return;

  const { startsAt, endsAt, durationHours, price } = getSelectedTimeRange();

  if (workspaceName) workspaceName.textContent = tile.label;
  if (workspaceInfo) workspaceInfo.textContent = `${durationHours} Hours Duration · Capacity: ${tile.capacity || 1} Person(s)`;
  if (priceVal) priceVal.textContent = `$${price}.00 USD`;

  modal.classList.add('active');
  const dialog = modal.querySelector('.modal-dialog');

  if (typeof animeAnimate === 'function') {
    safeAnimate(modal, { opacity: [0, 1], duration: 250, ease: 'outQuad' });
    safeAnimate(dialog, { scale: [0.82, 1], translateY: [30, 0], opacity: [0, 1], duration: 500, ease: 'outQuint' });
  }

  const closeBtn = document.getElementById('close-booking-modal');
  const cancelBtn = document.getElementById('cancel-booking-btn');
  const finalizeBtn = document.getElementById('finalize-booking-btn');

  const closeModal = () => {
    if (typeof animeAnimate === 'function') {
      safeAnimate(dialog, { scale: [1, 0.9], opacity: [1, 0], duration: 200, ease: 'inQuad' });
      safeAnimate(modal, { opacity: [1, 0], duration: 250, ease: 'inQuad', onComplete: () => modal.classList.remove('active'), complete: () => modal.classList.remove('active') });
    } else {
      modal.classList.remove('active');
    }
  };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  if (finalizeBtn) {
    finalizeBtn.onclick = async () => {
      finalizeBtn.disabled = true;
      try {
        const { startsAt, endsAt, durationHours, price } = getSelectedTimeRange();
        await createBooking({
          spotId: tile.id,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          note: `Time-slot booking ($${price})`
        });
        save();
        render();
        closeModal();
        showToast(`Reserved ${tile.label} successfully! 🎉`);
      } catch (err) {
        showToast(err.message || 'Booking error. Please try another slot.');
      } finally {
        finalizeBtn.disabled = false;
      }
    };
  }
}

/* ─────────────────────────────────────────────────────────
   My Reservations Drawer / Modal Management
───────────────────────────────────────────────────────── */
async function renderMyBookings() {
  const container = document.getElementById('my-bookings-list');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-dim);">Loading your reservations...</div>';

  try {
    const list = await fetchUserBookings();
    if (!list || list.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:32px 16px;color:var(--text-dim);">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;opacity:0.6;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <p style="margin:0;font-size:14px;font-weight:600;">No Reservations Found</p>
          <span style="font-size:12px;opacity:0.8;">You haven't reserved any workspace spots yet.</span>
        </div>`;
      return;
    }

    container.innerHTML = '';
    list.forEach(b => {
      const isConfirmed = b.status === 'confirmed';
      const startDate = new Date(b.starts_at);
      const endDate = new Date(b.ends_at);
      const spotLabel = b.spots?.label || `Spot #${b.spot_id}`;

      const card = document.createElement('div');
      card.style.cssText = 'padding:14px 16px;background:var(--bg);border:1px solid var(--border);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;';

      const formatTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const formatDate = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

      card.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <strong style="font-size:14px;color:var(--text);">${spotLabel}</strong>
            <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:${isConfirmed ? '#dcfce7' : '#fee2e2'};color:${isConfirmed ? '#15803d' : '#b91c1c'};">${isConfirmed ? 'CONFIRMED' : 'CANCELLED'}</span>
          </div>
          <span style="font-size:12px;color:var(--text-dim);">📅 ${formatDate(startDate)} · ${formatTime(startDate)} – ${formatTime(endDate)}</span>
        </div>
      `;

      if (isConfirmed) {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'action-btn danger btn-sm';
        cancelBtn.style.cssText = 'padding:4px 10px;font-size:12px;';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = async () => {
          if (!confirm(`Cancel reservation for ${spotLabel}?`)) return;
          cancelBtn.disabled = true;
          try {
            await cancelBooking(b.id);
            showToast('Reservation cancelled');
            renderMyBookings();
            render();
          } catch (err) {
            showToast('Failed to cancel reservation');
          } finally {
            cancelBtn.disabled = false;
          }
        };
        card.appendChild(cancelBtn);
      }

      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--danger);">Error loading reservations</div>';
  }
}

function setupMyBookingsModal() {
  const myResBtn = document.getElementById('my-reservations-btn');
  const modal = document.getElementById('my-bookings-modal');
  const closeBtn = document.getElementById('close-my-bookings-modal');

  if (myResBtn && modal) {
    myResBtn.addEventListener('click', () => {
      modal.classList.add('active');
      renderMyBookings();
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }
}

// Global Micro-Animations for Interactive Buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.add-btn, .action-btn, .filter-chip, .decorate-3d-btn');
  if (btn && typeof anime !== 'undefined') {
    safeAnimate(btn, {
      scale: [0.94, 1],
      duration: 300,
      ease: 'outQuint'
    });
  }
});

let currentUser = null;
let currentProfile = null;
let authMode = 'login'; // 'login' | 'signup'

function updateAuthUI() {
  const signInBtn = document.getElementById('auth-signin-btn');
  const myResBtn = document.getElementById('my-reservations-btn');
  const profileBadge = document.getElementById('user-profile-badge');
  const emailText = document.getElementById('user-email-text');
  const roleChip = document.getElementById('user-role-chip');

  if (currentUser) {
    if (signInBtn) signInBtn.style.display = 'none';
    if (myResBtn) myResBtn.style.display = 'inline-flex';
    if (profileBadge) profileBadge.style.display = 'flex';
    if (emailText) emailText.textContent = currentUser.email;
    const roleName = currentProfile?.role || 'user';
    if (roleChip) {
      roleChip.textContent = roleName === 'admin' ? 'Admin' : 'User';
      roleChip.style.background = roleName === 'admin' ? 'var(--accent)' : 'var(--bg-card)';
      roleChip.style.color = roleName === 'admin' ? '#fff' : 'var(--text)';
    }
  } else {
    if (signInBtn) signInBtn.style.display = 'inline-flex';
    if (myResBtn) myResBtn.style.display = 'none';
    if (profileBadge) profileBadge.style.display = 'none';
  }
}

function setupAuthModal() {
  const authModal = document.getElementById('auth-modal');
  const signInBtn = document.getElementById('auth-signin-btn');
  const closeBtn = document.getElementById('close-auth-modal');
  const signOutBtn = document.getElementById('auth-signout-btn');
  const tabLogin = document.getElementById('auth-tab-login');
  const tabSignup = document.getElementById('auth-tab-signup');
  const authForm = document.getElementById('auth-form');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const errorMsg = document.getElementById('auth-error-msg');
  const infoBanner = document.getElementById('auth-info-banner');

  if (infoBanner) {
    infoBanner.style.display = isSupabaseConfigured ? 'none' : 'block';
  }

  if (signInBtn && authModal) {
    signInBtn.addEventListener('click', () => {
      authModal.classList.add('active');
      if (errorMsg) errorMsg.style.display = 'none';
    });
  }

  if (closeBtn && authModal) {
    closeBtn.addEventListener('click', () => {
      authModal.classList.remove('active');
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      await signOut();
      currentUser = null;
      currentProfile = null;
      updateAuthUI();
      switchRole('user');
      showToast('Signed out');
    });
  }

  if (tabLogin && tabSignup) {
    tabLogin.addEventListener('click', () => {
      authMode = 'login';
      tabLogin.classList.add('active');
      tabSignup.classList.remove('active');
      if (authSubmitBtn) authSubmitBtn.textContent = 'Sign In';
      if (errorMsg) errorMsg.style.display = 'none';
    });

    tabSignup.addEventListener('click', () => {
      authMode = 'signup';
      tabSignup.classList.add('active');
      tabLogin.classList.remove('active');
      if (authSubmitBtn) authSubmitBtn.textContent = 'Create Account';
      if (errorMsg) errorMsg.style.display = 'none';
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email')?.value;
      const password = document.getElementById('auth-password')?.value;
      if (!email || !password) return;

      if (errorMsg) errorMsg.style.display = 'none';
      if (authSubmitBtn) authSubmitBtn.disabled = true;

      try {
        if (authMode === 'login') {
          await signInWithEmail(email, password);
          showToast('Signed in successfully');
        } else {
          await signUpWithEmail(email, password);
          showToast('Account created successfully');
        }
        if (authModal) authModal.classList.remove('active');
      } catch (err) {
        if (errorMsg) {
          errorMsg.textContent = err.message || 'Authentication error';
          errorMsg.style.display = 'block';
        }
      } finally {
        if (authSubmitBtn) authSubmitBtn.disabled = false;
      }
    });
  }

  // Subscribe to real-time auth changes
  subscribeToAuthChanges(async (user, profile) => {
    currentUser = user;
    currentProfile = profile;
    updateAuthUI();
    if (user && profile) {
      switchRole(profile.role || 'user');
    }
  });
}

// Initialization with Realtime backend subscription
async function initApp() {
  await load();
  setupAuthModal();
  setupTimePicker();
  setupMyBookingsModal();

  if (!tiles) {
    tiles = [];
  }
  switchRole(currentRole);

  // Subscribe to live spot changes from other sessions / clients
  subscribeToSpots((updatedSpots) => {
    if (updatedSpots && Array.isArray(updatedSpots)) {
      tiles = updatedSpots;
      render();
    }
  });

  // Reveal page after init (anti-FOUC)
  document.body.classList.add('ready');
}

initApp();
