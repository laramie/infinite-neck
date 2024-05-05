function toInt(str, def){
    if (!str) return def;
    if (str.length==0) return def;
    var res = parseInt(str);
    if (isNaN(res)) return def;
    return res;
}

//======= Hex Utils ======


	function invertColor(hex, bw) {
	    if (hex.indexOf('#') === 0) {
	        hex = hex.slice(1);
	    }
	    // convert 3-digit hex to 6-digits.
	    if (hex.length === 3) {
	        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
	    }
	    if (hex.length !== 6) {
	        throw new Error('Invalid HEX color.');
	    }
	    var r = parseInt(hex.slice(0, 2), 16),
	        g = parseInt(hex.slice(2, 4), 16),
	        b = parseInt(hex.slice(4, 6), 16);
	    if (bw) {
	        // https://stackoverflow.com/a/3943023/112731
	        return (r * 0.299 + g * 0.587 + b * 0.114) > 186
	            ? '#000000'
	            : '#FFFFFF';
	    }
	    // invert color components
	    r = (255 - r).toString(16);
	    g = (255 - g).toString(16);
	    b = (255 - b).toString(16);
	    // pad each with zeros and return
	    return "#" + padZero(r) + padZero(g) + padZero(b);
	}
	function padZero(str, len) {
	    len = len || 2;
	    var zeros = new Array(len).join('0');
	    return (zeros + str).slice(-len);
	}


	function convertRGB_to_HEX(rgb) {
        if (/^#[0-9A-F]{6}$/i.test(rgb)) return rgb;

        rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);

        function hexCode(i) {
            return ("0" + parseInt(i).toString(16)).slice(-2);
        }
        return "#" + hexCode(rgb[1]) + hexCode(rgb[2])
                + hexCode(rgb[3]);
    }

    /* this was an experiment to see if I could just alpha out the background-color, thus
     * leaving the fonts at full opactiy.  The colors were just as lackluster as changing the
     * opacity for everything, and then the fonts stood out *too* much, so the NamedNotes
     * weren't more subtle than, say, SingleNotes with 100% opacity.  So I'm ditching it
     * but leaving it here because it documents how to deal with alpha chanel.  This works
     * because the browser (Chrome) seems to report opacity as rgb() anyway.
     * Usage: queryNamedNotesSetBGOpacity("0.2");  then do a fullRepaint() or somesuch.
     */
    function queryNamedNotesSetBGOpacity(sOpacity){
        $('div.namedNote').each(function(i, el){
            var a = $(el);
            if (!a.parent("div").hasClass("NoteActive")){
                return;
            }
            a.css('opacity', '1.0');
            var bgColor = a.css('background-color');
            console.log("bgColor: "+bgColor);

            var rgb = bgColor.match(/[.?\d]+/g);
            var bg;
            if (rgb.length == 4){
                console.log("found 4: "+rgb[3]);
                bg = 'rgba('+rgb[0]+', '+rgb[1]+', '+rgb[2]+', '+sOpacity+')';
            } else if (rgb.length == 3){
                bg = 'rgba('+rgb[0]+', '+rgb[1]+', '+rgb[2]+', '+sOpacity+')';
            }
            console.log("bgColor after: "+bg);

            a.css('background-color', bg);
        });
    }



//======= UI utils ========

function scrollToTop() {
    $(window).scrollTop(0);
}
