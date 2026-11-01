In `buildCellsFromSelectorconst cachedHtml = NoteTableRenderCache.getHtml(renderCacheEntry, noteClass, midinum);
` we see the cache being used: 
```
            cell.html(cachedHtml || cellBuilder(noteLetter, sharpflat, noteNum, options, midinum));

```

However, we need to be able to see how the breakdown of timing actually pans out.

So we need:
1) instructions for how to instrument this console's output, or read it better.
2) instructions for what to look for in chrome developer tools Performance tab.
3) a code analysis to see if we are caching the right things and if the cache count is working.

When we think at the highest level:
1) visual UI testing shows that playing the first beat in a changed Section while looping is the most delayed.
2) the highest timing culprit from DevTools timing is `buildCellsFromSelector`.
3) Logically, let us say this song has three sections. If what makes the cache hit is really Song.rootID, Song.rootIDLead, Song.sharps, then on looping the song, if the cache were big enough for these three sections to be in cache, then the note table should be built, it's key, sharps, and functions thus determining all the text: Note Name, Note Function, Accidental.  Everything else is classes to toggle during replay: .Active and so on.  So we don't expect the caching strategy to accept any .html() or .text() writes.  We'd expect whole tables to be cached, and a top layer to catch the TD.note clicks.

Please provide analysis and proposed caching measurement strategies, and other caching choices that can keep a limited number of rootID-rootIDLead-sharps cache-keys.

This is investigation, no coding.

