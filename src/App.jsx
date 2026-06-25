import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Droplet, Filter, Shield, Wrench, Circle, Trash2, Download, Layers, Package, Move, Plus, Minus, RotateCw, Sprout, Square, ZoomIn, ZoomOut } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Positions are stored in FEET so the canvas can rescale freely.
// At render time we multiply by pxPerFt (the live zoom level).
// ─────────────────────────────────────────────────────────────
const DEFAULT_PX_PER_FT = 20;
const MIN_PX_PER_FT = 6;
const MAX_PX_PER_FT = 60;

// Node size policy by category — small components render as minimal markers.
// 'small'  ≈ 14px marker (fittings, emitters, accessories, filtration)
// 'medium' ≈ 36px marker (source equipment - spigot, timer)
// 'plant'  ≈ scaled to plant footprint
const NODE_SIZES = {
  source: 'medium',
  filtration: 'small',
  fittings: 'small',
  emitters: 'small',
  accessories: 'small',
};

const COMPONENT_LIBRARY = {
  source: {
    label: 'Water Source & Control',
    color: '#5b8def',
    items: [
      { id: 'spigot', name: 'Hose Spigot / Faucet', price: 0, unit: 'ea', shape: 'point', desc: '3/4" outdoor faucet — starting point' },
      { id: 'timer', name: 'Hose-End Timer', price: 38.00, unit: 'ea', shape: 'point', desc: 'Programmable battery timer' },
      { id: 'backflow', name: 'Backflow Preventer', price: 9.50, unit: 'ea', shape: 'point', desc: 'Protects potable water supply' },
    ],
  },
  filtration: {
    label: 'Filtration & Pressure',
    color: '#7c9885',
    items: [
      { id: 'filter', name: 'Y-Filter (150 mesh)', price: 12.99, unit: 'ea', shape: 'point', marker: 'filter', desc: 'Removes sediment before emitters' },
      { id: 'pressure-reg', name: 'Pressure Regulator (25 PSI)', price: 11.50, unit: 'ea', shape: 'point', marker: 'gauge', desc: 'Steps pressure down for drip lines' },
      { id: 'tubing-adapter', name: 'Tubing Adapter / Swivel', price: 3.25, unit: 'ea', shape: 'point', marker: 'square', desc: 'Faucet thread → 1/2" tubing' },
    ],
  },
  mainline: {
    label: 'Mainline & Tubing',
    color: '#d8a657',
    items: [
      { id: 'mainline-half', name: '1/2" Mainline Tubing', price: 0.32, unit: 'ft', shape: 'line', thickness: 6, defaultLen: 10, desc: 'Primary distribution line (poly)' },
      { id: 'mainline-quarter', name: '1/4" Micro Tubing', price: 0.14, unit: 'ft', shape: 'line', thickness: 3, defaultLen: 5, desc: 'Branch line to individual plants' },
      { id: 'dripline', name: 'Inline Emitter Dripline', price: 0.48, unit: 'ft', shape: 'line', thickness: 5, defaultLen: 8, desc: 'Tubing with built-in emitters every 12"' },
    ],
  },
  fittings: {
    label: 'Fittings & Connectors',
    color: '#b8623e',
    items: [
      { id: 'tee', name: 'Tee Fitting (1/2")', price: 1.20, unit: 'ea', shape: 'point', marker: 'tee', desc: 'Three-way branch' },
      { id: 'elbow', name: '90° Elbow (1/2")', price: 1.05, unit: 'ea', shape: 'point', marker: 'elbow', desc: 'Right-angle turn' },
      { id: 'coupler', name: 'Coupler / Straight (1/2")', price: 0.85, unit: 'ea', shape: 'point', marker: 'pill', desc: 'Joins two sections of tubing' },
      { id: 'valve', name: 'Inline Valve', price: 4.75, unit: 'ea', shape: 'point', marker: 'valve', desc: 'Manual shutoff for zones' },
      { id: 'goof-plug', name: 'Goof Plug', price: 0.20, unit: 'ea', shape: 'point', marker: 'dot', desc: 'Plugs unused emitter holes' },
      { id: 'end-cap', name: 'End Cap / Figure 8', price: 0.75, unit: 'ea', shape: 'point', marker: 'cap', desc: 'Closes end of mainline' },
    ],
  },
  emitters: {
    label: 'Emitters & Outlets',
    color: '#3b82a3',
    items: [
      { id: 'emitter-1gph', name: 'Drip Emitter (1 GPH)', price: 0.45, unit: 'ea', shape: 'point', marker: 'numbered', label: '1', desc: 'Slow flow — clay soil' },
      { id: 'emitter-2gph', name: 'Drip Emitter (2 GPH)', price: 0.45, unit: 'ea', shape: 'point', marker: 'numbered', label: '2', desc: 'Medium flow — loam soil' },
      { id: 'emitter-4gph', name: 'Drip Emitter (4 GPH)', price: 0.55, unit: 'ea', shape: 'point', marker: 'numbered', label: '4', desc: 'High flow — sandy soil' },
      { id: 'micro-spray', name: 'Micro-Sprayer', price: 1.10, unit: 'ea', shape: 'point', marker: 'spray', desc: 'Wider coverage for shrubs' },
      { id: 'bubbler', name: 'Adjustable Bubbler', price: 1.25, unit: 'ea', shape: 'point', marker: 'bubbler', desc: 'For trees & large containers' },
    ],
  },
  accessories: {
    label: 'Accessories & Stakes',
    color: '#8b7355',
    items: [
      { id: 'stake', name: 'Hold-Down Stake', price: 0.25, unit: 'ea', shape: 'point', marker: 'triangle', desc: 'Keeps tubing in place' },
      { id: 'support-stake', name: 'Emitter Support Stake', price: 0.35, unit: 'ea', shape: 'point', marker: 'triangle', desc: 'Holds 1/4" tube upright' },
      { id: 'punch', name: 'Hole Punch Tool', price: 8.50, unit: 'ea', shape: 'point', marker: 'square', desc: 'For installing emitters' },
    ],
  },
  areas: {
    label: 'Garden Areas',
    color: '#7c9885',
    nonBom: true,
    items: [
      { id: 'raised-bed', name: 'Raised Bed', price: 0, unit: 'ea', shape: 'area', defaultW: 8, defaultH: 4, fill: '#5c4a32', stroke: '#8b7355', desc: 'Wooden raised garden bed (length × width in ft)' },
      { id: 'in-ground', name: 'In-Ground Garden', price: 0, unit: 'ea', shape: 'area', defaultW: 10, defaultH: 6, fill: '#3d4a2e', stroke: '#7c9885', desc: 'In-ground planting area' },
      { id: 'container', name: 'Container / Pot', price: 0, unit: 'ea', shape: 'area', defaultW: 2, defaultH: 2, fill: '#4a3a2e', stroke: '#b8623e', round: true, desc: 'Round container or large pot' },
      { id: 'lawn', name: 'Lawn / Turf', price: 0, unit: 'ea', shape: 'area', defaultW: 15, defaultH: 10, fill: '#2d4030', stroke: '#5c8a5a', desc: 'Grass area' },
    ],
  },
  plants: {
    label: 'Plants',
    color: '#9bc88f',
    nonBom: true,
    items: [
      // Herbs & leafy (small footprint)
      { id: 'plant-herb', name: 'Herb', price: 0, unit: 'ea', shape: 'point', plantIcon: 'herb', diaFt: 1.0, desc: 'Basil, parsley, thyme, oregano' },
      { id: 'plant-leafy', name: 'Leafy Green', price: 0, unit: 'ea', shape: 'point', plantIcon: 'leafy', diaFt: 1.2, desc: 'Lettuce, kale, chard, spinach' },
      { id: 'plant-strawberry', name: 'Strawberry', price: 0, unit: 'ea', shape: 'point', plantIcon: 'strawberry', diaFt: 1.0, desc: 'Low-growing berry plant' },
      { id: 'plant-onion', name: 'Onion / Garlic', price: 0, unit: 'ea', shape: 'point', plantIcon: 'onion', diaFt: 0.5, desc: 'Allium — bulb crops' },
      { id: 'plant-carrot', name: 'Root Vegetable', price: 0, unit: 'ea', shape: 'point', plantIcon: 'carrot', diaFt: 0.5, desc: 'Carrots, beets, radishes' },

      // Medium vegetables
      { id: 'plant-pepper', name: 'Pepper / Eggplant', price: 0, unit: 'ea', shape: 'point', plantIcon: 'pepper', diaFt: 2.0, desc: 'Bushy fruiting plant' },
      { id: 'plant-tomato', name: 'Tomato', price: 0, unit: 'ea', shape: 'point', plantIcon: 'tomato', diaFt: 2.5, desc: 'Indeterminate vine — 1-2 emitters' },
      { id: 'plant-broccoli', name: 'Brassica', price: 0, unit: 'ea', shape: 'point', plantIcon: 'broccoli', diaFt: 2.0, desc: 'Broccoli, cabbage, cauliflower' },
      { id: 'plant-bean', name: 'Bean / Pea', price: 0, unit: 'ea', shape: 'point', plantIcon: 'bean', diaFt: 1.5, desc: 'Climbing or bush legumes' },
      { id: 'plant-corn', name: 'Corn', price: 0, unit: 'ea', shape: 'point', plantIcon: 'corn', diaFt: 1.2, desc: 'Stalk crop — plant in blocks' },

      // Vining / sprawling
      { id: 'plant-squash', name: 'Squash / Melon', price: 0, unit: 'ea', shape: 'point', plantIcon: 'squash', diaFt: 4.0, desc: 'Sprawling vines — zucchini, pumpkin' },
      { id: 'plant-cucumber', name: 'Cucumber', price: 0, unit: 'ea', shape: 'point', plantIcon: 'cucumber', diaFt: 3.0, desc: 'Vining — trellis or sprawl' },

      // Shrubs & bushes
      { id: 'plant-shrub-small', name: 'Small Shrub', price: 0, unit: 'ea', shape: 'point', plantIcon: 'shrub', diaFt: 3.0, desc: 'Blueberry, lavender, small ornamentals' },
      { id: 'plant-shrub-large', name: 'Large Shrub', price: 0, unit: 'ea', shape: 'point', plantIcon: 'shrub-large', diaFt: 5.0, desc: 'Hydrangea, rose bush, mature blueberry' },
      { id: 'plant-grape', name: 'Grape / Berry Cane', price: 0, unit: 'ea', shape: 'point', plantIcon: 'grape', diaFt: 4.0, desc: 'Trained on trellis or fence' },

      // Trees (scale increases significantly)
      { id: 'plant-tree-dwarf', name: 'Dwarf Tree', price: 0, unit: 'ea', shape: 'point', plantIcon: 'tree-small', diaFt: 6.0, desc: 'Dwarf citrus, columnar apple' },
      { id: 'plant-tree-small', name: 'Small Tree', price: 0, unit: 'ea', shape: 'point', plantIcon: 'tree-small', diaFt: 10.0, desc: 'Semi-dwarf fruit, Japanese maple' },
      { id: 'plant-tree-medium', name: 'Medium Tree', price: 0, unit: 'ea', shape: 'point', plantIcon: 'tree-large', diaFt: 18.0, desc: 'Standard fruit tree, dogwood' },
      { id: 'plant-tree-large', name: 'Large Tree', price: 0, unit: 'ea', shape: 'point', plantIcon: 'tree-large', diaFt: 30.0, desc: 'Mature shade tree — oak, maple' },

      // Ornamentals
      { id: 'plant-flower', name: 'Flower / Annual', price: 0, unit: 'ea', shape: 'point', plantIcon: 'flower', diaFt: 0.8, desc: 'Petunias, marigolds, zinnias' },
      { id: 'plant-perennial', name: 'Perennial', price: 0, unit: 'ea', shape: 'point', plantIcon: 'perennial', diaFt: 1.5, desc: 'Daylily, salvia, coneflower' },
    ],
  },
};

