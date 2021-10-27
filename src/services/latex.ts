// Latex Controller Extension

import type { Constructor } from 'src/constants';
import { L, R } from 'src/constants';
import { Parser } from 'services/parser.util';
import { VanillaSymbol, latexMathParser } from 'commands/mathElements';
import { RootMathCommand } from 'commands/textElements';
import type { ControllerBase, Controllerable } from 'src/controller';
import type { Node } from 'tree/node';

interface LatexControllerExtension {
	exportLatex: () => string;
	writeLatex: (latex: string) => ControllerBase;
	renderLatexMath: (latex: string) => void;
}

export const LatexControllerExtension = <TBase extends Controllerable>(Base: TBase) =>
	class extends Base implements LatexControllerExtension {
		exportLatex() {
			return this.root.latex().replace(/(\\[a-z]+) (?![a-z])/ig, '$1');
		}

		writeLatex(latex: string) {
			const cursor = this.notify('edit').cursor;
			cursor.parent?.writeLatex(cursor, latex);

			return this;
		}

		renderLatexMath(latex: string) {
			const all = Parser.all;
			const eof = Parser.eof;

			const block = latexMathParser.skip(eof).or(all.result(false)).parse(latex);

			this.root.eachChild('postOrder', 'dispose');
			delete this.root.ends[L];
			delete this.root.ends[R];

			if (block && block.prepareInsertionAt(this.cursor)) {
				block.children().adopt(this.root);
				const html = block.join('html');
				this.root.jQ.html(html);
				this.root.jQize(this.root.jQ.children());
				this.root.finalizeInsert(this.cursor.options);
			}
			else {
				this.root.jQ.empty();
			}

			delete this.cursor.selection;
			this.cursor.insAtRightEnd(this.root);
		}

		renderLatexText(latex: string) {
			this.root.jQ.children().slice(1).remove();
			this.root.eachChild('postOrder', 'dispose');
			delete this.root.ends[L];
			delete this.root.ends[R];
			delete this.cursor.selection;
			this.cursor.show().insAtRightEnd(this.root);

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
				.map((block: Node) => {
				// HACK FIXME: this shouldn't have to have access to cursor
					const rootMathCommand = new RootMathCommand(this.cursor);

					rootMathCommand.createBlocks();
					const rootMathBlock = rootMathCommand.ends[L];
					block.children().adopt(rootMathBlock);

					return rootMathCommand;
				})
		;

			const escapedDollar = string('\\$').result('$');
			const textChar = escapedDollar.or(regex(/^[^$]/)).map(VanillaSymbol);
			const latexText = mathMode.or(textChar).many();
			const commands = latexText.skip(eof).or(all.result(false)).parse(latex);

			if (commands) {
				for (const command of commands) {
					command.adopt(this.root, this.root.ends[R]);
				}

				this.root.jQize().appendTo(this.root.jQ);

				this.root.finalizeInsert(this.cursor.options);
			}
		}
	};

export type Latexable = Constructor<LatexControllerExtension>;
