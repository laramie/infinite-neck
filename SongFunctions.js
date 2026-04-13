import { Song } from './Song.js';
import { Section } from './Section.js';

/** call with defaultDisplayOptions = infinite-neck:controlsToDisplayOptions() */
function getDisplayOptionsInEffect(song, currSection, defaultDisplayOptions){
    // Start at currSection and walk backwards through song.sections
    const sections = song.getSections ? song.getSections() : song.sections;
    let idx = sections.indexOf(currSection);
    if (idx === -1) {
        // currSection not found, fallback to default
        return defaultDisplayOptions;
    }
    for (let i = idx; i >= 0; i--) {
        const section = sections[i];
        if (section && section.displayOptions) {
            return section.displayOptions;
        }
    }
    return defaultDisplayOptions;
}