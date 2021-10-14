// Elements for abstract classes of text blocks

import { L, R, pray, prayDirection, LatexCmds, CharCmds } from 'src/constants';
import { Parser } from 'services/parser.util';
import { Point } from 'tree/point';
import { Node } from 'tree/node';
import { Fragment } from 'tree/fragment';
import { VanillaSymbol, MathCommand } from 'commands/mathElements';
import { deleteSelectTowardsMixin, writeMethodMixin } from 'src/mixins';
import { BlockFocusBlur } from 'services/focusBlur';

// Blocks of plain text, with one or two TextPiece's as children.
// Represents flat strings of typically serif-font Roman characters, as
// opposed to hierchical, nested, tree-structured math.
// Wraps a single HTMLSpanElement.
export class TextBlock extends BlockFocusBlur(deleteSelectTowardsMixin(Node)) {
	constructor() {
		super();
		this.ctrlSeq = '\\text';
	}

	replaces(replacedText) {
		if (replacedText instanceof Fragment)
			this.replacedText = replacedText.remove().jQ.text();
		else if (typeof replacedText === 'string')
			this.replacedText = replacedText;
	}

	jQadd(jQ) {
		super.jQadd(jQ);
		if (this.ends[L]) this.ends[L].jQadd(this.jQ[0].firstChild);
	};

	createLeftOf(cursor) {
		super.createLeftOf(cursor);

		cursor.insAtRightEnd(this);

		if (this.replacedText) {
			for (const char of this.replacedText)
				this.write(cursor, char);
		}

		if (this[R].siblingCreated) this[R].siblingCreated(cursor.options, L);
		if (this[L].siblingCreated) this[L].siblingCreated(cursor.options, R);
		this.bubble('reflow');
	}

