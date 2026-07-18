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

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('your-project-id') &&
  !SUPABASE_ANON_KEY.includes('your-anon-key')
);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

console.log(`[Backend] Initialized. Engine: ${isSupabaseConfigured ? 'Supabase Realtime Postgres' : 'Local Reactive Shared Engine (BroadcastChannel + Local Storage)'}`);

export const CLIENT_SESSION_ID = Math.random().toString(36).substring(2) + Date.now().toString(36);

// Fallback BroadcastChannel for multi-tab/window sync when Supabase is not configured
const localChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('cw_shared_backend_sync')
  : null;

const spotSubscribers = new Set();
const roomSubscribers = new Map(); // roomId -> Set of callbacks

if (localChannel) {
  localChannel.onmessage = (event) => {
    const { type, data, senderId } = event.data || {};
    if (senderId === CLIENT_SESSION_ID) return; // Echo-guard: skip self messages
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
      if (error) {
        console.error('[Backend] Supabase fetchAllSpots error:', error);
        throw error;
      }
      return data || [];
    } catch (err) {
      console.warn('[Backend] Error fetching spots from Supabase, falling back to local storage:', err);
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
        updated_by: CLIENT_SESSION_ID,
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
    localChannel.postMessage({ type: 'SPOTS_UPDATED', data: spots, senderId: CLIENT_SESSION_ID });
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
        updated_by: CLIENT_SESSION_ID,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('spots').upsert([record], { onConflict: 'id' });
      if (error) console.error('[Backend] Supabase upsertSingleSpot error:', error);
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
      const { error } = await supabase.from('spots').delete().eq('id', String(spotId));
      if (error) console.error('[Backend] Supabase deleteSingleSpot error:', error);
    } catch (err) {
      console.warn('[Backend] Supabase deleteSingleSpot error:', err);
    }
  }

  const existing = await fetchAllSpots() || [];
  const filtered = existing.filter(s => String(s.id) !== String(spotId));
  await saveAllSpots(filtered);
}

export async function setSpotBookingStatus(spotId, status, duration = null) {
  if (status === 'booked') {
    const now = new Date();
    const durationHours = parseInt(duration) || 2;
    const ends = new Date(now.getTime() + durationHours * 3600 * 1000);
    return await createBooking({
      spotId,
      startsAt: now.toISOString(),
      endsAt: ends.toISOString(),
      note: `Standard booking (${durationHours} hrs)`
    });
  }

  // If status is set to available by admin
  const existing = await fetchAllSpots() || [];
  const spot = existing.find(s => String(s.id) === String(spotId));
  if (spot) {
    spot.status = status;
    await saveAllSpots(existing);
  }
}

export async function createBooking({ spotId, startsAt, endsAt, note = '' }) {
  const user = await getCurrentUser();

  if (isSupabaseConfigured) {
    const record = {
      spot_id: String(spotId),
      user_id: user?.id || null,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      status: 'confirmed',
      note: note || 'Time-slot reservation',
      booked_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('bookings').insert([record]).select().single();
    if (error) {
      console.error('[Backend] Supabase createBooking error:', error);
      // Catch GIST exclusion constraint error 23P01 (no_overlapping_bookings)
      if (error.code === '23P01' || error.message?.includes('no_overlapping_bookings')) {
        throw new Error('That time slot is already reserved for this workspace.');
      }
      throw error;
    }
    return data;
  }

  // Local dev mode fallback
  if (import.meta.env.DEV) {
    const rawLocalBookings = localStorage.getItem('cw_local_bookings') || '[]';
    const localBookings = JSON.parse(rawLocalBookings);
    const startIso = new Date(startsAt).toISOString();
    const endIso = new Date(endsAt).toISOString();

    // Check overlap locally
    const overlap = localBookings.find(b =>
      b.spot_id === String(spotId) &&
      b.status === 'confirmed' &&
      new Date(b.starts_at) < new Date(endIso) &&
      new Date(b.ends_at) > new Date(startIso)
    );

    if (overlap) {
      throw new Error('That time slot is already reserved for this workspace.');
    }

    const newBooking = {
      id: Date.now(),
      spot_id: String(spotId),
      user_id: user?.id || 'local-user-id',
      starts_at: startIso,
      ends_at: endIso,
      status: 'confirmed',
      note,
      booked_at: new Date().toISOString()
    };
    localBookings.push(newBooking);
    localStorage.setItem('cw_local_bookings', JSON.stringify(localBookings));

    if (localChannel) {
      localChannel.postMessage({ type: 'BOOKINGS_UPDATED', data: newBooking, senderId: CLIENT_SESSION_ID });
    }
    return newBooking;
  }

  throw new Error('Supabase is not configured for this environment.');
}

export async function fetchBookingsForSpot(spotId) {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('spot_id', String(spotId))
        .eq('status', 'confirmed')
        .order('starts_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('[Backend] fetchBookingsForSpot error:', err);
      return [];
    }
  }

  if (import.meta.env.DEV) {
    try {
      const raw = localStorage.getItem('cw_local_bookings') || '[]';
      const all = JSON.parse(raw);
      return all.filter(b => b.spot_id === String(spotId) && b.status === 'confirmed');
    } catch (_) { return []; }
  }

  return [];
}

