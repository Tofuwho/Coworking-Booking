# Room Decorator — Visual Fidelity Upgrade Plan

**Repo:** github.com/Tofuwho/Coworking-Booking
**Target file:** `src/scripts/room-decorator.js` (~1500 lines, Three.js real-time scene)
**Related files:** `src/scripts/utils/materials.js`, `src/scripts/catalog-data.js`, `src/scripts/utils/collision.js`

## Context for the agent

This is a real-time WebGL room/floor decorator built with Three.js (r185), not a
pre-rendered or scanned scene. It already has a working rendering pipeline:
`PerspectiveCamera`, `WebGLRenderer` (antialias on), `ACESFilmicToneMapping`,
`PCFShadowMap` shadows, a `HemisphereLight` + `DirectionalLight`, undo/redo,
collision detection, JSON export/import, and a 2D canvas fallback for non-WebGL
devices.

**What it's missing is asset fidelity, not engine capability.** Do not rewrite
the scene setup, state management, or interaction model (drag/place/rotate/
undo) — those work. Focus changes on the items below, in priority order.
Confirm each step renders correctly before moving to the next; don't batch all
five into one pass.

The benchmark being chased is a WeWork "Tour in 3D" listing page. Note for
context: that tour is a Matterport-style photo scan (real photographs stitched
into a navigable panorama), not a real-time engine — so the goal here is not
literal pixel-parity with a photograph, it's closing the perceived-realism gap
while keeping this a live, editable, bookable 3D scene (which a photo scan
can never be).

---

## Priority 1 — Load real furniture models instead of primitive geometry

**Problem:** `room-decorator.js` imports `GLTFLoader` (line 3) and instantiates
`gltfLoader` (line 30), but furniture appears to be built from
`THREE.BoxGeometry` / `THREE.CylinderGeometry` primitives rather than loaded
models. Primitive furniture is the single biggest reason the scene reads as
"placeholder" rather than "product."

**Action:**
1. Source a small starter set of free, low-poly, CC0/CC-BY furniture GLTF
   models — desks, office chairs, meeting tables, sofas, plants, monitors.
   Good sources: Kenney.nl (office/furniture packs), Poly Pizza, Sketchfab
   (filter by CC0 license, low poly count, <5k tris each for perf).
2. Add a `models/` (or `public/models/`) directory and reference each
   furniture entry in `catalog-data.js` (`FURNITURE` array) with a `modelUrl`
   field instead of / in addition to its current primitive definition.
3. In the item-building function in `room-decorator.js` (wherever furniture
   meshes are currently constructed from primitives — search for where
   `FURNITURE` catalog entries are turned into scene objects), replace
   primitive construction with `gltfLoader.load(modelUrl, ...)`, cache loaded
   GLTF scenes so repeated placements of the same furniture type don't
   re-fetch/re-parse, and clone (`SkeletonUtils.clone` or `.clone(true)`) per
   placed instance.
4. Keep the existing primitive-box code path as a fallback for furniture
   types that don't yet have a model — so placement/collision/undo keep
   working for anything not yet migrated.
5. Verify collision bounding boxes (`utils/collision.js`) still work — they
   likely assume simple box dimensions; compute a bounding box from the
   loaded GLTF (`THREE.Box3().setFromObject()`) instead of hardcoded
   dimensions where needed.

**Effort:** Moderate. **Impact:** Highest of any item on this list.

---

## Priority 2 — Add an HDRI environment map

**Problem:** Materials in `materials.js` set `metalness` and `roughness`
values but there's no environment map for anything to reflect, so
`MeshStandardMaterial` reads flat/plasticky no matter how the roughness is
tuned.

**Action:**
1. Pick one free indoor/studio HDRI (polyhaven.com, search "office" or
   "studio" — pick something warm/neutral, not outdoor/harsh).
2. Load it with `RGBELoader` (`three/addons/loaders/RGBELoader.js`) and
   convert with `THREE.PMREMGenerator` at scene setup (near where `scene`,
   `renderer`, and lights are created).
3. Set `scene.environment = generatedEnvMap` (do NOT set `scene.background`
   to it unless a visible skybox through windows is wanted — see Priority 5).
4. No per-material changes needed — `MeshStandardMaterial` automatically
   picks up `scene.environment` for reflections.

**Effort:** Small. **Impact:** High — usually the fastest "why does this
suddenly look premium" win available.

---

## Priority 3 — First-person walkthrough mode (the actual differentiator)

**Problem:** Current interaction appears to be orbit/top-down build mode only
(`OrbitControls` imported at line 2). A WeWork-style photo tour can't be
edited or booked from — this app's whole advantage is that it's a live,
walkable, *bookable* twin of the space. Leaning into that beats trying to
out-photorealism a photograph.

