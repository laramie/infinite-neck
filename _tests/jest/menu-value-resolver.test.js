import {
  buildChildMenuCaptionsRow,
  diveMenu,
  gMenuFile,
  printMenuStack,
  resolveMenuValue,
  setMenuAtRoot,
  setMenuValueResolver
} from '../../menu.js';

describe('menu value resolver token expansion', () => {
  beforeEach(() => {
    setMenuAtRoot();
    setMenuValueResolver((tokenName) => {
      if (tokenName === 'sectionEditNextSectionCardinal') {
        return 8;
      }
      if (tokenName === 'sectionEditInstrumentBaseID') {
        return 'P46_1';
      }
      return tokenName;
    });
  });

  test('expands embedded resolver tokens in input defaults and captions', () => {
    expect(resolveMenuValue('${sectionEditNextSectionCardinal}')).toBe('8');
    expect(resolveMenuValue('section number (1-${sectionEditNextSectionCardinal})')).toBe('section number (1-8)');
  });

  test('printMenuStack expands input menu caption and default tokens', () => {
    const parentMenu = {
      caption: '<b>i</b>nsert clone [${sectionEditInstrumentBaseID}] into Section',
      trigger: 'i'
    };
    const inputMenu = {
      type: 'input',
      caption: 'section number (1-${sectionEditNextSectionCardinal})',
      default: '${sectionEditNextSectionCardinal}'
    };

    diveMenu(parentMenu, 'showing-list-menu');
    diveMenu(inputMenu, '');

    expect(printMenuStack()).toContain('nsert clone [P46_1] into Section::');
    expect(printMenuStack()).toContain('section number (1-8)[8]:');
  });

});
