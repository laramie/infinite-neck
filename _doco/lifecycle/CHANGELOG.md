# ChangeLog

### 20260319

Added version info to the menu in /fv that simply returns a result which can be seen in the dropdown of menu command results, and /fV (that's a capital V) for a more verbose message that shows up in Show Messages. Added external help file link for README.md

Added the supporting version stuff which runs version-update.js as part of manual pushing of a version. Added version.json, and version-read.js, and a block of code in infinite-neck.js that exports getVersionString from the async call to fetch version.json.