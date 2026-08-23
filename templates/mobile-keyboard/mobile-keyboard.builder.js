MobileKeyboardBuilder.renderFromSong(getSong());

import { getSong, showOneMenu } from '../../infinite-neck.js';

export class MobileKeyboardBuilder {
	static div_MobileKeyboard = null;
	static currentTab = 'tabMobileKeyboard';
	static firstShowAfterSongLoad = true;
	static eventNamespace = '.mobileKeyboardBuilder';

	static addToDest(divDestSelector) {
		if (!MobileKeyboardBuilder.div_MobileKeyboard) {
			const template = document.getElementById('mobile-keyboard-template');
			const clone = template.content.cloneNode(true);
			MobileKeyboardBuilder.div_MobileKeyboard = clone.querySelector('#MobileKeyboard TODO');
			$(divDestSelector).empty().append(MobileKeyboardBuilder.div_MobileKeyboard);
			MobileKeyboardBuilder.bindEvents();
		}
		return MobileKeyboardBuilder.div_MobileKeyboard;
	}

    static renderFromSong(song = getSong()) {

    }

}


