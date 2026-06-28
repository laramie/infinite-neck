# Design Request

sprint: 129-graveyard-plugin-menu

For all plugins, we'd like to restructure `B) Bury` into a new sub-menu:
  - move `B) Bury` into graveyard menu-item: `g) graveyard`, which brings up submenu, for all plugins.
    - within `g) graveyard`:
    - add `b) bury (save+clear)`
    - add `r) raise`
    - add `s) save` // same as old Bury but no clear and reset
    - add `l) link` // adds link to end of "Info" as `#raise=transpose.MyPluginSettings` hyperlink
  - handle hyperlink by keeping song and URL, but performing `raise`
  - handle "superlink" with: `#raise=transpose.MyPluginSettings,ArpeggioPlugin.MyArpeggioPositionSettings`
    - `r) raise` brings up sub-menu which offers list of most recent 9 Graveyard records for this plugin: `1) MyTransposeSettings1 2) MyTransposeSettings2` as saved by User in Graveyard with User-supplied names `MyTransposeSettings1` and so on.
  
Please draft implementation plan in 129-graveyard-plugin-menu/129-implementation-plan.md with plan and any questions or design holes we need to answer before any coding begins.

# Answers to Questions in implementation plan

## New Menu Structure

First, let's address the menu structure.  Replacing the current `B) Bury` action will be a sub-menu menu-item 
that will take us to a whole sub-menu of `g) graveyard` actions.  All current plugins have been checked, and none have a `g` trigger at the plugin menu level.  All the other triggers and actions are on the sub-menu below `g) graveyard`.  So here is the proposed menu structure all plugins will inherit, shown here for transpose `/fpt` with whitespace indentation showing menu level and triggers `t` shown as `t) caption` : 

```
/fpt
    E) Enable
    L) Load enabled
    g) graveyard
        b) bury (save+clear)
        r) raise
        s) save
        l) link
    A) Apply
    R) Reset
    ....    
```
So bury, raise, save, and link are not under /fpt, but are in new sub-menu /fptg

## URI fragment handling

The intention is to use URI fragments, so that the current URL and query string of the application need not be modified, and the browser has no excuse to refresh or re-fetch from the server. 

On load, these do *not* need to be consulted, although the User could type them into the URL.  That is not the use-case we are handling here.  That use-case is not specifically supported, although it should not break anything.  The plugins were designed with the `Load enabled` flag so that songfiles could make sure the plugins had state and were enabled at song load if desired.  So we don't want to override that.  What we want is to support one song that has multiple plugin configurations ready to go and be chosen without having to load a new song.  Prime use case: All-Chords.json needs to be rewritten, but it will support having n Sections of n chords in the key of A, and TransposePlugin and ArpeggioPlugin settings that move all the chords through the cycle of 12 note names.  However, the User may only want to do a realistic song progression, e.g I-IV-V or transpose chroma of [0,5,7], rather than all 12 chroma.  Also, if the User has selected ArpeggioPlugin::style:bach, that pattern stops at one octave, and so it would be best to select 4 strings of a 6-string guitar.  So the User will want to practice bottom-4, middle-4, and top-4 string configurations, but they don't want to load new songs to do it, and we don't want to maintain an explosion of variants.  Having URI fragment links in the Info page for AllChords.json solves this. 

## Answers to numbered questions


1. **Should `s) save` run `beforeBury()`?**
	 - Current `beforeBury()` was designed for save+clear. For Transpose, it may warn about generated state. Should save-only share that warning, or should plugins get a new `beforeSaveSnapshot()` hook?

ANSWER: There's no clear, so there should be no warning.  The menu structure should still prompt for the name, which the User can fill in.

2. **Should `s) save` stop looping?**
	 - Current snapshot path stops looping unless `skipLoopStop` is true. For save-only, stopping loops may be surprising. Recommendation: save-only should not stop looping unless a plugin-specific hook requests it.

ANSWER: Approve the recommendation--allow looping to continue.  The real surprise is that TransposePlugin mid-transpose chroma series, state of *song* is funny.  But here we are just talking about plugin state, which is the state of the plugin options, and plugins like TransposePlugin are not supposed to store their runtime helper state.

3. **Should `l) link` save first if no Graveyard record exists?**
	 - Options:
		 - Link only; warn if no matching snapshot.
		 - Save then link.
		 - Ask/confirm.  
	 Recommendation: link only in first implementation; add a result warning if target is missing.

ANSWER: Good catch!  Yes, enter similar flow to `s) save` and prompt for name (default 'USER'), then create link.

4. **Where exactly is song Info stored and in what format?**
	 - Need inspect [templates/info/info.builder.js](templates/info/info.builder.js) and Song info persistence before implementing link insertion.

ANSWER: Create link as formatted html `a` anchor tag element hyperlink, and append with newline at end of html text of `Song.info` escaped as necessary, so the user can edit it or see it in the rendered result on the Info page.  

```
\n<br>Raise plugin state: <a href="#raise=transpose.USER">transpose.USER</a>
\n<br>Raise plugin state: <a href="#raise=transpose.USER">transpose.MySettings1</a>
```

Add newline and `<br>` tag so they live on their own line, and multiple `l) link` invocations create a list.

We need to relax the stricture against putting `a` anchor tags in `Info` when the destination is a URI fragment, and  not a full URL, so support this: `#raise=transpose.USER,raise=arpeggio.MySettings2` but not this: `http://example.com#raise=foo`

