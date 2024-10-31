import type { Direction, Constructor } from 'src/constants';
import { noop, mqBlockId, mqCmdId, LatexCmds } from 'src/constants';
import type { InputOptions } from 'src/options';
import { Options } from 'src/options';
import type { Controller } from 'src/controller';
import type { TNode } from 'tree/node';

export interface AbstractMathQuillConstructor {
	new (ctrlr: Controller): AbstractMathQuill;
	RootBlock: Constructor<TNode>;
}

export class AbstractMathQuill {
	__controller: Controller;
	__options: Options;
	id: number;
	revert?: () => HTMLElement;
	static RootBlock?: Constructor<TNode>;

	constructor(ctrlr: Controller) {
		this.__controller = ctrlr;
		this.__controller.apiClass = this;
		this.__options = ctrlr.options;
		this.id = ctrlr.id;
	}

	__mathquillify(...classNames: string[]) {
		const root = this.__controller.root,
			el = this.__controller.container;
		this.__controller.createTextarea();

		el.classList.add(...classNames);
		const contents = Array.from(el.childNodes).map((child) => el.removeChild(child));

		const rootEl = document.createElement('span');
		rootEl.classList.add('mq-root-block');
		rootEl.setAttribute(mqBlockId, root.id.toString());
		root.elements.add(rootEl);
		el.append(rootEl);

		this.latex(
			contents.reduce(
				(ret: string, child) => (child.nodeType === 8 ? ret : `${ret}${child.textContent ?? ''}`),
				''
			)
		);

		this.revert = () => {
			while (el.firstChild) el.firstChild.remove();
			el.classList.remove('mq-editable-field', 'mq-math-mode', 'mq-text-mode');
			if (this.__controller.mouseDownHandler)
				el.removeEventListener('mousedown', this.__controller.mouseDownHandler);
			el.append(...contents);
			return el;
		};

		return this;
	}

	get options() {
		return this.__options;
	}
	config(opts: InputOptions) {
		Options.config(this.__options, opts);
		return this;
	}

	el() {
		return this.__controller.container;
	}

	text() {
		return this.__controller.exportText();
	}

	latex(latex: string): this;
	latex(): string;
	latex(latex?: string) {
		if (typeof latex !== 'undefined') {
			this.__controller.renderLatexMath(latex);
			if (this.__controller.blurred) this.__controller.cursor.hide().parent?.blur();
			return this;
		}
		return this.__controller.exportLatex();
	}

	html() {
		return this.__controller.root.elements
			.html()
			.replace(new RegExp(` (?:${mqBlockId}|${mqCmdId})="?\\d+"?`, 'g'), '')
			.replace(/<span class="?mq-cursor( mq-blink)?"?>.?<\/span>/i, '')
			.replace(/ mq-has-cursor|mq-has-cursor ?/, '')
			.replace(/ class=(""|(?= |>))/g, '');
	}

	reflow() {
		this.__controller.root.postOrder('reflow');
		return this;
	}
}

export class EditableField extends AbstractMathQuill {
	__mathquillify(...classNames: string[]) {
		super.__mathquillify(...classNames);
		this.__controller.editable = true;
		this.__controller.delegateMouseEvents();
		this.__controller.editablesTextareaEvents();
		return this;
	}

	focus() {
		if (document.activeElement === this.__controller.textarea)
			this.__controller.textarea.dispatchEvent(new FocusEvent('focus'));
		else this.__controller.textarea?.focus();
		return this;
	}

	blur() {
		if (document.activeElement !== this.__controller.textarea)
			this.__controller.textarea?.dispatchEvent(new FocusEvent('blur'));
		else this.__controller.textarea.blur();
		return this;
	}

	write(latex: string) {
		this.__controller.writeLatex(latex);
		this.__controller.scrollHoriz();
		if (this.__controller.blurred) this.__controller.cursor.hide().parent?.blur();
		return this;
	}

	empty() {
		const root = this.__controller.root,
			cursor = this.__controller.cursor;
		root.eachChild('postOrder', 'dispose');
		delete root.ends.left;
		delete root.ends.right;
		root.elements.empty();
		delete cursor.selection;
		cursor.insAtRightEnd(root);
		return this;
	}

	cmd(cmd: string) {
		const ctrlr = this.__controller.notify(),
			cursor = ctrlr.cursor;
		if (/^\\[a-z]+$/i.test(cmd) && !cursor.isTooDeep()) {
			cmd = cmd.slice(1);
			const klass = LatexCmds[cmd] as Constructor<TNode> | undefined;
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
		while (ctrlr.cursor.left) ctrlr.selectLeft();
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
	moveToLeftEnd() {
		return this.moveToDirEnd('left');
	}
	moveToRightEnd() {
		return this.moveToDirEnd('right');
	}

	keystroke(keys: string) {
		const keyList = keys.replace(/^\s+|\s+$/g, '').split(/\s+/);
		for (const key of keyList) {
			const noPreventDefaultEvent = new KeyboardEvent('noop');
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
		pageX: number,
		pageY: number,
		options: { text?: () => string; htmlString?: string; latex?: () => string }
	) {
		const el = document.elementFromPoint(pageX - window.scrollX, pageY - window.scrollY);
		this.__controller.seek(el, pageX);
		const cmd = new LatexCmds.embed().setOptions(options);
		cmd.createLeftOf(this.__controller.cursor);
	}

	clickAt(clientX: number, clientY: number, target?: Element | null) {
		target = target || document.elementFromPoint(clientX, clientY);

		const ctrlr = this.__controller,
			root = ctrlr.root;
		if (!root.elements.firstElement.contains(target)) target = root.elements.firstElement;
		ctrlr.seek(target, clientX + window.scrollX);
		if (ctrlr.blurred) this.focus();
		return this;
	}

	ignoreNextMousedown(fn: (e?: MouseEvent) => boolean) {
		this.__controller.cursor.options.ignoreNextMousedown = fn;
		return this;
	}
}
