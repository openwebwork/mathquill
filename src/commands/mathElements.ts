// Abstract classes of math blocks and commands.

import type { Direction, Constructor } from 'src/constants';
import {
	noop,
	L,
	R,
	mqCmdId,
	pray,
	mqBlockId,
	LatexCmds,
	OPP_BRACKS,
	BuiltInOpNames,
	TwoWordOpNames
} from 'src/constants';
import { Parser } from 'services/parser.util';
import { Selection } from 'src/selection';
import { deleteSelectTowardsMixin, DelimsMixin } from 'src/mixins';
import type { Options } from 'src/options';
import type { Cursor } from 'src/cursor';
import { Point } from 'tree/point';
import { VNode } from 'tree/vNode';
import { TNode } from 'tree/node';
import { Fragment } from 'tree/fragment';
import { MathBlock } from 'commands/mathBlock';

// Math tree node base class.
// Some math-tree-specific extensions to TNode.
// Both MathBlock's and MathCommand's descend from it.
export class MathElement extends TNode {
	finalizeInsert(options: Options, cursor: Cursor) {
		this.postOrder('finalizeTree', options);
		this.postOrder('contactWeld', cursor);

		// note: this order is important.
		// empty elements need the empty box provided by blur to
		// be present in order for their dimensions to be measured
		// correctly by 'reflow' handlers.
		this.postOrder('blur');

		this.postOrder('reflow');
		this[R]?.siblingCreated?.(options, L);
		this[L]?.siblingCreated?.(options, R);
		this.bubble('reflow');
	}

	// If the maxDepth option is set, make sure
	// deeply nested content is truncated. Just return
	// false if the cursor is already too deep.
	prepareInsertionAt(cursor: Cursor) {
		const maxDepth = cursor.options.maxDepth;
		if (maxDepth !== undefined) {
			const cursorDepth = cursor.depth();
			if (cursorDepth > maxDepth) {
				return false;
			}
			this.removeNodesDeeperThan(maxDepth - cursorDepth);
		}
		return true;
	}

	// Remove nodes that are more than `cutoff`
	// blocks deep from this node.
	removeNodesDeeperThan(cutoff: number) {
		let depth = 0;
		const queue: Array<[TNode, number]> = [[this, depth]];

		// Do a breadth-first search of this node's descendants
		// down to cutoff, removing anything deeper.
		while (queue.length) {
			const current = queue.shift();
			current?.[0].children()?.each((child: TNode) => {
				const i = child instanceof MathBlock ? 1 : 0;
				depth = current[1] + i;

				if (depth <= cutoff) {
					queue.push([child, depth]);
				} else {
					(i ? child.children() : child).remove();
				}
			});
		}
	}
}

// Commands and operators, like subscripts, exponents, or fractions.
// Descendant commands are organized into blocks.
export class MathCommand extends deleteSelectTowardsMixin(MathElement) {
	blocks: Array<MathBlock>;
	contentIndex = 0;
	htmlTemplate: string;
	textTemplate: Array<string>;
	replacedFragment?: Fragment;

	constructor(ctrlSeq?: string, htmlTemplate?: string, textTemplate?: Array<string>) {
		super();

		this.blocks = [];
		this.ctrlSeq = ctrlSeq ?? '';
		this.htmlTemplate = htmlTemplate ?? '';
		this.textTemplate = textTemplate ?? [''];
	}

	// obvious methods
	replaces(replacedFragment?: Fragment) {
		replacedFragment?.disown();
		this.replacedFragment = replacedFragment;
	}

	isEmpty() {
		return this.foldChildren(true, (isEmpty, child) => isEmpty && child.isEmpty());
	}

	parser() {
		return latexMathParser.block.times(this.numBlocks()).map((blocks: Array<MathBlock>) => {
			this.blocks = blocks;

			for (const block of blocks) {
				block.adopt(this, this.ends[R]);
			}

			return this;
		});
	}

	// createLeftOf(cursor) and the methods it calls
	createLeftOf(cursor: Cursor) {
		const replacedFragment = this.replacedFragment;

		this.createBlocks();
		super.createLeftOf(cursor);
		if (replacedFragment) {
			replacedFragment.adopt(this.blocks[this.contentIndex]);
			this.blocks[this.contentIndex]?.elements.firstElement.append(...replacedFragment.elements.contents);
			this.placeCursor(cursor);
			this.prepareInsertionAt(cursor);
		}
		this.finalizeInsert(cursor.options, cursor);
		this.placeCursor(cursor);
	}

	createBlocks() {
		const numBlocks = this.numBlocks();
		this.blocks = Array<MathBlock>(numBlocks);

		for (let i = 0; i < numBlocks; ++i) {
			this.blocks[i] = new MathBlock();
			this.blocks[i].adopt(this, this.ends[R]);
		}
	}

	placeCursor(cursor: Cursor) {
		// Insert the cursor at the right end of the first empty child, searching from
		// left to right, or if not empty, then to the right end of the child.
		cursor.insAtRightEnd(
			this.foldChildren(this.ends[L] as TNode, (leftward, child) => (leftward.isEmpty() ? leftward : child))
		);
	}

	selectChildren(): Selection {
		return new Selection(this, this);
	}

	unselectInto(dir: Direction, cursor: Cursor) {
		cursor.insAtDirEnd(dir === L ? R : L, cursor.anticursor?.ancestors?.[this.id] as TNode);
	}

	seek(pageX: number, cursor: Cursor) {
		const getBounds = (node: TNode) => {
			const rect = node.elements.firstElement.getBoundingClientRect();
			return { [L]: rect.left, [R]: rect.left + rect.width };
		};

		const cmdBounds = getBounds(this);

		if (pageX < cmdBounds[L]) {
			cursor.insLeftOf(this);
			return;
		}
		if (pageX > cmdBounds[R]) {
			cursor.insRightOf(this);
			return;
		}

		let leftLeftBound = cmdBounds[L];
		this.eachChild((block: TNode) => {
			const blockBounds = getBounds(block);
			if (pageX < blockBounds[L]) {
				// closer to this block's left bound, or the bound left of that?
				if (pageX - leftLeftBound < blockBounds[L] - pageX) {
					if (block[L]) cursor.insAtRightEnd(block[L]);
					else cursor.insLeftOf(this);
				} else cursor.insAtLeftEnd(block);
				return false;
			} else if (pageX > blockBounds[R]) {
				if (block[R]) leftLeftBound = blockBounds[R]; // continue to next block
				else {
					// last (rightmost) block
					// closer to this block's right bound, or the this's right bound?
					if (cmdBounds[R] - pageX < pageX - blockBounds[R]) {
						cursor.insRightOf(this);
					} else cursor.insAtRightEnd(block);
				}
			} else {
				block.seek(pageX, cursor);
				return false;
			}
		});
	}

	// methods involved in creating and cross-linking with HTML DOM nodes
	// They all expect an .htmlTemplate like
	//   '<span>&0</span>'
	// or
	//   '<span><span>&0</span><span>&1</span></span>'

	// See html.test.js for more examples.

	// Requirements:
	// - For each block of the command, there must be exactly one "block content
	//   marker" of the form '&<number>' where <number> is the 0-based index of the
	//   block. (Like the LaTeX \newcommand syntax, but with a 0-based rather than
	//   1-based index, because JavaScript because C because Dijkstra.)
	// - The block content marker must be the sole contents of the containing
	//   element, there can't even be surrounding whitespace, or else we can't
	//   guarantee sticking to within the bounds of the block content marker when
	//   mucking with the HTML DOM.
	// - The HTML not only must be well-formed HTML (of course), but also must
	//   conform to the XHTML requirements on tags, specifically all tags must
	//   either be self-closing (like '<br/>') or come in matching pairs.
	//   Close tags are never optional.

