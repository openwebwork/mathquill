// Manage the MathQuill instance's textarea (as owned by the Controller)

import type { Constructor } from 'src/constants';
import type { ControllerBase, Controller } from 'src/controller';
import type { LatexControllerExtension } from 'services/latex';
import type { HorizontalScroll } from 'services/scrollHoriz';
import type { FocusBlurEvents } from 'services/focusBlur';
import { saneKeyboardEvents } from 'services/saneKeyboardEvents.util';

export const TextAreaController = <
	TBase extends Constructor<ControllerBase> &
		ReturnType<typeof LatexControllerExtension> &
		ReturnType<typeof HorizontalScroll> &
		ReturnType<typeof FocusBlurEvents>
>(
	Base: TBase
) =>
	class extends Base {
		textareaSelectionTimeout?: ReturnType<typeof setTimeout>;
		selectFn?: (text: string) => void;

		createTextarea() {
			this.textareaSpan = document.createElement('span');
			this.textareaSpan.classList.add('mq-textarea');
			const textarea = this.options.substituteTextarea();
			if (!textarea.nodeType) {
				throw new Error('substituteTextarea() must return a DOM element');
			}
			this.textareaSpan.append(textarea);
			this.textarea = textarea;

			this.cursor.selectionChanged = () => {
				this.selectionChanged();
			};
		}

		selectionChanged() {
			// throttle calls to setTextareaSelection(), because setting textarea.value
			// and/or calling textarea.select() can have anomalously bad performance:
			// https://github.com/mathquill/mathquill/issues/43#issuecomment-1399080
			if (!this.textareaSelectionTimeout) {
				this.textareaSelectionTimeout = setTimeout(() => {
					this.setTextareaSelection();
				});
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
			const innerSpan = document.createElement('span');
			innerSpan.classList.add('mq-selectable');
			innerSpan.textContent = `$${this.exportLatex()}$`;
			this.container.prepend(innerSpan);
			this.blurred = true;

			this.textarea?.addEventListener('cut', (e) => {
				e.stopPropagation();
				e.preventDefault();
			});
			this.textarea?.addEventListener('paste', (e) => {
				e.stopPropagation();
				e.preventDefault();
			});
			this.textarea?.addEventListener('copy', () => {
				this.setTextareaSelection();
			});
			this.textarea?.addEventListener('focus', () => (this.blurred = false));
			this.textarea?.addEventListener('blur', () => {
				if (this.cursor.selection) this.cursor.selection.clear();

				// Detaching during blur explodes in WebKit
				setTimeout(() => {
					this.textareaSpan?.remove();
					this.blurred = true;
				});
			});

			this.selectFn = (text) => {
				if (this.textarea) this.textarea.value = text;
				if (text) this.textarea?.select();
			};
		}

		editablesTextareaEvents() {
			if (this.textarea) {
				const { select } = saneKeyboardEvents(this.textarea, this as unknown as Controller);
				this.selectFn = (text) => {
					select(text);
				};
			}
			this.container.prepend(this.textareaSpan as HTMLElement);
			this.focusBlurEvents();
		}

		unbindEditablesEvents() {
			this.selectFn = (text) => {
				if (this.textarea) this.textarea.value = text;
				if (text) this.textarea?.select();
			};
			this.textareaSpan?.remove();

			this.unbindFocusBlurEvents();

			this.blurred = true;

			this.textarea?.addEventListener('cut', (e) => {
				e.stopPropagation();
				e.preventDefault();
			});
			this.textarea?.addEventListener('paste', (e) => {
				e.stopPropagation();
				e.preventDefault();
			});
		}

		keystroke(key: string, evt: KeyboardEvent) {
			this.cursor.parent?.keystroke(key, evt, this as unknown as Controller);
		}

		typedText(ch: string) {
			if (ch === '\n') {
				this.handle('enter');
				return;
			}
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
				if (text.startsWith('$') && text.endsWith('$')) {
					text = text.slice(1, -1);
				} else {
					text = `\\text{${text}}`;
				}
			}
			// FIXME: this always inserts math or a TextBlock, even in a RootTextBlock
			this.writeLatex(text).cursor.show();
		}
	};
