// Manage the MathQuill instance's textarea (as owned by the Controller)

import { jQuery } from 'src/constants';
import type { Controllerable } from 'src/controller';
import type { LatexControllerExtension } from 'services/latex';
import type { HorizontalScroll } from 'services/scrollHoriz';
import type { FocusBlurEvents } from 'services/focusBlur';
import type { TextAreaHandlers } from 'services/saneKeyboardEvents.util';

export const TextAreaController =
	<TBase extends Controllerable &
	ReturnType<typeof LatexControllerExtension> &
	ReturnType<typeof HorizontalScroll> &
	ReturnType<typeof FocusBlurEvents>>(Base: TBase) => class extends Base implements TextAreaHandlers {
		textareaSelectionTimeout?: ReturnType<typeof setTimeout>;
		selectFn?: (text: string) => void;

		createTextarea() {
			this.textareaSpan = jQuery('<span class="mq-textarea"></span>');
			const textarea = this.options.substituteTextarea();
			if (!textarea.nodeType) {
				throw 'substituteTextarea() must return a DOM element, got ' + textarea.toString();
			}
			this.textarea = jQuery(textarea).appendTo(this.textareaSpan) as JQuery<HTMLTextAreaElement>;

			this.cursor.selectionChanged = () => this.selectionChanged();
		}

		selectionChanged() {
			// throttle calls to setTextareaSelection(), because setting textarea.value
			// and/or calling textarea.select() can have anomalously bad performance:
			// https://github.com/mathquill/mathquill/issues/43#issuecomment-1399080
			if (!this.textareaSelectionTimeout) {
				this.textareaSelectionTimeout = setTimeout(() => this.setTextareaSelection());
			}
		}

		setTextareaSelection() {
			delete this.textareaSelectionTimeout;
			let latex = '';
			if (this.cursor.selection) {
				latex = this.cursor.selection.join('latex');
				if (this.options.statelessClipboard) {
					// FIXME: like paste, only this works for math fields; should ask parent
					latex = `$${latex}$`;
				}
			}
			this.selectFn?.(latex);
		}

		staticMathTextareaEvents() {
			this.container.prepend(jQuery('<span class="mq-selectable">')
				.text(`$${this.exportLatex()}$`));
			this.blurred = true;

			const detach = () => {
				this.textareaSpan?.detach();
				this.blurred = true;
			};

			this.textarea?.on('cut paste', false)
				.on('copy', () => this.setTextareaSelection())
				.focus(() => this.blurred = false).blur(() => {
					if (this.cursor.selection) this.cursor.selection.clear();
					setTimeout(detach); //detaching during blur explodes in WebKit
				});

			this.selectFn = (text) => {
				this.textarea?.val(text);
				if (text) this.textarea?.select();
			};
		}

		editablesTextareaEvents() {
			const keyboardEventsShim =
				this.options.substituteKeyboardEvents(this.textarea as JQuery<HTMLTextAreaElement>, this);
			this.selectFn = (text) => keyboardEventsShim.select(text);
			this.container.prepend(this.textareaSpan as JQuery);
			this.focusBlurEvents();
		}

		unbindEditablesEvents() {
			this.selectFn = (text) => {
				this.textarea?.val(text);
				if (text) this.textarea?.select();
			};
			this.textareaSpan?.remove();

			this.unbindFocusBlurEvents();

			this.blurred = true;
			this.textarea?.on('cut paste', false);
		}

		typedText(ch: string) {
			if (ch === '\n') return this.handle('enter');
			const cursor = this.notify().cursor;
			cursor.parent?.write(cursor, ch);
			this.scrollHoriz();
		}

		cut() {
			if (this.cursor.selection) {
				setTimeout(() => {
					this.notify('edit'); // deletes selection if present
					this.cursor.parent?.bubble('reflow');
				});
			}
		}

		copy() {
			this.setTextareaSelection();
		}

		paste(text: string) {
			// TODO: document `statelessClipboard` config option in README, after
			// making it work like it should, that is, in both text and math mode
			// (currently only works in math fields, so worse than pointless, it
			//  only gets in the way by \text{}-ifying pasted stuff and $-ifying
			//  cut/copied LaTeX)
			if (this.options.statelessClipboard) {
				if (text.slice(0, 1) === '$' && text.slice(-1) === '$') {
					text = text.slice(1, -1);
				} else {
					text = `\\text{${text}}`;
				}
			}
			// FIXME: this always inserts math or a TextBlock, even in a RootTextBlock
			this.writeLatex(text).cursor.show();
		}

		keystroke(_ignore_key: string, _ignore_event: JQueryKeyEventObject) { /* do nothing */ };
	};
