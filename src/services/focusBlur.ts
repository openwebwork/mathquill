// Focus and Blur events

import type { Constructor } from 'src/constants';
import type { ControllerBase, Controller } from 'src/controller';
import type { TNode } from 'tree/node';

export const FocusBlurEvents = <TBase extends Constructor<ControllerBase>>(Base: TBase) =>
	class extends Base {
		focusHandler?: () => void;
		blurHandler?: () => void;

		addEditableFocusBlurEvents() {
			this.focusHandler = () => {
				this.updateMathspeak();
				this.blurred = false;
				this.container.classList.add('mq-focused');
				if (!this.cursor.parent) this.cursor.insAtRightEnd(this.root);
				if (this.cursor.selection) {
					this.cursor.selection.elements.removeClass('mq-blur');
					this.selectionChanged(); // Re-select textarea contents after tabbing away and back.
				} else this.cursor.show();
			};

			this.textarea?.addEventListener('focus', this.focusHandler);

			this.blurHandler = () => {
				this.blurred = true;
				this.container.classList.remove('mq-focused');
				this.cursor.hide().parent?.blur();
				if (this.cursor.selection) this.cursor.selection.elements.addClass('mq-blur');
				this.updateMathspeak(true);
			};

			this.textarea?.addEventListener('blur', this.blurHandler);

			this.blurred = true;
			this.cursor.hide().parent?.blur();
		}

		unbindEditableFocusBlurEvents() {
			if (this.focusHandler) this.textarea?.removeEventListener('focus', this.focusHandler);
			if (this.blurHandler) this.textarea?.removeEventListener('blur', this.blurHandler);
			delete this.focusHandler;
			delete this.blurHandler;
		}

		addStaticFocusBlurEvents() {
			this.focusHandler = () => {
				if (!this.cursor.selection) (this as unknown as Controller).selectAll();
				this.blurred = false;
			};

			this.textarea?.addEventListener('focus', this.focusHandler);

			this.blurHandler = () => {
				this.cursor.selection?.clear();
				this.cursor.clearSelection();
				this.updateMathspeak(true);
			};

			this.textarea?.addEventListener('blur', this.blurHandler);

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
