// Point base class of edit tree-related objects

import { L, R } from 'src/constants';
import type { TNode } from 'tree/node';

export class Point {
	parent?: TNode;
	[L]?: TNode;
	[R]?: TNode;
	ancestors?: { [key: number]: Point | TNode };

	constructor(parent?: TNode, leftward?: TNode, rightward?: TNode) {
		this.parent = parent;
		this[L] = leftward;
		this[R] = rightward;
	}

	static copy(pt: Point) {
		return new Point(pt.parent, pt[L], pt[R]);
	}
}
