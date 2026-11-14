# Trompe material studies

Eight everyday app screens, each built from one material world, drawn in CSS and SVG with no images. They show how far Trompe's light, material and interaction model reaches before the components exist, and they are the reference for what the foundation package's skins should be able to produce.

| Study | Screen | Material world |
|---|---|---|
| [dashboard.html](dashboard.html) | Operations dashboard (Meridian) | graphite anodising, chrome bezels, VFD, OLED, e-paper, LED ladder, needle gauge |
| [settings.html](settings.html) | Settings (Alloy) | milled aluminium, smoked glass, chrome hardware |
| [checkout.html](checkout.html) | Sign-in and checkout (Kurogane) | black urushi lacquer, gold inlay, raw silk, brass |
| [files.html](files.html) | File manager (Archive) | quarter-sawn oak, manila card, pressed steel |
| [calendar.html](calendar.html) | Calendar (Frost) | edge-lit acrylic, satin aluminium, enamel |
| [messages.html](messages.html) | Messaging (Pebble) | soft-touch silicone, cast resin, polycarbonate |
| [journal.html](journal.html) | Notes and trip planner (Waymark) | leather, paper, waxed thread, brass, ink |
| [thermostat.html](thermostat.html) | Home controls (Ember) | bisque ceramic, frosted glass, lime plaster |

Open `index.html` through any static server (ES modules don't load from `file://`), for example `npx serve gallery`.

- `kit/objects.css`: light variables (`--tr-shadow-x/-y/-len` from `--tr-light-angle`), procedural textures, the shared top bar.
- `kit/objects.js`: `RotaryController`, `LinearController`, `PressController`, `ToggleController`, optional sound and haptics (`feedback`), `mountBar`. The API mirrors the interaction layer (`src/interaction/`) so studies can move onto it by changing the import; differences today: the gallery's `PressController` still has `mode`/`phases`, and the interaction layer adds `ChoiceController` and `DragSurfaceController`.
- `tools/shoot.mjs`: serves the folder, screenshots desktop and phone, runs a step script, reports console errors. Every study has a step script in `tools/` that drives all of its controls.
- `tools/thumbs.mjs`: renders `img/*.jpg` for the index.
- [AUTHORING.md](AUTHORING.md): the contract for writing a new study.
