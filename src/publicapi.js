// The publicly exposed MathQuill API.

const API = {}, EMBEDS = {};

// globally exported API object
class MathQuill {
	static origMathQuill = window.MathQuill;
	static VERSION = "{VERSION}";

	static getInterface() {
		const APIClasses = {};

		// Function that takes an HTML element and, if it's the root HTML element of a
		// static math or math or text field, returns an API object for it (else, null).
		//   const mathfield = MQ.MathField(mathFieldSpan);
		//   assert(MQ(mathFieldSpan).id === mathfield.id);
		//   assert(MQ(mathFieldSpan).id === MQ(mathFieldSpan).id);
		function MQ(el) {
			if (!(el instanceof HTMLElement)) return;
			const blockId = $(el).children('.mq-root-block').attr(mqBlockId);
			const ctrlr = blockId && Node.byId[blockId].controller;
			return ctrlr?.apiClass;
		};

		MQ.L = L;
		MQ.R = R;
		MQ.saneKeyboardEvents = saneKeyboardEvents;

		MQ.config = (opts) => { Options.config(Options.prototype, opts); return MQ; };

		MQ.registerEmbed = (name, options) => {
			if (!/^[a-z][a-z0-9]*$/i.test(name)) {
				throw 'Embed name must start with letter and be only letters and digits';
			}
			EMBEDS[name] = options;
		};

		APIClasses.AbstractMathQuill = AbstractMathQuill;
		APIClasses.EditableField = EditableField;

		// Export the API functions that MathQuill-ify an HTML element into API objects
		// of each class. If the element had already been MathQuill-ified but into a
		// different kind (or it's not an HTML element), return null.
		for (const [kind, defAPIClass] of Object.entries(API)) {
			APIClasses[kind] = defAPIClass(APIClasses);
			MQ[kind] = function(el, opts) {
				const mq = MQ(el);
				if (mq instanceof APIClasses[kind] || !(el instanceof HTMLElement)) return mq;
				const ctrlr = new Controller(new APIClasses[kind].RootBlock, $(el), new Options);
				ctrlr.KIND_OF_MQ = kind;
				return new APIClasses[kind](ctrlr).__mathquillify(opts);
			};
			MQ[kind].prototype = APIClasses[kind].prototype;
		}

		return MQ;
	}

	static noConflict() {
		window.MathQuill = this.origMathQuill;
		return MathQuill;
	}
}

window.MathQuill = MathQuill;
