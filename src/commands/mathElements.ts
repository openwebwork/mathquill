// Abstract classes of math blocks and commands.

import type { Direction } from 'src/constants';
import {
	jQuery, noop, L, R, mqCmdId, pray, mqBlockId, LatexCmds, OPP_BRACKS, BuiltInOpNames, TwoWordOpNames
} from 'src/constants';
import { Parser } from 'services/parser.util';
import { Selection } from 'src/selection';
import { deleteSelectTowardsMixin, DelimsMixin } from 'src/mixins';
import type { Options } from 'src/options';
import type { Cursor } from 'src/cursor';
import { Point } from 'tree/point';
import { Node } from 'tree/node';
import { Fragment } from 'tree/fragment';
import { MathBlock } from 'commands/mathBlock';

// Math tree node base class.
// Some math-tree-specific extensions to Node.
// Both MathBlock's and MathCommand's descend from it.
export class MathElement extends Node {
	finalizeInsert(options: Options, cursor: Cursor) {
		// `cursor` param is only for SupSub::contactWeld,
		// and is deliberately only passed in by writeLatex,
		// see ea7307eb4fac77c149a11ffdf9a831df85247693
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
		const queue: Array<[Node, number]> = [[this, depth]];

		// Do a breadth-first search of this node's descendants
		// down to cutoff, removing anything deeper.
		while (queue.length) {
			const current = queue.shift();
			current?.[0].children()?.each((child: Node) => {
				const i = (child instanceof MathBlock) ? 1 : 0;
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
			replacedFragment.adopt(this.ends[L] as Node);
			replacedFragment.jQ.appendTo(this.ends[L]?.jQ as JQuery<HTMLElement>);
			this.placeCursor(cursor);
			this.prepareInsertionAt(cursor);
		}
		this.finalizeInsert(cursor.options);
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
		//insert the cursor at the right end of the first empty child, searching
		//left-to-right, or if none empty, the right end child
		cursor.insAtRightEnd(
			this.foldChildren(this.ends[L] as Node, (leftward, child) => leftward.isEmpty() ? leftward : child)
		);
	}

	selectChildren(): Selection {
		return new Selection(this, this);
	}

	unselectInto(dir: Direction, cursor: Cursor) {
		cursor.insAtDirEnd(dir === L ? R : L, cursor.anticursor?.ancestors?.[this.id] as Node);
	}

	seek(pageX: number, cursor: Cursor) {
		const getBounds = (node: Node) => {
			const bounds: { [L]: number, [R]: number } = { [L]: 0, [R]: 0 };
			bounds[L] = node.jQ.offset()?.left ?? 0;
			bounds[R] = (bounds[L] ?? 0) + (node.jQ.outerWidth() ?? 0);
			return bounds;
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
		this.eachChild((block: Node) => {
			const blockBounds = getBounds(block);
			if (pageX < blockBounds[L]) {
				// closer to this block's left bound, or the bound left of that?
				if (pageX - leftLeftBound < blockBounds[L] - pageX) {
					if (block[L]) cursor.insAtRightEnd(block[L] as Node);
					else cursor.insLeftOf(this);
				}
				else cursor.insAtLeftEnd(block);
				return false;
			}
			else if (pageX > blockBounds[R]) {
				if (block[R]) leftLeftBound = blockBounds[R]; // continue to next block
				else { // last (rightmost) block
					// closer to this block's right bound, or the this's right bound?
					if (cmdBounds[R] - pageX < pageX - blockBounds[R]) {
						cursor.insRightOf(this);
					}
					else cursor.insAtRightEnd(block);
				}
			}
			else {
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
		// Expects .createBlocks() to have been called already, since it uses the
		// .blocks array of child blocks.
		//
		// See html.test.js for example templates and intended outputs.
		//
		// Given an .htmlTemplate as described above,
		// - insert the mathquill-command-id attribute into all top-level tags,
		//   which will be used to set this.jQ in .jQize().
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
					i += 1, token = tokens[i];
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
		return tokens.join('')
			.replace(/>&(\d+)/g,
				($0, $1: number) => ` ${mqBlockId}=${blocks[$1]?.id ?? ''}>${blocks[$1]?.join('html') ?? ''}`);
	}

	// methods to export a string representation of the math tree
	latex() {
		return this.foldChildren(this.ctrlSeq, (latex, child) => `${latex}{${child.latex() || ' '}}`);
	}

	text() {
		let i = 0;
		return this.foldChildren(this.textTemplate[i], (text, child) => {
			++i;
			const child_text = child.text();
			if (text && this.textTemplate[i] === '('
				&& child_text[0] === '(' && child_text.slice(-1) === ')')
				return text + child_text.slice(1, -1) + this.textTemplate[i];
			return text + child_text + (this.textTemplate[i] || '');
		});
	}
}

// Lightweight command without blocks or children.
export class Symbol extends MathCommand {
	constructor(ctrlSeq?: string, html?: string, text?: string) {
		const textTemplate = text ? text : (ctrlSeq && ctrlSeq.length > 1 ? ctrlSeq.slice(1) : (ctrlSeq ?? ''));
		super(ctrlSeq, html, [ textTemplate ]);

		this.createBlocks = noop;
		this.isSymbol = true;
	}

	parser() { return Parser.succeed(this); }

	numBlocks() { return 0; }

	replaces(replacedFragment?: Fragment) {
		replacedFragment?.remove();
	}

	moveTowards(dir: Direction, cursor: Cursor) {
		cursor.jQ.insDirOf(dir, this.jQ);
		cursor[dir === L ? R : L] = this;
		cursor[dir] = this[dir];
	}

	deleteTowards(dir: Direction, cursor: Cursor) {
		cursor[dir] = this.remove()[dir];
	}

	seek(pageX: number, cursor: Cursor) {
		// insert at whichever side the click was closer to
		if (pageX - (this.jQ.offset()?.left ?? 0) < (this.jQ.outerWidth() ?? 0) / 2)
			cursor.insLeftOf(this);
		else
			cursor.insRightOf(this);
	}

	latex() { return this.ctrlSeq; };

	text() { return this.textTemplate.join(''); };

	placeCursor() { /* do nothing */ };

	isEmpty() { return true; };
}

export class VanillaSymbol extends Symbol {
	constructor(ch: string, html?: string, text?: string) {
		super(ch, `<span>${html || ch}</span>`, text);
	}
}

export class BinaryOperator extends Symbol {
	isUnary = false;

	constructor(ctrlSeq: string, html?: string, text?: string, useRawHtml = false) {
		super(ctrlSeq,
			useRawHtml === true ? html : `<span class="mq-binary-operator">${html ?? ''}</span>`,
			text);
	}
}

export interface InequalityData {
	ctrlSeq: string; html: string; text: string;
	ctrlSeqStrict: string; htmlStrict: string; textStrict: string;
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
		this.jQ.html(this.data[`html${strictness}`]);
		this.textTemplate = [ this.data[`text${strictness}`] ];
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

export class Equality extends BinaryOperator {
	constructor() {
		super('=', '=');
	}

	createLeftOf(cursor: Cursor) {
		if (cursor[L] instanceof Inequality && (cursor[L] as Inequality).strict) {
			(cursor[L] as Inequality).swap(false);
			cursor[L]?.bubble('reflow');
			return;
		}
		super.createLeftOf(cursor);
	};
}

export class Digit extends VanillaSymbol {
	createLeftOf(cursor: Cursor) {
		if (cursor.options.autoSubscriptNumerals
			&& cursor.parent !== cursor.parent?.parent?.sub
			&& ((cursor[L] instanceof Variable && (cursor[L] as Variable).isItalic !== false)
				|| (cursor[L] instanceof SupSub
					&& cursor[L]?.[L] instanceof Variable
					&& (cursor[L]?.[L] as Variable).isItalic !== false))) {
			new LatexCmds._().createLeftOf(cursor);
			super.createLeftOf(cursor);
			cursor.insRightOf(cursor.parent?.parent as Node);
		}
		else super.createLeftOf(cursor);
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
		if (this.isPartOfOperator) {
			if (text[0] == '\\') {
				if (text.startsWith('\\operatorname{'))
					text = text.slice(14, text.length);
				else
					text = text.slice(1, text.length);
			} else if (text[text.length - 1] == ' ' || text[text.length - 1] == '}') {
				text = text.slice (0, -1);
				if (!(this[R] instanceof Bracket || this[R] instanceof Fraction)) text += ' ';
			}
		}
		return text;
	};
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
		const autoCmds = cursor.options.autoCommands, maxLength = autoCmds._maxLength;
		if (maxLength > 0) {
			// want longest possible autocommand, so join together longest
			// sequence of letters
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			let str = '', l: Node | undefined = this, i = 0;
			// FIXME: l.ctrlSeq === l.letter checks if first or last in an operator name
			while (l instanceof Letter && l?.ctrlSeq === l?.letter && i < maxLength) {
				str = l.letter + str, l = l[L], ++i;
			}
			// check for an autocommand, going thru substrings longest to shortest
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
		this.jQ.toggleClass('mq-operator-name', !bool);
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
		let str = this.letter, l = this[L], r = this[R];
		for (; l instanceof Letter; l = l[L]) str = l.letter + str;
		for (; r instanceof Letter; r = r[R]) str += r.letter;

		// removeClass and delete flags from all letters before figuring out
		// which, if any, are part of an operator name
		new Fragment(l?.[R] || this.parent?.ends[L], r?.[L] || this.parent?.ends[R]).each((el: Node) => {
			(el as Letter).italicize(true).jQ.removeClass('mq-first mq-last mq-followed-by-supsub');
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
					if (word in TwoWordOpNames) last?.[L]?.[L]?.[L]?.jQ.addClass('mq-last');
					if (!this.shouldOmitPadding(first?.[L])) first?.jQ.addClass('mq-first');
					if (!this.shouldOmitPadding(last?.[R])) {
						if (last?.[R] instanceof SupSub) {
							// XXX monkey-patching, but what's the right thing here?
							const supsub = last[R] as SupSub;
							// Have operatorname-specific code in SupSub? A CSS-like language to style the
							// math tree, but which ignores cursor and selection (which CSS can't)?
							supsub.siblingCreated = supsub.siblingDeleted = () => {
								supsub.jQ.toggleClass('mq-after-operator-name', !(supsub[R] instanceof Bracket));
							};
							supsub.siblingCreated(opts);
						}
						else {
							last?.jQ.toggleClass('mq-last', !(last?.[R] instanceof Bracket));
						}
					}

					i += len - 1;
					first = last;
					break;
				}
			}
		}
	}

	shouldOmitPadding(node?: Node) {
		// omit padding if no node, or if node already has padding (to avoid double-padding)
		return !node || (node instanceof BinaryOperator) || (node instanceof UpperLowerLimitCommand);
	}
}

export function insLeftOfMeUnlessAtEnd(this: SupSub, cursor: Cursor) {
	// cursor.insLeftOf(cmd), unless cursor at the end of block, and every
	// ancestor cmd is at the end of every ancestor block
	const cmd = this.parent as Node;
	let ancestorCmd: Node | Point | undefined = cursor;
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
			'<span class="mq-fraction mq-non-leaf">'
			+   '<span class="mq-numerator">&0</span>'
			+   '<span class="mq-denominator">&1</span>'
			+   '<span style="display:inline-block;width:0">&#8203;</span>'
			+ '</span>';
		this.textTemplate = ['((', ')/(', '))'];
	}

	text() {
		let leftward = this[L];
		for (; leftward && leftward.ctrlSeq === '\\ '; leftward = leftward[L]);

		const text = (dir: Direction) => {
			let needParens = false;
			this.ends[dir]?.eachChild((child: Node) => {
				if ((child instanceof BinaryOperator && !child.isUnary) ||
					('text' in LatexCmds && child instanceof LatexCmds.text) ||
					child instanceof UpperLowerLimitCommand ||
					child instanceof Fraction ||
					child.ctrlSeq === '\\ ' ||
					/^[,;:]$/.test(child.ctrlSeq)) {
					needParens = true;
				}
				return !needParens;
			});

			const blankDefault = dir === L ? 0 : 1;
			const l = this.ends[dir]?.text() !== ' ' && this.ends[dir]?.text();
			return l ? (needParens ? `(${l})` : l) : blankDefault;
		};
		return (leftward instanceof BinaryOperator && leftward.isUnary) || leftward?.jQ.hasClass('mq-operator-name') ||
			(leftward instanceof SupSub && leftward[L]?.jQ.hasClass('mq-operator-name'))
			? `(${text(L)}/${text(R)})` : ` ${text(L)}/${text(R)} `;
	}

	finalizeTree() {
		this.upInto = (this.ends[R] as Node).upOutOf = this.ends[L];
		this.downInto = (this.ends[L] as Node).downOutOf = this.ends[R];
	}
};

export class SupSub extends MathCommand {
	sup?: Node;
	sub?: Node;
	supsub = 'sup';

	constructor(ctrlSeq?: string, htmlTemplate?: string, textTemplate?: Array<string>) {
		super('_{...}^{...}', htmlTemplate, textTemplate);

		this.reflow = () => {
			const $block = this.jQ ;//mq-supsub
			const $prev = $block.prev() ;

			if (!$prev.length) {
				//we cant normalize it without having prev. element (which is base)
				return ;
			}

			const $sup = $block.children('.mq-sup');//mq-supsub -> mq-sup
			if ($sup.length) {
				const sup_fontsize = parseInt($sup.css('font-size')) ;
				const sup_bottom = ($sup?.offset()?.top ?? 0) + ($sup?.height() ?? 0);
				//we want that superscript overlaps top of base on 0.7 of its font-size
				//this way small superscripts like x^2 look ok, but big ones like x^(1/2/3) too
				const needed = sup_bottom - ($prev.offset()?.top ?? 0)  - 0.7 * sup_fontsize ;
				const cur_margin = parseInt($sup.css('margin-bottom')) ;
				//we lift it up with margin-bottom
				$sup.css('margin-bottom', cur_margin + needed) ;
			}
		};
	}

	createLeftOf(cursor: Cursor) {
		if (cursor.options.supSubsRequireOperand && (
			!cursor[L] ||
			cursor[L]?.ctrlSeq === '\\ ' ||
			cursor[L] instanceof BinaryOperator ||
			/^[,;:]$/.test(cursor[L]?.ctrlSeq ?? '')
		)) {
			if (this.replacedFragment) {
				this.replacedFragment.adopt(cursor.parent as Node, cursor[L], cursor[R]);
				cursor[L] = this.replacedFragment.ends[R];
			}
			return;
		}

		// If this SupSub is being placed on a fraction, then add parentheses around the fraction.
		if (cursor[L] instanceof Fraction) {
			const brack = new Bracket(R, '(', ')', '(', ')');
			cursor.selection = (cursor[L] as Node).selectChildren();
			brack.replaces(cursor.replaceSelection());
			brack.createLeftOf(cursor);
		}

		return super.createLeftOf(cursor);
	}

	contactWeld(cursor: Cursor) {
		// Look on either side for a SupSub, if one is found compare my
		// .sub, .sup with its .sub, .sup. If I have one that it doesn't,
		// then call .addBlock() on it with my block; if I have one that
		// it also has, then insert my block's children into its block,
		// unless my block has none, in which case insert the cursor into
		// its block (and not mine, I'm about to remove myself) in the case
		// I was just typed.
		// TODO: simplify

		for (const dir of [L, R]) {
			if (this[dir] instanceof SupSub) {
				let pt;
				for (const supsub of ['sub', 'sup'] as Array<keyof Pick<SupSub, 'sub' | 'sup'>>) {
					const src = this[supsub], dest = (this[dir] as SupSub)[supsub];
					if (!src) continue;
					if (!dest) (this[dir] as SupSub).addBlock(src.disown());
					else if (!src.isEmpty()) { // ins src children at -dir end of dest
						src?.jQ.children().insAtDirEnd(dir === L ? R : L, dest.jQ);
						const children = src.children().disown();
						pt = new Point(dest, children.ends[R], dest.ends[L]);
						if (dir === L) children.adopt(dest, dest.ends[R]);
						else children.adopt(dest, undefined, dest.ends[L]);
					} else pt = new Point(dest, undefined, dest.ends[L]);
					this.placeCursor = (cursor) => cursor.insAtDirEnd(dir === L ? R : L, dest || src);
				}
				this.remove();
				if (cursor && cursor[L] === this) {
					if (dir === R && pt) {
						pt[L] ? cursor.insRightOf(pt[L] as Node) : cursor.insAtLeftEnd(pt.parent as Node);
					}
					else cursor.insRightOf(this[dir] as Node);
				}
				break;
			}
		}
	}

	finalizeTree() {
		(this.ends[L] as Node).isSupSubLeft = true;
	}

	moveTowards(dir: Direction, cursor: Cursor, updown?: 'up' | 'down') {
		if (cursor.options.autoSubscriptNumerals && !this.sup) {
			cursor.insDirOf(dir, this);
		}
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
		}
		else super.deleteTowards(dir, cursor);
	}

	latex() {
		const latex = (prefix: string, block?: Node) => {
			const l = block && block.latex();
			return block ? prefix + (l?.length === 1 ? l : `{${l || ' '}}`) : '';
		};
		return latex('_', this.sub) + latex('^', this.sup);
	}

	text() {
		const text = (prefix: string, block?: Node) => {
			let needParens = false;
			let numBlocks = 0;
			let haveDigits = false;
			block?.eachChild((child: Node) => {
				if (child instanceof Digit) haveDigits = true;
				if (!(child instanceof Digit || (child instanceof BinaryOperator && child.isUnary))) ++numBlocks;
				if ((haveDigits && numBlocks) || numBlocks > 1 ||
					(child instanceof BinaryOperator && !child.isUnary) ||
					('text' in LatexCmds && child instanceof LatexCmds.text) ||
					child instanceof Fraction ||
					child instanceof UpperLowerLimitCommand ||
					child.ctrlSeq === '\\ ' ||
					/^[,;:]$/.test(child.ctrlSeq)) {
					needParens = true;
				}
				return !needParens;
			});

			const l = block?.text() !== ' ' && block?.text();
			return l ? prefix + (needParens ? `(${l})` : l) : '';
		};
		const mainText = text('_', this.sub) + text('^', this.sup);
		return mainText + (mainText && this[R] instanceof Digit ? ' ' : '');
	}

	addBlock(block: Node) {
		if (this.supsub === 'sub') {
			this.sup = this.upInto = (this.sub as Node).upOutOf = block;
			block.adopt(this, this.sub).downOutOf = this.sub;
			block.jQ = jQuery('<span class="mq-sup"/>').append(block.jQ.children())
				.attr(mqBlockId, block.id).prependTo(this.jQ);
		}
		else {
			this.sub = this.downInto = (this.sup as Node).downOutOf = block;
			block.adopt(this, undefined, this.sup).upOutOf = this.sup;
			block.jQ = jQuery('<span class="mq-sub"></span>').append(block.jQ.children())
				.attr(mqBlockId, block.id).appendTo(this.jQ.removeClass('mq-sup-only'));
			this.jQ.append('<span style="display:inline-block;width:0">&#8203;</span>');
		}
		// like 'sub sup'.split(' ').forEach((supsub) => { ... });
		for (const supsub of ['sub', 'sup'] as Array<keyof Pick<SupSub, 'sub' | 'sup'>>) {
			const oppositeSupsub = supsub === 'sub' ? 'sup' : 'sub';
			const updown = supsub === 'sub' ? 'down' : 'up';
			const thisSupsub = this[supsub] as MathElement;
			thisSupsub.deleteOutOf = (dir: Direction, cursor: Cursor) => {
				cursor.insDirOf((thisSupsub[dir] ? (dir === L ? R : L) : dir), thisSupsub.parent as Node);
				if (!thisSupsub.isEmpty()) {
					const end = thisSupsub.ends[dir];
					thisSupsub.children().disown()
						.withDirAdopt(dir, cursor.parent as Node, cursor[dir], cursor[dir === L ? R : L])
						.jQ.insDirOf(dir === L ? R : L, cursor.jQ);
					cursor[dir === L ? R : L] = end;
				}
				this.supsub = oppositeSupsub;
				delete this[supsub];
				delete this[`${updown}Into`];
				(this[oppositeSupsub] as Node)[`${updown}OutOf`] = insLeftOfMeUnlessAtEnd;
				delete (this[oppositeSupsub] as Partial<MathElement>).deleteOutOf;
				if (supsub === 'sub') jQuery(this.jQ.addClass('mq-sup-only')[0].lastChild as ChildNode).remove();
				thisSupsub.remove();
			};
		}
	}
}

export class UpperLowerLimitCommand extends MathCommand {
	latex() {
		const simplify = (latex: string) => latex.length === 1 ? latex : `{${latex || ' '}}`;
		return `${this.ctrlSeq}_${simplify(this.ends[L]?.latex() ?? '')}^${
			simplify(this.ends[R]?.latex() ?? '')}`;
	}

	text() {
		const operand = this.ctrlSeq.slice(1, this.ctrlSeq.length - 1);
		return `${operand}(${this.ends[L]?.text() ?? ''},${this.ends[R]?.text() ?? ''})`;
	}

	parser() {
		const blocks = this.blocks = [ new MathBlock(), new MathBlock() ];
		for (const block of blocks) {
			block.adopt(this, this.ends[R]);
		}

		return Parser.optWhitespace.then(Parser.string('_').or(Parser.string('^'))).then((supOrSub) => {
			const child = blocks[supOrSub === '_' ? 0 : 1];
			return latexMathParser.block.then((block: Node) => {
				block.children().adopt(child, child.ends[R]);
				return Parser.succeed(this);
			});
		}).many().result(this);
	}

	finalizeTree() {
		this.downInto = this.ends[L];
		this.upInto = this.ends[R];
		(this.ends[L] as Node).upOutOf = this.ends[R];
		(this.ends[R] as Node).downOutOf = this.ends[L];
	}
};

// Round/Square/Curly/Angle Brackets (aka Parens/Brackets/Braces)
//   first typed as one-sided bracket with matching "ghost" bracket at
//   far end of current block, until you type an opposing one
export class Bracket extends DelimsMixin(MathCommand) {
	side: Direction;
	sides: {
		[L]: { ch: string, ctrlSeq: string },
		[R]: { ch: string, ctrlSeq: string }
	};

	constructor(side: Direction, open: string, close: string, ctrlSeq: string, end: string) {
		super(`\\left${ctrlSeq}`, undefined, [open, close]);
		this.side = side;
		this.sides = {
			[L]: { ch: open, ctrlSeq: ctrlSeq },
			[R]: { ch: close, ctrlSeq: end }
		};
		this.placeCursor = noop;

		this.siblingCreated = (opts: Options, dir?: Direction) => { // if something typed between ghost and far
			if (dir === (this.side === L ? R : L)) this.finalizeTree(); // end of its block, solidify
		};
	}

	numBlocks() { return 1; }

	html() {
		// wait until now so that .side may be set by createLeftOf or parser
		this.htmlTemplate =
			'<span class="mq-non-leaf">'
			+   `<span class="mq-scaled mq-paren${this.side === R ? ' mq-ghost' : ''}">`
			+     this.sides[L].ch
			+   '</span>'
			+   '<span class="mq-non-leaf">&0</span>'
			+   `<span class="mq-scaled mq-paren${this.side === L ? ' mq-ghost' : ''}">`
			+     this.sides[R].ch
			+   '</span>'
			+ '</span>';
		return super.html();
	}

	latex() {
		return `\\left${this.sides[L]?.ctrlSeq ?? ''}${
			this.ends[L]?.latex() ?? ''}\\right${this.sides[R]?.ctrlSeq ?? ''}`;
	}

	text() {
		return `${this.sides[L]?.ch ?? ''}${this.ends[L]?.text() ?? ''}${this.sides[R]?.ch ?? ''}`;
	}

	matchBrack(opts: Options, expectedSide?: Direction, node?: Node) {
		// return node iff it's a matching 1-sided bracket of expected side (if any)
		return node instanceof Bracket && node.side &&
			node.side !== (expectedSide === L ? R : expectedSide === R ? L : undefined)
			&& (!opts.restrictMismatchedBrackets
				|| OPP_BRACKS[this.sides[this.side].ch] === node.sides[node.side].ch
				|| { '(': ']', '[': ')' }[this.sides[L].ch] === node.sides[R].ch) && node;
	}

	closeOpposing(brack: Bracket) {
		brack.side = 0;
		brack.sides[this.side] = this.sides[this.side]; // copy over my info (may be
		brack.delimjQs?.eq(this.side === L ? 0 : 1) // mismatched, like [a, b))
			.removeClass('mq-ghost').html(this.sides[this.side].ch);
	}

	createLeftOf(cursor: Cursor) {
		let brack, side;
		if (!this.replacedFragment) { // unless wrapping seln in brackets,
			// check if next to or inside an opposing one-sided bracket
			const opts = cursor.options;
			if (this.sides[L].ch === '|') { // check both sides if I'm a pipe
				brack = this.matchBrack(opts, R, cursor[R])
					|| this.matchBrack(opts, L, cursor[L])
					|| this.matchBrack(opts, undefined, cursor.parent?.parent);
			}
			else {
				const otherSide = this.side === L ? R : L;
				brack = this.matchBrack(opts, otherSide, cursor[otherSide])
					|| this.matchBrack(opts, otherSide, cursor.parent?.parent);
			}
		}
		if (brack) {
			side = this.side = brack.side === L ? R : L; // may be pipe with .side not yet set
			this.closeOpposing(brack);
			if (brack === cursor.parent?.parent && cursor[side]) { // move the stuff between
				new Fragment(cursor[side], cursor.parent?.ends[side], side === L ? R : L) // me and ghost outside
					.disown().withDirAdopt(side === L ? R : L, brack.parent as Node, brack, brack[side])
					.jQ.insDirOf(side, brack.jQ);
			}
			brack.bubble('reflow');
		} else {
			brack = this, side = brack.side;
			if (brack.replacedFragment) brack.side = 0; // wrapping seln, don't be one-sided
			else if (cursor[side === L ? R : L]) { // elsewise, auto-expand so ghost is at far end
				brack.replaces(new Fragment(cursor[side === L ? R : L], cursor.parent?.ends[side === L ? R : L], side));
				delete cursor[side === L ? R : L];
			}
			super.createLeftOf(cursor);
		}
		if (side === L) cursor.insAtLeftEnd(brack.ends[L] as Node);
		else cursor.insRightOf(brack);
	}

	unwrap() {
		this.ends[L]?.children().disown().adopt(this.parent as Node, this, this[R])
			.jQ.insertAfter(this.jQ);
		this.remove();
	}

	deleteSide(side: Direction, outward: boolean, cursor: Cursor) {
		const parent = this.parent as Node, sib = this[side], farEnd = parent.ends[side];

		if (side === this.side) { // deleting non-ghost of one-sided bracket, unwrap
			this.unwrap();
			sib ? cursor.insDirOf(side === L ? R : L, sib) : cursor.insAtDirEnd(side, parent);
			return;
		}

		const wasSolid = !this.side;
		this.side = side === L ? R : L;
		// if deleting like, outer close-brace of [(1+2)+3} where inner open-paren
		if (this.matchBrack(cursor.options, side, this.ends[L]?.ends[this.side])) { // is ghost,
			this.closeOpposing(this.ends[L]?.ends[this.side] as Bracket); // then become [1+2)+3
			const origEnd = this.ends[L]?.ends[side];
			this.unwrap();
			origEnd?.siblingCreated?.(cursor.options, side);
			sib ? cursor.insDirOf(side === L ? R : L, sib) : cursor.insAtDirEnd(side, parent);
		}
		else { // if deleting like, inner close-brace of ([1+2}+3) where outer
			if (this.matchBrack(cursor.options, side, this.parent?.parent)) { // open-paren is
				(this.parent?.parent as Bracket).closeOpposing(this); // ghost, then become [1+2+3)
				(this.parent?.parent as Bracket).unwrap();
			} // else if deleting outward from a solid pair, unwrap
			else if (outward && wasSolid) {
				this.unwrap();
				sib ? cursor.insDirOf(side === L ? R : L, sib) : cursor.insAtDirEnd(side, parent);
				return;
			}
			else { // else deleting just one of a pair of brackets, become one-sided
				this.sides[side] = { ch: OPP_BRACKS[this.sides[this.side].ch],
					ctrlSeq: OPP_BRACKS[this.sides[this.side].ctrlSeq] };
				this.delimjQs?.removeClass('mq-ghost')
					.eq(side === L ? 0 : 1).addClass('mq-ghost').html(this.sides[side].ch);
			}
			if (sib) { // auto-expand so ghost is at far end
				const origEnd = this.ends[L]?.ends[side];
				new Fragment(sib, farEnd, side === L ? R : L).disown()
					.withDirAdopt(side === L ? R : L, this.ends[L] as Node, origEnd)
					.jQ.insAtDirEnd(side, this.ends[L]?.jQ.removeClass('mq-empty') as JQuery<HTMLElement>);
				origEnd?.siblingCreated?.(cursor.options, side);
				cursor.insDirOf(side === L ? R : L, sib);
			} // didn't auto-expand, cursor goes just outside or just inside parens
			else (outward ? cursor.insDirOf(side, this)
				: cursor.insAtDirEnd(side, this.ends[L] as Node));
		}
	}

	deleteTowards(dir: Direction, cursor: Cursor) {
		this.deleteSide(dir === L ? R : L, false, cursor);
	}

	finalizeTree() {
		(this.ends[L] as MathElement).deleteOutOf =
			(dir: Direction, cursor: Cursor) => (this.ends[L]?.parent as Bracket).deleteSide(dir, true, cursor);
		// FIXME HACK: after initial creation/insertion, finalizeTree would only be
		// called if the paren is selected and replaced, e.g. by LiveFraction
		this.finalizeTree = () => {
			this.delimjQs?.eq(this.side === L ? 1 : 0).removeClass('mq-ghost');
			this.side = 0;
		};
	}
}

interface LatexMathParser extends Parser {
	block: Parser;
	optBlock: Parser;
}

export const latexMathParser = (() => {
	const commandToBlock = (cmd: Node | Fragment) => { // can also take in a Fragment
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

	const controlSequence =
		Parser.regex(/^[^\\a-eg-zA-Z]/) // hotfix #164; match MathBlock::write
			.or(Parser.string('\\').then(
				Parser.regex(/^[a-z]+/i)
					.or(Parser.regex(/^\s+/).result(' '))
					.or(Parser.any)
			)).then((ctrlSeq: string) => {
				const cmdKlass = LatexCmds[ctrlSeq];

				if (cmdKlass) {
					return (new cmdKlass(ctrlSeq) as MathCommand).parser();
				} else {
					return Parser.fail(`unknown command: \\${ctrlSeq}`);
				}
			});

	const command = controlSequence.or(variable).or(digit).or(symbol);

	// Parsers yielding MathBlocks
	const mathGroup: Parser = Parser.string('{').then(() => mathSequence).skip(Parser.string('}'));
	const mathBlock: Parser = Parser.optWhitespace.then(mathGroup.or(command.map(commandToBlock)));
	const mathSequence: Parser = mathBlock.many().map(joinBlocks).skip(Parser.optWhitespace);

	const optMathBlock =
		Parser.string('[').then(
			mathBlock.then((block: MathBlock) => {
				return block.join('latex') !== ']' ? Parser.succeed(block) : Parser.fail();
			}).many().map(joinBlocks).skip(Parser.optWhitespace)
		).skip(Parser.string(']'));

	const latexMath = mathSequence;

	(latexMath as LatexMathParser).block = mathBlock;
	(latexMath as LatexMathParser).optBlock = optMathBlock;
	return latexMath as LatexMathParser;
})();
