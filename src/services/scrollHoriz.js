// Horizontal panning for editable fields that overflow their width

import { L, R } from 'src/constants';

export const HorizontalScroll = (base) => class extends base {
	scrollHoriz() {
		const cursor = this.cursor, seln = cursor.selection;
		const rootRect = this.root.jQ[0].getBoundingClientRect();
		let scrollBy = 0;
		if (!seln) {
			if (!cursor.jQ.length) return;
			const x = cursor.jQ[0].getBoundingClientRect().left;
			if (x > rootRect.right - 20) scrollBy = x - (rootRect.right - 20);
			else if (x < rootRect.left + 20) scrollBy = x - (rootRect.left + 20);
			else return;
		}
		else {
			const rect = seln.jQ[0].getBoundingClientRect();
			const overLeft = rect.left - (rootRect.left + 20);
			const overRight = rect.right - (rootRect.right - 20);
			if (seln.ends[L] === cursor[R]) {
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
		this.root.jQ.stop().animate({ scrollLeft: '+=' + scrollBy}, 100);
	}
};
