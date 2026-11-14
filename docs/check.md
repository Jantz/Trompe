# trompe check

`trompe check` is a linter for interfaces built with Trompe. It is designed for coding agents: run it on what you generated, read the JSON findings, apply the fixes, run it again until it exits 0.

It reads the installed package's own `custom-elements.json`, `dist/tokens.json` and `dist/skins.json`, so the rules always match the components, tokens and skins you have. Nothing in the checker is hand-maintained per component.

## Usage

```sh
npx trompe check [files, dirs or globs...]   # default: current directory
npx trompe check --format json src/          # machine-readable findings
npx trompe check --fix src/                  # apply unambiguous fixes, then re-check
npx trompe check --render --shots shots/ index.html   # also load pages in Chromium
npx trompe check --rules                     # list rules
```

Inputs: `.html`/`.htm`, `.vue` (template), `.svelte` (markup, with `{#if}` blocks and `{…}` expressions), `.jsx`/`.tsx` (JSX), Lit ``html`…` `` literals in `.js/.mjs/.ts/.mts`, `.css`, and `*.skin.json`. Bound values (`:value`, `@change`, `bind:`, `{expr}`, `${…}`) are skipped rather than guessed, but the attribute names are still checked; React names (`className`, `htmlFor`) and element properties set from frameworks are accepted. URLs are not read: build the app and check the built page.

The checker looks at the whole project around the files you pass (up to the nearest `package.json`): skins defined in `*.skin.json`, in CSS (`[data-tr-skin='name']`) or with `applySkin`, and skin stylesheets imported from JavaScript, count as loaded, so TR006 and TR015 do not fire for them.

Exit codes: 0 no errors (warnings allowed), 1 errors found, 2 the checker itself failed.

`--render` needs Playwright and Chromium (`npm i -D playwright && npx playwright install chromium`; a global install is found too, or pass `--chromium <path>` / set `TROMPE_CHROMIUM`). Pages are served from the current directory over a local server. If a page uses `tr-*` elements without loading Trompe, the checker injects the package bundle so it can still measure them. Pages that import TypeScript directly (Vite dev pages) must be checked after building. The text summary says how many pages were rendered, so a clean result is never mistaken for a rendered one.

## Output

```json
{
  "tool": "trompe-check",
  "version": "0.1.0",
  "summary": { "files": 1, "errors": 1, "warnings": 0, "fixed": 0 },
  "findings": [
    {
      "id": "TR003", "rule": "invalid-value", "severity": "error",
      "file": "index.html", "line": 6, "column": 14,
      "element": "tr-button", "attribute": "size", "value": "medium",
      "message": "size=\"medium\" is not valid on <tr-button>. Use size=\"md\".",
      "expected": ["sm", "md", "lg"],
      "fix": { "kind": "set-attribute", "name": "size", "value": "md" },
      "docs": "…/docs/check.md#tr003-invalid-value"
    }
  ]
}
```

`fix.kind` is one of `set-attribute`, `rename-attribute`, `remove-attribute`, `rename-element`. `--fix` applies exactly these. Values agents often borrow from other design systems are mapped (`primary` → `accent`, `medium` → `md`, `destructive` → `danger`, `rounded` → `pill`).

## Rules

### Markup and CSS (static, always on)

#### TR001 unknown-element

Error. A tr-* element that Trompe does not define.

#### TR002 unknown-attribute

Error. An attribute the element does not declare (global HTML, aria-*, data-* and framework bindings are allowed).

#### TR003 invalid-value

Error. An attribute value outside the declared enum or type.

#### TR004 boolean-false

Warning. A boolean attribute written as ="false" is still true. Remove the attribute instead.

#### TR005 accessible-name

Error. An interactive element with no accessible name (text, label, aria-label or aria-labelledby).

#### TR006 unknown-skin

Error. data-tr-skin names a skin that does not exist.

#### TR007 hand-shadow

Warning. Hand-written shadow, filter or gradient on a Trompe element bypasses the light model. Use depth, material, finish or a skin.

#### TR008 unknown-token

Error. var(--tr-…) refers to a token or variable Trompe does not define.

#### TR009 private-variable

Error. Setting a private --_ variable. These are internal and change without notice.

#### TR010 light-override

Warning. The light is set on an inner element. One light per scene: set it on :root, <body> or a container with data-tr-skin or data-tr-scene.

#### TR011 glass-on-glass

Warning. Glass inside glass blurs twice, costs GPU time and usually fails text contrast.

#### TR012 depth-budget

Warning. More than three distinct raised depths in one view flattens the hierarchy.

#### TR013 realism-mix

Warning. More than two realism levels in one view looks inconsistent.

#### TR014 nested-interactive

Error. An interactive element inside another interactive element breaks keyboard and screen reader behaviour.

#### TR015 skin-stylesheet

Warning. data-tr-skin is used but the page never loads skins.css (or skins/<name>.css).

#### TR016 unknown-part

Error. ::part() names a part the element does not expose.

#### TR017 unknown-variable

Warning. A --tr-* custom property is set that no Trompe element or token reads.

#### TR018 label-in-name

Error. An interactive element has visible text and an `aria-label` that does not contain it (WCAG 2.5.3). Speech users say what they see, so `<tr-button aria-label="Submit order">Pay now</tr-button>` cannot be activated by "click Pay now". Remove the `aria-label`, or start it with the visible words.

### Rendered (--render)

#### TR101 text-contrast

Error. Rendered text below WCAG contrast (from axe-core).

#### TR102 axe

Error. Other axe-core accessibility violations.

#### TR103 target-size

Error. Interactive element smaller than 24×24 CSS px (WCAG 2.5.8).

#### TR104 forced-colors-edge

Error. Under forced colours the control has no visible boundary.

#### TR105 paint-budget

Warning. Too many backdrop-filter surfaces or shadow layers for smooth rendering.

#### TR106 runtime-error

Error. The page threw an error or a Trompe element failed to upgrade.

### Skin files (*.skin.json)

#### TR201 skin-schema

Error. The skin file does not match the skin format.

#### TR202 skin-unknown-token

Error. The skin sets a token, element, variable or bundle value Trompe does not have.

#### TR203 skin-contrast

Error. A colour pair in the skin fails WCAG contrast.

## Writing a skin with the checker

1. Copy a shipped skin from `skins/` and rename it (`name` becomes `data-tr-skin="<name>"`).
2. Change tokens and per-element `material`, `finish`, `profile`, `vars` (`--tr-m-*`, `--tr-f-*`, `--tr-p-*`) and `style` (the element's CSS properties).
3. `npx trompe check my.skin.json` validates the format, every name, and WCAG contrast of the colour pairs the skin changes: ink on surface and canvas, muted ink, accent and danger ink on their fills, edge and focus against the canvas, and each element's `--tr-m-ink` on `--tr-m-base`.
4. Put the skin on a test page and run `--render` to check the real result, including gradients and textures.
