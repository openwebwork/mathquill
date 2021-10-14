// Point base class of edit tree-related objects

import { L, R } from 'src/constants';

export class Point {
	constructor(parent, leftward, rightward) {
		this.parent = parent ?? 0;
		this[L] = leftward ?? 0;
		this[R] = rightward ?? 0;
	}

	static copy(pt) {
		return new Point(pt.parent, pt[L], pt[R]);
	}
}
