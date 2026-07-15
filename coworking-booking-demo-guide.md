# Coworking booking demo — build guide

## Goal

Build a clickable, local-only demo (no backend, no auth, no real payments) that proves one core idea to a coworking space owner in under 2 minutes: **owners can visually design their space, and customers book directly off that same visual layout.**

This is a pitch tool, not a production app. Optimize for "looks real and works smoothly in front of a prospect" over completeness, correctness at scale, or security.

## Demo narrative (build to this script)

1. Owner opens the **admin view**, drags a few desk and meeting room tiles onto a grid, sees them snap into place.
2. Owner switches to **customer view** — the same layout now shows as a bookable floor plan with available (green) and booked (red) spots.
3. A "customer" clicks an available desk, confirms a booking.
4. Owner switches back to admin view and sees that booking reflected — a small list or highlighted tile.

That loop is the entire demo. Do not build anything beyond what's needed to run this script convincingly.

## Scope — build this

- **Admin floor plan editor**
  - Palette with two draggable tile types: `Desk` and `Meeting room`
  - Drag onto a grid canvas, snap to nearest grid cell (40px grid)
  - Click a placed tile to delete it
  - Save/clear layout (in-memory state is fine — no database needed)
- **Customer booking view**
  - Renders the same layout as the admin editor
  - Each tile shows status: available (green), booked (red), selected (blue, on click)
  - Clicking an available tile selects it; a "confirm booking" button finalizes it
  - Booked tiles are not clickable
- **Minimal shared state**
  - One JS object/array holding all placed tiles: `{ id, type, x, y, width, height, status }`
  - Both views read/write this same state so the loop in the demo narrative actually works live
- **View switcher**
  - A simple toggle or two tabs: "Admin" / "Customer" — no real navigation/routing needed

## Explicitly out of scope — do not build

- User accounts, login, or auth of any kind
- A real backend, database, or API — in-memory JS state (or `localStorage` if persistence across refresh is wanted) is sufficient
- Payments or GCash/Maya integration
- Multi-branch or multi-location support
- Room resizing/rotation, multiple floors, or undo/redo
- Mobile responsiveness beyond "doesn't look broken on a laptop screen"
- Real booking conflict logic (e.g. time-of-day granularity) — a tile is simply available or booked, full stop, for this demo

## Suggested tech stack

Pick whichever the coding agent is most fluent in — none of this is technically demanding:

- **Simplest**: single HTML file with vanilla JS, inline styles. Fastest to get running, easiest to open on any laptop with no install step. Good default if the goal is "have something to show this week."
- **If iterating further / want it to feel like a real product**: React + plain CSS (no need for a component library). Use local component state (`useState`) for the shared layout data — no need for Redux/Zustand at this scope.

Either way: **no build step should be required to demo it.** If using React, use Vite for a fast dev server, but make sure `npm run dev` (or equivalent) is the only command needed to get it running.

## Visual style reference

Match this look and feel (already prototyped and approved):

- Flat design, no gradients or drop shadows
- Grid-snapped canvas with light gridlines (40px grid) as the visual base for both admin and customer views
- Color meaning is consistent across both views:
  - Green = available / desk (in editor, desks default green)
  - Blue = meeting room (in editor) / selected (in customer view)
  - Red = booked
- Desk tiles: small (~60×40px). Meeting room tiles: larger (~120×80px)
- Sentence case for all labels and buttons, no ALL CAPS
- Keep the UI sparse — this is a floor plan and a couple of buttons, not a dashboard

## Data model

```js
// One shared array, single source of truth for both views
const tiles = [
  {
    id: 'tile-1',
    type: 'desk',        // 'desk' | 'room'
    x: 40,                // px, snapped to grid
    y: 80,
    width: 60,
    height: 40,
    status: 'available',  // 'available' | 'booked'
    label: 'Desk 1'
  }
  // ...
]
```

Admin view mutates this array (add on drop, remove on click).
Customer view reads it for rendering and mutates only the `status` field on booking confirmation.

## Build order for the agent

1. Scaffold the single page / app shell with a view switcher (Admin / Customer tabs).
2. Build the admin editor: palette, draggable tiles, grid-snap drop handler, click-to-delete.
3. Wire the shared `tiles` state so it persists when switching views (in-memory is fine; add `localStorage` sync only if time allows).
4. Build the customer view: render `tiles` as colored boxes by status, click-to-select, confirm button that flips `status` to `'booked'`.
5. Polish pass: make sure switching tabs never loses state, tiles render identically in both views (same x/y/width/height), and the whole thing runs with zero console errors during the full demo script above.
6. Sanity-check the demo script end to end at least 3 times before presenting.

## Acceptance criteria

- [ ] Can drag a desk and a meeting room onto the admin canvas and see them snap to grid
- [ ] Can delete a placed tile by clicking it in admin view
- [ ] Switching to customer view shows the exact same layout, positioned identically
- [ ] Clicking an available tile in customer view selects it, then confirms as booked
- [ ] Switching back to admin view reflects the new booked status
- [ ] No build/install friction — running one command (or opening one HTML file) gets the demo live
- [ ] Runs smoothly on a laptop with no internet dependency beyond initial page load (no live API calls)
