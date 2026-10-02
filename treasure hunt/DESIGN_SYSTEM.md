# The Echo Protocol — Design System v2
### For Stitch UI generation · existing panels, restyle only

---

## 1. Direction

Move off the current cyan/teal "sci-fi dashboard" look. Target: **an old newspaper that's
been digitized by something that shouldn't exist** — phosphor-green terminal text on
aged, grain-stained black, with a dried-blood red reserved for danger and a sickly amber
for warnings. Cryptic and technical first, atmospheric second. Think a 1980s CRT monitor
left running in a newspaper morgue, not a glossy hacker-movie HUD.

Reference language: Matrix-style monospace green on black, but **desaturated and aged**
— nothing neon, nothing glowing-clean. Every surface should feel like it's been scanned,
printed, and left to yellow, then partially corrupted.

---

## 2. Colour palette

### 2.1 Core

| Role | Hex | Usage |
|---|---|---|
| `bg-void` | `#0B0C0A` | Primary app background. Near-black, faint green undertone — not pure `#000`. |
| `bg-surface` | `#13150F` | Card/panel backgrounds, sitting one step above void. |
| `bg-surface-raised` | `#1B1E15` | Modals, active/focused cards, hover states. |
| `hairline` | `#2A2E22` | Borders, dividers — always subtle, never a bright line. |

### 2.2 Text (phosphor green, newspaper-aged)

| Role | Hex | Usage |
|---|---|---|
| `text-primary` | `#C8D4B0` | Main body copy. A pale, slightly sepia-green — aged paper lit from behind, not a bright screen color. This is the biggest fix from the old palette: body text must be near-white-equivalent contrast, not mid-tone green. |
| `text-secondary` | `#8A9478` | Metadata, timestamps, captions, labels under headlines. |
| `text-muted` | `#5B5E4E` | Disabled, placeholder, inactive nav items. |
| `text-headline` | `#E8EEDC` | Case titles, fragment names — the brightest neutral in the system, used sparingly. |

### 2.3 Signal green (the "alive" color)

| Role | Hex | Usage |
|---|---|---|
| `signal-green` | `#4F8F3F` | Base accent — icons, inactive progress fills, standard borders on interactive elements. Muted, not neon. |
| `signal-green-bright` | `#7FD858` | **Live/active states only**: a scan currently running, a puzzle currently unlocked, a connection actively streaming. This is the one color allowed to feel "charged." Used in small doses — a dot, a pulse ring, a progress bar fill, never a full background. |
| `signal-green-dim` | `#2E4524` | Completed/verified states — a checkmark, a "solved" tag. Deliberately calmer than the live color, so done things recede and live things pop. |

### 2.4 Danger red (dried blood, not alarm siren)

| Role | Hex | Usage |
|---|---|---|
| `danger-red` | `#7A2320` | Strikes, failed verification, corrupted fragments, countdown timers under a threshold. Oxidized red — think old newsprint ink, not fire-engine red. |
| `danger-red-bright` | `#B23A2E` | A single critical pulse — the moment a strike lands, the moment time runs out. Reserve for the instant something goes wrong, not for sustained UI chrome. |

### 2.5 Warning amber (aged newsprint)

| Role | Hex | Usage |
|---|---|---|
| `warning-amber` | `#A6822E` | Signal-strength meters, "in progress / uncertain" states, low-battery-style warnings. Replaces the old palette's single unused amber swatch — give it this one clear job and nothing else. |

### 2.6 Rare highlight (use once per screen, max)

| Role | Hex | Usage |
|---|---|---|
| `highlight-select` | `#C9A227` | The *one* selected/focused thing on a screen — the active nav tab, the currently open fragment, the selected answer field. A dull gold, closer to old typewriter-ribbon ink than to a UI blue. If more than one element on a screen has this color, something is wrong — it stops meaning "selected" the moment it's everywhere. |

**Rule of thumb for Stitch:** every screen should read as 85% near-black and aged green
text, with red appearing only where something has actually gone wrong, amber only on
measurement/progress elements, and gold only on the single selected/active item. If a
generated screen has red, amber, and gold all visible with nothing wrong and nothing
selected, that's the old palette's mistake repeating — reject it.

---

## 3. Typography

