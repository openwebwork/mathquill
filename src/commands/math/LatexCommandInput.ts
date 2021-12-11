// Input box to type backslash commands

import { jQuery, L, R, LatexCmds, CharCmds } from 'src/constants';
import type { Controller } from 'src/controller';
import type { Cursor } from 'src/cursor';
import type { Fragment } from 'tree/fragment';
import type { Node } from 'tree/node';
import { VanillaSymbol, MathCommand } from 'commands/mathElements';
import { TextBlock } from 'commands/textElements';

CharCmds['\\'] = class LatexCommandInput extends MathCommand {
	_replacedFragment?: Fragment;

	constructor() {
		super();
		this.ctrlSeq = '\\';
		this.htmlTemplate = '<span class="mq-latex-command-input mq-non-leaf">\\<span>&0</span></span>';
		this.textTemplate = ['\\'];
	}

	replaces(replacedFragment?: Fragment) {
		this._replacedFragment = replacedFragment?.disown();
		this.isEmpty = () => false;
	}

	createBlocks() {
		super.createBlocks();

		const leftEnd = this.ends[L] as Node;

		leftEnd.focus = () => {
			leftEnd.parent?.jQ.addClass('mq-hasCursor');
			if (leftEnd.isEmpty())
				leftEnd.parent?.jQ.removeClass('mq-empty');

			return leftEnd;
		};

		leftEnd.blur = () => {
			leftEnd.parent?.jQ.removeClass('mq-hasCursor');
			if (leftEnd.isEmpty())
				leftEnd.parent?.jQ.addClass('mq-empty');

			return leftEnd;
		};

		leftEnd.write = (cursor: Cursor, ch: string) => {
			cursor.show().deleteSelection();

			if (ch.match(/[a-z]/i)) new VanillaSymbol(ch).createLeftOf(cursor);
			else {
				(leftEnd.parent as LatexCommandInput).renderCommand(cursor);
				if (ch !== '\\' || !leftEnd.isEmpty()) cursor.parent?.write(cursor, ch);
			}
		};

		leftEnd.keystroke = (key: string, e: Event, ctrlr: Controller) => {
			if (key === 'Tab' || key === 'Enter' || key === 'Spacebar') {
				(leftEnd.parent as LatexCommandInput).renderCommand(ctrlr.cursor);
				e.preventDefault();
				return;
			}
			return super.keystroke(key, e, ctrlr);
		};
	}

	createLeftOf(cursor: Cursor) {
		super.createLeftOf(cursor);

		if (this._replacedFragment) {
			//FIXME: is monkey-patching the mousedown and mousemove handlers the right way to do this?
			this.jQ = this._replacedFragment.jQ.addClass('mq-blur').on(
				'mousedown mousemove',
				(e) => {
					jQuery(e.target = this.jQ[0]).trigger(e);
					return false;
				}
			).insertBefore(this.jQ).add(this.jQ);
		}
	}

	latex() {
		return '\\' + (this.ends[L]?.latex() ?? '') + ' ';
	}

	renderCommand(cursor: Cursor) {
		this.jQ = this.jQ.last();
		this.remove();
		if (this[R]) {
			cursor.insLeftOf(this[R] as Node);
		} else {
			cursor.insAtRightEnd(this.parent as Node);
		}

		const latex = this.ends[L]?.latex() ?? ' ';
		if (latex in LatexCmds) {
			const cmd = new LatexCmds[latex](latex);
			if (this._replacedFragment) cmd.replaces(this._replacedFragment);
			cmd.createLeftOf(cursor);
		} else {
			const cmd = new TextBlock();
			cmd.replaces(latex);
			cmd.createLeftOf(cursor);
			cursor.insRightOf(cmd);
			if (this._replacedFragment)
				this._replacedFragment.remove();
		}
	}
};
