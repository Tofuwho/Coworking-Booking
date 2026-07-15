/* ═══════════════════════════════════════════════════════════════
   ROOM MATERIALS & FURNITURE CATALOG DATA DEFINITIONS
   ═══════════════════════════════════════════════════════════════ */

const FLOOR_MATS = {
  'light-wood':  {name:'Light Wood',   hex:'#c4a46c', alt:'#d2b47e'},
  'dark-wood':   {name:'Dark Wood',    hex:'#6b4c2a', alt:'#7d5e3c'},
  'concrete':    {name:'Concrete',     hex:'#8a8a8a', alt:'#969696'},
  'carpet-gray': {name:'Gray Carpet',  hex:'#6a6a70', alt:'#767678'},
  'carpet-blue': {name:'Blue Carpet',  hex:'#3e5e7e', alt:'#486888'},
  'marble':      {name:'Marble',       hex:'#d0ccc4', alt:'#dcd8d0'},
  'tiles':       {name:'Tiles',        hex:'#b8b0a4', alt:'#c8c0b4'},
};

const WALL_MATS = {
  'white':       {name:'White',      hex:'#e0e0e0'},
  'light-gray':  {name:'Light Gray', hex:'#b0b0b0'},
  'warm-beige':  {name:'Warm Beige', hex:'#d4c4aa'},
  'brick':       {name:'Brick',      hex:'#a85a3c'},
  'wood-panel':  {name:'Wood Panel', hex:'#8a6e4a'},
  'concrete':    {name:'Concrete',   hex:'#8a8a8a'},
  'teal':        {name:'Teal',       hex:'#4a8a8a'},
  'navy':        {name:'Navy',       hex:'#2e3e5e'},
  'sage':        {name:'Sage',       hex:'#7a9a78'},
  'blush':       {name:'Blush',      hex:'#c49494'},
};

const CATEGORIES = [
  {id:'seating', icon:'🪑', name:'Seating'},
  {id:'desks',   icon:'🖥️', name:'Desks & Tables'},
  {id:'storage', icon:'📚', name:'Storage'},
  {id:'decor',   icon:'🌿', name:'Décor'},
  {id:'amenity', icon:'☕', name:'Amenities'},
];

const PRESETS = [
  {
    id: 'office',
    name: 'Executive Office',
    icon: '💼',
    floor: 'light-wood',
    leftWall: 'warm-beige',
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
    ]
  },
  {
    id: 'meeting',
    name: 'Conference Room',
    icon: '🤝',
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
    ]
  },
  {
    id: 'lounge',
    name: 'Breakout Lounge',
    icon: '☕',
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
    ]
  }
];

