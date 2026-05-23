import { jest } from '@jest/globals';

jest.unstable_mockModule('../../menu.js', () => ({
	buildChildMenuCaptionsRow: jest.fn(() => '<td>opts</td>'),
	diveMenu: jest.fn(),
	gMenuPointer: {},
	hasNoChildMenus: jest.fn(() => false),
	peekParentMenu: jest.fn(() => null),
	printMenuStack: jest.fn(() => '<div class="cmdPrompt">prompt:</div>'),
	printMenuStackBreadcrumbs: jest.fn(() => '<b>/</b>'),
	resolveMenuValue: jest.fn(() => ''),
	setMenuAtRoot: jest.fn(),
	surfaceOneMenu: jest.fn()
}));

function makeElement(initialState = {}) {
	return {
		html: initialState.html || '',
		visible: initialState.visible !== undefined ? initialState.visible : true,
		classes: new Set(initialState.classes || []),
		data: new Map(),
		value: initialState.value || ''
	};
}

function makePromptCollection(htmlString) {
	return {
		length: htmlString ? 1 : 0,
		last() {
			return this;
		},
		clone() {
			return { __html: htmlString };
		}
	};
}

function makeWrapper(element) {
	return {
		length: element ? 1 : 0,
		toggleClass(className, force) {
			if (!element) {
				return this;
			}
			if (force) {
				element.classes.add(className);
			} else {
				element.classes.delete(className);
			}
			return this;
		},
		toggle(force) {
			if (!element) {
				return this;
			}
			element.visible = force === undefined ? !element.visible : !!force;
			return this;
		},
		html(value) {
			if (!element) {
				return value === undefined ? '' : this;
			}
			if (value === undefined) {
				return element.html;
			}
			element.html = value;
			return this;
		},
		data(key, value) {
			if (!element) {
				return value === undefined ? undefined : this;
			}
			if (value === undefined) {
				return element.data.get(key);
			}
			element.data.set(key, value);
			return this;
		},
		find(selector) {
			if (!element || selector !== '.cmdPrompt' && selector !== '.cmdPrompt2') {
				return makePromptCollection('');
			}
			const className = selector.slice(1);
			return makePromptCollection(element.html.includes(className) ? element.html : '');
		},
		val(value) {
			if (!element) {
				return value === undefined ? '' : this;
			}
			if (value === undefined) {
				return element.value;
			}
			element.value = value;
			return this;
		}
	};
}

function makeHtmlBuilder() {
	let buffer = '';
	return {
		append(fragment) {
			buffer = fragment && fragment.__html ? fragment.__html : '';
			return this;
		},
		html() {
			return buffer;
		}
	};
}

const elements = {
	'#CmdMenu': makeElement(),
	'#CmdMenuOptionsTable': makeElement(),
	'#CmdMenuStack': makeElement(),
	'#CmdMenuBreadcrumbs': makeElement(),
	'#CmdMenuResults': makeElement(),
	'#txtCmdLine': makeElement()
};

global.$ = jest.fn((selector) => {
	if (selector === '<div>') {
		return makeHtmlBuilder();
	}
	return makeWrapper(elements[selector] || null);
});

const {
	setCmdActionRunner,
	setCmdLineMenuMode,
	txtCmdLine_keydown,
	updateCmdLineView
} = await import('../../command-line.js');

describe('command-line ArrowUp and ArrowDown handlers', () => {
	beforeEach(() => {
		elements['#CmdMenu'].classes.clear();
		elements['#CmdMenuOptionsTable'].visible = true;
		elements['#CmdMenuStack'].html = '';
		elements['#CmdMenuStack'].data = new Map();
		elements['#CmdMenuBreadcrumbs'].html = '';
		elements['#CmdMenuResults'].html = '';
		setCmdLineMenuMode('tall');
		updateCmdLineView();
	});

	test('ArrowDown switches to one-line mode without moving the menu stack', () => {
		const actionRunner = jest.fn((menuItem, args) => {
			if (menuItem.action === 'setMenuPrefs' && args.key === 'o') {
				setCmdLineMenuMode('one-line');
			}
			return { result: 'menu prefs: one-line' };
		});
		setCmdActionRunner(actionRunner);

		const event = {
			key: 'ArrowDown',
			preventDefault: jest.fn(),
			stopPropagation: jest.fn()
		};

		txtCmdLine_keydown(event);

		expect(event.preventDefault).toHaveBeenCalledTimes(1);
		expect(event.stopPropagation).toHaveBeenCalledTimes(1);
		expect(actionRunner).toHaveBeenCalledWith({ action: 'setMenuPrefs' }, { key: 'o' });
		expect(elements['#CmdMenu'].classes.has('CmdMenuOneLine')).toBe(true);
		expect(elements['#CmdMenuOptionsTable'].visible).toBe(false);
		expect(elements['#CmdMenuStack'].html).toBe('<div class="cmdPrompt">prompt:</div>');
	});

	test('ArrowUp switches back to tall mode locally', () => {
		const actionRunner = jest.fn((menuItem, args) => {
			if (menuItem.action === 'setMenuPrefs' && args.key === 'o') {
				setCmdLineMenuMode('one-line');
			}
			if (menuItem.action === 'setMenuPrefs' && args.key === 't') {
				setCmdLineMenuMode('tall');
			}
			return { result: 'menu prefs changed' };
		});
		setCmdActionRunner(actionRunner);

		txtCmdLine_keydown({
			key: 'ArrowDown',
			preventDefault: jest.fn(),
			stopPropagation: jest.fn()
		});

		const event = {
			key: 'ArrowUp',
			preventDefault: jest.fn(),
			stopPropagation: jest.fn()
		};

		txtCmdLine_keydown(event);

		expect(event.preventDefault).toHaveBeenCalledTimes(1);
		expect(event.stopPropagation).toHaveBeenCalledTimes(1);
		expect(actionRunner).toHaveBeenLastCalledWith({ action: 'setMenuPrefs' }, { key: 't' });
		expect(elements['#CmdMenu'].classes.has('CmdMenuOneLine')).toBe(false);
		expect(elements['#CmdMenuOptionsTable'].visible).toBe(true);
		expect(elements['#CmdMenuStack'].html).toBe('<div class="cmdPrompt">prompt:</div>');
	});

	test('other keys are ignored by the local keydown handler', () => {
		const actionRunner = jest.fn();
		setCmdActionRunner(actionRunner);

		const event = {
			key: 'ArrowLeft',
			preventDefault: jest.fn(),
			stopPropagation: jest.fn()
		};

		txtCmdLine_keydown(event);

		expect(event.preventDefault).not.toHaveBeenCalled();
		expect(event.stopPropagation).not.toHaveBeenCalled();
		expect(actionRunner).not.toHaveBeenCalled();
	});
});