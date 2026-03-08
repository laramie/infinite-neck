# Feature Accumulator LogStep

## Step.level

Allowed values: `debug`, `info`, `warn`, `error` (default: `info`)

## StepID Definition

The `stepID` definition is a dotted hierarchy encoding phase and nesting. Examples include:
- `Generator`
- `Generator.interfaces`
- `Generator.interfaces.ISong`

This structure supports reconstructing a tree while keeping logStep atomic/linear.

## StepAccumulator

`StepAccumulator` is a decorator over the singleton `Accumulator`, owning a stack of `stepID`s with the following methods:
- `pushStepID`
- `popStepID`
- `withStepID`
- `currentStepID`

`StepAccumulator` sets the `stepID` from `currentStepID` when it is unset.

## Minimal Step JSON Example

```json
{
  "stepID": "Generator.interfaces.ISong",
  "icon": "FILEACCESS",
  "level": "info",
  "logline": "read file bin/namespacer/Emoji.js",
  "obj": {
    "path": "bin/namespacer/Emoji.js",
    "bytes": 2004
  }
}
```

## Fields List Update

- `level`
- Revised `stepID` semantics
