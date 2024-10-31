// Latex Controller Extension

import type { Constructor } from 'src/constants';
import { L, R } from 'src/constants';
import type { TNode } from 'tree/node';
import { Parser } from 'services/parser.util';
import { VanillaSymbol, latexMathParser } from 'commands/mathElements';
import { RootMathCommand, MathBlock } from 'commands/mathBlock';
import type { ControllerBase } from 'src/controller';

export const LatexControllerExtension = <TBase extends Constructor<ControllerBase>>(Base: TBase) =>
	class extends Base {
		exportLatex() {
			return this.root.latex().replace(/(\\[a-z]+) (?![a-z])/gi, '$1');
		}

		writeLatex(latex: string) {
			const cursor = this.notify('edit').cursor;
			cursor.parent?.writeLatex(cursor, latex);

			return this;
		}

		renderLatexMath(latex: string) {
			const block: MathBlock | undefined = latexMathParser
				.skip(Parser.eof)
				.or(Parser.all.result(false))
				.parse(latex);

			this.root.eachChild('postOrder', 'dispose');
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete this.root.ends[L];
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete this.root.ends[R];

			if (block instanceof MathBlock && block.prepareInsertionAt(this.cursor)) {
				block.children().adopt(this.root);
				const html = block.join('html');
				this.root.elements.html(html);
				this.root.domify(this.root.elements.children());
				this.root.finalizeInsert(this.cursor.options, this.cursor);
			} else {
				this.root.elements.empty();
			}

			delete this.cursor.selection;
			this.cursor.insAtRightEnd(this.root);
		}

		renderLatexText(latex: string) {
			this.root.elements
				.children()
				.contents.slice(1)
				.forEach((el) => {
					(el as HTMLElement).remove();
				});
			this.root.eachChild('postOrder', 'dispose');
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete this.root.ends[L];
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete this.root.ends[R];
			delete this.cursor.selection;
			this.cursor.show().insAtRightEnd(this.root);

			// Parser RootMathCommand
			const mathMode = Parser.string('$')
				.then(latexMathParser)
				// because TeX is insane, math mode doesn't necessarily
				// have to end.  So we allow for the case that math mode
				// continues to the end of the stream.
				.skip(Parser.string('$').or(Parser.eof))
				.map((block: MathBlock) => {
					// HACK FIXME: This shouldn't have to have access to cursor
					const rootMathCommand = new RootMathCommand(this.cursor);

					rootMathCommand.createBlocks();
					const rootMathBlock = rootMathCommand.ends[L] as MathBlock;
					block.children().adopt(rootMathBlock);

					return rootMathCommand;
				});

			const escapedDollar = Parser.string('\\$').result('$');
			const textChar = escapedDollar.or(Parser.regex(/^[^$]/)).map(VanillaSymbol);
			const latexText = mathMode.or(textChar).many();
			const commands: TNode[] | undefined = latexText.skip(Parser.eof).or(Parser.all.result(false)).parse(latex);

			if (commands) {
				for (const command of commands) {
					command.adopt(this.root, this.root.ends[R]);
				}

				this.root.elements.lastElement.append(...this.root.domify().contents);

				this.root.finalizeInsert(this.cursor.options, this.cursor);
			}
		}
	};
