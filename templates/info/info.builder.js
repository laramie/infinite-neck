import { makeDivDockable, dockDivInPage } from '../../dockable.js';
import { getSong, showOneMenu } from '../../infinite-neck.js';
import { getSanitizedInfo } from '../../html-sanitizer.js';
import { expandApprovedTemplate } from '../../approved-values.js';

export class InfoBuilder {
	static div_info = null;
	static currentTab = 'info';
	static firstShowAfterSongLoad = true;
	static eventNamespace = '.infoBuilder';
	static reopenMode = 'parked';

	static addToDest(divDestSelector) {
		if (!InfoBuilder.div_info) {
			const template = document.getElementById('info-template');
			const clone = template.content.cloneNode(true);
			InfoBuilder.div_info = clone.querySelector('#info');
			$(divDestSelector).empty().append(InfoBuilder.div_info);
			InfoBuilder.bindEvents();
		}
		return InfoBuilder.div_info;
	}

	static bindEvents() {
		const eventNamespace = InfoBuilder.eventNamespace;

		$('#btnInfoTabInfo')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				InfoBuilder.activateTab('info');
			});

		$('#btnInfoTabEdit')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				InfoBuilder.activateTab('edit');
			});

		$('#btnCloseInfo')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				InfoBuilder.hide();
			});

		$('#btnFloatSection_info')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				if (!InfoBuilder.isFloated()) {
					InfoBuilder.reopenMode = 'float';
					// Info is one of the Menu Divs (see infinite-neck.js's AllMenuDivs) --
					// float above tables/Transport. See sprint-141 Iteration 4.
					makeDivDockable('info', 900);
				}
			});

		$('#btnSaveInfo')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				InfoBuilder.persistInfo();
				InfoBuilder.persistOpenInfo();
				$('#textareaSongInfo').trigger('blur');
			});

		$('#textareaSongInfo')
			.off(`blur${eventNamespace} change${eventNamespace}`)
			.on(`blur${eventNamespace} change${eventNamespace}`, function () {
				InfoBuilder.persistInfo();
			});

		$('#selOpenInfo')
			.off(`change${eventNamespace}`)
			.on(`change${eventNamespace}`, function () {
				InfoBuilder.persistInfo();
				InfoBuilder.persistOpenInfo(this.value);
			});
	}

	static normalizeOpenInfoValue(value, hasInfo = null) {
		const normalized = ['none', 'parked', 'float'].includes(value) ? value : 'none';
		if (hasInfo === false) {
			return 'none';
		}
		return normalized;
	}

	static getSanitizedInfo(rawHtml) {
		return getSanitizedInfo(rawHtml);
	}

	static getRenderedInfoHtml(rawHtml) {
		return expandApprovedTemplate(InfoBuilder.getSanitizedInfo(rawHtml));
	}

	static isVisible() {
		return $('#info').is(':visible') || InfoBuilder.isFloated();
	}

	static isFloated() {
		return document.getElementById('floating-info') !== null;
	}

	static cleanupFloatingInfo() {
		if (!InfoBuilder.isFloated()) {
			return;
		}

		dockDivInPage('info');

		const lingeringFloatWin = document.getElementById('floating-info');
		if (!lingeringFloatWin) {
			return;
		}

		const div = document.getElementById('info');
		const floatState = window._dockableFloatState || {};
		const state = floatState.info;

		if (div && state && state.parent && state.parent.isConnected) {
			if (state.next && state.next.parentNode === state.parent) {
				state.parent.insertBefore(div, state.next);
			} else {
				state.parent.appendChild(div);
			}
		}

		lingeringFloatWin.remove();
		delete floatState.info;
		const floatBtn = document.getElementById('btnFloatSection_info');
		if (floatBtn) {
			floatBtn.style.display = '';
		}
	}

	static renderFromSong(song = getSong()) {
		if (!song || !InfoBuilder.div_info) {
			return '';
		}

		const sanitizedInfo = InfoBuilder.getSanitizedInfo(song.info || '');
		if (song.info !== sanitizedInfo) {
			song.info = sanitizedInfo;
		}

		song.openInfo = InfoBuilder.normalizeOpenInfoValue(song.openInfo, Boolean(song.info));

		$('#textareaSongInfo').val(song.info || '');
		$('#selOpenInfo').val(song.openInfo);
		$('#divInfoRendered').html(InfoBuilder.getRenderedInfoHtml(song.info || ''));

		return song.info || '';
	}

	static activateTab(tabName) {
		if (!InfoBuilder.div_info) {
			return;
		}

		if (InfoBuilder.currentTab === 'edit' && tabName !== 'edit') {
			InfoBuilder.persistInfo();
		}

		InfoBuilder.currentTab = tabName === 'edit' ? 'edit' : 'info';
		InfoBuilder.renderFromSong(getSong());
		const showInfoTab = InfoBuilder.currentTab === 'info';
		const showEditTab = !showInfoTab;

		$('#divInfoTabInfo').toggle(showInfoTab);
		$('#divInfoTabEdit').toggle(showEditTab);
		$('#infoEditControlsInner').toggle(showEditTab);
		$('#btnInfoTabInfo')
			.toggleClass('BtnPunchedIn', showInfoTab)
			.toggleClass('BtnPunchedOut', !showInfoTab);
		$('#btnInfoTabEdit')
			.toggleClass('BtnPunchedIn', showEditTab)
			.toggleClass('BtnPunchedOut', showInfoTab);
	}

	static persistInfo() {
		const song = getSong();
		if (!song) {
			return '';
		}

		const sanitizedInfo = InfoBuilder.getSanitizedInfo($('#textareaSongInfo').val());
		song.info = sanitizedInfo;
		if (!song.info) {
			song.openInfo = 'none';
		}

		$('#textareaSongInfo').val(song.info);
		$('#divInfoRendered').html(InfoBuilder.getRenderedInfoHtml(song.info || ''));

		return song.info;
	}

	static persistOpenInfo(nextValue = null) {
		const song = getSong();
		if (!song) {
			return 'none';
		}

		const hasInfo = Boolean(song.info && song.info.trim().length > 0);
		const selectedValue = nextValue === null ? $('#selOpenInfo').val() : nextValue;
		song.openInfo = InfoBuilder.normalizeOpenInfoValue(selectedValue, hasInfo);
		$('#selOpenInfo').val(song.openInfo);
		return song.openInfo;
	}

	static show(forceMode = null) {
		const song = getSong();
		if (!song) {
			return null;
		}

		InfoBuilder.renderFromSong(song);
		const desiredTab = InfoBuilder.firstShowAfterSongLoad ? 'info' : InfoBuilder.currentTab;
		const mode = forceMode || InfoBuilder.reopenMode || 'parked';

		showOneMenu('#info', true);
		InfoBuilder.activateTab(desiredTab);

		if (mode === 'float') {
			InfoBuilder.reopenMode = 'float';
			if (!InfoBuilder.isFloated()) {
				makeDivDockable('info', 900);
			}
		} else if (InfoBuilder.isFloated()) {
			InfoBuilder.reopenMode = 'parked';
			InfoBuilder.cleanupFloatingInfo();
		} else {
			InfoBuilder.reopenMode = 'parked';
		}

		InfoBuilder.firstShowAfterSongLoad = false;
		return InfoBuilder.div_info;
	}

	static hide() {
		if (!InfoBuilder.div_info) {
			return;
		}

		InfoBuilder.reopenMode = InfoBuilder.isFloated() ? 'float' : 'parked';
		InfoBuilder.persistInfo();
		InfoBuilder.persistOpenInfo();
		InfoBuilder.cleanupFloatingInfo();
		$('#info').hide();
		$('#btnInfo').removeClass('BtnPunchedIn').addClass('BtnPunchedOut');
	}

	static handleSongLoaded(song = getSong()) {
		InfoBuilder.firstShowAfterSongLoad = true;
		InfoBuilder.currentTab = 'info';
		InfoBuilder.reopenMode = 'parked';
		InfoBuilder.renderFromSong(song);
		InfoBuilder.applyOpenInfoOnSongLoad(song);
	}

	static applyOpenInfoOnSongLoad(song = getSong()) {
		if (!song) {
			return;
		}

		const sanitizedInfo = InfoBuilder.renderFromSong(song);
		if (!sanitizedInfo) {
			song.openInfo = 'none';
			$('#selOpenInfo').val(song.openInfo);
			return;
		}

		if (song.openInfo === 'parked' || song.openInfo === 'float') {
			InfoBuilder.reopenMode = song.openInfo;
			InfoBuilder.show(song.openInfo);
		}
	}
}