# Button caption tweak

We'd like the write button to have the following change: 

Use `§${CurrentSectionOneBasedNumber} -> Song-DEFAULTS` for the caption for `#btnCurrentSectionToSongDisplayOptions` where pseudo-code CurrentSectionOneBasedNumber is the correct calculation for the select row and Current Section, one-based.

We tend to use `&sect;` in the codebase. If it is better to use the resolved unicode character `§`, that is fine.

If there is a portable arrow character that won't throw the height of the button off, that would be better than `->`.