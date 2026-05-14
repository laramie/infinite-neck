import { jest } from '@jest/globals';

const approvedValues = await import('../../approved-values.js');

describe('approved values', () => {
  beforeEach(() => {
    approvedValues.setApprovedValueProviders({
      getBPM: () => 120,
      getCurrentSection: () => ({ beats: 4, currentBeat: 1, caption: 'Section 1' }),
      getSectionsCurrentIndex: () => 0,
      getSong: () => ({
        sections: [{}, {}],
        graveyard: { getRecordCount: () => 0 },
        namedNoteOpacity: '1.00',
        singleNoteOpacity: '1.00',
        tinyNoteOpacity: '1.00',
        songName: 'Song'
      }),
      getRootKey: () => 'F',
      getRootKeyLead: () => 'A',
      getTransposeCaptionValue: (tokenName) => ({
        transposeCurrentInterval: '3',
        transposeCurrentOffset: '3',
        transposeOriginalOffset: '5',
        transposeOriginalRootKey: 'C',
        transposeSequenceRootKey: 'D',
        transposeFunctionSteps: '<em class="transposeProg">II</em>,<em class="transposeProg">m</em>',
        transposeDistanceSteps: '<em class="transposeProg">2</em>,<em class="transposeProg">3</em>',
        transposeFunctionDistanceSteps: '<em class="transposeProg">II+2</em>,<em class="transposeProg">m+3</em>',
        transposeProgressionFunctions: 'C<span class="transposeCaptionBox"><span class="transposeProgFunc">+II</span><span class="transposeArrow">&Rang;</span></span>D<span class="transposeCaptionBox"><span class="transposeProgFunc">+m</span><span class="transposeArrow">&Rang;</span></span>F',
        transposeProgressionDistances: 'C<span class="transposeCaptionBox"><span class="transposeProgOffset">+2</span><span class="transposeArrow">&Rang;</span></span>D<span class="transposeCaptionBox"><span class="transposeProgOffset">+3</span><span class="transposeArrow">&Rang;</span></span>F',
        transposeProgressionFunctionDistances: 'C<span class="transposeCaptionBox"><span class="transposeProgFunc">+II</span><span class="transposeProgOffset">+2</span><span class="transposeArrow">&Rang;</span></span>D<span class="transposeCaptionBox"><span class="transposeProgFunc">+m</span><span class="transposeProgOffset">+3</span><span class="transposeArrow">&Rang;</span></span>F'
      }[tokenName] || '')
    });
  });

  test('resolves general root key approved values', () => {
    expect(approvedValues.resolveApprovedValue('rootKey')).toBe('F');
    expect(approvedValues.resolveApprovedValue('rootKeyLead')).toBe('A');
  });

  test('resolves transpose caption approved values through the dedicated provider', () => {
    expect(approvedValues.resolveApprovedValue('transposeCurrentOffset')).toBe('3');
    expect(approvedValues.resolveApprovedValue('transposeProgressionFunctionDistances')).toBe('C<span class="transposeCaptionBox"><span class="transposeProgFunc">+II</span><span class="transposeProgOffset">+2</span><span class="transposeArrow">&Rang;</span></span>D<span class="transposeCaptionBox"><span class="transposeProgFunc">+m</span><span class="transposeProgOffset">+3</span><span class="transposeArrow">&Rang;</span></span>F');
  });

  test('expandApprovedTemplate interpolates general and transpose caption values', () => {
    expect(approvedValues.expandApprovedTemplate('${rootKey} ${transposeCurrentOffset} ${transposeProgressionFunctions}')).toBe('F 3 C<span class="transposeCaptionBox"><span class="transposeProgFunc">+II</span><span class="transposeArrow">&Rang;</span></span>D<span class="transposeCaptionBox"><span class="transposeProgFunc">+m</span><span class="transposeArrow">&Rang;</span></span>F');
  });
});