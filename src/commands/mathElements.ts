// Abstract classes of math blocks and commands.

import {
	type Direction,
	type Constructor,
	noop,
	mqCmdId,
	mqBlockId,
	LatexCmds,
	OPP_BRACKS,
	BRACKET_NAMES,
	SVG_SYMBOLS,
	BuiltInOpNames,
	TwoWordOpNames,
	otherDir
} from 'src/constants';
import { Parser } from 'services/parser.util';
import { Selection } from 'src/selection';
import { deleteSelectTowardsMixin, DelimsMixin } from 'src/mixins';
import type { Options } from 'src/options';
import type { Cursor } from 'src/cursor';
import { Point } from 'tree/point';
import { VNode } from 'tree/vNode';
import { TNode, MathspeakOptions } from 'tree/node';
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
		this.right?.siblingCreated?.(options, 'left');
		this.left?.siblingCreated?.(options, 'right');
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
		const queue: [TNode, number][] = [[this, depth]];

		// Do a breadth-first search of this node's descendants
		// down to cutoff, removing anything deeper.
		while (queue.length) {
			const current = queue.shift();
			current?.[0].children().each((child: TNode) => {
				const i = child instanceof MathBlock ? 1 : 0;
				depth = current[1] + i;

				if (depth <= cutoff) {
					queue.push([child, depth]);
				} else {
					(i ? child.children() : child).remove();
				}
				return true;
			});
		}
	}
}

// Commands and operators, like subscripts, exponents, or fractions.
// Descendant commands are organized into blocks.
export class MathCommand extends deleteSelectTowardsMixin(MathElement) {
	blocks: MathBlock[];
	contentIndex = 0;
	htmlTemplate: string;
	textTemplate: string[];
	mathspeakTemplate: string[] = [''];
	replacedFragment?: Fragment;