5. **Duplicate links in Info:**
	 - Should `l) link` append duplicates, replace existing same fragment, or no-op if already present? Recommendation: no-op with result “link already present”.

ANSWER:  Keep appending links, even if they are duplicates.  For the intermediate User, this will be a list of links on separate lines they can click in the rendered Info page.  For the advanced User, this will be an opportunity to create a superlink by editing the lines together with html editing and the comma operator, or preserving them as a list of separate plugin settings.  The action should always append on a newline at the end of the text, so whatever else they have in Info about their song is preserved.  And if they have made notes about the links, that is also preserved because we are always appending at the end.

6. **Raise submenu duplicate records:**
	 - `replaceGraveyardRecord()` currently replaces by plugin/userKey if `buryReplacing` is available, so duplicates should be rare. Imported older files may contain duplicates. Recommendation: newest matching record wins.

ANSWER: Accept Recommendation: newest matching record wins.

7. **Raise-by-menu should update `lastRevived`?**
	 - Calling `importPluginSnapshot()` directly will not automatically update the Graveyard record. Calling `graveyard.raise(index)` does. Recommendation: update `lastRevived` in `raisePluginSnapshotByGraveyardIndex()` for consistency.

ANSWER: Accept Recommendation: update `lastRevived` in `raisePluginSnapshotByGraveyardIndex()`. 

8. **Superlink failure mode:**
	 - If one snapshot in a superlink is missing, should subsequent snapshots still raise? Recommendation: continue, collect per-item results, and show a summary.

ANSWER: Yes, continue, collect, and show summary in showMessages.

9. **Superlink ordering:**
	 - Apply left-to-right as listed in URL. This matters if plugins depend on each other.

ANSWER: Accept specification: Apply left-to-right as listed in URL 

10. **Fragment syntax escaping:**
		- User keys may contain punctuation. Need URL encoding for generated links and URL decoding in parser. Need decide whether `.` is forbidden in plugin IDs/user keys or split on first dot only. Recommendation: split on first dot and URL-encode user keys.

ANSWER: We see that today we can create Bury userKey as a regular string with punctuation.  This should be tightened for all plugins to be identifiers: alphanumeric, plus `-`, plus `_`, not starting with a digit.  Whereupon this means `.` and `,` and `=` and `#` are available for reserved use as fragment delimeters, and we should not need to URL-encode the keys.

11. **Plugin id vs registered name in examples:**
		- Requirement examples use `transpose.MyPluginSettings` and `ArpeggioPlugin.MyArpeggioPositionSettings`. Current plugin IDs appear lowercase like `transpose`, `arpeggio`, `clip`, etc. Need decide whether links use plugin id only or accept registered names/aliases. Recommendation: generate plugin id links; parser may optionally resolve registered names as aliases.

ANSWER: Graveyard uses short lowercase names for pluginId.  We should use these.  It was a typo for us to suggest `ArpeggioPlugin`.  We should have suggested `transpose`, `arpeggio` and so on.  

12. **Menu trigger conflict:**
		- Managed plugin menus may already have plugin-specific `g`, `b`, `r`, `s`, `l` triggers at the same level. Nesting under `g) graveyard` reduces conflict for inner triggers, but `g` itself could conflict. Need verify current plugins. If conflict exists, pick another trigger or add conflict handling.

ANSWER: See discussion above about new menu structure.  `g` is available everywhere `B` is at the first plugin menu level.  After that, we are inside the `g) graveyard` sub-menu, so `b`, `r`, `s`, `l` are available.

13. **Existing Graveyard table raise links:**
		- The global Graveyard table already provides `raise` links in [graveyard.js](graveyard.js). Should plugin Graveyard menu use the same backend and result messages? Recommendation: share backend helpers but keep menu-specific display.

ANSWER: Yes, the intention is that the menu is a wrapper around the existing graveyard raise links.

14. **Should `raise` auto-bury current state?**
		- Current `importPluginSnapshot()` auto-buries current plugin state if it is persistable. Requirement says raise should perform `raise`; likely yes. Confirm that this is desired for menu raise and URL raise.

ANSWER: Yes, again, wrapping and continuing with how this works today.  So do auto-bury.

## A note about testing

We have become aware of test cases that test the dynamic and static menu structure.  These are too brittle for us, because the purpose of having menu.js and the properties.json files in the plugins is so we can change menus with configuration.  Having the tests hardcode the menu structure defeats this.  We are in the process of removing them every time we break one rather than fixing them. So please don't write any new ones.  We prefer to test the menus with User Acceptance testing, since we need to go through every menu item anyway.

# Review of revised implementation plan

## no support for pluginAction:bury

With the implementation plan discussion: 
```
Backward compatibility
The old pluginAction:bury should remain supported internally for tests or old menu snapshots, but no longer be emitted by current managed plugin menus.

Recommended compatibility mapping:
....
```
Our request: 
  - do not support old snapshots
  - do not support old tests.  Remove tests if you can find them.
  - do not add compatibility mapping.

## action sub-actions

With: 
```text
pluginAction:graveyard
graveyardAction: 'bury' | 'save' | 'raise' | 'link'
```
... if the proposal is done elsewhere in the plugins, the sub-actions are approved.  If, however, this is a novel approach, use whatever other plugins have done for dynamic sub-menu actions.

## Coding Approval

With the two caveat sections above regarding pluginAction:bury, and action sub-actions, coding is approved for the plugins and the PluginManager and other plumbing changes as needed.