	// Note that &<number> isn't well-formed HTML; if you wanted a literal '&123',
	// your HTML template would have to have '&amp;123'.
	numBlocks() {
		const matches = this.htmlTemplate.match(/&\d+/g);
		return matches ? matches.length : 0;
	}

	html() {
		// Render the entire math subtree rooted at this command, as HTML.
		// Expects the blocks for this object to have been created already (either
		// by .createBlocks or the parser), since it uses the .blocks array of child
		// blocks.
		//
		// See html.test.js for example templates and intended outputs.
		//
		// Given an .htmlTemplate as described above,
		// - insert the mathquill-command-id attribute into all top-level tags,
		//   which will be used to set this.elements in .domify().
		//   This is straightforward:
		//     * tokenize into tags and non-tags
		//     * loop through top-level tokens:
		//         * add #cmdId attribute macro to top-level self-closing tags
		//         * else add #cmdId attribute macro to top-level open tags
		//             * skip the matching top-level close tag and all tag pairs
		//               in between
		// - for each block content marker,
		//     + replace it with the contents of the corresponding block,
		//       rendered as HTML
		//     + insert the mathquill-block-id attribute into the containing tag
		//   This is even easier, a quick regex replace, since block tags cannot
		//   contain anything besides the block content marker.
		//
		// Two notes:
		// - The outermost loop through top-level tokens should never encounter any
		//   top-level close tags, because we should have first encountered a
		//   matching top-level open tag, all inner tags should have appeared in
		//   matching pairs and been skipped, and then we should have skipped the
		//   close tag in question.
		// - All open tags should have matching close tags, which means our inner
		//   loop should always encounter a close tag and drop nesting to 0. If
		//   a close tag is missing, the loop will continue until i >= tokens.length
		//   and token becomes undefined. This will not infinite loop, even in
		//   production without pray(), because it will then TypeError on .slice().

		const blocks = this.blocks;
		const cmdId = ` ${mqCmdId}=${this.id}`;
		const tokens: Array<string> = this.htmlTemplate.match(/<[^<>]+>|[^<>]+/g) as Array<string>;

		pray('no unmatched angle brackets', tokens.join('') === this.htmlTemplate);

		// add cmdId to all top-level tags
		for (let i = 0, token = tokens[0]; token; ++i, token = tokens[i]) {
			// top-level self-closing tags
			if (token.slice(-2) === '/>') {
				tokens[i] = `${token.slice(0, -2)}${cmdId}/>`;
			}
			// top-level open tags
			else if (token.charAt(0) === '<') {
				pray('not an unmatched top-level close tag', token.charAt(1) !== '/');

				tokens[i] = `${token.slice(0, -1)}${cmdId}>`;

				// skip matching top-level close tag and all tag pairs in between
				let nesting = 1;
				do {
					(i += 1), (token = tokens[i]);
					pray('no missing close tags', !!token);
					// close tags
					if (token.slice(0, 2) === '</') {
						nesting -= 1;
					}
					// non-self-closing open tags
					else if (token.charAt(0) === '<' && token.slice(-2) !== '/>') {
						nesting += 1;
					}
				} while (nesting > 0);
			}
		}
		return tokens
			.join('')
			.replace(
				/>&(\d+)/g,
				($0, $1: number) => ` ${mqBlockId}=${blocks[$1]?.id ?? ''}>${blocks[$1]?.join('html') ?? ''}`
			);
	}

	// Methods to export a string representation of the math tree
	latex() {
		return this.foldChildren(this.ctrlSeq, (latex, child) => `${latex}{${child.latex() || ' '}}`);
	}

	text() {
		let i = 0;
		return this.foldChildren(this.textTemplate[i], (text, child) => {
			++i;
			const child_text = child.text();
			if (text && this.textTemplate[i] === '(' && child_text[0] === '(' && child_text.slice(-1) === ')')
				return text + child_text.slice(1, -1) + this.textTemplate[i];
			return text + child_text + (this.textTemplate[i] || '');
		});
	}
}

// Lightweight command without blocks or children.
export class Symbol extends MathCommand {
	constructor(ctrlSeq?: string, html?: string, text?: string) {
		const textTemplate = text ? text : ctrlSeq && ctrlSeq.length > 1 ? ctrlSeq.slice(1) : ctrlSeq ?? '';
		super(ctrlSeq, html, [textTemplate]);

		this.createBlocks = noop;
		this.isSymbol = true;
	}

	parser() {
		return Parser.succeed(this);
	}

	numBlocks() {
		return 0;
	}

	replaces(replacedFragment?: Fragment) {
		replacedFragment?.remove();
	}

	moveTowards(dir: Direction, cursor: Cursor) {
		if (dir === L) this.elements.first.before(cursor.element);
		else this.elements.last.after(cursor.element);

		cursor[dir === L ? R : L] = this;
		cursor[dir] = this[dir];
	}

	deleteTowards(dir: Direction, cursor: Cursor) {
		cursor[dir] = this.remove()[dir];
	}

	seek(pageX: number, cursor: Cursor) {
		// Insert at whichever side the click was closer to.
		const rect = this.elements.firstElement.getBoundingClientRect();
		if (pageX - rect.left < rect.width / 2) cursor.insLeftOf(this);
		else cursor.insRightOf(this);
	}

	latex() {
		return this.ctrlSeq;
	}

	text() {
		return this.textTemplate.join('');
	}

	placeCursor() {
		/* do nothing */
	}

	isEmpty() {
		return true;
	}
}

export class VanillaSymbol extends Symbol {
	constructor(ch: string, html?: string, text?: string) {
		super(ch, `<span>${html || ch}</span>`, text);
	}
}

export class BinaryOperator extends Symbol {
	isUnary = false;

	constructor(ctrlSeq: string, html?: string, text?: string, useRawHtml = false) {
		super(ctrlSeq, useRawHtml === true ? html : `<span class="mq-binary-operator">${html ?? ''}</span>`, text);
	}
}

export interface InequalityData {
	ctrlSeq: string;
	html: string;
	text: string;
	ctrlSeqStrict: string;
	htmlStrict: string;
	textStrict: string;
}

export class Inequality extends BinaryOperator {
	data: InequalityData;
	strict: boolean;

	constructor(data: InequalityData, strict: boolean) {
		const strictness = strict ? 'Strict' : '';
		super(data[`ctrlSeq${strictness}`], data[`html${strictness}`], data[`text${strictness}`]);
		this.data = data;
		this.strict = strict;
	}

	swap(strict: boolean) {
		this.strict = strict;
		const strictness = strict ? 'Strict' : '';
		this.ctrlSeq = this.data[`ctrlSeq${strictness}`];
		this.elements.html(this.data[`html${strictness}`]);
		this.textTemplate = [this.data[`text${strictness}`]];
	}

	deleteTowards(dir: Direction, cursor: Cursor) {
		if (dir === L && !this.strict) {
			this.swap(true);
			this.bubble('reflow');
			return;
		}
		super.deleteTowards(dir, cursor);
	}
}

export class FactorialOrNEQ extends Inequality {
	constructor(data: InequalityData, strict: boolean) {
		super(data, strict);
		this.isUnary = strict;
	}

	swap(strict: boolean) {
		this.isUnary = strict;
		this.contactWeld();
		super.swap(strict);
	}

	contactWeld() {
		if (this.isUnary) this.elements.firstElement.className = '';
		else this.elements.firstElement.className = 'mq-binary-operator';
		return this;
	}
}

