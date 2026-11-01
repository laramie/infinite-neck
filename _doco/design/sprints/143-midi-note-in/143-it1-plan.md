# 143-it1-plan: Web MIDI research + Iteration 1 prototype plan

Sprint index: [sprint planning index](../../../lifecycle/sprints.md)
Sprint doc: [sprint-143.md](sprint-143.md)
Design doc: [143-it1-design.md](143-it1-design.md)

This is a **plan only** — no application code changes are made in this document. Per repo SOP,
changes to top-level files (`./*.js`, `./index.html`, etc.) need to be explicitly requested; this
report is the design/viability discussion that comes first.

## 1. Requirement recap

From the design doc: get a bright-screen proof of concept where playing a note on the USB MIDI
device produces a NOTE ON message that updates a `<span>` on screen — nothing more for Iteration 1.
Mapping NOTE ON messages to strings/frets on Instrument tables, channel/device disambiguation, and
UI/rules for that mapping are explicitly deferred to later iterations per [sprint-143.md](sprint-143.md).

## 2. Web MIDI API research

The functionality demonstrated at `blog.abletondrummer.com/online-midi-monitor` is built on the
**Web MIDI API**, a native browser API — no third-party library is required to receive NOTE ON
messages.

- **Support**: Implemented in Chrome/Chromium/Edge (desktop and ChromeOS) natively. Not implemented
  in Firefox or Safari without a polyfill. Since the design doc's device is "Chrome on a Chromebook,"
  this repo's target browser has full native support.
- **Secure context requirement**: `navigator.requestMIDIAccess` only works on a secure context
  (HTTPS or `localhost`). Whatever URL serves the app (or the prototype file below) must be loaded
  over HTTPS or from `localhost`/`file:` — worth confirming which serving method will be used for
  the acceptance test.
- **Permission model**: The first call to `navigator.requestMIDIAccess()` triggers a one-time browser
  permission prompt (like camera/microphone). It returns a `Promise<MIDIAccess>`.
- **Shape of the API**:
  - `midiAccess.inputs` — a `Map` of `MIDIInput` objects (one per connected MIDI input port).
  - Each `MIDIInput` gets an `onmidimessage` handler receiving a `MIDIMessageEvent` whose `.data` is
    a `Uint8Array` of raw MIDI bytes: `[statusByte, data1, data2]`.
  - **NOTE ON** parsing: `(statusByte & 0xf0) === 0x90` with `data2 > 0` (velocity). Per the MIDI
    spec, a NOTE ON with velocity `0` is conventionally a NOTE OFF (running-status optimization) —
    the parser needs to treat that as OFF, not ON, or the "bright screen" demo will flicker on note
    release too.
  - `data1` is the MIDI note number (0-127); `data2` is velocity; the channel is the low nibble of
    the status byte (`statusByte & 0x0f`).
  - `midiAccess.onstatechange` fires on device connect/disconnect — useful later, not required for
    the bright-screen demo.
- **Converting note number → name**: not needed from a new library — [Tonal.js](../../../../tonal-6.4.3.min.js)
  is already a project dependency and can convert a MIDI number to a note name (e.g. via its `Note`
  module), so no additional note-naming library is needed even in later iterations.

## 3. Library options considered

