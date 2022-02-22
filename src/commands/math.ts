import { noop } from 'src/constants';
import type { Controller } from 'src/controller';
import { AbstractMathQuill, EditableField } from 'src/abstractFields';
import { RootMathBlock, MathBlock } from 'commands/mathBlock';

interface NamedObject {
	name: string
}

class Store<T extends NamedObject> {
	[key: number]: T;

	push(value: T) {
		this[Object.keys(this).length] = value;
	}

	get length() {
		return Object.keys(this).length;
	}

	get(indexName: string) {
		for (const strIndex of Object.keys(this)) {
			const index = parseInt(strIndex);
			if (this[index].name === indexName) return this[index];
		}
	}
}

export type InnerMathFieldStore = Store<InnerMathField>;

export class StaticMath extends AbstractMathQuill {
	static RootBlock = MathBlock;

	innerFields: InnerMathFieldStore;

	constructor(ctrlr: Controller) {
		super(ctrlr);

		this.__controller.root.postOrder('registerInnerField',
			this.innerFields = new Store<InnerMathField>(), InnerMathField);
	}

	__mathquillify() {
		super.__mathquillify('mq-math-mode');
		if (this.__options.mouseEvents) {
			this.__controller.delegateMouseEvents();
			this.__controller.staticMathTextareaEvents();
		}
		return this;
	}

	latex(latex?: string) {
		const returned = super.latex(latex);
		if (typeof latex !== 'undefined') {
			this.__controller.root.postOrder('registerInnerField',
				this.innerFields = new Store<InnerMathField>(), InnerMathField);
		}
		return returned;
	}
}

export class MathField extends EditableField {
	static RootBlock = RootMathBlock;

	__mathquillify() {
		// Disable reflow during initialization.
		const reflowSave = this.__controller.root.reflow;
		this.__controller.root.reflow = noop;

		super.__mathquillify('mq-editable-field', 'mq-math-mode');

		if (reflowSave) this.__controller.root.reflow = reflowSave;
		else delete this.__controller.root.reflow;

		return this;
	}
}

export class InnerMathField extends MathField {
	name = '';

	makeStatic() {
		this.__controller.editable = false;
		this.__controller.root.blur();
		this.__controller.unbindEditablesEvents();
		this.__controller.container.classList.remove('mq-editable-field');
	}

	makeEditable() {
		this.__controller.editable = true;
		this.__controller.editablesTextareaEvents();
		this.__controller.cursor.insAtRightEnd(this.__controller.root);
		this.__controller.container.classList.add('mq-editable-field');
	}
}