export class Equality extends BinaryOperator {
	constructor() {
		super('=', '=');
	}

	createLeftOf(cursor: Cursor) {
		if (cursor[L] instanceof Inequality && cursor[L].strict) {
			cursor[L].swap(false);
			cursor[L]?.bubble('reflow');
			return;
		}
		super.createLeftOf(cursor);
	}
}

export class Digit extends VanillaSymbol {
	createLeftOf(cursor: Cursor) {
		if (
			cursor.options.autoSubscriptNumerals &&
			cursor.parent !== cursor.parent?.parent?.sub &&
			((cursor[L] instanceof Variable && cursor[L].isItalic !== false) ||
				(cursor[L] instanceof SupSub &&
					cursor[L]?.[L] instanceof Variable &&
					cursor[L]?.[L].isItalic !== false))
		) {
			new LatexCmds._().createLeftOf(cursor);
			super.createLeftOf(cursor);
			cursor.insRightOf(cursor.parent?.parent as TNode);
		} else super.createLeftOf(cursor);
	}
}

export class Variable extends Symbol {
	isItalic = false;
	isPartOfOperator = false;

	constructor(ch: string, html?: string) {
		super(ch, `<var>${html || ch}</var>`);
	}

	text() {
		let text = this.ctrlSeq;
		if (text[0] == '\\') {
			if (text.startsWith('\\operatorname{')) text = text.slice(14, text.length);
			else text = text.slice(1, text.length);
		} else if (text[text.length - 1] == ' ' || text[text.length - 1] == '}') {
			text = text.slice(0, -1);
			if (!(this[R] instanceof Bracket || this[R] instanceof Fraction || this[R] instanceof SupSub)) text += ' ';
		}
		return text;
	}
}

export class Letter extends Variable {
	letter: string;

	constructor(ch: string, htmlTemplate?: string) {
		super(ch, htmlTemplate);
		this.letter = ch;
		this.siblingDeleted = this.siblingCreated = (opts: Options, dir?: Direction) => this.finalizeTree(opts, dir);
	}

	createLeftOf(cursor: Cursor) {
		super.createLeftOf(cursor);
		const autoCmds = cursor.options.autoCommands,
			maxLength = autoCmds._maxLength;
		if (maxLength > 0) {
			// To find the longest possible autocommand, join the longest sequence of letters.
			let str = '',
				// eslint-disable-next-line @typescript-eslint/no-this-alias
				l: TNode | undefined = this,
				i = 0;
			// FIXME: l.ctrlSeq === l.letter checks if first or last in an operator name
			while (l instanceof Letter && l?.ctrlSeq === l?.letter && i < maxLength) {
				(str = l.letter + str), (l = l[L]), ++i;
			}
			// Check for an autocommand, going through substrings from longest to shortest.
			while (str.length) {
				if (autoCmds[str]) {
					// eslint-disable-next-line @typescript-eslint/no-this-alias
					for (i = 1, l = this; i < str.length; ++i, l = l?.[L]);
					new Fragment(l, this).remove();
					cursor[L] = l?.[L];
					return new LatexCmds[str](str).createLeftOf(cursor);
				}
				str = str.slice(1);
			}
		}
	}

	italicize(bool: boolean) {
		this.isItalic = bool;
		this.isPartOfOperator = !bool;
		this.elements.toggleClass('mq-operator-name', !bool);
		return this;
	}

	finalizeTree(opts: Options, dir?: Direction) {
		// don't auto-un-italicize if the sibling to my right changed (dir === R or
		// undefined) and it's now a Letter, it will un-italicize everyone
		if (dir !== L && this[R] instanceof Letter) return;
		this.autoUnItalicize(opts);
	}

	autoUnItalicize(opts: Options) {
		const autoOps = opts.autoOperatorNames;
		if (autoOps._maxLength === 0) return;
		// want longest possible operator names, so join together entire contiguous
		// sequence of letters
		let str = this.letter,
			l = this[L],
			r = this[R];
		for (; l instanceof Letter; l = l[L]) str = l.letter + str;
		for (; r instanceof Letter; r = r[R]) str += r.letter;

		// removeClass and delete flags from all letters before figuring out
		// which, if any, are part of an operator name
		new Fragment(l?.[R] || this.parent?.ends[L], r?.[L] || this.parent?.ends[R]).each((el: TNode) => {
			(el as Letter).italicize(true).elements.removeClass('mq-first', 'mq-last', 'mq-followed-by-supsub');
			el.ctrlSeq = (el as Letter).letter;
		});

		// check for operator names: at each position from left to right, check
		// substrings from longest to shortest
		for (let i = 0, first = l?.[R] || this.parent?.ends[L]; i < str.length; ++i, first = first?.[R]) {
			for (let len = Math.min(autoOps._maxLength, str.length - i); len > 0; --len) {
				const word = str.slice(i, i + len);
				if (autoOps[word]) {
					let last;
					for (let j = 0, letter = first; j < len; j += 1, letter = letter?.[R]) {
						(letter as Letter).italicize(false);
						last = letter;
					}

					const isBuiltIn = BuiltInOpNames[word];
					(first as Letter).ctrlSeq = (isBuiltIn ? '\\' : '\\operatorname{') + (first?.ctrlSeq ?? '');
					(last as Letter).ctrlSeq += isBuiltIn ? ' ' : '}';
					if (word in TwoWordOpNames) last?.[L]?.[L]?.[L]?.elements.addClass('mq-last');
					if (!this.shouldOmitPadding(first?.[L])) first?.elements.addClass('mq-first');
					if (!this.shouldOmitPadding(last?.[R])) {
						if (last?.[R] instanceof SupSub) last[R].siblingCreated?.(opts);
						else last?.elements.toggleClass('mq-last', !(last?.[R] instanceof Bracket));
					}

					i += len - 1;
					first = last;
					break;
				}
			}
		}
	}

	shouldOmitPadding(node?: TNode) {
		// omit padding if no node, or if node already has padding (to avoid double-padding)
		return !node || node instanceof BinaryOperator || node instanceof UpperLowerLimitCommand;
	}
}

export function insLeftOfMeUnlessAtEnd(this: SupSub, cursor: Cursor) {
	// cursor.insLeftOf(cmd), unless cursor at the end of block, and every
	// ancestor cmd is at the end of every ancestor block
	const cmd = this.parent as TNode;
	let ancestorCmd: TNode | Point | undefined = cursor;
	do {
		if (ancestorCmd?.[R]) return cursor.insLeftOf(cmd);
		ancestorCmd = ancestorCmd?.parent?.parent;
	} while (ancestorCmd !== cmd);
	cursor.insRightOf(cmd);
}

export class Fraction extends MathCommand {
	constructor() {
		super();

		this.ctrlSeq = '\\frac';
		this.htmlTemplate =
			'<span class="mq-fraction mq-non-leaf">' +
			'<span class="mq-numerator">&0</span>' +
			'<span class="mq-denominator">&1</span>' +
			'<span style="display:inline-block;width:0">&#8203;</span>' +
			'</span>';
		this.textTemplate = ['((', ')/(', '))'];
	}

