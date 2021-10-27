import { pray } from 'src/constants';

type SuccessOrFailure = (stream: string, result: any) => any

type ParserBody = (
	stream: string,
	success?: SuccessOrFailure,
	failure?: SuccessOrFailure
) => any;

export class Parser {
	// The Parser object is a wrapper for a parser function.
	// Externally, you use one to parse a string by calling
	//   const result = SomeParser.parse('Me Me Me! Parse Me!');
	// You should never call the constructor, rather you should
	// construct your Parser from the base parsers and the
	// parser combinator methods.

	_: ParserBody;

	static parseError(stream: string, message: string) {
		if (stream) stream = `'${stream}'`;
		else stream = 'EOF';

		throw `Parse Error: ${message} at ${stream}`;
	}

	constructor(body: ParserBody) {
		this._ = body;
	}

	parse(stream?: string | number | boolean | object) {
		// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
		return this.skip(Parser.eof)._(`${stream}`, (stream, result) => result, Parser.parseError);
	}

	// -*- primitive combinators -*- //
	or(alternative?: Parser) {
		pray('or is passed a parser', alternative instanceof Parser);

		return new Parser((stream, onSuccess, onFailure) => {
			const failure = () => alternative?._(stream, onSuccess, onFailure);

			return this._(stream, onSuccess, failure);
		});
	}

	then(next: Parser | ((result: any) => Parser)) {
		return new Parser((stream, onSuccess, onFailure) => {
			const success: SuccessOrFailure = (newStream, result) => {
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
			const xs: Array<string> = [];

			const success: SuccessOrFailure = (newStream, x) => {
				stream = newStream;
				xs.push(x);
				return true;
			};

			const failure: SuccessOrFailure = () => false;

			while (this._(stream, success, failure));
			return onSuccess?.(stream, xs);
		});
	}

	times(min: number, max: number = min) {
		return new Parser((stream, onSuccess, onFailure) => {
			const xs: Array<string> = [];
			let result = true;
			let failure;

			const success: SuccessOrFailure = (newStream, x) => {
				xs.push(x);
				stream = newStream;
				return true;
			};

			const firstFailure: SuccessOrFailure = (newStream, msg) => {
				failure = msg;
				stream = newStream;
				return false;
			};

			let i = 0;
			for (; i < min; ++i) {
				result = this._(stream, success, firstFailure);
				if (!result) return onFailure?.(stream, failure);
			}

			for (; i < max && result; ++i) {
				result = this._(stream, success, () => false);
			}

			return onSuccess?.(stream, xs);
		});
	}

	// -*- higher-level combinators -*- //
	result(res: any) { return this.then(Parser.succeed(res)); }
	atMost(n: number) { return this.times(0, n); }
	atLeast(n: number) {
		return this.times(n).then((start: string) => this.many().map((end: string) => start.concat(end)));
	}

	map(fn: any) {
		return this.then((result: string) => {
			if (fn.prototype && fn.prototype.constructor && fn.prototype.constructor.name) {
				return Parser.succeed(new fn(result));
			} else {
				return Parser.succeed(fn(result));
			}
		});
	}

	skip(two: any) {
		return this.then((result) => two.result(result));
	}

	// -*- primitive parsers -*- //
	static string(str: string) {
		const len = str.length;
		const expected = `expected '${str}'`;

		return new Parser((stream, onSuccess, onFailure) => {
			const head = stream.slice(0, len);

			if (head === str) {
				return onSuccess?.(stream.slice(len), head);
			}
			else {
				return onFailure?.(stream, expected);
			}
		});
	}

	static regex(re: RegExp) {
		pray('regexp parser is anchored', re.toString().charAt(1) === '^');

		const expected = `expected ${re.toString()}`;

		return new Parser((stream, onSuccess, onFailure) => {
			const match = re.exec(stream);

			if (match) {
				const result = match[0];
				return onSuccess?.(stream.slice(result.length), result);
			}
			else {
				return onFailure?.(stream, expected);
			}
		});
	}

	static succeed(result: any) {
		return new Parser((stream, onSuccess) => onSuccess?.(stream, result));
	}

	static fail(msg: string) {
		return new Parser((stream, _, onFailure) => onFailure?.(stream, msg));
	}

	static letter = Parser.regex(/^[a-z]/i);
	static letters = Parser.regex(/^[a-z]*/i);
	static digit = Parser.regex(/^[0-9]/);
	static digits = Parser.regex(/^[0-9]*/);
	static whitespace = Parser.regex(/^\s+/);
	static optWhitespace = Parser.regex(/^\s*/);

	static any = new Parser((stream, onSuccess, onFailure) => {
		if (!stream) return onFailure?.(stream, 'expected any character');

		return onSuccess?.(stream.slice(1), stream.charAt(0));
	});

	static all = new Parser((stream, onSuccess) => onSuccess?.('', stream));

	static eof = new Parser((stream, onSuccess, onFailure) => {
		if (stream) return onFailure?.(stream, 'expected EOF');

		return onSuccess?.(stream, stream);
	});
}