const CATEGORY_ICONS = {
  source: Droplet,
  filtration: Filter,
  mainline: Layers,
  fittings: Wrench,
  emitters: Circle,
  accessories: Shield,
  areas: Square,
  plants: Sprout,
};

const ALL_ITEMS = {};
Object.entries(COMPONENT_LIBRARY).forEach(([catKey, cat]) => {
  cat.items.forEach(item => {
    ALL_ITEMS[item.id] = { ...item, category: catKey, categoryColor: cat.color, categoryLabel: cat.label, nonBom: cat.nonBom };
  });
});

// ─────────────────────────────────────────────────────────────
// SMALL NODE MARKER — minimal geometric shape for fittings/emitters etc.
// Designed to read clearly even at 14-18px.
// ─────────────────────────────────────────────────────────────
const NodeMarker = ({ item, size = 16 }) => {
  const color = item.categoryColor;
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.45;

  switch (item.marker) {
    case 'dot':
      return <svg width={s} height={s}><circle cx={cx} cy={cy} r={r} fill={color}/></svg>;
    case 'tee':
      return (
        <svg width={s} height={s}>
          <circle cx={cx} cy={cy} r={r} fill="#0a0e13" stroke={color} strokeWidth="1.5"/>
          <path d={`M ${cx-r*0.6} ${cy} L ${cx+r*0.6} ${cy} M ${cx} ${cy} L ${cx} ${cy+r*0.6}`} stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
    case 'elbow':
      return (
        <svg width={s} height={s}>
          <circle cx={cx} cy={cy} r={r} fill="#0a0e13" stroke={color} strokeWidth="1.5"/>
          <path d={`M ${cx-r*0.6} ${cy} L ${cx} ${cy} L ${cx} ${cy+r*0.6}`} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'pill':
      return (
        <svg width={s} height={s}>
          <rect x={cx-r} y={cy-r*0.5} width={r*2} height={r} rx={r*0.5} fill={color}/>
        </svg>
      );
    case 'valve':
      return (
        <svg width={s} height={s}>
          <circle cx={cx} cy={cy} r={r} fill={color}/>
          <line x1={cx-r*0.5} y1={cy} x2={cx+r*0.5} y2={cy} stroke="#0a0e13" strokeWidth="1.5"/>
        </svg>
      );
    case 'cap':
      return (
        <svg width={s} height={s}>
          <rect x={cx-r} y={cy-r*0.7} width={r*1.4} height={r*1.4} fill={color}/>
          <circle cx={cx+r*0.65} cy={cy} r={r*0.5} fill={color}/>
        </svg>
      );
    case 'square':
      return <svg width={s} height={s}><rect x={cx-r*0.85} y={cy-r*0.85} width={r*1.7} height={r*1.7} fill={color} rx="1"/></svg>;
    case 'triangle':
      return (
        <svg width={s} height={s}>
          <path d={`M ${cx} ${cy-r} L ${cx+r*0.9} ${cy+r*0.6} L ${cx-r*0.9} ${cy+r*0.6} Z`} fill={color}/>
        </svg>
      );
    case 'numbered':
      return (
        <svg width={s} height={s}>
          <circle cx={cx} cy={cy} r={r} fill={color}/>
          <text x={cx} y={cy + s*0.13} fontSize={s*0.55} fill="#0a0e13" textAnchor="middle" fontWeight="700" fontFamily="IBM Plex Mono, monospace">{item.label}</text>
        </svg>
      );
    case 'spray':
      return (
        <svg width={s} height={s}>
          <circle cx={cx} cy={cy} r={r*0.35} fill={color}/>
          {[0,45,90,135,180,225,270,315].map(a => {
            const rad = a * Math.PI/180;
            return <line key={a} x1={cx + Math.cos(rad)*r*0.4} y1={cy + Math.sin(rad)*r*0.4} x2={cx + Math.cos(rad)*r*0.95} y2={cy + Math.sin(rad)*r*0.95} stroke={color} strokeWidth="1.2" strokeLinecap="round"/>;
          })}
        </svg>
      );
    case 'bubbler':
      return (
        <svg width={s} height={s}>
          <circle cx={cx} cy={cy+r*0.2} r={r*0.55} fill={color}/>
          <path d={`M ${cx-r*0.35} ${cy-r*0.2} L ${cx-r*0.6} ${cy-r*0.7} M ${cx} ${cy-r*0.3} L ${cx} ${cy-r*0.8} M ${cx+r*0.35} ${cy-r*0.2} L ${cx+r*0.6} ${cy-r*0.7}`} stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
    case 'filter':
      return (
        <svg width={s} height={s}>
          <path d={`M ${cx-r} ${cy-r*0.7} L ${cx+r} ${cy-r*0.7} L ${cx} ${cy+r*0.7} Z`} fill={color}/>
        </svg>
      );
    case 'gauge':
      return (
        <svg width={s} height={s}>
          <circle cx={cx} cy={cy} r={r} fill="#0a0e13" stroke={color} strokeWidth="1.5"/>
          <line x1={cx} y1={cy} x2={cx + r*0.55} y2={cy - r*0.45} stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx={cx} cy={cy} r="1.2" fill={color}/>
        </svg>
      );
    default:
      return <svg width={s} height={s}><circle cx={cx} cy={cy} r={r} fill={color}/></svg>;
  }
};

// ─────────────────────────────────────────────────────────────
// MEDIUM HARDWARE GLYPH — for source category (spigot/timer/backflow)
// ─────────────────────────────────────────────────────────────
const MediumGlyph = ({ item, size = 36 }) => {
  const color = item.categoryColor;
  const s = size;
  const cx = s/2, cy = s/2;
  const shapes = {
    spigot: <g><rect x={s*0.2} y={s*0.35} width={s*0.6} height={s*0.3} fill={color} rx="2"/><circle cx={cx} cy={s*0.2} r={s*0.12} fill="none" stroke={color} strokeWidth="2"/></g>,
    timer: <g><rect x={s*0.15} y={s*0.2} width={s*0.7} height={s*0.6} fill="none" stroke={color} strokeWidth="2" rx="3"/><circle cx={cx} cy={cy} r={s*0.18} fill={color}/><line x1={cx} y1={cy} x2={cx} y2={s*0.35} stroke="#0f1419" strokeWidth="2"/></g>,
    backflow: <g><rect x={s*0.15} y={s*0.3} width={s*0.7} height={s*0.4} fill="none" stroke={color} strokeWidth="2"/><path d={`M ${s*0.3} ${cy} L ${s*0.5} ${s*0.4} L ${s*0.5} ${s*0.6} Z`} fill={color}/></g>,
  };
  return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>{shapes[item.id] || <circle cx={cx} cy={cy} r={s*0.3} fill={color}/>}</svg>;
};

// ─────────────────────────────────────────────────────────────
// PLANT GLYPHS — top-down botanical
// ─────────────────────────────────────────────────────────────
const PlantGlyph = ({ iconType, size = 44 }) => {
  const s = size;
  const cx = s / 2, cy = s / 2;
  const glyphs = {
    tomato: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.38} fill="#3a5a2a" opacity="0.6"/>
        <circle cx={cx} cy={cy} r={s*0.28} fill="#4a7a35"/>
        <circle cx={cx - s*0.1} cy={cy - s*0.05} r={s*0.08} fill="#d94545"/>
        <circle cx={cx + s*0.08} cy={cy + s*0.08} r={s*0.07} fill="#d94545"/>
        <circle cx={cx + s*0.05} cy={cy - s*0.12} r={s*0.06} fill="#e85555"/>
      </g>
    ),
    pepper: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.34} fill="#3a5a2a" opacity="0.6"/>
        <circle cx={cx} cy={cy} r={s*0.24} fill="#4a7a35"/>
        <path d={`M ${cx-s*0.08} ${cy-s*0.04} Q ${cx-s*0.1} ${cy+s*0.06}, ${cx-s*0.05} ${cy+s*0.1}`} stroke="#e8a040" strokeWidth={s*0.05} fill="none" strokeLinecap="round"/>
        <path d={`M ${cx+s*0.06} ${cy-s*0.02} Q ${cx+s*0.08} ${cy+s*0.08}, ${cx+s*0.03} ${cy+s*0.12}`} stroke="#d94545" strokeWidth={s*0.05} fill="none" strokeLinecap="round"/>
      </g>
    ),
    leafy: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.4} fill="#5a8c3a" opacity="0.4"/>
        {[0, 60, 120, 180, 240, 300].map(a => {
          const rad = a * Math.PI / 180;
          return <ellipse key={a} cx={cx + Math.cos(rad)*s*0.18} cy={cy + Math.sin(rad)*s*0.18} rx={s*0.16} ry={s*0.1} fill="#6ba045" transform={`rotate(${a + 90} ${cx + Math.cos(rad)*s*0.18} ${cy + Math.sin(rad)*s*0.18})`} opacity="0.85"/>;
        })}
        <circle cx={cx} cy={cy} r={s*0.06} fill="#3a5a2a"/>
      </g>
    ),
    herb: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.3} fill="#5a8c3a" opacity="0.5"/>
        {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
          const rad = a * Math.PI / 180;
          return <circle key={a} cx={cx + Math.cos(rad)*s*0.16} cy={cy + Math.sin(rad)*s*0.16} r={s*0.07} fill="#7ab050" opacity="0.9"/>;
        })}
        <circle cx={cx} cy={cy} r={s*0.09} fill="#6ba045"/>
      </g>
    ),
    strawberry: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.35} fill="#4a7a35" opacity="0.5"/>
        {[0, 72, 144, 216, 288].map(a => {
          const rad = a * Math.PI / 180;
          return <ellipse key={a} cx={cx + Math.cos(rad)*s*0.16} cy={cy + Math.sin(rad)*s*0.16} rx={s*0.13} ry={s*0.08} fill="#5a9040" transform={`rotate(${a + 90} ${cx + Math.cos(rad)*s*0.16} ${cy + Math.sin(rad)*s*0.16})`}/>;
        })}
        <circle cx={cx - s*0.05} cy={cy + s*0.05} r={s*0.06} fill="#d94545"/>
        <circle cx={cx + s*0.08} cy={cy - s*0.04} r={s*0.05} fill="#d94545"/>
      </g>
    ),
    shrub: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.4} fill="#3a5a2a" opacity="0.5"/>
        <circle cx={cx} cy={cy} r={s*0.32} fill="#4a7a35"/>
        <circle cx={cx - s*0.12} cy={cy - s*0.1} r={s*0.1} fill="#5a8c3a"/>
        <circle cx={cx + s*0.1} cy={cy - s*0.08} r={s*0.09} fill="#5a8c3a"/>
        <circle cx={cx} cy={cy + s*0.12} r={s*0.1} fill="#5a8c3a"/>
      </g>
    ),
    'tree-small': (
      <g>
        <circle cx={cx} cy={cy} r={s*0.42} fill="#2a4a1a" opacity="0.4"/>
        <circle cx={cx} cy={cy} r={s*0.34} fill="#3a6a25"/>
        <circle cx={cx - s*0.12} cy={cy - s*0.12} r={s*0.12} fill="#4a7a35"/>
        <circle cx={cx + s*0.13} cy={cy - s*0.08} r={s*0.13} fill="#4a7a35"/>
        <circle cx={cx - s*0.05} cy={cy + s*0.14} r={s*0.11} fill="#4a7a35"/>
        <circle cx={cx} cy={cy} r={s*0.05} fill="#3a2818"/>
      </g>
    ),
    'tree-large': (
      <g>
        <circle cx={cx} cy={cy} r={s*0.46} fill="#1a3010" opacity="0.5"/>
        <circle cx={cx} cy={cy} r={s*0.4} fill="#2a4a1a"/>
        <circle cx={cx - s*0.16} cy={cy - s*0.14} r={s*0.16} fill="#3a6a25"/>
        <circle cx={cx + s*0.16} cy={cy - s*0.1} r={s*0.17} fill="#3a6a25"/>
        <circle cx={cx - s*0.08} cy={cy + s*0.18} r={s*0.15} fill="#3a6a25"/>
        <circle cx={cx + s*0.1} cy={cy + s*0.14} r={s*0.13} fill="#3a6a25"/>
        <circle cx={cx} cy={cy} r={s*0.07} fill="#3a2818"/>
      </g>
    ),
    onion: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.25} fill="#5a8c3a" opacity="0.5"/>
        <ellipse cx={cx} cy={cy} rx={s*0.08} ry={s*0.14} fill="#c8b88a"/>
        {[60, 120, 180, 240, 300, 360].map(a => {
          const rad = a * Math.PI/180;
          return <line key={a} x1={cx} y1={cy} x2={cx + Math.cos(rad)*s*0.22} y2={cy + Math.sin(rad)*s*0.22} stroke="#6ba045" strokeWidth={s*0.035} strokeLinecap="round"/>;
        })}
      </g>
    ),
    carrot: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.22} fill="#5a8c3a" opacity="0.4"/>
        {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
          const rad = a * Math.PI/180;
          return <line key={a} x1={cx} y1={cy} x2={cx + Math.cos(rad)*s*0.2} y2={cy + Math.sin(rad)*s*0.2} stroke="#6ba045" strokeWidth={s*0.04} strokeLinecap="round"/>;
        })}
        <circle cx={cx} cy={cy} r={s*0.06} fill="#d97540"/>
      </g>
    ),
    broccoli: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.38} fill="#3a5a2a" opacity="0.5"/>
        <circle cx={cx} cy={cy} r={s*0.3} fill="#4a7a35"/>
        {[0, 60, 120, 180, 240, 300].map(a => {
          const rad = a * Math.PI/180;
          return <circle key={a} cx={cx + Math.cos(rad)*s*0.15} cy={cy + Math.sin(rad)*s*0.15} r={s*0.09} fill="#5a9040" opacity="0.95"/>;
        })}
        <circle cx={cx} cy={cy} r={s*0.1} fill="#5a9040"/>
      </g>
    ),
    bean: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.3} fill="#5a8c3a" opacity="0.4"/>
        <path d={`M ${cx-s*0.18} ${cy-s*0.12} Q ${cx} ${cy-s*0.3}, ${cx+s*0.18} ${cy-s*0.12}`} stroke="#6ba045" strokeWidth={s*0.04} fill="none"/>
        <ellipse cx={cx-s*0.12} cy={cy} rx={s*0.08} ry={s*0.04} fill="#7ab050" transform={`rotate(-30 ${cx-s*0.12} ${cy})`}/>
        <ellipse cx={cx+s*0.12} cy={cy} rx={s*0.08} ry={s*0.04} fill="#7ab050" transform={`rotate(30 ${cx+s*0.12} ${cy})`}/>
        <ellipse cx={cx} cy={cy+s*0.12} rx={s*0.08} ry={s*0.04} fill="#7ab050"/>
      </g>
    ),
    corn: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.2} fill="#5a8c3a" opacity="0.3"/>
        <path d={`M ${cx} ${cy+s*0.2} L ${cx-s*0.15} ${cy-s*0.15} M ${cx} ${cy+s*0.2} L ${cx+s*0.15} ${cy-s*0.15} M ${cx} ${cy+s*0.2} L ${cx} ${cy-s*0.22}`} stroke="#7ab050" strokeWidth={s*0.05} strokeLinecap="round" fill="none"/>
        <ellipse cx={cx} cy={cy-s*0.08} rx={s*0.05} ry={s*0.12} fill="#e8c050"/>
      </g>
    ),
    squash: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.45} fill="#3a5a2a" opacity="0.5"/>
        {/* Sprawling vines */}
        <path d={`M ${cx} ${cy} Q ${cx-s*0.2} ${cy-s*0.25}, ${cx-s*0.35} ${cy-s*0.1}`} stroke="#5a8c3a" strokeWidth={s*0.04} fill="none" strokeLinecap="round"/>
        <path d={`M ${cx} ${cy} Q ${cx+s*0.25} ${cy-s*0.15}, ${cx+s*0.38} ${cy+s*0.05}`} stroke="#5a8c3a" strokeWidth={s*0.04} fill="none" strokeLinecap="round"/>
        <path d={`M ${cx} ${cy} Q ${cx-s*0.1} ${cy+s*0.25}, ${cx-s*0.3} ${cy+s*0.32}`} stroke="#5a8c3a" strokeWidth={s*0.04} fill="none" strokeLinecap="round"/>
        <path d={`M ${cx} ${cy} Q ${cx+s*0.15} ${cy+s*0.2}, ${cx+s*0.3} ${cy+s*0.35}`} stroke="#5a8c3a" strokeWidth={s*0.04} fill="none" strokeLinecap="round"/>
        {/* Leaves */}
        <circle cx={cx-s*0.28} cy={cy-s*0.1} r={s*0.09} fill="#6ba045"/>
        <circle cx={cx+s*0.3} cy={cy+s*0.05} r={s*0.09} fill="#6ba045"/>
        <circle cx={cx-s*0.22} cy={cy+s*0.28} r={s*0.08} fill="#6ba045"/>
        <circle cx={cx+s*0.24} cy={cy+s*0.3} r={s*0.08} fill="#6ba045"/>
        {/* Fruits */}
        <ellipse cx={cx-s*0.08} cy={cy+s*0.08} rx={s*0.06} ry={s*0.04} fill="#d8a040" transform={`rotate(-20 ${cx-s*0.08} ${cy+s*0.08})`}/>
        <circle cx={cx} cy={cy} r={s*0.06} fill="#5a8c3a"/>
      </g>
    ),
    cucumber: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.4} fill="#3a5a2a" opacity="0.4"/>
        {/* Vines spreading */}
        <path d={`M ${cx} ${cy} Q ${cx-s*0.2} ${cy-s*0.1}, ${cx-s*0.3} ${cy+s*0.15}`} stroke="#5a8c3a" strokeWidth={s*0.04} fill="none"/>
        <path d={`M ${cx} ${cy} Q ${cx+s*0.2} ${cy+s*0.1}, ${cx+s*0.3} ${cy-s*0.15}`} stroke="#5a8c3a" strokeWidth={s*0.04} fill="none"/>
        {/* Cucumber fruits */}
        <ellipse cx={cx-s*0.18} cy={cy+s*0.05} rx={s*0.04} ry={s*0.1} fill="#4a7a35" transform={`rotate(-30 ${cx-s*0.18} ${cy+s*0.05})`}/>
        <ellipse cx={cx+s*0.18} cy={cy-s*0.05} rx={s*0.04} ry={s*0.1} fill="#4a7a35" transform={`rotate(30 ${cx+s*0.18} ${cy-s*0.05})`}/>
        {/* Leaves */}
        <circle cx={cx} cy={cy} r={s*0.1} fill="#6ba045"/>
      </g>
    ),
    'shrub-large': (
      <g>
        <circle cx={cx} cy={cy} r={s*0.45} fill="#2a4a1a" opacity="0.5"/>
        <circle cx={cx} cy={cy} r={s*0.38} fill="#3a6a25"/>
        <circle cx={cx - s*0.16} cy={cy - s*0.12} r={s*0.14} fill="#4a7a35"/>
        <circle cx={cx + s*0.15} cy={cy - s*0.1} r={s*0.13} fill="#4a7a35"/>
        <circle cx={cx - s*0.08} cy={cy + s*0.16} r={s*0.13} fill="#4a7a35"/>
        <circle cx={cx + s*0.12} cy={cy + s*0.14} r={s*0.12} fill="#4a7a35"/>
        <circle cx={cx} cy={cy - s*0.02} r={s*0.1} fill="#5a8c3a"/>
      </g>
    ),
    grape: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.42} fill="#3a5a2a" opacity="0.4"/>
        {/* Twisted vine */}
        <path d={`M ${cx-s*0.35} ${cy} Q ${cx-s*0.1} ${cy-s*0.15}, ${cx+s*0.1} ${cy-s*0.05} T ${cx+s*0.35} ${cy+s*0.05}`} stroke="#7a5a3a" strokeWidth={s*0.05} fill="none" strokeLinecap="round"/>
        {/* Leaves */}
        <circle cx={cx-s*0.18} cy={cy-s*0.05} r={s*0.1} fill="#5a8c3a"/>
        <circle cx={cx+s*0.18} cy={cy+s*0.08} r={s*0.1} fill="#5a8c3a"/>
        {/* Grape clusters */}
        <circle cx={cx-s*0.08} cy={cy+s*0.14} r={s*0.025} fill="#8a5aa0"/>
        <circle cx={cx-s*0.02} cy={cy+s*0.17} r={s*0.025} fill="#8a5aa0"/>
        <circle cx={cx+s*0.04} cy={cy+s*0.14} r={s*0.025} fill="#8a5aa0"/>
        <circle cx={cx-s*0.04} cy={cy+s*0.21} r={s*0.025} fill="#8a5aa0"/>
        <circle cx={cx+s*0.02} cy={cy+s*0.21} r={s*0.025} fill="#8a5aa0"/>
        <circle cx={cx-s*0.01} cy={cy+s*0.25} r={s*0.025} fill="#8a5aa0"/>
      </g>
    ),
    flower: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.32} fill="#5a8c3a" opacity="0.4"/>
        {[0, 60, 120, 180, 240, 300].map(a => {
          const rad = a * Math.PI/180;
          return <ellipse key={a} cx={cx + Math.cos(rad)*s*0.16} cy={cy + Math.sin(rad)*s*0.16} rx={s*0.1} ry={s*0.07} fill="#e88aa0" transform={`rotate(${a} ${cx + Math.cos(rad)*s*0.16} ${cy + Math.sin(rad)*s*0.16})`}/>;
        })}
        <circle cx={cx} cy={cy} r={s*0.08} fill="#e8c050"/>
      </g>
    ),
    perennial: (
      <g>
        <circle cx={cx} cy={cy} r={s*0.38} fill="#5a8c3a" opacity="0.4"/>
        {[0, 72, 144, 216, 288].map(a => {
          const rad = a * Math.PI/180;
          return <ellipse key={a} cx={cx + Math.cos(rad)*s*0.2} cy={cy + Math.sin(rad)*s*0.2} rx={s*0.12} ry={s*0.07} fill="#6ba045" transform={`rotate(${a + 90} ${cx + Math.cos(rad)*s*0.2} ${cy + Math.sin(rad)*s*0.2})`}/>;
        })}
        {[36, 108, 180, 252, 324].map(a => {
          const rad = a * Math.PI/180;
          return <circle key={a} cx={cx + Math.cos(rad)*s*0.15} cy={cy + Math.sin(rad)*s*0.15} r={s*0.04} fill="#c878d8"/>;
        })}
      </g>
    ),
  };
  return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>{glyphs[iconType] || <circle cx={cx} cy={cy} r={s*0.3} fill="#5a8c3a"/>}</svg>;
};

