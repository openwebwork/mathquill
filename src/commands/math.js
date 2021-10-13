// Abstract classes of math blocks and commands.
// Math tree node base class.
// Some math-tree-specific extensions to Node.
// Both MathBlock's and MathCommand's descend from it.

class MathElement extends Node {
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
		if (this[R].siblingCreated) this[R].siblingCreated(options, L);
		if (this[L].siblingCreated) this[L].siblingCreated(options, R);
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
class MathCommand extends deleteSelectTowardsMixin(MathElement) {
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
				block.adopt(this, this.ends[R], 0);
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
			replacedFragment.adopt(this.ends[L], 0, 0);
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
			this.blocks[i].adopt(this, this.ends[R], 0);
		}
	}

	placeCursor(cursor) {
		//insert the cursor at the right end of the first empty child, searching
		//left-to-right, or if none empty, the right end child
		cursor.insAtRightEnd(this.foldChildren(this.ends[L], (leftward, child) => leftward.isEmpty() ? leftward : child));
	}

	selectChildren() {
		return new Selection(this, this);
	}

	unselectInto(dir, cursor) {
		cursor.insAtDirEnd(-dir, cursor.anticursor.ancestors[this.id]);
	}

	seek(pageX, cursor) {
		const getBounds = (node) => {
			const bounds = {}
			bounds[L] = node.jQ.offset().left;
			bounds[R] = bounds[L] + node.jQ.outerWidth();
			return bounds;
		}

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
				tokens[i] = token.slice(0,-2) + cmdId + '/>';
			}
			// top-level open tags
			else if (token.charAt(0) === '<') {
				pray('not an unmatched top-level close tag', token.charAt(1) !== '/');

				tokens[i] = token.slice(0,-1) + cmdId + '>';

				// skip matching top-level close tag and all tag pairs in between
				let nesting = 1;
				do {
					i += 1, token = tokens[i];
					pray('no missing close tags', token);
					// close tags
					if (token.slice(0,2) === '</') {
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
class Symbol extends MathCommand {
	constructor(ctrlSeq, html, text) {
		if (!text) text = ctrlSeq && ctrlSeq.length > 1 ? ctrlSeq.slice(1) : ctrlSeq;

		super(ctrlSeq, html, [ text ]);

		this.createBlocks = noop;
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
		if (pageX - this.jQ.offset().left < this.jQ.outerWidth()/2)
			cursor.insLeftOf(this);
		else
			cursor.insRightOf(this);
	}

	latex() { return this.ctrlSeq; };

	text() { return this.textTemplate; };

	placeCursor() {};

	isEmpty() { return true; };
}

class VanillaSymbol extends Symbol {
	constructor(ch, html, text) {
		super(ch, `<span>${html || ch}</span>`, text);
	}
}

class BinaryOperator extends Symbol {
	constructor(ctrlSeq, html, text, useRawHtml = false) {
		super(ctrlSeq, useRawHtml === true ? html : `<span class="mq-binary-operator">${html}</span>`, text);
	}
}

class Digit extends VanillaSymbol {
	createLeftOf(cursor) {
		if (cursor.options.autoSubscriptNumerals
			&& cursor.parent !== cursor.parent.parent.sub
			&& ((cursor[L] instanceof Variable && cursor[L].isItalic !== false)
				|| (cursor[L] instanceof SupSub
					&& cursor[L][L] instanceof Variable
					&& cursor[L][L].isItalic !== false))) {
			new LatexCmds._().createLeftOf(cursor);
			super.createLeftOf(cursor);
			cursor.insRightOf(cursor.parent.parent);
		}
		else super.createLeftOf(cursor);
	}
}

class Variable extends Symbol {
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
			else if (text[text.length-1] == ' ' || text[text.length-1] == '}') {
				text = text.slice (0, -1);
			}
		}
		return text;
	};
}

class Letter extends Variable {
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
				if (autoCmds.hasOwnProperty(str)) {
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
		new Fragment(l[R] || this.parent.ends[L], r[L] || this.parent.ends[R]).each((el) => {
			el.italicize(true).jQ.removeClass('mq-first mq-last mq-followed-by-supsub');
			el.ctrlSeq = el.letter;
		});

		// check for operator names: at each position from left to right, check
		// substrings from longest to shortest
		outer: for (let i = 0, first = l[R] || this.parent.ends[L]; i < str.length; ++i, first = first[R]) {
			for (let len = Math.min(autoOps._maxLength, str.length - i); len > 0; --len) {
				const word = str.slice(i, i + len);
				if (autoOps.hasOwnProperty(word)) {
					let last;
					for (let j = 0, letter = first; j < len; j += 1, letter = letter[R]) {
						letter.italicize(false);
						last = letter;
					}

					const isBuiltIn = BuiltInOpNames.hasOwnProperty(word);
					first.ctrlSeq = (isBuiltIn ? '\\' : '\\operatorname{') + first.ctrlSeq;
					last.ctrlSeq += (isBuiltIn ? ' ' : '}');
					if (TwoWordOpNames.hasOwnProperty(word)) last[L][L][L].jQ.addClass('mq-last');
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

// Children and parent of MathCommand's. Basically partitions all the
// symbols and operators that descend (in the Math DOM tree) from
// ancestor operators.
class MathBlock extends BlockFocusBlur(writeMethodMixin(MathElement)) {
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
		const updownInto = updown && this.parent[updown+'Into'];
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
		let cons;
		// exclude f because it gets a dedicated command with more spacing
		if (ch.match(/^[a-eg-zA-Z]$/))
			return new Letter(ch);
		else if (/^\d$/.test(ch))
			return new Digit(ch);
		else if (options && options.typingSlashWritesDivisionSymbol && ch === '/')
			return new LatexCmds['\u00f7'](ch);
		else if (options && options.typingAsteriskWritesTimesSymbol && ch === '*')
			return new LatexCmds['\u00d7'](ch);
		else if (cons = CharCmds[ch] || LatexCmds[ch])
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

API.StaticMath = (APIClasses) => class extends APIClasses.AbstractMathQuill {
	static RootBlock = MathBlock;

	constructor(...args) {
		super(...args);

		this.__controller.root.postOrder(
			'registerInnerField', this.innerFields = [], APIClasses.InnerMathField);
	}

	__mathquillify(opts) {
		this.config(opts);
		super.__mathquillify('mq-math-mode');
		if (this.__options.mouseEvents) {
			this.__controller.delegateMouseEvents();
			this.__controller.staticMathTextareaEvents();
		}
		return this;
	}

	latex(...args) {
		const returned = super.latex(...args);
		if (args.length > 0) {
			this.__controller.root.postOrder(
				'registerInnerField', this.innerFields = [], APIClasses.InnerMathField);
		}
		return returned;
	}
};

class RootMathBlock extends MathBlock {
	constructor(...args) {
		super(...args);

		RootBlockMixin(this);
	}
}

API.MathField = (APIClasses) => class extends APIClasses.EditableField {
	static RootBlock = RootMathBlock;

	__mathquillify(opts) {
		this.config(opts);

		// Disable reflow during initialization.
		const reflowSave = this.__controller.root.reflow;
		this.__controller.root.reflow = noop;

		super.__mathquillify('mq-editable-field mq-math-mode');

		if (reflowSave) this.__controller.root.reflow = reflowSave;
		else delete this.__controller.root.reflow;

		return this;
	}
};

API.InnerMathField = (APIClasses) => class extends APIClasses.MathField {
	makeStatic() {
		this.__controller.editable = false;
		this.__controller.root.blur();
		this.__controller.unbindEditablesEvents();
		this.__controller.container.removeClass('mq-editable-field');
	};

	makeEditable() {
		this.__controller.editable = true;
		this.__controller.editablesTextareaEvents();
		this.__controller.cursor.insAtRightEnd(this.__controller.root);
		this.__controller.container.addClass('mq-editable-field');
	}
};