	text() {
		let leftward = this[L];
		for (; leftward && leftward.ctrlSeq === '\\ '; leftward = leftward[L]);

		const text = (dir: Direction) => {
			let needParens = false;
			let numBlocks = 0;
			let haveDigits = false;
			this.ends[dir]?.eachChild((child: TNode) => {
				if (child instanceof Digit) haveDigits = true;

				if (
					!(
						child instanceof Digit ||
						(child instanceof BinaryOperator && child.isUnary) ||
						child instanceof SupSub
					)
				)
					++numBlocks;

				if (
					(haveDigits && numBlocks) ||
					numBlocks > 1 ||
					(child instanceof BinaryOperator && !child.isUnary) ||
					('text' in LatexCmds && child instanceof LatexCmds.text) ||
					child instanceof UpperLowerLimitCommand ||
					child instanceof Fraction ||
					child.ctrlSeq === '\\ ' ||
					/^[,;:]$/.test(child.ctrlSeq)
				) {
					needParens = true;
				}
				return !needParens;
			});

			const blankDefault = dir === L ? 0 : 1;
			const l = this.ends[dir]?.text() !== ' ' && this.ends[dir]?.text();
			return l ? (needParens ? `(${l})` : l) : blankDefault;
		};
		return (leftward instanceof BinaryOperator && leftward.isUnary) ||
			leftward?.elements.hasClass('mq-operator-name') ||
			(leftward instanceof SupSub && leftward[L]?.elements.hasClass('mq-operator-name'))
			? `(${text(L)}/${text(R)})`
			: ` ${text(L)}/${text(R)} `;
	}

	finalizeTree() {
		this.upInto = (this.ends[R] as TNode).upOutOf = this.ends[L];
		this.downInto = (this.ends[L] as TNode).downOutOf = this.ends[R];
	}
}

export const supSubText = (prefix: string, block?: TNode) => {
	let needParens = false;
	let numBlocks = 0;
	let haveDigits = false;
	block?.eachChild((child: TNode) => {
		if (child instanceof Digit) haveDigits = true;
		if (!(child instanceof Digit || (child instanceof BinaryOperator && child.isUnary))) ++numBlocks;
		if (
			(haveDigits && numBlocks) ||
			numBlocks > 1 ||
			(child instanceof BinaryOperator && !child.isUnary) ||
			('text' in LatexCmds && child instanceof LatexCmds.text) ||
			child instanceof UpperLowerLimitCommand ||
			child instanceof Fraction ||
			child.ctrlSeq === '\\ ' ||
			/^[,;:]$/.test(child.ctrlSeq)
		) {
			needParens = true;
		}
		return !needParens;
	});

	const l = block?.text() !== ' ' && block?.text();
	return l ? prefix + (needParens ? `(${l})` : l) : '';
};

export class SupSub extends MathCommand {
	supsub: 'sup' | 'sub' = 'sup';

	constructor(ctrlSeq?: string, htmlTemplate?: string, textTemplate?: Array<string>) {
		super('_{...}^{...}', htmlTemplate, textTemplate);

		this.reflow = () => {
			const block = this.elements; // mq-supsub
			const prev = block.first.previousElementSibling as HTMLElement;

			// We can't normalize the superscript without having a previous element (which is the base).
			if (!prev) return;

			const sup = block.children('.mq-sup').firstElement; // mq-supsub -> mq-sup
			if (sup) {
				const supStyle = getComputedStyle(sup);
				const supRect = sup.getBoundingClientRect();
				const sup_fontsize = parseInt(supStyle.fontSize);
				const sup_bottom =
					supRect.top + supRect.height - parseFloat(supStyle.paddingTop) - parseFloat(supStyle.paddingBottom);
				// We want the superscript to overlap the top of the base by 0.7 of its font-size.
				// Then small superscripts like x^2 look ok, but big ones like x^(1/2/3) do too.
				const needed = sup_bottom - prev.getBoundingClientRect().top - 0.7 * sup_fontsize;
				const cur_margin = parseInt(supStyle.marginBottom);
				// Lift the superscript up with margin-bottom.
				sup.style.marginBottom = `${cur_margin + needed}px`;
			}
		};

		this.siblingCreated = this.siblingDeleted = (options: Options) => {
			if (
				this[L] instanceof Letter &&
				this[L].isPartOfOperator &&
				this[R] &&
				!(
					this[R] instanceof BinaryOperator ||
					this[R] instanceof UpperLowerLimitCommand ||
					this[R] instanceof Bracket
				)
			)
				this.elements.addClass('mq-after-operator-name');
			else this.elements.removeClass('mq-after-operator-name');

			this.maybeFlatten(options);
		};
	}

	hasValidBase(options: Options, leftward?: TNode, parent?: TNode) {
		return (
			!options.supSubsRequireOperand ||
			(leftward &&
				leftward.ctrlSeq !== '\\ ' &&
				!(leftward instanceof BinaryOperator) &&
				!/^[,;:]$/.test(leftward.ctrlSeq ?? '')) ||
			(!leftward && parent?.parent instanceof MathFunction && parent == parent.parent.blocks[0])
		);
	}

	createLeftOf(cursor: Cursor) {
		if (this.hasValidBase(cursor.options, cursor[L], cursor.parent)) {
			// If this SupSub is being placed on a fraction, then add parentheses around the fraction.
			if (cursor[L] instanceof Fraction) {
				const brack = new Bracket(R, '(', ')', '(', ')');
				cursor.selection = (cursor[L] as TNode).selectChildren();
				brack.replaces(cursor.replaceSelection());
				brack.createLeftOf(cursor);
			}

			super.createLeftOf(cursor);
			return;
		}

		if (this.replacedFragment) {
			this.replacedFragment.adopt(cursor.parent as TNode, cursor[L], cursor[R]);
			cursor[L] = this.replacedFragment.ends[R];
		}
	}

	contactWeld(cursor: Cursor) {
		// Look on either side for a SupSub.  If one is found compare this .sub, .sup with its .sub, .sup.  If this has
		// one that it doesn't, then call .addBlock() on it with this block.  If this has one that it also has, then
		// insert this block's children into its block, unless this block has none, in which case insert the cursor into
		// its block (and not this one, since this one will be removed).  If something to the left has been deleted,
		// then this SupSub will be merged with one to the left if it is left next to it after the deletion.
		for (const dir of [L, R]) {
			if (this[dir] instanceof SupSub) {
				let pt;
				for (const supsub of ['sub', 'sup'] as Array<keyof Pick<SupSub, 'sub' | 'sup'>>) {
					const src = this[supsub],
						dest = (this[dir] as SupSub)[supsub];
					if (!src) continue;
					if (!dest) (this[dir] as SupSub).addBlock(src.disown());
					else if (!src.isEmpty()) {
						// Insert src children at -dir end of dest
						src.elements.children().insAtDirEnd(dir === L ? R : L, dest.elements);
						const children = src.children().disown();
						pt = new Point(dest, children.ends[R], dest.ends[L]);
						if (dir === L) children.adopt(dest, dest.ends[R]);
						else children.adopt(dest, undefined, dest.ends[L]);
					} else pt = new Point(dest, undefined, dest.ends[L]);
					this.placeCursor = (cursor) => cursor.insAtDirEnd(dir === L ? R : L, dest || src);
				}
				this.remove();
				if (cursor) {
					if (cursor[L] === this) {
						if (dir === R && pt) pt[L] ? cursor.insRightOf(pt[L]) : cursor.insAtLeftEnd(pt.parent as TNode);
						else cursor.insRightOf(this[dir] as TNode);
					} else {
						if (pt?.[R]) cursor.insRightOf(pt[R]);
					}
				}
				return;
			}
		}

		this.maybeFlatten(cursor.options);

		// Only allow deletion of a sup or sub in a function supsub block when it is empty.
		// This sets that up when the first sup or sub is created.
		if (
			this.parent?.parent instanceof MathFunction &&
			this.parent == this.parent.parent.blocks[0] &&
			!(this.sup && this.sub)
		) {
			const fcnBlock = this.parent.parent.blocks[0];
			for (const supsub of ['sub', 'sup'] as Array<keyof Pick<SupSub, 'sub' | 'sup'>>) {
				const src = this[supsub];
				if (!src) continue;
				src.deleteOutOf = (dir: Direction, cursor: Cursor) => {
					if (src.isEmpty()) this.remove();
					cursor.insAtDirEnd(dir, fcnBlock);
				};
			}
		}
	}

