// Import the real function from the main codebase
import { Song } from '../../Song.js';
import { setupSongTests, getSong } from '../../infinite-neck.js';


import { logVerbose, logVerboseTrue } from './LogVerboseJest.js';



// Self-documenting rules description for help popups and test metadata
const rulesDescription = [
	{ symbol: "+n", caption: "next n sections ahead, with wrap" },
	{ symbol: "-n", caption: "previous n sections back, with wrap" },
	{ symbol: "-0", caption: "previous 0 is always current section" },
	{ symbol: "+0", caption: "next 0 is always current section" },
	{ symbol: "0", caption: "first section" },
	{ symbol: "n", caption: "Section n absolute, or last if n too large" },
	{ symbol: "@n", caption: "Last n sections ago played in Random mode" },
	{ symbol: "^n", caption: "previous n section back, no wrap, max Section 1" },
	{ symbol: "^-n", caption: "ignore sign, just do ^n" },
	{ symbol: "^+n", caption: "ignore sign, just do ^n" },
	{ symbol: "&n", caption: "n sections ahead, no wrap, max is last Section" },
	{ symbol: "&-n", caption: "ignore sign, just do &n" },
	{ symbol: "&+n", caption: "ignore sign, just do &n" },
	{ symbol: "malformed", caption: "malformed/invalid input returns current section" },
];

// Table-driven test cases for full coverage
const testCases = [
	// +n: next n sections ahead, with wrap
	{ currentIdx: 0, sAmount: "+1", expectedIdx: 1, ruleSymbol: "+n" },
	{ currentIdx: 3, sAmount: "+1", expectedIdx: 0, ruleSymbol: "+n" },
	{ currentIdx: 2, sAmount: "+2", expectedIdx: 0, ruleSymbol: "+n" },

	// -n: previous n sections back, with wrap
	{ currentIdx: 0, sAmount: "-1", expectedIdx: 3, ruleSymbol: "-n" },
	{ currentIdx: 2, sAmount: "-2", expectedIdx: 0, ruleSymbol: "-n" },

	// -0: always current section
	{ currentIdx: 2, sAmount: "-0", expectedIdx: 2, ruleSymbol: "-0" },

	// +0: always current section
	{ currentIdx: 1, sAmount: "+0", expectedIdx: 1, ruleSymbol: "+0" },

	// 0: always first section
	{ currentIdx: 3, sAmount: "0", expectedIdx: 0, ruleSymbol: "0" },

	// n: absolute, clamp to last if too large
	{ currentIdx: 1, sAmount: "2", expectedIdx: 1, ruleSymbol: "n" },
	{ currentIdx: 1, sAmount: "5", expectedIdx: 3, ruleSymbol: "n" },

	// ^n: previous n, no wrap
	{ currentIdx: 2, sAmount: "^1", expectedIdx: 1, ruleSymbol: "^n" },
	{ currentIdx: 1, sAmount: "^2", expectedIdx: 0, ruleSymbol: "^n" },

	// ^-n, ^+n: ignore sign
	{ currentIdx: 2, sAmount: "^-2", expectedIdx: 0, ruleSymbol: "^-n" },
	{ currentIdx: 2, sAmount: "^+2", expectedIdx: 0, ruleSymbol: "^+n" },

	// &n: ahead, no wrap
	{ currentIdx: 2, sAmount: "&1", expectedIdx: 3, ruleSymbol: "&n" },
	{ currentIdx: 2, sAmount: "&2", expectedIdx: 3, ruleSymbol: "&n" },

	// &-n, &+n: ignore sign
	{ currentIdx: 2, sAmount: "&-1", expectedIdx: 3, ruleSymbol: "&-n" },
	{ currentIdx: 2, sAmount: "&+1", expectedIdx: 3, ruleSymbol: "&+n" },

	// Malformed
	{ currentIdx: 1, sAmount: "foo", expectedIdx: 1, ruleSymbol: "malformed" },
	{ currentIdx: 1, sAmount: "+foo", expectedIdx: 1, ruleSymbol: "malformed" },
	{ currentIdx: 1, sAmount: "-foo", expectedIdx: 1, ruleSymbol: "malformed" },
	{ currentIdx: 1, sAmount: "", expectedIdx: 1, ruleSymbol: "malformed" },
];

// Minimal mock Song for testing getRelativeSectionWithWrap
function makeMockSong(numSections) {
	return {
		sections: Array.from({ length: numSections }, (_, i) => ({ idx: i })),
		gSectionsCurrentIndex: 0,
		getRelativeSectionWithWrap: null, // to be injected
		getCurrentSection() { return this.sections[this.gSectionsCurrentIndex]; },
	};
}



describe('Relative Section Navigation Rules', () => {
	// For help popups: export rulesDescription if needed
	test('rulesDescription is self-documenting', () => {
		expect(Array.isArray(rulesDescription)).toBe(true);
		expect(rulesDescription.find(r => r.symbol === '+n')).toBeTruthy();
	});

    const warnings_getRelSec = [];//you could log these, but just having the array means it won't console.log, so you can throw away the results, too.

	// Table-driven tests
	testCases.forEach(({ currentIdx, sAmount, expectedIdx, ruleSymbol }) => {
		const rule = rulesDescription.find(r => r.symbol === ruleSymbol);
		const ruleDesc = rule ? rule.caption : ruleSymbol;
		test(`from [${currentIdx}] by ${String(sAmount).padStart(4, ' ')}  => [${expectedIdx}] (${ruleSymbol}): ${ruleDesc}`, () => {
			// Use a real Song instance for realistic behavior
            setupSongTests();
            getSong().setHeadless(true, true/*quiet*/);
            const song = getSong();

			// Add enough sections for the test
			while (song.sections.length < 4) song.addSection(song.constructSection());
			song.gSectionsCurrentIndex = currentIdx;
			const resultSection = song.getRelativeSectionWithWrap(sAmount, warnings_getRelSec);
			const resultIdx = song.sections.indexOf(resultSection);
			expect(resultIdx).toBe(expectedIdx);
		});
	});
    if (logVerboseTrue() && warnings_getRelSec.length>0){
       logVerbose(1, warnings_getRelSec.join('\n'));
    }
});
