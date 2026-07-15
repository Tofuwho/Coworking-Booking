/* ═══════════════════════════════════════════════════════════════
   ROOM MATERIALS & FURNITURE CATALOG DATA DEFINITIONS (VECTOR ICONS)
   ═══════════════════════════════════════════════════════════════ */

const SVG_ICONS = {
  seating: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 11v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path d="M6 18v3M18 18v3"/></svg>`,
  desks: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="6" rx="2"/><path d="M4 10v10M20 10v10M9 10v6M15 10v6"/></svg>`,
  storage: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><circle cx="12" cy="6" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="18" r="1"/></svg>`,
  decor: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
  amenity: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  window: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg>`,
  art: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  sparkle: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,

  chair: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 11v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path d="M6 18v3M18 18v3"/></svg>`,
  sofa: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><rect x="2" y="11" width="20" height="6" rx="2"/><path d="M4 17v4M20 17v4"/></svg>`,
  table: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="4" rx="1"/><path d="M5 10v10M19 10v10"/></svg>`,
  plant: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 10a4 4 0 0 0-4-4C5 6 3 9 3 12c3 0 6-2 9-2z"/><path d="M12 10a4 4 0 0 1 4-4c3 0 5 3 5 6-3 0-6-2-9-2z"/><path d="M12 10v12"/><path d="M8 22h8"/></svg>`,
  lamp: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6l3 7H6l3-7z"/><line x1="12" y1="10" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/></svg>`,
  bookshelf: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="14" x2="20" y2="14"/></svg>`,
  cup: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>`
};

const FLOOR_MATS = {
  'light-wood':  {name:'Light Wood',   hex:'#c4a46c', alt:'#d2b47e'},
  'dark-wood':   {name:'Dark Wood',    hex:'#5c3d1e', alt:'#6e4e2c'},
  'concrete':    {name:'Polished Concrete', hex:'#7a7a82', alt:'#888890'},
  'carpet-gray': {name:'Slate Carpet', hex:'#505058', alt:'#5c5c64'},
  'carpet-blue': {name:'Navy Carpet',  hex:'#2a4460', alt:'#325070'},
  'marble':      {name:'Carrara Marble', hex:'#d8d4cc', alt:'#e4e0d8'},
  'tiles':       {name:'Terracotta Tiles', hex:'#b08068', alt:'#c09078'},
};

const WALL_MATS = {
  'white':        {name:'Pure White',           hex:'#ececec'},
  'glass-clear':  {name:'Clear Tempered Glass', hex:'#7ac8e2', transparent:true, opacity:0.3,  roughness:0.05, metalness:0.95, isGlass:true},
  'glass-frosted':{name:'Frosted Privacy Glass',hex:'#b2d4e0', transparent:true, opacity:0.55, roughness:0.45, metalness:0.4,  isGlass:true},
  'glass-tinted': {name:'Tinted Dark Glass',   hex:'#2d3a4a', transparent:true, opacity:0.65, roughness:0.1,  metalness:0.85, isGlass:true},
  'light-gray':   {name:'Cool Gray',            hex:'#a4a8b0'},
  'warm-beige':   {name:'Sandstone Beige',      hex:'#d8c8b0'},
  'brick':        {name:'Exposed Red Brick',    hex:'#a44834'},
  'wood-panel':   {name:'Walnut Panel',         hex:'#785838'},
  'concrete':     {name:'Raw Cement',           hex:'#7a7a80'},
  'teal':         {name:'Deep Teal',            hex:'#2d6a6a'},
  'navy':         {name:'Midnight Blue',        hex:'#1e2e4a'},
  'sage':         {name:'Muted Sage',           hex:'#6c886a'},
  'blush':        {name:'Soft Blush',           hex:'#be8888'},
};

const CATEGORIES = [
  {id:'windows', icon: SVG_ICONS.window,  name:'Walls & Windows'},
  {id:'art',     icon: SVG_ICONS.art,     name:'Wall Art & Décor'},
  {id:'seating', icon: SVG_ICONS.seating, name:'Seating'},
  {id:'desks',   icon: SVG_ICONS.desks,   name:'Desks & Tables'},
  {id:'storage', icon: SVG_ICONS.storage, name:'Storage'},
  {id:'decor',   icon: SVG_ICONS.decor,   name:'Plants & Lights'},
  {id:'amenity', icon: SVG_ICONS.amenity, name:'Amenities'},
];

