import type { Direction, Constructor } from 'src/constants';
import { jQuery, L, R, noop, mqBlockId, LatexCmds } from 'src/constants';
import type { InputOptions } from 'src/options';
import { Options } from 'src/options';
import type { Controller } from 'src/controller';
import type { Node } from 'tree/node';

export interface AbstractMathQuillConstructor {
	new (ctrlr: Controller): AbstractMathQuill;
	RootBlock: Constructor<Node>;
}

export class AbstractMathQuill {
	__controller: Controller;
	__options: Options;
	id: number;
	revert?: () => void;
	static RootBlock?: Constructor<Node>;

	constructor(ctrlr: Controller) {
		this.__controller = ctrlr;
		this.__controller.apiClass = this;
		this.__options = ctrlr.options;
		this.id = ctrlr.id;
	}

	__mathquillify(classNames?: string) {
		const root = this.__controller.root, el = this.__controller.container;
		this.__controller.createTextarea();

		const contents = el.addClass(classNames ?? '').contents().detach();
		root.jQ =
			jQuery('<span class="mq-root-block"/>').attr(mqBlockId, root.id).appendTo(el);
		this.latex(contents.text());

		this.revert = () => el.empty().off()
			.removeClass('mq-editable-field mq-math-mode mq-text-mode')
			.append(contents);
	}

	config(opts: InputOptions) { Options.config(this.__options, opts); return this; }

	el() { return this.__controller.container[0]; }

	text() { return this.__controller.exportText(); }

	latex(latex?: string) {
		if (typeof latex !== 'undefined') {
			this.__controller.renderLatexMath(latex);
			if (this.__controller.blurred) this.__controller.cursor.hide().parent?.blur();
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
	__mathquillify(classNames: string) {
		super.__mathquillify(classNames);
		this.__controller.editable = true;
		this.__controller.delegateMouseEvents();
		this.__controller.editablesTextareaEvents();
		return this;
	}

	focus() { this.__controller.textarea?.focus(); return this; }

	blur() { this.__controller.textarea?.blur(); return this; }

	write(latex: string) {
		this.__controller.writeLatex(latex);
		this.__controller.scrollHoriz();
		if (this.__controller.blurred) this.__controller.cursor.hide().parent?.blur();
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

	cmd(cmd: string) {
		const ctrlr = this.__controller.notify(), cursor = ctrlr.cursor;
		if (/^\\[a-z]+$/i.test(cmd) && !cursor.isTooDeep()) {
			cmd = cmd.slice(1);
			const klass = LatexCmds[cmd];
			if (klass) {
				const newCmd = new klass(cmd);
				if (cursor.selection) newCmd.replaces(cursor.replaceSelection());
				newCmd.createLeftOf(cursor.show());
				this.__controller.scrollHoriz();
			} else {
				// TODO: API needs better error reporting
			}
		} else cursor.parent?.write(cursor, cmd);
		if (ctrlr.blurred) cursor.hide().parent?.blur();
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

	moveToDirEnd(dir: Direction) {
		this.__controller.notify('move').cursor.insAtDirEnd(dir, this.__controller.root);
		return this;
	}
	moveToLeftEnd() { return this.moveToDirEnd(L); }
	moveToRightEnd() { return this.moveToDirEnd(R); }

	keystroke(keys: string) {
		const keyList = keys.replace(/^\s+|\s+$/g, '').split(/\s+/);
		for (const key of keyList) {
			const noPreventDefaultEvent = new Event('noop');
			noPreventDefaultEvent.preventDefault = noop;
			this.__controller.keystroke(key, noPreventDefaultEvent);
		}
		return this;
	}

	typedText(text: string) {
		for (const char of text) {
			this.__controller.typedText(char);
		}
		return this;
	}

	dropEmbedded(
		pageX: number, pageY: number,
		options: { text?: () => string, htmlTemplate?: string, latex?: () => string }
	) {
		const el = document.elementFromPoint(
			pageX - (jQuery(window).scrollLeft() ?? 0),
			pageY - (jQuery(window).scrollTop() ?? 0)
		) as HTMLElement;
		this.__controller.seek(jQuery(el), pageX);
		const cmd = new LatexCmds.embed().setOptions(options);
		cmd.createLeftOf(this.__controller.cursor);
	}

	clickAt(clientX: number, clientY: number, target: HTMLElement | undefined) {
		target = target || (document.elementFromPoint(clientX, clientY) as HTMLElement);

		const ctrlr = this.__controller, root = ctrlr.root;
		if (!jQuery.contains(root.jQ[0], target)) target = root.jQ[0];
		ctrlr.seek(jQuery(target), clientX + window.pageXOffset);
		if (ctrlr.blurred) this.focus();
		return this;
	}

	ignoreNextMousedown(fn: (e?: JQuery.TriggeredEvent) => boolean) {
		this.__controller.cursor.options.ignoreNextMousedown = fn;
		return this;
	}
}
