// Point base class of edit tree-related objects

import type { TNode } from 'tree/node';

export class Point {
	parent?: TNode;
	left?: TNode;
	right?: TNode;
	ancestors?: Record<number, Point | TNode>;

	constructor(parent?: TNode, leftward?: TNode, rightward?: TNode) {
		this.parent = parent;
		this.left = leftward;
		this.right = rightward;
	}

	static copy(pt: Point) {
		return new Point(pt.parent, pt.left, pt.right);
	}
}
