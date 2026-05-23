We think these are consistent with keeping action handlers, while also keeping the authored menu.js concrete.

Below we provide examples, one for an existing action, one for song restart, which is a remapped action, and two for song resets, which are new actions.

menu.js fragment:

```
{
"caption": "<b>l</b>ast section",
"trigger": "l",
"action": "mapSpacebar_lastSection"        
},
{
"caption": "<b>R</b>estart song",
"trigger": "R",
"action": "mapSpacebar_restartSong"        
},
{
"caption": "<b>z</b> reset song",
"trigger": "z",
"action": "mapSpacebar_resetSong"        
},
{
"caption": "<b>Z</b> reset song hard",
"trigger": "Z",
"action": "mapSpacebar_resetSongHard"        
}
```

key-handlers.js::performCmdAction fragment:
```
case "mapSpacebar_lastSection":
			spacebarActionName = "lastSection";
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
case "mapSpacebar_restartSong":
			spacebarActionName = "firstSection";
			actionResult.result = `spacebar mapped: restartSong using ${spacebarActionName}`;
			break;
case "mapSpacebar_resetSong":
			spacebarActionName = "resetSong";
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
case "mapSpacebar_resetSongHard":
			spacebarActionName = "resetSongHard";
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
case "resetSong":
            resetSong();  // or code defined by implementation of this sprint.
			actionResult.result = `reset song`;
			break;            
case "resetSongHard":
            resetSongHard(); // or code defined by implementation of this sprint.
			actionResult.result = `reset song (hard)`;
			break;            
```

