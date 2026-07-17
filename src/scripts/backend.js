import { createClient } from '@supabase/supabase-js';

/**
 * ═══════════════════════════════════════════════════════════════
 * UNIFIED BACKEND MODULE — REAL-TIME SHARED DATA LAYER
 * ═══════════════════════════════════════════════════════════════
 * Handles persistence and live real-time synchronization for:
 * 1. Floor plan spots (Hot Desks & Meeting Rooms)
 * 2. 3D Room Decorator layouts (walls, floor materials, 3D placed items)
 * 3. Workspace reservations & booking status
 *
 * Uses Supabase (Postgres + Realtime subscriptions) when VITE_SUPABASE_URL
 * and VITE_SUPABASE_ANON_KEY are set in .env.
 * Falls back to BroadcastChannel + localStorage for zero-config offline sync.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('your-project-id') &&
  !SUPABASE_ANON_KEY.includes('your-anon-key')
);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

console.log(`[Backend] Initialized. Engine: ${isSupabaseConfigured ? 'Supabase Realtime Postgres' : 'Local Reactive Shared Engine (BroadcastChannel + Local Storage)'}`);

// Fallback BroadcastChannel for multi-tab/window sync when Supabase is not configured
const localChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('cw_shared_backend_sync')
  : null;

const spotSubscribers = new Set();
const roomSubscribers = new Map(); // roomId -> Set of callbacks

if (localChannel) {
  localChannel.onmessage = (event) => {
    const { type, data } = event.data || {};
    if (type === 'SPOTS_UPDATED') {
      spotSubscribers.forEach(cb => cb(data));
    } else if (type === 'ROOM_UPDATED' && data?.roomId) {
      const cbs = roomSubscribers.get(data.roomId);
      if (cbs) cbs.forEach(cb => cb(data.state));
    }
  };
}

// ─── SPOTS & FLOOR PLAN DATA API ───────────────────────────────

export async function fetchAllSpots() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('spots')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('[Backend] Error fetching spots from Supabase, falling back to local:', err);
    }
  }

  // Local storage fallback
  try {
    const raw = localStorage.getItem('cw_tiles');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export async function saveAllSpots(spots, counters = null) {
  if (isSupabaseConfigured) {
    try {
      // Upsert all spots into Supabase
      const records = spots.map(s => ({
        id: String(s.id),
        type: s.type,
        label: s.label || s.name || 'Workspace',
        status: s.status || 'available',
        capacity: s.capacity || 1,
        description: s.description || '',
        x: s.x ?? 0,
        y: s.y ?? 0,
        w: s.w ?? 60,
        h: s.h ?? 40,
        updated_at: new Date().toISOString()
      }));
      const { error } = await supabase.from('spots').upsert(records, { onConflict: 'id' });
      if (error) console.error('[Backend] Supabase upsert spots error:', error);
    } catch (err) {
      console.warn('[Backend] Supabase saveAllSpots error:', err);
    }
  }

  // Local storage fallback
  try {
    localStorage.setItem('cw_tiles', JSON.stringify(spots));
    if (counters) {
      localStorage.setItem('cw_counters', JSON.stringify(counters));
    }
  } catch (_) {}

  // Broadcast to other sessions
  if (localChannel) {
    localChannel.postMessage({ type: 'SPOTS_UPDATED', data: spots });
  }
}

export async function upsertSingleSpot(spot) {
  if (isSupabaseConfigured) {
    try {
      const record = {
        id: String(spot.id),
        type: spot.type,
        label: spot.label || spot.name || 'Workspace',
        status: spot.status || 'available',
        capacity: spot.capacity || 1,
        description: spot.description || '',
        x: spot.x ?? 0,
        y: spot.y ?? 0,
        w: spot.w ?? 60,
        h: spot.h ?? 40,
        updated_at: new Date().toISOString()
      };
      await supabase.from('spots').upsert([record], { onConflict: 'id' });
    } catch (err) {
      console.warn('[Backend] Supabase upsertSingleSpot error:', err);
    }
  }

  // Update local copy
  const existing = await fetchAllSpots() || [];
  const idx = existing.findIndex(s => String(s.id) === String(spot.id));
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...spot };
  } else {
    existing.push(spot);
  }
  await saveAllSpots(existing);
}

export async function deleteSingleSpot(spotId) {
  if (isSupabaseConfigured) {
    try {
      await supabase.from('spots').delete().eq('id', String(spotId));
    } catch (err) {
      console.warn('[Backend] Supabase deleteSingleSpot error:', err);
    }
  }

  const existing = await fetchAllSpots() || [];
  const filtered = existing.filter(s => String(s.id) !== String(spotId));
  await saveAllSpots(filtered);
}

export async function setSpotBookingStatus(spotId, status, duration = null) {
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('spots')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', String(spotId));

      if (status === 'booked') {
        await supabase.from('bookings').insert([{
          spot_id: String(spotId),
          note: duration ? `Duration: ${duration} hours` : 'Standard booking',
          booked_at: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.warn('[Backend] Supabase setSpotBookingStatus error:', err);
    }
  }

  const existing = await fetchAllSpots() || [];
  const spot = existing.find(s => String(s.id) === String(spotId));
  if (spot) {
    spot.status = status;
    await saveAllSpots(existing);
  }
}

export function subscribeToSpots(callback) {
  spotSubscribers.add(callback);

  if (isSupabaseConfigured) {
    const channel = supabase
      .channel('public:spots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spots' }, async () => {
        const updated = await fetchAllSpots();
        callback(updated);
      })
      .subscribe();

    return () => {
      spotSubscribers.delete(callback);
      supabase.removeChannel(channel);
    };
  }

  return () => {
    spotSubscribers.delete(callback);
  };
}

// ─── 3D ROOM DECORATOR DATA API ────────────────────────────────

export async function fetchRoomState(roomId) {
  if (isSupabaseConfigured) {
    try {
      const { data: roomData, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (!roomErr && roomData) {
        const { data: itemsData } = await supabase
          .from('spot_items')
          .select('*')
          .eq('room_id', roomId);

        return {
          gridW: roomData.grid_w,
          gridD: roomData.grid_d,
          floor: roomData.floor_mat,
          leftWall: roomData.left_wall,
          rightWall: roomData.right_wall,
          items: (itemsData || []).map(i => ({
            id: i.id,
            type: i.type,
            gx: i.gx,
            gy: i.gy,
            rotation: i.rotation
          }))
        };
      }
    } catch (err) {
      console.warn('[Backend] Supabase fetchRoomState error:', err);
    }
  }

  // Local storage fallback
  try {
    const raw = localStorage.getItem('cw_room_' + roomId);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export async function saveRoomState(roomId, state) {
  if (isSupabaseConfigured) {
    try {
      // Upsert room header
      await supabase.from('rooms').upsert([{
        id: roomId,
        grid_w: state.gridW,
        grid_d: state.gridD,
        floor_mat: state.floor,
        left_wall: state.leftWall,
        right_wall: state.rightWall,
        updated_at: new Date().toISOString()
      }], { onConflict: 'id' });

      // Delete existing items for this room and re-insert
      await supabase.from('spot_items').delete().eq('room_id', roomId);
      if (state.items && state.items.length > 0) {
        const itemRecords = state.items.map(i => ({
          id: String(i.id || ('item-' + Math.random().toString(36).substr(2, 6))),
          room_id: roomId,
          type: i.type,
          gx: i.gx,
          gy: i.gy,
          rotation: i.rotation || 0,
          updated_at: new Date().toISOString()
        }));
        await supabase.from('spot_items').insert(itemRecords);
      }
    } catch (err) {
      console.warn('[Backend] Supabase saveRoomState error:', err);
    }
  }

  // Local storage fallback
  try {
    localStorage.setItem('cw_room_' + roomId, JSON.stringify(state));
  } catch (_) {}

  // Broadcast to other sessions
  if (localChannel) {
    localChannel.postMessage({ type: 'ROOM_UPDATED', data: { roomId, state } });
  }
}

export function subscribeToRoom(roomId, callback) {
  if (!roomSubscribers.has(roomId)) {
    roomSubscribers.set(roomId, new Set());
  }
  roomSubscribers.get(roomId).add(callback);

  if (isSupabaseConfigured) {
    const channel = supabase
      .channel(`public:room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, async () => {
        const newState = await fetchRoomState(roomId);
        callback(newState);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spot_items', filter: `room_id=eq.${roomId}` }, async () => {
        const newState = await fetchRoomState(roomId);
        callback(newState);
      })
      .subscribe();

    return () => {
      const cbs = roomSubscribers.get(roomId);
      if (cbs) cbs.delete(callback);
      supabase.removeChannel(channel);
    };
  }

  return () => {
    const cbs = roomSubscribers.get(roomId);
    if (cbs) cbs.delete(callback);
  };
}
