// Elements for abstract classes of text blocks

import type { Direction } from 'src/constants';
import { jQuery, mqCmdId, L, R, pray, prayDirection, LatexCmds, CharCmds } from 'src/constants';
import type { Controller } from 'src/controller';
import { Parser } from 'services/parser.util';
import type { Cursor } from 'src/cursor';
import { Point } from 'tree/point';
import { Node } from 'tree/node';
import { Fragment } from 'tree/fragment';
import { VanillaSymbol } from 'commands/mathElements';
import { deleteSelectTowardsMixin } from 'src/mixins';
import { BlockFocusBlur } from 'services/focusBlur';

// Blocks of plain text, with one or two TextPiece's as children.
// Represents flat strings of typically serif-font Roman characters, as
// opposed to hierchical, nested, tree-structured math.
// Wraps a single HTMLSpanElement.
export class TextBlock extends BlockFocusBlur(deleteSelectTowardsMixin(Node)) {
	replacedText?: string;
	anticursorPosition = 0;

	constructor() {
		super();
		this.ctrlSeq = '\\text';
	}

	replaces(replacedText?: string | Fragment) {
		if (replacedText instanceof Fragment)
			this.replacedText = replacedText.remove().jQ.text();
		else if (typeof replacedText === 'string')
			this.replacedText = replacedText;
	}

	jQadd(jQ: JQuery) {
		super.jQadd(jQ);
		this.ends[L]?.jQadd(this.jQ[0].firstChild as HTMLElement);
	};

	createLeftOf(cursor: Cursor) {
		super.createLeftOf(cursor);

		cursor.insAtRightEnd(this);

		if (this.replacedText) {
			for (const char of this.replacedText)
				this.write(cursor, char);
		}

		this[R]?.siblingCreated?.(cursor.options, L);
		this[L]?.siblingCreated?.(cursor.options, R);
		this.bubble('reflow');
	}

