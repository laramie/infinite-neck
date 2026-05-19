# Transport Navigation Table

- This version should be true after map-spacebar-implementation-plan-3.md is implemented.

| navigation | avail | Key | menu | action | UI | notes |
| --- | --- | --- | --- | --- | --- | --- |
| LoopSong | 🗹 | l | /rl | toggleLoopSections | #transport:btnLoopSections | LoopSong is internally called LoopSections |
| SectionBegin | 🗹| | /rbf | gotoFirstBeat| | gotoFirstBeat of currentSection. works for sections[0] when btnPrevSection or btnFirstSection |
| FirstBeat |🗹 | |/rbf | gotoFirstBeat | |  |
| FirstSection | 🗹 | < | /rsf | firstSection | #transport:btnFirstSection | |
| PrevBeat | 🗹 | b | /rbp | prevBeat | #transport:btnPrevBeat | |
| NextBeat | 🗹| | /rbn | nextBeat | #transport:btnNextBeat | |
| LastBeat | 🗹| | /rbl | gotoLastBeat |  | |
| PrevSection | 🗹 | , | /rsp | prevSection | #transport:btnPrevSection | |
| NextSection | 🗹 | . | /rsn | nextSection | #transport:btnNextSection | |
| LastSection | 🗹 | > | /rsl | lastSection | #transport:btnLastSection | first beat of last section |
| LoopBeats | 🗹 | | /re | toggleLoopBeats | #transport:btnLoopBeats | |
| RestartSection |🗹 | | /rbf | gotoFirstBeat | | go to first beat of currentSection |
| RestartSong | 🗹 | < | /rs0 | firstSection | #transport:FirstSection | FirstSection works, but not dedicated |
| ResetSong | 🗹 |  | /rsr | resetSong |  | returns to first section / first beat and preserves active loop mode |
| ResetSongHard | 🗹 |  | /rsR | resetSongHard |  | returns to first section / first beat with hard reset semantics and preserves active loop mode |
| LastBeatInSong | 🗹| | /rsL | gotoLastBeatInSong | | gotoLastBeatInSong, allows loop to pass OnSongEnd |