	parser() {
		// TODO: correctly parse text mode
		const string = Parser.string;
		const regex = Parser.regex;
		const optWhitespace = Parser.optWhitespace;
		return optWhitespace
			.then(string('{')).then(regex(/^(\\}|[^}])*/)).skip(string('}'))
			.map((text) => {
				if (text.length === 0) return new Fragment();

				new TextPiece(text.replace(/\\{/g, '{').replace(/\\}/g, '}')).adopt(this, 0, 0);
				return this;
			})
		;
	}

	textContents() {
		return this.foldChildren('', (text, child) => text + child.text);
	}

	text() { return this.textContents(); }

	latex() {
		const contents = this.textContents();
		if (contents.length === 0) return '';
		return '\\text{' + contents.replace(/[{}]/g, '\\$&') + '}';
	}

	html() {
		return (
			'<span class="mq-text-mode" mathquill-command-id=' + this.id + '>'
			+ this.textContents()
			+ '</span>'
		);
	}

	// editability methods: called by the cursor for editing, cursor movements,
	// and selection of the MathQuill tree, these all take in a direction and
	// the cursor
	moveTowards(dir, cursor) { cursor.insAtDirEnd(-dir, this); }
	moveOutOf(dir, cursor) { cursor.insDirOf(dir, this); }
	unselectInto(dir, cursor) { cursor.insAtDirEnd(-dir, this); }

	selectOutOf(dir, cursor) {
		cursor.insDirOf(dir, this);
	}

	deleteOutOf(dir, cursor) {
		// backspace and delete at ends of block don't unwrap
		if (this.isEmpty()) cursor.insRightOf(this);
	}

	write(cursor, ch) {
		cursor.show().deleteSelection();

		if (ch !== '$') {
			this.postOrder('reflow');
			if (!cursor[L]) new TextPiece(ch).createLeftOf(cursor);
			else cursor[L].appendText(ch);
			this.bubble('reflow');
		}
		else if (this.isEmpty()) {
			cursor.insRightOf(this);
			new VanillaSymbol('\\$','$').createLeftOf(cursor);
		}
		else if (!cursor[R]) cursor.insRightOf(this);
		else if (!cursor[L]) cursor.insLeftOf(this);
		else { // split apart
			const leftBlock = new TextBlock();
			const leftPc = this.ends[L];
			leftPc.disown().jQ.detach();
			leftPc.adopt(leftBlock, 0, 0);

			cursor.insLeftOf(this);
			super.createLeftOf.call(leftBlock, cursor); // micro-optimization, not for correctness
		}
		this.bubble('reflow');
	}

	writeLatex(cursor, latex) {
		if (!cursor[L]) new TextPiece(latex).createLeftOf(cursor);
		else cursor[L].appendText(latex);
		this.bubble('reflow');
	}

	seek(pageX, cursor) {
		cursor.hide();
		const textPc = this.fuseChildren();

		// insert cursor at approx position in DOMTextNode
		const avgChWidth = this.jQ.width()/this.text.length;
		const approxPosition = Math.round((pageX - this.jQ.offset().left) / avgChWidth);
		if (approxPosition <= 0) cursor.insAtLeftEnd(this);
		else if (approxPosition >= textPc.text.length) cursor.insAtRightEnd(this);
		else cursor.insLeftOf(textPc.splitRight(approxPosition));

		// move towards mousedown (pageX)
		let displ = pageX - cursor.show().offset().left; // displacement
		const dir = displ && displ < 0 ? L : R;
		let prevDispl = dir;
		// displ * prevDispl > 0 iff displacement direction === previous direction
		while (cursor[dir] && displ * prevDispl > 0) {
			cursor[dir].moveTowards(dir, cursor);
			prevDispl = displ;
			displ = pageX - cursor.offset().left;
		}
		if (dir * displ < -dir * prevDispl) cursor[-dir].moveTowards(-dir, cursor);

		if (!cursor.anticursor) {
			// about to start mouse-selecting, the anticursor is gonna get put here
			this.anticursorPosition = cursor[L] && cursor[L].text.length;
			// ^ get it? 'cos if there's no cursor[L], it's 0... I'm a terrible person.
		}
		else if (cursor.anticursor.parent === this) {
			// mouse-selecting within this TextBlock, re-insert the anticursor
			const cursorPosition = cursor[L] && cursor[L].text.length;;
			if (this.anticursorPosition === cursorPosition) {
				cursor.anticursor = Point.copy(cursor);
			}
			else {
				let newTextPc;
				if (this.anticursorPosition < cursorPosition) {
					newTextPc = cursor[L].splitRight(this.anticursorPosition);
					cursor[L] = newTextPc;
				}
				else {
					newTextPc = cursor[R].splitRight(this.anticursorPosition - cursorPosition);
				}
				cursor.anticursor = new Point(this, newTextPc[L], newTextPc);
			}
		}
	}

	blur(cursor) {
		super.blur();

		if (!cursor) return;
		if (this.textContents() === '') {
			this.remove();
			if (cursor[L] === this) cursor[L] = this[L];
			else if (cursor[R] === this) cursor[R] = this[R];
		}
		else this.fuseChildren();

		(function getCtrlr(node) {
			return (node.controller) ? node.controller : getCtrlr(node.parent);
		})(cursor.parent).handle('textBlockExit');
	}

	fuseChildren() {
		this.jQ[0].normalize();

		const textPcDom = this.jQ[0].firstChild;
		if (!textPcDom) return;
		pray('only node in TextBlock span is Text node', textPcDom.nodeType === 3);
		// nodeType === 3 has meant a Text node since ancient times:
		//   http://reference.sitepoint.com/javascript/Node/nodeType

		const textPc = new TextPiece(textPcDom.data);
		textPc.jQadd(textPcDom);

		this.children().disown();
		return textPc.adopt(this, 0, 0);
	}

	focus() {
		super.focus();

		(function getCtrlr(node) {
			return (node.controller) ? node.controller : getCtrlr(node.parent);
		})(this).handle('textBlockEnter');
	}
}

// Piece of plain text, with a TextBlock as a parent and no children.
// Wraps a single DOMTextNode.
// For convenience, has a .text property that's just a JavaScript string
// mirroring the text contents of the DOMTextNode.
// Text contents must always be nonempty.
class TextPiece extends Node {
	constructor(text) {
		super();
		this.text = text;
	}

