window.assert = (() => {
	class noop extends Error {
		constructor(...args) {
			super(...args);
			this.stack = [];
		}
	}

	class AssertionError extends noop {
		constructor(opts) {
			if (!opts) opts = {};
			super(`${opts.explanation ?? ''} ${opts.message ?? ''}`);
		}
	}

	const fail = (opts) => {
		if (typeof opts === 'string') opts = { message: opts };

		throw new AssertionError(opts);
	};

	return {
		ok: (thing, message) => {
			if (thing) return;

			fail({
				message: message,
				explanation: `expected ${thing} to be truthy`
			});
		},
		equal: (thing1, thing2, message) => {
			if (thing1 === thing2) return;

			fail({
				message: message,
				explanation: `expected (${thing1}) to equal (${thing2})`
			});
		},
		throws: (fn, message) => {
			try {
				fn();
			} catch (e) {
				return;
			}

			fail({
				message: message,
				explanation: `expected ${fn} to throw an error`
			});
		},
		fail: (message) => fail({ message: message, explanation: 'generic fail' })
	};
})();