**Action:**
1. Add a mode toggle (button in existing toolbar UI) that swaps from the
   current build/orbit camera to a first-person camera: drop `camera.position`
   to roughly eye height (~1.6 units given `WALL_H = 3.2`), lock pitch to a
   sane range, and switch from `OrbitControls` to either
   `PointerLockControls` (three/addons) for WASD + mouselook, or a simpler
   drag-to-look + on-screen joystick for mobile/demo-friendliness.
2. Constrain movement to stay within `GRID_W` / `GRID_D` bounds and add
   basic collision against placed furniture bounding boxes (reuse
   `checkAABBCollision` from `utils/collision.js` if feasible, or a simplified
   version) so the camera doesn't clip through desks.
3. This mode should be read-only (`ACCESS_MODE === 'view'` friendly) — it's
   for customers previewing a space/booking, not for editing placement.
4. Optional nice touch: animate the transition between build-mode camera and
   first-person camera (ease position/rotation over ~0.6s using the existing
   `animejs` dependency already in the project) rather than snapping.

**Effort:** Moderate. **Impact:** High — this is the feature a static photo
tour structurally cannot offer, so it's worth more to the pitch than pure
photorealism chasing.

---

## Priority 4 — Post-processing pass (SSAO + subtle bloom)

**Problem:** No post-processing currently in the render loop — no ambient
occlusion in corners/under furniture, no bloom on bright light sources. Both
are cheap, well-known "reads as premium" tricks.

**Action:**
1. Add `three/addons/postprocessing/EffectComposer.js`,
   `RenderPass`, and `SSAOPass` (or `N8AOPass` / `GTAOPass` if available in
   this Three.js version — check r185 addons) to the render setup.
2. Add `UnrealBloomPass` at a low strength/threshold, tuned so only genuinely
   bright areas (window light, if any emissive/bright materials exist) bloom
   — not the whole scene.
3. Swap the render loop's `renderer.render(scene, camera)` call for
   `composer.render()`.
4. Watch performance — SSAO is the most expensive of these. Test on a
   mid-range laptop/integrated GPU before committing; consider making it
   toggleable if frame rate drops noticeably with larger rooms.

**Effort:** Small–moderate. **Impact:** Medium — polish layer, most
noticeable once Priority 1 and 2 are done (AO/bloom on primitive boxes is
much less convincing than on real furniture models).

---

## Priority 5 — Real image-based textures for floor/wall materials

**Problem:** `materials.js` (`createProceduralCanvasTexture`) draws wood
grain, tile grout, and marble veining by hand onto a `<canvas>` with simple
line/noise drawing. Clever and lightweight, but reads as a pattern rather
than a material at close range.

**Action:**
1. Source a handful of free seamless PBR texture sets (ambientCG.com or
   polyhaven.com — "wood floor," "tile," "marble," "plaster") including
   diffuse/albedo + roughness + normal maps where available.
2. In `getFloorMaterial` / `getWallMaterial` (`materials.js`), load these
   with `THREE.TextureLoader` instead of / alongside the procedural canvas
   generator, set `.wrapS = .wrapT = THREE.RepeatWrapping` and tune
   `.repeat` to the room's grid scale, and wire the normal map into
   `normalMap` on the `MeshStandardMaterial` (currently only `bumpMap` is
   used — a real normal map will read as more detailed than the bump-only
   approach).
3. Keep the procedural generator as a fallback for any material key that
   doesn't have a sourced texture yet, so nothing breaks mid-migration.

**Effort:** Small–moderate. **Impact:** Medium — most visible on the floor,
which occupies the most screen real estate in most camera angles.

---

## Suggested order of implementation

1. HDRI environment map (fastest win, do first to see baseline improvement)
2. GLTF furniture models (highest impact, most work — do while the HDRI is
   already in place so improvements are visible together)
3. Real floor/wall textures
4. Post-processing (SSAO + bloom)
5. First-person walkthrough mode (biggest scope, save for last since it's
   additive/independent of the above and is more of a new feature than a
   fidelity fix)

## Explicitly out of scope for this pass

- Do not change the state model (`state`, `saveState`/`loadState`,
  `history`/undo-redo, `pushHistory`) — visual changes should be purely
  additive to the render layer.
- Do not change the 2D canvas fallback path's *logic* — it's a legitimate
  accessibility/compat fallback and doesn't need to chase 3D fidelity.
- Do not add a backend, auth, or persistence beyond what already exists
  (`localStorage` via `STATE_KEY`) — this is a visual-fidelity pass, not a
  scope expansion.
