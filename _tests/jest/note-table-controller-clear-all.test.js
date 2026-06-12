import {
  clearAllForTable,
  setNotetableProviders
} from '../../NoteTableController.js';

function installSelectorTrackingJquery(log = []) {
  globalThis.$ = (selector = '') => {
    const chain = {
      removeClass(className) {
        log.push({ selector: `${selector}`, method: 'removeClass', className: `${className || ''}` });
        return this;
      },
      addClass(className) {
        log.push({ selector: `${selector}`, method: 'addClass', className: `${className || ''}` });
        return this;
      },
      children(subselector = '') {
        return globalThis.$(`${selector}${subselector ? ` ${subselector}` : ''}`);
      },
      each() { return this; },
      css() { return this; },
      hide() { return this; },
      show() { return this; },
      attr() { return this; },
      removeAttr() { return this; }
    };
    return chain;
  };
  globalThis.jQuery = globalThis.$;
}

describe('NoteTableController clearAllForTable highlight scope', () => {
  test('clears noteHighlight classes only for the requested table', () => {
    const calls = [];
    installSelectorTrackingJquery(calls);

    const song = {
      getVisibleTunings() {
        return ['tblSource', 'tblListener'];
      }
    };

    setNotetableProviders({
      getSong: () => song,
      hideNoteClickedCaption: () => {}
    });

    clearAllForTable('tblListener');

    const highlightRemoveSelectors = calls
      .filter((call) => call.method === 'removeClass' && call.className === 'noteHighlight')
      .map((call) => call.selector);

    expect(highlightRemoveSelectors).toContain('#tblListener td.note');
    expect(highlightRemoveSelectors).not.toContain('#tblSource td.note');
  });
});
