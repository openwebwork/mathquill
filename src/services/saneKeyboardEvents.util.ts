// Sane Keyboard Events Shim
//
// An abstraction layer wrapping the textarea in an object with methods to manipulate and listen to events on, that
// hides all the nasty cross-browser incompatibilities behind a uniform API.
//
// Design goal: This is a *HARD* internal abstraction barrier. Cross-browser inconsistencies are not allowed to leak
// through and be dealt with by event handlers. All future cross-browser issues that arise must be dealt with here, and
// if necessary, the API updated.
//
// Organization:
// - key values map and stringify()
// - saneKeyboardEvents()
//    + event handler logic
//    + attach event handlers and export methods

import { noop } from 'src/constants';

export interface TextAreaHandlers {
	container: HTMLElement;
	keystroke?: (key: string, event: KeyboardEvent) => void;
	typedText: (text: string) => void;
	paste: (text: string) => void;
	cut: () => void;
	copy: () => void;
}

export const saneKeyboardEvents = (() => {
	// The following [key values][1] map was compiled from the [DOM3 Events appendix section on key codes][2] and
	// [a widely cited report on cross-browser tests of key codes][3], except for 10: 'Enter', which has been
	// empirically observed in Safari on iOS and doesn't appear to conflict with any other known key codes.
	//
	// [1]: http://www.w3.org/TR/2012/WD-DOM-Level-3-Events-20120614/#keys-keyvalues
	// [2]: http://www.w3.org/TR/2012/WD-DOM-Level-3-Events-20120614/#fixed-virtual-key-codes
	// [3]: http://unixpapa.com/js/key.html
	//
	// All of the information above is badly outdated, and this needs to be reworked.  Event.which and Event.keyCode are
	// deprecated and should be replaced with Event.key, which is already a human readable string that could be used
	// directly.  Touch screen devices with soft keyboards should be implemented separately with another methd.
	// Currently those are still sending somewhat invalid values for Event.which, and that is what makes this partially
	// work as is.
	const KEY_VALUES: { [key: number]: string } = {
		8: 'Backspace',
		9: 'Tab',

		10: 'Enter', // for Safari on iOS

		13: 'Enter',

		16: 'Shift',
		17: 'Control',
		18: 'Alt',
		20: 'CapsLock',

		27: 'Esc',

		32: 'Spacebar',

		33: 'PageUp',
		34: 'PageDown',
		35: 'End',
		36: 'Home',

		37: 'Left',
		38: 'Up',
		39: 'Right',
		40: 'Down',

		45: 'Insert',

		46: 'Del',

		144: 'NumLock'
	};

	// To the extent possible, create a normalized string representation of the key combo
	// (i.e., key code and modifier keys).
	const stringify = (evt: KeyboardEvent) => {
		const which = evt.which || evt.keyCode;
		const keyVal = KEY_VALUES[which];
		const modifiers = [];

		if (evt.ctrlKey) modifiers.push('Ctrl');
		if (evt.metaKey) modifiers.push('Meta');
		if (evt.altKey) modifiers.push('Alt');
		if (evt.shiftKey) modifiers.push('Shift');

		const key = keyVal || String.fromCharCode(which);

		if (!modifiers.length && !keyVal) return key;

		modifiers.push(key);
		return modifiers.join('-');
	};

	// Create a keyboard events shim that calls callbacks at useful times and exports useful public methods.
	return (el: HTMLTextAreaElement, handlers: TextAreaHandlers) => {
		let keydown: KeyboardEvent | null = null;
		let keypress: KeyboardEvent | null = null;

		const textarea = el;
		const target = handlers.container || textarea;

		// checkTextareaFor() is called after key or clipboard events to say "Hey, I think something was just typed" or
		// "pasted" etc, so that at all subsequent opportune times (next event or timeout), will check for expected
		// typed or pasted text.  Need to check repeatedly because #135: in Safari 5.1 (at least), after selecting
		// something and then typing, the textarea is incorrectly reported as selected during the input event (but not
		// subsequently).
		let checkTextarea: ((e?: Event) => void) = noop, timeoutId: ReturnType<typeof setInterval>;

		const checkTextareaFor = (checker: (e?: Event) => void) => {
			checkTextarea = checker;
			clearTimeout(timeoutId);
			timeoutId = setTimeout(checker);
		};

		const checkTextareaOnce = (checker: (e?: Event) => void) => {
			checkTextareaFor((e) => {
				checkTextarea = noop;
				clearTimeout(timeoutId);
				checker(e);
			});
		};

		for (const event of ['keydown', 'keypress', 'input', 'keyup', 'focusout', 'paste'])
			target.addEventListener(event, (e) => checkTextarea(e));

		// Public methods
		const select = (text: string) => {
			// Check textarea one last time before munging (so there is no race condition if selection happens after
			// keypress/paste but before checkTextarea).  Then never again (because it has been munged).
			checkTextarea();
			checkTextarea = noop;
			clearTimeout(timeoutId);

			textarea.value = text;
			if (text && textarea.select) textarea.select();
			shouldBeSelected = !!text;
		};

		let shouldBeSelected = false;

		// Helper subroutines

		// Determine whether there's a selection in the textarea.
		const hasSelection = () => {
			const dom = textarea ;

			if (!('selectionStart' in dom)) return false;
			return dom.selectionStart !== dom.selectionEnd;
		};

		const handleKey = () =>
			handlers.keystroke?.(stringify(keydown as KeyboardEvent), keydown as KeyboardEvent);

		// Event handlers
		const onKeydown = (e: KeyboardEvent) => {
			if (e.target !== textarea) return;

			keydown = e;
			keypress = null;

			if (shouldBeSelected) checkTextareaOnce((e) => {
				if (!(e && e.type === 'focusout') && textarea.select) {
					// Re-select textarea in case it's an unrecognized key that clears the selection.
					// Then never again, because the next thing might be a blur.
					textarea.select();
				}
			});

			handleKey();
		};

		const onKeypress = (e: KeyboardEvent) => {
			if (e.target !== textarea) return;

			// Call the key handler for repeated keypresses. This excludes keypresses that happen directly after
			// keydown.  In that case, there will be no previous keypress, so we skip it here.
			if (keydown && keypress) handleKey();

			keypress = e;

			checkTextareaFor(typedText);
		};

		const onKeyup = (e: KeyboardEvent) => {
			if (e.target !== textarea) return;

			// Handle the case of no keypress event being sent.
			if (keydown && !keypress) checkTextareaOnce(typedText);
		};

		const typedText = () => {
			// If there is a selection, the contents of the textarea couldn't possibly have just been typed in.  This
			// happens in browsers like Firefox and Opera that fire keypress for keystrokes that are not text entry and
			// leave the selection in the textarea alone, such as Ctrl-C.
			if (hasSelection()) return;

			const text = textarea.value;
			if (text.length === 1) {
				textarea.value = '';
				handlers.typedText(text);
			}
			// In Firefox, keys that don't type text, just clear the selection and fire keypress.
			// https://github.com/mathquill/mathquill/issues/293#issuecomment-40997668
			else if (text && textarea.select)
				textarea.select(); // Re-select if that's why we're here.
		};

		const onBlur = () => { keydown = keypress = null; };

		const onPaste = (e: ClipboardEvent) => {
			if (e.target !== textarea) return;

			// In Linux, middle-click pasting causes onPaste to be called, when the textarea is not necessarily focused.
			// We focus it here to ensure that the pasted text actually ends up in the textarea.
			// It's pretty nifty that by changing focus in this handler, we can change the target of the default action.
			// (Actually, I don't think this is even needed, and is probably not doing anything.)
			textarea.focus();

			// This is a work around for the middle click in Firefox.  In that case the textarea value is not set, but
			// the pasted text is in the event.  So get it here and fallback to this text in the case that the textarea
			// value is not set.
			const pastedText = e.clipboardData?.getData('text') ?? '';

			checkTextareaOnce(() => {
				const text = textarea.value || pastedText;
				textarea.value = '';
				if (text) handlers.paste(text);
			});
		};

		// Attach event handlers
		target.addEventListener('keydown', onKeydown);
		target.addEventListener('keypress', onKeypress);
		target.addEventListener('keyup', onKeyup);
		target.addEventListener('focusout', onBlur);
		target.addEventListener('cut', () => checkTextareaOnce(() => handlers.cut()));
		target.addEventListener('copy', () => checkTextareaOnce(() => handlers.copy()));
		target.addEventListener('paste', onPaste);

		// Export public methods
		return { select };
	};
})();
