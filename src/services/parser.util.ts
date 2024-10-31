type ParserBody = <SR, FR>(
	stream: string,
	success: (stream: string, ...args: any[]) => SR,
	failure: (stream: string, ...args: any[]) => FR
) => SR | FR;

export class Parser {
	// The Parser object is a wrapper for a parser function.
	// Externally, you use one to parse a string by calling
	//   const result = SomeParser.parse('Me Me Me! Parse Me!');
	// You should never call the constructor, rather you should
	// construct your Parser from the base parsers and the
	// parser combinator methods.

	_: ParserBody;

	constructor(body: ParserBody) {
		this._ = body;
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	parse<T>(stream?: string | number | boolean | object) {
		return this.skip(Parser.eof)._(
			// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
			`${stream}`,
			(_stream, result: T) => result,
			(stream: string, message: string) => {
				throw `Parse Error: ${message} at ${stream || 'EOF'}`;
			}
		);
	}

	// Primitive combinators
	or(alternative: Parser) {
		if (!(alternative instanceof Parser)) throw new Error('or is passed a parser');

		return new Parser((stream, onSuccess, onFailure) =>
			this._(stream, onSuccess, () => alternative._(stream, onSuccess, onFailure))
		);
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	then<T>(next: Parser | ((result: T) => Parser) | (() => Parser)) {
		return new Parser((stream, onSuccess, onFailure) =>
			this._(
				stream,
				(newStream, result: T) => {
					const nextParser =
						next instanceof Parser ? next : typeof next === 'function' ? next(result) : undefined;
					if (!(nextParser instanceof Parser)) throw new Error('a parser is returned');
					return nextParser._(newStream, onSuccess, onFailure);
				},
				onFailure
			)
		);
	}

	// Optimized iterative combinators
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	many<T>() {
		return new Parser((stream, onSuccess) => {
			const xs: T[] = [];

			while (
				this._(
					stream,
					(newStream, x: T) => {
						stream = newStream;
						xs.push(x);
						return true;
					},
					() => false
				)
			);

			return onSuccess(stream, xs);
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	times<T>(min: number, max: number = min) {
		return new Parser((stream, onSuccess, onFailure) => {
			const xs: T[] = [];
			let result = true;

			for (let i = 0; i < max && result; ++i) {
				let failure;
				result = this._(
					stream,
					(newStream, x: T) => {
						xs.push(x);
						stream = newStream;
						return true;
					},
					(newStream, msg: T) => {
						failure = msg;
						stream = newStream;
						return false;
					}
				);
				if (i < min && !result) return onFailure(stream, failure);
			}

			return onSuccess(stream, xs);
		});
	}

	// Higher-level combinators
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	result<T>(res: T) {
		return this.then(Parser.succeed(res));
	}
	atMost(n: number) {
		return this.times(0, n);
	}
	atLeast(n: number) {
		return this.times(n).then((start: string) => this.many().map((end: string) => start.concat(end)));
	}

	map<R, T>(fn: ((result: R) => T) | (new (arg: R) => T)) {
		return this.then((result: R) => {
			if (typeof fn === 'function' && /^\s*class\s+/.test(fn.toString())) {
				return Parser.succeed(new (fn as new (arg: R) => T)(result));
			} else if (typeof fn === 'function') {
				return Parser.succeed((fn as (result: R) => T)(result));
			}
			return Parser.fail('Invalid map function');
		});
	}

	skip(two: Parser) {
		return this.then((result) => two.result(result));
	}

	// Primitive parsers
	static string(str: string) {
		return new Parser((stream, onSuccess, onFailure) => {
			const head = stream.slice(0, str.length);

			if (head === str) return onSuccess(stream.slice(str.length), head);
			else return onFailure(stream, `expected '${str}'`);
		});
	}

	static regex(re: RegExp) {
		if (re.toString().charAt(1) !== '^') throw new Error('regexp parser is anchored');

		return new Parser((stream, onSuccess, onFailure) => {
			const match = re.exec(stream);

			if (match) return onSuccess(stream.slice(match[0].length), match[0]);
			else return onFailure(stream, `expected ${re.toString()}`);
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	static succeed<T>(result?: T) {
		return new Parser((stream, onSuccess) => onSuccess(stream, result));
	}

	static fail(msg?: string) {
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
