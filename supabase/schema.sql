-- Supabase Schema for Coworking Booking Application
-- Enables PostgreSQL tables, RLS policies, and Realtime subscriptions

-- 1. SPOTS TABLE (Floor Plan tiles: Hot Desks, Dedicated Desks, Meeting Rooms)
CREATE TABLE IF NOT EXISTS public.spots (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  capacity INTEGER NOT NULL DEFAULT 1,
  description TEXT DEFAULT '',
  x DOUBLE PRECISION DEFAULT 0,
  y DOUBLE PRECISION DEFAULT 0,
  w DOUBLE PRECISION DEFAULT 60,
  h DOUBLE PRECISION DEFAULT 40,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BOOKINGS TABLE (Workspace reservations & log history)
CREATE TABLE IF NOT EXISTS public.bookings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  spot_id TEXT REFERENCES public.spots(id) ON DELETE CASCADE,
  note TEXT DEFAULT '',
  booked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ROOMS TABLE (3D Room Decorator header: grid dimensions and wall/floor materials)
CREATE TABLE IF NOT EXISTS public.rooms (
  id TEXT PRIMARY KEY,
  grid_w INTEGER NOT NULL DEFAULT 8,
  grid_d INTEGER NOT NULL DEFAULT 6,
  floor_mat TEXT DEFAULT 'light-wood',
  left_wall TEXT DEFAULT 'white',
  right_wall TEXT DEFAULT 'warm-beige',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SPOT_ITEMS TABLE (3D placed furniture items per room)
CREATE TABLE IF NOT EXISTS public.spot_items (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES public.rooms(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  gx INTEGER NOT NULL DEFAULT 0,
  gy INTEGER NOT NULL DEFAULT 0,
  rotation INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spot_items ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ & WRITE POLICIES (Allow anon key access for demo/prototyping)
DROP POLICY IF EXISTS "Allow public read access on spots" ON public.spots;
CREATE POLICY "Allow public read access on spots" ON public.spots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access on spots" ON public.spots;
CREATE POLICY "Allow public write access on spots" ON public.spots FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read access on bookings" ON public.bookings;
CREATE POLICY "Allow public read access on bookings" ON public.bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access on bookings" ON public.bookings;
CREATE POLICY "Allow public write access on bookings" ON public.bookings FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read access on rooms" ON public.rooms;
CREATE POLICY "Allow public read access on rooms" ON public.rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access on rooms" ON public.rooms;
CREATE POLICY "Allow public write access on rooms" ON public.rooms FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read access on spot_items" ON public.spot_items;
CREATE POLICY "Allow public read access on spot_items" ON public.spot_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access on spot_items" ON public.spot_items;
CREATE POLICY "Allow public write access on spot_items" ON public.spot_items FOR ALL USING (true);

-- ENABLE REALTIME ON SPOTS, ROOMS, AND SPOT_ITEMS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'spots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.spots;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'spot_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.spot_items;
  END IF;
END $$;
