// Options for the API objects

class Options {
	// Default settings

	// Wether mouse events are active for StaticMath blocks 
	static mouseEvents = true;
	// The set of commands that are automatically typeset without typing a preceding backslash.
	static autoCommands = { _maxLength: 0 };
	// The set of operator names that MathQuill auto-unitalicizes.
	static autoOperatorNames = (() => {
		const ops = {};

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

		ops._maxLength = 9;

		return ops;
	})();
	// Characters that "break out" of superscripts and subscripts
	static charsThatBreakOutOfSupSub = '';
	// Not fully implemented stateless clipboard
	static statelessClipboard = false;
	// If true then space will behave like tab escaping from the current block instead of inserting a space.
	static spaceBehavesLikeTab = false;
	// Set to 'up' or 'down' so that left and right go up or down (respectively) into commands.
	static leftRightIntoCmdGoes = undefined;
	// If true then you can type '[a,b)' and '(a,b]', but if you type '[x}' or '{x)', you'll get '[{x}]' or '{(x)}' instead.
	static restrictMismatchedBrackets = false;
	// If true then when you type '\sum', '\prod', or '\coprod', the lower limit starts out with 'n='.
	static sumStartsWithNEquals = false;
	// Disables typing of superscripts and subscripts when there's nothing to the left of the cursor.
	static supSubsRequireOperand = false;
	// If true then the text output for an nth root will be 'x^(1/n)' instead of 'root(n,x)'.
	static rootsAreExponents = false;
	// Specifies the maximum number of nested MathBlocks allowed.
	static maxDepth = undefined;
	// If true then a number typed after a letter will automatically be put into a subscript.
	static autoSubscriptNumerals = false;

	// Getters and setters
	get mouseEvents() { return this._mouseEvents ?? Options.mouseEvents; }
	set mouseEvents(mouseEvents) { this._mouseEvents = mouseEvents; }
	get autoCommands() { return this._autoCommands ?? Options.autoCommands; }
	set autoCommands(cmds) {
		if (!/^[a-z]+(?: [a-z]+)*$/i.test(cmds)) {
			throw `"${cmds}" not a space-delimited list of only letters`;
		}
		const list = cmds.split(' ');
		this._autoCommands = { _maxLength: 0 };
		for (const cmd of list) {
			if (cmd.length < 2) throw `autocommand "${cmd}" not minimum length of 2`;
			if (LatexCmds[cmd] === OperatorName) throw `"${cmd}" is a built-in operator name`;
			this._autoCommands[cmd] = 1;
			this._autoCommands._maxLength = Math.max(this._autoCommands._maxLength, cmd.length);
		}
	}
	get autoOperatorNames() { return this._autoOperatorNames ?? Options.autoOperatorNames; }
	set autoOperatorNames(cmds) {
		if (!/^[a-z]+(?: [a-z]+)*$/i.test(cmds)) {
			throw `"${cmds}" not a space-delimited list of only letters`;
		}
		// FIXME: The intermediate dict variable should not be needed, but if this._autoOperatorNames is used in the same way
		// that this._autoCommands is used above, some unit tests fail for some illogical reason.
		const list = cmds.split(' '), dict = { _maxLength: 0 };
		for (const cmd of list) {
			if (cmd.length < 2) throw `"${cmd}" not minimum length of 2`;
			dict[cmd] = 1;
			dict._maxLength = Math.max(dict._maxLength, cmd.length);
		}
		this._autoOperatorNames = dict;
	}
	get charsThatBreakOutOfSupSub() { return this._charsThatBreakOutOfSupSub ?? Options.charsThatBreakOutOfSupSub; }
	set charsThatBreakOutOfSupSub(charsThatBreakOutOfSupSub) { this._charsThatBreakOutOfSupSub = charsThatBreakOutOfSupSub; }
	get statelessClipboard() { return this._statelessClipboard ?? Options.statelessClipboard; }
	set statelessClipboard(statelessClipboard) { this._statelessClipboard = statelessClipboard; }
	get spaceBehavesLikeTab() { return this._spaceBehavesLikeTab ?? Options.spaceBehavesLikeTab; }
	set spaceBehavesLikeTab(spaceBehavesLikeTab) { this._spaceBehavesLikeTab = spaceBehavesLikeTab; }
	get leftRightIntoCmdGoes() { return this._leftRightIntoCmdGoes ?? Options.leftRightIntoCmdGoes; }
	set leftRightIntoCmdGoes(updown) {
		if (updown && updown !== 'up' && updown !== 'down') {
			throw `"up" or "down" required for leftRightIntoCmdGoes option, got "${updown}"`;
		}
		this._leftRightIntoCmdGoes = updown;
	}
	get restrictMismatchedBrackets() { return this._restrictMismatchedBrackes ?? Options.restrictMismatchedBrackets; }
	set restrictMismatchedBrackets(restrictMismatchedBrackets) { this._restrictMismatchedBrackes = restrictMismatchedBrackets; }
	get sumStartsWithNEquals() { return this._sumStartsWithNEquals ?? Options.sumStartsWithNEquals; }
	set sumStartsWithNEquals(sumStartsWithNEquals) { this._sumStartsWithNEquals = sumStartsWithNEquals; }
	get supSubsRequireOperand() { return this._supSubsRequireOperand ?? Options.supSubsRequireOperand; }
	set supSubsRequireOperand(supSubsRequireOperand) { this._supSubsRequireOperand = supSubsRequireOperand; }
	get rootsAreExponents() { return this._rootsAreExponents ?? Options.rootsAreExponents; }
	set rootsAreExponents(rootsAreExponents) { this._rootsAreExponents = rootsAreExponents; }
	get maxDepth() { return this._maxDepth ?? Options.maxDepth; }
	set maxDepth(maxDepth) { if (typeof maxDepth === 'number') this._maxDepth = maxDepth; }
	get autoSubscriptNumerals() { return this._autoSubscriptNumerals ?? Options.autoSubscriptNumerals; }
	set autoSubscriptNumerals(autoSubscriptNumerals) { this._autoSubscriptNumerals = autoSubscriptNumerals; }

	substituteTextarea() {
		return $('<textarea autocapitalize=off autocomplete=off autocorrect=off ' +
			'spellcheck=false x-palm-disable-ste-all=true />')[0];
	}

	substituteKeyboardEvents(el, handlers) {
		return saneKeyboardEvents(el, handlers);
	}

	ignoreNextMousedown(e) {}
}
