class AssertionError extends Error {
	constructor(opts?: { message?: string; explanation?: string }) {
		if (!opts) opts = {};
		super(`${opts.explanation ?? ''} ${opts.message ?? ''}`);
	}
}

const fail = (opts?: { message?: string; explanation?: string }) => {
	throw new AssertionError(opts);
};

export const assert = {
	ok(thing: unknown, message?: string) {
		if (thing) return;
		// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
		fail({ message, explanation: `expected ${thing} to be truthy` });
	},
	equal<T>(thing1: T, thing2: T, message?: string) {
		if (thing1 === thing2) return;
		// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
		fail({ message, explanation: `expected (${thing1}) to equal (${thing2})` });
	},
	throws(fn: (...args: unknown[]) => unknown, message?: string) {
		try {
			fn();
		} catch {
			return;
		}
		fail({ message, explanation: `expected ${fn.toString()} to throw an error` });
	},
	fail(message: string) {
		fail({ message, explanation: 'generic fail' });
	}
};
