import { pray } from 'src/constants';

export class Parser {
	// The Parser object is a wrapper for a parser function.
	// Externally, you use one to parse a string by calling
	//   const result = SomeParser.parse('Me Me Me! Parse Me!');
	// You should never call the constructor, rather you should
	// construct your Parser from the base parsers and the
	// parser combinator methods.

	static parseError(stream, message) {
		if (stream) stream = `'${stream}'`;
		else stream = 'EOF';

		throw `Parse Error: ${message} at ${stream}`;
	}

	constructor(body) {
		this._ = body;
	}

	parse(stream) {
		return this.skip(Parser.eof)._(''+stream, (stream, result) => result, Parser.parseError);
	}

	// -*- primitive combinators -*- //
	or(alternative) {
		pray('or is passed a parser', alternative instanceof Parser);

		return new Parser((stream, onSuccess, onFailure) => {
			const failure = () => alternative._(stream, onSuccess, onFailure);

			return this._(stream, onSuccess, failure);
		});
	}

	then(next) {
		return new Parser((stream, onSuccess, onFailure) => {
			const success = (newStream, result) => {
				const nextParser = (next instanceof Parser ? next : next(result));
				pray('a parser is returned', nextParser instanceof Parser);
				return nextParser._(newStream, onSuccess, onFailure);
			};

			return this._(stream, success, onFailure);
		});
	}

	// -*- optimized iterative combinators -*- //
	many() {
		return new Parser((stream, onSuccess) => {
			const xs = [];

			const success = (newStream, x) => {
				stream = newStream;
				xs.push(x);
				return true;
			};

			const failure = () => false;

			while (this._(stream, success, failure));
			return onSuccess(stream, xs);
		});
	}

	times(min, max) {
		if (typeof max === 'undefined') max = min;

		return new Parser((stream, onSuccess, onFailure) => {
			const xs = [];
			let result = true;
			let failure;

			const success = (newStream, x) => {
				xs.push(x);
				stream = newStream;
				return true;
			};

			const firstFailure = (newStream, msg) => {
				failure = msg;
				stream = newStream;
				return false;
			};

			let i = 0;
			for (; i < min; ++i) {
				result = this._(stream, success, firstFailure);
				if (!result) return onFailure(stream, failure);
			}

			for (; i < max && result; ++i) {
				result = this._(stream, success, () => false);
			}

			return onSuccess(stream, xs);
		});
	}

	// -*- higher-level combinators -*- //
	result(res) { return this.then(Parser.succeed(res)); }
	atMost(n) { return this.times(0, n); }
	atLeast(n) {
		return this.times(n).then((start) => this.many().map((end) => start.concat(end)));
	}

	map(fn) {
		return this.then((result) => {
			if (fn.prototype && fn.prototype.constructor && fn.prototype.constructor.name) {
				return Parser.succeed(new fn(result));
			} else {
				return Parser.succeed(fn(result));
			}
		});
	}

	skip(two) {
		return this.then((result) => two.result(result));
	}

	// -*- primitive parsers -*- //
	static string(str) {
		const len = str.length;
		const expected = `expected '${str}'`;

		return new Parser((stream, onSuccess, onFailure) => {
			const head = stream.slice(0, len);

			if (head === str) {
				return onSuccess(stream.slice(len), head);
			}
			else {
				return onFailure(stream, expected);
			}
		});
	}

	static regex(re) {
		pray('regexp parser is anchored', re.toString().charAt(1) === '^');

		const expected = 'expected ' + re;

		return new Parser((stream, onSuccess, onFailure) => {
			const match = re.exec(stream);

			if (match) {
				const result = match[0];
				return onSuccess(stream.slice(result.length), result);
			}
			else {
				return onFailure(stream, expected);
			}
		});
	}

	static succeed(result) {
		return new Parser((stream, onSuccess) => onSuccess(stream, result));
	}

	static fail(msg) {
		return new Parser((stream, _, onFailure) => onFailure(stream, msg));
	}

	static letter = Parser.regex(/^[a-z]/i);
	static letters = Parser.regex(/^[a-z]*/i);
	static digit = Parser.regex(/^[0-9]/);
	static digits = Parser.regex(/^[0-9]*/);
	static whitespace = Parser.regex(/^\s+/);
	static optWhitespace = Parser.regex(/^\s*/);

	static any = new Parser((stream, onSuccess, onFailure) => {
		if (!stream) return onFailure(stream, 'expected any character');

		return onSuccess(stream.slice(1), stream.charAt(0));
	});

	static all = new Parser((stream, onSuccess) => onSuccess('', stream));

	static eof = new Parser((stream, onSuccess, onFailure) => {
		if (stream) return onFailure(stream, 'expected EOF');

		return onSuccess(stream, stream);
	});
}
