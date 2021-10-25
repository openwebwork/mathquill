// Abstract classes of math blocks and commands.

import {
	jQuery, noop, L, R, pray, mqBlockId, LatexCmds, OPP_BRACKS, BuiltInOpNames, TwoWordOpNames
} from 'src/constants';
import { Parser } from 'services/parser.util';
import { Point } from 'tree/point';
import { Node } from 'tree/node';
import { Fragment } from 'tree/fragment';
import { Selection } from 'src/selection';
import { deleteSelectTowardsMixin, DelimsMixin } from 'src/mixins';
import { MathBlock } from 'commands/mathBlock';

// Math tree node base class.
// Some math-tree-specific extensions to Node.
// Both MathBlock's and MathCommand's descend from it.
export class MathElement extends Node {
	finalizeInsert(options, cursor) {
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
		if (this[R]?.siblingCreated) this[R].siblingCreated(options, L);
		if (this[L]?.siblingCreated) this[L].siblingCreated(options, R);
		this.bubble('reflow');
	}

	// If the maxDepth option is set, make sure
	// deeply nested content is truncated. Just return
	// false if the cursor is already too deep.
	prepareInsertionAt(cursor) {
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
	removeNodesDeeperThan(cutoff) {
		let depth = 0;
		const queue = [[this, depth]];

		// Do a breadth-first search of this node's descendants
		// down to cutoff, removing anything deeper.
		while (queue.length) {
			const current = queue.shift();
			current[0].children().each((child) => {
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
	constructor(ctrlSeq, htmlTemplate, textTemplate) {
		super();

		this.blocks = [];
		this.ctrlSeq = ctrlSeq ?? '';
		this.htmlTemplate = htmlTemplate ?? '';
		this.textTemplate = textTemplate ?? [''];
	}

	// obvious methods
	replaces(replacedFragment) {
		replacedFragment.disown();
		this.replacedFragment = replacedFragment;
	}

	isEmpty() {
		return this.foldChildren(true, (isEmpty, child) => isEmpty && child.isEmpty());
	}

	parser() {
		const block = latexMathParser.block;

		return block.times(this.numBlocks()).map((blocks) => {
			this.blocks = blocks;

			for (const block of blocks) {
				block.adopt(this, this.ends[R]);
			}

			return this;
		});
	}

	// createLeftOf(cursor) and the methods it calls
	createLeftOf(cursor) {
		const replacedFragment = this.replacedFragment;

		this.createBlocks();
		super.createLeftOf(cursor);
		if (replacedFragment) {
			replacedFragment.adopt(this.ends[L]);
			replacedFragment.jQ.appendTo(this.ends[L].jQ);
			this.placeCursor(cursor);
			this.prepareInsertionAt(cursor);
		}
		this.finalizeInsert(cursor.options);
		this.placeCursor(cursor);
	}

	createBlocks() {
		const numBlocks = this.numBlocks();
		this.blocks = Array(numBlocks);

		for (let i = 0; i < numBlocks; ++i) {
			this.blocks[i] = new MathBlock();
			this.blocks[i].adopt(this, this.ends[R]);
		}
	}

	placeCursor(cursor) {
		//insert the cursor at the right end of the first empty child, searching
		//left-to-right, or if none empty, the right end child
		cursor.insAtRightEnd(
			this.foldChildren(this.ends[L], (leftward, child) => leftward.isEmpty() ? leftward : child)
		);
	}

	selectChildren() {
		return new Selection(this, this);
	}

	unselectInto(dir, cursor) {
		cursor.insAtDirEnd(-dir, cursor.anticursor.ancestors[this.id]);
	}

	seek(pageX, cursor) {
		const getBounds = (node) => {
			const bounds = {};
			bounds[L] = node.jQ.offset().left;
			bounds[R] = bounds[L] + node.jQ.outerWidth();
			return bounds;
		};

		const cmdBounds = getBounds(this);

		if (pageX < cmdBounds[L]) return cursor.insLeftOf(this);
		if (pageX > cmdBounds[R]) return cursor.insRightOf(this);

		let leftLeftBound = cmdBounds[L];
		this.eachChild((block) => {
			const blockBounds = getBounds(block);
			if (pageX < blockBounds[L]) {
				// closer to this block's left bound, or the bound left of that?
				if (pageX - leftLeftBound < blockBounds[L] - pageX) {
					if (block[L]) cursor.insAtRightEnd(block[L]);
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
		const cmdId = ' mathquill-command-id=' + this.id;
		const tokens = this.htmlTemplate.match(/<[^<>]+>|[^<>]+/g);

		pray('no unmatched angle brackets', tokens.join('') === this.htmlTemplate);

		// add cmdId to all top-level tags
		for (let i = 0, token = tokens[0]; token; ++i, token = tokens[i]) {
			// top-level self-closing tags
			if (token.slice(-2) === '/>') {
				tokens[i] = token.slice(0, -2) + cmdId + '/>';
			}
			// top-level open tags
			else if (token.charAt(0) === '<') {
				pray('not an unmatched top-level close tag', token.charAt(1) !== '/');

				tokens[i] = token.slice(0, -1) + cmdId + '>';

				// skip matching top-level close tag and all tag pairs in between
				let nesting = 1;
				do {
					i += 1, token = tokens[i];
					pray('no missing close tags', token);
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
			.replace(/>&(\d+)/g, ($0, $1) => ` mathquill-block-id=${blocks[$1].id}>${blocks[$1].join('html')}`);
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
	constructor(ctrlSeq, html, text) {
		if (!text) text = ctrlSeq && ctrlSeq.length > 1 ? ctrlSeq.slice(1) : ctrlSeq;

		super(ctrlSeq, html, [ text ]);

		this.createBlocks = noop;
		this.isSymbol = true;
	}

	parser() { return Parser.succeed(this); }

	numBlocks() { return 0; }

	replaces(replacedFragment) {
		replacedFragment.remove();
	}

	moveTowards(dir, cursor) {
		cursor.jQ.insDirOf(dir, this.jQ);
		cursor[-dir] = this;
		cursor[dir] = this[dir];
	}

	deleteTowards(dir, cursor) {
		cursor[dir] = this.remove()[dir];
	}

	seek(pageX, cursor) {
		// insert at whichever side the click was closer to
		if (pageX - this.jQ.offset().left < this.jQ.outerWidth() / 2)
			cursor.insLeftOf(this);
		else
			cursor.insRightOf(this);
	}

	latex() { return this.ctrlSeq; };

	text() { return this.textTemplate; };

	placeCursor() {};

	isEmpty() { return true; };
}

export class VanillaSymbol extends Symbol {
	constructor(ch, html, text) {
		super(ch, `<span>${html || ch}</span>`, text);
	}
}

export class BinaryOperator extends Symbol {
	constructor(ctrlSeq, html, text, useRawHtml = false) {
		super(ctrlSeq, useRawHtml === true ? html : `<span class="mq-binary-operator">${html}</span>`, text);
	}
}

export class Inequality extends BinaryOperator {
	constructor(data, strict) {
		const strictness = strict ? 'Strict' : '';
		super(data[`ctrlSeq${strictness}`], data[`html${strictness}`], data[`text${strictness}`]);
		this.data = data;
		this.strict = strict;
	}

	swap(strict) {
		this.strict = strict;
		const strictness = strict ? 'Strict' : '';
		this.ctrlSeq = this.data[`ctrlSeq${strictness}`];
		this.jQ.html(this.data[`html${strictness}`]);
		this.textTemplate = [ this.data[`text${strictness}`] ];
	}

	deleteTowards(dir, cursor, ...args) {
		if (dir === L && !this.strict) {
			this.swap(true);
			this.bubble('reflow');
			return;
		}
		super.deleteTowards(dir, cursor, ...args);
	}
}

export class Equality extends BinaryOperator {
	constructor() {
		super('=', '=');
	}

	createLeftOf(cursor, ...args) {
		if (cursor[L] instanceof Inequality && cursor[L].strict) {
			cursor[L].swap(false);
			cursor[L].bubble('reflow');
			return;
		}
		super.createLeftOf(cursor, ...args);
	};
}

export class Digit extends VanillaSymbol {
	createLeftOf(cursor) {
		if (cursor.options.autoSubscriptNumerals
			&& cursor.parent !== cursor.parent?.parent?.sub
			&& ((cursor[L] instanceof Variable && cursor[L].isItalic !== false)
				|| (cursor[L] instanceof SupSub
					&& cursor[L][L] instanceof Variable
					&& cursor[L][L].isItalic !== false))) {
			new LatexCmds._().createLeftOf(cursor);
			super.createLeftOf(cursor);
			cursor.insRightOf(cursor.parent?.parent);
		}
		else super.createLeftOf(cursor);
	}
}

export class Variable extends Symbol {
	constructor(ch, html) {
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
			}
			else if (text[text.length - 1] == ' ' || text[text.length - 1] == '}') {
				text = text.slice (0, -1);
			}
		}
		return text;
	};
}

export class Letter extends Variable {
	constructor(ch) {
		super(ch);
		this.letter = ch;
		this.siblingDeleted = this.siblingCreated = this.finalizeTree;
	}

	createLeftOf(cursor) {
		super.createLeftOf(cursor);
		const autoCmds = cursor.options.autoCommands, maxLength = autoCmds._maxLength;
		if (maxLength > 0) {
			// want longest possible autocommand, so join together longest
			// sequence of letters
			let str = '', l = this, i = 0;
			// FIXME: l.ctrlSeq === l.letter checks if first or last in an operator name
			while (l instanceof Letter && l.ctrlSeq === l.letter && i < maxLength) {
				str = l.letter + str, l = l[L], ++i;
			}
			// check for an autocommand, going thru substrings longest to shortest
			while (str.length) {
				if (autoCmds[str]) {
					for (i = 1, l = this; i < str.length; ++i, l = l[L]);
					new Fragment(l, this).remove();
					cursor[L] = l[L];
					return new LatexCmds[str](str).createLeftOf(cursor);
				}
				str = str.slice(1);
			}
		}
	}

	italicize(bool) {
		this.isItalic = bool;
		this.isPartOfOperator = !bool;
		this.jQ.toggleClass('mq-operator-name', !bool);
		return this;
	}

	finalizeTree(opts, dir) {
		// don't auto-un-italicize if the sibling to my right changed (dir === R or
		// undefined) and it's now a Letter, it will un-italicize everyone
		if (dir !== L && this[R] instanceof Letter) return;
		this.autoUnItalicize(opts);
	}

	autoUnItalicize(opts) {
		const autoOps = opts.autoOperatorNames;
		if (autoOps._maxLength === 0) return;
		// want longest possible operator names, so join together entire contiguous
		// sequence of letters
		let str = this.letter, l = this[L], r = this[R];
		for (; l instanceof Letter; l = l[L]) str = l.letter + str;
		for (; r instanceof Letter; r = r[R]) str += r.letter;

		// removeClass and delete flags from all letters before figuring out
		// which, if any, are part of an operator name
		new Fragment(l?.[R] || this.parent.ends[L], r?.[L] || this.parent.ends[R]).each((el) => {
			el.italicize(true).jQ.removeClass('mq-first mq-last mq-followed-by-supsub');
			el.ctrlSeq = el.letter;
		});

		// check for operator names: at each position from left to right, check
		// substrings from longest to shortest
		outer: for (let i = 0, first = l?.[R] || this.parent.ends[L]; i < str.length; ++i, first = first[R]) {
			for (let len = Math.min(autoOps._maxLength, str.length - i); len > 0; --len) {
				const word = str.slice(i, i + len);
				if (autoOps[word]) {
					let last;
					for (let j = 0, letter = first; j < len; j += 1, letter = letter[R]) {
						letter.italicize(false);
						last = letter;
					}

					const isBuiltIn = BuiltInOpNames[word];
					first.ctrlSeq = (isBuiltIn ? '\\' : '\\operatorname{') + first.ctrlSeq;
					last.ctrlSeq += (isBuiltIn ? ' ' : '}');
					if (TwoWordOpNames[word]) last[L][L][L].jQ.addClass('mq-last');
					if (!this.shouldOmitPadding(first[L])) first.jQ.addClass('mq-first');
					if (!this.shouldOmitPadding(last[R])) {
						if (last[R] instanceof SupSub) {
							const supsub = last[R]; // XXX monkey-patching, but what's the right thing here?
							// Have operatorname-specific code in SupSub? A CSS-like language to style the
							// math tree, but which ignores cursor and selection (which CSS can't)?
							supsub.siblingCreated = supsub.siblingDeleted = () => {
								supsub.jQ.toggleClass('mq-after-operator-name', !(supsub[R] instanceof Bracket));
							};
							supsub.siblingCreated();
						}
						else {
							last.jQ.toggleClass('mq-last', !(last[R] instanceof Bracket));
						}
					}

					i += len - 1;
					first = last;
					continue outer;
				}
			}
		}
	}

	shouldOmitPadding(node) {
		// omit padding if no node, or if node already has padding (to avoid double-padding)
		return !node || (node instanceof BinaryOperator) || (node instanceof UpperLowerLimitCommand);
	}
}

export function insLeftOfMeUnlessAtEnd(cursor) {
	// cursor.insLeftOf(cmd), unless cursor at the end of block, and every
	// ancestor cmd is at the end of every ancestor block
	const cmd = this.parent;
	let ancestorCmd = cursor;
	do {
		if (ancestorCmd[R]) return cursor.insLeftOf(cmd);
		ancestorCmd = ancestorCmd.parent.parent;
	} while (ancestorCmd !== cmd);
	cursor.insRightOf(cmd);
}

export class SupSub extends MathCommand {
	constructor(...args) {
		super(...args);
		this.ctrlSeq = '_{...}^{...}';
	}

	createLeftOf(cursor) {
		if (!this.replacedFragment && !cursor[L] && cursor.options.supSubsRequireOperand) return;
		return super.createLeftOf(cursor);
	}

	contactWeld(cursor) {
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
				for (const supsub of ['sub', 'sup']) {
					const src = this[supsub], dest = this[dir][supsub];
					if (!src) continue;
					if (!dest) this[dir].addBlock(src.disown());
					else if (!src.isEmpty()) { // ins src children at -dir end of dest
						src.jQ.children().insAtDirEnd(-dir, dest.jQ);
						const children = src.children().disown();
						pt = new Point(dest, children.ends[R], dest.ends[L]);
						if (dir === L) children.adopt(dest, dest.ends[R]);
						else children.adopt(dest, undefined, dest.ends[L]);
					} else pt = new Point(dest, undefined, dest.ends[L]);
					this.placeCursor = (cursor) => cursor.insAtDirEnd(-dir, dest || src);
				}
				this.remove();
				if (cursor && cursor[L] === this) {
					if (dir === R && pt) {
						pt[L] ? cursor.insRightOf(pt[L]) : cursor.insAtLeftEnd(pt.parent);
					}
					else cursor.insRightOf(this[dir]);
				}
				break;
			}
		}
	}

	finalizeTree() {
		this.ends[L].isSupSubLeft = true;
	}

	moveTowards(dir, cursor, updown, ...args) {
		if (cursor.options.autoSubscriptNumerals && !this.sup) {
			cursor.insDirOf(dir, this);
		}
		else super.moveTowards(dir, cursor, updown, ...args);
	}

	deleteTowards(dir, cursor, ...args) {
		if (cursor.options.autoSubscriptNumerals && this.sub) {
			const cmd = this.sub.ends[-dir];
			if (cmd instanceof Symbol) cmd.remove();
			else if (cmd) cmd.deleteTowards(dir, cursor.insAtDirEnd(-dir, this.sub));

			// TODO: factor out a .removeBlock() or something
			if (this.sub.isEmpty()) {
				this.sub.deleteOutOf(L, cursor.insAtLeftEnd(this.sub));
				if (this.sup) cursor.insDirOf(-dir, this);
				// Note `-dir` because in e.g. x_1^2| want backspacing (leftward)
				// to delete the 1 but to end up rightward of x^2; with non-negated
				// `dir` (try it), the cursor appears to have gone "through" the ^2.
			}
		}
		else super.deleteTowards(dir, cursor, ...args);
	}

	latex() {
		const latex = (prefix, block) => {
			const l = block && block.latex();
			return block ? prefix + (l.length === 1 ? l : `{${l || ' '}}`) : '';
		};
		return latex('_', this.sub) + latex('^', this.sup);
	}

	text() {
		const text = (prefix, block) => {
			const l = (block && block.text() !== ' ') && block.text();
			return l ? prefix + `(${l || ' '})` : '';
		};
		return text('_', this.sub) + text('^', this.sup);
	}

	addBlock(block) {
		if (this.supsub === 'sub') {
			this.sup = this.upInto = this.sub.upOutOf = block;
			block.adopt(this, this.sub).downOutOf = this.sub;
			block.jQ = jQuery('<span class="mq-sup"/>').append(block.jQ.children())
				.attr(mqBlockId, block.id).prependTo(this.jQ);
		}
		else {
			this.sub = this.downInto = this.sup.downOutOf = block;
			block.adopt(this, undefined, this.sup).upOutOf = this.sup;
			block.jQ = jQuery('<span class="mq-sub"></span>').append(block.jQ.children())
				.attr(mqBlockId, block.id).appendTo(this.jQ.removeClass('mq-sup-only'));
			this.jQ.append('<span style="display:inline-block;width:0">&#8203;</span>');
		}
		// like 'sub sup'.split(' ').forEach((supsub) => { ... });
		for (const supsub of ['sub', 'sup']) {
			const cmd = this;
			const oppositeSupsub = supsub === 'sub' ? 'sup' : 'sub';
			const updown = supsub === 'sub' ? 'down' : 'up';
			cmd[supsub].deleteOutOf = function(dir, cursor) {
				cursor.insDirOf((this[dir] ? -dir : dir), this.parent);
				if (!this.isEmpty()) {
					const end = this.ends[dir];
					this.children().disown()
						.withDirAdopt(dir, cursor.parent, cursor[dir], cursor[-dir])
						.jQ.insDirOf(-dir, cursor.jQ);
					cursor[-dir] = end;
				}
				cmd.supsub = oppositeSupsub;
				delete cmd[supsub];
				delete cmd[`${updown}Into`];
				cmd[oppositeSupsub][`${updown}OutOf`] = insLeftOfMeUnlessAtEnd;
				delete cmd[oppositeSupsub].deleteOutOf;
				if (supsub === 'sub') jQuery(cmd.jQ.addClass('mq-sup-only')[0].lastChild).remove();
				this.remove();
			};
		}
	}

	reflow() {
		const $block = this.jQ ;//mq-supsub
		const $prev = $block.prev() ;

		if (!$prev.length) {
			//we cant normalize it without having prev. element (which is base)
			return ;
		}

		const $sup = $block.children('.mq-sup');//mq-supsub -> mq-sup
		if ($sup.length) {
			const sup_fontsize = parseInt($sup.css('font-size')) ;
			const sup_bottom = $sup.offset().top + $sup.height() ;
			//we want that superscript overlaps top of base on 0.7 of its font-size
			//this way small superscripts like x^2 look ok, but big ones like x^(1/2/3) too
			const needed = sup_bottom - $prev.offset().top  - 0.7 * sup_fontsize ;
			const cur_margin = parseInt($sup.css('margin-bottom')) ;
			//we lift it up with margin-bottom
			$sup.css('margin-bottom', cur_margin + needed) ;
		}
	}
}

export class UpperLowerLimitCommand extends MathCommand {
	latex() {
		const simplify = (latex) => latex.length === 1 ? latex : `{${latex || ' '}}`;
		return `${this.ctrlSeq}_${simplify(this.ends[L].latex())}^${simplify(this.ends[R].latex())}`;
	}

	parser() {
		const string = Parser.string;
		const optWhitespace = Parser.optWhitespace;
		const succeed = Parser.succeed;
		const block = latexMathParser.block;

		const self = this;
		const blocks = self.blocks = [ new MathBlock(), new MathBlock() ];
		for (const block of blocks) {
			block.adopt(self, self.ends[R]);
		}

		return optWhitespace.then(string('_').or(string('^'))).then((supOrSub) => {
			const child = blocks[supOrSub === '_' ? 0 : 1];
			return block.then((block) => {
				block.children().adopt(child, child.ends[R]);
				return succeed(self);
			});
		}).many().result(self);
	}

	finalizeTree() {
		this.downInto = this.ends[L];
		this.upInto = this.ends[R];
		this.ends[L].upOutOf = this.ends[R];
		this.ends[R].downOutOf = this.ends[L];
	}
};

// Round/Square/Curly/Angle Brackets (aka Parens/Brackets/Braces)
//   first typed as one-sided bracket with matching "ghost" bracket at
//   far end of current block, until you type an opposing one
export class Bracket extends DelimsMixin(MathCommand) {
	constructor(side, open, close, ctrlSeq, end) {
		super(`\\left${ctrlSeq}`, undefined, [open, close]);
		this.side = side;
		this.sides = {};
		this.sides[L] = { ch: open, ctrlSeq: ctrlSeq };
		this.sides[R] = { ch: close, ctrlSeq: end };
		this.placeCursor = noop;
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
		return `\\left${this.sides[L].ctrlSeq}${this.ends[L].latex()}\\right${this.sides[R].ctrlSeq}`;
	}

	text() {
		return `${this.sides[L].ch}${this.ends[L].text()}${this.sides[R].ch}`;
	}

	matchBrack(opts, expectedSide, node) {
		// return node iff it's a matching 1-sided bracket of expected side (if any)
		return node instanceof Bracket && node.side && node.side !== -expectedSide
			&& (!opts.restrictMismatchedBrackets
				|| OPP_BRACKS[this.sides[this.side].ch] === node.sides[node.side].ch
				|| { '(': ']', '[': ')' }[this.sides[L].ch] === node.sides[R].ch) && node;
	}

	closeOpposing(brack) {
		brack.side = 0;
		brack.sides[this.side] = this.sides[this.side]; // copy over my info (may be
		brack.delimjQs.eq(this.side === L ? 0 : 1) // mismatched, like [a, b))
			.removeClass('mq-ghost').html(this.sides[this.side].ch);
	}

	createLeftOf(cursor) {
		let brack, side;
		if (!this.replacedFragment) { // unless wrapping seln in brackets,
			// check if next to or inside an opposing one-sided bracket
			const opts = cursor.options;
			if (this.sides[L].ch === '|') { // check both sides if I'm a pipe
				brack = this.matchBrack(opts, R, cursor[R])
					|| this.matchBrack(opts, L, cursor[L])
					|| this.matchBrack(opts, 0, cursor.parent.parent);
			}
			else {
				brack = this.matchBrack(opts, -this.side, cursor[-this.side])
					|| this.matchBrack(opts, -this.side, cursor.parent.parent);
			}
		}
		if (brack) {
			side = this.side = -brack.side; // may be pipe with .side not yet set
			this.closeOpposing(brack);
			if (brack === cursor.parent.parent && cursor[side]) { // move the stuff between
				new Fragment(cursor[side], cursor.parent.ends[side], -side) // me and ghost outside
					.disown().withDirAdopt(-side, brack.parent, brack, brack[side])
					.jQ.insDirOf(side, brack.jQ);
			}
			brack.bubble('reflow');
		} else {
			// TODO:  Check this super usage.
			brack = this, side = brack.side;
			if (brack.replacedFragment) brack.side = 0; // wrapping seln, don't be one-sided
			else if (cursor[-side]) { // elsewise, auto-expand so ghost is at far end
				brack.replaces(new Fragment(cursor[-side], cursor.parent.ends[-side], side));
				delete cursor[-side];
			}
			super.createLeftOf.call(brack, cursor);
		}
		if (side === L) cursor.insAtLeftEnd(brack.ends[L]);
		else cursor.insRightOf(brack);
	}

	unwrap() {
		this.ends[L].children().disown().adopt(this.parent, this, this[R])
			.jQ.insertAfter(this.jQ);
		this.remove();
	}

	deleteSide(side, outward, cursor) {
		const parent = this.parent, sib = this[side], farEnd = parent.ends[side];

		if (side === this.side) { // deleting non-ghost of one-sided bracket, unwrap
			this.unwrap();
			sib ? cursor.insDirOf(-side, sib) : cursor.insAtDirEnd(side, parent);
			return;
		}

		const opts = cursor.options, wasSolid = !this.side;
		this.side = -side;
		// if deleting like, outer close-brace of [(1+2)+3} where inner open-paren
		if (this.matchBrack(opts, side, this.ends[L].ends[this.side])) { // is ghost,
			this.closeOpposing(this.ends[L].ends[this.side]); // then become [1+2)+3
			const origEnd = this.ends[L].ends[side];
			this.unwrap();
			if (origEnd?.siblingCreated) origEnd.siblingCreated(cursor.options, side);
			sib ? cursor.insDirOf(-side, sib) : cursor.insAtDirEnd(side, parent);
		}
		else { // if deleting like, inner close-brace of ([1+2}+3) where outer
			if (this.matchBrack(opts, side, this.parent.parent)) { // open-paren is
				this.parent.parent.closeOpposing(this); // ghost, then become [1+2+3)
				this.parent.parent.unwrap();
			} // else if deleting outward from a solid pair, unwrap
			else if (outward && wasSolid) {
				this.unwrap();
				sib ? cursor.insDirOf(-side, sib) : cursor.insAtDirEnd(side, parent);
				return;
			}
			else { // else deleting just one of a pair of brackets, become one-sided
				this.sides[side] = { ch: OPP_BRACKS[this.sides[this.side].ch],
					ctrlSeq: OPP_BRACKS[this.sides[this.side].ctrlSeq] };
				this.delimjQs.removeClass('mq-ghost')
					.eq(side === L ? 0 : 1).addClass('mq-ghost').html(this.sides[side].ch);
			}
			if (sib) { // auto-expand so ghost is at far end
				const origEnd = this.ends[L].ends[side];
				new Fragment(sib, farEnd, -side).disown()
					.withDirAdopt(-side, this.ends[L], origEnd)
					.jQ.insAtDirEnd(side, this.ends[L].jQ.removeClass('mq-empty'));
				if (origEnd?.siblingCreated) origEnd.siblingCreated(cursor.options, side);
				cursor.insDirOf(-side, sib);
			} // didn't auto-expand, cursor goes just outside or just inside parens
			else (outward ? cursor.insDirOf(side, this)
				: cursor.insAtDirEnd(side, this.ends[L]));
		}
	}

	deleteTowards(dir, cursor) {
		this.deleteSide(-dir, false, cursor);
	}

	finalizeTree() {
		this.ends[L].deleteOutOf = function(dir, cursor) {
			this.parent.deleteSide(dir, true, cursor);
		};
		// FIXME HACK: after initial creation/insertion, finalizeTree would only be
		// called if the paren is selected and replaced, e.g. by LiveFraction
		this.finalizeTree = function() {
			this.delimjQs.eq(this.side === L ? 1 : 0).removeClass('mq-ghost');
			this.side = 0;
		};
	}

	siblingCreated(opts, dir) { // if something typed between ghost and far
		if (dir === -this.side) this.finalizeTree(); // end of its block, solidify
	}
}

export const latexMathParser = (() => {
	const commandToBlock = (cmd) => { // can also take in a Fragment
		const block = new MathBlock();
		cmd.adopt(block);
		return block;
	};
	const joinBlocks = (blocks) => {
		const firstBlock = blocks[0] || new MathBlock();

		for (const block of blocks.slice(1)) {
			block.children().adopt(firstBlock, firstBlock.ends[R]);
		}

		return firstBlock;
	};

	const string = Parser.string;
	const regex = Parser.regex;
	const letter = Parser.letter;
	const any = Parser.any;
	const optWhitespace = Parser.optWhitespace;
	const succeed = Parser.succeed;
	const fail = Parser.fail;

	// Parsers yielding either MathCommands, or Fragments of MathCommands
	//   (either way, something that can be adopted by a MathBlock)
	const variable = letter.map((c) => new Letter(c));
	const symbol = regex(/^[^${}\\_^]/).map((c) => new VanillaSymbol(c));

	const controlSequence =
		regex(/^[^\\a-eg-zA-Z]/) // hotfix #164; match MathBlock::write
			.or(string('\\').then(
				regex(/^[a-z]+/i)
					.or(regex(/^\s+/).result(' '))
					.or(any)
			)).then((ctrlSeq) => {
				const cmdKlass = LatexCmds[ctrlSeq];

				if (cmdKlass) {
					return new cmdKlass(ctrlSeq).parser();
				} else {
					return fail(`unknown command: \\${ctrlSeq}`);
				}
			});

	const command = controlSequence.or(variable).or(symbol);

	// Parsers yielding MathBlocks
	const mathGroup = string('{').then(() => mathSequence).skip(string('}'));
	const mathBlock = optWhitespace.then(mathGroup.or(command.map(commandToBlock)));
	const mathSequence = mathBlock.many().map(joinBlocks).skip(optWhitespace);

	const optMathBlock =
		string('[').then(
			mathBlock.then((block) => {
				return block.join('latex') !== ']' ? succeed(block) : fail();
			})
				.many().map(joinBlocks).skip(optWhitespace)
		).skip(string(']'))
	;

	const latexMath = mathSequence;

	latexMath.block = mathBlock;
	latexMath.optBlock = optMathBlock;
	return latexMath;
})();
