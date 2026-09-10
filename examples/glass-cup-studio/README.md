# Glass Studio

An isolated browser example for turning a local image into a configurable 3D glass tumbler effect.
It is intentionally separate from the repository's dependency-free `forge/` runtime.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Use `npm run build` for a production build.

## What it does

- Imports JPG, PNG, and WebP images by file picker or drag and drop.
- Wraps the image around an independent cylindrical decal layer.
- Builds the cup from procedural outer wall, inner wall, rim, and thick base meshes.
- Uses `MeshPhysicalMaterial` transmission, IOR, attenuation, clearcoat, and a PMREM room
  environment for glass highlights and refraction.
- Adjusts image scale, repeat mode, position, rotation, intensity, glass transmission, roughness,
  IOR, and tint live without rebuilding the scene.
- Composites decals on a transparent canvas: non-repeating images render once at their original
  aspect ratio with transparent pixels outside their bounds, while repeat mode tiles explicitly.
- Includes studio, daylight, and midnight environments plus editable background/floor colors,
  environment reflections, key-light intensity, rim-light intensity, and a reflective-floor toggle.
- Supports orbit, zoom, decal-area height and position, a customizable stage-light rig, parameter reset, responsive mobile layout, and PNG export.
- Includes four selectable cups: the procedural `tumbler`, `cola-can`, and `clear-cola-can`, plus
  the validated 60 × 242 mm `tall-wine-glass` GLB loaded lazily when selected.
- Adds a dedicated cup-maker workspace with 2–6 local reference images, real-size calibration,
  millimetre/centimetre/inch controls, editable lathe profile points, and optional GPT vision
  analysis through the Responses API.
- Stores the latest complete draft in IndexedDB and exports/imports versioned project JSON or GLB.
  GLB files exported here retain editable project metadata; generic GLB files can be sampled and
  refitted through the optional AI workflow.

## Cup maker and API key safety

Open **杯子制作** in the top bar to start from an existing model, import multiple views of one
rotationally symmetric cup, or edit the measured profile manually. At least one known real-world
dimension is required for AI calibration. Internally, all geometry remains in millimetres even when
the UI is displaying centimetres or inches.

The optional browser-direct OpenAI connection is intended for local or trusted environments only.
The key is held in React memory for the current page, is cleared on reload, and is never written to
IndexedDB, project JSON, GLB metadata, logs, or the URL. Public deployments should replace this
browser-direct mode with a server-side proxy.

## Adding another cup model

1. Add its stable id to `CupModel` in `src/types.ts`.
2. Add a selection button in `src/components/UploadPanel.tsx`.
3. Add the outer wall, inner wall, base, rim, decal envelope, floor height, and camera framing in
   `src/components/GlassScene.tsx`. Rotationally symmetric cups should use a measured
   `LatheGeometry` profile.
4. Pass the label from `src/App.tsx`, then verify both desktop and mobile framing.

The `cola-can` model follows the supplied 2.55 × 5.43 inch reference at an approximately 2.12
height-to-diameter ratio. Reference logos, engraving, liquid, ice, condensation, and background
objects are intentionally excluded. Selecting it starts with the decal opacity at zero so the
default view is transparent glass; importing a user image re-enables the separate decal layer.

The included `public/default-texture.png` is a generated sample only. Imported images stay in the
browser as object URLs and are not uploaded to a server.

## Structure

- `src/components/GlassScene.tsx`: Three.js scene lifecycle, procedural cup, texture updates, export.
- `src/components/UploadPanel.tsx`: image selection, drag and drop, and texture placement controls.
- `src/components/InspectorPanel.tsx`: image strength, environment lighting, and physical glass parameters.
- `src/App.tsx`: application state and editor composition.
- `src/lib/cup.ts`: unit-safe cup definitions, constraints, and profile transforms.
- `src/lib/openai.ts`: optional multimodal Responses API request and structured result validation.
- `src/lib/project.ts`: versioned full-project import/export.
- `design-concept.png`: the visual specification used for the implementation.