| Option | What it is | Pros | Cons |
|---|---|---|---|
| **A. Native Web MIDI API only** | No library; use `navigator.requestMIDIAccess` + raw byte parsing directly | Zero new dependency; nothing to vendor/audit; matches this repo's existing "vendor-or-native, no CDN at runtime" pattern ([index.html](../../../../index.html) loads jQuery/Tonal from local committed files, CDN links are commented out); works with the existing no-bundler ES6-module architecture | Raw byte parsing (status/data1/data2, running-status NOTE-ON-with-velocity-0 quirk) has to be written by hand, though it is only a few lines |
| **B. WebMidi.js** (`djipco/webmidi`, ES6, actively maintained) | A wrapper around the Web MIDI API giving named events (`noteon`/`noteoff`), note-name helpers, channel objects | Nicer ergonomics, well-tested community library, ES6 native | Would need to be vendored as a local file (per this repo's no-CDN-at-runtime policy, same treatment as `jquery-3.7.1.min.js`/`tonal-6.4.3.min.js`), adding a new committed third-party file + upgrade/audit burden, for functionality (NOTE ON/OFF detection) that's a handful of lines of native code |
| **C. Tonal.js (already a dependency)** | Music-theory library already in the repo | Good for MIDI-number → note-name conversion later | Not a MIDI I/O library at all — doesn't touch `navigator.requestMIDIAccess`, so it's a complement to Option A, not an alternative |

**Recommendation for Iteration 1: Option A (native Web MIDI API, no new dependency).** The bright-screen
requirement is small enough (detect NOTE ON, show it in a span) that hand-rolled parsing is only a
few lines, and it avoids introducing a new vendored third-party file before the sprint even knows
whether more advanced MIDI features (multi-device routing, SysEx, MIDI clock sync — noted as a
possible *future* sprint in 903's closing notes) will actually be needed. WebMidi.js can be
reconsidered in a later iteration if the raw-byte parsing starts feeling unwieldy (e.g. once
per-channel/per-device routing rules are added).

## 4. Constraints and risks specific to this repo

- **No-CDN-at-runtime policy**: [index.html](../../../../index.html) comments out CDN `<script>` tags
  in favor of locally committed copies (offline-friendly for a Chromebook). Choosing Option A avoids
  this tradeoff entirely for Iteration 1.
- **Root-file change policy**: per repo SOP, editing `./index.html` / `./infinite-neck.js` (or adding
  a new top-level `./midi-input.js`) needs to be explicitly requested and is normally preceded by a
  design discussion — which is what this document is. Recommendation below is to build the
  bright-screen demo as a **self-contained prototype file inside this sprint folder first** (same
  pattern already used for research tooling in sprint 903, e.g.
  [903-phase-5-flyweight-benchmark.html](../903-timing-caching/903-phase-5-flyweight-benchmark.html)),
  and only touch the real `./` app files once that prototype has been manually confirmed against the
  real MIDI device.
- **Testability**: per this repo's Jest conventions (Jest avoids JSDom/browser-only behavior; browser
  behavior is validated via UI acceptance testing), `navigator.requestMIDIAccess` and real
  `MIDIMessageEvent`s cannot be exercised in Jest at all. The one thing worth unit-testing is a small,
  **pure** byte-parsing function (e.g. `parseMidiMessage(data) -> {type, note, velocity, channel}`,
  no DOM/`navigator` access) — this mirrors the "extract pure logic for testability" pattern already
  used elsewhere (e.g. `computeCellSizing()` in [NoteTableController.js](../../../../NoteTableController.js)).
  Live device wiring stays a thin, untested integration layer, validated manually.
- **Permission scope / security**: call `navigator.requestMIDIAccess({ sysex: false })` explicitly
  (also the default) — Iteration 1 has no need for System Exclusive access, and requesting the
  narrower permission keeps the browser's permission prompt/grant as minimal as possible.
- **Browser support scope**: this only works in Chromium-family browsers (matches the design doc's
  Chromebook/Chrome target); no polyfill is proposed since that's the only target mentioned.

## 5. Proposed Iteration 1 plan (prototype-first)

1. **Standalone prototype** (research tool, not app code): a single self-contained HTML file inside
   this sprint folder (e.g. `143-it1-midi-prototype.html`), with an inline `<script type="module">`
   that:
   - Calls `navigator.requestMIDIAccess({ sysex: false })`.
   - On success, attaches `onmidimessage` to every entry in `midiAccess.inputs`.
   - Parses NOTE ON (status nibble `0x9`, velocity `> 0`) vs. NOTE OFF (nibble `0x8`, or `0x9` with
     velocity `0`).
   - Updates one `<span>` with the latest NOTE ON's note number/channel/velocity, and briefly flashes
     the background bright (per the design doc's "bright screen") via a CSS class toggle.
   - Shows a plain-text error/status message if `requestMIDIAccess` is unsupported or the user denies
     permission.
   - No dependency on jQuery/EventBus/the rest of the app — deliberately isolated so it can be opened
     directly and tested against the real device with nothing else to debug.
2. **Manual acceptance test**: open the prototype on the Chromebook, grant MIDI permission, play a
   note, confirm the span updates and the flash is visible; also confirm NOTE OFF (or note-on w/
   velocity 0) does not get mis-reported as another NOTE ON.
3. **Only after that passes**, come back with an explicit request to integrate into the real app:
   a small new `./midi-input.js` ES6 module (imported by [infinite-neck.js](../../../../infinite-neck.js),
   matching the existing module-import convention rather than a second `<script type="module">` tag)
   exporting an `initMidiInput()` plus the pure `parseMidiMessage()` helper (unit-testable), wired to
   `EventBus.trigger('Midi:NoteOn', {...})` / `'Midi:NoteOff'` so the rest of the app can subscribe the
   same way it already does for `Looper:*`/`DaCapo:*` events, and a small permanent status `<span>` in
   `./index.html` in whatever location the user prefers (see open questions).

Steps 1-2 need no approval to touch `./` files (self-contained file lives under this sprint's design
folder). Step 3 is the point where explicit sign-off to modify top-level app files should be sought.

## 6. Open questions for the user

- **Where should the permanent on-screen indicator live** once this moves from prototype into the
  real app — near the command-line panel, a new small "MIDI status" widget, the Info page, or
  somewhere else?
- **Opt-in vs. automatic**: should the app call `requestMIDIAccess()` automatically on load (shows the
  permission prompt to every user, even those without a MIDI device), or only when the user explicitly
  enables a "MIDI input" setting/menu action?
- Is there a specific USB MIDI device/brand already on hand to test against, in case its NOTE ON
  byte pattern has any device-specific quirks worth knowing about ahead of time?

## 7. Explicitly out of scope for Iteration 1

- Mapping MIDI note numbers to strings/frets on Instrument tables.
- Multi-device or multi-channel disambiguation rules.
- SysEx, MIDI clock sync, or any output (MIDI-out) functionality.
