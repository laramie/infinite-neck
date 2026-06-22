# 133 Analysis 1: Arpeggio random + flashcard (current behavior)

This note answers the request in [133-design.md](_doco/design/sprints/133-name-that-note/133-design.md):
- summarize what random is doing now
- discuss what would need to change for name-that-note behavior
- list the design answers needed before implementation planning

## Brief summary of random today

Current random behavior is implemented in [ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js):

1. Random builds a per-application shuffled cycle from unique positions.
- Candidate notes are deduped by string/fret position.
- A random shuffle is built by repeated splice using Math.random.
- The beat sequence is then filled by repeating that shuffled cycle.
- Relevant methods: expandCandidateSequence -> expandRandomSequence -> dedupeCandidatesByPosition.

2. Random explicitly ignores lowToHigh and upOnly.
- This is documented in plugin help text and verified by tests.
- Relevant tests: [arpeggio-plugin.test.js](_tests/jest/arpeggio-plugin.test.js).

3. Sequence generation is not persistent runtime state.
- On section-begin/apply paths, Arpeggio regenerates recorded notes for the section beat range.
- On SongUiShowBeats, Arpeggio recomputes a fresh sequence again for note-name display sync.

## Why this can look "funny" in flashcard+random

The flashcard reveal logic (previous beat reveal, and special handling for last beat) depends on the sequence passed into named-note display payload builders.

In non-random styles, sequence recomputation is deterministic, so this is stable.

In random style, recomputation can produce a different ordering on each refresh call. That creates a mismatch risk:
- beat N highlight came from one random sequence realization
- beat N+1 flashcard reveal may use a newly generated sequence realization
- result: the revealed note can be a different cell than the previously highlighted cell

This is the core behavior gap for name-that-note.

## Analysis of what needs to change (not implementation plan)

To support the desired behavior (show random highlight, then reveal that exact prior cell), random needs a stable "active sequence identity" across beat refreshes within the same section play window.

At analysis level, this implies three separations:

1. Sequence lifecycle definition
- Define when a random sequence is created.
- Define when it is reused.
- Define when it is invalidated and rebuilt.

2. Playback vs display coupling
- Highlight source and flashcard reveal source must reference the same sequence instance.
- SongUiShowBeats should not independently generate a new random order for display-only updates.

3. Scope of randomization
- Clarify whether randomization unit is:
  - one section pass,
  - one song loop,
  - one position-pair window,
  - or another explicit scope.

## Key design answers needed before meaningful implementation planning

The following answers will determine implementation shape and test strategy:

1. Random persistence scope
- Should random order persist for the entire current section pass only?
- Should it persist across section restarts while loop remains active?
- Should it persist across song loops, or reset at each song loop boundary?

2. Interaction with positions and song loops per position
- When positions rotate (based on songLoopsPerPositionPair), should random order reset immediately for the new position window?
- If user edits positions live, should current random sequence be preserved until boundary, or rebuilt immediately?

3. Coverage behavior when beats exceed candidate count
- After exhausting unique candidates, should behavior:
  - repeat the same shuffled cycle, or
  - reshuffle for the next cycle?
- Current behavior repeats same cycle for the generated sequence call, but this needs explicit product intent for name-that-note drills.

4. Flashcard reveal policy on boundaries
- On beat 1, should reveal always be empty?
- On last beat of section, should reveal include both previous and current (current behavior), or strictly previous only for strict flashcard cadence?
- On loop wrap and restart, what should first visible reveal be?

5. Determinism controls for practice reproducibility
- Is a deterministic seed desired per section/song/session for reproducible drills?
- Or should each session be non-deterministic by default?

6. Cross-event ownership and cache invalidation
- Which events should invalidate active random sequence:
  - OnSectionBegin
  - OnSongEnd
  - OnResetSong
  - target table change
  - min/max fret or string range change
  - style/type/showNoteName/flashcard toggles

7. SingleNote source constraints
- For type=SingleNote training mode, if candidate set is tiny (1-2 notes), should random avoid immediate repeats beyond existing dedupe behavior?
- Is there a minimum-candidate warning desired in UserLog for practice quality?

## Test implications to keep in mind

Current tests cover random ordering behavior and flashcard behavior independently, but there is no contract test yet for flashcard+random cell continuity between highlighted beat N and revealed beat N+1.

For sprint 133, that combined contract is the critical behavior to lock.

## Bottom line

Random today is a shuffle-and-repeat sequence generator, but it is effectively rebuilt in multiple runtime paths. Flashcard reveal currently assumes sequence stability across beat updates. In random mode that assumption can fail, producing the mismatch you described.

The next analysis artifact can turn the design answers above into a concrete, low-risk implementation proposal and test matrix once product intent is confirmed for scope/reset semantics.
