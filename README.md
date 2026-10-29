# FORM — Parametric object studio

A browser-based planter generator built as a 3D web-development portfolio project.
Change dimensions, taper, twist, fluting, wall thickness and drainage; the application
rebuilds the actual mesh and exports the same geometry as binary STL or OBJ.

## Run

Requires Node.js 22+ and npm.

```powershell
npm install
npm run dev
npm test
npm run build
npm run preview
```

The local address is printed by Vite. Deploy the generated `dist` folder to a
static host such as Netlify, Vercel or GitHub Pages. No backend or API keys are
required. Publishing is a separate, owner-approved step; a local URL is not a
public project link.

## What makes this more than a model viewer

- Deterministic indexed mesh generation, not prebuilt asset swapping.
- One connected shell encompassing exterior, interior, rim, floor and underside.
- Optional actual 6 mm drainage bore.
- Live Three.js PBR preview, orbit/zoom, auto rotation, wireframe, camera reset.
- Exact mesh volume and approximate solid-shell PLA mass.
- Binary STL and OBJ exports in millimeters, rotated Z-up with base at zero.
- URL-encoded parameter sharing; no server or account required.
- PNG snapshot, responsive controls and keyboard-operable sliders.
- Automated mesh manifold, winding, nondegeneracy, parameter, dimension and
  export-format tests.

## Architecture

`src/geometry.ts` is a pure, typed geometry kernel. It samples a tapered, sinusoidally
fluted radial function with height-dependent angular phase. Outer and inner rings
are joined by a rim; the floor connects to either a drain bore or a sealed center.
All adjacent surfaces share indices. Rendered geometry is used directly for export.

`src/Viewport.tsx` owns WebGL resources, lighting, environment, controls and resizing.
`src/exports.ts` owns file serialization. `src/App.tsx` owns the configuration UI,
sharing and user feedback. No Blender executable is needed at runtime.

## Manufacturing limitations

This tool does not certify printability. Wall thickness is a **radial offset**, not
a guaranteed minimum normal thickness; deep flutes and high twist can create
thin normal sections and steep overhangs. Always inspect the generated model in
your slicer, configure supports where needed and verify your printer's build volume.
Material mass assumes 1.24 g/cm³ PLA and a solid shell; actual extrusion depends on
the slicer. No drainage does not guarantee watertight prints. STL does not encode
units; import as millimeters. Colors are preview-only and are not baked into exports.

Google Fonts are requested for typography; system sans-serif fonts work offline.
Geometry generation, sharing and exports run locally; the app sends no geometry to
a backend.

## Honest application description

After you deploy and verify your own public URL, adapt the following:

> I built FORM, an interactive parametric planter studio using React, TypeScript
> and Three.js. Users change dimensions, taper, twist, fluting, walls and drainage
> in real time, then export the generated mesh as STL or OBJ for slicing. The
> project includes mesh topology and export tests, material estimates and
> shareable parameter links. I developed it with AI assistance and can explain
> the procedural geometry, rendering lifecycle, validation and export pipeline.
> Project: [insert your verified deployment URL].

Only claim responsibilities and expertise you can demonstrate. This is a new
portfolio project, not a production client deployment or prior employment.
