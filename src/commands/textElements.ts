// Elements for abstract classes of text blocks

import type { Direction } from 'src/constants';
import { mqCmdId, L, R, pray, prayDirection, LatexCmds, CharCmds } from 'src/constants';
import { Parser } from 'services/parser.util';
import type { Cursor } from 'src/cursor';
import { Point } from 'tree/point';
import { VNode } from 'tree/vNode';
import { TNode } from 'tree/node';
import { Fragment } from 'tree/fragment';
import { VanillaSymbol } from 'commands/mathElements';
import { deleteSelectTowardsMixin } from 'src/mixins';
import { BlockFocusBlur } from 'services/focusBlur';

// Blocks of plain text, with one or two TextPiece's as children.
// Represents flat strings of typically serif-font Roman characters, as
// opposed to hierchical, nested, tree-structured math.
// Wraps a single HTMLSpanElement.
export class TextBlock extends BlockFocusBlur(deleteSelectTowardsMixin(TNode)) {
	replacedText?: string;
	anticursorPosition = 0;

	constructor() {
		super();
		this.ctrlSeq = '\\text';
	}

	replaces(replacedText?: string | Fragment) {
		if (replacedText instanceof Fragment)
			this.replacedText = replacedText.remove().elements.text();
		else if (typeof replacedText === 'string')
			this.replacedText = replacedText;
	}

	addToElements(el: VNode) {
		super.addToElements(el);
		this.ends[L]?.addToElements(this.elements.first.firstChild as HTMLElement);
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
			});
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
	unselectInto(dir: Direction, cursor: Cursor) {
		cursor.insAtDirEnd(dir === L ? R : L, this);

		// Split the text at the stored anticursor position, and reconstruct the anticursor.
		const newTextPc = (cursor[dir] as TextPiece).splitRight(this.anticursorPosition);;
		if (dir === L) cursor[L] = newTextPc;
		cursor.anticursor = new Point(this, newTextPc[L], newTextPc);
		cursor.anticursor.ancestors = {};
		for (let ancestor = cursor.anticursor; ancestor.parent; ancestor = ancestor.parent) {
			cursor.anticursor.ancestors[ancestor.parent.id] = ancestor;
		}
	}

	selectOutOf(dir: Direction, cursor: Cursor) {
		this.anticursorPosition = dir === L
			? (cursor.selection?.elements.first.textContent?.length ?? 1) - 1
			: this.textContents().length - (cursor.selection?.elements.first.textContent?.length ?? 1) + 1;
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
			const leftPc = this.ends[L] as TNode;
			leftPc.disown().elements.detach();
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

		// Insert cursor at approx position in DOMTextNode
		const cursorStyle = getComputedStyle(this.elements.firstElement);
		const avgChWidth = (
			this.elements.firstElement.getBoundingClientRect().width
			- parseFloat(cursorStyle.paddingLeft)
			- parseFloat(cursorStyle.paddingRight)
		) / this.text().length;
		const approxPosition =
			Math.round((pageX - this.elements.firstElement.getBoundingClientRect().left) / avgChWidth);
		if (approxPosition <= 0) cursor.insAtLeftEnd(this);
		else if (approxPosition >= textPc.text().length) cursor.insAtRightEnd(this);
		else cursor.insLeftOf(textPc.splitRight(approxPosition));

		// Move towards mousedown (pageX)
		let displ = pageX - cursor.show().offset().left; // displacement
		const dir = displ && displ < 0 ? L : R;
		let prevDispl = dir;
		// displ * prevDispl > 0 iff displacement direction === previous direction
		while (cursor[dir] && displ * prevDispl > 0) {
			cursor[dir]?.moveTowards(dir, cursor);
			prevDispl = displ;
			displ = pageX - cursor.offset().left;
		}
		if (dir * displ < -dir * prevDispl) cursor[dir === L ? R : L]?.moveTowards(dir === L ? R : L, cursor);

		if (!cursor.anticursor) {
			// About to start mouse-selecting, the anticursor is going to be placed here.
			this.anticursorPosition = (cursor[L] && cursor[L]?.text().length) ?? 0;
		} else if (cursor.anticursor.parent === this) {
			// Mouse selecting within this TextBlock, re-insert the anticursor.
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
			// If the text block contains the selection, then that needs to be removed before fuseChildren is called.
			if (this.elements.find('.mq-selection').contents.length) cursor.clearSelection();
			this.fuseChildren();
		}

		this?.getController()?.handle('textBlockExit');
	}

	fuseChildren() {
		this.elements.first.normalize();

		const textPcDom = this.elements.first.firstChild as Text;
		if (!textPcDom) return;
		pray('only node in TextBlock span is Text node', textPcDom.nodeType === 3);
		// nodeType === 3 is a text node.
		// https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType

		const textPc = new TextPiece(textPcDom.data);
		textPc.addToElements(textPcDom);

		this.children().disown();
		return textPc.adopt(this);
	}

	focus() {
		super.focus();

		this.getController()?.handle('textBlockEnter');
	}
}

// A piece of plain text, with a TextBlock as a parent and no children. This wraps a single DOMTextNode.
// For convenience, it has a textStr property that is a string that mirrors the text contents of the DOMTextNode.
// Text contents must always be nonempty.
class TextPiece extends TNode {
	textStr: string;
	dom?: Text;

	constructor(text: string) {
		super();
		this.textStr = text;
	}

	text() { return this.textStr; }

	addToElements(dom: VNode | HTMLElement | Text) {
		this.dom = dom as Text;
		this.elements = new VNode(dom);
	}

	domify() {
		this.addToElements(document.createTextNode(this.textStr));
		return this.elements;
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
		const newPc = new TextPiece(this.textStr.slice(i)).adopt(this.parent as TNode, this, this[R]);
		newPc.addToElements(this.dom?.splitText(i) as Text);
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
				// Note that the order of these 2 lines is important.
				// (the second line mutates this.textStr.length)
				this.dom?.deleteData(-1 + this.textStr.length, 1);
				this.textStr = this.textStr.slice(0, -1);
			}
		} else {
			this.remove();
			this.elements.remove();
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
				if (cursor.selection) newPc.elements.insDirOf(dir === L ? R : L, cursor.selection.elements);
			}

			if (this.textStr.length === 1 && anticursor?.[dir === L ? R : L] === this) {
				anticursor[dir === L ? R : L] = this[dir === L ? R : L];
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
