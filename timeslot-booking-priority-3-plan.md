# Priority 3 — Real time-slot booking (replace the binary available/booked flag)

**Repo:** github.com/Tofuwho/Coworking-Booking
**Depends on:** priority 1 (shared backend) and priority 2 (real auth/RLS) —
both closed. This pass assumes `auth.uid()` is meaningful and every write
goes through RLS-protected tables.

**Why this is next:** right now `setSpotBookingStatus(spotId, 'booked', durationHours)`
just flips `spots.status` to `'booked'` forever. The customer UI shows a
"Duration" dropdown and computes a price from it, but that duration is only
ever written into `bookings.note` as a string (`"Duration: 3 hours"`) —
nothing ever un-books the spot, nothing stores when the booking starts or
ends, and nothing stops two different people from "booking" the same spot
since the current model has no concept of *when*. This is the last gap
between "demo" and "this is actually how a booking system works."

---

## Schema changes

Extend `bookings` with real start/end timestamps instead of a free-text note,
and add a constraint that makes double-booking impossible at the database
level (not just in application code — this matters, see Step 3):

```sql
alter table public.bookings
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled'));

-- Requires the btree_gist extension for the exclusion constraint below
create extension if not exists btree_gist;

-- Prevents overlapping CONFIRMED bookings for the same spot at the DB level
alter table public.bookings
  add constraint no_overlapping_bookings
  exclude using gist (
    spot_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed');
```

The exclusion constraint is the important part: even if two people click
"Book" on the same spot/time within the same second (a real race condition
your current binary-flag model doesn't handle either, it just silently lets
the second write win), Postgres itself will reject the second insert rather
than relying on the client to check availability first and hope nothing
changed in between.

---

## Steps

1. **Replace the duration dropdown with a real start/end picker.**
   The customer view (`floor-plan.js`, around the `cust-duration` select and
   `getPriceForDuration()`) currently only feeds a duration string into
   pricing and a note. Change it to capture an actual start time + duration
   (or start/end), and compute `starts_at` / `ends_at` from that before
   calling the booking function.

2. **Rewrite `setSpotBookingStatus` in `backend.js` into a real
   `createBooking(spotId, startsAt, endsAt)`.**
   Insert into `bookings` with `status: 'confirmed'` and the real
   timestamps. Let the exclusion constraint from Step 0 be the actual source
   of truth for "is this slot taken" — catch the constraint-violation error
   from Supabase and surface it as "that slot was just taken" rather than
   pre-checking availability client-side and trusting it (client-side checks
   are a UX nicety, not the enforcement — the constraint is).

3. **Drop the permanent `status` flag on `spots` as the availability
   signal.** A spot is only "busy" for the specific window it has a
   confirmed booking in — `status` on `spots` should stop being
   available/booked and either go away entirely or become something else
   (e.g. `active`/`disabled` for admin-side enable/disable, unrelated to
   booking state).

4. **Compute availability by querying `bookings`, not by reading a flag.**
   "Is spot X free at time T" becomes a query: does a confirmed booking for
   spot X overlap T? For the floor plan view, show each spot's *next*
   upcoming booking (or "free now / busy until 3:00 PM") instead of a
   static available/booked badge.

5. **Add a "My Bookings" view for the logged-in user**, since bookings are
   now tied to `auth.uid()` (already present as `user_id` in the schema)
   and time-scoped — the customer should be able to see their own upcoming
   reservations and cancel them (`status = 'cancelled'`, not a hard delete —
   keep history). Add an RLS policy: a user can update `status` on their
   *own* bookings only.

   ```sql
   create policy "Users cancel own bookings" on public.bookings
     for update
     using (auth.uid() = user_id)
     with check (auth.uid() = user_id and status = 'cancelled');
   ```

6. **Verify by trying to break it:** open two sessions as two different
   users, both try to book the same spot for an overlapping window at
   roughly the same time. One should succeed, the other should get a clear
   "slot no longer available" — from the database constraint, not a race
   your JavaScript happened to win.

---

## Explicitly out of scope for this pass

- Recurring bookings, calendar invites/notifications — later
- Payments — still not this pass
- Admin-side booking on behalf of a customer (walk-ins) — worth doing
  eventually, but it's an additive UI feature on top of this schema, not a
  blocker for landing time-slot booking itself