	jQadd(dom) { this.dom = dom; this.jQ = $(dom); }

	jQize() {
		return this.jQadd(document.createTextNode(this.text));
	}

	appendText(text) {
		this.text += text;
		this.dom.appendData(text);
	}

	prependText(text) {
		this.text = text + this.text;
		this.dom.insertData(0, text);
	}

	insTextAtDirEnd(text, dir) {
		prayDirection(dir);
		if (dir === R) this.appendText(text);
		else this.prependText(text);
	}

	splitRight(i) {
		const newPc = new TextPiece(this.text.slice(i)).adopt(this.parent, this, this[R]);
		newPc.jQadd(this.dom.splitText(i));
		this.text = this.text.slice(0, i);
		return newPc;
	}

	endChar(dir, text) {
		return text.charAt(dir === L ? 0 : -1 + text.length);
	}

	moveTowards(dir, cursor) {
		prayDirection(dir);

		const ch = this.endChar(-dir, this.text)

		const from = this[-dir];
		if (from) from.insTextAtDirEnd(ch, dir);
		else new TextPiece(ch).createDir(-dir, cursor);

		return this.deleteTowards(dir, cursor);
	}

	latex() { return this.text; }

	deleteTowards(dir, cursor) {
		if (this.text.length > 1) {
			if (dir === R) {
				this.dom.deleteData(0, 1);
				this.text = this.text.slice(1);
			}
			else {
				// note that the order of these 2 lines is annoyingly important
				// (the second line mutates this.text.length)
				this.dom.deleteData(-1 + this.text.length, 1);
				this.text = this.text.slice(0, -1);
			}
		}
		else {
			this.remove();
			this.jQ.remove();
			cursor[dir] = this[dir];
		}
	}

	selectTowards(dir, cursor) {
		prayDirection(dir);
		const anticursor = cursor.anticursor;

		const ch = this.endChar(-dir, this.text)

		if (anticursor[dir] === this) {
			const newPc = new TextPiece(ch).createDir(dir, cursor);
			anticursor[dir] = newPc;
			cursor.insDirOf(dir, newPc);
		}
		else {
			const from = this[-dir];
			if (from) from.insTextAtDirEnd(ch, dir);
			else {
				const newPc = new TextPiece(ch).createDir(-dir, cursor);
				newPc.jQ.insDirOf(-dir, cursor.selection.jQ);
			}

			if (this.text.length === 1 && anticursor[-dir] === this) {
				anticursor[-dir] = this[-dir]; // `this` will be removed in deleteTowards
			}
		}

		return this.deleteTowards(dir, cursor);
	}
}

LatexCmds.text =
	LatexCmds.textnormal =
	LatexCmds.textrm =
	LatexCmds.textup =
	CharCmds['"'] =
	LatexCmds.textmd = TextBlock;

const makeTextBlock = (latex, tagName, attrs) => class extends TextBlock {
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

export class RootMathCommand extends writeMethodMixin(MathCommand) {
	constructor(cursor) {
		super('$');
		this.cursor = cursor;
		this.htmlTemplate = '<span class="mq-math-mode">&0</span>';
	}

	createBlocks() {
		super.createBlocks();

		this.ends[L].cursor = this.cursor;
		this.ends[L].write = function(cursor, ch) {
			if (ch !== '$')
				this.write(cursor, ch);
			else if (this.isEmpty()) {
				cursor.insRightOf(this.parent);
				this.parent.deleteTowards(dir, cursor);
				new VanillaSymbol('\\$', '$').createLeftOf(cursor.show());
			}
			else if (!cursor[R])
				cursor.insRightOf(this.parent);
			else if (!cursor[L])
				cursor.insLeftOf(this.parent);
			else
				this.write(cursor, ch);
		};
	}

	latex() {
		return `$${this.ends[L].latex()}$`;
	}
}
