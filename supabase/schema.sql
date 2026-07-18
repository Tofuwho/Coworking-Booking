-- Supabase Schema for Coworking Booking Application
-- Enables PostgreSQL tables, RLS policies, Profiles, and Realtime subscriptions

-- 1. PROFILES TABLE (Server-side Role-Based Access Control)
-- -------------------------------------------------------------
-- BOOTSTRAP NOTE: Upon sign-up, new users receive default role = 'user'.
-- To promote your initial superadmin account, run the following in the Supabase Dashboard SQL Editor:
--   UPDATE public.profiles SET role = 'admin' WHERE id = '<USER_UUID_HERE>';
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automatic Profile Creation Trigger on User Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. SPOTS TABLE (Floor Plan tiles: Hot Desks, Dedicated Desks, Meeting Rooms)
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

-- 3. BOOKINGS TABLE (Workspace reservations & log history)
CREATE TABLE IF NOT EXISTS public.bookings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  spot_id TEXT REFERENCES public.spots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT DEFAULT '',
  booked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ROOMS TABLE (3D Room Decorator header: grid dimensions and wall/floor materials)
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

-- 5. SPOT_ITEMS TABLE (3D placed furniture items per room)
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
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spot_items ENABLE ROW LEVEL SECURITY;

-- ─── RLS POLICIES FOR PROFILES ─────────────────────────────────
DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
CREATE POLICY "Public profiles read" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users update own profile or admins update" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can update profiles" ON public.profiles;
CREATE POLICY "Only admins can update profiles" ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── RLS POLICIES FOR SPOTS ────────────────────────────────────
DROP POLICY IF EXISTS "Public read spots" ON public.spots;
CREATE POLICY "Public read spots" ON public.spots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins insert spots" ON public.spots;
CREATE POLICY "Admins insert spots" ON public.spots
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins update spots" ON public.spots;
CREATE POLICY "Admins update spots" ON public.spots
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins delete spots" ON public.spots;
CREATE POLICY "Admins delete spots" ON public.spots
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── RLS POLICIES FOR ROOMS ────────────────────────────────────
DROP POLICY IF EXISTS "Public read rooms" ON public.rooms;
CREATE POLICY "Public read rooms" ON public.rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins insert rooms" ON public.rooms;
CREATE POLICY "Admins insert rooms" ON public.rooms
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins update rooms" ON public.rooms;
CREATE POLICY "Admins update rooms" ON public.rooms
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins delete rooms" ON public.rooms;
CREATE POLICY "Admins delete rooms" ON public.rooms
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── RLS POLICIES FOR SPOT_ITEMS ──────────────────────────────
DROP POLICY IF EXISTS "Public read spot_items" ON public.spot_items;
CREATE POLICY "Public read spot_items" ON public.spot_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins insert spot_items" ON public.spot_items;
CREATE POLICY "Admins insert spot_items" ON public.spot_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins update spot_items" ON public.spot_items;
CREATE POLICY "Admins update spot_items" ON public.spot_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins delete spot_items" ON public.spot_items;
CREATE POLICY "Admins delete spot_items" ON public.spot_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── RLS POLICIES FOR BOOKINGS ─────────────────────────────────
DROP POLICY IF EXISTS "Public read bookings" ON public.bookings;
CREATE POLICY "Public read bookings" ON public.bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users insert bookings" ON public.bookings;
CREATE POLICY "Authenticated users insert bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins delete bookings" ON public.bookings;
CREATE POLICY "Admins delete bookings" ON public.bookings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

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