export async function fetchUserBookings() {
  const user = await getCurrentUser();
  if (!user) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, spots(label, type)')
        .eq('user_id', user.id)
        .order('starts_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('[Backend] fetchUserBookings error:', err);
      return [];
    }
  }

  if (import.meta.env.DEV) {
    try {
      const raw = localStorage.getItem('cw_local_bookings') || '[]';
      const all = JSON.parse(raw);
      const spots = await fetchAllSpots() || [];
      return all
        .filter(b => b.user_id === user.id)
        .map(b => {
          const spot = spots.find(s => String(s.id) === String(b.spot_id));
          return { ...b, spots: { label: spot?.label || 'Workspace', type: spot?.type || 'desk' } };
        })
        .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
    } catch (_) { return []; }
  }

  return [];
}

export async function cancelBooking(bookingId) {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);
    if (error) {
      console.error('[Backend] cancelBooking error:', error);
      throw error;
    }
    return true;
  }

  if (import.meta.env.DEV) {
    const raw = localStorage.getItem('cw_local_bookings') || '[]';
    const all = JSON.parse(raw);
    const item = all.find(b => String(b.id) === String(bookingId));
    if (item) {
      item.status = 'cancelled';
      localStorage.setItem('cw_local_bookings', JSON.stringify(all));
      if (localChannel) {
        localChannel.postMessage({ type: 'BOOKINGS_UPDATED', data: item, senderId: CLIENT_SESSION_ID });
      }
    }
    return true;
  }

  return false;
}

