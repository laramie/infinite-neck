import { Layout } from '../../layout.js';

function roundTrip(layout) {
  return new Layout(JSON.parse(JSON.stringify(layout)));
}

describe('Layout PracticeList flag (sprint 152)', () => {
  test('defaults to hidden on both screens', () => {
    const layout = new Layout();
    expect(layout.screenList.fullscreen.PracticeList).toBe(false);
    expect(layout.screenList.escaped.PracticeList).toBe(false);
  });

  test('old song files without the flag back-fill it to hidden, and SongWidgets to shown', () => {
    const layout = new Layout({
      screenList: {
        fullscreen: { name: 'fullscreen', CaptionRow: true },
        escaped: { name: 'escaped', CaptionRow: true }
      },
      screen: { name: 'escaped', CaptionRow: true }
    });
    expect(layout.screenList.fullscreen.PracticeList).toBe(false);
    expect(layout.screenList.escaped.PracticeList).toBe(false);
    expect(layout.screen.PracticeList).toBe(false);
    expect(layout.screen.SongWidgets).toBe(true);
  });

  test('is stored per screen and survives a JSON round trip separately', () => {
    const layout = new Layout();
    layout.screenList.fullscreen.PracticeList = true;
    layout.screenList.escaped.PracticeList = false;
    const loaded = roundTrip(layout);
    expect(loaded.screenList.fullscreen.PracticeList).toBe(true);
    expect(loaded.screenList.escaped.PracticeList).toBe(false);
  });
});

describe('Layout screen re-link (sprint 152)', () => {
  test('a new Layout has screen as the same object as screenList.escaped', () => {
    const layout = new Layout();
    expect(layout.screen).toBe(layout.screenList.escaped);
  });

  test('after loading a Song, screen is the same object as its screenList entry', () => {
    const loaded = roundTrip(new Layout());
    expect(loaded.screen).toBe(loaded.screenList[loaded.screen.name]);
  });

  test('a flag set on the current screen is kept when switching screens and back', () => {
    const loaded = roundTrip(new Layout());
    loaded.screen.PracticeList = true;
    loaded.screen = loaded.screenList.fullscreen;
    loaded.screen = loaded.screenList.escaped;
    expect(loaded.screen.PracticeList).toBe(true);
  });

  test('the persisted screen state wins over a stale screenList entry', () => {
    const loaded = new Layout({
      screenList: {
        fullscreen: { name: 'fullscreen', PracticeList: false },
        escaped: { name: 'escaped', PracticeList: false }
      },
      screen: { name: 'escaped', PracticeList: true }
    });
    expect(loaded.screenList.escaped.PracticeList).toBe(true);
    expect(loaded.screen).toBe(loaded.screenList.escaped);
  });
});
