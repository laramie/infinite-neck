# Feature: Accumulator logStep

## Overview

This feature introduces `Step.icon` support to the Accumulator's step tracking, allowing each step entry to carry a visual indicator in log output and plan printouts.

---

## Step.icon

Each `Step` object may include an `icon` field. The `icon` value is one of the named icon strings defined in `Emoji` (see [`../Emoji.js`](../Emoji.js)).

### Allowed Icons

| Icon Name  | Character | Description                         |
|------------|-----------|-------------------------------------|
| `BEETLE`   | 🪲        | Reserved — indicates no icon was specified |
| `BULLET`   | ●         | Uncategorized step (default icon)   |
| `GENERATE` | 🎲        | Generation step                     |
| `FILEACCESS` | 💾      | File access / write step            |
| `FILEINFO` | 📂        | File info / read step               |
| `WARNX`    | ❌        | Warning or error step               |
| `STOP`     | 🛑        | Stop / halt step                    |
| `INFO`     | 👉        | Informational step                  |

> **Reserved:** `BEETLE` (🪲) is reserved and indicates that no icon was explicitly specified for the step.

> **Uncategorized:** `BULLET` (●) is the default icon for steps that do not fall into a more specific category.

---

## Notes

### Minimal Step JSON Example

The following is a minimal valid `Step` JSON object containing only the required fields:

```json
{
    "icon": "BULLET",
    "logline": "Processing source file",
    "obj": {},
    "stepID": "SampleStep:data/src/song.js:demo"
}
```

**Fields:**

- `icon` — the icon name (string); use `"BEETLE"` when no icon is specified
- `logline` — a short human-readable description of the step action
- `obj` — the associated data object for this step (may be an empty object `{}`)
- `stepID` — a unique identifier for the step, typically composed of `className:topFile:step`
