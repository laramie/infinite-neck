import { Song } from '../../Song.js';

describe('Song midiDevice.connected', () => {
	test('a new Song is not connected to MIDI', () => {
		expect(new Song().midiDevice.connected).toBe(false);
	});

	test('a Song with no connected flag is not connected, even with other MIDI settings', () => {
		const song = new Song({ midiDevice: { name: 'Launchpad Pro', enabled: true } });

		expect(song.midiDevice.connected).toBe(false);
		expect(song.midiDevice.name).toBe('Launchpad Pro');
	});

	test('only a boolean true counts as connected', () => {
		expect(new Song({ midiDevice: { connected: 'yes' } }).midiDevice.connected).toBe(false);
		expect(new Song({ midiDevice: { connected: true } }).midiDevice.connected).toBe(true);
	});

	test('connected round-trips through the saved song file', () => {
		const song = new Song({ midiDevice: { connected: true } });

		const savedObj = JSON.parse(song.getPersistentSongFile());
		expect(savedObj.midiDevice.connected).toBe(true);
	});
});