const FURNITURE = {
  'office-chair':   {name:'Office Chair',   cat:'seating', emoji:'🪑',  gw:1,gd:1, parts:[
    {dx:0.2,dz:0,dy:0.2, w:0.6,h:0.08,d:0.6, color:'#555'},
    {dx:0.12,dz:0.25,dy:0.12, w:0.76,h:0.07,d:0.76, color:'#3d3d3d'},
    {dx:0.15,dz:0.32,dy:0, w:0.7,h:0.5,d:0.12, color:'#3d3d3d'},
  ]},
  'armchair':       {name:'Armchair',       cat:'seating', emoji:'🛋️', gw:1,gd:1, parts:[
    {dx:0.05,dz:0,dy:0.05, w:0.9,h:0.3,d:0.9, color:'#5576a0'},
    {dx:0.05,dz:0.3,dy:0, w:0.9,h:0.55,d:0.15, color:'#4a6890'},
    {dx:0,dz:0.3,dy:0.05, w:0.14,h:0.2,d:0.9, color:'#4a6890'},
    {dx:0.86,dz:0.3,dy:0.05, w:0.14,h:0.2,d:0.9, color:'#4a6890'},
  ]},
  'sofa':           {name:'Sofa',           cat:'seating', emoji:'🛋️', gw:2,gd:1, parts:[
    {dx:0.05,dz:0,dy:0.05, w:1.9,h:0.3,d:0.9, color:'#6b5070'},
    {dx:0.05,dz:0.3,dy:0, w:1.9,h:0.55,d:0.15, color:'#5e4462'},
    {dx:0,dz:0.3,dy:0.05, w:0.14,h:0.2,d:0.9, color:'#5e4462'},
    {dx:1.86,dz:0.3,dy:0.05, w:0.14,h:0.2,d:0.9, color:'#5e4462'},
  ]},
  'bean-bag':       {name:'Bean Bag',       cat:'seating', emoji:'🫘',  gw:1,gd:1, parts:[
    {dx:0.1,dz:0,dy:0.1, w:0.8,h:0.35,d:0.8, color:'#c07040'},
    {dx:0.2,dz:0.35,dy:0.1, w:0.6,h:0.18,d:0.5, color:'#b06535'},
  ]},

  'simple-desk':    {name:'Simple Desk',    cat:'desks', emoji:'📋',   gw:2,gd:1, parts:[
    {dx:0.02,dz:0,dy:0.02, w:0.08,h:0.42,d:0.08, color:'#8a6e4a'},
    {dx:1.9,dz:0,dy:0.02, w:0.08,h:0.42,d:0.08, color:'#8a6e4a'},
    {dx:0.02,dz:0,dy:0.9, w:0.08,h:0.42,d:0.08, color:'#8a6e4a'},
    {dx:1.9,dz:0,dy:0.9, w:0.08,h:0.42,d:0.08, color:'#8a6e4a'},
    {dx:0,dz:0.42,dy:0, w:2.0,h:0.06,d:1.0, color:'#a0845c'},
  ]},
  'standing-desk':  {name:'Standing Desk',  cat:'desks', emoji:'🧍',   gw:2,gd:1, parts:[
    {dx:0.1,dz:0,dy:0.25, w:0.1,h:0.65,d:0.5, color:'#555'},
    {dx:1.8,dz:0,dy:0.25, w:0.1,h:0.65,d:0.5, color:'#555'},
    {dx:0,dz:0.65,dy:0, w:2.0,h:0.05,d:1.0, color:'#e0d4c4'},
  ]},
  'l-desk':         {name:'L-Shaped Desk',  cat:'desks', emoji:'📐',   gw:2,gd:2, parts:[
    {dx:0,dz:0,dy:0, w:0.08,h:0.42,d:0.08, color:'#6b5335'},
    {dx:1.92,dz:0,dy:0, w:0.08,h:0.42,d:0.08, color:'#6b5335'},
    {dx:0,dz:0,dy:1.92, w:0.08,h:0.42,d:0.08, color:'#6b5335'},
    {dx:0.92,dz:0,dy:0.92, w:0.08,h:0.42,d:0.08, color:'#6b5335'},
    {dx:0,dz:0.42,dy:0, w:2.0,h:0.05,d:1.0, color:'#8a7050'},
    {dx:0,dz:0.42,dy:0.95, w:1.0,h:0.05,d:1.05, color:'#8a7050'},
  ]},
  'round-table':    {name:'Round Table',    cat:'desks', emoji:'⭕',   gw:1,gd:1, parts:[
    {dx:0.3,dz:0,dy:0.3, w:0.4,h:0.38,d:0.4, color:'#8a6e4a'},
    {dx:0.05,dz:0.38,dy:0.05, w:0.9,h:0.05,d:0.9, color:'#a0845c'},
  ]},
  'conf-table':     {name:'Conference Table',cat:'desks', emoji:'🪵',  gw:3,gd:2, parts:[
    {dx:0.2,dz:0,dy:0.3, w:0.2,h:0.38,d:1.4, color:'#5a4030'},
    {dx:2.6,dz:0,dy:0.3, w:0.2,h:0.38,d:1.4, color:'#5a4030'},
    {dx:0,dz:0.38,dy:0, w:3.0,h:0.07,d:2.0, color:'#7a5e44'},
  ]},

  'bookshelf':      {name:'Bookshelf',      cat:'storage', emoji:'📚', gw:2,gd:1, parts:[
    {dx:0,dz:0,dy:0, w:0.06,h:1.5,d:0.8, color:'#6b5335'},
    {dx:1.94,dz:0,dy:0, w:0.06,h:1.5,d:0.8, color:'#6b5335'},
    {dx:0,dz:0,dy:0, w:2.0,h:0.05,d:0.8, color:'#7a6240'},
    {dx:0,dz:0.42,dy:0, w:2.0,h:0.04,d:0.8, color:'#7a6240'},
    {dx:0,dz:0.82,dy:0, w:2.0,h:0.04,d:0.8, color:'#7a6240'},
    {dx:0,dz:1.2,dy:0, w:2.0,h:0.04,d:0.8, color:'#7a6240'},
    {dx:0,dz:1.46,dy:0, w:2.0,h:0.04,d:0.8, color:'#7a6240'},
    {dx:0.1,dz:0.05,dy:0.05, w:0.5,h:0.35,d:0.65, color:'#4477aa'},
    {dx:0.7,dz:0.05,dy:0.05, w:0.5,h:0.35,d:0.65, color:'#cc6644'},
    {dx:1.3,dz:0.05,dy:0.05, w:0.55,h:0.35,d:0.65, color:'#55886a'},
    {dx:0.1,dz:0.46,dy:0.05, w:0.8,h:0.33,d:0.65, color:'#bb5555'},
    {dx:1.0,dz:0.46,dy:0.05, w:0.85,h:0.33,d:0.65, color:'#6688aa'},
  ]},
  'filing-cabinet': {name:'Filing Cabinet', cat:'storage', emoji:'🗄️', gw:1,gd:1, parts:[
    {dx:0.1,dz:0,dy:0.1, w:0.8,h:0.95,d:0.8, color:'#6a6a6a'},
    {dx:0.25,dz:0.06,dy:0.05, w:0.5,h:0.22,d:0.04, color:'#888'},
    {dx:0.25,dz:0.34,dy:0.05, w:0.5,h:0.22,d:0.04, color:'#888'},
    {dx:0.25,dz:0.62,dy:0.05, w:0.5,h:0.22,d:0.04, color:'#888'},
  ]},
  'locker':         {name:'Locker',         cat:'storage', emoji:'🔐', gw:1,gd:1, parts:[
    {dx:0.1,dz:0,dy:0.1, w:0.8,h:1.6,d:0.8, color:'#5a6a7a'},
    {dx:0.35,dz:0.6,dy:0.05, w:0.06,h:0.4,d:0.04, color:'#aaa'},
  ]},

  'potted-plant':   {name:'Potted Plant',   cat:'decor', emoji:'🪴',   gw:1,gd:1, parts:[
    {dx:0.25,dz:0,dy:0.25, w:0.5,h:0.28,d:0.5, color:'#8a6040'},
    {dx:0.15,dz:0.28,dy:0.15, w:0.7,h:0.4,d:0.7, color:'#3a8a3a'},
    {dx:0.22,dz:0.62,dy:0.22, w:0.56,h:0.3,d:0.56, color:'#2e7a2e'},
  ]},
  'floor-lamp':     {name:'Floor Lamp',     cat:'decor', emoji:'💡',   gw:1,gd:1, parts:[
    {dx:0.3,dz:0,dy:0.3, w:0.4,h:0.04,d:0.4, color:'#555'},
    {dx:0.42,dz:0.04,dy:0.42, w:0.16,h:1.1,d:0.16, color:'#444'},
    {dx:0.2,dz:1.1,dy:0.2, w:0.6,h:0.28,d:0.6, color:'#f5e8a0'},
  ]},
  'rug':            {name:'Area Rug',       cat:'decor', emoji:'🟫',   gw:3,gd:2, parts:[
    {dx:0,dz:0,dy:0, w:3.0,h:0.02,d:2.0, color:'#8a5a5a'},
    {dx:0.15,dz:0.02,dy:0.15, w:2.7,h:0.01,d:1.7, color:'#a06868'},
  ]},
  'whiteboard':     {name:'Whiteboard',     cat:'decor', emoji:'📝',   gw:2,gd:1, parts:[
    {dx:0.15,dz:0,dy:0.35, w:0.08,h:1.1,d:0.3, color:'#666'},
    {dx:1.77,dz:0,dy:0.35, w:0.08,h:1.1,d:0.3, color:'#666'},
    {dx:0,dz:0.4,dy:0.38, w:2.0,h:0.7,d:0.06, color:'#eaeaea'},
  ]},

  'coffee-machine': {name:'Coffee Machine', cat:'amenity', emoji:'☕',  gw:1,gd:1, parts:[
    {dx:0.15,dz:0,dy:0.15, w:0.7,h:0.5,d:0.7, color:'#3a3a3a'},
    {dx:0.25,dz:0.5,dy:0.2, w:0.5,h:0.25,d:0.35, color:'#555'},
  ]},
  'water-cooler':   {name:'Water Cooler',   cat:'amenity', emoji:'🚰',  gw:1,gd:1, parts:[
    {dx:0.2,dz:0,dy:0.2, w:0.6,h:0.7,d:0.6, color:'#d0d8e0'},
    {dx:0.25,dz:0.7,dy:0.25, w:0.5,h:0.4,d:0.5, color:'#7ab0d0'},
  ]},
  'mini-fridge':    {name:'Mini Fridge',    cat:'amenity', emoji:'🧊',  gw:1,gd:1, parts:[
    {dx:0.1,dz:0,dy:0.1, w:0.8,h:0.8,d:0.8, color:'#d0d0d0'},
    {dx:0.14,dz:0.1,dy:0.06, w:0.06,h:0.6,d:0.04, color:'#999'},
  ]},
  'tv-screen':      {name:'TV Screen',     cat:'amenity', emoji:'📺',  gw:2,gd:1, parts:[
    {dx:0.8,dz:0,dy:0.3, w:0.4,h:0.05,d:0.4, color:'#333'},
    {dx:0.7,dz:0.05,dy:0.35, w:0.6,h:0.6,d:0.25, color:'#333'},
    {dx:0.08,dz:0.15,dy:0.38, w:1.84,h:1.05,d:0.06, color:'#1a1a2e'},
    {dx:0.14,dz:0.2,dy:0.36, w:1.72,h:0.92,d:0.04, color:'#2244aa'},
  ]},
};
