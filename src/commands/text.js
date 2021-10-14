// Abstract classes of text blocks

import { EditableField } from 'src/abstractFields';
import { RootTextBlock } from 'commands/textBlock';

export class TextField extends EditableField {
	static RootBlock = RootTextBlock;

	__mathquillify() {
		return super.__mathquillify('mq-editable-field mq-text-mode');
	}

	latex(latex) {
		if (arguments.length > 0) {
			this.__controller.renderLatexText(latex);
			if (this.__controller.blurred) this.__controller.cursor.hide().parent.blur();
			return this;
		}
		return this.__controller.exportLatex();
	}
}
