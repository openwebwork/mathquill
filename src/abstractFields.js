import { jQuery, L, R, noop, mqBlockId, LatexCmds } from 'src/constants';
import { Options } from 'src/options';

export class AbstractMathQuill {
	constructor(ctrlr) {
		this.__controller = ctrlr;
		this.__controller.apiClass = this;
		this.__options = ctrlr.options;
		this.id = ctrlr.id;
		// FIXME: I don't think this is used at all.
		this.data = ctrlr.data;
	}

	__mathquillify(classNames) {
		const root = this.__controller.root, el = this.__controller.container;
		this.__controller.createTextarea();

		const contents = el.addClass(classNames).contents().detach();
		root.jQ =
			jQuery('<span class="mq-root-block"/>').attr(mqBlockId, root.id).appendTo(el);
		this.latex(contents.text());

		this.revert = () => el.empty().off()
			.removeClass('mq-editable-field mq-math-mode mq-text-mode')
			.append(contents);
	}

	config(opts) { Options.config(this.__options, opts); return this; }

	el() { return this.__controller.container[0]; }

	text() { return this.__controller.exportText(); }

	latex(latex) {
		if (arguments.length > 0) {
			this.__controller.renderLatexMath(latex);
			if (this.__controller.blurred) this.__controller.cursor.hide().parent.blur();
			return this;
		}
		return this.__controller.exportLatex();
	}

	html() {
		return this.__controller.root.jQ.html()
			.replace(/ mathquill-(?:command|block)-id="?\d+"?/g, '')
			.replace(/<span class="?mq-cursor( mq-blink)?"?>.?<\/span>/i, '')
			.replace(/ mq-hasCursor|mq-hasCursor ?/, '')
			.replace(/ class=(""|(?= |>))/g, '');
	}

	reflow() {
		this.__controller.root.postOrder('reflow');
		return this;
	}
}

export class EditableField extends AbstractMathQuill {
	__mathquillify(...args) {
		super.__mathquillify(...args);
		this.__controller.editable = true;
		this.__controller.delegateMouseEvents();
		this.__controller.editablesTextareaEvents();
		return this;
	}

	focus() { this.__controller.textarea.focus(); return this; }

	blur() { this.__controller.textarea.blur(); return this; }

	write(latex) {
		this.__controller.writeLatex(latex);
		this.__controller.scrollHoriz();
		if (this.__controller.blurred) this.__controller.cursor.hide().parent.blur();
		return this;
	}

	empty() {
		const root = this.__controller.root, cursor = this.__controller.cursor;
		root.eachChild('postOrder', 'dispose');
		delete root.ends[L];
		delete root.ends[R];
		root.jQ.empty();
		delete cursor.selection;
		cursor.insAtRightEnd(root);
		return this;
	}

	cmd(cmd) {
		const ctrlr = this.__controller.notify(), cursor = ctrlr.cursor;
		if (/^\\[a-z]+$/i.test(cmd) && !cursor.isTooDeep()) {
			cmd = cmd.slice(1);
			const klass = LatexCmds[cmd];
			if (klass) {
				cmd = new klass(cmd);
				if (cursor.selection) cmd.replaces(cursor.replaceSelection());
				cmd.createLeftOf(cursor.show());
				this.__controller.scrollHoriz();
			} else {
				// TODO: API needs better error reporting
			}
		}
		else cursor.parent.write(cursor, cmd);
		if (ctrlr.blurred) cursor.hide().parent.blur();
		return this;
	}

	select() {
		const ctrlr = this.__controller;
		ctrlr.notify('move').cursor.insAtRightEnd(ctrlr.root);
		while (ctrlr.cursor[L]) ctrlr.selectLeft();
		return this;
	}

	clearSelection() {
		this.__controller.cursor.clearSelection();
		return this;
	}

	moveToDirEnd(dir) {
		this.__controller.notify('move').cursor.insAtDirEnd(dir, this.__controller.root);
		return this;
	}
	moveToLeftEnd() { return this.moveToDirEnd(L); }
	moveToRightEnd() { return this.moveToDirEnd(R); }

	keystroke(keys) {
		const keyList = keys.replace(/^\s+|\s+$/g, '').split(/\s+/);
		for (const key of keyList) {
			this.__controller.keystroke(key, { preventDefault: noop });
		}
		return this;
	}

	typedText(text) {
		for (const char of text) {
			this.__controller.typedText(char);
		}
		return this;
	}

	dropEmbedded(pageX, pageY, options) {
		const el = document.elementFromPoint(pageX - jQuery(window).scrollLeft(), pageY - jQuery(window).scrollTop());
		this.__controller.seek(jQuery(el), pageX, pageY);
		const cmd = new LatexCmds.embed().setOptions(options);
		cmd.createLeftOf(this.__controller.cursor);
	}

	clickAt(clientX, clientY, target) {
		target = target || document.elementFromPoint(clientX, clientY);

		const ctrlr = this.__controller, root = ctrlr.root;
		if (!jQuery.contains(root.jQ[0], target)) target = root.jQ[0];
		ctrlr.seek(jQuery(target), clientX + window.pageXOffset, clientY + window.pageYOffset);
		if (ctrlr.blurred) this.focus();
		return this;
	}

	ignoreNextMousedown(fn) {
		this.__controller.cursor.options.ignoreNextMousedown = fn;
		return this;
	}
}
