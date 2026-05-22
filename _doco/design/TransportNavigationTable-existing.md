# Transport Navigation Table

| navigation | avail | Key | menu | action | UI | notes |
| --- | --- | --- | --- | --- | --- | --- |
| LoopSong | 🗹 | l | /rl | toggleLoopSections | #transport:btnLoopSections | LoopSong is internally called LoopSections |
| SectionBegin | | | | **gotoFirstBeat**| | gotoFirstBeat of currentSection. works for sections[0] when btnPrevSection or btnFirstSection |
| FirstBeat | | | | **gotoFirstBeat** | |  |
| FirstSection | 🗹 | < | /rsf | firstSection | #transport:btnFirstSection | |
| PrevBeat | 🗹 | b | /rbp | prevBeat | #transport:btnPrevBeat | |
| NextBeat | | | /rbn | nextBeat | #transport:btnNextBeat | |
| LastBeat | | |  | **gotoLastBeat** |  | |
| PrevSection | 🗹 | , | /rsp | prevSection | #transport:btnPrevSection | |
| NextSection | 🗹 | . | /rsn | nextSection | #transport:btnNextSection | |
| LastSection | 🗹 | > | /rsl | lastSection | #transport:btnLastSection | first beat of last section |
| LastBeatInSong |  |  |  | **gotoLastBeatInSong** |  | last beat of last section|
| LoopBeats | 🗹 | | /re | toggleLoopBeats | #transport:btnLoopBeats | |
| RestartSection | | |  | **gotoFirstBeat** | | go to first beat of currentSection |
| RestartSong | 🗹 | < | /rsf | firstSection | #transport:FirstSection | FirstSection works, but not dedicated |
| LastSongBeat | | | | **gotoLastBeatInSong** | | gotoLastBeatInSong, allows loop to pass OnSongEnd |

- Items in action column formatted with asterisks, like **gotoFirstBeat** are not yet implemented in key-handler.js