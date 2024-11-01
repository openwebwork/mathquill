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
				this.blurred = true;
			});

			this.selectFn = (text) => {
				if (this.textarea) this.textarea.value = text;
				if (text) this.textarea?.select();
			};

			this.container.prepend(this.textareaSpan as HTMLElement);
		}

		editablesTextareaEvents() {
			if (this.textarea) {
				const { select } = saneKeyboardEvents(this.textarea, this as unknown as Controller);
				this.selectFn = select;
			}
			this.container.prepend(this.textareaSpan as HTMLElement);
			this.focusBlurEvents();
			this.updateMathspeak();
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

		setupStaticField() {
			this.mathspeakSpan = document.createElement('span');
			this.mathspeakSpan.classList.add('mq-mathspeak');
			this.container.prepend(this.mathspeakSpan);
			this.updateMathspeak();
			this.blurred = true;
			this.cursor.hide().parent?.blur(this.cursor);
		}

		updateMathspeak(emptyContent = false) {
			// If the controller's ARIA label doesn't end with a punctuation mark, add a colon by default to better
			// separate it from mathspeak.
			const ariaLabel = this.getAriaLabel();
			const labelWithSuffix = /[A-Za-z0-9]$/.test(ariaLabel) ? ariaLabel + ':' : ariaLabel;
			const mathspeak = this.root.mathspeak().trim();
			this.aria.clear(emptyContent);

			// For static math, provide mathspeak in a visually hidden span to allow screen readers and other AT to
			// traverse the content.  For editable math, assign the mathspeak to the textarea's ARIA label (AT can use
			// text navigation to interrogate the content).  Be certain to include the mathspeak for only one of these,
			// though, as we don't want to include outdated labels if a field's editable state changes.  By design, also
			// take careful note that the ariaPostLabel is meant to exist only for editable math (e.g. to serve as an
			// evaluation or error message) so it is not included for static math mathspeak calculations.  The
			// mathspeakSpan should exist only for static math, so we use its presence to decide which approach to take.
			if (this.mathspeakSpan) {
				this.textarea?.setAttribute('aria-label', '');
				this.mathspeakSpan.textContent = (labelWithSuffix + ' ' + mathspeak).trim();
			} else {
				this.textarea?.setAttribute(
					'aria-label',
					(labelWithSuffix + ' ' + mathspeak + ' ' + this.ariaPostLabel).trim()
				);
			}
		}
	};
