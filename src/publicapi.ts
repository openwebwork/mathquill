// The publicly exposed MathQuill API.

import type { EmbedOptions } from 'src/constants';
import { mqBlockId, EMBEDS } from 'src/constants';
import type { InputOptions } from 'src/options';
import { Options } from 'src/options';
import { TNode } from 'tree/node';
import { saneKeyboardEvents } from 'services/saneKeyboardEvents.util';
import { Controller } from 'src/controller';
import type { AbstractMathQuillConstructor, AbstractMathQuill } from 'src/abstractFields';
import { StaticMath, MathField, InnerMathField } from 'commands/math';
import { TextField } from 'commands/text';

// These files need to be imported to construct the library of commands.
import 'commands/math/commands';
import 'commands/math/LatexCommandInput';
import 'commands/math/basicSymbols';
import 'commands/math/advancedSymbols';

declare global {
	interface Window {
		MathQuill?: MathQuill;
	}
}

interface MQApi {
	(el: unknown): AbstractMathQuill | void;
	saneKeyboardEvents: typeof saneKeyboardEvents;
	config: (opts: InputOptions) => MQApi;
	registerEmbed: (name: string, options: (data: string) => EmbedOptions) => void;
	StaticMath: (el: unknown, opts: InputOptions) => AbstractMathQuill | void;
	MathField: (el: unknown, opts: InputOptions) => AbstractMathQuill | void;
	InnerMathField: (el: unknown, opts: InputOptions) => AbstractMathQuill | void;
	TextField: (el: unknown, opts: InputOptions) => AbstractMathQuill | void;
}

// globally exported API object
export default class MathQuill {
	static origMathQuill?: MathQuill = window.MathQuill;
	static VERSION?: string;

	static getInterface() {
		const APIClasses: { [key: string]: AbstractMathQuillConstructor } = {};

		// Function that takes an HTML element and, if it's the root HTML element of a
		// static math or math or text field, returns an API object for it (else, undefined).
		//   const mathfield = MQ.MathField(mathFieldSpan);
		//   assert(MQ(mathFieldSpan).id === mathfield.id);
		//   assert(MQ(mathFieldSpan).id === MQ(mathFieldSpan).id);
		const MQ = (el: unknown) => {
			if (!(el instanceof HTMLElement)) return;
			const blockId = el.querySelector('.mq-root-block')?.getAttribute(mqBlockId) ?? false;
			const ctrlr = blockId ? TNode.byId[parseInt(blockId)].controller : undefined;
			return ctrlr?.apiClass;
		};

		MQ.saneKeyboardEvents = saneKeyboardEvents;

		MQ.config = (opts: InputOptions) => { Options.config(Options.prototype, opts); return MQ; };

		MQ.registerEmbed = (name: string, options: (data: string) => EmbedOptions) => {
			if (!/^[a-z][a-z0-9]*$/i.test(name)) {
				throw 'Embed name must start with letter and be only letters and digits';
			}
			EMBEDS[name] = options;
		};

		// Export the API functions that MathQuill-ify an HTML element into API objects
		// of each class. If the element had already been MathQuill-ified but into a
		// different kind (or it's not an HTML element), return undefined.
		for (const [kind, APIClass] of Object.entries({ StaticMath, MathField, InnerMathField, TextField })) {
			APIClasses[kind] = APIClass;
			(MQ as MQApi)[kind as keyof Pick<MQApi, 'StaticMath' | 'MathField' | 'InnerMathField' | 'TextField'>] =
				(el: unknown, opts: InputOptions) => {
					const mq = MQ(el);
					if (mq instanceof APIClasses[kind] || !(el instanceof HTMLElement)) return mq;
					const ctrlr = new Controller(new APIClasses[kind].RootBlock, el, new Options);
					ctrlr.KIND_OF_MQ = kind;
					return new APIClasses[kind](ctrlr).config(opts).__mathquillify();
				};
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			(MQ as MQApi)[kind as keyof MQApi].prototype = APIClasses[kind].prototype;
		}

		return MQ as MQApi;
	}

	static noConflict() {
		window.MathQuill = this.origMathQuill;
		return MathQuill;
	}
}