	finalizeTree() {
		(this.ends[L] as TNode).isSupSubLeft = true;
	}

	// Check to see if this has an invalid base.  If so bring the children out, and remove this SupSub.
	maybeFlatten(options: Options) {
		const cursor = this.getController()?.cursor;
		const leftward = cursor?.[R] === this ? cursor[L] : this[L];
		if (!this.hasValidBase(options, leftward, this.parent) || leftward instanceof Fraction) {
			for (const supsub of ['sub', 'sup'] as Array<keyof Pick<SupSub, 'sub' | 'sup'>>) {
				const src = this[supsub];
				if (!src) continue;
				src.children()
					.disown()
					.adopt(this.parent as TNode, this[L], this)
					.elements.insDirOf(L, this.elements);
			}
			this.remove();
			if (leftward === cursor?.[L]) {
				if (cursor?.[L]?.[R]) cursor.insLeftOf(cursor[L]?.[R]);
				else cursor?.insAtDirEnd(L, cursor.parent as TNode);
			}
		}
	}

	moveTowards(dir: Direction, cursor: Cursor, updown?: 'up' | 'down') {
		if (cursor.options.autoSubscriptNumerals && !this.sup) cursor.insDirOf(dir, this);
		else super.moveTowards(dir, cursor, updown);
	}

	deleteTowards(dir: Direction, cursor: Cursor) {
		if (cursor.options.autoSubscriptNumerals && this.sub) {
			const cmd = this.sub.ends[dir === L ? R : L];
			if (cmd instanceof Symbol) cmd.remove();
			else if (cmd) cmd.deleteTowards(dir, cursor.insAtDirEnd(dir === L ? R : L, this.sub));

			// TODO: factor out a .removeBlock() or something
			if (this.sub.isEmpty()) {
				this.sub.deleteOutOf(L, cursor.insAtLeftEnd(this.sub));
				if (this.sup) cursor.insDirOf(dir === L ? R : L, this);
				// Note `-dir` because in e.g. x_1^2| want backspacing (leftward)
				// to delete the 1 but to end up rightward of x^2; with non-negated
				// `dir` (try it), the cursor appears to have gone "through" the ^2.
			}
		} else super.deleteTowards(dir, cursor);
	}

	latex() {
		const latex = (prefix: string, block?: TNode) => {
			const l = block && block.latex();
			return block ? prefix + (l?.length === 1 ? l : `{${l || ' '}}`) : '';
		};
		return latex('_', this.sub) + latex('^', this.sup);
	}

	text() {
		const mainText = supSubText('_', this.sub) + supSubText('^', this.sup);
		return mainText + (mainText && this[R] instanceof Digit ? ' ' : '');
	}

	addBlock(block: TNode) {
		if (this.supsub === 'sub') {
			this.sup = this.upInto = (this.sub as TNode).upOutOf = block;
			block.adopt(this, this.sub).downOutOf = this.sub;

			const blockEl = document.createElement('span');
			blockEl.classList.add('mq-sup');
			blockEl.append(...block.elements.children().contents);
			blockEl.setAttribute(mqBlockId, block.id.toString());
			this.elements.firstElement.prepend(blockEl);
			block.elements = new VNode(blockEl);
		} else {
			this.sub = this.downInto = (this.sup as TNode).downOutOf = block;
			block.adopt(this, undefined, this.sup).upOutOf = this.sup;

			const blockEl = document.createElement('span');
			blockEl.classList.add('mq-sub');
			blockEl.append(...block.elements.children().contents);
			blockEl.setAttribute(mqBlockId, block.id.toString());
			this.elements.removeClass('mq-sup-only');
			this.elements.firstElement.append(blockEl);
			block.elements = new VNode(blockEl);

			const span = document.createElement('span');
			span.style.display = 'inline-block';
			span.style.width = '0';
			span.textContent = '\u200B';
			this.elements.firstElement.append(span);
		}

		for (const supsub of ['sub', 'sup'] as Array<keyof Pick<SupSub, 'sub' | 'sup'>>) {
			const oppositeSupsub = supsub === 'sub' ? 'sup' : 'sub';
			const updown = supsub === 'sub' ? 'down' : 'up';
			const thisSupsub = this[supsub] as MathElement;

			if (this.parent?.parent instanceof MathFunction && this.parent === this.parent.parent.blocks[0]) {
				// Only allow deletion of a sup or sub in a function supsub block when it is empty.
				// This sets that up when the second sup or sub is created (or when parsing and both exist).
				thisSupsub.deleteOutOf = (dir: Direction, cursor: Cursor) => {
					if (thisSupsub.isEmpty()) {
						cursor[dir === L ? R : L] = thisSupsub.ends[dir];
						this.supsub = oppositeSupsub;
						delete this[supsub];
						delete this[`${updown}Into`];
						const remainingSupsub = this[oppositeSupsub] as SupSub;
						remainingSupsub[`${updown}OutOf`] = insLeftOfMeUnlessAtEnd;
						remainingSupsub.deleteOutOf = (dir: Direction, cursor: Cursor) => {
							if (remainingSupsub.isEmpty()) this.remove();
							cursor.insAtDirEnd(dir, this.parent as TNode);
						};
						if (supsub === 'sub') {
							this.elements.addClass('mq-sup-only');
							this.elements.first.lastChild?.remove();
						}
						thisSupsub.remove();
					}
					cursor.insDirOf(thisSupsub[dir] ? (dir === L ? R : L) : dir, thisSupsub.parent as TNode);
				};
			} else {
				thisSupsub.deleteOutOf = (dir: Direction, cursor: Cursor) => {
					cursor.insDirOf(thisSupsub[dir] ? (dir === L ? R : L) : dir, thisSupsub.parent as TNode);
					if (!thisSupsub.isEmpty()) {
						const end = thisSupsub.ends[dir];
						thisSupsub
							.children()
							.disown()
							.withDirAdopt(dir, cursor.parent as TNode, cursor[dir], cursor[dir === L ? R : L])
							.elements.insDirOf(dir === L ? R : L, cursor.element);
						cursor[dir === L ? R : L] = end;
					}
					this.supsub = oppositeSupsub;
					delete this[supsub];
					delete this[`${updown}Into`];
					(this[oppositeSupsub] as TNode)[`${updown}OutOf`] = insLeftOfMeUnlessAtEnd;
					delete (this[oppositeSupsub] as Partial<MathElement>).deleteOutOf;
					if (supsub === 'sub') {
						this.elements.addClass('mq-sup-only');
						this.elements.first.lastChild?.remove();
					}
					thisSupsub.remove();
				};
			}
		}
	}
}

export class UpperLowerLimitCommand extends MathCommand {
	latex() {
		const simplify = (latex: string) => (latex.length === 1 ? latex : `{${latex || ' '}}`);
		return `${this.ctrlSeq}_${simplify(this.ends[L]?.latex() ?? '')}^${simplify(this.ends[R]?.latex() ?? '')}`;
	}

	text() {
		const operand = this.ctrlSeq.slice(1, this.ctrlSeq.length - 1);
		return `${operand}(${this.ends[L]?.text() ?? ''},${this.ends[R]?.text() ?? ''})`;
	}

