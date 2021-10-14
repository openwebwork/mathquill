// The block for abstract classes of text blocks

import { RootMathBlock } from 'commands/mathBlock';
import { VanillaSymbol } from 'commands/mathElements';

export class RootTextBlock extends RootMathBlock {
	keystroke(key, ...args) {
		if (key === 'Spacebar' || key === 'Shift-Spacebar') return;
		return super.keystroke(key, ...args);
	}

	write(cursor, ch) {
		cursor.show().deleteSelection();
		if (ch === '$')
			new RootMathCommand(cursor).createLeftOf(cursor);
		else {
			let html;
			if (ch === '<') html = '&lt;';
			else if (ch === '>') html = '&gt;';
			new VanillaSymbol(ch, html).createLeftOf(cursor);
		}
	}
}
