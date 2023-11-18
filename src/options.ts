// Options for the API objects

import type { Direction } from 'src/constants';
import { BuiltInOpNames } from 'src/constants';
import type { AbstractMathQuill } from 'src/abstractFields';

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
	logsChangeBase?: boolean;
	maxDepth?: number;
	autoSubscriptNumerals?: boolean;
	typingSlashWritesDivisionSymbol?: boolean;
	typingAsteriskWritesTimesSymbol?: boolean;
	substituteTextarea?: () => HTMLTextAreaElement;
	handlers?: Handlers;
	overridePaste?: () => void;
	overrideCut?: () => void;
	overrideCopy?: () => void;
	overrideTypedText?: (text: string) => void;
	overrideKeystroke?: (key: string, event: KeyboardEvent) => void;
	ignoreNextMousedown: (e?: MouseEvent) => boolean;
}

type NamesWLength = { [key: string]: number, _maxLength: number };

export class Options {
	static config(currentOptions: Options, newOptions: InputOptions) {
		Object.assign(currentOptions, newOptions);
	}

	// Each option has a static variable for the default setting, and an instance variable for the setting of a
	// particular math field.

	// Wether mouse events are active for StaticMath blocks
	static #mouseEvents = true;
	#_mouseEvents?: boolean;
	get mouseEvents() { return this.#_mouseEvents ?? Options.#mouseEvents; }
	set mouseEvents(mouseEvents) {
		if (this instanceof Options) this.#_mouseEvents = mouseEvents;
		else Options.#mouseEvents = mouseEvents;
	}

	// The set of commands that are automatically typeset without typing a preceding backslash.
	static #autoCommands: NamesWLength = { _maxLength: 0 };
	#_autoCommands?: NamesWLength;
	get autoCommands(): NamesWLength { return this.#_autoCommands ?? Options.#autoCommands; }
	set autoCommands(cmds: string | NamesWLength) {
		if (typeof cmds === 'object') {
			if (this instanceof Options) {
				this.#_autoCommands = { _maxLength: 0 };
				Object.assign(this.#_autoCommands, cmds);
			} else Object.assign(Options.#autoCommands, cmds);
			return;
		}

		if (!/^\s*[a-z]+(?:\s+[a-z]+)*\s*$/i.test(cmds)) {
			throw `"${cmds}" not a space-delimited list of only letters`;
		}
		const list = cmds.trim().split(/\s+/), dict: NamesWLength = { _maxLength: 0 };
		for (const cmd of list) {
			if (cmd.length < 2) throw `autocommand "${cmd}" not minimum length of 2`;
			if (cmd in BuiltInOpNames) throw `"${cmd}" is a built-in operator name`;
			dict[cmd] = 1;
			dict._maxLength = Math.max(dict._maxLength, cmd.length);
		}
		if (this instanceof Options) this.#_autoCommands = dict;
		else Options.#autoCommands = dict;
	}

	addAutoCommands(cmds: string | Array<string>) {
		if (!this.#_autoCommands) this.autoCommands = Options.#autoCommands;
		if (!this.#_autoCommands) throw 'autoCommands setter not working';
		const newCmds = cmds instanceof Array ? cmds.map((c) => c.trim()) : [cmds.trim()];
		for (const cmd of newCmds) {
			if (/\s/.test(cmd) || !/^[a-z]*$/i.test(cmd)) throw `${cmd} is not a valid autocommand name`;
			if (cmd.length < 2) throw `autocommand "${cmd}" not minimum length of 2`;
			if (cmd in BuiltInOpNames) throw `"${cmd}" is a built-in operator name`;
			this.#_autoCommands[cmd] = 1;
			this.#_autoCommands._maxLength = Math.max(this.#_autoCommands._maxLength, cmd.length);
		}
	}

	removeAutoCommands(cmds: string | Array<string>) {
		if (!this.#_autoCommands) this.autoCommands = Options.#autoCommands;
		if (!this.#_autoCommands) throw 'autoCommands setter not working';
		const removeCmds = cmds instanceof Array ? cmds.map((c) => c.trim()) : [cmds.trim()];
		for (const cmd of removeCmds) {
			delete this.#_autoCommands[cmd];
		}
		this.#_autoCommands._maxLength = Object.keys(this.#_autoCommands)
			.reduce((l, cmd) => cmd === '_maxLength' ? l : cmd.length > l ? cmd.length : l, 0);
	}

	// The set of operator names that MathQuill auto-unitalicizes.
	static #autoOperatorNames: NamesWLength = (() => {
		const ops: NamesWLength = { _maxLength: 9 };

		// Standard operators
		for (const op of [
			'arg', 'det', 'dim', 'exp', 'gcd', 'hom', 'ker', 'lg', 'lim',
			'max', 'min', 'sup', 'limsup', 'liminf', 'injlim', 'projlim', 'Pr'
		]) { ops[op] = 1; }

		// compat with some of the nonstandard LaTeX exported by MathQuill
		// before #247. None of these are real LaTeX commands so, seems safe
		for (const op of ['gcf', 'hcf', 'lcm', 'proj', 'span']) { ops[op] = 1; }

		return ops;
	})();
	#_autoOperatorNames?: NamesWLength;
	get autoOperatorNames(): NamesWLength { return this.#_autoOperatorNames ?? Options.#autoOperatorNames; }
	set autoOperatorNames(cmds: string | NamesWLength) {
		if (typeof cmds === 'object') {
			if (this instanceof Options) {
				this.#_autoOperatorNames = { _maxLength: 0 };
				Object.assign(this.#_autoOperatorNames, cmds);
			} else Object.assign(Options.#autoOperatorNames, cmds);
			return;
		}

		if (!/^\s*[a-z]+(?:\s+[a-z]+)*\s*$/i.test(cmds)) {
			throw `"${cmds}" not a space-delimited list of only letters`;
		}
		const list = cmds.trim().split(/\s+/), dict: NamesWLength = { _maxLength: 0 };
		for (const cmd of list) {
			if (cmd.length < 2) throw `"${cmd}" not minimum length of 2`;
			dict[cmd] = 1;
			dict._maxLength = Math.max(dict._maxLength, cmd.length);
		}
		if (this instanceof Options) this.#_autoOperatorNames = dict;
		else Options.#autoOperatorNames = dict;
	}

	addAutoOperatorNames(cmds: string | Array<string>) {
		if (!this.#_autoOperatorNames) this.autoOperatorNames = Options.#autoOperatorNames;
		if (!(this.#_autoOperatorNames)) throw 'autoOperatorNames setter not working';
		const newCmds = cmds instanceof Array ? cmds.map((c) => c.trim()) : [cmds.trim()];
		for (const cmd of newCmds) {
			if (/\s/.test(cmd) || !/^[a-z]*$/i.test(cmd)) throw `${cmd} is not a valid autocommand name`;
			if (cmd.length < 2) throw `"${cmd}" not minimum length of 2`;
			this.#_autoOperatorNames[cmd] = 1;
			this.#_autoOperatorNames._maxLength = Math.max(this.#_autoOperatorNames._maxLength, cmd.length);
		}
	}

	removeAutoOperatorNames(cmds: string | Array<string>) {
		if (!this.#_autoOperatorNames) this.autoOperatorNames = Options.#autoOperatorNames;
		if (!this.#_autoOperatorNames) throw 'autoOperatorNames setter not working';
		const removeCmds = cmds instanceof Array ? cmds.map((c) => c.trim()) : [cmds.trim()];
		for (const cmd of removeCmds) {
			delete this.#_autoOperatorNames[cmd];
		}
		this.#_autoOperatorNames._maxLength = Object.keys(this.#_autoOperatorNames)
			.reduce((l, cmd) => cmd === '_maxLength' ? l : cmd.length > l ? cmd.length : l, 0);
	}

	// Characters that "break out" of superscripts and subscripts
	static #charsThatBreakOutOfSupSub = '';
	#_charsThatBreakOutOfSupSub?: string;
	get charsThatBreakOutOfSupSub() { return this.#_charsThatBreakOutOfSupSub ?? Options.#charsThatBreakOutOfSupSub; }
	set charsThatBreakOutOfSupSub(charsThatBreakOutOfSupSub) {
		if (this instanceof Options) this.#_charsThatBreakOutOfSupSub = charsThatBreakOutOfSupSub;
		else Options.#charsThatBreakOutOfSupSub = charsThatBreakOutOfSupSub;
	}

	// Not fully implemented stateless clipboard
	static #statelessClipboard = false;
	#_statelessClipboard?: boolean;
	get statelessClipboard() { return this.#_statelessClipboard ?? Options.#statelessClipboard; }
	set statelessClipboard(statelessClipboard) {
		if (this instanceof Options) this.#_statelessClipboard = statelessClipboard;
		else Options.#statelessClipboard = statelessClipboard;
	}

	// If true then space will behave like tab escaping from the current block instead of inserting a space.
	static #spaceBehavesLikeTab = false;
	#_spaceBehavesLikeTab?: boolean;
	get spaceBehavesLikeTab() { return this.#_spaceBehavesLikeTab ?? Options.#spaceBehavesLikeTab; }
	set spaceBehavesLikeTab(spaceBehavesLikeTab) {
		if (this instanceof Options) this.#_spaceBehavesLikeTab = spaceBehavesLikeTab;
		else Options.#spaceBehavesLikeTab = spaceBehavesLikeTab;
	}

	// Set to 'up' or 'down' so that left and right go up or down (respectively) into commands.
	static #leftRightIntoCmdGoes: 'up' | 'down' | undefined = undefined;
	#_leftRightIntoCmdGoes?: 'up' | 'down';
	get leftRightIntoCmdGoes() { return this.#_leftRightIntoCmdGoes ?? Options.#leftRightIntoCmdGoes; }
	set leftRightIntoCmdGoes(updown: 'up' | 'down' | undefined) {
		if (updown && updown !== 'up' && updown !== 'down') {
			throw `"up" or "down" required for leftRightIntoCmdGoes option, got "${updown as string}"`;
		}
		if (this instanceof Options) this.#_leftRightIntoCmdGoes = updown;
		else Options.#leftRightIntoCmdGoes = updown;
	}

	// If true then you can type '[a,b)' and '(a,b]', but if you type '[x}' or '{x)', you'll get '[{x}]' or '{(x)}'
	// instead.
	static #restrictMismatchedBrackets = false;
	#_restrictMismatchedBrackets?: boolean;
	get restrictMismatchedBrackets() {
		return this.#_restrictMismatchedBrackets ?? Options.#restrictMismatchedBrackets;
	}
	set restrictMismatchedBrackets(restrictMismatchedBrackets) {
		if (this instanceof Options) this.#_restrictMismatchedBrackets = restrictMismatchedBrackets;
		else Options.#restrictMismatchedBrackets = restrictMismatchedBrackets;
	}

	// If true then when you type '\sum', '\prod', or '\coprod', the lower limit starts out with 'n='.
	static #sumStartsWithNEquals = false;
	#_sumStartsWithNEquals?: boolean;
	get sumStartsWithNEquals() { return this.#_sumStartsWithNEquals ?? Options.#sumStartsWithNEquals; }
	set sumStartsWithNEquals(sumStartsWithNEquals) {
		if (this instanceof Options) this.#_sumStartsWithNEquals = sumStartsWithNEquals;
		else Options.#sumStartsWithNEquals = sumStartsWithNEquals;
	}

	// Disables typing of superscripts and subscripts when there's nothing to the left of the cursor.
	static #supSubsRequireOperand = false;
	#_supSubsRequireOperand?: boolean;
	get supSubsRequireOperand() { return this.#_supSubsRequireOperand ?? Options.#supSubsRequireOperand; }
	set supSubsRequireOperand(supSubsRequireOperand) {
		if (this instanceof Options) this.#_supSubsRequireOperand = supSubsRequireOperand;
		else Options.#supSubsRequireOperand = supSubsRequireOperand;
	}

	// If true then the text output for an nth root will be 'x^(1/n)' instead of 'root(n,x)'.
	static #rootsAreExponents = false;
	#_rootsAreExponents?: boolean;
	get rootsAreExponents() { return this.#_rootsAreExponents ?? Options.#rootsAreExponents; }
	set rootsAreExponents(rootsAreExponents) {
		if (this instanceof Options) this.#_rootsAreExponents = rootsAreExponents;
		else Options.#rootsAreExponents = rootsAreExponents;
	}

	// If true then the text output for the logarithm with base b of x will be 'log(x)/log(b)'.  Otherwise the output
	// will be 'logb(b,x)'.  Note that this option does not affect base 10 output.  That is always "log10(x)".
	static #logsChangeBase = false;
	#_logsChangeBase?: boolean;
	get logsChangeBase() { return this.#_logsChangeBase ?? Options.#logsChangeBase; }
	set logsChangeBase(logsChangeBase) {
		if (this instanceof Options) this.#_logsChangeBase = logsChangeBase;
		else Options.#logsChangeBase = logsChangeBase;
	}

	// Specifies the maximum number of nested MathBlocks allowed.
	static #maxDepth?: number = undefined;
	#_maxDepth?: number;
	get maxDepth() { return this.#_maxDepth ?? Options.#maxDepth; }
	set maxDepth(maxDepth) {
		if (typeof maxDepth === 'number') {
			if (this instanceof Options) this.#_maxDepth = maxDepth;
			else Options.#maxDepth = maxDepth;
		}
	}

	// If true then a number typed after a letter will automatically be put into a subscript.
	static #autoSubscriptNumerals = false;
	#_autoSubscriptNumerals?: boolean;
	get autoSubscriptNumerals() { return this.#_autoSubscriptNumerals ?? Options.#autoSubscriptNumerals; }
	set autoSubscriptNumerals(autoSubscriptNumerals) {
		if (this instanceof Options) this.#_autoSubscriptNumerals = autoSubscriptNumerals;
		else Options.#autoSubscriptNumerals = autoSubscriptNumerals;
	}

	// If true then typing a slash gives the division symbol instead of a live fraction.
	static #typingSlashWritesDivisionSymbol = false;
	#_typingSlashWritesDivisionSymbol?: boolean;
	get typingSlashWritesDivisionSymbol() {
		return this.#_typingSlashWritesDivisionSymbol ?? Options.#typingSlashWritesDivisionSymbol;
	}
	set typingSlashWritesDivisionSymbol(typingSlashWritesDivisionSymbol) {
		if (this instanceof Options) this.#_typingSlashWritesDivisionSymbol = typingSlashWritesDivisionSymbol;
		else Options.#typingSlashWritesDivisionSymbol = typingSlashWritesDivisionSymbol;
	}

	// If true then typing an asterisk gives the times symbol.
	static #typingAsteriskWritesTimesSymbol = false;
	#_typingAsteriskWritesTimesSymbol?: boolean;
	get typingAsteriskWritesTimesSymbol() {
		return this.#_typingAsteriskWritesTimesSymbol ?? Options.#typingAsteriskWritesTimesSymbol;
	}
	set typingAsteriskWritesTimesSymbol(typingAsteriskWritesTimesSymbol) {
		if (this instanceof Options) this.#_typingAsteriskWritesTimesSymbol = typingAsteriskWritesTimesSymbol;
		else Options.#typingAsteriskWritesTimesSymbol = typingAsteriskWritesTimesSymbol;
	}

	handlers?: Handlers;

	substituteTextarea() {
		const textarea = document.createElement('textarea');
		textarea.setAttribute('autocapitalize', 'off');
		textarea.setAttribute('autocomplete', 'off');
		textarea.setAttribute('spellcheck', 'false');
		return textarea;
	}

	overridePaste?: (test: string) => void;
	overrideCut?: () => void;
	overrideCopy?: () => void;
	overrideTypedText?: (text: string) => void;
	overrideKeystroke?: (key: string, event: KeyboardEvent) => void;

	ignoreNextMousedown: (e?: MouseEvent) => boolean = () => { return false; };
}