	constructor(ctrlSeq?: string, htmlTemplate?: string, textTemplate?: string[]) {
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
		return latexMathParser.block.times(this.numBlocks()).map((blocks: MathBlock[]) => {
			this.blocks = blocks;

			for (const block of blocks) {
				block.adopt(this, this.ends.right);
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
			this.blocks[i].adopt(this, this.ends.right);
		}
	}

	placeCursor(cursor: Cursor) {
		if (!this.ends.left) return;
		// Insert the cursor at the right end of the first empty child, searching from
		// left to right, or if not empty, then to the right end of the child.
		cursor.insAtRightEnd(
			this.foldChildren(this.ends.left, (leftward, child) => (leftward.isEmpty() ? leftward : child))
		);
	}

	selectChildren(): Selection {
		return new Selection(this, this);
	}

	unselectInto(dir: Direction, cursor: Cursor) {
		cursor.insAtDirEnd(otherDir(dir), cursor.anticursor?.ancestors?.[this.id] as TNode);
	}

	seek(pageX: number, cursor: Cursor) {
		const getBounds = (node: TNode) => {
			const rect = node.elements.firstElement.getBoundingClientRect();
			return { left: rect.left, right: rect.left + rect.width };
		};

		const cmdBounds = getBounds(this);

		if (pageX < cmdBounds.left) {
			cursor.insLeftOf(this);
			return;
		}
		if (pageX > cmdBounds.right) {
			cursor.insRightOf(this);
			return;
		}

		let leftLeftBound = cmdBounds.left;
		this.eachChild((block: TNode) => {
			const blockBounds = getBounds(block);
			if (pageX < blockBounds.left) {
				// closer to this block's left bound, or the bound left of that?
				if (pageX - leftLeftBound < blockBounds.left - pageX) {
					if (block.left) cursor.insAtRightEnd(block.left);
					else cursor.insLeftOf(this);
				} else cursor.insAtLeftEnd(block);
				return false;
			} else if (pageX > blockBounds.right) {
				if (block.right)
					leftLeftBound = blockBounds.right; // continue to next block
				else {
					// last (rightmost) block
					// closer to this block's right bound, or the this's right bound?
					if (cmdBounds.right - pageX < pageX - blockBounds.right) {
						cursor.insRightOf(this);
					} else cursor.insAtRightEnd(block);
				}
			} else {
				block.seek(pageX, cursor);
				return false;
			}
			return true;
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
		//   and token becomes undefined. This will loop infinitely, because it
		//   will then TypeError on .slice().

		const blocks = this.blocks;
		const cmdId = ` ${mqCmdId}=${this.id.toString()}`;
		const tokens: string[] = this.htmlTemplate.match(/<[^<>]+>|[^<>]+/g) as string[];

		if (tokens.join('') !== this.htmlTemplate) throw new Error('no unmatched angle brackets');

		// add cmdId to all top-level tags
		for (let i = 0, token = tokens[0]; token; ++i, token = tokens[i]) {
			// top-level self-closing tags
			if (token.endsWith('/>')) {
				tokens[i] = `${token.slice(0, -2)}${cmdId}/>`;
			}
			// top-level open tags
			else if (token.startsWith('<')) {
				if (token.charAt(1) === '/') throw new Error('unmatched top-level close tag');

				tokens[i] = `${token.slice(0, -1)}${cmdId}>`;

				// skip matching top-level close tag and all tag pairs in between
				let nesting = 1;
				do {
					i += 1;
					token = tokens[i];
					if (!token) throw new Error('missing close tags');
					// close tags
					if (token.startsWith('</')) {
						nesting -= 1;
					}
					// non-self-closing open tags
					else if (token.startsWith('<') && !token.endsWith('/>')) {
						nesting += 1;
					}
				} while (nesting > 0);
			}
		}
		return tokens
			.join('')
			.replace(
				/>&(\d+)/g,
				(_$0, $1: number) =>
					` ${mqBlockId}=${blocks[$1]?.id.toString() ?? ''}>${blocks[$1]?.join('html') ?? ''}`
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
			if (text && this.textTemplate[i] === '(' && child_text.startsWith('(') && child_text.endsWith(')'))
				return text + child_text.slice(1, -1) + this.textTemplate[i];
			return text + child_text + (this.textTemplate[i] || '');
		});
	}

	mathspeak() {
		let i = 0;
		return this.foldChildren(
			`${this.mathspeakTemplate[i] || `Start${this.ctrlSeq.replace(/^\\/, '')}`} `,
			(speech, block) => {
				++i;
				return `${speech} ${block.mathspeak()} ${
					this.mathspeakTemplate[i] || `End${this.ctrlSeq.replace(/^\\/, '')}`
				} `;
			}
		);
	}
}

// Lightweight command without blocks or children.
export class Symbol extends MathCommand {
	constructor(ctrlSeq?: string, html?: string, text?: string, mathspeak?: string) {
		const textTemplate = text ? text : ctrlSeq && ctrlSeq.length > 1 ? ctrlSeq.slice(1) : (ctrlSeq ?? '');
		super(ctrlSeq, html, [textTemplate]);

		this.createBlocks = noop;
		this.isSymbol = true;
		this.mathspeakName = mathspeak || text || ctrlSeq?.replace(/^\\/, '');
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
		if (dir === 'left') this.elements.first.before(cursor.element);
		else this.elements.last.after(cursor.element);

		cursor[otherDir(dir)] = this;
		cursor[dir] = this[dir];

		cursor.controller.aria.queue(this);
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

	mathspeak() {
		return this.mathspeakName || '';
	}
}

export class VanillaSymbol extends Symbol {
	constructor(ch: string, html?: string, text?: string, mathspeak?: string) {
		super(ch, `<span>${html || ch}</span>`, text, mathspeak);
	}
}

export class BinaryOperator extends Symbol {
	isUnary = false;

	constructor(ctrlSeq: string, html?: string, text?: string, mathspeak?: string, useRawHtml = false) {
		super(ctrlSeq, useRawHtml ? html : `<span class="mq-binary-operator">${html ?? ''}</span>`, text, mathspeak);
	}
}

export interface InequalityData {
	ctrlSeq: string;
	html: string;
	text: string;
	mathspeak: string;
	ctrlSeqStrict: string;
	htmlStrict: string;
	textStrict: string;
	mathspeakStrict: string;
}

export class Inequality extends BinaryOperator {
	data: InequalityData;
	strict: boolean;

	constructor(data: InequalityData, strict: boolean) {
		const strictness = strict ? 'Strict' : '';
		super(
			data[`ctrlSeq${strictness}`],
			data[`html${strictness}`],
			data[`text${strictness}`],
			data[`mathspeak${strictness}`]
		);
		this.data = data;
		this.strict = strict;
	}

	swap(strict: boolean) {
		this.strict = strict;
		const strictness = strict ? 'Strict' : '';
		this.ctrlSeq = this.data[`ctrlSeq${strictness}`];
		this.elements.html(this.data[`html${strictness}`]);
		this.textTemplate = [this.data[`text${strictness}`]];
		this.mathspeakName = this.data[`mathspeak${strictness}`];
	}

	deleteTowards(dir: Direction, cursor: Cursor) {
		if (dir === 'left' && !this.strict) {
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
		super('=', '=', '=', 'equals');
	}

	createLeftOf(cursor: Cursor) {
		if (cursor.left instanceof Inequality && cursor.left.strict) {
			cursor.left.swap(false);
			cursor.left.bubble('reflow');
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
			((cursor.left instanceof Variable && cursor.left.isItalic) ||
				(cursor.left instanceof SupSub && cursor.left.left instanceof Variable && cursor.left.left.isItalic))
		) {
			new LatexCmds._().createLeftOf(cursor);
			super.createLeftOf(cursor);
			if (cursor.parent?.parent) cursor.insRightOf(cursor.parent.parent);
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
		if (text.startsWith('\\')) {
			if (text.startsWith('\\operatorname{')) text = text.slice(14, text.length);
			else text = text.slice(1, text.length);
		} else if (text.endsWith(' ') || text.endsWith('}')) {
			text = text.slice(0, -1);
			if (!(this.right instanceof Bracket || this.right instanceof Fraction || this.right instanceof SupSub))
				text += ' ';
		}
		return text;
	}
}

export class Letter extends Variable {
	letter: string;

	constructor(ch: string, htmlTemplate?: string) {
		super(ch, htmlTemplate);
		this.letter = ch;
		this.siblingDeleted = this.siblingCreated = (opts: Options, dir?: Direction) => {
			this.finalizeTree(opts, dir);
		};
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
			while (l instanceof Letter && l.ctrlSeq === l.letter && i < maxLength) {
				str = l.letter + str;
				l = l.left;
				++i;
			}
			// Check for an autocommand, going through substrings from longest to shortest.
			while (str.length) {
				if (autoCmds[str]) {
					// eslint-disable-next-line @typescript-eslint/no-this-alias
					for (i = 1, l = this; i < str.length; ++i, l = l?.left);
					new Fragment(l, this).remove();
					cursor.left = l?.left;
					new LatexCmds[str](str).createLeftOf(cursor);
					return;
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
		// don't auto-un-italicize if the sibling to my right changed (dir === 'right' or
		// undefined) and it's now a Letter, it will un-italicize everyone
		if (dir !== 'left' && this.right instanceof Letter) return;
		this.autoUnItalicize(opts);
	}

	autoUnItalicize(opts: Options) {
		const autoOps = opts.autoOperatorNames;
		if (autoOps._maxLength === 0) return;
		// want longest possible operator names, so join together entire contiguous
		// sequence of letters
		let str = this.letter,
			l = this.left,
			r = this.right;
		for (; l instanceof Letter; l = l.left) str = l.letter + str;
		for (; r instanceof Letter; r = r.right) str += r.letter;

		// removeClass and delete flags from all letters before figuring out
		// which, if any, are part of an operator name
		new Fragment(l?.right || this.parent?.ends.left, r?.left || this.parent?.ends.right).each((el: TNode) => {
			(el as Letter).italicize(true).elements.removeClass('mq-first', 'mq-last', 'mq-followed-by-supsub');
			el.ctrlSeq = (el as Letter).letter;
			return true;
		});

		// check for operator names: at each position from left to right, check
		// substrings from longest to shortest
		for (let i = 0, first = l?.right || this.parent?.ends.left; i < str.length; ++i, first = first?.right) {
			for (let len = Math.min(autoOps._maxLength, str.length - i); len > 0; --len) {
				const word = str.slice(i, i + len);
				if (autoOps[word]) {
					let last;
					for (let j = 0, letter = first; j < len; j += 1, letter = letter?.right) {
						(letter as Letter).italicize(false);
						last = letter;
					}

					const isBuiltIn = BuiltInOpNames[word] as 1 | undefined;
					(first as Letter).ctrlSeq = (isBuiltIn ? '\\' : '\\operatorname{') + (first?.ctrlSeq ?? '');
					(last as Letter).ctrlSeq += isBuiltIn ? ' ' : '}';
					if (word in TwoWordOpNames) last?.left?.left?.left?.elements.addClass('mq-last');
					if (!this.shouldOmitPadding(first?.left)) first?.elements.addClass('mq-first');
					if (!this.shouldOmitPadding(last?.right)) {
						const rightward = last?.right;
						if (rightward instanceof SupSub) rightward.siblingCreated?.(opts);
						else last?.elements.toggleClass('mq-last', !(rightward instanceof Bracket));
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
	const cmd = this.parent;
	if (!cmd) return;
	let ancestorCmd: TNode | Point | undefined = cursor;
	do {
		if (ancestorCmd?.right) return cursor.insLeftOf(cmd);
		ancestorCmd = ancestorCmd?.parent?.parent;
	} while (ancestorCmd !== cmd);
	cursor.insRightOf(cmd);
}

// This test is used to determine whether an item may be treated as a whole number
// for shortening the verbalized (mathspeak) forms of some fractions and superscripts.
export const intRgx = /^[+-]?[\d]+$/;

// Traverses the passed block's children and returns the concatenation of their ctrlSeq properties.
// Used in shortened mathspeak computations as a block's .text() method can be potentially expensive.
export const getCtrlSeqsFromBlock = (block: TNode | undefined): string => {
	if (!block) return '';

	let chars = '';
	block.eachChild((child) => {
		chars += child.ctrlSeq;
		return true;
	});

	return chars;
};

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
		let leftward = this.left;
		for (; leftward && leftward.ctrlSeq === '\\ '; leftward = leftward.left);

		const text = (dir: Direction) => {
			let needParens = false;
			let numBlocks = 0;
			let haveDigits = false;
			let numPeriods = 0;
			let newBlock = false;
			this.ends[dir]?.eachChild((child: TNode) => {
				if (child instanceof Digit) haveDigits = true;
				if (child instanceof VanillaSymbol && child.ctrlSeq === '.') ++numPeriods;

				if (
					newBlock ||
					!(
						child instanceof Digit ||
						(child instanceof VanillaSymbol && child.ctrlSeq === '.' && numPeriods < 2 && !numBlocks) ||
						(child instanceof BinaryOperator && child.isUnary) ||
						child instanceof SupSub
					)
				)
					++numBlocks;

				// These are things that terminate a block.  Anything typed after them
				// starts a new block and increments the block count above.
				newBlock =
					('factorial' in LatexCmds && child instanceof LatexCmds.factorial) || child instanceof SupSub;

				if (
					(haveDigits && numBlocks) ||
					numBlocks > 1 ||
					numPeriods > 1 ||
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

			const blankDefault = dir === 'left' ? '0' : '1';
			const l = this.ends[dir]?.text() !== ' ' && this.ends[dir]?.text();
			return l ? ((needParens as boolean) ? `(${l})` : l) : blankDefault;
		};
		return (leftward instanceof BinaryOperator && leftward.isUnary) ||
			leftward?.elements.hasClass('mq-operator-name') ||
			(leftward instanceof SupSub && leftward.left?.elements.hasClass('mq-operator-name'))
			? `(${text('left')}/${text('right')})`
			: ` ${text('left')}/${text('right')} `;
	}

	finalizeTree() {
		this.upInto = this.ends.left;
		if (this.ends.right) {
			this.ends.right.upOutOf = this.ends.left;
			this.ends.right.ariaLabel = 'denominator';
		}
		this.downInto = this.ends.right;
		if (this.ends.left) {
			this.ends.left.downOutOf = this.ends.right;
			this.ends.left.ariaLabel = 'numerator';
		}

		const fracDepth = this.getFracDepth();
		if (fracDepth > 2) {
			this.mathspeakTemplate = [
				`StartDepth${fracDepth.toString()}Fraction,`,
				`Depth${fracDepth.toString()}Over`,
				`, EndDepth${fracDepth.toString()}Fraction`
			];
		} else if (fracDepth > 1) {
			this.mathspeakTemplate = ['StartNestedFraction,', 'NestedOver', ', EndNestedFraction'];
		} else {
			this.mathspeakTemplate = ['StartFraction,', 'Over', ', EndFraction'];
		}
	}

	mathspeak(opts?: MathspeakOptions) {
		if (opts?.createdLeftOf) {
			const cursor = opts.createdLeftOf;
			return cursor.parent?.mathspeak() ?? '';
		}

		const numText = getCtrlSeqsFromBlock(this.ends.left);
		const denText = getCtrlSeqsFromBlock(this.ends.right);

		// Shorten mathspeak value for whole number fractions whose denominator is less than 10.
		if (!opts?.ignoreShorthand && intRgx.test(numText) && intRgx.test(denText)) {
			const isSingular = numText === '1' || numText === '-1';
			let newDenSpeech = '';
			if (denText === '2') newDenSpeech = isSingular ? 'half' : 'halves';
			else if (denText === '3') newDenSpeech = isSingular ? 'third' : 'thirds';
			else if (denText === '4') newDenSpeech = isSingular ? 'fourth' : 'fourths';
			else if (denText === '5') newDenSpeech = isSingular ? 'fifth' : 'fifths';
			else if (denText === '6') newDenSpeech = isSingular ? 'sixth' : 'sixths';
			else if (denText === '7') newDenSpeech = isSingular ? 'seventh' : 'sevenths';
			else if (denText === '8') newDenSpeech = isSingular ? 'eighth' : 'eighths';
			else if (denText === '9') newDenSpeech = isSingular ? 'ninth' : 'ninths';

			if (newDenSpeech !== '') {
				// Handle the case of an integer followed by a simplified fraction such as 1\frac{1}{2}.  Such
				// combinations should be spoken aloud as "1 and 1 half."
				let precededByInteger = false;
				for (let sibling = this.left; sibling; sibling = sibling.left) {
					// Ignore whitespace
					if (sibling.ctrlSeq === '\\ ') continue;
					else if (intRgx.test(sibling.ctrlSeq)) precededByInteger = true;
					else break;
				}
				return `${precededByInteger ? 'and ' : ''}${this.ends.left?.mathspeak() ?? ''} ${newDenSpeech}`;
			}
		}

		return super.mathspeak();
	}

	getFracDepth() {
		const level = 0;
		const walkUp = function (item: TNode, level: number): number {
			if (item instanceof Fraction) ++level;
			if (item.parent) return walkUp(item.parent, level);
			else return level;
		};
		return walkUp(this, level);
	}
}

export const supSubText = (prefix: string, block?: TNode) => {
	let needParens = false;
	let numBlocks = 0;
	let haveDigits = false;
	let numPeriods = 0;
	let newBlock = false;
	block?.eachChild((child: TNode) => {
		if (child instanceof Digit) haveDigits = true;
		if (child instanceof VanillaSymbol && child.ctrlSeq === '.') ++numPeriods;

		if (
			newBlock ||
			!(
				child instanceof Digit ||
				(child instanceof VanillaSymbol && child.ctrlSeq === '.' && numPeriods < 2 && !numBlocks) ||
				(child instanceof BinaryOperator && child.isUnary)
			)
		)
			++numBlocks;

		// These are things that terminate a block.  Anything typed after them
		// starts a new block and increments the block count above.
		newBlock = 'factorial' in LatexCmds && child instanceof LatexCmds.factorial;

		if (
			(haveDigits && numBlocks) ||
			numBlocks > 1 ||
			numPeriods > 1 ||
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
	return l ? prefix + ((needParens as boolean) ? `(${l})` : l) : '';
};

export class SupSub extends MathCommand {
	supsub: 'sup' | 'sub' = 'sup';

	constructor(_ctrlSeq?: string, htmlTemplate?: string, textTemplate?: string[]) {
		super('_{...}^{...}', htmlTemplate, textTemplate);

		this.reflow = () => {
			const block = this.elements; // mq-supsub
			const prev = block.first.previousElementSibling;

			// We can't normalize the superscript without having a previous element (which is the base).
			if (!prev) return;

			const sup = block.children('.mq-sup').firstElement as HTMLElement | undefined; // mq-supsub -> mq-sup
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
				sup.style.marginBottom = `${(cur_margin + needed).toString()}px`;
			}
		};

		this.siblingCreated = this.siblingDeleted = (options: Options) => {
			if (
				this.left instanceof Letter &&
				this.left.isPartOfOperator &&
				this.right &&
				!(
					this.right instanceof BinaryOperator ||
					this.right instanceof UpperLowerLimitCommand ||
					this.right instanceof Bracket
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
				!/^[,;:]$/.test(leftward.ctrlSeq)) ||
			(!leftward && parent?.parent instanceof MathFunction && parent == parent.parent.blocks[0])
		);
	}

	createLeftOf(cursor: Cursor) {
		if (this.hasValidBase(cursor.options, cursor.left, cursor.parent)) {
			// If this SupSub is being placed on a fraction, then add parentheses around the fraction.
			if (cursor.left instanceof Fraction) {
				const brack = new Bracket('right', '(', ')', '(', ')');
				cursor.selection = (cursor.left as TNode).selectChildren();
				brack.replaces(cursor.replaceSelection());
				brack.createLeftOf(cursor);
			}

			super.createLeftOf(cursor);
			return;
		}

		if (this.replacedFragment) {
			if (cursor.parent) this.replacedFragment.adopt(cursor.parent, cursor.left, cursor.right);
			cursor.left = this.replacedFragment.ends.right;
		}
	}

	contactWeld(cursor?: Cursor) {
		// Look on either side for a SupSub.  If one is found compare this .sub, .sup with its .sub, .sup.  If this has
		// one that it doesn't, then call .addBlock() on it with this block.  If this has one that it also has, then
		// insert this block's children into its block, unless this block has none, in which case insert the cursor into
		// its block (and not this one, since this one will be removed).  If something to the left has been deleted,
		// then this SupSub will be merged with one to the left if it is left next to it after the deletion.
		for (const dir of ['left', 'right'] as Direction[]) {
			if (this[dir] instanceof SupSub) {
				let pt;
				for (const supsub of ['sub', 'sup'] as (keyof Pick<SupSub, 'sub' | 'sup'>)[]) {
					const src = this[supsub],
						dest = this[dir][supsub];
					if (!src) continue;
					if (!dest) this[dir].addBlock(src.disown());
					else if (!src.isEmpty()) {
						// Insert src children at -dir end of dest
						src.elements.children().insAtDirEnd(otherDir(dir), dest.elements);
						const children = src.children().disown();
						pt = new Point(dest, children.ends.right, dest.ends.left);
						if (dir === 'left') children.adopt(dest, dest.ends.right);
						else children.adopt(dest, undefined, dest.ends.left);
					} else pt = new Point(dest, undefined, dest.ends.left);
					this.placeCursor = (cursor) => cursor.insAtDirEnd(otherDir(dir), dest || src);
				}
				this.remove();
				if (cursor) {
					if (cursor.left === this) {
						if (dir === 'right' && pt) {
							if (pt.left) cursor.insRightOf(pt.left);
							else if (pt.parent) cursor.insAtLeftEnd(pt.parent);
						} else cursor.insRightOf(this[dir] as TNode);
					} else {
						if (pt?.right) cursor.insRightOf(pt.right);
					}
				}
				return;
			}
		}

		if (cursor) this.maybeFlatten(cursor.options);

		// Only allow deletion of a sup or sub in a function supsub block when it is empty.
		// This sets that up when the first sup or sub is created.
		if (
			this.parent?.parent instanceof MathFunction &&
			this.parent == this.parent.parent.blocks[0] &&
			!(this.sup && this.sub)
		) {
			const fcnBlock = this.parent.parent.blocks[0];
			for (const supsub of ['sub', 'sup'] as (keyof Pick<SupSub, 'sub' | 'sup'>)[]) {
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
		if (this.ends.left) this.ends.left.isSupSubLeft = true;
	}

	// Check to see if this has an invalid base.  If so bring the children out, and remove this SupSub.
	maybeFlatten(options: Options) {
		const cursor = this.getController()?.cursor;
		const leftward = cursor?.right === this ? cursor.left : this.left;
		if (!this.hasValidBase(options, leftward, this.parent) || leftward instanceof Fraction) {
			for (const supsub of ['sub', 'sup'] as (keyof Pick<SupSub, 'sub' | 'sup'>)[]) {
				const src = this[supsub];
				if (!src) continue;
				if (this.parent)
					src.children()
						.disown()
						.adopt(this.parent, this.left, this)
						.elements.insDirOf('left', this.elements);
			}
			this.remove();
			if (leftward === cursor?.left) {
				if (cursor?.left?.right) cursor.insLeftOf(cursor.left.right);
				else if (cursor?.parent) cursor.insAtDirEnd('left', cursor.parent);
			}
		}
	}

	moveTowards(dir: Direction, cursor: Cursor, updown?: 'up' | 'down') {
		if (cursor.options.autoSubscriptNumerals && !this.sup) cursor.insDirOf(dir, this);
		else super.moveTowards(dir, cursor, updown);
	}

	deleteTowards(dir: Direction, cursor: Cursor) {
		if (cursor.options.autoSubscriptNumerals && this.sub) {
			const cmd = this.sub.ends[otherDir(dir)];
			if (cmd instanceof Symbol) cmd.remove();
			else if (cmd) cmd.deleteTowards(dir, cursor.insAtDirEnd(otherDir(dir), this.sub));

			// TODO: factor out a .removeBlock() or something
			if (this.sub.isEmpty()) {
				this.sub.deleteOutOf('left', cursor.insAtLeftEnd(this.sub));
				if (this.sup) cursor.insDirOf(otherDir(dir), this);
				// Note `-dir` because in e.g. x_1^2| want backspacing (leftward)
				// to delete the 1 but to end up rightward of x^2; with non-negated
				// `dir` (try it), the cursor appears to have gone "through" the ^2.
			}
		} else super.deleteTowards(dir, cursor);
	}

	latex() {
		const latex = (prefix: string, block?: TNode) => {
			const l = block?.latex();
			return block ? prefix + (l?.length === 1 ? l : `{${l || ' '}}`) : '';
		};
		return latex('_', this.sub) + latex('^', this.sup);
	}

	text() {
		const mainText = supSubText('_', this.sub) + supSubText('^', this.sup);
		return mainText + (mainText && this.right instanceof Digit ? ' ' : '');
	}

	addBlock(block: TNode) {
		if (this.supsub === 'sub') {
			this.sup = this.upInto = block;
			if (this.sub) this.sub.upOutOf = block;
			block.adopt(this, this.sub).downOutOf = this.sub;

			const blockEl = document.createElement('span');
			blockEl.classList.add('mq-sup');
			blockEl.append(...block.elements.children().contents);
			blockEl.setAttribute(mqBlockId, block.id.toString());
			this.elements.firstElement.prepend(blockEl);
			block.elements = new VNode(blockEl);
		} else {
			this.sub = this.downInto = block;
			if (this.sup) this.sup.downOutOf = block;
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

		for (const supsub of ['sub', 'sup'] as (keyof Pick<SupSub, 'sub' | 'sup'>)[]) {
			const oppositeSupsub = supsub === 'sub' ? 'sup' : 'sub';
			const updown = supsub === 'sub' ? 'down' : 'up';
			const thisSupsub = this[supsub] as MathElement;

			if (this.parent?.parent instanceof MathFunction && this.parent === this.parent.parent.blocks[0]) {
				// Only allow deletion of a sup or sub in a function supsub block when it is empty.
				// This sets that up when the second sup or sub is created (or when parsing and both exist).
				thisSupsub.deleteOutOf = (dir: Direction, cursor: Cursor) => {
					if (thisSupsub.isEmpty()) {
						cursor[otherDir(dir)] = thisSupsub.ends[dir];
						this.supsub = oppositeSupsub;
						if (supsub === 'sup') delete this.sup;
						else delete this.sub;
						if (updown === 'up') delete this.upInto;
						else delete this.downInto;
						const remainingSupsub = this[oppositeSupsub] as SupSub;
						remainingSupsub[`${updown}OutOf`] = insLeftOfMeUnlessAtEnd;
						remainingSupsub.deleteOutOf = (dir: Direction, cursor: Cursor) => {
							if (remainingSupsub.isEmpty()) this.remove();
							if (this.parent) cursor.insAtDirEnd(dir, this.parent);
						};
						if (supsub === 'sub') {
							this.elements.addClass('mq-sup-only');
							this.elements.first.lastChild?.remove();
						}
						thisSupsub.remove();
					}
					if (thisSupsub.parent) cursor.insDirOf(thisSupsub[dir] ? otherDir(dir) : dir, thisSupsub.parent);
				};
			} else {
				thisSupsub.deleteOutOf = (dir: Direction, cursor: Cursor) => {
					if (thisSupsub.parent) cursor.insDirOf(thisSupsub[dir] ? otherDir(dir) : dir, thisSupsub.parent);
					if (!thisSupsub.isEmpty()) {
						const end = thisSupsub.ends[dir];
						if (cursor.parent) {
							thisSupsub
								.children()
								.disown()
								.withDirAdopt(dir, cursor.parent, cursor[dir], cursor[otherDir(dir)])
								.elements.insDirOf(otherDir(dir), cursor.element);
						}
						cursor[otherDir(dir)] = end;
					}
					this.supsub = oppositeSupsub;
					if (supsub === 'sup') delete this.sup;
					else delete this.sub;
					if (updown === 'up') delete this.upInto;
					else delete this.downInto;
					if (this[oppositeSupsub]) this[oppositeSupsub][`${updown}OutOf`] = insLeftOfMeUnlessAtEnd;
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
		return `${this.ctrlSeq}_${simplify(this.ends.left?.latex() ?? '')}^${simplify(this.ends.right?.latex() ?? '')}`;
	}

	text() {
		const operand = this.ctrlSeq.slice(1, this.ctrlSeq.length - 1);
		return `${operand}(${this.ends.left?.text() ?? ''},${this.ends.right?.text() ?? ''})`;
	}

	mathspeak() {
		return `Start ${
			this.ariaLabel ?? this.ctrlSeq.replace(/^\\/, '')
		} from ${this.ends.left?.mathspeak() ?? ''} to ${
			this.ends.right?.mathspeak() ?? ''
		}, End ${this.ariaLabel ?? this.ctrlSeq.replace(/^\\/, '')}, `;
	}

	parser() {
		const blocks = (this.blocks = [new MathBlock(), new MathBlock()]);
		for (const block of blocks) {
			block.adopt(this, this.ends.right);
		}

		return Parser.optWhitespace
			.then(Parser.string('_').or(Parser.string('^')))
			.then((supOrSub) => {
				const child = blocks[supOrSub === '_' ? 0 : 1];
				return latexMathParser.block.then((block: TNode) => {
					block.children().adopt(child, child.ends.right);
					return Parser.succeed(this);
				});
			})
			.many()
			.result(this);
	}

	finalizeTree() {
		this.downInto = this.ends.left;
		this.upInto = this.ends.right;
		if (this.ends.left) {
			this.ends.left.upOutOf = this.ends.right;
			this.ends.left.ariaLabel = 'lower bound';
		}
		if (this.ends.right) {
			this.ends.right.downOutOf = this.ends.left;
			this.ends.right.ariaLabel = 'upper bound';
		}
	}
}

type BracketType = Bracket | MathFunction;

const BracketMixin = <TBase extends Constructor<MathCommand>>(Base: TBase) =>
	class extends DelimsMixin(Base) {
		side?: Direction = 'left';
		sides: {
			left: { ch: string; ctrlSeq: string };
			right: { ch: string; ctrlSeq: string };
		} = { left: { ch: '(', ctrlSeq: '(' }, right: { ch: ')', ctrlSeq: ')' } };
		inserted = false;

		matchBrack(opts: Options, expectedSide?: Direction, node?: TNode): false | BracketType {
			// Return node iff it's a matching 1-sided bracket of expected side (if any).
			// A function is only allowed to match an ending parentheses.
			return (
				((node instanceof Bracket &&
					(!(this instanceof MathFunction) || (!!node.side && node.sides[node.side].ch) === ')')) ||
					(node instanceof MathFunction && !!this.side && this.sides[this.side].ch === ')')) &&
				!!node.side &&
				node.side !== (expectedSide === 'left' ? 'right' : expectedSide === 'right' ? 'left' : 0) &&
				(!opts.restrictMismatchedBrackets ||
					(this.side && OPP_BRACKS[this.sides[this.side].ch] === node.sides[node.side].ch) ||
					{ '(': ']', '[': ')' }[this.sides.left.ch] === node.sides.right.ch) &&
				node
			);
		}

		closeOpposing(brack: BracketType) {
			delete brack.side;
			if (!this.side) return;
			// Copy this objects info to brack as this may be a different type of bracket (like (a, b]).
			brack.sides[this.side] = this.sides[this.side];
			const delim = brack.delims?.[this.side === 'left' ? 0 : 1];
			if (delim) {
				delim.classList.remove('mq-ghost');
				this.replaceBracket(delim, this.side);
			}
		}

		createLeftOf(cursor: Cursor) {
			let brack, side: Direction | undefined;
			if (!this.replacedFragment) {
				// If a selection is not being wrapped in this bracket, check to see if this
				// bracket is next to or inside an opposing one-sided bracket.
				const opts = cursor.options;
				if (this.sides.left.ch === '|') {
					// Check both sides if this is an absolute value bracket.
					brack =
						this.matchBrack(opts, 'right', cursor.right) ||
						this.matchBrack(opts, 'left', cursor.left) ||
						this.matchBrack(opts, undefined, cursor.parent?.parent);
				} else {
					const otherSide = otherDir(this.side);
					brack =
						this.matchBrack(opts, otherSide, cursor[otherSide]) ||
						this.matchBrack(opts, otherSide, cursor.parent?.parent);
				}
			}
			if (brack) {
				// brack may be an absolute value with .side not yet set
				side = this.side = otherDir(brack.side);

				// Move the stuff between this bracket and the ghost of the other bracket outside.
				if (brack === cursor.parent?.parent && cursor[side] && brack.parent) {
					new Fragment(cursor[side], cursor.parent.ends[side], otherDir(side))
						.disown()
						.withDirAdopt(otherDir(side), brack.parent, brack, brack[side])
						.elements.insDirOf(side, brack.elements);
				}

				if (this instanceof MathFunction && side === 'left') {
					// If a math function is typed between a ghosted left parenthesis and a solid right parenthesis,
					// then adopt its contents and replace the parentheses.
					const rightward =
						brack === cursor.parent?.parent && cursor.right !== brack.ends.right?.right
							? new Fragment(cursor.right, brack.ends.right?.ends.right, 'left').disown()
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
					cursor.right instanceof Bracket &&
					cursor.right.sides.left.ch === '(' &&
					cursor.right.sides.right.ch === ')'
				) {
					const paren = cursor.right;
					this.side = paren.side;
					this.replaces(new Fragment(paren.ends.left?.ends.left, paren.ends.right?.ends.right, 'left'));
					super.createLeftOf(cursor);
					paren.remove();
					this.bubble('reflow');
					return;
				}

				// eslint-disable-next-line @typescript-eslint/no-this-alias
				brack = this;
				side = brack.side;
				// If wrapping a selection, don't be one-sided.
				if (brack.replacedFragment) delete brack.side;
				else if (cursor[otherDir(side)]) {
					// Auto-expand so the ghost is at the far end.
					brack.replaces(new Fragment(cursor[otherDir(side)], cursor.parent?.ends[otherDir(side)], side));
					if (side === 'left') delete cursor.right;
					else delete cursor.left;
				}
				super.createLeftOf(cursor);
			}
			if (side === 'left' && brack.ends.left) cursor.insAtLeftEnd(brack.ends.left);
			else cursor.insRightOf(brack);
		}

		unwrap() {
			const node = this.parent
				? this.blocks[this.contentIndex].children().disown().adopt(this.parent, this, this.right)
				: undefined;
			if (node) this.elements.last.after(...node.elements.contents);
			this.remove();
		}

		deleteSide(side: Direction, outward: boolean, cursor: Cursor) {
			const parent = this.parent,
				sib = this[side],
				farEnd = parent?.ends[side];

			if (side === this.side) {
				// If deleting a non-ghost of a one-sided bracket, then unwrap the bracket.
				this.unwrap();
				if (sib) cursor.insDirOf(otherDir(side), sib);
				else if (parent) cursor.insAtDirEnd(side, parent);
				return;
			}

			const wasSolid = !this.side;
			this.side = otherDir(side);
			// If deleting a like, outer close-brace of [(1+2)+3} where the inner open-paren
			// is a ghost then become [1+2)+3.
			if (this.matchBrack(cursor.options, side, this.blocks[this.contentIndex].ends[this.side])) {
				this.closeOpposing(this.blocks[this.contentIndex].ends[this.side] as BracketType);
				const origEnd = this.blocks[this.contentIndex].ends[side];
				this.unwrap();
				origEnd?.siblingCreated?.(cursor.options, side);
				if (sib) cursor.insDirOf(otherDir(side), sib);
				else if (parent) cursor.insAtDirEnd(side, parent);
			} else {
				// If deleting a like, inner close-brace of ([1+2}+3) where the outer open-paren is a ghost,
				// then become [1+3+3).
				if (this.matchBrack(cursor.options, side, this.parent?.parent)) {
					(this.parent?.parent as BracketType).closeOpposing(this);
					(this.parent?.parent as BracketType).unwrap();
				} else if (outward && wasSolid) {
					// If deleting outward from a solid pair, unwrap.
					this.unwrap();
					if (sib) cursor.insDirOf(otherDir(side), sib);
					else if (parent) cursor.insAtDirEnd(side, parent);
					return;
				} else {
					// If deleting just one of a pair of brackets, become one-sided.
					this.sides[side] = {
						ch: OPP_BRACKS[this.sides[this.side].ch],
						ctrlSeq: OPP_BRACKS[this.sides[this.side].ctrlSeq]
					};
					this.delims?.forEach((delim, index) => {
						delim.classList.remove('mq-ghost');
						if (index === (side === 'left' ? 0 : 1)) {
							delim.classList.add('mq-ghost');
							this.replaceBracket(delim, side);
						}
					});
				}
				if (sib) {
					// Auto-expand so the ghost is at the far end.
					const origEnd = this.blocks[this.contentIndex].ends[side];
					this.blocks[this.contentIndex].elements.removeClass('mq-empty');
					new Fragment(sib, farEnd, otherDir(side))
						.disown()
						.withDirAdopt(otherDir(side), this.blocks[this.contentIndex], origEnd)
						.elements.insAtDirEnd(side, this.blocks[this.contentIndex].elements);
					origEnd?.siblingCreated?.(cursor.options, side);
					cursor.insDirOf(otherDir(side), sib);
				} else {
					// Otherwise the cursor goes just outside or just inside the parentheses.
					if (outward) cursor.insDirOf(side, this);
					else cursor.insAtDirEnd(side, this.blocks[this.contentIndex]);
				}
			}
		}

		replaceBracket(brackFrag: HTMLElement, side: Direction) {
			if (!(this instanceof Bracket) && !(this instanceof MathFunction))
				throw new Error('can only replace bracket for a Bracket or MathFunction');
			const symbol = this.getSymbol(side);

			brackFrag.innerHTML = symbol.html;
			brackFrag.style.width = symbol.width;

			if (side === 'left') {
				const next = brackFrag.nextElementSibling;
				if (next instanceof HTMLElement) next.style.marginLeft = symbol.width;
			} else {
				const prev = brackFrag.previousElementSibling;
				if (prev instanceof HTMLElement) prev.style.marginRight = symbol.width;
			}
		}

		getSymbol(side?: Direction) {
			return (
				(SVG_SYMBOLS[this.sides[side || 'right'].ch] as { width: string; html: string } | undefined) || {
					width: '0',
					html: ''
				}
			);
		}

		deleteTowards(dir: Direction, cursor: Cursor) {
			this.deleteSide(otherDir(dir), false, cursor);
		}

		finalizeTree() {
			if (!this.inserted) {
				this.blocks[this.contentIndex].deleteOutOf = (dir: Direction, cursor: Cursor) => {
					this.deleteSide(dir, true, cursor);
				};
				this.inserted = true;
				return;
			}

			this.delims?.[this.side === 'left' ? 1 : 0].classList.remove('mq-ghost');
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
			left: { ch: open, ctrlSeq: ctrlSeq },
			right: { ch: close, ctrlSeq: end }
		};
		this.placeCursor = noop;

		// If something is typed between the ghost and the far end of its block, then solidify the ghost.
		this.siblingCreated = (_opts: Options, dir?: Direction) => {
			if (dir === otherDir(this.side)) this.finalizeTree();
		};
	}

	numBlocks() {
		return 1;
	}

	html() {
		const leftSymbol = this.getSymbol('left');
		const rightSymbol = this.getSymbol('right');

		// Wait until now to set the html template so that .side may be set by createLeftOf or the parser.
		this.htmlTemplate =
			'<span class="mq-bracket-container mq-non-leaf">' +
			`<span class="mq-bracket-l mq-scaled mq-paren${
				this.side === 'right' ? ' mq-ghost' : ''
			}" style="width:${leftSymbol.width}">` +
			leftSymbol.html +
			'</span>' +
			`<span class="mq-bracket-middle mq-non-leaf" style="margin-left:${
				leftSymbol.width
			};margin-right:${rightSymbol.width}">&0</span>` +
			`<span class="mq-bracket-r mq-scaled mq-paren${
				this.side === 'left' ? ' mq-ghost' : ''
			}" style="width:${rightSymbol.width}">` +
			rightSymbol.html +
			'</span>' +
			'</span>';
		return super.html();
	}

	latex() {
		return `\\left${this.sides.left.ctrlSeq}${this.ends.left?.latex() ?? ''}\\right${this.sides.right.ctrlSeq}`;
	}

	text() {
		return `${this.sides.left.ch}${this.ends.left?.text() ?? ''}${this.sides.right.ch}`;
	}

	mathspeak(opts?: MathspeakOptions) {
		const open = this.sides.left.ch,
			close = this.sides.right.ch;
		if (open === '|' && close === '|') {
			this.mathspeakTemplate = ['StartAbsoluteValue,', ', EndAbsoluteValue'];
			this.ariaLabel = 'absolute value';
		} else if (opts?.createdLeftOf && this.side) {
			return `${this.side} ${BRACKET_NAMES[this.side === 'left' ? this.textTemplate[0] : this.textTemplate[1]]}`;
		} else {
			this.mathspeakTemplate = ['left ' + BRACKET_NAMES[open] + ',', ', right ' + BRACKET_NAMES[close]];
			this.ariaLabel = BRACKET_NAMES[open] + ' block';
		}
		return super.mathspeak();
	}
}

export class MathFunction extends BracketMixin(MathCommand) {
	contentIndex = 1;

	constructor(ctrlSeq: string) {
		// Change asin into arcsin (and the same for the other "a" trig variants).
		ctrlSeq = ctrlSeq.replace(/\\a(sin|cos|tan|sec|csc|cot)/, '\\arc$1');

		super(ctrlSeq, undefined, [`${ctrlSeq.slice(1)}(`, ')']);

		// If something is typed after the ghost, then solidify the end parenthesis.
		// Also if something is typed before or after the function,
		// then determine if padding is needed before the function name.
		this.siblingCreated = (_opts: Options, dir?: Direction) => {
			if (dir === 'right') this.finalizeTree();
			else this.updateFirst();
		};
		this.siblingDeleted = () => {
			this.updateFirst();
		};

		this.setAriaLabel();
	}

	setAriaLabel() {
		const baseName = this.ctrlSeq.slice(1).replace(/^arc/, '').replace(/h$/, '');
		this.ariaLabel =
			(this.ctrlSeq.endsWith('h') ? 'hyperbolic ' : '') +
			(this.ctrlSeq.startsWith('\\arc') ? 'arc' : '') +
			(
				{
					sin: 'sine',
					cos: 'cosine',
					tan: 'tangent',
					sec: 'secant',
					csc: 'cosecant',
					cot: 'cotangent',
					exp: 'natural exponential',
					ln: 'natural logarithm',
					log: 'logarithm'
				} as Record<string, string>
			)[baseName];
		if (this.ends.right) this.ends.right.ariaLabel = `${this.ariaLabel ?? ''} parameter`;
	}

	// Add or remove padding depending on what is before the function name.
	updateFirst() {
		if (
			this.left &&
			!(this.left instanceof BinaryOperator) &&
			(!(this.left instanceof Variable) || !this.left.isPartOfOperator)
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
			'<span class="mq-function-params mq-bracket-container mq-non-leaf">' +
			`<span class="mq-bracket-l mq-scaled mq-paren" style="width:${SVG_SYMBOLS['('].width}">` +
			SVG_SYMBOLS['('].html +
			'</span>' +
			`<span class="mq-bracket-middle mq-non-leaf" style="margin-left:${
				SVG_SYMBOLS['('].width
			};margin-right:${SVG_SYMBOLS[')'].width}">&1</span>` +
			`<span class="mq-bracket-r mq-scaled mq-paren${
				this.side === 'left' ? ' mq-ghost' : ''
			}" style="width:${SVG_SYMBOLS[')'].width}">` +
			SVG_SYMBOLS[')'].html +
			'</span>' +
			'</span>' +
			'</span>';

		// Only allow supsub's to be inserted into the block before the parentheses.
		// If anything else is typed, move to the content block, so it will be inserted there.
		this.blocks[0].writeHandler = (cursor: Cursor, ch: string) => {
			if (ch === '_' || ch === '^') return false;

			// If at the left end of the supsub block and a character was typed that extends this function name to
			// another one, then extend the function name.
			if (
				!cursor.left &&
				(LatexCmds[`${this.ctrlSeq.slice(1)}${ch}`] as Constructor<TNode> | undefined)?.prototype instanceof
					MathFunction
			) {
				this.ctrlSeq = `${this.ctrlSeq}${ch}`;
				this.setAriaLabel();
				this.elements.children().first.textContent = (this.elements.children().first.textContent ?? '') + ch;
				this.bubble('reflow');
				return true;
			}

			this.enterContentBlock('left', cursor);

			// If a starting parenthesis is typed, don't actually create it.  Just move the cursor to the content
			// block, and let the hardcoded parenthesis appear.  So it appears as if typing the parenthesis does add
			// a parenthesis.
			if (ch === '(') return true;

			return false;
		};

		return super.html();
	}

	enterContentBlock(dir: Direction, cursor: Cursor) {
		if (dir === 'left') cursor.insAtLeftEnd(this.blocks[1]);
		else cursor.insAtRightEnd(this.blocks[1]);
	}

	deleteSide(side: Direction, outward: boolean, cursor: Cursor) {
		if (side === 'left' && !(this.blocks[0].isEmpty() && this.blocks[1].isEmpty())) {
			let brack, supsub;
			if (!this.blocks[1].isEmpty()) {
				cursor.insLeftOf(this);
				brack = new Bracket('left', '(', ')', '(', ')');
				brack.replaces(this.blocks[1].children());
				brack.createLeftOf(cursor);
				// Make the parentheses one sided if this function was.
				if (this.side) {
					brack.delims?.[1].classList.add('mq-ghost');
					brack.side = 'left';
				}
			}

			// If there is a SupSub in the supsub block, then it must be replaced with a new instance.  This is because
			// the original instance has the special MathFunction deleteOutOf handlers.  Those will not work for a usual
			// SupSub.
			if (!this.blocks[0].isEmpty() && this.blocks[0].ends.left instanceof SupSub) {
				cursor.insLeftOf(brack ?? this);
				// A temporary base is created first and then removed later, because if supSubsRequireOperand is true
				// the following causes errors when the contact weld is called later otherwise.
				const tmpBase = new Variable('x');
				tmpBase.createLeftOf(cursor);
				const origSupSub = this.blocks[0].ends.left;
				for (const supOrSub of ['sub', 'sup'] as (keyof Pick<SupSub, 'sub' | 'sup'>)[]) {
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

			cursor.controller.aria.queue(this.ariaLabel ?? this.ctrlSeq.slice(1));
			this.remove();
			if (supsub) cursor.insLeftOf(supsub);
			else if (brack) cursor.insLeftOf(brack);
		} else {
			if (side === 'left') cursor.controller.aria.queue(this);
			else cursor.controller.aria.queue('right parenthesis');
			super.deleteSide(side, outward, cursor);
		}
	}

	finalizeTree() {
		const inserted = this.inserted;
		super.finalizeTree();

		if (!inserted) {
			this.blocks[0].deleteOutOf = (dir: Direction, cursor: Cursor) => {
				// If at the left end of the supsub block and removing the last character of this function name is still
				// a valid function name, then shorten the function name.
				if (
					!cursor.left &&
					(LatexCmds[this.ctrlSeq.slice(1, -1)] as Constructor<TNode> | undefined)?.prototype instanceof
						MathFunction
				) {
					cursor.controller.aria.queue(this.ctrlSeq.slice(-1));
					this.ctrlSeq = this.ctrlSeq.slice(0, -1);
					this.setAriaLabel();
					this.elements.children().first.textContent = this.ctrlSeq.slice(1);
					this.bubble('reflow');
					return;
				}

				if (dir === 'left') this.deleteSide(dir, true, cursor);
				// If deleting right out of the supsub block, move the cursor to the content block.
				else this.enterContentBlock('left', cursor);
			};

			this.blocks[1].deleteOutOf = (dir: Direction, cursor: Cursor) => {
				// If deleting left out of the content block, move the cursor to the supsub block.
				if (dir === 'left') cursor.insAtRightEnd(this.blocks[0]);
				else this.deleteSide(dir, true, cursor);
			};
		}

		if (this.ends.right) this.ends.right.ariaLabel = `${this.ariaLabel ?? ''} parameter`;

		this.updateFirst();
	}

	latex() {
		return `${this.ctrlSeq}${this.blocks[0]?.latex() ?? ''}\\left(${this.blocks[1]?.latex() ?? ''}\\right)`;
	}

	text() {
		return `${this.left instanceof Letter ? ' ' : ''}${this.ctrlSeq.slice(1)}${this.blocks[0]?.text() ?? ''}(${
			this.blocks[1]?.text() ?? ''
		})`;
	}

	mathspeak() {
		return `${
			this.ariaLabel ?? ''
		} ${this.blocks[0].mathspeak()} left parenthesis, ${this.blocks[1].mathspeak()}, right parenthesis`;
	}

	parser() {
		// Create the other end solid.
		delete this.side;

		this.blocks = [new MathBlock(), new MathBlock()];
		for (const block of this.blocks) {
			block.adopt(this, this.ends.right);
		}

		return Parser.optWhitespace
			.then(Parser.regex(/^(?=[_^])/))
			.then(
				latexMathParser.block.map((block: TNode) => {
					block.children().adopt(this.blocks[0], this.blocks[0].ends.right);
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
								.map((blocks: MathBlock[]) => {
									for (const block of blocks) {
										block.children().adopt(this.blocks[1], this.blocks[1].ends.right);
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
										.map((blocks: MathBlock[]) => {
											if (blocks[blocks.length - 1].text() === ')') blocks.splice(-1);
											for (const block of blocks) {
												block.children().adopt(this.blocks[1], this.blocks[1].ends.right);
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
												digit.adopt(this.blocks[1], this.blocks[1].ends.right);
											}
										})
										.or(
											latexMathParser.block.map((block: MathBlock) => {
												block.children().adopt(this.blocks[1], this.blocks[1].ends.right);
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

	const joinBlocks = (blocks: MathBlock[]) => {
		const firstBlock = blocks[0] || new MathBlock();

		for (const block of blocks.slice(1)) {
			block.children().adopt(firstBlock, firstBlock.ends.right);
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
			const cmdKlass = LatexCmds[ctrlSeq] as Constructor<TNode> | undefined;

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
