// Options for the API objects

import type { Direction } from 'src/constants';
import { BuiltInOpNames } from 'src/constants';
import type { AbstractMathQuill } from 'src/abstractFields';
import type { TextAreaHandlers } from 'services/saneKeyboardEvents.util';
import { saneKeyboardEvents } from 'services/saneKeyboardEvents.util';

export type Handler = (mq: AbstractMathQuill) => void;
export type DirectionHandler = (dir: Direction, mq: AbstractMathQuill) => void;

export interface Handlers {
	enter?: Handler;
	edit?: Handler;
	edited?: Handler;
	reflow?: Handler;
	textBlockEnter?: Handler;
	textBlockExit?: Handler;
	moveOutOf?: DirectionHandler;
	deleteOutOf?: DirectionHandler;
	selectOutOf?: DirectionHandler;
	upOutOf?: DirectionHandler;
	downOutOf?: DirectionHandler;
}

export interface InputOptions {
	mouseEvents?: boolean;
	autoCommands?: string;
	autoOperatorNames?: string;
	charsThatBreakOutOfSupSub?: string;
	statelessClipboard?: boolean;
	spaceBehavesLikeTab?: boolean;
	leftRightIntoCmdGoes?: 'up' | 'down';
	restrictMismatchedBrackets?: boolean;
	sumStartsWithNEquals?: boolean;
	supSubsRequireOperand?: boolean;
	rootsAreExponents?: boolean;
	noExtraFractionParens?: boolean;
	maxDepth?: number;
	autoSubscriptNumerals?: boolean;
	typingSlashWritesDivisionSymbol?: boolean;
	typingAsteriskWritesTimesSymbol?: boolean;
	substituteTextarea?: () => HTMLTextAreaElement;
	substituteKeyboardEvents?: typeof saneKeyboardEvents;
	handlers?: Handlers;
}

type NamesWLength = { [key: string]: number, _maxLength: number };

export class Options {
	static config(currentOptions: Options, newOptions: InputOptions) {
		Object.assign(currentOptions, newOptions);
	}

	// Each option has a static variable for the default setting, and an instance variable for the setting of a
	// particular math field.

	// Wether mouse events are active for StaticMath blocks
	static mouseEvents = true;
	_mouseEvents?: boolean;
	get mouseEvents() { return this._mouseEvents ?? Options.mouseEvents; }
	set mouseEvents(mouseEvents) { this._mouseEvents = mouseEvents; }

	// The set of commands that are automatically typeset without typing a preceding backslash.
	static autoCommands: NamesWLength = { _maxLength: 0 };
	_autoCommands?: NamesWLength;
	get autoCommands(): NamesWLength { return this._autoCommands ?? Options.autoCommands; }
	set autoCommands(cmds: string | NamesWLength) {
		if (typeof cmds === 'object') {
			this._autoCommands = cmds;
			return;
		}

		if (!/^[a-z]+(?: [a-z]+)*$/i.test(cmds)) {
			throw `"${cmds}" not a space-delimited list of only letters`;
		}
		const list = cmds.split(' '), dict: NamesWLength = { _maxLength: 0 };
		for (const cmd of list) {
			if (cmd.length < 2) throw `autocommand "${cmd}" not minimum length of 2`;
			if (cmd in BuiltInOpNames) throw `"${cmd}" is a built-in operator name`;
			dict[cmd] = 1;
			dict._maxLength = Math.max(dict._maxLength, cmd.length);
		}
		this._autoCommands = dict;
	}