const PRESETS = [
  {
    id: 'office',
    name: 'Executive Office',
    icon: SVG_ICONS.sparkle,
    floor: 'light-wood',
    leftWall: 'white',
    rightWall: 'wood-panel',
    gridW: 8, gridD: 6,
    items: [
      { id: 'item-1', type: 'standing-desk', gx: 4, gy: 1, rotation: 0 },
      { id: 'item-2', type: 'office-chair', gx: 4, gy: 0, rotation: 0 },
      { id: 'item-3', type: 'bookshelf', gx: 0, gy: 0, rotation: 0 },
      { id: 'item-4', type: 'potted-plant', gx: 7, gy: 0, rotation: 0 },
      { id: 'item-5', type: 'armchair', gx: 1, gy: 4, rotation: 90 },
      { id: 'item-6', type: 'rug', gx: 3, gy: 2, rotation: 0 },
      { id: 'item-7', type: 'floor-lamp', gx: 0, gy: 5, rotation: 0 },
      { id: 'item-8', type: 'glass-partition-2', gx: 2, gy: 3, rotation: 90 },
      { id: 'item-9', type: 'abstract-art', gx: 0, gy: 3, rotation: 90 },
    ]
  },
  {
    id: 'meeting',
    name: 'Glass Partition Room',
    icon: SVG_ICONS.sparkle,
    floor: 'carpet-blue',
    leftWall: 'white',
    rightWall: 'navy',
    gridW: 9, gridD: 7,
    items: [
      { id: 'item-1', type: 'conf-table', gx: 3, gy: 2, rotation: 0 },
      { id: 'item-2', type: 'office-chair', gx: 3, gy: 1, rotation: 0 },
      { id: 'item-3', type: 'office-chair', gx: 4, gy: 1, rotation: 0 },
      { id: 'item-4', type: 'office-chair', gx: 5, gy: 1, rotation: 0 },
      { id: 'item-5', type: 'office-chair', gx: 3, gy: 4, rotation: 180 },
      { id: 'item-6', type: 'office-chair', gx: 4, gy: 4, rotation: 180 },
      { id: 'item-7', type: 'office-chair', gx: 5, gy: 4, rotation: 180 },
      { id: 'item-8', type: 'tv-screen', gx: 3, gy: 0, rotation: 0 },
      { id: 'item-9', type: 'whiteboard', gx: 0, gy: 2, rotation: 90 },
      { id: 'item-10', type: 'potted-plant', gx: 8, gy: 0, rotation: 0 },
      { id: 'item-11', type: 'glass-partition-2', gx: 1, gy: 5, rotation: 0 },
      { id: 'item-12', type: 'double-door', gx: 3, gy: 5, rotation: 0 },
      { id: 'item-13', type: 'glass-partition-2', gx: 5, gy: 5, rotation: 0 },
      { id: 'item-14', type: 'wall-clock', gx: 8, gy: 0, rotation: 0 },
    ]
  },
  {
    id: 'lounge',
    name: 'Breakout Lounge',
    icon: SVG_ICONS.sparkle,
    floor: 'dark-wood',
    leftWall: 'brick',
    rightWall: 'teal',
    gridW: 8, gridD: 6,
    items: [
      { id: 'item-1', type: 'sofa', gx: 2, gy: 4, rotation: 0 },
      { id: 'item-2', type: 'armchair', gx: 0, gy: 3, rotation: 90 },
      { id: 'item-3', type: 'round-table', gx: 1, gy: 2, rotation: 0 },
      { id: 'item-4', type: 'coffee-machine', gx: 6, gy: 0, rotation: 0 },
      { id: 'item-5', type: 'mini-fridge', gx: 7, gy: 0, rotation: 0 },
      { id: 'item-6', type: 'water-cooler', gx: 5, gy: 0, rotation: 0 },
      { id: 'item-7', type: 'potted-plant', gx: 0, gy: 0, rotation: 0 },
      { id: 'item-8', type: 'rug', gx: 1, gy: 3, rotation: 0 },
      { id: 'item-9', type: 'neon-sign', gx: 3, gy: 0, rotation: 0 },
      { id: 'item-10', type: 'acoustic-wall-2', gx: 5, gy: 3, rotation: 90 },
    ]
  }
];

