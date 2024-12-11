// An abstraction layer wrapping the textarea in an object with methods to manipulate and listen to events.
// This is an internal abstraction layer intented to handle cross-browser inconsistencies in event handlers.

import type { Controller } from 'src/controller';

export const saneKeyboardEvents = (() => {
	const KEY_TO_MQ_VALUE: Record<string, string> = {
		ArrowRight: 'Right',
		ArrowLeft: 'Left',
		ArrowDown: 'Down',
		ArrowUp: 'Up',
		' ': 'Spacebar'
	};
	const isLowercaseAlphaCharacter = (s: string) => s.length === 1 && s >= 'a' && s <= 'z';

	// To the extent possible, create a normalized string representation of the key combo.
	const stringify = (evt: KeyboardEvent) => {
		const key = isLowercaseAlphaCharacter(evt.key) ? evt.key.toUpperCase() : (KEY_TO_MQ_VALUE[evt.key] ?? evt.key);

		const modifiers = [];

		if (evt.ctrlKey) modifiers.push('Ctrl');
		if (evt.metaKey) modifiers.push('Meta');
		if (evt.altKey) modifiers.push('Alt');
		if (evt.shiftKey) modifiers.push('Shift');

		if (!modifiers.length) return key;

		if (key !== 'Alt' && key !== 'Control' && key !== 'Meta' && key !== 'Shift') modifiers.push(key);
		return modifiers.join('-');
	};

	// Create a keyboard events shim that calls callbacks at useful times and exports useful public methods.
	return (textarea: HTMLTextAreaElement, controller: Controller) => {
		// Virtual keyboards on touch screen devices send 'Unidentified' for almost all keys in the 'keydown' event. As
		// a result the keystroke handler called in that event handler passes 'Unidentified' for the key.  This makes
		// the enableSpaceNavigation option fail on these devices.  So this flag detects the 'Unidentified' key, and
		// calls the keystroke handler again passing 'Spacebar' for the key, when a space is typed.
		let sendInputSpaceKeystroke = false;

		// Public methods
		const select = (text: string) => {
			textarea.value = text;
			if (text && textarea instanceof HTMLTextAreaElement) textarea.select();
		};

		const handleKey = (key: string, e: KeyboardEvent) => {
			if (controller.options.overrideKeystroke) controller.options.overrideKeystroke(key, e);
			else controller.keystroke(key, e);
		};

		// Event handlers
		const onKeydown = (e: KeyboardEvent) => {
			if (e.target !== textarea) return;
			sendInputSpaceKeystroke = e.key === 'Unidentified';
			handleKey(stringify(e), e);
		};

		const onPaste = (e: ClipboardEvent) => {
			if (e.target !== textarea) return;

			// In Linux, middle-click pasting causes onPaste to be called, when the textarea is not necessarily focused.
			// We focus it here to ensure that the pasted text actually ends up in the textarea.
			// It's pretty nifty that by changing focus in this handler, we can change the target of the default action.
			// (Actually, I don't think this is even needed, and is probably not doing anything.)
			textarea.focus();

			// Get the pasted text from the clipboard data in the event.
			const text = e.clipboardData?.getData('text') ?? '';
			textarea.value = '';
			if (text) {
				if (controller.options.overridePaste) controller.options.overridePaste(text);
				else controller.paste(text);
			}
		};

		const onInput = (e: Event) => {
			if ((e as InputEvent).inputType === 'insertFromPaste') return;

			if ((e as InputEvent).inputType === 'insertLineBreak') {
				controller.typedText('\n');
				return;
			}

			const text = (e as InputEvent).data ?? '';
			if (text.length === 1) {
				if (controller.options.overrideTypedText) {
					controller.options.overrideTypedText(text);
				} else {
					if (
						text === ' ' &&
						sendInputSpaceKeystroke &&
						controller.options.enableSpaceNavigation &&
						controller.cursor.depth() > 1 &&
						controller.cursor.left?.ctrlSeq !== ','
					) {
						handleKey('Spacebar', e as KeyboardEvent);
						setTimeout(() => (textarea.value = ''));
					} else {
						controller.typedText(text);
						setTimeout(() => (textarea.value = ''));
					}
				}
			} else if (textarea.value.length > 1) textarea.select();
		};

		// Attach event handlers
		textarea.addEventListener('keydown', onKeydown);
		textarea.addEventListener('cut', () => {
			if (controller.options.overrideCut) controller.options.overrideCut();
			else controller.cut();
		});
		textarea.addEventListener('copy', () => {
			if (controller.options.overrideCopy) controller.options.overrideCopy();
			else controller.copy();
		});
		textarea.addEventListener('paste', onPaste);
		textarea.addEventListener('input', onInput);

		// Export public methods
		return { select };
	};
})();
