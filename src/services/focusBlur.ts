// Focus and Blur events

import type { Constructor } from 'src/constants';
import type { ControllerBase, Controller } from 'src/controller';
import type { TNode } from 'tree/node';

export const FocusBlurEvents = <TBase extends Constructor<ControllerBase>>(Base: TBase) =>
	class extends Base {
		focusHandler?: () => void;
		blurHandler?: (e: FocusEvent) => void;
		windowFocusHandler?: () => void;
		windowBlurHandler?: () => void;
		windowBlurred = !document.hasFocus();
		blurredWithCursor = false;

		addEditableFocusBlurEvents() {
			const blink = this.cursor.blink;

			this.focusHandler = () => {
				this.blurred = false;
				this.updateMathspeak();
				this.container.classList.add('mq-focused');
				this.cursor.blink = blink;
				if (!this.cursor.parent) this.cursor.insAtRightEnd(this.root);
				if (this.cursor.selection) {
					this.cursor.selection.elements.removeClass('mq-blur');
					this.selectionChanged();
				} else if (!this.blurredWithCursor && !this.windowBlurred) (this as unknown as Controller).selectAll();
				else this.cursor.show();
			};
			this.textarea?.addEventListener('focus', this.focusHandler);

			this.blurHandler = (e) => {
				this.blurred = true;
				this.blurredWithCursor = this.options.blurWithCursor?.(e, this.apiClass) ?? false;
				this.container.classList.remove('mq-focused');
				if (this.blurredWithCursor) {
					if (this.cursor.selection) this.cursor.selection.elements.addClass('mq-blur');
					else {
						// FIXME: This special blink method is a bit of a hack. When focus is regained with a mouse
						// click, then the mouse down handler caches the cursor blink method which will be the method
						// defined below. Then the focus handler above is called and resets the cursor blink method to
						// the default cursor blink method cached here at initialization. But then the mouse up handler
						// occurs, and sets the cursor blink method back to its cached blink method which is this one.
						// So if the noop is used here, then that is what ends up being in effect, and that means no
						// cursor blink. The problem is that the mouse handlers changing the blink method is also a
						// hack. Instead the cursor show method should accept an optional argument that determines if
						// the cursor is blinking or not. That will take some work to implement and get right for all of
						// the places that show is called.
						this.cursor.blink = () => {
							if (!this.blurred) blink();
						};
						this.cursor.show();
					}
				} else {
					if (document.hasFocus()) {
						this.cursor.hide().parent?.blur(this.cursor);
						this.cursor.clearSelection().endSelection();
					} else {
						this.cursor.hide().parent?.blur();
						if (this.cursor.selection) this.cursor.selection.elements.addClass('mq-blur');
					}
				}
				this.updateMathspeak(true);
			};
			this.textarea?.addEventListener('blur', this.blurHandler);

			this.windowFocusHandler = () => {
				if (!this.blurredWithCursor && this.blurred && document.activeElement !== this.textarea)
					this.cursor.clearSelection().endSelection();
				// A timeout is used to delay setting this.windowBlurred to false until after the focus handler has run.
				setTimeout(() => (this.windowBlurred = false));
			};
			window.addEventListener('focus', this.windowFocusHandler);

			this.windowBlurHandler = () => (this.windowBlurred = true);
			window.addEventListener('blur', this.windowBlurHandler);

			this.blurred = true;
			this.cursor.hide().parent?.blur();
		}

		unbindEditableFocusBlurEvents() {
			if (this.focusHandler) this.textarea?.removeEventListener('focus', this.focusHandler);
			if (this.blurHandler) this.textarea?.removeEventListener('blur', this.blurHandler);
			if (this.windowFocusHandler) window.removeEventListener('blur', this.windowFocusHandler);
			if (this.windowBlurHandler) window.removeEventListener('blur', this.windowBlurHandler);
			delete this.focusHandler;
			delete this.blurHandler;
			delete this.windowFocusHandler;
			delete this.windowBlurHandler;
		}

		addStaticFocusBlurEvents() {
			this.focusHandler = () => {
				if (!this.cursor.selection) (this as unknown as Controller).selectAll();
				this.cursor.selection?.elements.removeClass('mq-blur');
				this.blurred = false;
			};
			this.textarea?.addEventListener('focus', this.focusHandler);

			this.blurHandler = () => {
				if (document.hasFocus()) {
					this.cursor.selection?.clear();
					this.cursor.clearSelection();
				} else if (this.cursor.selection) this.cursor.selection.elements.addClass('mq-blur');

				this.updateMathspeak(true);
			};
			this.textarea?.addEventListener('blur', this.blurHandler);

			this.windowFocusHandler = () => {
				if (document.activeElement !== this.textarea) this.cursor.clearSelection().endSelection();
			};
			window.addEventListener('focus', this.windowFocusHandler);

			this.blurred = true;
			this.cursor.hide().parent?.blur();
		}
	};

export const BlockFocusBlur = <TBase extends Constructor<TNode>>(Base: TBase) =>
	class extends Base {
		focus() {
			this.elements.addClass('mq-has-cursor');
			this.elements.removeClass('mq-empty');
		}

		blur() {
			this.elements.removeClass('mq-has-cursor');
			if (this.isEmpty()) this.elements.addClass('mq-empty');
		}
	};
