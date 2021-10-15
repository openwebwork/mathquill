// Input box to type backslash commands

import { jQuery, L, R, LatexCmds, CharCmds } from 'src/constants';
import { VanillaSymbol, MathCommand } from 'commands/mathElements';
import { TextBlock } from 'commands/textElements';

CharCmds['\\'] = class extends MathCommand {
	constructor(...args) {
		super(...args);
		this.ctrlSeq = '\\';
		this.htmlTemplate = '<span class="mq-latex-command-input mq-non-leaf">\\<span>&0</span></span>';
		this.textTemplate = ['\\'];
	}

	replaces(replacedFragment) {
		this._replacedFragment = replacedFragment.disown();
		this.isEmpty = () => false;
	}

	createBlocks() {
		super.createBlocks();
		this.ends[L].focus = function() {
			this.parent.jQ.addClass('mq-hasCursor');
			if (this.isEmpty())
				this.parent.jQ.removeClass('mq-empty');

			return this;
		};
		this.ends[L].blur = function() {
			this.parent.jQ.removeClass('mq-hasCursor');
			if (this.isEmpty())
				this.parent.jQ.addClass('mq-empty');

			return this;
		};
		this.ends[L].write = function(cursor, ch) {
			cursor.show().deleteSelection();

			if (ch.match(/[a-z]/i)) new VanillaSymbol(ch).createLeftOf(cursor);
			else {
				this.parent.renderCommand(cursor);
				if (ch !== '\\' || !this.isEmpty()) cursor.parent.write(cursor, ch);
			}
		};
		const superKeystroke = super.keystroke;
		this.ends[L].keystroke = function(key, e, ctrlr, ...args) {
			if (key === 'Tab' || key === 'Enter' || key === 'Spacebar') {
				this.parent.renderCommand(ctrlr.cursor);
				e.preventDefault();
				return;
			}
			return superKeystroke(key, e, ctrlr, ...args);
		};
	}

	createLeftOf(cursor) {
		super.createLeftOf(cursor);

		if (this._replacedFragment) {
			const el = this.jQ[0];
			//FIXME: is monkey-patching the mousedown and mousemove handlers the right way to do this?
			this.jQ = this._replacedFragment.jQ.addClass('mq-blur').on(
				'mousedown mousemove',
				(e) => {
					jQuery(e.target = el).trigger(e);
					return false;
				}
			).insertBefore(this.jQ).add(this.jQ);
		}
	}

	latex() {
		return '\\' + this.ends[L].latex() + ' ';
	}

	renderCommand(cursor) {
		this.jQ = this.jQ.last();
		this.remove();
		if (this[R]) {
			cursor.insLeftOf(this[R]);
		} else {
			cursor.insAtRightEnd(this.parent);
		}

		let latex = this.ends[L].latex();
		if (!latex) latex = ' ';
		let cmd = LatexCmds[latex];
		if (cmd) {
			cmd = new cmd(latex);
			if (this._replacedFragment) cmd.replaces(this._replacedFragment);
			cmd.createLeftOf(cursor);
		} else {
			cmd = new TextBlock();
			cmd.replaces(latex);
			cmd.createLeftOf(cursor);
			cursor.insRightOf(cmd);
			if (this._replacedFragment)
				this._replacedFragment.remove();
		}
	}
};
