// Manage the MathQuill instance's textarea (as owned by the Controller)

export const TextAreaController = (base) => class extends base {
	createTextarea() {
		const textareaSpan = this.textareaSpan = $('<span class="mq-textarea"></span>');
		const textarea = this.options.substituteTextarea();
		if (!textarea.nodeType) {
			throw 'substituteTextarea() must return a DOM element, got ' + textarea;
		}
		this.textarea = $(textarea).appendTo(textareaSpan);

		this.cursor.selectionChanged = () => this.selectionChanged();
	}

	selectionChanged() {
		// throttle calls to setTextareaSelection(), because setting textarea.value
		// and/or calling textarea.select() can have anomalously bad performance:
		// https://github.com/mathquill/mathquill/issues/43#issuecomment-1399080
		if (this.textareaSelectionTimeout === undefined) {
			this.textareaSelectionTimeout = setTimeout(() => this.setTextareaSelection());
		}
	}

	setTextareaSelection() {
		this.textareaSelectionTimeout = undefined;
		let latex = '';
		if (this.cursor.selection) {
			latex = this.cursor.selection.join('latex');
			if (this.options.statelessClipboard) {
				// FIXME: like paste, only this works for math fields; should ask parent
				latex = `$${latex}$`;
			}
		}
		this.selectFn(latex);
	}

	staticMathTextareaEvents() {
		const cursor = this.cursor,
			textarea = this.textarea, textareaSpan = this.textareaSpan;

		this.container.prepend(jQuery('<span class="mq-selectable">')
			.text(`$${this.exportLatex()}$`));
		this.blurred = true;

		const detach = () => {
			textareaSpan.detach();
			this.blurred = true;
		}

		textarea.on('cut paste', false)
			.on('copy', () => this.setTextareaSelection())
			.focus(() => this.blurred = false).blur(() => {
				if (cursor.selection) cursor.selection.clear();
				setTimeout(detach); //detaching during blur explodes in WebKit
			});

		this.selectFn = (text) => {
			textarea.val(text);
			if (text) textarea.select();
		};
	}

	editablesTextareaEvents() {
		const textarea = this.textarea, textareaSpan = this.textareaSpan;

		const keyboardEventsShim = this.options.substituteKeyboardEvents(textarea, this);
		this.selectFn = (text) => keyboardEventsShim.select(text);
		this.container.prepend(textareaSpan);
		this.focusBlurEvents();
	}

	unbindEditablesEvents() {
		const textarea = this.textarea, textareaSpan = this.textareaSpan;

		this.selectFn = (text) => {
			textarea.val(text);
			if (text) textarea.select();
		};
		textareaSpan.remove();

		this.unbindFocusBlurEvents();

		this.blurred = true;
		textarea.on('cut paste', false);
	}

	typedText(ch) {
		if (ch === '\n') return this.handle('enter');
		const cursor = this.notify().cursor;
		cursor.parent.write(cursor, ch);
		this.scrollHoriz();
	}

	cut() {
		const cursor = this.cursor;
		if (cursor.selection) {
			setTimeout(() => {
				this.notify('edit'); // deletes selection if present
				cursor.parent.bubble('reflow');
			});
		}
	}

	copy() {
		this.setTextareaSelection();
	}

	paste(text) {
		// TODO: document `statelessClipboard` config option in README, after
		// making it work like it should, that is, in both text and math mode
		// (currently only works in math fields, so worse than pointless, it
		//  only gets in the way by \text{}-ifying pasted stuff and $-ifying
		//  cut/copied LaTeX)
		if (this.options.statelessClipboard) {
			if (text.slice(0, 1) === '$' && text.slice(-1) === '$') {
				text = text.slice(1, -1);
			} else {
				text = `\\text{${text}}`;
			}
		}
		// FIXME: this always inserts math or a TextBlock, even in a RootTextBlock
		this.writeLatex(text).cursor.show();
	}
}