	parser() {
		// TODO: correctly parse text mode
		return Parser.optWhitespace
			.then(Parser.string('{')).then(Parser.regex(/^(\\}|[^}])*/)).skip(Parser.string('}'))
			.map((text: string) => {
				if (text.length === 0) return new Fragment();

				new TextPiece(text.replace(/\\{/g, '{').replace(/\\}/g, '}')).adopt(this);
				return this;
			})
		;
	}

	textContents() {
		return this.foldChildren('', (text, child) => text + child.text());
	}

	text() { return this.textContents(); }

	latex() {
		const contents = this.textContents();
		if (contents.length === 0) return '';
		return '\\text{' + contents.replace(/[{}]/g, '\\$&') + '}';
	}

	html() {
		return `<span class="mq-text-mode" ${mqCmdId}=${this.id}>${this.textContents()}</span>`;
	}

	// editability methods: called by the cursor for editing, cursor movements,
	// and selection of the MathQuill tree, these all take in a direction and
	// the cursor
	moveTowards(dir: Direction, cursor: Cursor) { cursor.insAtDirEnd(dir === L ? R : L, this); }
	moveOutOf(dir: Direction, cursor: Cursor) { cursor.insDirOf(dir, this); }
	unselectInto(dir: Direction, cursor: Cursor) { cursor.insAtDirEnd(dir === L ? R : L, this); }

	selectOutOf(dir: Direction, cursor: Cursor) {
		cursor.insDirOf(dir, this);
	}

	deleteOutOf(dir: Direction, cursor: Cursor) {
		// backspace and delete at ends of block don't unwrap
		if (this.isEmpty()) cursor.insRightOf(this);
	}

	write(cursor: Cursor, ch: string) {
		cursor.show().deleteSelection();

		if (ch !== '$') {
			this.postOrder('reflow');
			if (!cursor[L]) new TextPiece(ch).createLeftOf(cursor);
			else (cursor[L] as unknown as TextPiece).appendText(ch);
			this.bubble('reflow');
		} else if (this.isEmpty()) {
			cursor.insRightOf(this);
			new VanillaSymbol('\\$', '$').createLeftOf(cursor);
		} else if (!cursor[R]) cursor.insRightOf(this);
		else if (!cursor[L]) cursor.insLeftOf(this);
		else { // split apart
			const leftBlock = new TextBlock();
			const leftPc = this.ends[L] as Node;
			leftPc.disown().jQ.detach();
			leftPc.adopt(leftBlock);

			cursor.insLeftOf(this);
			super.createLeftOf.call(leftBlock, cursor); // micro-optimization, not for correctness
		}
		this.bubble('reflow');
	}

	writeLatex(cursor: Cursor, latex: string) {
		if (!cursor[L]) new TextPiece(latex).createLeftOf(cursor);
		else (cursor[L] as unknown as TextPiece).appendText(latex);
		this.bubble('reflow');
	}

	seek(pageX: number, cursor: Cursor) {
		cursor.hide();
		const textPc = this.fuseChildren() as TextPiece;

		// insert cursor at approx position in DOMTextNode
		const avgChWidth = (this.jQ.width() ?? 0) / this.text().length;
		const approxPosition = Math.round((pageX - (this.jQ.offset()?.left ?? 0)) / avgChWidth);
		if (approxPosition <= 0) cursor.insAtLeftEnd(this);
		else if (approxPosition >= textPc.text().length) cursor.insAtRightEnd(this);
		else cursor.insLeftOf(textPc.splitRight(approxPosition));

		// move towards mousedown (pageX)
		let displ = pageX - (cursor.show().offset()?.left ?? 0); // displacement
		const dir = displ && displ < 0 ? L : R;
		let prevDispl = dir;
		// displ * prevDispl > 0 iff displacement direction === previous direction
		while (cursor[dir] && displ * prevDispl > 0) {
			cursor[dir]?.moveTowards(dir, cursor);
			prevDispl = displ;
			displ = pageX - (cursor.offset()?.left ?? 0);
		}
		if (dir * displ < -dir * prevDispl) cursor[dir === L ? R : L]?.moveTowards(dir === L ? R : L, cursor);

		if (!cursor.anticursor) {
			// about to start mouse-selecting, the anticursor is gonna get put here
			this.anticursorPosition = (cursor[L] && cursor[L]?.text().length) ?? 0;
			// ^ get it? 'cos if there's no cursor[L], it's 0... I'm a terrible person.
		} else if (cursor.anticursor.parent === this) {
			// mouse-selecting within this TextBlock, re-insert the anticursor
			const cursorPosition = (cursor[L] && cursor[L]?.text().length) ?? 0;
			if (this.anticursorPosition === cursorPosition) {
				cursor.startSelection();
			} else {
				let newTextPc;
				if (this.anticursorPosition < cursorPosition) {
					newTextPc = (cursor[L] as TextPiece).splitRight(this.anticursorPosition);
					cursor[L] = newTextPc;
				} else {
					newTextPc = (cursor[R] as TextPiece).splitRight(this.anticursorPosition - cursorPosition);
				}
				cursor.anticursor = new Point(this, newTextPc[L], newTextPc);
				cursor.anticursor.ancestors = {};
				for (let ancestor = cursor.anticursor; ancestor.parent; ancestor = ancestor.parent) {
					cursor.anticursor.ancestors[ancestor.parent.id] = ancestor;
				}
			}
		}
	}

	blur(cursor?: Cursor) {
		super.blur();

		if (!cursor) return;
		if (this.textContents() === '') {
			this.remove();
			if (cursor[L] === this) cursor[L] = this[L];
			else if (cursor[R] === this) cursor[R] = this[R];
		} else {
			cursor.clearSelection();
			this.fuseChildren();
		}

		(function getCtrlr(node?: Node): Controller {
			return (node?.controller) ? node?.controller : getCtrlr(node?.parent);
		})(cursor.parent).handle('textBlockExit');
	}

	fuseChildren() {
		this.jQ[0].normalize();

		const textPcDom = this.jQ[0].firstChild as Text;
		if (!textPcDom) return;
		pray('only node in TextBlock span is Text node', textPcDom.nodeType === 3);
		// nodeType === 3 has meant a Text node since ancient times:
		// https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType

		const textPc = new TextPiece(textPcDom.data);
		textPc.jQadd(textPcDom);

		this.children().disown();
		return textPc.adopt(this);
	}

	focus() {
		super.focus();

		(function getCtrlr(node?: Node): Controller {
			return (node?.controller) ? node?.controller : getCtrlr(node?.parent);
		})(this).handle('textBlockEnter');
	}
}

// Piece of plain text, with a TextBlock as a parent and no children.
// Wraps a single DOMTextNode.
// For convenience, has a .text property that's just a JavaScript string
// mirroring the text contents of the DOMTextNode.
// Text contents must always be nonempty.
class TextPiece extends Node {
	textStr: string;
	dom?: Text;

	constructor(text: string) {
		super();
		this.textStr = text;
	}

	text() { return this.textStr; }

	jQadd(dom: JQuery | HTMLElement | Text) { this.dom = dom as Text; this.jQ = jQuery(dom as HTMLElement); }

