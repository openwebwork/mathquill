// Focus and Blur events

import type { Constructor } from 'src/constants';
import type { ControllerBase } from 'src/controller';
import type { TNode } from 'tree/node';

export const FocusBlurEvents = <TBase extends Constructor<ControllerBase>>(Base: TBase) =>
	class extends Base {
		focusHandler?: () => void;
		blurHandler?: () => void;

		focusBlurEvents() {
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

		unbindFocusBlurEvents() {
			if (this.focusHandler) this.textarea?.removeEventListener('focus', this.focusHandler);
			if (this.blurHandler) this.textarea?.removeEventListener('blur', this.blurHandler);
			delete this.focusHandler;
			delete this.blurHandler;
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
