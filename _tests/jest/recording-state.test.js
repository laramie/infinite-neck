import { Song } from '../../Song.js';
import {
  isRecording,
  setNotetableProviders
} from '../../NoteTableController.js';

describe('runtime recording state', () => {
  test('NoteTableController.isRecording reads Song runtime state, not DOM state', () => {
    const song = new Song();

    globalThis.$ = () => ({
      attr: () => 'true'
    });
    globalThis.jQuery = globalThis.$;

    setNotetableProviders({
      getSong: () => song
    });

    expect(isRecording()).toBe(false);

    song.setRecording(true);
    expect(isRecording()).toBe(true);

    song.setRecording(false);
    expect(isRecording()).toBe(false);
  });
});
