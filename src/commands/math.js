import { noop } from 'src/constants';
import { AbstractMathQuill, EditableField } from 'src/abstractFields';
import { RootMathBlock, MathBlock } from 'commands/mathBlock';

export class StaticMath extends AbstractMathQuill {
	static RootBlock = MathBlock;

	constructor(...args) {
		super(...args);

		this.__controller.root.postOrder(
			'registerInnerField', this.innerFields = [], InnerMathField);
	}

	__mathquillify(opts) {
		this.config(opts);
		super.__mathquillify('mq-math-mode');
		if (this.__options.mouseEvents) {
			this.__controller.delegateMouseEvents();
			this.__controller.staticMathTextareaEvents();
		}
		return this;
	}

	latex(...args) {
		const returned = super.latex(...args);
		if (args.length > 0) {
			this.__controller.root.postOrder(
				'registerInnerField', this.innerFields = [], InnerMathField);
		}
		return returned;
	}
}

export class MathField extends EditableField {
	static RootBlock = RootMathBlock;

	__mathquillify(opts) {
		this.config(opts);

		// Disable reflow during initialization.
		const reflowSave = this.__controller.root.reflow;
		this.__controller.root.reflow = noop;

		super.__mathquillify('mq-editable-field mq-math-mode');

		if (reflowSave) this.__controller.root.reflow = reflowSave;
		else delete this.__controller.root.reflow;

		return this;
	}
}

export class InnerMathField extends MathField {
	makeStatic() {
		this.__controller.editable = false;
		this.__controller.root.blur();
		this.__controller.unbindEditablesEvents();
		this.__controller.container.removeClass('mq-editable-field');
	};

	makeEditable() {
		this.__controller.editable = true;
		this.__controller.editablesTextareaEvents();
		this.__controller.cursor.insAtRightEnd(this.__controller.root);
		this.__controller.container.addClass('mq-editable-field');
	}
}