const FURNITURE = {
  // ── PLACEABLE WALLS, WINDOWS & DOORS ─────────────────────────
  'glass-partition-2':{name:'Glass Wall (2m)', cat:'windows', icon: SVG_ICONS.window, gw:2,gd:1, parts:[
    {dx:0,dz:0,dy:0.46, w:2.0,h:2.6,d:0.08, color:'#7ac8e2'}, // Tempered glass pane
    {dx:0,dz:0,dy:0.42, w:2.0,h:0.08,d:0.16, color:'#2a2a30'}, // Bottom metal frame track
    {dx:0,dz:2.52,dy:0.42, w:2.0,h:0.08,d:0.16, color:'#2a2a30'}, // Top metal frame track
    {dx:0,dz:0,dy:0.42, w:0.08,h:2.6,d:0.16, color:'#3a3a42'}, // Left support pillar
    {dx:1.92,dz:0,dy:0.42, w:0.08,h:2.6,d:0.16, color:'#3a3a42'}, // Right support pillar
    {dx:0.96,dz:0,dy:0.42, w:0.06,h:2.6,d:0.12, color:'#3a3a42'}, // Center mullion seam
  ]},
  'frosted-partition-2':{name:'Frosted Wall (2m)', cat:'windows', icon: SVG_ICONS.window, gw:2,gd:1, parts:[
    {dx:0,dz:0,dy:0.46, w:2.0,h:2.6,d:0.08, color:'#b2d4e0'}, // Frosted glass pane
    {dx:0,dz:0,dy:0.42, w:2.0,h:0.08,d:0.16, color:'#3a3a40'}, // Bottom frame
    {dx:0,dz:2.52,dy:0.42, w:2.0,h:0.08,d:0.16, color:'#3a3a40'}, // Top frame
    {dx:0,dz:0,dy:0.42, w:0.08,h:2.6,d:0.16, color:'#4a4a52'}, // Left pillar
    {dx:1.92,dz:0,dy:0.42, w:0.08,h:2.6,d:0.16, color:'#4a4a52'}, // Right pillar
  ]},
  'acoustic-wall-2':{name:'Wood Slat Wall (2m)', cat:'windows', icon: SVG_ICONS.window, gw:2,gd:1, parts:[
    {dx:0,dz:0,dy:0.45, w:2.0,h:2.6,d:0.06, color:'#28282e'}, // Dark backing felt board
    {dx:0.1,dz:0,dy:0.4, w:0.1,h:2.6,d:0.14, color:'#a88054'}, // Wooden slat 1
    {dx:0.35,dz:0,dy:0.4, w:0.1,h:2.6,d:0.14, color:'#a88054'}, // Wooden slat 2
    {dx:0.6,dz:0,dy:0.4, w:0.1,h:2.6,d:0.14, color:'#a88054'}, // Wooden slat 3
    {dx:0.85,dz:0,dy:0.4, w:0.1,h:2.6,d:0.14, color:'#a88054'}, // Wooden slat 4
    {dx:1.1,dz:0,dy:0.4, w:0.1,h:2.6,d:0.14, color:'#a88054'}, // Wooden slat 5
    {dx:1.35,dz:0,dy:0.4, w:0.1,h:2.6,d:0.14, color:'#a88054'}, // Wooden slat 6
    {dx:1.6,dz:0,dy:0.4, w:0.1,h:2.6,d:0.14, color:'#a88054'}, // Wooden slat 7
    {dx:1.85,dz:0,dy:0.4, w:0.1,h:2.6,d:0.14, color:'#a88054'}, // Wooden slat 8
  ]},
  'large-window':   {name:'Panoramic Window',cat:'windows', icon: SVG_ICONS.window, gw:2,gd:1, parts:[
    {dx:0,dz:1.1,dy:0, w:2.0,h:1.5,d:0.08, color:'#78b0d0'},
    {dx:0,dz:1.1,dy:0, w:2.0,h:0.06,d:0.1, color:'#333'},
    {dx:0,dz:2.54,dy:0, w:2.0,h:0.06,d:0.1, color:'#333'},
    {dx:0,dz:1.1,dy:0, w:0.06,h:1.5,d:0.1, color:'#333'},
    {dx:1.94,dz:1.1,dy:0, w:0.06,h:1.5,d:0.1, color:'#333'},
    {dx:0.97,dz:1.1,dy:0, w:0.06,h:1.5,d:0.1, color:'#333'},
  ]},
  'arched-window':  {name:'Sunlit Window',   cat:'windows', icon: SVG_ICONS.window, gw:2,gd:1, parts:[
    {dx:0.2,dz:1.2,dy:0, w:1.6,h:1.4,d:0.08, color:'#90c8e8'},
    {dx:0.15,dz:1.15,dy:0, w:1.7,h:0.06,d:0.1, color:'#ececec'},
    {dx:0.15,dz:2.55,dy:0, w:1.7,h:0.06,d:0.1, color:'#ececec'},
    {dx:0.15,dz:1.15,dy:0, w:0.06,h:1.46,d:0.1, color:'#ececec'},
    {dx:1.79,dz:1.15,dy:0, w:0.06,h:1.46,d:0.1, color:'#ececec'},
  ]},
  'double-door':    {name:'Glass Doors',     cat:'windows', icon: SVG_ICONS.window, gw:2,gd:1, parts:[
    {dx:0,dz:0,dy:0, w:0.06,h:2.4,d:0.12, color:'#3a3a40'},
    {dx:1.94,dz:0,dy:0, w:0.06,h:2.4,d:0.12, color:'#3a3a40'},
    {dx:0,dz:2.34,dy:0, w:2.0,h:0.06,d:0.12, color:'#3a3a40'},
    {dx:0.06,dz:0.05,dy:0.02, w:0.92,h:2.25,d:0.04, color:'#7aa4c4'},
    {dx:1.02,dz:0.05,dy:0.02, w:0.92,h:2.25,d:0.04, color:'#7aa4c4'},
    {dx:0.9,dz:1.1,dy:0, w:0.04,h:0.2,d:0.08, color:'#d0d0d8'},
    {dx:1.06,dz:1.1,dy:0, w:0.04,h:0.2,d:0.08, color:'#d0d0d8'},
  ]},

  // ── WALL ART & DÉCOR ─────────────────────────────────────────
  'abstract-art':   {name:'Canvas Art',      cat:'art', icon: SVG_ICONS.art, gw:2,gd:1, parts:[
    {dx:0.1,dz:1.3,dy:0, w:1.8,h:1.2,d:0.06, color:'#d87050'},
    {dx:0.2,dz:1.4,dy:0.02, w:0.6,h:0.9,d:0.05, color:'#4a7c9d'},
    {dx:0.9,dz:1.5,dy:0.02, w:0.8,h:0.5,d:0.05, color:'#e8bc68'},
  ]},
  'neon-sign':      {name:'Neon "CREATE"',   cat:'art', icon: SVG_ICONS.art, gw:2,gd:1, parts:[
    {dx:0.2,dz:1.6,dy:0, w:1.6,h:0.5,d:0.04, color:'#bd34fe'},
    {dx:0.25,dz:1.65,dy:0.01, w:1.5,h:0.4,d:0.04, color:'#e0a0ff'},
  ]},
  'wall-clock':     {name:'Wall Clock',      cat:'art', icon: SVG_ICONS.art, gw:1,gd:1, parts:[
    {dx:0.25,dz:1.7,dy:0, w:0.5,h:0.5,d:0.05, color:'#282830'},
    {dx:0.3,dz:1.75,dy:0.02, w:0.4,h:0.4,d:0.04, color:'#f0f0f5'},
  ]},
  'hanging-planter':{name:'Wall Plant Shelf',cat:'art', icon: SVG_ICONS.art, gw:1,gd:1, parts:[
    {dx:0.1,dz:1.2,dy:0, w:0.8,h:0.05,d:0.3, color:'#745a3a'},
    {dx:0.25,dz:1.25,dy:0.05, w:0.5,h:0.25,d:0.25, color:'#b87050'},
    {dx:0.15,dz:1.5,dy:0.02, w:0.7,h:0.35,d:0.28, color:'#3a8a3a'},
  ]},
  'air-conditioner':{name:'Wall AC Unit',    cat:'art', icon: SVG_ICONS.art, gw:2,gd:1, parts:[
    {dx:0.1,dz:2.2,dy:0.05, w:1.8,h:0.4,d:0.3, color:'#ececec'},
    {dx:0.2,dz:2.23,dy:0.3, w:1.6,h:0.04,d:0.06, color:'#555'},
  ]},

  // ── SEATING ──────────────────────────────────────────────────
  'office-chair':   {name:'Executive Chair',cat:'seating', icon: SVG_ICONS.chair,  gw:1,gd:1, parts:[
    {dx:0.2,dz:0,dy:0.2, w:0.6,h:0.08,d:0.6, color:'#4a4a50'},
    {dx:0.12,dz:0.25,dy:0.12, w:0.76,h:0.07,d:0.76, color:'#2d2d32'},
    {dx:0.15,dz:0.32,dy:0, w:0.7,h:0.5,d:0.12, color:'#2d2d32'},
  ]},
  'armchair':       {name:'Armchair',       cat:'seating', icon: SVG_ICONS.chair, gw:1,gd:1, parts:[
    {dx:0.05,dz:0,dy:0.05, w:0.9,h:0.3,d:0.9, color:'#446288'},
    {dx:0.05,dz:0.3,dy:0, w:0.9,h:0.55,d:0.15, color:'#365072'},
    {dx:0,dz:0.3,dy:0.05, w:0.14,h:0.2,d:0.9, color:'#365072'},
    {dx:0.86,dz:0.3,dy:0.05, w:0.14,h:0.2,d:0.9, color:'#365072'},
  ]},
  'sofa':           {name:'Executive Sofa', cat:'seating', icon: SVG_ICONS.sofa, gw:2,gd:1, parts:[
    {dx:0.05,dz:0,dy:0.05, w:1.9,h:0.3,d:0.9, color:'#58425e'},
    {dx:0.05,dz:0.3,dy:0, w:1.9,h:0.55,d:0.15, color:'#48364e'},
    {dx:0,dz:0.3,dy:0.05, w:0.14,h:0.2,d:0.9, color:'#48364e'},
    {dx:1.86,dz:0.3,dy:0.05, w:0.14,h:0.2,d:0.9, color:'#48364e'},
  ]},
  'bean-bag':       {name:'Lounge Bean Bag',cat:'seating', icon: SVG_ICONS.chair,  gw:1,gd:1, parts:[
    {dx:0.1,dz:0,dy:0.1, w:0.8,h:0.35,d:0.8, color:'#aa5a32'},
    {dx:0.2,dz:0.35,dy:0.1, w:0.6,h:0.18,d:0.5, color:'#964e2a'},
  ]},

  // ── DESKS & TABLES ───────────────────────────────────────────
  'simple-desk':    {name:'Simple Desk',    cat:'desks', icon: SVG_ICONS.table,   gw:2,gd:1, parts:[
    {dx:0.02,dz:0,dy:0.02, w:0.08,h:0.42,d:0.08, color:'#745a3a'},
    {dx:1.9,dz:0,dy:0.02, w:0.08,h:0.42,d:0.08, color:'#745a3a'},
    {dx:0.02,dz:0,dy:0.9, w:0.08,h:0.42,d:0.08, color:'#745a3a'},
    {dx:1.9,dz:0,dy:0.9, w:0.08,h:0.42,d:0.08, color:'#745a3a'},
    {dx:0,dz:0.42,dy:0, w:2.0,h:0.06,d:1.0, color:'#8c6f4a'},
  ]},
  'standing-desk':  {name:'Standing Desk',  cat:'desks', icon: SVG_ICONS.table,   gw:2,gd:1, parts:[
    {dx:0.1,dz:0,dy:0.25, w:0.1,h:0.65,d:0.5, color:'#3d3d42'},
    {dx:1.8,dz:0,dy:0.25, w:0.1,h:0.65,d:0.5, color:'#3d3d42'},
    {dx:0,dz:0.65,dy:0, w:2.0,h:0.05,d:1.0, color:'#d0c4b4'},
  ]},
  'l-desk':         {name:'L-Shaped Desk',  cat:'desks', icon: SVG_ICONS.table,   gw:2,gd:2, parts:[
    {dx:0,dz:0,dy:0, w:0.08,h:0.42,d:0.08, color:'#58442a'},
    {dx:1.92,dz:0,dy:0, w:0.08,h:0.42,d:0.08, color:'#58442a'},
    {dx:0,dz:0,dy:1.92, w:0.08,h:0.42,d:0.08, color:'#58442a'},
    {dx:0.92,dz:0,dy:0.92, w:0.08,h:0.42,d:0.08, color:'#58442a'},
    {dx:0,dz:0.42,dy:0, w:2.0,h:0.05,d:1.0, color:'#785e3a'},
    {dx:0,dz:0.42,dy:0.95, w:1.0,h:0.05,d:1.05, color:'#785e3a'},
  ]},
  'round-table':    {name:'Round Table',    cat:'desks', icon: SVG_ICONS.table,   gw:1,gd:1, parts:[
    {dx:0.3,dz:0,dy:0.3, w:0.4,h:0.38,d:0.4, color:'#745a3a'},
    {dx:0.05,dz:0.38,dy:0.05, w:0.9,h:0.05,d:0.9, color:'#8c6f4a'},
  ]},
  'conf-table':     {name:'Conference Table',cat:'desks', icon: SVG_ICONS.table,  gw:3,gd:2, parts:[
    {dx:0.2,dz:0,dy:0.3, w:0.2,h:0.38,d:1.4, color:'#463224'},
    {dx:2.6,dz:0,dy:0.3, w:0.2,h:0.38,d:1.4, color:'#463224'},
    {dx:0,dz:0.38,dy:0, w:3.0,h:0.07,d:2.0, color:'#664c36'},
  ]},

  // ── STORAGE ──────────────────────────────────────────────────
  'bookshelf':      {name:'Tall Bookshelf', cat:'storage', icon: SVG_ICONS.bookshelf, gw:2,gd:1, parts:[
    {dx:0,dz:0,dy:0, w:0.06,h:1.5,d:0.8, color:'#58442a'},
    {dx:1.94,dz:0,dy:0, w:0.06,h:1.5,d:0.8, color:'#58442a'},
    {dx:0,dz:0,dy:0, w:2.0,h:0.05,d:0.8, color:'#685234'},
    {dx:0,dz:0.42,dy:0, w:2.0,h:0.04,d:0.8, color:'#685234'},
    {dx:0,dz:0.82,dy:0, w:2.0,h:0.04,d:0.8, color:'#685234'},
    {dx:0,dz:1.2,dy:0, w:2.0,h:0.04,d:0.8, color:'#685234'},
    {dx:0,dz:1.46,dy:0, w:2.0,h:0.04,d:0.8, color:'#685234'},
    {dx:0.1,dz:0.05,dy:0.05, w:0.5,h:0.35,d:0.65, color:'#366288'},
    {dx:0.7,dz:0.05,dy:0.05, w:0.5,h:0.35,d:0.65, color:'#b85436'},
    {dx:1.3,dz:0.05,dy:0.05, w:0.55,h:0.35,d:0.65, color:'#467258'},
    {dx:0.1,dz:0.46,dy:0.05, w:0.8,h:0.33,d:0.65, color:'#a84444'},
    {dx:1.0,dz:0.46,dy:0.05, w:0.85,h:0.33,d:0.65, color:'#547294'},
  ]},
  'filing-cabinet': {name:'Filing Cabinet', cat:'storage', icon: SVG_ICONS.storage, gw:1,gd:1, parts:[
    {dx:0.1,dz:0,dy:0.1, w:0.8,h:0.95,d:0.8, color:'#55555d'},
    {dx:0.25,dz:0.06,dy:0.05, w:0.5,h:0.22,d:0.04, color:'#777780'},
    {dx:0.25,dz:0.34,dy:0.05, w:0.5,h:0.22,d:0.04, color:'#777780'},
    {dx:0.25,dz:0.62,dy:0.05, w:0.5,h:0.22,d:0.04, color:'#777780'},
  ]},
  'locker':         {name:'Steel Locker',   cat:'storage', icon: SVG_ICONS.storage, gw:1,gd:1, parts:[
    {dx:0.1,dz:0,dy:0.1, w:0.8,h:1.6,d:0.8, color:'#4a5868'},
    {dx:0.35,dz:0.6,dy:0.05, w:0.06,h:0.4,d:0.04, color:'#8a9aa8'},
  ]},

  // ── PLANTS & LIGHTING ────────────────────────────────────────
  'potted-plant':   {name:'Potted Plant',   cat:'decor', icon: SVG_ICONS.plant,   gw:1,gd:1, parts:[
    {dx:0.25,dz:0,dy:0.25, w:0.5,h:0.28,d:0.5, color:'#785032'},
    {dx:0.15,dz:0.28,dy:0.15, w:0.7,h:0.4,d:0.7, color:'#2c782c'},
    {dx:0.22,dz:0.62,dy:0.22, w:0.56,h:0.3,d:0.56, color:'#226622'},
  ]},
  'floor-lamp':     {name:'Floor Lamp',     cat:'decor', icon: SVG_ICONS.lamp,    gw:1,gd:1, parts:[
    {dx:0.3,dz:0,dy:0.3, w:0.4,h:0.04,d:0.4, color:'#444'},
    {dx:0.42,dz:0.04,dy:0.42, w:0.16,h:1.1,d:0.16, color:'#333'},
    {dx:0.2,dz:1.1,dy:0.2, w:0.6,h:0.28,d:0.6, color:'#e8d888'},
  ]},
  'rug':            {name:'Area Rug',       cat:'decor', icon: SVG_ICONS.decor,   gw:3,gd:2, parts:[
    {dx:0,dz:0,dy:0, w:3.0,h:0.02,d:2.0, color:'#784a4a'},
    {dx:0.15,dz:0.02,dy:0.15, w:2.7,h:0.01,d:1.7, color:'#8e5858'},
  ]},
  'whiteboard':     {name:'Mobile Whiteboard',cat:'decor', icon: SVG_ICONS.decor, gw:2,gd:1, parts:[
    {dx:0.15,dz:0,dy:0.35, w:0.08,h:1.1,d:0.3, color:'#555'},
    {dx:1.77,dz:0,dy:0.35, w:0.08,h:1.1,d:0.3, color:'#555'},
    {dx:0,dz:0.4,dy:0.38, w:2.0,h:0.7,d:0.06, color:'#dfdfdf'},
  ]},
  'tv-screen':      {name:'Wall Display',   cat:'decor', icon: SVG_ICONS.art,     gw:3,gd:1, parts:[
    {dx:0.1,dz:0.8,dy:0.02, w:2.8,h:0.9,d:0.06, color:'#18181c'},
    {dx:0.18,dz:0.84,dy:0.01, w:2.64,h:0.82,d:0.04, color:'#2a4e74'},
  ]},

  // ── AMENITIES ────────────────────────────────────────────────
  'coffee-machine': {name:'Espresso Station',cat:'amenity', icon: SVG_ICONS.cup,  gw:1,gd:1, parts:[
    {dx:0.15,dz:0,dy:0.15, w:0.7,h:0.5,d:0.7, color:'#2c2c30'},
    {dx:0.25,dz:0.5,dy:0.2, w:0.5,h:0.25,d:0.35, color:'#444'},
  ]},
  'water-cooler':   {name:'Water Dispenser',cat:'amenity', icon: SVG_ICONS.cup,  gw:1,gd:1, parts:[
    {dx:0.2,dz:0,dy:0.2, w:0.6,h:0.7,d:0.6, color:'#b8c4d0'},
    {dx:0.25,dz:0.7,dy:0.25, w:0.5,h:0.45,d:0.5, color:'#4488cc'},
  ]},
  'mini-fridge':    {name:'Mini Fridge',    cat:'amenity', icon: SVG_ICONS.cup,  gw:1,gd:1, parts:[
    {dx:0.1,dz:0,dy:0.1, w:0.8,h:0.85,d:0.8, color:'#28282c'},
    {dx:0.7,dz:0.35,dy:0.05, w:0.05,h:0.2,d:0.04, color:'#888'},
  ]},
};