	jQize() {
		this.jQadd(document.createTextNode(this.textStr));
		return this.jQ;
	}

	appendText(text: string) {
		this.textStr += text;
		this.dom?.appendData(text);
	}

	prependText(text: string) {
		this.textStr = text + this.textStr;
		this.dom?.insertData(0, text);
	}

	insTextAtDirEnd(text: string, dir: Direction) {
		prayDirection(dir);
		if (dir === R) this.appendText(text);
		else this.prependText(text);
	}

	splitRight(i: number) {
		const newPc = new TextPiece(this.textStr.slice(i)).adopt(this.parent as Node, this, this[R]);
		newPc.jQadd(this.dom?.splitText(i) as Text);
		this.textStr = this.textStr.slice(0, i);
		return newPc;
	}

	endChar(dir: Direction, text: string) {
		return text.charAt(dir === L ? 0 : -1 + text.length);
	}

	moveTowards(dir: Direction, cursor: Cursor) {
		prayDirection(dir);

		const ch = this.endChar(dir === L ? R : L, this.textStr);

		const from = this[dir === L ? R : L] as TextPiece;
		if (from) from.insTextAtDirEnd(ch, dir);
		else new TextPiece(ch).createDir(dir === L ? R : L, cursor);

		return this.deleteTowards(dir, cursor);
	}

	latex() { return this.textStr; }

	deleteTowards(dir: Direction, cursor: Cursor) {
		if (this.textStr.length > 1) {
			if (dir === R) {
				this.dom?.deleteData(0, 1);
				this.textStr = this.textStr.slice(1);
			} else {
				// note that the order of these 2 lines is annoyingly important
				// (the second line mutates this.text.length)
				this.dom?.deleteData(-1 + this.textStr.length, 1);
				this.textStr = this.textStr.slice(0, -1);
			}
		} else {
			this.remove();
			this.jQ.remove();
			cursor[dir] = this[dir];
		}
	}

	selectTowards(dir: Direction, cursor: Cursor) {
		prayDirection(dir);
		const anticursor = cursor.anticursor;

		const ch = this.endChar(dir === L ? R : L, this.textStr);

		if (anticursor?.[dir] === this) {
			const newPc = new TextPiece(ch).createDir(dir, cursor);
			anticursor[dir] = newPc;
			cursor.insDirOf(dir, newPc);
		} else {
			const from = this[dir === L ? R : L] as TextPiece;
			if (from) from.insTextAtDirEnd(ch, dir);
			else {
				const newPc = new TextPiece(ch).createDir(dir === L ? R : L, cursor);
				newPc.jQ.insDirOf(dir === L ? R : L, cursor.selection?.jQ as JQuery<HTMLElement>);
			}

			if (this.textStr.length === 1 && anticursor?.[dir === L ? R : L] === this) {
				anticursor[dir === L ? R : L] = this[dir === L ? R : L];
				// `this` will be removed in deleteTowards
			}
		}

		return this.deleteTowards(dir, cursor);
	}
}

LatexCmds.text = LatexCmds.textnormal = LatexCmds.textrm = LatexCmds.textup = CharCmds['"'] = LatexCmds.textmd =
	TextBlock;

const makeTextBlock = (latex: string, tagName: string, attrs: string) => class extends TextBlock {
	htmlTemplate: string;

	constructor() {
		super();
		this.ctrlSeq = latex;
		this.htmlTemplate = `<${tagName} ${attrs}>&0</${tagName}>`;
	}
};

LatexCmds.em = LatexCmds.italic = LatexCmds.italics =
	LatexCmds.emph = LatexCmds.textit = LatexCmds.textsl =
	makeTextBlock('\\textit', 'i', 'class="mq-text-mode"');
LatexCmds.strong = LatexCmds.bold = LatexCmds.textbf =
	makeTextBlock('\\textbf', 'b', 'class="mq-text-mode"');
LatexCmds.sf = LatexCmds.textsf =
	makeTextBlock('\\textsf', 'span', 'class="mq-sans-serif mq-text-mode"');
LatexCmds.tt = LatexCmds.texttt =
	makeTextBlock('\\texttt', 'span', 'class="mq-monospace mq-text-mode"');
LatexCmds.textsc =
	makeTextBlock('\\textsc', 'span', 'style="font-variant:small-caps" class="mq-text-mode"');
LatexCmds.uppercase =
	makeTextBlock('\\uppercase', 'span', 'style="text-transform:uppercase" class="mq-text-mode"');
LatexCmds.lowercase =
	makeTextBlock('\\lowercase', 'span', 'style="text-transform:lowercase" class="mq-text-mode"');
