import { Song } from '../../Song.js';

describe('Song info defaults', () => {
	test('new songs default info and openInfo', () => {
		const song = new Song();

		expect(song.info).toBe('');
		expect(song.openInfo).toBe('none');
	});

	test('loaded songs preserve explicit info fields', () => {
		const song = new Song({ info: '<p>Hello</p>', openInfo: 'float' });

		expect(song.info).toBe('<p>Hello</p>');
		expect(song.openInfo).toBe('float');
	});

	test('recording state is runtime-only and defaults off', () => {
		const song = new Song({ runtime: { recording: true }, recording: true });

		expect(song.isRecording()).toBe(false);
		expect(song.setRecording(true)).toBe(true);
		expect(song.isRecording()).toBe(true);
		expect(song.toggleRecording()).toBe(false);
		expect(song.resetRecording()).toBe(false);

		const savedObj = JSON.parse(song.getPersistentSongFile());
		expect(savedObj).not.toHaveProperty('runtime');
		expect(savedObj).not.toHaveProperty('recording');
	});
});
