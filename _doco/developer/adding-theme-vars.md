# Here is how to add something to DisplayOptions:

## Follow an existing example

Search case-insensitive for this stub: `tinyNoteFontSize`

This reveals the following instances for DisplayOptions:
```
infinite-neck.js:
  $("#selTinyNoteFontSize").val(options.tinyNoteFontSize);

  setOneCssVar("--tiny-note-font-size",  $("#selTinyNoteFontSize").val());

  options.tinyNoteFontSize = $("#selTinyNoteFontSize").val();
		
  bindEvent('change', '#selTinyNoteFontSize', function(){
    setOneCssVar("--tiny-note-font-size", $("#selTinyNoteFontSize").val());
    fullRepaint();
  });  

index.html:
  <select id="selTinyNoteFontSize">
```

----

# For Themes

Say you have a color: `#56fa00`
- And you wan to theme it to 
  - `--single-note-shadow-color`
- and use it like this:      
  - `box-shadow: 0 0 3pt 3pt var(--single-note-shadow-color), 0 0 0 1pt black;`
- Create your new stub:
  - singleNoteShadowColor  

For Themes, it is a bit different than for DisplayOptions.

## Follow a themes example

Search for `noteWhiteShadowColor`

This reveals the following instances for Themes:
```
themeFunctions.js:

    in setThemeControlValues():

        setVal('#dropDownNoteWhiteShadowColor', 'noteWhiteShadowColor');

    in controlsToTheme()::overwriteDefaultWithControlValue():

        options.noteWhiteShadowColor = $('#dropDownNoteWhiteShadowColor').val();

    in auditThemes()::auditThemesShowOptions():

        showOptions('#dropDownNoteWhiteShadowColor', 'noteWhiteShadowColor');

    in theme():

        +rule("--note-white-shadow-color", "noteWhiteShadowColor")

        
templates/themes.html:

    <select id="dropDownNoteWhiteShadowColor">
```


```
your new stub: singleNoteShadowColor 
your new var:  --single-note-shadow-color

Replace in all the example locations above.

ensure controls is in themes.html: 
    dropDownSingleNoteShadowColor

Add to default theme in themes.js: 
    "singleNoteShadowColor": "#56fa00",
        

Use it in infinite-neck.js:

:root {
   /* These are required by the theme() call in infinite-neck.js */
   ....
   box-shadow: 0 0 3pt 3pt var(--single-note-shadow-color), 0 0 0 1pt black;
   ....
}
```


		
