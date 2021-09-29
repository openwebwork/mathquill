/*********************************************
 * Manage the MathQuill instance's textarea
 * (as owned by the Controller)
 ********************************************/

Options.prototype.substituteTextarea = function() {
	return $('<textarea autocapitalize=off autocomplete=off autocorrect=off ' +
		'spellcheck=false x-palm-disable-ste-all=true />')[0];
};

Controller.prototype.createTextarea = function() {
	const textareaSpan = this.textareaSpan = $('<span class="mq-textarea"></span>');
	const textarea = this.options.substituteTextarea();
	if (!textarea.nodeType) {
		throw 'substituteTextarea() must return a DOM element, got ' + textarea;
	}
	this.textarea = $(textarea).appendTo(textareaSpan);

	this.cursor.selectionChanged = () => this.selectionChanged();
};

Controller.prototype.selectionChanged = function() {
	// throttle calls to setTextareaSelection(), because setting textarea.value
	// and/or calling textarea.select() can have anomalously bad performance:
	// https://github.com/mathquill/mathquill/issues/43#issuecomment-1399080
	if (this.textareaSelectionTimeout === undefined) {
		this.textareaSelectionTimeout = setTimeout(() => this.setTextareaSelection());
	}
};

Controller.prototype.setTextareaSelection = function() {
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
};

Controller.prototype.staticMathTextareaEvents = function() {
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
};

Options.prototype.substituteKeyboardEvents = saneKeyboardEvents;

Controller.prototype.editablesTextareaEvents = function() {
	const textarea = this.textarea, textareaSpan = this.textareaSpan;

	const keyboardEventsShim = this.options.substituteKeyboardEvents(textarea, this);
	this.selectFn = (text) => keyboardEventsShim.select(text);
	this.container.prepend(textareaSpan);
	this.focusBlurEvents();
};

Controller.prototype.unbindEditablesEvents = function() {
	const textarea = this.textarea, textareaSpan = this.textareaSpan;

	this.selectFn = (text) => {
		textarea.val(text);
		if (text) textarea.select();
	};
	textareaSpan.remove();

	this.unbindFocusBlurEvents();

	this.blurred = true;
	textarea.on('cut paste', false);
};

Controller.prototype.typedText = function(ch) {
	if (ch === '\n') return this.handle('enter');
	const cursor = this.notify().cursor;
	cursor.parent.write(cursor, ch);
	this.scrollHoriz();
};

Controller.prototype.cut = function() {
	const cursor = this.cursor;
	if (cursor.selection) {
		setTimeout(() => {
			this.notify('edit'); // deletes selection if present
			cursor.parent.bubble('reflow');
		});
	}
};

Controller.prototype.copy = function() {
	this.setTextareaSelection();
};

Controller.prototype.paste = function(text) {
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
};
