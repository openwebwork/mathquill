import { noop } from 'src/constants';
import { Controller } from 'src/controller';
import { Options } from 'src/options';
import { Point } from 'tree/point';
import { TNode } from 'tree/node';
import { Fragment } from 'tree/fragment';
import { assert } from 'test/support/assert';
import { MathField } from 'commands/math';

suite('Cursor::select()', function () {
	const cursor = new Controller(new MathField.RootBlock(), document.createElement('span'), new Options()).cursor;
	cursor.selectionChanged = noop;

	const assertSelection = (A: Point, B: Point, leftEnd?: TNode, rightEnd?: TNode) => {
		const lca = leftEnd?.parent,
			frag = new Fragment(leftEnd, rightEnd || leftEnd);

		(function eitherOrder(A, B) {
			let count = 0;
			if (lca) {
				lca.selectChildren = function (leftEnd, rightEnd) {
					count += 1;
					assert.equal(frag.ends.left, leftEnd);
					assert.equal(frag.ends.right, rightEnd);
					return TNode.prototype.selectChildren.apply(this, [leftEnd, rightEnd]);
				};
			}

			cursor.parent = A.parent;
			cursor.left = A.left;
			cursor.right = A.right;
			cursor.startSelection();
			cursor.parent = B.parent;
			cursor.left = B.left;
			cursor.right = B.right;
			assert.equal(cursor.select(), true);
			assert.equal(count, 1);

			return eitherOrder;
		})(A, B)(B, A);
	};

	const parent = new TNode();
	const child1 = new TNode().adopt(parent, parent.ends.right);
	const child2 = new TNode().adopt(parent, parent.ends.right);
	const child3 = new TNode().adopt(parent, parent.ends.right);
	const A = new Point(parent, undefined, child1);
	const B = new Point(parent, child1, child2);
	const C = new Point(parent, child2, child3);
	const D = new Point(parent, child3, undefined);
	const pt1 = new Point(child1);
	const pt2 = new Point(child2);
	const pt3 = new Point(child3);

	test('same parent, one TNode', function () {
		assertSelection(A, B, child1);
		assertSelection(B, C, child2);
		assertSelection(C, D, child3);
	});

	test('same Parent, many Nodes', function () {
		assertSelection(A, C, child1, child2);
		assertSelection(A, D, child1, child3);
		assertSelection(B, D, child2, child3);
	});

	test('Point next to parent of other Point', function () {
		assertSelection(A, pt1, child1);
		assertSelection(B, pt1, child1);

		assertSelection(B, pt2, child2);
		assertSelection(C, pt2, child2);

		assertSelection(C, pt3, child3);
		assertSelection(D, pt3, child3);
	});

	test("Points' parents are siblings", function () {
		assertSelection(pt1, pt2, child1, child2);
		assertSelection(pt2, pt3, child2, child3);
		assertSelection(pt1, pt3, child1, child3);
	});

	test('Point is sibling of parent of other Point', function () {
		assertSelection(A, pt2, child1, child2);
		assertSelection(A, pt3, child1, child3);
		assertSelection(B, pt3, child2, child3);
		assertSelection(pt1, D, child1, child3);
		assertSelection(pt1, C, child1, child2);
	});

	test('same Point', function () {
		cursor.parent = A.parent;
		cursor.left = A.left;
		cursor.right = A.right;
		cursor.startSelection();
		assert.equal(cursor.select(), false);
	});

	test('different trees', function () {
		const anotherTree = new TNode();

		cursor.parent = A.parent;
		cursor.left = A.left;
		cursor.right = A.right;
		cursor.startSelection();
		cursor.parent = anotherTree;
		delete cursor.left;
		delete cursor.right;
		assert.throws(() => cursor.select());

		cursor.parent = anotherTree;
		delete cursor.left;
		delete cursor.right;
		cursor.startSelection();
		cursor.parent = A.parent;
		cursor.left = A.left;
		cursor.right = A.right;
		assert.throws(() => cursor.select());
	});
});
