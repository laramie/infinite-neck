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
});