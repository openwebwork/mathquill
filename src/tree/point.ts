// Point base class of edit tree-related objects

import { L, R } from 'src/constants';
import type { Node } from 'tree/node';

export class Point {
	parent: Node | 0;
	[L]: Node | 0;
	[R]: Node | 0;
	ancestors?: { [key: number]: Point | Node };

	constructor(parent: Node | 0 | undefined, leftward: Node | 0 = 0, rightward: Node | 0 = 0) {
		this.parent = parent ?? 0;
		this[L] = leftward;
		this[R] = rightward;
	}

	static copy(pt: Point) {
		return new Point(pt.parent, pt[L], pt[R]);
	}
}
