# Dripline

A drag-and-drop drip irrigation planner. Lay out raised beds, plants, tubing, fittings, and emitters on a to-scale canvas — then get an automatic Bill of Materials with pricing.

## Features

- Component library: water source, filtration, mainline tubing, fittings, emitters, accessories
- To-scale canvas with adjustable zoom (1 ft = 6–60 px)
- Resizable garden areas (raised beds, in-ground, containers, lawn)
- 21 plants with realistic canopy footprints, from herbs (1 ft) to mature trees (30 ft)
- Tubing rendered with endpoints you can drag to set length and direction
- Shift-click any two components to connect them with a routing line
- Bill of Materials view with category subtotals, design summary, and CSV export
- Autosaves your design to `localStorage`

## Local development

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Deploy

Pushes to `main` deploy automatically to Vercel.

## Build for production manually

```bash
npm run build
npm run preview
```
