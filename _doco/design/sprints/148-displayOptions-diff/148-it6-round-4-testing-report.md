# Test Recipes 31-36

31. Blank Song, set width 140, open a Song with Song-DEFAULTS sizes, Presentation off, no Prefs: sizes become the Song-DEFAULTS.  Navigate: they stay (B).
- RESULT: PASS

32. Same, with Prefs saved: Prefs win.  Clear Prefs, reopen: Song-DEFAULTS win.
- RESULT: PASS

33. Presentation on, Section 1 stores sizes: Section 1's value wins over Prefs and Song-DEFAULTS.  Navigate to a Section without a cell: the previous Section's value (cascade).
- RESULT: PASS

34. Presentation on, nothing stored: Prefs (or LIVE) remain.
- RESULT: PASS

35. Song without sizes in Song-DEFAULTS, Presentation off, no Prefs: LIVE kept across the open.
- RESULT: PASS

36. Open via File Open, Library and `?song=`: same result for each.
- RESULT: PASS


Suite passes.