	parser() {
		const blocks = (this.blocks = [new MathBlock(), new MathBlock()]);
		for (const block of blocks) {
			block.adopt(this, this.ends[R]);
		}

		return Parser.optWhitespace
			.then(Parser.string('_').or(Parser.string('^')))
			.then((supOrSub) => {
				const child = blocks[supOrSub === '_' ? 0 : 1];
				return latexMathParser.block.then((block: TNode) => {
					block.children().adopt(child, child.ends[R]);
					return Parser.succeed(this);
				});
			})
			.many()
			.result(this);
	}

	finalizeTree() {
		this.downInto = this.ends[L];
		this.upInto = this.ends[R];
		(this.ends[L] as TNode).upOutOf = this.ends[R];
		(this.ends[R] as TNode).downOutOf = this.ends[L];
	}
}

type BracketType = Bracket | MathFunction;

const BracketMixin = <TBase extends Constructor<MathCommand>>(Base: TBase) =>
	class extends DelimsMixin(Base) {
		side?: Direction = L;
		sides: {
			[L]: { ch: string; ctrlSeq: string };
			[R]: { ch: string; ctrlSeq: string };
		} = { [L]: { ch: '(', ctrlSeq: '(' }, [R]: { ch: ')', ctrlSeq: ')' } };
		inserted = false;

		matchBrack(opts: Options, expectedSide?: Direction, node?: TNode): false | BracketType {
			// Return node iff it's a matching 1-sided bracket of expected side (if any).
			// A function is only allowed to match an ending parentheses.
			return (
				((node instanceof Bracket &&
					(!(this instanceof MathFunction) || (!!node.side && node.sides[node.side].ch) === ')')) ||
					(node instanceof MathFunction && !!this.side && this.sides[this.side].ch === ')')) &&
				!!node.side &&
				node.side !== (expectedSide === L ? R : expectedSide === R ? L : 0) &&
				(!opts.restrictMismatchedBrackets ||
					(this.side && OPP_BRACKS[this.sides[this.side].ch] === node.sides[node.side].ch) ||
					{ '(': ']', '[': ')' }[this.sides[L].ch] === node.sides[R].ch) &&
				node
			);
		}

		closeOpposing(brack: BracketType) {
			delete brack.side;
			if (!this.side) return;
			// Copy this objects info to brack as this may be a different type of bracket (like (a, b]).
			brack.sides[this.side] = this.sides[this.side];
			const delim = brack.delims?.[this.side === L ? 0 : 1];
			if (delim) {
				delim.classList.remove('mq-ghost');
				delim.innerHTML = this.sides[this.side].ch;
			}
		}

		createLeftOf(cursor: Cursor) {
			let brack, side;
			if (!this.replacedFragment) {
				// If a selection is not being wrapped in this bracket, check to see if this
				// bracket is next to or inside an opposing one-sided bracket.
				const opts = cursor.options;
				if (this.sides[L].ch === '|') {
					// Check both sides if this is an absolute value bracket.
					brack =
						this.matchBrack(opts, R, cursor[R]) ||
						this.matchBrack(opts, L, cursor[L]) ||
						this.matchBrack(opts, undefined, cursor.parent?.parent);
				} else {
					const otherSide = this.side === L ? R : L;
					brack =
						this.matchBrack(opts, otherSide, cursor[otherSide]) ||
						this.matchBrack(opts, otherSide, cursor.parent?.parent);
				}
			}
			if (brack) {
				// brack may be an absolute value with .side not yet set
				side = this.side = brack.side === L ? R : L;

				// Move the stuff between this bracket and the ghost of the other bracket outside.
				if (brack === cursor.parent?.parent && cursor[side]) {
					new Fragment(cursor[side], cursor.parent?.ends[side], side === L ? R : L)
						.disown()
						.withDirAdopt(side === L ? R : L, brack.parent as TNode, brack, brack[side])
						.elements.insDirOf(side, brack.elements);
				}

				if (this instanceof MathFunction && side === L) {
					// If a math function is typed between a ghosted left parenthesis and a solid right parenthesis,
					// then adopt its contents and replace the parentheses.
					const rightward =
						brack === cursor.parent?.parent && cursor[R] !== brack.ends[R]?.[R]
							? new Fragment(cursor[R], brack.ends[R]?.ends[R], L).disown()
							: undefined;
					cursor.insRightOf(brack);
					delete this.side;
					if (rightward) this.replaces(rightward);
					super.createLeftOf(cursor);
					brack.remove();
					this.bubble('reflow');
					return;
				} else {
					this.closeOpposing(brack);
					brack.bubble('reflow');
				}
			} else {
				// If a math function is typed to the left of a parentheses and a selection is not being wrapped,
				// then adopt then contents of the parentheses and remove them.
				if (
					this instanceof MathFunction &&
					!this.replacedFragment &&
					cursor[R] instanceof Bracket &&
					cursor[R].sides[L].ch === '(' &&
					cursor[R].sides[R].ch === ')'
				) {
					const paren = cursor[R];
					this.side = paren.side;
					this.replaces(new Fragment(paren.ends[L]?.ends[L], paren.ends[R]?.ends[R], L));
					super.createLeftOf(cursor);
					paren.remove();
					this.bubble('reflow');
					return;
				}

				// eslint-disable-next-line @typescript-eslint/no-this-alias
				(brack = this), (side = brack.side);
				// If wrapping a selection, don't be one-sided.
				if (brack.replacedFragment) delete brack.side;
				else if (cursor[side === L ? R : L]) {
					// Auto-expand so the ghost is at the far end.
					brack.replaces(
						new Fragment(cursor[side === L ? R : L], cursor.parent?.ends[side === L ? R : L], side)
					);
					delete cursor[side === L ? R : L];
				}
				super.createLeftOf(cursor);
			}
			if (side === L) cursor.insAtLeftEnd(brack.ends[L] as TNode);
			else cursor.insRightOf(brack);
		}

		unwrap() {
			const node = this.blocks[this.contentIndex]
				.children()
				.disown()
				.adopt(this.parent as TNode, this, this[R]);
			if (node) this.elements.last.after(...node.elements.contents);
			this.remove();
		}

		deleteSide(side: Direction, outward: boolean, cursor: Cursor) {
			const parent = this.parent as TNode,
				sib = this[side],
				farEnd = parent.ends[side];

			if (side === this.side) {
				// If deleting a non-ghost of a one-sided bracket, then unwrap the bracket.
				this.unwrap();
				sib ? cursor.insDirOf(side === L ? R : L, sib) : cursor.insAtDirEnd(side, parent);
				return;
			}

			const wasSolid = !this.side;
			this.side = side === L ? R : L;
			// If deleting a like, outer close-brace of [(1+2)+3} where the inner open-paren
			// is a ghost then become [1+2)+3.
			if (this.matchBrack(cursor.options, side, this.blocks[this.contentIndex].ends[this.side])) {
				this.closeOpposing(this.blocks[this.contentIndex].ends[this.side] as BracketType);
				const origEnd = this.blocks[this.contentIndex].ends[side];
				this.unwrap();
				origEnd?.siblingCreated?.(cursor.options, side);
				sib ? cursor.insDirOf(side === L ? R : L, sib) : cursor.insAtDirEnd(side, parent);
			} else {
				// If deleting a like, inner close-brace of ([1+2}+3) where the outer open-paren is a ghost,
				// then become [1+3+3).
				if (this.matchBrack(cursor.options, side, this.parent?.parent)) {
					(this.parent?.parent as BracketType).closeOpposing(this);
					(this.parent?.parent as BracketType).unwrap();
				} else if (outward && wasSolid) {
					// If deleting outward from a solid pair, unwrap.
					this.unwrap();
					sib ? cursor.insDirOf(side === L ? R : L, sib) : cursor.insAtDirEnd(side, parent);
					return;
				} else {
					// If deleting just one of a pair of brackets, become one-sided.
					this.sides[side] = {
						ch: OPP_BRACKS[this.sides[this.side].ch],
						ctrlSeq: OPP_BRACKS[this.sides[this.side].ctrlSeq]
					};
					this.delims?.forEach((delim, index) => {
						delim.classList.remove('mq-ghost');
						if (index === (side === L ? 0 : 1)) {
							delim.classList.add('mq-ghost');
							delim.innerHTML = this.sides[side].ch;
						}
					});
				}
				if (sib) {
					// Auto-expand so the ghost is at the far end.
					const origEnd = this.blocks[this.contentIndex].ends[side];
					this.blocks[this.contentIndex].elements.removeClass('mq-empty');
					new Fragment(sib, farEnd, side === L ? R : L)
						.disown()
						.withDirAdopt(side === L ? R : L, this.blocks[this.contentIndex], origEnd)
						.elements.insAtDirEnd(side, this.blocks[this.contentIndex].elements);
					origEnd?.siblingCreated?.(cursor.options, side);
					cursor.insDirOf(side === L ? R : L, sib);
				} else {
					// Otherwise the cursor goes just outside or just inside the parentheses.
					outward ? cursor.insDirOf(side, this) : cursor.insAtDirEnd(side, this.blocks[this.contentIndex]);
				}
			}
		}

		deleteTowards(dir: Direction, cursor: Cursor) {
			this.deleteSide(dir === L ? R : L, false, cursor);
		}

		finalizeTree() {
			if (!this.inserted) {
				this.blocks[this.contentIndex].deleteOutOf = (dir: Direction, cursor: Cursor) =>
					this.deleteSide(dir, true, cursor);
				this.inserted = true;
				return;
			}

			this.delims?.[this.side === L ? 1 : 0].classList.remove('mq-ghost');
			delete this.side;
		}
	};