| Role | Family | Notes |
|---|---|---|
| Headlines | A condensed grotesk (e.g. Oswald, Bebas Neue, or similar) | All-caps, tight tracking — "newspaper masthead" energy. Used for case titles, fragment names. |
| Body | A plain serif or slab (e.g. Georgia, Noto Serif, or a typewriter-adjacent serif) | This is the "old newspaper" signal — body copy should NOT be the same monospace as the terminal elements. The contrast between serif prose and mono data is what sells "newspaper + terminal" at once. |
| Mono / data | A monospace (e.g. JetBrains Mono, IBM Plex Mono) | Timestamps, codes, coordinates, hex values, countdowns, anything that looks machine-generated. |

Avoid any rounded/friendly sans-serif anywhere in the system — it's the fastest way to
break the "cryptic and technical" read.

---

## 4. Texture and grain

- A **very subtle film-grain/noise overlay** across all backgrounds (2–4% opacity) —
  this is what sells "old newspaper scan" over "clean dark-mode app." Without it the
  palette alone will still read as a generic dark UI.
- Occasional **hairline scan-line texture** on large background panels (the kind of
  faint horizontal banding an old CRT or a bad photocopy produces) — use sparingly,
  mainly on hero/finale screens, not on every card.
- Card borders (`hairline`) should look slightly irregular/imperfect where feasible,
  not perfectly crisp vector lines — reinforces the "degraded document" feeling.

---

## 5. Component rules

### Cards / panels
- Background `bg-surface`, border `hairline`, text per the roles above.
- On hover/focus: background steps up to `bg-surface-raised`, border brightens slightly
  toward `signal-green`.

### Buttons
- **Primary action** (e.g. "Scan," "Verify," "Start"): background `signal-green-dim`,
  text `text-headline`, border `signal-green`. On press/active: background shifts
  toward `signal-green-bright`.
- **Destructive action** (e.g. "Destroy Echo"): background `danger-red`, text
  `text-headline`, border `danger-red-bright`.
- **Secondary/ghost**: transparent background, `hairline` border, `text-secondary`.

### Status indicators
- Live/in-progress: `signal-green-bright`, with a slow pulse animation (opacity breathing,
  not a hard blink).
- Solved/verified: `signal-green-dim`, static, no animation — stillness signals "done."
- Failed/corrupted: `danger-red`, no pulse unless it's the instant of failure (then one
  sharp flash to `danger-red-bright`, then settle to static `danger-red`).
- Measurement/strength bars (signal detected %, time remaining): `warning-amber` fill
  on a `hairline`-bordered track.

### Progress / fragment trackers
- Unsolved slot: `hairline` outline only, `text-muted` icon.
- Current/active slot: `signal-green-bright` outline, slow pulse.
- Solved slot: filled `signal-green-dim`, static.

### The one gold moment
- Reserve `highlight-select` for exactly one UI element per screen: whichever nav tab,
  fragment, or field is the user's current single focus. Nothing else on that screen
  should use this color.

---

## 6. What this fixes from the current build

The existing panels (see attached screenshots) use one muted green across nearly every
element — headers, labels, progress, icons, buttons — with the red, amber, lavender,
and lime swatches from the original palette barely appearing anywhere. The result has
no visual hierarchy: a team glancing at the screen mid-puzzle can't tell at a glance
what's urgent, what's done, or what's selected.

This revision keeps the "moody dark green terminal" identity but gives every non-base
color **exactly one job**:

- Red = something failed, right now.
- Amber = something is being measured (signal strength, time, progress).
- Bright green = something is live/active, right now.
- Dim green = something is finished.
- Gold = the one thing currently selected.

If Stitch generates a screen and you can't immediately point to what each color-coded
element *means*, the hierarchy has collapsed back into the old single-tone problem —
regenerate with the roles above enforced explicitly.

---

## 7. Reference inspiration notes

Two reference sites were supplied for structural/interaction cues (chapter-lettered
navigation, frequency/signal labeling conventions, minimal large-type sections) —
match their restraint and use of whitespace/negative space between sections, not their
color (both run cooler and more minimal than this system's aged-document direction).
Pull: generous vertical spacing, small all-caps section labels, understated hover
states. Leave behind: their cyan/neutral palettes.
