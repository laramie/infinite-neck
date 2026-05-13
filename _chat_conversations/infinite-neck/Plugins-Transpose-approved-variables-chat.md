OK, we have simplified the needed values.

You said they would be in these tokens:

plugin:transpose:currentInterval
plugin:transpose:currentOffset
plugin:transpose:originalOffset

So here's what we need, in one use-case with concrete rootKeys:

The Section was originally in C, with originalOffset 0.

The Section was transposed 2 semitones because of currentInterval. The currentInterval is 2.  The Section rootKey is now D.

The User stopped the looper, then entered TransposePlugin intervals [0,3], then resumed looping or hit Apply, so that the TransposePlugin has applied interval 3, and begun to think that it is operating from rootKey D, but of course it remembers originalOffset internally.

The Section rootKey is now F, the currentInterval is 3, the currentOffset is 3, the originalOffset is now 5.  

The string we want depends on a new concept called here "format".  We won't use this in code, just for this discussion. "format" has parallels to (but not a live lookup to) "Function Symbols". The most useful of these is "Function+Offset" which has values like "IV+5" and "V+7".  

These names are properly shown in HTML entities in: 

     Constants.FUNCTION_OFFSETS = ["I+0","τ+1","II+2","m+3","III+4","IV+5","Θ+6","V+7","σ+8","6+9","δ+10","Δ+11"]

To keep from getting confused with the word "offset", here let's call it "Function+distance" where "distance" is the integer value of the semitone offset.  Now we need to translate that into value tokens/primatives.  

So a complex set of secondary values built on these primitives/tokens would give us the answers we need:

```
"format": "Function+distance"
  "token": "transposeProgFunctionDistances"
  "value": "C«II+2»D«m+3»F"
  
"format": "Function"
  "token": "transposeProgFunctions"
  "value": "C«II»D«m»F"
  
"format": "distance"
  "token": "transposeProgDistances"
  "value": "C«2»D«3»F"

"token": "transposeFunctionDistances"
  "value": "«II»,«m»"

"token": "transposeDistances"
  "value": "«2»,«3»"

"token": "transposeTotalDistance"
  "value": "«5»"  
```

For all of these, « would be emitted as:
  `<em class="transposeProg">`
and » would be emitted as:
  `</em>`

The primitives/tokens would be: 

```
"token": "transposeCurrentOffset"
  "value": "3"

"token": "transposeOriginalOffset"
  "value": "2"

"token": "transposeTotalOffset"
  "value": "5"

"token": "transposeCurrentInterval"
  "value": one of: "0", "5", "7" depending on state.  

"token": "transposeOriginalRootKey"
  "value": "C"

"token": "transposeOffsetRootKey"
  "value": "D"

```

We *don't* need the final, logical value, because it is already called Section.rootKey:
```
"token"; "transposeCurrentRootKey"
  "value": "F"  
```
So since these are missing today and not currently promoted to approved variables, they should now instead be always available as ${rootKey} etc:
```
"token": "rootKey"
  "value": "F"
"token": "rootKeyLead"
  "value": "F"  (but could be different if rootIDLead were not -1)


All of these depend on the state of the plugin.  I think they would only be reported as non-empty strings when plugin is "enabled":true. So even if transposition has happened, but "enabled":false, then the strings should be empty, because with the plugin not moving things around, they are where they are because rootID is in the Section already and nothing is happening because of the plugin.  Also, if no tranposition has happened yet, then the offset/distance strings should also expand as empty strings, I think.

Section constructor sets rootID and rootID lead, and infinite-neck ensures at least one Section, so I don't think we need to deal with cases where Section is not defined or doesn't have valid rootID or rootIDLead, even if rootIDLead is -1. (There could be a corrupt songfile--normal processing such as empty string, "null" or "undefined" as strings would be fine, and presumably would happen today, or maybe prevent song from loading in case of severe JSON error, which we'll deal with elsewhere.)

I think this boils this down to TransposePlugin implementing a single function that is called that takes the token name and returns the value, wrapped in the em HTML tags if specified above.

Please provide updated analysis of our use case and its implications for an implementation plan for just providing these tokens to be available for expansion in captions.  No code changes yet.
