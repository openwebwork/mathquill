// Point base class of edit tree-related objects

import { L, R } from 'src/constants';
import type { Node } from 'tree/node';

export class Point {
	parent?: Node;
	[L]?: Node;
	[R]?: Node;
	ancestors?: { [key: number]: Point | Node };

	constructor(parent?: Node, leftward?: Node, rightward?: Node) {
		this.parent = parent;
		this[L] = leftward;
		this[R] = rightward;
	}

	static copy(pt: Point) {
		return new Point(pt.parent, pt[L], pt[R]);
	}
}