	// The set of operator names that MathQuill auto-unitalicizes.
	static autoOperatorNames: NamesWLength = (() => {
		const ops: NamesWLength = { _maxLength: 9 };

		// Standard operators
		for (const op of [
			'arg', 'deg', 'det', 'dim', 'exp', 'gcd', 'hom', 'ker', 'lg', 'lim', 'ln',
			'log', 'max', 'min', 'sup', 'limsup', 'liminf', 'injlim', 'projlim', 'Pr'
		]) { ops[op] = 1; }

		// Trig operators
		for (const autoTrig of ['sin', 'cos', 'tan', 'sec', 'cosec', 'csc', 'cotan', 'cot', 'ctg']) {
			ops[autoTrig] = ops[`arc${autoTrig}`] = ops[`${autoTrig}h`] =
				ops[`ar${autoTrig}h`] = ops[`arc${autoTrig}h`] = 1;
		}

		// compat with some of the nonstandard LaTeX exported by MathQuill
		// before #247. None of these are real LaTeX commands so, seems safe
		for (const op of ['gcf', 'hcf', 'lcm', 'proj', 'span']) { ops[op] = 1; }

		return ops;
	})();
	_autoOperatorNames?: NamesWLength;
	get autoOperatorNames(): NamesWLength { return this._autoOperatorNames ?? Options.autoOperatorNames; }
	set autoOperatorNames(cmds: string | NamesWLength) {
		if (typeof cmds === 'object') {
			this._autoCommands = cmds;
			return;
		}

		if (!/^[a-z]+(?: [a-z]+)*$/i.test(cmds)) {
			throw `"${cmds}" not a space-delimited list of only letters`;
		}
		const list = cmds.split(' '), dict: NamesWLength = { _maxLength: 0 };
		for (const cmd of list) {
			if (cmd.length < 2) throw `"${cmd}" not minimum length of 2`;
			dict[cmd] = 1;
			dict._maxLength = Math.max(dict._maxLength, cmd.length);
		}
		this._autoOperatorNames = dict;
	}

	// Characters that "break out" of superscripts and subscripts
	static charsThatBreakOutOfSupSub = '';
	_charsThatBreakOutOfSupSub?: string;
	get charsThatBreakOutOfSupSub() { return this._charsThatBreakOutOfSupSub ?? Options.charsThatBreakOutOfSupSub; }
	set charsThatBreakOutOfSupSub(charsThatBreakOutOfSupSub) {
		this._charsThatBreakOutOfSupSub = charsThatBreakOutOfSupSub;
	}

	// Not fully implemented stateless clipboard
	static statelessClipboard = false;
	_statelessClipboard?: boolean;
	get statelessClipboard() { return this._statelessClipboard ?? Options.statelessClipboard; }
	set statelessClipboard(statelessClipboard) { this._statelessClipboard = statelessClipboard; }

	// If true then space will behave like tab escaping from the current block instead of inserting a space.
	static spaceBehavesLikeTab = false;
	_spaceBehavesLikeTab?: boolean;
	get spaceBehavesLikeTab() { return this._spaceBehavesLikeTab ?? Options.spaceBehavesLikeTab; }
	set spaceBehavesLikeTab(spaceBehavesLikeTab) { this._spaceBehavesLikeTab = spaceBehavesLikeTab; }

	// Set to 'up' or 'down' so that left and right go up or down (respectively) into commands.
	static leftRightIntoCmdGoes: 'up' | 'down' | undefined = undefined;
	_leftRightIntoCmdGoes?: 'up' | 'down';
	get leftRightIntoCmdGoes() { return this._leftRightIntoCmdGoes ?? Options.leftRightIntoCmdGoes; }
	set leftRightIntoCmdGoes(updown: 'up' | 'down' | string | undefined) {
		if (updown && updown !== 'up' && updown !== 'down') {
			throw `"up" or "down" required for leftRightIntoCmdGoes option, got "${updown}"`;
		}
		this._leftRightIntoCmdGoes = updown as 'up' | 'down' | undefined;
	}

	// If true then you can type '[a,b)' and '(a,b]', but if you type '[x}' or '{x)', you'll get '[{x}]' or '{(x)}'
	// instead.
	static restrictMismatchedBrackets = false;
	_restrictMismatchedBrackes?: boolean;
	get restrictMismatchedBrackets() { return this._restrictMismatchedBrackes ?? Options.restrictMismatchedBrackets; }
	set restrictMismatchedBrackets(restrictMismatchedBrackets) {
		this._restrictMismatchedBrackes = restrictMismatchedBrackets;
	}

