// Horizontal panning for editable fields that overflow their width

import type { Constructor } from 'src/constants';
import { L, R } from 'src/constants';
import type { ControllerBase } from 'src/controller';

export const HorizontalScroll = <TBase extends Constructor<ControllerBase>>(Base: TBase) => class extends Base {
	scrollHoriz() {
		const rootRect = this.root.jQ[0].getBoundingClientRect();
		let scrollBy = 0;
		if (!this.cursor.selection) {
			if (!this.cursor.jQ.length) return;
			const x = this.cursor.jQ[0].getBoundingClientRect().left;
			if (x > rootRect.right - 20) scrollBy = x - (rootRect.right - 20);
			else if (x < rootRect.left + 20) scrollBy = x - (rootRect.left + 20);
			else return;
		}
		else {
			const rect = this.cursor.selection.jQ[0].getBoundingClientRect();
			const overLeft = rect.left - (rootRect.left + 20);
			const overRight = rect.right - (rootRect.right - 20);
			if (this.cursor.selection.ends[L] === this.cursor[R]) {
				if (overLeft < 0) scrollBy = overLeft;
				else if (overRight > 0) {
					if (rect.left - overRight < rootRect.left + 20) scrollBy = overLeft;
					else scrollBy = overRight;
				}
				else return;
			}
			else {
				if (overRight > 0) scrollBy = overRight;
				else if (overLeft < 0) {
					if (rect.right - overLeft > rootRect.right - 20) scrollBy = overRight;
					else scrollBy = overLeft;
				}
				else return;
			}
		}
		this.root.jQ.stop().animate({ scrollLeft: `+=${scrollBy}` }, 100);
	}
};