// ─────────────────────────────────────────────────────────────
// PaletteIcon — what shows in the left rail (always larger preview)
// ─────────────────────────────────────────────────────────────
const PaletteIcon = ({ item, size = 28 }) => {
  if (item.plantIcon) return <PlantGlyph iconType={item.plantIcon} size={size}/>;
  if (item.category === 'source') return <MediumGlyph item={item} size={size}/>;
  if (item.shape === 'area') {
    const s = size, cx = s/2, cy = s/2;
    if (item.round) {
      return <svg width={s} height={s}><circle cx={cx} cy={cy} r={s*0.4} fill={item.fill} stroke={item.stroke} strokeWidth="1.5"/></svg>;
    }
    return <svg width={s} height={s}><rect x={s*0.15} y={s*0.2} width={s*0.7} height={s*0.6} fill={item.fill} stroke={item.stroke} strokeWidth="1.5" strokeDasharray={item.id==='in-ground' ? '3,2' : undefined}/></svg>;
  }
  if (item.shape === 'line') {
    const s = size, cy = s/2;
    return <svg width={s} height={s}><line x1={s*0.1} y1={cy} x2={s*0.9} y2={cy} stroke={item.categoryColor} strokeWidth={item.thickness || 4} strokeLinecap="round" strokeDasharray={item.id==='mainline-quarter' ? '2,2' : undefined}/>
      {item.id === 'dripline' && [0.25, 0.5, 0.75].map(t => <circle key={t} cx={s*0.1 + (s*0.8)*t} cy={cy} r="1.5" fill="#0a0e13"/>)}
    </svg>;
  }
  return <NodeMarker item={item} size={size}/>;
};

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function DripPlanner() {
  const [view, setView] = useState('canvas');
  const [pxPerFt, setPxPerFt] = useState(DEFAULT_PX_PER_FT);

  // Components stored in FEET (xFt, yFt for points; x1Ft/y1Ft/x2Ft/y2Ft for lines; xFt/yFt/wFt/hFt for areas)
  const [placedComponents, setPlacedComponents] = useState([]);
  const [connections, setConnections] = useState([]);
  const [draggingItem, setDraggingItem] = useState(null);
  const [selectedUid, setSelectedUid] = useState(null);

  const [interaction, setInteraction] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [mousePos, setMousePos] = useState({ xFt: 0, yFt: 0 });
  const [expandedCats, setExpandedCats] = useState({ source: true, filtration: true, mainline: true, fittings: false, emitters: true, accessories: false, areas: true, plants: true });
  const [projectName, setProjectName] = useState('Untitled Design');
  const [saveStatus, setSaveStatus] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [loading, setLoading] = useState(true);

  const canvasRef = useRef(null);
  const uidCounter = useRef(0);

  // ── Load saved ─────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('current-design-v4');
      if (raw) {
        const data = JSON.parse(raw);
        // Drop any components whose item IDs no longer exist in the library
        const loaded = (data.placedComponents || []).filter(c => ALL_ITEMS[c.itemId]);
        const validUids = new Set(loaded.map(c => c.uid));
        const loadedConns = (data.connections || []).filter(conn => validUids.has(conn.from) && validUids.has(conn.to));
        setPlacedComponents(loaded);
        setConnections(loadedConns);
        setProjectName(data.projectName || 'Untitled Design');
        setPxPerFt(data.pxPerFt || DEFAULT_PX_PER_FT);
        uidCounter.current = data.uidCounter || 0;
      }
    } catch (e) {}
    setLoading(false);
  }, []);

  // ── Autosave ───────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem('current-design-v4', JSON.stringify({
          placedComponents, connections, projectName, pxPerFt, uidCounter: uidCounter.current,
        }));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 1500);
      } catch (e) { setSaveStatus('error'); }
    }, 600);
    return () => clearTimeout(t);
  }, [placedComponents, connections, projectName, pxPerFt, loading]);

  // ── Canvas → feet conversion ────────────────────────────
  const getCanvasFt = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      xFt: (e.clientX - rect.left + canvasRef.current.scrollLeft) / pxPerFt,
      yFt: (e.clientY - rect.top + canvasRef.current.scrollTop) / pxPerFt,
    };
  };

  // ── Drop from palette ──────────────────────────────────
  const handlePaletteDragStart = (itemId) => (e) => {
    setDraggingItem(itemId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCanvasDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    if (!draggingItem) return;
    const { xFt, yFt } = getCanvasFt(e);
    const item = ALL_ITEMS[draggingItem];
    const uid = ++uidCounter.current;

    let newComp;
    if (item.shape === 'line') {
      const halfLen = item.defaultLen / 2;
      newComp = { uid, itemId: draggingItem, x1Ft: xFt - halfLen, y1Ft: yFt, x2Ft: xFt + halfLen, y2Ft: yFt };
    } else if (item.shape === 'area') {
      newComp = { uid, itemId: draggingItem, xFt: xFt - item.defaultW/2, yFt: yFt - item.defaultH/2, wFt: item.defaultW, hFt: item.defaultH };
    } else {
      newComp = { uid, itemId: draggingItem, xFt, yFt };
    }
    setPlacedComponents(prev => [...prev, newComp]);
    setDraggingItem(null);
    setSelectedUid(uid);
  };

  // ── Mouse move (drag operations) ───────────────────────
  const handleCanvasMouseMove = (e) => {
    const pt = getCanvasFt(e);
    setMousePos(pt);
    if (!interaction) return;

    setPlacedComponents(prev => prev.map(c => {
      if (c.uid !== interaction.uid) return c;
      if (interaction.type === 'move-point') {
        return { ...c, xFt: pt.xFt - interaction.offsetXFt, yFt: pt.yFt - interaction.offsetYFt };
      }
      if (interaction.type === 'move-line') {
        const dx = pt.xFt - interaction.startMouseXFt;
        const dy = pt.yFt - interaction.startMouseYFt;
        return { ...c,
          x1Ft: interaction.startX1Ft + dx, y1Ft: interaction.startY1Ft + dy,
          x2Ft: interaction.startX2Ft + dx, y2Ft: interaction.startY2Ft + dy,
        };
      }
      if (interaction.type === 'drag-endpoint') {
        if (interaction.end === 1) return { ...c, x1Ft: pt.xFt, y1Ft: pt.yFt };
        return { ...c, x2Ft: pt.xFt, y2Ft: pt.yFt };
      }
      if (interaction.type === 'move-area') {
        return { ...c, xFt: pt.xFt - interaction.offsetXFt, yFt: pt.yFt - interaction.offsetYFt };
      }
      if (interaction.type === 'resize-area') {
        let { xFt, yFt, wFt, hFt } = c;
        const right = xFt + wFt, bottom = yFt + hFt;
        let nx = xFt, ny = yFt, nRight = right, nBottom = bottom;
        if (interaction.corner.includes('e')) nRight = Math.max(pt.xFt, xFt + 0.5);
        if (interaction.corner.includes('w')) nx = Math.min(pt.xFt, right - 0.5);
        if (interaction.corner.includes('s')) nBottom = Math.max(pt.yFt, yFt + 0.5);
        if (interaction.corner.includes('n')) ny = Math.min(pt.yFt, bottom - 0.5);
        return { ...c, xFt: nx, yFt: ny, wFt: nRight - nx, hFt: nBottom - ny };
      }
      return c;
    }));
  };

  const handleCanvasMouseUp = () => setInteraction(null);

  // ── Start interactions ─────────────────────────────────
  const startPointMove = (uid) => (e) => {
    e.stopPropagation();
    if (e.shiftKey) { handleShiftClick(uid); return; }
    const comp = placedComponents.find(c => c.uid === uid);
    const pt = getCanvasFt(e);
    setInteraction({ type: 'move-point', uid, offsetXFt: pt.xFt - comp.xFt, offsetYFt: pt.yFt - comp.yFt });
    setSelectedUid(uid);
  };

  const startLineMove = (uid) => (e) => {
    e.stopPropagation();
    if (e.shiftKey) { handleShiftClick(uid); return; }
    const comp = placedComponents.find(c => c.uid === uid);
    const pt = getCanvasFt(e);
    setInteraction({
      type: 'move-line', uid,
      startMouseXFt: pt.xFt, startMouseYFt: pt.yFt,
      startX1Ft: comp.x1Ft, startY1Ft: comp.y1Ft, startX2Ft: comp.x2Ft, startY2Ft: comp.y2Ft,
    });
    setSelectedUid(uid);
  };

  const startEndpointDrag = (uid, end) => (e) => {
    e.stopPropagation();
    setInteraction({ type: 'drag-endpoint', uid, end });
    setSelectedUid(uid);
  };

  const startAreaMove = (uid) => (e) => {
    e.stopPropagation();
    if (e.shiftKey) { handleShiftClick(uid); return; }
    const comp = placedComponents.find(c => c.uid === uid);
    const pt = getCanvasFt(e);
    setInteraction({ type: 'move-area', uid, offsetXFt: pt.xFt - comp.xFt, offsetYFt: pt.yFt - comp.yFt });
    setSelectedUid(uid);
  };

  const startAreaResize = (uid, corner) => (e) => {
    e.stopPropagation();
    setInteraction({ type: 'resize-area', uid, corner });
    setSelectedUid(uid);
  };

  const handleShiftClick = (uid) => {
    if (connectingFrom === null) setConnectingFrom(uid);
    else if (connectingFrom !== uid) {
      setConnections(prev => [...prev, { from: connectingFrom, to: uid, id: Date.now() }]);
      setConnectingFrom(null);
    }
  };

  const handleCanvasClick = (e) => {
    if (e.target === canvasRef.current || e.target.classList?.contains('grid-bg')) {
      setSelectedUid(null);
      setConnectingFrom(null);
    }
  };

  const deleteSelected = useCallback(() => {
    if (selectedUid === null) return;
    setPlacedComponents(prev => prev.filter(c => c.uid !== selectedUid));
    setConnections(prev => prev.filter(c => c.from !== selectedUid && c.to !== selectedUid));
    setSelectedUid(null);
  }, [selectedUid]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedUid !== null && e.target.tagName !== 'INPUT') {
        e.preventDefault(); deleteSelected();
      }
      if (e.key === 'Escape') { setConnectingFrom(null); setSelectedUid(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedUid, deleteSelected]);

  const resetDesign = async () => {
    setPlacedComponents([]); setConnections([]); setProjectName('Untitled Design');
    setSelectedUid(null); setConnectingFrom(null);
    uidCounter.current = 0;
    setShowResetConfirm(false);
  };

  // ── Inspector helpers ──────────────────────────────────
  const selectedComp = placedComponents.find(c => c.uid === selectedUid);
  const selectedItem = selectedComp ? ALL_ITEMS[selectedComp.itemId] : null;

  const lineLengthFt = (c) => {
    const dx = c.x2Ft - c.x1Ft, dy = c.y2Ft - c.y1Ft;
    return Math.sqrt(dx*dx + dy*dy);
  };

  const updateLineLength = (uid, newLenFt) => {
    setPlacedComponents(prev => prev.map(c => {
      if (c.uid !== uid) return c;
      const dx = c.x2Ft - c.x1Ft, dy = c.y2Ft - c.y1Ft;
      const curLen = Math.sqrt(dx*dx + dy*dy);
      if (curLen < 0.01) return { ...c, x2Ft: c.x1Ft + Math.max(0, newLenFt), y2Ft: c.y1Ft };
      const ratio = Math.max(0, newLenFt) / curLen;
      return { ...c, x2Ft: c.x1Ft + dx * ratio, y2Ft: c.y1Ft + dy * ratio };
    }));
  };

  const updateAreaSize = (uid, key, val) => {
    setPlacedComponents(prev => prev.map(c => c.uid === uid ? { ...c, [key]: Math.max(0.5, val) } : c));
  };

  // ── BOM ─────────────────────────────────────────────────
  const bom = (() => {
    const tally = {};
    placedComponents.forEach(c => {
      const item = ALL_ITEMS[c.itemId];
      if (item.nonBom) return;
      const qty = item.shape === 'line' ? lineLengthFt(c) : 1;
      if (!tally[c.itemId]) tally[c.itemId] = { item, qty: 0, lineTotal: 0 };
      tally[c.itemId].qty += qty;
      tally[c.itemId].lineTotal += qty * item.price;
    });
    return Object.values(tally).sort((a,b) => {
      const order = ['source','filtration','mainline','fittings','emitters','accessories'];
      return order.indexOf(a.item.category) - order.indexOf(b.item.category);
    });
  })();

  const grandTotal = bom.reduce((s, b) => s + b.lineTotal, 0);

  const plantSummary = (() => {
    const t = {};
    placedComponents.forEach(c => {
      const item = ALL_ITEMS[c.itemId];
      if (item.category !== 'plants') return;
      t[c.itemId] = (t[c.itemId] || 0) + 1;
    });
    return Object.entries(t).map(([id, qty]) => ({ item: ALL_ITEMS[id], qty }));
  })();

  const areaSummary = (() => {
    const t = {};
    placedComponents.forEach(c => {
      const item = ALL_ITEMS[c.itemId];
      if (item.category !== 'areas') return;
      if (!t[c.itemId]) t[c.itemId] = { item, count: 0, totalSqFt: 0 };
      t[c.itemId].count += 1;
      t[c.itemId].totalSqFt += (c.wFt || 0) * (c.hFt || 0);
    });
    return Object.values(t);
  })();

  const exportCSV = () => {
    const lines = [['Component','Category','Quantity','Unit','Unit Price','Line Total']];
    bom.forEach(b => {
      lines.push([
        b.item.name, b.item.categoryLabel,
        b.qty.toFixed(b.item.unit === 'ft' ? 1 : 0),
        b.item.unit, '$' + b.item.price.toFixed(2), '$' + b.lineTotal.toFixed(2),
      ]);
    });
    lines.push(['','','','','TOTAL','$' + grandTotal.toFixed(2)]);
    const csv = lines.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${projectName.replace(/[^a-z0-9]/gi,'_')}_BOM.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const fromComp = connectingFrom !== null ? placedComponents.find(c => c.uid === connectingFrom) : null;
  // For lines, returns whichever endpoint is closer to (towardXPx, towardYPx).
  // For points and areas, returns the center.
  const getAnchorPx = (c, towardXPx, towardYPx) => {
    const item = ALL_ITEMS[c.itemId];
    if (item.shape === 'line') {
      const x1 = c.x1Ft * pxPerFt, y1 = c.y1Ft * pxPerFt;
      const x2 = c.x2Ft * pxPerFt, y2 = c.y2Ft * pxPerFt;
      const d1 = Math.hypot(x1 - towardXPx, y1 - towardYPx);
      const d2 = Math.hypot(x2 - towardXPx, y2 - towardYPx);
      return d1 <= d2 ? { x: x1, y: y1 } : { x: x2, y: y2 };
    }
    if (item.shape === 'area') return { x: (c.xFt + c.wFt/2) * pxPerFt, y: (c.yFt + c.hFt/2) * pxPerFt };
    return { x: c.xFt * pxPerFt, y: c.yFt * pxPerFt };
  };

  // Initial reference point for a component — center of line, used to resolve
  // the "toward" point in the two-anchor calculation below.
  const getRefPx = (c) => {
    const item = ALL_ITEMS[c.itemId];
    if (item.shape === 'line') return { x: ((c.x1Ft + c.x2Ft)/2) * pxPerFt, y: ((c.y1Ft + c.y2Ft)/2) * pxPerFt };
    if (item.shape === 'area') return { x: (c.xFt + c.wFt/2) * pxPerFt, y: (c.yFt + c.hFt/2) * pxPerFt };
    return { x: c.xFt * pxPerFt, y: c.yFt * pxPerFt };
  };

  // For a finalized connection between A and B: find both anchors by aiming each
  // toward the other's reference center. If both are lines, two passes converge cleanly.
  const getConnectionAnchors = (from, to) => {
    const fromRef = getRefPx(from);
    const toRef = getRefPx(to);
    const fromAnchor = getAnchorPx(from, toRef.x, toRef.y);
    const toAnchor = getAnchorPx(to, fromAnchor.x, fromAnchor.y);
    // Second pass for from in case it shifted
    const fromAnchorFinal = getAnchorPx(from, toAnchor.x, toAnchor.y);
    return { from: fromAnchorFinal, to: toAnchor };
  };

  // Marker pixel size scales softly with zoom — at MIN we use ~12px, at MAX ~22px
  const smallMarkerPx = Math.max(11, Math.min(20, pxPerFt * 0.75));
  const mediumMarkerPx = Math.max(24, Math.min(48, pxPerFt * 1.6));

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      background: '#0f1419', color: '#e8e4d8',
      fontFamily: '"IBM Plex Sans", -apple-system, sans-serif', overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #0f1419; }
        ::-webkit-scrollbar-thumb { background: #2a3441; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #3a4451; }
        input:focus, button:focus { outline: 1px solid #5b8def; outline-offset: 1px; }
        input[type=range].zoom-slider {
          -webkit-appearance: none; appearance: none;
          width: 120px; height: 4px; background: #1f2731;
          border-radius: 2px; outline: none;
        }
        input[type=range].zoom-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 14px; height: 14px; border-radius: 50%;
          background: #5b8def; cursor: pointer;
          border: 2px solid #0a0e13;
        }
        input[type=range].zoom-slider::-moz-range-thumb {
          width: 14px; height: 14px; border-radius: 50%;
          background: #5b8def; cursor: pointer; border: 2px solid #0a0e13;
        }
      `}</style>

      {/* HEADER */}
      <header style={{
        padding: '14px 24px', borderBottom: '1px solid #1f2731',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0e13',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="28" height="28" viewBox="0 0 28 28">
              <path d="M14 3 C 14 3, 7 12, 7 18 A 7 7 0 0 0 21 18 C 21 12, 14 3, 14 3 Z" fill="#5b8def" opacity="0.9"/>
              <path d="M14 8 C 14 8, 10 14, 10 18 A 4 4 0 0 0 18 18 C 18 14, 14 8, 14 8 Z" fill="#0a0e13"/>
            </svg>
            <div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1 }}>
                Drip<span style={{ color: '#5b8def' }}>line</span>
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#5a6776', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>
                Irrigation Planner
              </div>
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: '#1f2731', marginLeft: 8 }}/>
          <input
            value={projectName} onChange={(e) => setProjectName(e.target.value)}
            style={{
              background: 'transparent', border: 'none', color: '#e8e4d8',
              fontSize: 14, fontFamily: 'IBM Plex Mono, monospace',
              padding: '4px 8px', borderRadius: 3, minWidth: 200,
            }}
          />
          {saveStatus === 'saved' && (
            <span style={{ fontSize: 10, color: '#7c9885', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.1em' }}>✓ SAVED</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Zoom slider */}
          {view === 'canvas' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 12px', background: '#0f1419',
              border: '1px solid #1f2731', borderRadius: 4,
            }}>
              <button
                onClick={() => setPxPerFt(p => Math.max(MIN_PX_PER_FT, p - 2))}
                style={{ background: 'transparent', border: 'none', color: '#7a8694', cursor: 'pointer', padding: 0, display: 'flex' }}
                title="Zoom out"
              ><ZoomOut size={13}/></button>
              <input
                type="range" className="zoom-slider"
                min={MIN_PX_PER_FT} max={MAX_PX_PER_FT} step="1"
                value={pxPerFt}
                onChange={(e) => setPxPerFt(parseInt(e.target.value, 10))}
              />
              <button
                onClick={() => setPxPerFt(p => Math.min(MAX_PX_PER_FT, p + 2))}
                style={{ background: 'transparent', border: 'none', color: '#7a8694', cursor: 'pointer', padding: 0, display: 'flex' }}
                title="Zoom in"
              ><ZoomIn size={13}/></button>
              <div style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', color: '#5a6776', letterSpacing: '0.1em', minWidth: 56, textAlign: 'right' }}>
                1FT={pxPerFt}PX
              </div>
              <button
                onClick={() => setPxPerFt(DEFAULT_PX_PER_FT)}
                style={{ background: 'transparent', border: 'none', color: '#5a6776', cursor: 'pointer', fontSize: 9, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.1em', padding: '0 4px' }}
                title="Reset zoom"
              >RESET</button>
            </div>
          )}

          <div style={{ display: 'flex', background: '#0f1419', border: '1px solid #1f2731', borderRadius: 4, padding: 3 }}>
            <button onClick={() => setView('canvas')} style={tabBtn(view === 'canvas')}>
              <Move size={12}/> DESIGN
            </button>
            <button onClick={() => setView('bom')} style={tabBtn(view === 'bom')}>
              <Package size={12}/> BOM
            </button>
          </div>
          <button onClick={() => setShowResetConfirm(true)} style={resetBtn} title="Clear design">
            <RotateCw size={12}/> RESET
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* PALETTE */}
        {view === 'canvas' && (
          <aside style={{
            width: 280, background: '#0a0e13', borderRight: '1px solid #1f2731',
            overflowY: 'auto', flexShrink: 0,
          }}>
            <div style={{ padding: '16px 18px 8px', borderBottom: '1px solid #1f2731' }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#5a6776', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                Component Library
              </div>
              <div style={{ fontSize: 11, color: '#7a8694', marginTop: 6, lineHeight: 1.5 }}>
                Drag onto canvas. <span style={{ color: '#5b8def' }}>Shift-click</span> two components to connect them. Drag endpoints / corners to resize.
              </div>
            </div>

            {Object.entries(COMPONENT_LIBRARY).map(([catKey, cat]) => {
              const Icon = CATEGORY_ICONS[catKey];
              const isExpanded = expandedCats[catKey];
              return (
                <div key={catKey} style={{ borderBottom: '1px solid #1f2731' }}>
                  <button
                    onClick={() => setExpandedCats(p => ({ ...p, [catKey]: !p[catKey] }))}
                    style={{
                      width: '100%', background: 'transparent', border: 'none',
                      padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer', color: '#e8e4d8',
                    }}
                  >
                    <Icon size={14} color={cat.color}/>
                    <span style={{ flex: 1, textAlign: 'left', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      {cat.label}
                    </span>
                    {isExpanded ? <Minus size={12}/> : <Plus size={12}/>}
                  </button>
                  {isExpanded && (
                    <div style={{ padding: '0 12px 12px' }}>
                      {cat.items.map(item => {
                        const enriched = { ...item, category: catKey, categoryColor: cat.color };
                        return (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={handlePaletteDragStart(item.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '7px 10px', background: '#0f1419',
                              border: '1px solid #1f2731', borderRadius: 3,
                              marginBottom: 5, cursor: 'grab',
                              transition: 'border-color 120ms, transform 120ms',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = cat.color; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1f2731'; }}
                          >
                            <div style={{
                              flexShrink: 0, background: '#1a1f28', borderRadius: 2,
                              width: 36, height: 32,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <PaletteIcon item={enriched} size={26}/>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 500, lineHeight: 1.3 }}>{item.name}</div>
                              <div style={{ fontSize: 10, color: '#5a6776', fontFamily: 'IBM Plex Mono, monospace', marginTop: 1 }}>
                                {item.shape === 'area' ? `default ${item.defaultW}×${item.defaultH} ft` :
                                 item.shape === 'line' ? `${item.unit} · $${item.price.toFixed(2)}/ft` :
                                 item.plantIcon ? `${item.diaFt}′ spread` :
                                 item.price === 0 ? '—' : `$${item.price.toFixed(2)} / ${item.unit}`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </aside>
        )}

        {/* MAIN */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {view === 'canvas' ? (
            <>
              <div
                ref={canvasRef}
                onDragOver={handleCanvasDragOver}
                onDrop={handleCanvasDrop}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onClick={handleCanvasClick}
                style={{
                  flex: 1, position: 'relative', overflow: 'auto',
                  background: '#0f1419',
                  backgroundImage: `
                    linear-gradient(rgba(91, 141, 239, 0.04) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(91, 141, 239, 0.04) 1px, transparent 1px),
                    linear-gradient(rgba(91, 141, 239, 0.10) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(91, 141, 239, 0.10) 1px, transparent 1px)
                  `,
                  backgroundSize: `${pxPerFt}px ${pxPerFt}px, ${pxPerFt}px ${pxPerFt}px, ${pxPerFt*5}px ${pxPerFt*5}px, ${pxPerFt*5}px ${pxPerFt*5}px`,
                  cursor: connectingFrom !== null ? 'crosshair' : 'default',
                }}
                className="grid-bg"
              >
                {placedComponents.length === 0 && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: '#3a4451',
                  }}>
                    <div style={{ fontFamily: 'Fraunces, serif', fontSize: 32, fontWeight: 400, fontStyle: 'italic', marginBottom: 8, color: '#3a4451' }}>
                      Start with the spigot.
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.1em', color: '#2a3441' }}>
                      DRAG COMPONENTS FROM THE LIBRARY ON THE LEFT
                    </div>
                  </div>
                )}

                {/* ── AREAS (bottom layer) ─── */}
                {placedComponents
                  .filter(c => ALL_ITEMS[c.itemId].shape === 'area')
                  .map(comp => {
                    const item = ALL_ITEMS[comp.itemId];
                    const isSelected = selectedUid === comp.uid;
                    const isConnect = connectingFrom === comp.uid;
                    const xPx = comp.xFt * pxPerFt, yPx = comp.yFt * pxPerFt;
                    const wPx = comp.wFt * pxPerFt, hPx = comp.hFt * pxPerFt;
                    return (
                      <div key={comp.uid} style={{
                        position: 'absolute', left: xPx, top: yPx, width: wPx, height: hPx,
                      }}>
                        <div
                          onMouseDown={startAreaMove(comp.uid)}
                          style={{
                            width: '100%', height: '100%',
                            background: item.fill, opacity: 0.85,
                            border: `2px ${item.id === 'in-ground' ? 'dashed' : 'solid'} ${isSelected || isConnect ? '#5b8def' : item.stroke}`,
                            borderRadius: item.round ? '50%' : 4,
                            cursor: interaction?.type === 'move-area' && interaction.uid === comp.uid ? 'grabbing' : 'grab',
                            boxShadow: isSelected ? '0 0 0 3px rgba(91,141,239,0.25)' : 'none',
                            position: 'relative',
                          }}
                        >
                          {item.id === 'raised-bed' && (
                            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.3 }}>
                              <defs>
                                <pattern id={`wood-${comp.uid}`} width="40" height={Math.max(hPx/3, 20)} patternUnits="userSpaceOnUse">
                                  <line x1="0" y1="0" x2="40" y2="0" stroke="#3a2818" strokeWidth="1"/>
                                </pattern>
                              </defs>
                              <rect width="100%" height="100%" fill={`url(#wood-${comp.uid})`}/>
                            </svg>
                          )}
                          <div style={{
                            position: 'absolute', top: 4, left: 6,
                            fontFamily: 'IBM Plex Mono, monospace', fontSize: 10,
                            color: '#e8e4d8', background: 'rgba(10,14,19,0.7)',
                            padding: '1px 5px', borderRadius: 2, pointerEvents: 'none',
                          }}>
                            {comp.wFt.toFixed(1)}′ × {comp.hFt.toFixed(1)}′
                          </div>
                        </div>
                        {isSelected && ['nw','ne','sw','se'].map(corner => {
                          const positions = {
                            nw: { left: -5, top: -5, cursor: 'nwse-resize' },
                            ne: { right: -5, top: -5, cursor: 'nesw-resize' },
                            sw: { left: -5, bottom: -5, cursor: 'nesw-resize' },
                            se: { right: -5, bottom: -5, cursor: 'nwse-resize' },
                          };
                          return (
                            <div key={corner}
                              onMouseDown={startAreaResize(comp.uid, corner)}
                              style={{
                                position: 'absolute', width: 10, height: 10,
                                background: '#5b8def', border: '1.5px solid #0a0e13',
                                borderRadius: 2, ...positions[corner],
                              }}
                            />
                          );
                        })}
                      </div>
                    );
                  })}

                {/* ── CONNECTIONS ────────────── */}
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                      <polygon points="0 0, 7 4, 0 8" fill="#5b8def" opacity="0.8"/>
                    </marker>
                  </defs>
                  {connections.map(conn => {
                    const from = placedComponents.find(c => c.uid === conn.from);
                    const to = placedComponents.find(c => c.uid === conn.to);
                    if (!from || !to) return null;
                    const { from: fc, to: tc } = getConnectionAnchors(from, to);
                    return (
                      <line key={conn.id}
                        x1={fc.x} y1={fc.y} x2={tc.x} y2={tc.y}
                        stroke="#5b8def" strokeWidth="2" strokeDasharray="6 4"
                        opacity="0.65" markerEnd="url(#arrowhead)"
                      />
                    );
                  })}
                  {connectingFrom !== null && fromComp && (() => {
                    const mouseXPx = mousePos.xFt * pxPerFt;
                    const mouseYPx = mousePos.yFt * pxPerFt;
                    const fc = getAnchorPx(fromComp, mouseXPx, mouseYPx);
                    return (
                      <line x1={fc.x} y1={fc.y} x2={mouseXPx} y2={mouseYPx}
                        stroke="#5b8def" strokeWidth="2" strokeDasharray="4 4" opacity="0.5"/>
                    );
                  })()}
                </svg>

                {/* ── LINES (tubing) ──────────────────── */}
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  {placedComponents
                    .filter(c => ALL_ITEMS[c.itemId].shape === 'line')
                    .map(comp => {
                      const item = ALL_ITEMS[comp.itemId];
                      const isSelected = selectedUid === comp.uid;
                      const isConnect = connectingFrom === comp.uid;
                      const lenFt = lineLengthFt(comp);
                      const x1 = comp.x1Ft * pxPerFt, y1 = comp.y1Ft * pxPerFt;
                      const x2 = comp.x2Ft * pxPerFt, y2 = comp.y2Ft * pxPerFt;
                      const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
                      const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

                      return (
                        <g key={comp.uid} style={{ pointerEvents: 'auto' }}>
                          <line
                            x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke="transparent" strokeWidth={Math.max(item.thickness * 3, 14)}
                            onMouseDown={startLineMove(comp.uid)}
                            style={{ cursor: interaction?.type === 'move-line' && interaction.uid === comp.uid ? 'grabbing' : 'grab' }}
                          />
                          {(isSelected || isConnect) && (
                            <line
                              x1={x1} y1={y1} x2={x2} y2={y2}
                              stroke="#5b8def" strokeWidth={item.thickness + 8}
                              opacity="0.2" strokeLinecap="round"
                            />
                          )}
                          <line
                            x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke={item.categoryColor}
                            strokeWidth={item.thickness}
                            strokeLinecap="round"
                            strokeDasharray={item.id === 'mainline-quarter' ? '4 3' : undefined}
                            pointerEvents="none"
                          />
                          {item.id === 'dripline' && (() => {
                            const dots = [];
                            const totalPx = lenFt * pxPerFt;
                            const count = Math.floor(lenFt);
                            for (let i = 1; i < count; i++) {
                              const t = i / lenFt;
                              dots.push(
                                <circle key={i}
                                  cx={x1 + (x2 - x1) * t}
                                  cy={y1 + (y2 - y1) * t}
                                  r="2.5" fill="#0f1419" pointerEvents="none"
                                />
                              );
                            }
                            return dots;
                          })()}

                          <g transform={`translate(${midX}, ${midY}) rotate(${Math.abs(angle) > 90 ? angle + 180 : angle})`} pointerEvents="none">
                            <rect x="-22" y="-18" width="44" height="14" fill="#0a0e13" stroke={item.categoryColor} strokeWidth="0.5" rx="2"/>
                            <text x="0" y="-7" fontSize="9" fill="#e8e4d8" textAnchor="middle" fontFamily="IBM Plex Mono, monospace">
                              {lenFt.toFixed(1)}′
                            </text>
                          </g>

                          {[1, 2].map(end => {
                            const ex = end === 1 ? x1 : x2;
                            const ey = end === 1 ? y1 : y2;
                            return (
                              <circle key={end}
                                cx={ex} cy={ey} r={isSelected ? 6 : 4}
                                fill={isSelected ? '#5b8def' : item.categoryColor}
                                stroke="#0a0e13" strokeWidth="2"
                                style={{ cursor: 'pointer' }}
                                onMouseDown={startEndpointDrag(comp.uid, end)}
                              />
                            );
                          })}
                        </g>
                      );
                    })}
                </svg>

                {/* ── POINTS ──────────────────── */}
                {placedComponents
                  .filter(c => ALL_ITEMS[c.itemId].shape === 'point')
                  .map(comp => {
                    const item = ALL_ITEMS[comp.itemId];
                    const isSelected = selectedUid === comp.uid;
                    const isConnect = connectingFrom === comp.uid;
                    const isPlant = item.category === 'plants';
                    const isSource = item.category === 'source';

                    const xPx = comp.xFt * pxPerFt, yPx = comp.yFt * pxPerFt;

                    if (isPlant) {
                      // Plants render at their physical canopy diameter (diaFt × pxPerFt),
                      // floored at 16px so tiny plants stay visible/clickable at low zoom.
                      const diaPx = (item.diaFt || 2) * pxPerFt;
                      const size = Math.max(16, diaPx);
                      const half = size / 2;
                      return (
                        <div key={comp.uid}
                          onMouseDown={startPointMove(comp.uid)}
                          style={{
                            position: 'absolute', left: xPx - half - 2, top: yPx - half - 2,
                            width: size + 4, height: size + 4,
                            cursor: interaction?.type === 'move-point' && interaction.uid === comp.uid ? 'grabbing' : 'grab',
                            userSelect: 'none',
                            border: isSelected || isConnect ? '1.5px solid #5b8def' : '1.5px solid transparent',
                            borderRadius: '50%',
                            boxShadow: isSelected ? '0 0 0 3px rgba(91,141,239,0.2)' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          title={`${item.name} · ${item.diaFt}′ spread`}
                        >
                          <PlantGlyph iconType={item.plantIcon} size={size}/>
                        </div>
                      );
                    }

                    if (isSource) {
                      const size = mediumMarkerPx;
                      const half = size / 2;
                      return (
                        <div key={comp.uid}
                          onMouseDown={startPointMove(comp.uid)}
                          style={{
                            position: 'absolute', left: xPx - half - 4, top: yPx - half - 4,
                            cursor: interaction?.type === 'move-point' && interaction.uid === comp.uid ? 'grabbing' : 'grab',
                            userSelect: 'none',
                          }}
                        >
                          <div style={{
                            background: '#1a1f28',
                            border: `1.5px solid ${isSelected || isConnect ? '#5b8def' : '#2a3441'}`,
                            borderRadius: 4,
                            padding: 4,
                            boxShadow: isSelected ? '0 0 0 3px rgba(91,141,239,0.2)' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <MediumGlyph item={item} size={size}/>
                          </div>
                          <div style={{
                            textAlign: 'center', fontSize: 9,
                            fontFamily: 'IBM Plex Mono, monospace', color: '#7a8694',
                            marginTop: 3, whiteSpace: 'nowrap',
                          }}>
                            {item.name.split(' ').slice(0,2).join(' ')}
                          </div>
                        </div>
                      );
                    }

                    // SMALL marker (fittings / filtration / emitters / accessories)
                    const size = smallMarkerPx;
                    const half = size / 2;
                    const ringPad = isSelected || isConnect ? 2 : 0;
                    return (
                      <div key={comp.uid}
                        onMouseDown={startPointMove(comp.uid)}
                        style={{
                          position: 'absolute',
                          left: xPx - half - ringPad - 1,
                          top: yPx - half - ringPad - 1,
                          width: size + 2 + ringPad*2,
                          height: size + 2 + ringPad*2,
                          cursor: interaction?.type === 'move-point' && interaction.uid === comp.uid ? 'grabbing' : 'grab',
                          userSelect: 'none',
                          borderRadius: '50%',
                          border: isSelected || isConnect ? '1.5px solid #5b8def' : 'none',
                          boxShadow: isSelected ? '0 0 0 3px rgba(91,141,239,0.18)' : 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'transparent',
                        }}
                        title={item.name}
                      >
                        <NodeMarker item={item} size={size}/>
                      </div>
                    );
                  })}

                {connectingFrom !== null && (
                  <div style={{
                    position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
                    background: '#1a1f28', border: '1px solid #5b8def',
                    padding: '8px 16px', borderRadius: 4,
                    fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
                    letterSpacing: '0.1em', color: '#5b8def', pointerEvents: 'none',
                    zIndex: 50,
                  }}>
                    SHIFT-CLICK TARGET TO CONNECT · ESC TO CANCEL
                  </div>
                )}
              </div>

              {selectedItem && selectedComp && (
                <Inspector
                  item={selectedItem}
                  comp={selectedComp}
                  lineLengthFt={lineLengthFt}
                  updateLineLength={updateLineLength}
                  updateAreaSize={updateAreaSize}
                  onDelete={deleteSelected}
                />
              )}
            </>
          ) : (
            <BOMView
              bom={bom} grandTotal={grandTotal} projectName={projectName}
              onExport={exportCSV} componentLibrary={COMPONENT_LIBRARY}
              plantSummary={plantSummary} areaSummary={areaSummary}
            />
          )}
        </main>
      </div>

      {showResetConfirm && (
        <div onClick={() => setShowResetConfirm(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(10,14,19,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#0a0e13', border: '1px solid #2a3441', borderRadius: 6,
            padding: 28, maxWidth: 380,
          }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600, marginBottom: 10 }}>
              Reset design?
            </div>
            <div style={{ fontSize: 13, color: '#7a8694', lineHeight: 1.5, marginBottom: 22 }}>
              This will permanently clear all placed components, plants, garden areas, and connections. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowResetConfirm(false)} style={modalCancelBtn}>CANCEL</button>
              <button onClick={resetDesign} style={modalConfirmBtn}>CONFIRM RESET</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inspector component ───────────────────────────────────
function Inspector({ item, comp, lineLengthFt, updateLineLength, updateAreaSize, onDelete }) {
  const isLine = item.shape === 'line';
  const isArea = item.shape === 'area';
  const len = isLine ? lineLengthFt(comp) : 0;
  const subtotal = isLine ? len * item.price : (item.nonBom ? 0 : item.price);

  return (
    <div style={{
      borderTop: '1px solid #1f2731', background: '#0a0e13',
      padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0,
    }}>
      <div style={{
        background: item.category === 'plants' ? 'transparent' : '#1a1f28',
        borderRadius: 4, padding: 6,
        width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <PaletteIcon item={item} size={40}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600 }}>{item.name}</div>
        <div style={{ fontSize: 11, color: '#7a8694', marginTop: 2 }}>{item.desc}</div>
      </div>

      {isLine && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', color: '#7a8694', letterSpacing: '0.1em' }}>LENGTH</span>
          <input
            type="number" min="0" step="0.5" value={len.toFixed(1)}
            onChange={(e) => updateLineLength(comp.uid, parseFloat(e.target.value) || 0)}
            style={inspectorInput}
          />
          <span style={{ fontSize: 11, color: '#7a8694', fontFamily: 'IBM Plex Mono, monospace' }}>ft</span>
        </div>
      )}

      {isArea && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', color: '#7a8694', letterSpacing: '0.1em' }}>W</span>
            <input
              type="number" min="0.5" step="0.5" value={comp.wFt.toFixed(1)}
              onChange={(e) => updateAreaSize(comp.uid, 'wFt', parseFloat(e.target.value) || 0.5)}
              style={inspectorInput}
            />
            <span style={{ fontSize: 11, color: '#7a8694', fontFamily: 'IBM Plex Mono, monospace' }}>ft</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', color: '#7a8694', letterSpacing: '0.1em' }}>H</span>
            <input
              type="number" min="0.5" step="0.5" value={comp.hFt.toFixed(1)}
              onChange={(e) => updateAreaSize(comp.uid, 'hFt', parseFloat(e.target.value) || 0.5)}
              style={inspectorInput}
            />
            <span style={{ fontSize: 11, color: '#7a8694', fontFamily: 'IBM Plex Mono, monospace' }}>ft</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', borderLeft: '1px solid #1f2731', height: 24 }}>
            <span style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', color: '#7a8694', letterSpacing: '0.1em' }}>AREA</span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#7c9885' }}>
              {(comp.wFt * comp.hFt).toFixed(1)} sqft
            </span>
          </div>
        </>
      )}

      {item.plantIcon && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', borderLeft: '1px solid #1f2731', height: 24 }}>
          <span style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', color: '#7a8694', letterSpacing: '0.1em' }}>SPREAD</span>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#9bc88f' }}>
            {item.diaFt.toFixed(1)}′ ⌀
          </span>
        </div>
      )}

      {!item.nonBom && (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', color: '#7a8694', letterSpacing: '0.1em' }}>SUBTOTAL</div>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, color: '#5b8def' }}>
            ${subtotal.toFixed(2)}
          </div>
        </div>
      )}

      <button onClick={onDelete} style={deleteBtn}>
        <Trash2 size={12}/> DELETE
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BOM VIEW
// ─────────────────────────────────────────────────────────────
function BOMView({ bom, grandTotal, projectName, onExport, componentLibrary, plantSummary, areaSummary }) {
  const grouped = {};
  bom.forEach(b => {
    if (!grouped[b.item.category]) grouped[b.item.category] = [];
    grouped[b.item.category].push(b);
  });

  const hasDesignSummary = plantSummary.length > 0 || areaSummary.length > 0;

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '32px 48px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, borderBottom: '1px solid #1f2731', paddingBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#5a6776', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
            Bill of Materials
          </div>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {projectName}
          </div>
        </div>
        {bom.length > 0 && (
          <button onClick={onExport} style={exportBtn}>
            <Download size={14}/> EXPORT CSV
          </button>
        )}
      </div>

      {hasDesignSummary && (
        <div style={{
          background: '#0a0e13', border: '1px solid #1f2731', borderRadius: 6,
          padding: 20, marginBottom: 32,
        }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#5a6776', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
            Design Summary
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {areaSummary.length > 0 && (
              <div>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#7c9885' }}>Garden Areas</div>
                {areaSummary.map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                    <span>{a.item.name} ×{a.count}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#7a8694' }}>{a.totalSqFt.toFixed(1)} sqft</span>
                  </div>
                ))}
              </div>
            )}
            {plantSummary.length > 0 && (
              <div>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#9bc88f' }}>Plants</div>
                {plantSummary.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                    <span>{p.item.name}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#7a8694' }}>×{p.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {bom.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#3a4451' }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 26, marginBottom: 8 }}>
            No hardware to tally yet.
          </div>
          <div style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.1em', color: '#2a3441' }}>
            ADD IRRIGATION COMPONENTS IN THE DESIGN VIEW
          </div>
        </div>
      ) : (
        <>
          {Object.entries(grouped).map(([catKey, items]) => {
            const cat = componentLibrary[catKey];
            const catTotal = items.reduce((s,i) => s + i.lineTotal, 0);
            return (
              <div key={catKey} style={{ marginBottom: 36 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${cat.color}40`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, background: cat.color, borderRadius: 2 }}/>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#e8e4d8' }}>
                      {cat.label}
                    </span>
                  </div>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#7a8694' }}>${catTotal.toFixed(2)}</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#5a6776', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 500, width: 60 }}></th>
                      <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 500 }}>Component</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, width: 100 }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, width: 100 }}>Unit Price</th>
                      <th style={{ textAlign: 'right', padding: '8px 0', fontWeight: 500, width: 100 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((b, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1a1f28' }}>
                        <td style={{ padding: '10px 0' }}>
                          <div style={{ background: '#1a1f28', borderRadius: 3, padding: 3, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <PaletteIcon item={b.item} size={28}/>
                          </div>
                        </td>
                        <td style={{ padding: '10px 0' }}>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{b.item.name}</div>
                          <div style={{ fontSize: 11, color: '#5a6776', marginTop: 2 }}>{b.item.desc}</div>
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}>
                          {b.qty.toFixed(b.item.unit === 'ft' ? 1 : 0)} {b.item.unit}
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#7a8694' }}>
                          ${b.item.price.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 0', fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, fontWeight: 500 }}>
                          ${b.lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div style={{
            marginTop: 40, padding: '24px 28px',
            background: 'linear-gradient(135deg, #1a1f28 0%, #0f1419 100%)',
            border: '1px solid #5b8def', borderRadius: 6,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#7a8694', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
                Project Total — Estimated
              </div>
              <div style={{ fontSize: 11, color: '#5a6776' }}>
                {bom.reduce((s,b) => s + (b.item.unit === 'ea' ? b.qty : 1), 0)} parts · {bom.reduce((s,b) => s + (b.item.unit === 'ft' ? b.qty : 0), 0).toFixed(1)} ft of tubing
              </div>
            </div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 48, fontWeight: 600, color: '#5b8def', letterSpacing: '-0.02em', lineHeight: 1 }}>
              ${grandTotal.toFixed(2)}
            </div>
          </div>

          <div style={{ marginTop: 24, fontSize: 11, color: '#5a6776', lineHeight: 1.6, fontStyle: 'italic' }}>
            Pricing is approximate based on typical retail rates for residential drip irrigation supplies. Actual prices vary by supplier, brand, and region. Verify with your preferred vendor before purchasing.
          </div>
        </>
      )}
    </div>
  );
}

// Shared styles
const tabBtn = (active) => ({
  background: active ? '#1f2731' : 'transparent',
  color: active ? '#e8e4d8' : '#7a8694',
  border: 'none', padding: '6px 14px',
  fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, letterSpacing: '0.1em',
  cursor: 'pointer', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 6,
});
const resetBtn = {
  background: 'transparent', border: '1px solid #2a3441', color: '#7a8694',
  padding: '6px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
  letterSpacing: '0.1em', cursor: 'pointer', borderRadius: 3,
  display: 'flex', alignItems: 'center', gap: 6,
};
const inspectorInput = {
  width: 70, background: '#0f1419', border: '1px solid #2a3441',
  color: '#e8e4d8', padding: '6px 8px',
  fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, borderRadius: 3,
};
const deleteBtn = {
  background: 'transparent', border: '1px solid #b8623e', color: '#b8623e',
  padding: '8px 14px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
  letterSpacing: '0.1em', cursor: 'pointer', borderRadius: 3,
  display: 'flex', alignItems: 'center', gap: 6,
};
const exportBtn = {
  background: 'transparent', border: '1px solid #5b8def', color: '#5b8def',
  padding: '10px 18px', borderRadius: 3, cursor: 'pointer',
  fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, letterSpacing: '0.1em',
  display: 'flex', alignItems: 'center', gap: 8,
};
const modalCancelBtn = {
  background: 'transparent', border: '1px solid #2a3441', color: '#e8e4d8',
  padding: '8px 16px', borderRadius: 3, cursor: 'pointer',
  fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, letterSpacing: '0.1em',
};
const modalConfirmBtn = {
  background: '#b8623e', border: '1px solid #b8623e', color: '#fff',
  padding: '8px 16px', borderRadius: 3, cursor: 'pointer',
  fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, letterSpacing: '0.1em',
};
