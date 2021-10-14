// Latex Controller Extension

import { L, R } from 'src/constants';
import { Parser } from 'services/parser.util';
import { VanillaSymbol, latexMathParser } from 'commands/mathElements';
import { RootMathCommand } from 'commands/textElements';

export const LatexControllerExtension = (base) => class extends base {
	exportLatex() {
		return this.root.latex().replace(/(\\[a-z]+) (?![a-z])/ig, '$1');
	}

	writeLatex(latex) {
		const cursor = this.notify('edit').cursor;
		cursor.parent.writeLatex(cursor, latex);

		return this;
	}

	renderLatexMath(latex) {
		const root = this.root;
		const cursor = this.cursor;
		const jQ = root.jQ;

		const all = Parser.all;
		const eof = Parser.eof;

		const block = latexMathParser.skip(eof).or(all.result(false)).parse(latex);

		root.eachChild('postOrder', 'dispose');
		root.ends[L] = root.ends[R] = 0;

		if (block && block.prepareInsertionAt(cursor)) {
			block.children().adopt(root, 0, 0);
			const html = block.join('html');
			jQ.html(html);
			root.jQize(jQ.children());
			root.finalizeInsert(cursor.options);
		}
		else {
			jQ.empty();
		}

		delete cursor.selection;
		cursor.insAtRightEnd(root);
	}

	renderLatexText(latex) {
		const root = this.root, cursor = this.cursor;

		root.jQ.children().slice(1).remove();
		root.eachChild('postOrder', 'dispose');
		root.ends[L] = root.ends[R] = 0;
		delete cursor.selection;
		cursor.show().insAtRightEnd(root);

		const regex = Parser.regex;
		const string = Parser.string;
		const eof = Parser.eof;
		const all = Parser.all;

		// Parser RootMathCommand
		const mathMode = string('$').then(latexMathParser)
		// because TeX is insane, math mode doesn't necessarily
		// have to end.  So we allow for the case that math mode
		// continues to the end of the stream.
			.skip(string('$').or(eof))
			.map((block) => {
				// HACK FIXME: this shouldn't have to have access to cursor
				const rootMathCommand = new RootMathCommand(cursor);

				rootMathCommand.createBlocks();
				const rootMathBlock = rootMathCommand.ends[L];
				block.children().adopt(rootMathBlock, 0, 0);

				return rootMathCommand;
			})
		;

		const escapedDollar = string('\\$').result('$');
		const textChar = escapedDollar.or(regex(/^[^$]/)).map(VanillaSymbol);
		const latexText = mathMode.or(textChar).many();
		const commands = latexText.skip(eof).or(all.result(false)).parse(latex);

		if (commands) {
			for (const command of commands) {
				command.adopt(root, root.ends[R], 0);
			}

			root.jQize().appendTo(root.jQ);

			root.finalizeInsert(cursor.options);
		}
	}
};
