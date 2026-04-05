getRelativeSectionWithWrap(sAmount, logCollector = null) {
    const Direction = Object.freeze({
        FORWARD:         '+',
        BACKWARD:        '-',
        ABSOLUTE:        'A',
        PREVIOUS_PLAYED: '@',  // legal values for full string: "@-2" or "@2" or "@+2"
        BACKWARD_NOWRAP: '^',  // legal values: ^1 ^2  go backwards.  No minus sign.
        FORWARD_NOWRAP:  '&',  // legal value: &1 &2 go forwards. No minus signs.
        BAD_INPUT:       'X',
        EMPTY:           'E'
    });

    if (sAmount && sAmount[0]){

        // Special case: "0" means first section
        if (sAmount === "0") {
            return { section: this.sections[0], direction: Direction.ABSOLUTE };
        }
        // Special case: "+0" or "-0" means current section
        if (sAmount === "+0" || sAmount === "-0") {
            return { section: this.sections[this.gSectionsCurrentIndex], direction: Direction.ABSOLUTE };
        }
        // Extract firstChar if present
        const match = sAmount.match(/^([+\-@^&])([-+]?\d+)/);
        let firstChar = null;
        let intNum = 0;
        let isnum = false;
        if (match) {
            firstChar = match[1];
            // Try to parse the integer part
            intNum = Math.abs(parseInt(match[2], 10));
            isnum = /^[-+]?\d+$/.test(match[2]);
            if (!isnum){
                firstChar = Direction.BAD_INPUT;
            }
        } else {
            // If no special char, check for pure integer
            if (/^[-+]?\d+$/.test(sAmount)) {
                firstChar = Direction.ABSOLUTE;
                intNum = Math.abs(parseInt(sAmount, 10));  //deal with the illegal --2.
                isnum = true;
            } else {
                // Malformed input: neither special char nor integer
                firstChar = Direction.BAD_INPUT;
                intNum = 0;
                isnum = false;
                const msg = "Malformed section amount: " + sAmount;
                if (logCollector) {
                    logCollector.push(msg);
                } else {
                    console.warn(msg);
                }
            }
        }

        var currentIndex = this.gSectionsCurrentIndex;
        function wrap(oneBasedDistance, sectionsArray, currentZeroBasedIndex){
            const n = sectionsArray.length;
            const wrappedIndex = ((currentZeroBasedIndex + oneBasedDistance) % n + n) % n;
            return wrappedIndex;
        }

        if (intNum === 0){
            firstChar = Direction.BAD_INPUT;
        }

        if ((firstChar === Direction.FORWARD || firstChar === Direction.BACKWARD) && intNum === 0) {
            firstChar = Direction.ABSOLUTE;
            intNum = 1;
        }

        switch (firstChar){
            case Direction.BAD_INPUT:
                return { section: this.sections[currentIndex], direction: Direction.BAD_INPUT };
            case Direction.EMPTY:
                return { section: this.sections[currentIndex], direction: Direction.EMPTY };
            case Direction.ABSOLUTE: //(number only, goto num or max)
                if (intNum < 1) {
                    return { section: this.sections[0], direction: Direction.ABSOLUTE };
                }
                if (intNum > this.sections.length){
                    return { section: this.sections[this.sections.length-1], direction: Direction.ABSOLUTE };
                }
                return { section: this.sections[intNum-1], direction: Direction.ABSOLUTE };
            case Direction.PREVIOUS_PLAYED:  //(@) sections back in random-play history
                if (intNum < 1) {
                    return { section: this.sections[currentIndex], direction: Direction.PREVIOUS_PLAYED };
                }
                return { section: this.sections[this.getPreviousPlayedSectionIndex(intNum, currentIndex)], direction: Direction.PREVIOUS_PLAYED };
            case Direction.FORWARD: // (+)
                var wrappedIndex = wrap(intNum, this.sections, currentIndex);
                return { section: this.sections[wrappedIndex], direction: Direction.FORWARD };
            case Direction.BACKWARD: //(-)
                var wrappedIndex = wrap( -1 * intNum, this.sections, currentIndex);
                return { section: this.sections[wrappedIndex], direction: Direction.BACKWARD };
            case Direction.BACKWARD_NOWRAP:  //(^)
                return { section: this.sections[Math.max(0, (currentIndex - Math.abs(intNum)))], direction: Direction.BACKWARD_NOWRAP };
            case Direction.FORWARD_NOWRAP:   //(&)
                var idx = (currentIndex + Math.abs(intNum))
                var maxidx = this.sections.length-1;
                return { section: this.sections[(idx > maxidx) ? maxidx : idx], direction: Direction.FORWARD_NOWRAP };
        }
    } else {
        // If sAmount is empty or falsy, return current section with EMPTY direction
        return { section: this.getCurrentSection(), direction: Direction.EMPTY };
    }
}