export function subscribeToSpots(callback) {
  spotSubscribers.add(callback);

  if (isSupabaseConfigured) {
    const channel = supabase
      .channel('public:spots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spots' }, async (payload) => {
        // Echo guard: Ignore self-originated postgres changes
        if (payload.new?.updated_by === CLIENT_SESSION_ID) return;
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

      if (roomErr) {
        console.error('[Backend] Supabase fetchRoomState header error:', roomErr);
      } else if (roomData) {
        const { data: itemsData, error: itemsErr } = await supabase
          .from('spot_items')
          .select('*')
          .eq('room_id', roomId);

        if (itemsErr) {
          console.error('[Backend] Supabase fetchRoomState items error:', itemsErr);
        }

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
      const { error: roomErr } = await supabase.from('rooms').upsert([{
        id: roomId,
        grid_w: state.gridW,
        grid_d: state.gridD,
        floor_mat: state.floor,
        left_wall: state.leftWall,
        right_wall: state.rightWall,
        updated_by: CLIENT_SESSION_ID,
        updated_at: new Date().toISOString()
      }], { onConflict: 'id' });
      if (roomErr) console.error('[Backend] Supabase saveRoomState room upsert error:', roomErr);

      // Delete existing items for this room and re-insert
      const { error: delErr } = await supabase.from('spot_items').delete().eq('room_id', roomId);
      if (delErr) console.error('[Backend] Supabase saveRoomState delete items error:', delErr);

      if (state.items && state.items.length > 0) {
        const itemRecords = state.items.map(i => ({
          id: String(i.id || ('item-' + Math.random().toString(36).substr(2, 6))),
          room_id: roomId,
          type: i.type,
          gx: i.gx,
          gy: i.gy,
          rotation: i.rotation || 0,
          updated_by: CLIENT_SESSION_ID,
          updated_at: new Date().toISOString()
        }));
        const { error: insErr } = await supabase.from('spot_items').insert(itemRecords);
        if (insErr) console.error('[Backend] Supabase saveRoomState insert items error:', insErr);
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
    localChannel.postMessage({ type: 'ROOM_UPDATED', data: { roomId, state }, senderId: CLIENT_SESSION_ID });
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, async (payload) => {
        // Echo guard: Ignore self-originated postgres changes
        if (payload.new?.updated_by === CLIENT_SESSION_ID) return;
        const newState = await fetchRoomState(roomId);
        callback(newState);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spot_items', filter: `room_id=eq.${roomId}` }, async (payload) => {
        // Echo guard: Ignore self-originated postgres changes
        if (payload.new?.updated_by === CLIENT_SESSION_ID) return;
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

// ─── SUPABASE AUTH & RBAC PROFILE API ─────────────────────────

export async function signUpWithEmail(email, password) {
  if (!isSupabaseConfigured) {
    if (import.meta.env.DEV) {
      const mockUser = { id: 'local-user-id', email };
      const mockProfile = { id: 'local-user-id', role: email.toLowerCase().includes('admin') ? 'admin' : 'user' };
      localStorage.setItem('cw_local_user', JSON.stringify({ user: mockUser, profile: mockProfile }));
      return { user: mockUser, session: null };
    }
    throw new Error('Supabase authentication is not configured for this application environment.');
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email, password) {
  if (!isSupabaseConfigured) {
    if (import.meta.env.DEV) {
      const role = email.toLowerCase().includes('admin') ? 'admin' : 'user';
      const mockUser = { id: 'local-user-id', email };
      const mockProfile = { id: 'local-user-id', role };
      localStorage.setItem('cw_local_user', JSON.stringify({ user: mockUser, profile: mockProfile }));
      return { user: mockUser, session: null };
    }
    throw new Error('Supabase authentication is not configured for this application environment.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!isSupabaseConfigured) {
    if (import.meta.env.DEV) {
      localStorage.removeItem('cw_local_user');
    }
    return;
  }
  const { error } = await supabase.auth.signOut();
  if (error) console.error('[Backend] Sign out error:', error);
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured) {
    if (import.meta.env.DEV) {
      try {
        const raw = localStorage.getItem('cw_local_user');
        return raw ? JSON.parse(raw).user : null;
      } catch (_) { return null; }
    }
    return null;
  }
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile(userId = null) {
  if (!isSupabaseConfigured) {
    if (import.meta.env.DEV) {
      try {
        const raw = localStorage.getItem('cw_local_user');
        return raw ? JSON.parse(raw).profile : null;
      } catch (_) { return null; }
    }
    return null;
  }
  
  let targetId = userId;
  if (!targetId) {
    const user = await getCurrentUser();
    if (!user) return null;
    targetId = user.id;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .single();
    
    if (error) {
      console.warn('[Backend] getUserProfile warning:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[Backend] fetch profile error:', err);
    return null;
  }
}

export function subscribeToAuthChanges(callback) {
  if (!isSupabaseConfigured) {
    getCurrentUser().then(async (user) => {
      const profile = await getUserProfile(user?.id);
      callback(user, profile, 'INITIAL');
    });
    return () => {};
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    const user = session?.user || null;
    let profile = null;
    if (user) {
      profile = await getUserProfile(user.id);
    }
    callback(user, profile, event);
  });

  return () => subscription.unsubscribe();
}


