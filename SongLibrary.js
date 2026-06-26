/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

export const ROOT_DIRECTORY_KEY = 'root';

function escapeHtml(text) {
	return String(text)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function escapeAttribute(text) {
	return String(text).replaceAll('&', '&amp;').replaceAll("'", '&#39;');
}

function normalizeDirectoryKey(input) {
	if (typeof input !== 'string') {
		return ROOT_DIRECTORY_KEY;
	}
	const value = input.trim();
	if (!value || value === '(root)' || value.toLowerCase() === 'root') {
		return ROOT_DIRECTORY_KEY;
	}
	return value;
}

function parseSongEntry(songEntry) {
	if (typeof songEntry === 'string') {
		const href = songEntry.trim();
		return {
			href,
			description: ''
		};
	}
	if (!songEntry || typeof songEntry !== 'object' || Array.isArray(songEntry)) {
		return {
			href: '',
			description: ''
		};
	}
	const href = typeof songEntry.href === 'string' ? songEntry.href.trim() : '';
	const description = typeof songEntry.description === 'string' ? songEntry.description : '';
	return {
		href,
		description
	};
}

function getDirectoryFromHref(href) {
	if (typeof href !== 'string' || !href.trim()) {
		return ROOT_DIRECTORY_KEY;
	}
	const index = href.indexOf('/');
	if (index < 0) {
		return ROOT_DIRECTORY_KEY;
	}
	const directory = href.slice(0, index).trim();
	if (!directory) {
		return ROOT_DIRECTORY_KEY;
	}
	return directory;
}

export function normalizeSongListEntries(songListJson) {
	const songs = Array.isArray(songListJson?.songs) ? songListJson.songs : [];
	return songs
		.map((entry) => {
			const parsed = parseSongEntry(entry);
			if (!parsed.href) {
				return null;
			}
			const href = parsed.href;
			const slashIndex = href.lastIndexOf('/');
			const filename = slashIndex >= 0 ? href.slice(slashIndex + 1) : href;
			return {
				href,
				description: parsed.description,
				directory: getDirectoryFromHref(href),
				filename
			};
		})
		.filter(Boolean);
}

function normalizeDirectoryIntros(songListJson) {
	const directoryIntros = Array.isArray(songListJson?.directoryIntros) ? songListJson.directoryIntros : [];
	const introByDirectory = new Map();
	const introOrder = [];
	directoryIntros.forEach((introEntry) => {
		if (!introEntry || typeof introEntry !== 'object' || Array.isArray(introEntry)) {
			return;
		}
		const directory = normalizeDirectoryKey(introEntry.introFor);
		const html = typeof introEntry.html === 'string' ? introEntry.html : '';
		if (!introByDirectory.has(directory)) {
			introOrder.push(directory);
		}
		introByDirectory.set(directory, html);
	});
	return {
		introByDirectory,
		introOrder
	};
}

export function buildSongLibraryModel(songListJson) {
	const normalizedEntries = normalizeSongListEntries(songListJson);
	const byDirectory = new Map();
	const songDirectoryOrder = [];
	normalizedEntries.forEach((song) => {
		if (!byDirectory.has(song.directory)) {
			byDirectory.set(song.directory, []);
			songDirectoryOrder.push(song.directory);
		}
		byDirectory.get(song.directory).push(song);
	});

	const { introByDirectory, introOrder } = normalizeDirectoryIntros(songListJson);

	const nonRootDirectoryOrder = songDirectoryOrder.filter((directory) => directory !== ROOT_DIRECTORY_KEY);
	introOrder.forEach((directory) => {
		if (directory !== ROOT_DIRECTORY_KEY && !nonRootDirectoryOrder.includes(directory)) {
			nonRootDirectoryOrder.push(directory);
		}
	});

	return {
		root: {
			key: ROOT_DIRECTORY_KEY,
			label: 'Song Library',
			introHtml: introByDirectory.get(ROOT_DIRECTORY_KEY) || '',
			songs: byDirectory.get(ROOT_DIRECTORY_KEY) || []
		},
		directories: nonRootDirectoryOrder.map((directory) => ({
			key: directory,
			label: directory,
			introHtml: introByDirectory.get(directory) || '',
			songs: byDirectory.get(directory) || []
		}))
	};
}

function renderIntroRow(introHtml) {
	if (!introHtml) {
		return '';
	}
	return "<div class='songLibraryRow songLibraryIntroRow'><div class='songLibraryCell songLibraryCellIntro'>" + introHtml + '</div></div>';
}

function renderSongRow(song) {
	const argsAttr = escapeAttribute(JSON.stringify([song.href]));
	const safeHrefText = escapeHtml(song.href);
	return (
		"<div class='songLibraryRow'>"
			+ "<div class='songLibraryCell songLibraryCellLink'>"
			+ "<a href='#' data-action='loadSong' data-action-args='" + argsAttr + "'>" + safeHrefText + '</a>'
			+ '</div>'
			+ "<div class='songLibraryCell songLibraryCellDescription'>" + (song.description || '') + '</div>'
			+ '</div>'
	);
}

function renderRows(introHtml, songs) {
	let html = "<div class='songLibraryRows'>";
	html += renderIntroRow(introHtml);
	songs.forEach((song) => {
		html += renderSongRow(song);
	});
	html += '</div>';
	return html;
}

export function renderSongLibraryHtml(songListJson) {
	const model = buildSongLibraryModel(songListJson);
	let html = "<details class='songLibraryRootDetails'><summary class='songLibrarySummary'>Song Library</summary>";
	html += "<div class='songLibraryBody'>";
	html += renderRows(model.root.introHtml, model.root.songs);

	model.directories.forEach((directory) => {
		html += "<details class='songLibraryDirectoryDetails' name='songLibraryDirectoryGroup'>";
		html += "<summary class='songLibrarySummary songLibraryDirectorySummary'>" + escapeHtml(directory.label) + '</summary>';
		html += "<div class='songLibraryDirectoryBody'>";
		html += renderRows(directory.introHtml, directory.songs);
		html += '</div></details>';
	});

	html += '</div></details>';
	return html;
}

export function toggleSongLibraryVisibility(targetSelector = '#divSongList') {
	const divSongList = $(targetSelector);
	if (divSongList.is(':visible')) {
		divSongList.hide();
		return;
	}

	if (divSongList.html().trim().length > 0) {
		divSongList.show();
		return;
	}

	$.get('songs/song-list.json', function(data) {
		divSongList.html(renderSongLibraryHtml(data)).show();
	}).fail(function() {
		divSongList.html("<div class='warningMessage'>Unable to load songs/song-list.json</div>").show();
	});
}
