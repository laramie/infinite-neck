# Command Menu Authoring Quick Start

This is the short version of the command-menu reference for maintainers who already understand the app and just need to add or fix commands quickly.

Use this together with the full reference in `command-menu-programmers-reference.md`.

## What To Edit

Most command-menu work touches these files:

| File | Why you edit it |
| --- | --- |
| `menu.js` | Add or change the declarative menu node structure. |
| `key-handlers.js` | Add or update the `performCmdAction()` case. |
| `approved-values.js` | Add or update live `$name` and `${name}` tokens for menu captions, input defaults, and section-caption templates. |
| `infinite-neck.js` | Only if your new action needs a provider that `key-handlers.js` does not already expose. |
| `index.html` | Only if the command launches a dialog or panel that does not already exist. |

## Pick The Right Pattern First

Before you add JSON, decide which of these patterns you want.

| Pattern | Use when | Data received by JavaScript |
| --- | --- | --- |
| Simple leaf action | One key should run one action immediately | Usually just `menuItem` |
| Input action | User must type a value first | `args[input.id]` |
| Parent-handled choice | Parent owns several choice tokens | `args.key` |
| Confirmation submenu | User should answer `Y/n` or similar | Usually just `menuItem`, often with `popOnBang` |
| Named semantic leaf | Action needs a stable semantic token | `menuItem.name` |
| Dialog launcher | Command opens an existing panel | Usually just `menuItem` |

## Copy-Paste Templates

### 1. Simple leaf action

```json
{
  "caption": "<b>g</b>raveyard",
  "trigger": "g",
  "action": "showGraveyard"
}
```

Add a matching `case "showGraveyard"` in `performCmdAction()` if one does not already exist.

### 2. Input action

```json
{
  "caption": "<b>b</b>pm",
  "trigger": "b",
  "action": "setBPM",
  "input": {
    "type": "input",
    "caption": "1-240",
    "default": "getBPM",
    "datatype": "int",
    "id": "bpm"
  }
}
```

In JavaScript:

```js
case "setBPM":
    if (argByInputID) {
        const bpm = toInt(argByInputID, 0);
        if (bpm > 0) {
            setBPM(bpm);
        }
    }
    break;
```

### 3. Parent-handled choice menu

```json
{
  "caption": "<b>m</b>enu prefs",
  "trigger": "m",
  "action": "setMenuPrefs",
  "children": [
    { "caption": "<b>s</b>hort", "trigger": "s" },
    { "caption": "<b>t</b>all", "trigger": "t" }
  ]
}
```

In JavaScript:

```js
case "setMenuPrefs":
    switch (args.key) {
        case "s":
            gMenuFile.tall = false;
            break;
        case "t":
            gMenuFile.tall = true;
            break;
    }
    break;
```

### 4. Confirmation submenu

```json
{
  "caption": "<b>d</b>elete",
  "trigger": "d",
  "children": [
    {
      "caption": "<b>Y</b>es: DELETE section ${currentSectionCardinal}/${sectionCount} !",
      "trigger": "Y",
      "action": "sectionDelete",
      "vars": ["currentSectionCardinal", "sectionCount"],
      "popOnBang": true
    },
    {
      "caption": "<b>n</b>o: keep section.",
      "trigger": "n",
      "action": "sectionKeep",
      "popOnBang": true
    }
  ]
}
```

Use `popOnBang` when the answer should return the user to the menu that asked the question.

### 5. Named semantic leaf

```json
{
  "name": "semitone2",
  "caption": "<b>2</b>&nbsp;frets",
  "trigger": "2",
  "action": "selectBendType",
  "popOnBang": true
}
```

In JavaScript:

```js
case "selectBendType":
    $("#selBend").val(menuItem.name);
    $("#rbBend").prop("checked", true);
    break;
```

## Rules That Matter In Practice

### Required authoring habits

- Every reachable menu item needs a sibling-unique `trigger`.
- Every visible menu item needs a `caption`.
- If you want the trigger visibly highlighted, you must manually place it in `<b>...</b>`.
- Action names in `menu.js` must match `performCmdAction()` case labels exactly.

### Reserved inputs you should not reuse casually

| Input | Why |
| --- | --- |
| `x` | Reserved for exit inside the command-line textbox |
| `/` | Reserved for reset-to-root inside the command-line textbox |
| Empty `Enter` | Reserved for going up a level |

### Input-node reality check

- `datatype` is descriptive only.
- `default` is display-only.
- Empty `Enter` does not accept the displayed default.
- `args[input.id]` is always the raw typed string.

### Dynamic caption reality check

If you use `${token}` in a caption, you must also:

1. list the token in `vars`, and
2. add the token to the registry in `approved-values.js`.

Otherwise the placeholder text will stay in the rendered caption.

If you need a current-value reference while authoring or testing these tokens, use the diagnostics command <span class="menuExampleLine"><b>/vdv</b></span>. It lists every approved variable name, both supported patterns, and a live sample value from the current song and section.

## Good Existing Exemplars

Use these as the main examples when copying patterns:

| Pattern | Existing exemplar |
| --- | --- |
| Input action | `setBPM`, `setSongName`, `setSectionCaption`, opacity commands |
| Parent-handled choice | `setMenuPrefs`, `selectFingering`, `selectRadioNoteType` |
| Confirmation submenu | graveyard clear, section delete |
| Named semantic leaf | bend-type selections under palette |
| Dialog launcher | `showDialog-song`, `showDialog-view`, similar `showDialog-*` actions |

Avoid using `pluginDaCapoWInput` as a reference implementation right now. It is mid-implementation and not a clean exemplar for maintainers.

## Minimum Change Recipe

When adding one new command, the usual sequence is:

1. Add the menu node in `menu.js`.
2. Add the matching `case` in `key-handlers.js::performCmdAction()`.
3. Add or extend `approved-values.js` only if you need dynamic caption variables, input defaults, or section-caption templates.
4. Add provider wiring only if your new action needs a helper that `key-handlers.js` does not already wrap.
5. Run the validator:

```bash
npm run validate:cmdmenu
```

6. Use <span class="menuExampleLine"><b>/vdv</b></span> if you changed approved variable names and want to verify the live values.
7. Manual test the trigger path in the browser.

## Fast Failure Checklist

If a command does not work, check these first:

1. Trigger collision among siblings.
2. Action string typo versus `performCmdAction()`.
3. Missing parent action for a selector-style child.
4. Missing `input.id` for an input command.
5. Missing `approved-values.js` token for `vars` or `input.default`.
6. Chosen trigger accidentally collides with reserved navigation like `x` or `/`.

## Validator

The repository includes a validator script for the command menu:

```bash
npm run validate:cmdmenu
```

It currently checks for:

- duplicate sibling triggers,
- actions referenced in `menu.js` but missing in `performCmdAction()`,
- `vars` and `input.default` tokens missing from `approved-values.js`,
- malformed input descriptors,
- selector leaves whose parent has no action,
- and a few common authoring warnings such as reserved triggers.

If you are doing command-menu maintenance regularly, run it before and after browser testing.

If you are changing the approved-variable list shown in static help, also run:

```bash
npm run update:help
```