import { getSong } from '../../infinite-neck.js';
import { document_keydown, document_keypress, document_keyup } from '../../key-handlers.js';

// Buttons that don't carry a plain key letter in a <b> child (their behavior
// is keyed off the button id instead of a simulated character keypress).
const ESC_BUTTON_ID = 'btn_mobile_keyboard_hideMenusBlurFocus';
const COMMAND_LINE_EASTER_EGG_BUTTON_ID = 'btn_mobile_keyboard_showHideCommandEasterEgg';

export class MobileKeyboardBuilder {
	static div_MobileKeyboard = null;
	static currentTab = 'tabMobileKeyboard';
	static firstShowAfterSongLoad = true;
	static eventNamespace = '.mobileKeyboardBuilder';

	static addToDest(divDestSelector) {
		if (!MobileKeyboardBuilder.div_MobileKeyboard) {
			const template = document.getElementById('mobile-keyboard-template');
			const clone = template.content.cloneNode(true);
			MobileKeyboardBuilder.div_MobileKeyboard = clone.querySelector('#MobileKeyboard');
			$(divDestSelector).empty().append(MobileKeyboardBuilder.div_MobileKeyboard);
			MobileKeyboardBuilder.bindEvents();
		}
		return MobileKeyboardBuilder.div_MobileKeyboard;
	}

	static bindEvents() {
		const eventNamespace = MobileKeyboardBuilder.eventNamespace;
		$(MobileKeyboardBuilder.div_MobileKeyboard)
			.off(`click${eventNamespace}`, 'button')
			.on(`click${eventNamespace}`, 'button', function (e) {
				e.preventDefault();
				MobileKeyboardBuilder.handleButtonClick(this);
			});
	}

	// A button click is meant to stand in for the User typing the indicated
	// key on a desktop keyboard, so this dispatches through the same
	// document_keydown/document_keypress/document_keyup handlers key-handlers.js
	// wires up for real keyboard events.
	static handleButtonClick(button) {
		if (button.id === ESC_BUTTON_ID) {
			document_keyup(MobileKeyboardBuilder.makeSyntheticEvent({ keyCode: 27, target: button }));
			return;
		}
		if (button.id === COMMAND_LINE_EASTER_EGG_BUTTON_ID) {
			document_keydown(MobileKeyboardBuilder.makeSyntheticEvent({
				key: 'm',
				ctrlKey: true,
				shiftKey: true,
				target: button
			}));
			return;
		}
		const key = MobileKeyboardBuilder.getButtonKey(button);
		if (!key) {
			return;
		}
		document_keypress(MobileKeyboardBuilder.makeSyntheticEvent({ key, target: button }));
	}

	// The key a button simulates is whatever character is in its first <b> child,
	// matching the bolded letter shown to the User (e.g. "<b>q</b>uick menu" => "q").
	static getButtonKey(button) {
		const bold = button.querySelector('b');
		const text = bold ? bold.textContent : '';
		return text ? text[0] : null;
	}

	static makeSyntheticEvent({ key = '', keyCode, ctrlKey = false, shiftKey = false, target }) {
		return {
			key,
			keyCode: keyCode ?? (key ? key.charCodeAt(0) : undefined),
			ctrlKey,
			shiftKey,
			target,
			preventDefault() {}
		};
	}

	static renderFromSong(song = getSong()) {
		// The mobile keyboard layout is currently static and not song-dependent.
	}

}


