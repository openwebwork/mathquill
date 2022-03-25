// Deals with mouse events for clicking and drag-to-select.

import type { Constructor } from 'src/constants';
import { mqCmdId, mqBlockId, noop, pray } from 'src/constants';
import { TNode } from 'tree/node';
import type { ControllerBase } from 'src/controller';
import type { HorizontalScroll } from 'services/scrollHoriz';

export const MouseEventController =
	<TBase extends Constructor<ControllerBase> & ReturnType<typeof HorizontalScroll>>(Base: TBase) => class extends Base
	{
		mouseDownHandler?: (e: MouseEvent) => void;

		delegateMouseEvents() {
			const ultimateRootEl = this.root.elements.firstElement;

			// Drag-to-select event handling
			this.mouseDownHandler = (e: MouseEvent) => {
				const rootEl = (e.target as HTMLElement).closest('.mq-root-block') as HTMLElement;
				const root = TNode.byId[parseInt((rootEl?.getAttribute(mqBlockId)
					|| ultimateRootEl?.getAttribute(mqBlockId)) ?? '0')];

				if (!root.controller) {
					throw 'controller undefined... what?';
					return;
				}

				const ctrlr = root.controller, cursor = ctrlr.cursor, blink = cursor.blink;
				const textareaSpan = ctrlr.textareaSpan, textarea = ctrlr.textarea;

				e.preventDefault();

				if (cursor.options.ignoreNextMousedown(e)) return;
				else cursor.options.ignoreNextMousedown = () => false;

				// End any previous selection.
				cursor.endSelection();

				// Cache the ownerDocument as it is not available in the mouseup handler if the mouse button is released
				// while the cursor is not in the window.
				const ownerDocument = (e.target as HTMLElement).ownerDocument;

				let target: HTMLElement | undefined;
				const mousemove = (e: MouseEvent) => target = e.target as HTMLElement;
				const docmousemove = (e: MouseEvent) => {
					if (!cursor.anticursor) cursor.startSelection();
					ctrlr.seek(target as HTMLElement, e.pageX ?? 0).cursor.select();
					target = undefined;
				};
				// Outside rootEl, the MathQuill node corresponding to the target (if any)
				// won't be inside this root.  So don't mislead Controller::seek with it.

				const mouseup = () => {
					cursor.blink = blink;
					if (!cursor.selection) {
						if (ctrlr.editable) cursor.show();
						else textareaSpan?.remove();
					}

					// Delete the mouse handlers now that the drag has ended.
					rootEl?.removeEventListener('mousemove', mousemove);
					ownerDocument.removeEventListener('mousemove', docmousemove);
					ownerDocument.removeEventListener('mouseup', mouseup);
				};

				if (ctrlr.blurred) {
					if (!ctrlr.editable) rootEl?.prepend(textareaSpan as HTMLSpanElement);
					textarea?.focus();
				}

				cursor.blink = noop;
				ctrlr.seek(e.target as HTMLElement, e.pageX ?? 0).cursor.startSelection();

				rootEl?.addEventListener('mousemove', mousemove);
				ownerDocument.addEventListener('mousemove', docmousemove);
				ownerDocument.addEventListener('mouseup', mouseup);
				// Listen on document not just body to not only hear about mousemove and
				// mouseup on page outside field, but even outside page (except iframes).
			};

			this.container.addEventListener('mousedown', this.mouseDownHandler);
		}

		seek(target: HTMLElement, pageX: number) {
			const cursor = this.notify('select').cursor;

			let nodeId = 0;
			if (target) {
				nodeId = parseInt((target.getAttribute(mqBlockId) || target.getAttribute(mqCmdId)) ?? '0');
				if (!nodeId) {
					const targetParent = target.parentElement;
					nodeId = parseInt((targetParent?.getAttribute(mqBlockId)
						|| targetParent?.getAttribute(mqCmdId)) ?? '0');
				}
			}
			const node = nodeId ? TNode.byId[nodeId] : this.root;
			pray('nodeId is the id of some TNode that exists', !!node);

			// Don't clear the selection until after getting node from target, in case
			// target was selection span.  Otherwise target will have no parent and will
			// seek from root, which is less accurate (e.g. fraction).
			cursor.clearSelection().show();

			node.seek(pageX, cursor);

			// Before .selectFrom when mouse-selecting, so
			// always hits no-selection case in scrollHoriz and scrolls slower
			this.scrollHoriz();

			return this;
		}
	};
