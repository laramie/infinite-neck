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
      }[tokenName] || ''),
      getArpeggioCaptionValue: (tokenName) => ({
        arpeggioPositionsStatus: '<span class="arpeggioPositionsStatus"><table><tr><td>0</td><td>3</td><td class="arpeggioCurrentPositionPair">4</td><td class="arpeggioCurrentPositionPair">7</td></tr></table></span>'
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
    expect(approvedValues.resolveApprovedValue('arpeggioPositionsStatus')).toBe('<span class="arpeggioPositionsStatus"><table><tr><td>0</td><td>3</td><td class="arpeggioCurrentPositionPair">4</td><td class="arpeggioCurrentPositionPair">7</td></tr></table></span>');
  });

  test('expandApprovedTemplate interpolates general and transpose caption values', () => {
    expect(approvedValues.expandApprovedTemplate('${arpeggioPositionsStatus} ${rootKey} ${transposeCurrentOffset} ${transposeProgressionFunctions}')).toBe('<span class="arpeggioPositionsStatus"><table><tr><td>0</td><td>3</td><td class="arpeggioCurrentPositionPair">4</td><td class="arpeggioCurrentPositionPair">7</td></tr></table></span> F 3 C<span class="transposeCaptionBox"><span class="transposeProgFunc">+II</span><span class="transposeArrow">&Rang;</span></span>D<span class="transposeCaptionBox"><span class="transposeProgFunc">+m</span><span class="transposeArrow">&Rang;</span></span>F');
  });

  test('renders html samples as html while leaving plain samples escaped in the reference table', () => {
    const html = approvedValues.renderApprovedValuesReferenceHtml({ includeSamples: true });

    expect(html).toContain('<span class="arpeggioPositionsStatus"><table><tr><td>0</td><td>3</td><td class="arpeggioCurrentPositionPair">4</td><td class="arpeggioCurrentPositionPair">7</td></tr></table></span>');
    expect(html).toContain('C<span class="transposeCaptionBox"><span class="transposeProgFunc">+II</span><span class="transposeArrow">&Rang;</span></span>D');
    expect(html).toContain('<code>Song</code>');
    expect(html).not.toContain('&lt;span class=&quot;arpeggioPositionsStatus&quot;&gt;');
  });

  test('renders copy buttons for each approved pattern row', () => {
    const html = approvedValues.renderApprovedValuesReferenceHtml({ includeSamples: true });

    expect(html).toContain("class='approvedValueCopyButton'");
    expect(html).toContain("data-action='copyApprovedPattern'");
    expect(html).toContain("data-action-args='[\"rootKey\"]'");
    expect(html).toContain("src='img/clipboard-arrow.png'");
    expect(html).toContain("title='Copy ${rootKey}'");
  });
});