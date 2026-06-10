# Palette Mode State Spec

date: 20260609

## Goal

Replace the current mixed Palette model where `rbColor` represents both:
- real paint selections such as `noteRoot`, `noteScale`, `notePink3`
- special behavior states such as `noteClear`, `noteKeep`, and `noteDropper`

with an explicit mode group that models the actual user intent.

## New Palette Model

Palette state is split into two layers.

### 1. Palette mode

Exactly one active mode:
- `paint`
- `clear`
- `keep`
- `dropper`

### 2. Paint selection memory

Paint mode uses remembered selection state:
- last chosen note type from the six restorable note-type radios:
  - Named
  - Single
  - Tiny
  - Bend
  - Pitch
  - Multi
- last chosen paint color or role from the real `rbColor` radios

Fingering stays outside the restorable note-type memory for this slice.

## UI Contract

The special mode controls become a dedicated four-way mode group, separate from `rbColor`.

Visible mode entries:
1. `CLEAR`
2. `KEEP`
3. `Find Color`
4. `Color: <caption>`

The fourth entry is the explicit `paint` mode entry.

### Paint mode caption

The fourth entry caption is dynamic and must continue to expose the remembered paint selection label:
- `Color: Root`
- `Color: Scale`
- `Color: Emboss`
- `Color: Chord`

This remains important when AutoColor is enabled and the underlying role radios are hidden.

## Highlight and Glow Contract

Cyan highlights remain part of the design.

Required cyan highlight behavior:
- active `CLEAR` mode entry shows cyan highlight
- active `KEEP` mode entry shows cyan highlight
- active `Find Color` mode entry shows cyan highlight
- active `paint` mode entry shows cyan highlight
- successful Find Color note-dropper result still applies the attention-getting cyan highlight to the resolved `rbColor` radio

The previous `chooseLastColorAligned` visual behavior remains valid, but it should now align with the explicit `paint` mode entry rather than a standalone button concept.

## State Transitions

### Entering special modes

Selecting one of the special mode entries changes only mode:
- `CLEAR` -> mode `clear`
- `KEEP` -> mode `keep`
- `Find Color` -> mode `dropper`

Entering `clear` still remembers the currently selected restorable note type and unchecks the six restorable note-type radios.

### Entering paint mode

The user enters `paint` mode by any of these actions:
- clicking the `Color: <caption>` mode entry
- selecting a restorable note-type radio
- selecting Fingering
- selecting a role/color radio
- selecting a bend subtype
- command-line actions under `/pn`, `/pf`, or `/pr` that imply painting

When entering `paint` mode:
1. mode becomes `paint`
2. remembered paint color is re-applied if needed
3. remembered note type is re-applied if none of the six restorable note types is selected
4. existing deliberate non-restorable selection such as Fingering is not overridden unless the triggering action explicitly selects a different type

## Controller Contract

Note placement logic must stop inferring behavior from fake special `rbColor` values.

The controller should branch on explicit palette mode:
- `paint` -> place or toggle notes using the current effective paint selection
- `clear` -> clear notes for the clicked cell/pitch according to current CLEAR rules
- `keep` -> keep behavior
- `dropper` -> Find Color behavior

`rbColor` should only be consulted for actual paint colors and roles.

## Command-Line Contract

Palette command-line actions must migrate to the same model.

### `/pn`

These should enter `paint` mode when appropriate:
- `/pnn`
- `/pns`
- `/pnt`
- `/pnb`
- `/pnp`
- `/pnm`
- `/pnl` enters explicit `paint` mode via the dynamic paint mode control

These stay mode-only:
- `/pnc` -> `clear`
- `/pnk` -> `keep`
- `/pnf` -> `dropper`

### `/pf`

All Fingering selections under `/pf` imply `paint` mode.

### `/pr`

All role/color selections under `/pr` imply `paint` mode.

## AutoColor Contract

AutoColor remains independent from palette mode.

Requirements:
- turning AutoColor on still hides manual color radios
- the dynamic paint mode caption must still expose the remembered role/color name even when manual colors are hidden
- entering `paint` mode must not accidentally force AutoColor off unless the specific existing flow already requires it

## Invalid States To Eliminate

The refactor must remove these hybrid states from the model:
- Named selected while CLEAR mode remains active but user intent is painting
- role/color changed while KEEP or DROPper still remains the active mode in the model
- command-line palette actions bypassing the same transitions as mouse actions

## Migration Principle

The safe migration path is:
1. introduce explicit mode state in presentation
2. route UI and command-line through mode-aware helpers
3. update controller to read explicit mode
4. replace legacy special `rbColor` UI with the separate four-way mode group
5. delete remaining fake special-color logic