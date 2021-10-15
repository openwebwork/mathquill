// The publicly exposed MathQuill API.

import { jQuery, mqBlockId, L, R, EMBEDS } from 'src/constants';
import { Options } from 'src/options';
import { Node } from 'tree/node';
import { saneKeyboardEvents } from 'services/saneKeyboardEvents.util';
import { Controller } from 'src/controller';
import { AbstractMathQuill, EditableField } from 'src/abstractFields';
import { StaticMath, MathField, InnerMathField } from 'commands/math';
import { TextField } from 'commands/text';

// These files need to be imported to construct the library of commands.
import 'commands/math/commands';
import 'commands/math/LatexCommandInput';
import 'commands/math/basicSymbols';
import 'commands/math/advancedSymbols';

// globally exported API object
export default class MathQuill {
	static origMathQuill = window.MathQuill;
	static VERSION = VERSION;

	static getInterface() {
		const APIClasses = {};

		// Function that takes an HTML element and, if it's the root HTML element of a
		// static math or math or text field, returns an API object for it (else, null).
		//   const mathfield = MQ.MathField(mathFieldSpan);
		//   assert(MQ(mathFieldSpan).id === mathfield.id);
		//   assert(MQ(mathFieldSpan).id === MQ(mathFieldSpan).id);
		function MQ(el) {
			if (!(el instanceof HTMLElement)) return;
			const blockId = jQuery(el).children('.mq-root-block').attr(mqBlockId);
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
		for (const [kind, APIClass] of Object.entries({ StaticMath, MathField, InnerMathField, TextField })) {
			APIClasses[kind] = APIClass;
			MQ[kind] = function(el, opts) {
				const mq = MQ(el);
				if (mq instanceof APIClasses[kind] || !(el instanceof HTMLElement)) return mq;
				const ctrlr = new Controller(new APIClasses[kind].RootBlock, jQuery(el), new Options);
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
