# Notes

1) Bookmarks should be an array as well.  If restart-tutorial is needed, use last-bookmarked-section.  Idea is bookmarks should allow User to mark zero-to-many Sections for revisiting.

2) plan says: "Strict default visible surfaces should include: topLogoMenuBar, or equivalent stable top logo area".  Not sure this is correct: we may want logo in tutorial widget row left if we can make it small and stylish. We certainly don't want it consuming a whole row, and in strict mode there are no menu buttons.  And we don't want the hamburger.  Logo also appears in bottomStrip.

3) Edit/Revise this: 
```
Keyboard behavior
  Strict mode keyboard defaults:
    ArrowRight or n: next Section
    ArrowLeft or p: previous Section
    Home: first Section
    End: last Section
    Space: tutorial loop toggle or design-confirmed default
    Escape: stop transient UI/loop, not exit tutorial
```

4) Confirm that plan suggestion for splash as separate template is correct.  Should be independent of tutorial.

5) splash screen animation is in `img/splash-screen-animation.gif`