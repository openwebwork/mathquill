// Deals with mouse events for clicking, drag-to-select

import { jQuery, mqCmdId, mqBlockId, noop, pray } from 'src/constants';
import { Node } from 'tree/node';
import type { Controllerable } from 'src/controller';
import type { HorizontalScroll } from 'services/scrollHoriz';

export const MouseEventController =
	<TBase extends Controllerable & ReturnType<typeof HorizontalScroll>>(Base: TBase) => class extends Base {
		delegateMouseEvents() {
			const ultimateRootjQ = this.root.jQ;
			//drag-to-select event handling
			this.container.on('mousedown.mathquill', (e) => {
				const rootjQ = jQuery(e.target).closest('.mq-root-block');
				const root = Node.byId[parseInt((rootjQ?.attr(mqBlockId) || ultimateRootjQ?.attr(mqBlockId)) ?? '0')];

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

				let target: JQuery | undefined;
				const mousemove = (e: JQuery.TriggeredEvent) => target = jQuery(e.target);
				const docmousemove = (e: JQuery.TriggeredEvent) => {
					if (!cursor.anticursor) cursor.startSelection();
					ctrlr.seek(target as JQuery, e.pageX).cursor.select();
					target = undefined;
				};
				// outside rootjQ, the MathQuill node corresponding to the target (if any)
				// won't be inside this root, so don't mislead Controller::seek with it

				const mouseup = (e: JQuery.TriggeredEvent) => {
					cursor.blink = blink;
					if (!cursor.selection) {
						if (ctrlr.editable) {
							cursor.show();
						} else {
							textareaSpan?.detach();
						}
					}

					// delete the mouse handlers now that we're not dragging anymore
					rootjQ.off('mousemove', mousemove);
					jQuery(e.target.ownerDocument).off('mousemove', docmousemove).off('mouseup', mouseup);
				};

				if (ctrlr.blurred) {
					if (!ctrlr.editable) rootjQ.prepend(textareaSpan as JQuery);
					textarea?.focus();
				}

				cursor.blink = noop;
				ctrlr.seek(jQuery(e.target), e.pageX).cursor.startSelection();

				rootjQ.mousemove(mousemove);
				jQuery(e.target.ownerDocument).mousemove(docmousemove).mouseup(mouseup);
			// listen on document not just body to not only hear about mousemove and
			// mouseup on page outside field, but even outside page, except iframes: https://github.com/mathquill/mathquill/commit/8c50028afcffcace655d8ae2049f6e02482346c5#commitcomment-6175800
			});
		}

		seek(target: JQuery, pageX?: number) {
			const cursor = this.notify('select').cursor;

			let nodeId = 0;
			if (target) {
				nodeId = parseInt((target.attr(mqBlockId) || target.attr(mqCmdId)) ?? '0');
				if (!nodeId) {
					const targetParent = target.parent();
					nodeId = parseInt((targetParent.attr(mqBlockId) || targetParent.attr(mqCmdId)) ?? '0');
				}
			}
			const node = nodeId ? Node.byId[nodeId] : this.root;
			pray('nodeId is the id of some Node that exists', !!node);

			// don't clear selection until after getting node from target, in case
			// target was selection span, otherwise target will have no parent and will
			// seek from root, which is less accurate (e.g. fraction)
			cursor.clearSelection().show();

			node.seek(pageX, cursor);
			this.scrollHoriz(); // before .selectFrom when mouse-selecting, so
			// always hits no-selection case in scrollHoriz and scrolls slower
			return this;
		}
	};
