# Design

We need a new mechanism to do what we do in showMessages, but more like a User event log.

- keep all showMessages() and showMessagesJSON() intact
- add new path `addToUserLog(subSystem, message)`
  - message is html
- add new display div called `divUserLog`, child of `divMessageAndJsonTree`, parallel to `divMessages`, placed after `divJsonTree`
- Add TAB "User Log" `#btnUserLog` to TAB buttons, after "JSON Tree" `#btnJsonTreeTab` and before "Hide" `#btnHideMessagesJsonTree`
- extend showMessagesTab() with `divUserLog` and TAB button `#btnUserLog`
- storage is directly in table `tblUserLog` within divUserLog, appending new TR rows one per call. first column is current time 24 hour `HH:mm:ss`, second column is subSystem, third column is message.  Include TH row with these captions: "Time", "SubSystem", "Message".
- no session or song persistence.  Opening new song (unless using append* checkboxes) clears table.
- rows max at 1000.  Extras thrown away oldest first.
- alternate rows colored like #allTuningsTable
- add sibling menu item: 
/vdu `u) user log`
/vdC `C) Clear user log` clears the table, leaves TH row.
Since /vdr re-shows showMessages div, let /vdu re-show user log, because it is not cleared by other calls to addToUserLog().
- migrate recent showMessages call to using addToUserLog, wiring with a new EventBus mechanism:
  - PluginManager::raisePluginSnapshotsFromHash
- UserLog is non-disruptive.  It saves all messages sent to it, up to the 1000 row cap as described above, but doesn't show itself or pop up or change its display attributes.  The user is expected to go look with /vdu whenever they question whether an action was successful.  
- We believe that the showMessages mechanism hides/shows the whole container, and that showMessages and showMessageJSON clear out their divs, but not the structure of the container.  So divUserMessages can live on, un-cleared, and available by clicking its TAB button whenever a showMessages pops up the container.  This is OK.  The primary way in should be /vdu, but the path of having some other showMessages show the tab group should be allowed.  