	// If true then when you type '\sum', '\prod', or '\coprod', the lower limit starts out with 'n='.
	static sumStartsWithNEquals = false;
	_sumStartsWithNEquals?: boolean;
	get sumStartsWithNEquals() { return this._sumStartsWithNEquals ?? Options.sumStartsWithNEquals; }
	set sumStartsWithNEquals(sumStartsWithNEquals) { this._sumStartsWithNEquals = sumStartsWithNEquals; }

	// Disables typing of superscripts and subscripts when there's nothing to the left of the cursor.
	static supSubsRequireOperand = false;
	_supSubsRequireOperand?: boolean;
	get supSubsRequireOperand() { return this._supSubsRequireOperand ?? Options.supSubsRequireOperand; }
	set supSubsRequireOperand(supSubsRequireOperand) { this._supSubsRequireOperand = supSubsRequireOperand; }

	// If true then the text output for an nth root will be 'x^(1/n)' instead of 'root(n,x)'.
	static rootsAreExponents = false;
	_rootsAreExponents?: boolean;
	get rootsAreExponents() { return this._rootsAreExponents ?? Options.rootsAreExponents; }
	set rootsAreExponents(rootsAreExponents) { this._rootsAreExponents = rootsAreExponents; }

	// If true then the text output for a fraction will not be wrapped in extra parentheses.
	static noExtraFractionParens = false;
	_noExtraFractionParens?: boolean;
	get noExtraFractionParens() { return this._noExtraFractionParens ?? Options.noExtraFractionParens; }
	set noExtraFractionParens(noExtraFractionParens) { this._noExtraFractionParens = noExtraFractionParens; }

	// Specifies the maximum number of nested MathBlocks allowed.
	static maxDepth = undefined;
	_maxDepth?: number;
	get maxDepth() { return this._maxDepth ?? Options.maxDepth; }
	set maxDepth(maxDepth) { if (typeof maxDepth === 'number') this._maxDepth = maxDepth; }

	// If true then a number typed after a letter will automatically be put into a subscript.
	static autoSubscriptNumerals = false;
	_autoSubscriptNumerals?: boolean;
	get autoSubscriptNumerals() { return this._autoSubscriptNumerals ?? Options.autoSubscriptNumerals; }
	set autoSubscriptNumerals(autoSubscriptNumerals) { this._autoSubscriptNumerals = autoSubscriptNumerals; }

	// If true then typing a slash gives the division symbol instead of a live fraction.
	static typingSlashWritesDivisionSymbol = false;
	_typingSlashWritesDivisionSymbol?: boolean;
	get typingSlashWritesDivisionSymbol() {
		return this._typingSlashWritesDivisionSymbol ?? Options.typingSlashWritesDivisionSymbol;
	}
	set typingSlashWritesDivisionSymbol(typingSlashWritesDivisionSymbol) {
		this._typingSlashWritesDivisionSymbol = typingSlashWritesDivisionSymbol;
	}

	// If true then typing an asterisk gives the times symbol.
	static typingAsteriskWritesTimesSymbol = false;
	_typingAsteriskWritesTimesSymbol?: boolean;
	get typingAsteriskWritesTimesSymbol() {
		return this._typingAsteriskWritesTimesSymbol ?? Options.typingAsteriskWritesTimesSymbol;
	}
	set typingAsteriskWritesTimesSymbol(typingAsteriskWritesTimesSymbol) {
		this._typingAsteriskWritesTimesSymbol = typingAsteriskWritesTimesSymbol;
	}

	handlers?: Handlers;

	substituteTextarea() {
		const textarea = document.createElement('textarea');
		textarea.setAttribute('autocapitalize', 'off');
		textarea.setAttribute('autocomplete', 'off');
		textarea.setAttribute('autocorrext', 'off');
		textarea.setAttribute('spellcheck', 'false');
		return textarea;
	}

	substituteKeyboardEvents(el: HTMLTextAreaElement | JQuery<HTMLTextAreaElement>, handlers: TextAreaHandlers) {
		return saneKeyboardEvents(el, handlers);
	}

	ignoreNextMousedown: (e?: JQuery.TriggeredEvent) => boolean = () =>  { return false; }
}
