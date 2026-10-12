import { getSong, updateSectionsStatus } from '../../infinite-neck.js';
import { getSanitizedSongWidgets } from '../../html-sanitizer.js';

export class SongWidgetsBuilder {
	static div_songWidgets = null;
	static eventNamespace = '.songWidgetsBuilder';

	static addToDest(divDestSelector) {
		if (!SongWidgetsBuilder.div_songWidgets) {
			const template = document.getElementById('songwidgets-template');
			const clone = template.content.cloneNode(true);
			SongWidgetsBuilder.div_songWidgets = clone.querySelector('#songWidgetsEditor');
			$(divDestSelector).empty().append(SongWidgetsBuilder.div_songWidgets);
			SongWidgetsBuilder.bindEvents();
		}
		return SongWidgetsBuilder.div_songWidgets;
	}

	static bindEvents() {
		const eventNamespace = SongWidgetsBuilder.eventNamespace;

		$('#btnSaveSongWidgets')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				SongWidgetsBuilder.persistSongWidgets();
				$('#textareaSongWidgets').trigger('blur');
			});

		$('#textareaSongWidgets')
			.off(`blur${eventNamespace} change${eventNamespace}`)
			.on(`blur${eventNamespace} change${eventNamespace}`, function () {
				SongWidgetsBuilder.persistSongWidgets();
			});
	}

	static getSanitizedSongWidgets(rawHtml) {
		return getSanitizedSongWidgets(rawHtml);
	}

	static renderFromSong(song = getSong()) {
		if (!song || !SongWidgetsBuilder.div_songWidgets) {
			return '';
		}
		const sanitized = SongWidgetsBuilder.getSanitizedSongWidgets(song.songWidgets || '');
		if (song.songWidgets !== sanitized) {
			song.songWidgets = sanitized;
		}
		$('#textareaSongWidgets').val(song.songWidgets || '');
		return song.songWidgets || '';
	}

	static persistSongWidgets() {
		const song = getSong();
		if (!song || !SongWidgetsBuilder.div_songWidgets) {
			return '';
		}
		const sanitized = SongWidgetsBuilder.getSanitizedSongWidgets($('#textareaSongWidgets').val());
		const changed = song.songWidgets !== sanitized;
		song.songWidgets = sanitized;
		$('#textareaSongWidgets').val(sanitized);
		if (changed) {
			updateSectionsStatus();
		}
		return sanitized;
	}
}

export default SongWidgetsBuilder;
