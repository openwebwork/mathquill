// Deals with mouse events for clicking and drag-to-select.

import type { Constructor } from 'src/constants';
import { mqCmdId, mqBlockId, noop } from 'src/constants';
import { TNode } from 'tree/node';
import type { ControllerBase } from 'src/controller';
import type { HorizontalScroll } from 'services/scrollHoriz';
import { Letter, Digit } from 'commands/mathElements';
import { TextBlock } from 'commands/textElements';

export const MouseEventController = <TBase extends Constructor<ControllerBase> & ReturnType<typeof HorizontalScroll>>(
	Base: TBase
) =>
	class extends Base {
		mouseDownHandler?: (e: MouseEvent) => void;

		delegateMouseEvents() {
			const ultimateRootEl = this.root.elements.firstElement;

			// Drag-to-select event handling
			this.mouseDownHandler = (e: MouseEvent) => {
				const rootEl = (e.target as HTMLElement | undefined)?.closest('.mq-root-block');
				const root = TNode.byId.get(
					parseInt((rootEl?.getAttribute(mqBlockId) || ultimateRootEl.getAttribute(mqBlockId)) ?? '0')
				);

				if (!root?.controller) {
					throw new Error('controller undefined... what?');
				}

				const ctrlr = root.controller,
					cursor = ctrlr.cursor,
					blink = cursor.blink;
				const textarea = ctrlr.textarea;

				e.preventDefault();

				if (cursor.options.ignoreNextMousedown(e)) return;
				else cursor.options.ignoreNextMousedown = () => false;

				// End any previous selection.
				cursor.endSelection();

				// Cache the ownerDocument as it is not available in the mouseup handler if the mouse button is released
				// while the cursor is not in the window.
				const ownerDocument = (e.target as HTMLElement).ownerDocument;

				let target: HTMLElement | undefined;
				const mousemove = (e: Event) => (target = e.target as HTMLElement);
				const docmousemove = (e: MouseEvent) => {
					if (!cursor.anticursor) cursor.startSelection();
					ctrlr.seek(target, e.pageX).cursor.select();
					target = undefined;
					if (cursor.selection)
						ctrlr.aria
							.clear()
							.queue(cursor.selection.join('mathspeak') + ' selected')
							.alert();
				};
				// Outside rootEl, the MathQuill node corresponding to the target (if any)
				// won't be inside this root.  So don't mislead Controller::seek with it.

				const mouseup = () => {
					cursor.blink = blink;
					if (!cursor.selection) {
						if (ctrlr.editable) {
							cursor.show();
							if (cursor.parent) ctrlr.aria.queue(cursor.parent).alert();
						}
					}

					// Delete the mouse handlers now that the drag has ended.
					rootEl?.removeEventListener('mousemove', mousemove);
					ownerDocument.removeEventListener('mousemove', docmousemove);
					ownerDocument.removeEventListener('mouseup', mouseup);
				};

				if (e.detail === 3) {
					// If this is a triple click, then select all and return.
					ctrlr.selectAll();
					ctrlr.aria.alert();
					mouseup();
					return;
				} else if (e.detail === 2) {
					// If this is a double click, then select the block that is to the right of the cursor, and return.
					// Note that the interpretation of what a block is in this situation is not a true MathQuill block.
					// Rather an attempt is made to select word like blocks.
					ctrlr.seek(e.target as HTMLElement, e.pageX);
					if (!cursor.right && cursor.left?.parent === root) ctrlr.moveLeft();

					ctrlr.withIncrementalSelection((selectDir) => {
						if (cursor.right instanceof Letter) {
							// If a "Letter" is to the right of the cursor, then try to select all adjacent "Letter"s
							// that are of the same basic ilk.  That means all "Letter"s that are part of an operator
							// name, or all "Letter"s that are not part of an operator name.
							const currentNode = cursor.right;
							while (
								cursor.left &&
								cursor.left instanceof Letter &&
								cursor.left.isPartOfOperator === currentNode.isPartOfOperator
							)
								ctrlr.moveLeft();
							cursor.startSelection();
							while (
								// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
								cursor.right &&
								cursor.right instanceof Letter &&
								cursor.right.isPartOfOperator === currentNode.isPartOfOperator
							)
								selectDir('right');
						} else if (cursor.right instanceof Digit) {
							// If a "Digit" is to the right of the cursor, then select all adjacent "Digit"s.
							while (cursor.left && cursor.left instanceof Digit) ctrlr.moveLeft();
							cursor.startSelection();
							// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
							while (cursor.right && cursor.right instanceof Digit) selectDir('right');
						} else {
							cursor.startSelection();
							selectDir('right');
						}

						// If the cursor is in a text block, then select the whole text block.
						if (cursor.left?.parent instanceof TextBlock) {
							cursor.left.parent.moveOutOf('left', cursor);
							selectDir('right');
						}
					});

					ctrlr.aria.alert();
					mouseup();
					return;
				}

				if (ctrlr.blurred) textarea?.focus();

				cursor.blink = noop;
				ctrlr.seek(e.target as HTMLElement, e.pageX).cursor.startSelection();

				rootEl?.addEventListener('mousemove', mousemove);
				ownerDocument.addEventListener('mousemove', docmousemove);
				ownerDocument.addEventListener('mouseup', mouseup);
				// Listen on document not just body to not only hear about mousemove and
				// mouseup on page outside field, but even outside page (except iframes).
			};

			this.container.addEventListener('mousedown', this.mouseDownHandler);
		}

		seek(target: Element | null | undefined, pageX: number) {
			const cursor = this.notify('select').cursor;

			let nodeId = 0;
			if (target) {
				nodeId = parseInt((target.getAttribute(mqBlockId) || target.getAttribute(mqCmdId)) ?? '0');
				if (!nodeId) {
					const targetParent = target.parentElement;
					nodeId = parseInt(
						(targetParent?.getAttribute(mqBlockId) || targetParent?.getAttribute(mqCmdId)) ?? '0'
					);
				}
			}
			const node = nodeId ? TNode.byId.get(nodeId) : this.root;
			if (!node) throw new Error('nodeId is not the id of a TNode that exists');

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