// Round/Square/Curly/Angle Brackets (aka Parens/Brackets/Braces)
// First typed as one-sided bracket with matching "ghost" bracket at
// far end of current block, until you type an opposing one.
export class Bracket extends BracketMixin(MathCommand) {
	constructor(side: Direction | undefined, open: string, close: string, ctrlSeq: string, end: string) {
		super(`\\left${ctrlSeq}`, undefined, [open, close]);
		this.side = side;
		this.sides = {
			[L]: { ch: open, ctrlSeq: ctrlSeq },
			[R]: { ch: close, ctrlSeq: end }
		};
		this.placeCursor = noop;

		// If something is typed between the ghost and the far end of its block, then solidify the ghost.
		this.siblingCreated = (opts: Options, dir?: Direction) => {
			if (dir === (this.side === L ? R : L)) this.finalizeTree();
		};
	}

	numBlocks() {
		return 1;
	}

	html() {
		// Wait until now to set the html template so that .side may be set by createLeftOf or the parser.
		this.htmlTemplate =
			'<span class="mq-non-leaf">' +
			`<span class="mq-scaled mq-paren${this.side === R ? ' mq-ghost' : ''}">` +
			this.sides[L].ch +
			'</span>' +
			'<span class="mq-non-leaf">&0</span>' +
			`<span class="mq-scaled mq-paren${this.side === L ? ' mq-ghost' : ''}">` +
			this.sides[R].ch +
			'</span>' +
			'</span>';
		return super.html();
	}

	latex() {
		return `\\left${this.sides[L]?.ctrlSeq ?? ''}${this.ends[L]?.latex() ?? ''}\\right${
			this.sides[R]?.ctrlSeq ?? ''
		}`;
	}

	text() {
		return `${this.sides[L]?.ch ?? ''}${this.ends[L]?.text() ?? ''}${this.sides[R]?.ch ?? ''}`;
	}
}

export class MathFunction extends BracketMixin(MathCommand) {
	contentIndex = 1;

	constructor(ctrlSeq: string) {
		super(ctrlSeq, undefined, [`${ctrlSeq.slice(1)}(`, ')']);

		// If something is typed after the ghost, then solidify the end parenthesis.
		// Also if something is typed before or after the function,
		// then determine if padding is needed before the function name.
		this.siblingCreated = (opts: Options, dir?: Direction) => {
			if (dir === R) this.finalizeTree();
			else this.updateFirst();
		};
		this.siblingDeleted = () => this.updateFirst();
	}

	// Add or remove padding depending on what is before the function name.
	updateFirst() {
		if (
			this[L] &&
			!(this[L] instanceof BinaryOperator) &&
			(!(this[L] instanceof Variable) || !this[L].isPartOfOperator)
		)
			(this.elements.first as HTMLEmbedElement).classList.add('mq-first');
		else (this.elements.first as HTMLEmbedElement).classList.remove('mq-first');
	}

	addToElements(el: VNode | HTMLElement) {
		this.elements.add(el);
		const children = new VNode(this.elements.children().last).children();
		this.delims = [children.contents[0] as HTMLElement, children.contents[2] as HTMLElement];
		this.content = children.contents[1] as HTMLElement;
	}

	numBlocks() {
		return 2;
	}

	html() {
		this.htmlTemplate =
			'<span class="mq-non-leaf mq-math-function">' +
			`<span class="mq-non-leaf mq-function-name">${this.ctrlSeq.slice(1)}</span>` +
			'<span class="mq-non-leaf mq-function-supsub">&0</span>' +
			'<span class="mq-non-leaf mq-function-params">' +
			'<span class="mq-scaled mq-paren">(</span>' +
			'<span class="mq-non-leaf">&1</span>' +
			`<span class="mq-scaled mq-paren${this.side === L ? ' mq-ghost' : ''}">)</span>` +
			'</span>' +
			'</span>';

		// Only allow supsub's to be inserted into the block before the parentheses.
		// If anything else is typed, move to the content block, so it will be inserted there.
		this.blocks[0].writeHandler = (cursor: Cursor, ch: string) => {
			if (ch === '_' || ch === '^') return false;

			// If at the left end of the supsub block and a character was typed that extends this function name to
			// another one, then extend the function name.
			if (!cursor[L] && LatexCmds[`${this.ctrlSeq.slice(1)}${ch}`]?.prototype instanceof MathFunction) {
				this.ctrlSeq = `${this.ctrlSeq}${ch}`;
				this.elements.children().first.textContent += ch;
				this.bubble('reflow');
				return true;
			}

			this.enterContentBlock(L, cursor);

			// If a starting parenthesis is typed, don't actually create it.  Just move the cursor to the content
			// block, and let the hardcoded parenthesis appear.  So it appears as if typing the parenthesis does add
			// a parenthesis.
			if (ch === '(') return true;

			return false;
		};

		return super.html();
	}

	enterContentBlock(dir: Direction, cursor: Cursor) {
		if (dir === L) cursor.insAtLeftEnd(this.blocks[1]);
		else cursor.insAtRightEnd(this.blocks[1]);
	}

