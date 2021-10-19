import { L, R, LatexCmds, CharCmds } from 'src/constants';
import { Parser } from 'services/parser.util';
import { BlockFocusBlur } from 'services/focusBlur';
import { RootBlockMixin, writeMethodMixin } from 'src/mixins';
import { VanillaSymbol, MathElement, Letter, Digit, latexMathParser } from 'commands/mathElements';

// Children and parent of MathCommand's. Basically partitions all the
// symbols and operators that descend (in the Math DOM tree) from
// ancestor operators.
export class MathBlock extends BlockFocusBlur(writeMethodMixin(MathElement)) {
	join(methodName) {
		return this.foldChildren('', (fold, child) => fold + child[methodName]());
	}

	html() { return this.join('html'); }

	latex() { return this.join('latex'); }

	text() {
		return (this.ends[L] === this.ends[R] && this.ends[L] !== 0) ?
			this.ends[L].text() :
			this.join('text')
		;
	}

	keystroke(key, e, ctrlr, ...args) {
		if (ctrlr.options.spaceBehavesLikeTab &&
			(key === 'Spacebar' || key === 'Shift-Spacebar')) {
			e.preventDefault();
			ctrlr.escapeDir(key === 'Shift-Spacebar' ? L : R, key, e);
			return;
		}
		return super.keystroke(key, e, ctrlr, ...args);
	}

	// editability methods: called by the cursor for editing, cursor movements,
	// and selection of the MathQuill tree, these all take in a direction and
	// the cursor
	moveOutOf(dir, cursor, updown) {
		const updownInto = updown && this.parent[`${updown}Into`];
		if (!updownInto && this[dir]) cursor.insAtDirEnd(-dir, this[dir]);
		else cursor.insDirOf(dir, this.parent);
	}

	selectOutOf(dir, cursor) {
		cursor.insDirOf(dir, this.parent);
	}

	deleteOutOf(dir, cursor) {
		cursor.unwrapGramp();
	}

	seek(pageX, cursor) {
		let node = this.ends[R];
		if (!node || node.jQ.offset().left + node.jQ.outerWidth() < pageX) {
			return cursor.insAtRightEnd(this);
		}
		if (pageX < this.ends[L].jQ.offset().left) return cursor.insAtLeftEnd(this);
		while (pageX < node.jQ.offset().left) node = node[L];
		return node.seek(pageX, cursor);
	}

	chToCmd(ch, options) {
		const cons = CharCmds[ch] || LatexCmds[ch];
		// exclude f because it gets a dedicated command with more spacing
		if (ch.match(/^[a-eg-zA-Z]$/))
			return new Letter(ch);
		else if (/^\d$/.test(ch))
			return new Digit(ch);
		else if (options && options.typingSlashWritesDivisionSymbol && ch === '/')
			return new LatexCmds['\u00f7'](ch);
		else if (options && options.typingAsteriskWritesTimesSymbol && ch === '*')
			return new LatexCmds['\u00d7'](ch);
		else if (cons)
			return new cons(ch);
		else
			return new VanillaSymbol(ch);
	}

	writeLatex(cursor, latex) {
		const all = Parser.all;
		const eof = Parser.eof;

		const block = latexMathParser.skip(eof).or(all.result(false)).parse(latex);

		if (block && !block.isEmpty() && block.prepareInsertionAt(cursor)) {
			block.children().adopt(cursor.parent, cursor[L], cursor[R]);
			const jQ = block.jQize();
			jQ.insertBefore(cursor.jQ);
			cursor[L] = block.ends[R];
			block.finalizeInsert(cursor.options, cursor);
			if (block.ends[R][R].siblingCreated) block.ends[R][R].siblingCreated(cursor.options, L);
			if (block.ends[L][L].siblingCreated) block.ends[L][L].siblingCreated(cursor.options, R);
			cursor.parent.bubble('reflow');
		}
	}

	focus() {
		super.focus();
		return this;
	}

	blur() {
		super.blur();
		return this;
	}
}

export class RootMathBlock extends MathBlock {
	constructor(...args) {
		super(...args);

		RootBlockMixin(this);
	}
}
