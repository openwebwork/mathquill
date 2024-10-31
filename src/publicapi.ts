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

const isBrowser = Object.getPrototypeOf(Object.getPrototypeOf(globalThis)) !== Object.prototype;

interface MQApi {
	(el?: HTMLElement): AbstractMathQuill | undefined;
	saneKeyboardEvents: typeof saneKeyboardEvents;
	config(opts: InputOptions): MQApi;
	registerEmbed(name: string, options: (data: string) => EmbedOptions): void;
	StaticMath: {
		(el?: null): undefined;
		(el: HTMLElement, opts?: InputOptions): StaticMath;
	};
	MathField: {
		(el?: null): undefined;
		(el: HTMLElement, opts?: InputOptions): MathField;
	};
	InnerMathField: {
		(el?: null): undefined;
		(el: HTMLElement, opts?: InputOptions): InnerMathField;
	};
	TextField: {
		(el?: null): undefined;
		(el: HTMLElement, opts?: InputOptions): TextField;
	};
}

interface MathQuill {
	origMathQuill: MathQuill | undefined;
	VERSION: string;
	getInterface(): MQApi;
	noConflict(): MathQuill;
}

// globally exported API object
const mathQuill: MathQuill = {
	origMathQuill: isBrowser ? window.MathQuill : undefined,
	VERSION: '0.0.1',

	getInterface() {
		// Function that takes an HTML element and, if it's the root HTML element of a
		// static math or math or text field, returns an API object for it (else, undefined).
		//   const mathfield = MQ.MathField(mathFieldSpan);
		//   assert(MQ(mathFieldSpan).id === mathfield.id);
		//   assert(MQ(mathFieldSpan).id === MQ(mathFieldSpan).id);
		const MQ = (el?: HTMLElement) => {
			if (!(el instanceof HTMLElement)) return;
			const blockId = el.querySelector('.mq-root-block')?.getAttribute(mqBlockId) ?? false;
			const ctrlr = blockId ? TNode.byId.get(parseInt(blockId))?.controller : undefined;
			return ctrlr?.apiClass;
		};

		MQ.saneKeyboardEvents = saneKeyboardEvents;

		MQ.config = (opts: InputOptions): MQApi => {
			Options.config(Options.prototype, opts);
			return MQ as MQApi;
		};

		MQ.registerEmbed = (name: string, options: (data: string) => EmbedOptions) => {
			if (!/^[a-z][a-z0-9]*$/i.test(name)) {
				throw new Error('Embed name must start with letter and be only letters and digits');
			}
			EMBEDS[name] = options;
		};

		// Export the API functions that MathQuill-ify an HTML element into API objects
		// of each class. If the element had already been MathQuill-ified but into a
		// different kind (or it's not an HTML element), return undefined.
		const createEntrypoint = <MQClass extends AbstractMathQuillConstructor>(
			kind: keyof Pick<MQApi, 'StaticMath' | 'MathField' | 'InnerMathField' | 'TextField'>,
			APIClass: MQClass
		) => {
			function mqEntrypoint(el?: null): undefined;
			function mqEntrypoint(el: HTMLElement, opts?: InputOptions): InstanceType<MQClass>;
			function mqEntrypoint(el?: HTMLElement | null, opts?: InputOptions) {
				if (!(el instanceof HTMLElement)) return;
				const mq = MQ(el);
				if (!(el instanceof HTMLElement) || mq instanceof APIClass) return mq;
				const ctrlr = new Controller(new APIClass.RootBlock(), el, new Options());
				ctrlr.KIND_OF_MQ = kind;
				return new APIClass(ctrlr).config(opts ?? {}).__mathquillify();
			}
			return mqEntrypoint;
		};

		MQ.StaticMath = createEntrypoint('StaticMath', StaticMath);
		MQ.StaticMath.prototype = StaticMath.prototype;
		MQ.MathField = createEntrypoint('MathField', MathField);
		MQ.MathField.prototype = MathField.prototype;
		MQ.InnerMathField = createEntrypoint('InnerMathField', InnerMathField);
		MQ.InnerMathField.prototype = InnerMathField.prototype;
		MQ.TextField = createEntrypoint('TextField', TextField);
		MQ.TextField.prototype = TextField.prototype;

		return MQ as MQApi;
	},

	noConflict() {
		if (!isBrowser) return mathQuill;
		window.MathQuill = this.origMathQuill;
		return mathQuill;
	}
};

export default mathQuill;