	deleteSide(side: Direction, outward: boolean, cursor: Cursor) {
		if (side === L && !(this.blocks[0].isEmpty() && this.blocks[1].isEmpty())) {
			let brack, supsub;
			if (!this.blocks[1].isEmpty()) {
				cursor.insLeftOf(this);
				brack = new Bracket(L, '(', ')', '(', ')');
				brack.replaces(this.blocks[1].children());
				brack.createLeftOf(cursor);
				// Make the parentheses one sided if this function was.
				if (this.side) {
					brack.delims?.[R].classList.add('mq-ghost');
					brack.side = L;
				}
			}

			// If there is a SupSub in the supsub block, then it must be replaced with a new instance.  This is because
			// the original instance has the special MathFunction deleteOutOf handlers.  Those will not work for a usual
			// SupSub.
			if (!this.blocks[0].isEmpty() && this.blocks[0].ends[L] instanceof SupSub) {
				cursor.insLeftOf(brack ?? this);
				// A temporary base is created first and then removed later, because if supSubsRequireOperand is true
				// the following causes errors when the contact weld is called later otherwise.
				const tmpBase = new Variable('x');
				tmpBase.createLeftOf(cursor);
				const origSupSub = this.blocks[0].ends[L];
				for (const supOrSub of ['sub', 'sup'] as Array<keyof Pick<SupSub, 'sub' | 'sup'>>) {
					const src = origSupSub[supOrSub];
					if (src) {
						if (supsub) cursor.insRightOf(supsub);
						const newSupOrSub = new LatexCmds[supOrSub === 'sub' ? 'subscript' : 'superscript']() as SupSub;
						newSupOrSub.replaces(src.children());
						newSupOrSub.createLeftOf(cursor);
						if (!supsub) supsub = newSupOrSub;
					}
				}
				tmpBase.remove();
			}

			this.remove();
			if (supsub) cursor.insLeftOf(supsub);
			else if (brack) cursor.insLeftOf(brack);
		} else super.deleteSide(side, outward, cursor);
	}

	finalizeTree() {
		const inserted = this.inserted;
		super.finalizeTree();

		if (!inserted) {
			this.blocks[0].deleteOutOf = (dir: Direction, cursor: Cursor) => {
				// If at the left end of the supsub block and removing the last character of this function name is still
				// a valid function name, then shorten the function name.
				if (!cursor[L] && LatexCmds[this.ctrlSeq.slice(1, -1)]?.prototype instanceof MathFunction) {
					this.ctrlSeq = this.ctrlSeq.slice(0, -1);
					this.elements.children().first.textContent = this.ctrlSeq.slice(1);
					this.bubble('reflow');
					return;
				}

				if (dir === L) this.deleteSide(dir, true, cursor);
				// If deleting right out of the supsub block, move the cursor to the content block.
				else this.enterContentBlock(L, cursor);
			};

			this.blocks[1].deleteOutOf = (dir: Direction, cursor: Cursor) => {
				// If deleting left out of the content block, move the cursor to the supsub block.
				if (dir === L) cursor?.insAtRightEnd(this.blocks[0]);
				else this.deleteSide(dir, true, cursor);
			};
		}

		this.updateFirst();
	}

	latex() {
		return `${this.ctrlSeq}${this.blocks[0]?.latex() ?? ''}\\left(${this.blocks[1]?.latex() ?? ''}\\right)`;
	}

	text() {
		return `${this.ctrlSeq.slice(1)}${this.blocks[0]?.text() ?? ''}(${this.blocks[1]?.text() ?? ''})`;
	}

	parser() {
		// Create the other end solid.
		delete this.side;

		this.blocks = [new MathBlock(), new MathBlock()];
		for (const block of this.blocks) {
			block.adopt(this, this.ends[R]);
		}

		return Parser.optWhitespace
			.then(Parser.regex(/^(?=[_^])/))
			.then(
				latexMathParser.block.map((block: TNode) => {
					block.children().adopt(this.blocks[0], this.blocks[0].ends[R]);
				})
			)
			.many()
			.or(Parser.succeed(this))
			.then(Parser.optWhitespace)
			.then(
				Parser.regex(/^(?=\))|^(?=\\right\))/).or(
					Parser.string('\\left(')
						.then(
							latexMathParser.block
								.many()
								.map((blocks: Array<MathBlock>) => {
									for (const block of blocks) {
										block.children().adopt(this.blocks[1], this.blocks[1].ends[R]);
									}
								})
								.then(Parser.optWhitespace)
								.skip(Parser.string('\\right)'))
						)
						.or(
							Parser.string('(')
								.then(
									latexMathParser.block
										.many()
										.map((blocks: Array<MathBlock>) => {
											if (blocks[blocks.length - 1].text() === ')') blocks.splice(-1);
											for (const block of blocks) {
												block.children().adopt(this.blocks[1], this.blocks[1].ends[R]);
											}
										})
										.then(Parser.optWhitespace)
										.skip(Parser.string(')').or(Parser.succeed(this)))
								)
								.or(
									Parser.regex(/^\d+\.?\d*|^\d*\.?\d+/)
										.map((number: string) => {
											for (const d of number) {
												const digit = d === '.' ? new VanillaSymbol('.') : new Digit(d);
												digit.adopt(this.blocks[1], this.blocks[1].ends[R]);
											}
										})
										.or(
											latexMathParser.block.map((block: MathBlock) => {
												block.children().adopt(this.blocks[1], this.blocks[1].ends[R]);
											})
										)
								)
						)
						.or(Parser.succeed(this))
				)
			)
			.result(this);
	}
}

interface LatexMathParser extends Parser {
	block: Parser;
	optBlock: Parser;
}

export const latexMathParser = (() => {
	const commandToBlock = (cmd: TNode | Fragment) => {
		// can also take in a Fragment
		const block = new MathBlock();
		cmd.adopt(block);
		return block;
	};

	const joinBlocks = (blocks: Array<MathBlock>) => {
		const firstBlock = blocks[0] || new MathBlock();

		for (const block of blocks.slice(1)) {
			block.children().adopt(firstBlock, firstBlock.ends[R]);
		}

		return firstBlock;
	};

	// Parsers yielding either MathCommands, or Fragments of MathCommands
	//   (either way, something that can be adopted by a MathBlock)
	const variable = Parser.letter.map((c: string) => new Letter(c));
	const digit = Parser.regex(/^\d/).map((c: string) => new Digit(c));
	const symbol = Parser.regex(/^[^${}\\_^]/).map((c: string) => new VanillaSymbol(c));

	const controlSequence = Parser.regex(/^[^\\a-eg-zA-Z]/) // hotfix #164; match MathBlock::write
		.or(
			Parser.string('\\').then(
				Parser.regex(/^[a-z]+/i)
					.or(Parser.regex(/^\s+/).result(' '))
					.or(Parser.any)
			)
		)
		.then((ctrlSeq: string) => {
			const cmdKlass = LatexCmds[ctrlSeq];

			if (cmdKlass) {
				return (new cmdKlass(ctrlSeq) as MathCommand).parser();
			} else {
				return Parser.fail(`unknown command: \\${ctrlSeq}`);
			}
		});

	const command = controlSequence.or(variable).or(digit).or(symbol);

	// Parsers yielding MathBlocks
	const mathGroup: Parser = Parser.string('{')
		.then(() => mathSequence)
		.skip(Parser.string('}'));
	const mathBlock: Parser = Parser.optWhitespace.then(mathGroup.or(command.map(commandToBlock)));
	const mathSequence: Parser = mathBlock.many().map(joinBlocks).skip(Parser.optWhitespace);

	const optMathBlock = Parser.string('[')
		.then(
			mathBlock
				.then((block: MathBlock) => {
					return block.join('latex') !== ']' ? Parser.succeed(block) : Parser.fail();
				})
				.many()
				.map(joinBlocks)
				.skip(Parser.optWhitespace)
		)
		.skip(Parser.string(']'));

	const latexMath = mathSequence;

	(latexMath as LatexMathParser).block = mathBlock;
	(latexMath as LatexMathParser).optBlock = optMathBlock;
	return latexMath as LatexMathParser;
})();
