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

		addEditableFocusBlurEvents() {
			this.focusHandler = () => {
				this.updateMathspeak();
				if (!this.blurred) return;
				this.blurred = false;
				this.container.classList.add('mq-focused');
				if (!this.cursor.parent) this.cursor.insAtRightEnd(this.root);
				if (this.cursor.selection) {
					this.cursor.selection.elements.removeClass('mq-blur');
					this.selectionChanged();
				} else if (!this.windowBlurred) (this as unknown as Controller).selectAll();
				else this.cursor.show();
			};
			this.textarea?.addEventListener('focus', this.focusHandler);

			this.blurHandler = (e) => {
				if (this.options.preventBlur?.(e, this.apiClass)) {
					this.updateMathspeak(true);
					return;
				}
				this.blurred = true;
				this.container.classList.remove('mq-focused');
				this.cursor.hide().parent?.blur();
				if (document.hasFocus()) this.cursor.clearSelection().endSelection();
				else if (this.cursor.selection) this.cursor.selection.elements.addClass('mq-blur');
				this.updateMathspeak(true);
			};
			this.textarea?.addEventListener('blur', this.blurHandler);

			this.windowFocusHandler = () => {
				if (this.blurred && document.activeElement !== this.textarea)
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
