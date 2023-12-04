/* global suite, test, assert */

import { L, R } from 'src/constants';
import { TNode } from 'tree/node';
import { Fragment } from 'tree/fragment';

suite('tree', () => {
	suite('adopt', () => {
		const assertTwoChildren = (parent, one, two) => {
			assert.equal(one.parent, parent, 'one.parent is set');
			assert.equal(two.parent, parent, 'two.parent is set');

			assert.ok(!one[L], 'one has nothing leftward');
			assert.equal(one[R], two, 'one[R] is two');
			assert.equal(two[L], one, 'two[L] is one');
			assert.ok(!two[R], 'two has nothing rightward');

			assert.equal(parent.ends[L], one, 'parent.ends[L] is one');
			assert.equal(parent.ends[R], two, 'parent.ends[R] is two');
		};

		test('the empty case', () => {
			const parent = new TNode();
			const child = new TNode();

			child.adopt(parent);

			assert.equal(child.parent, parent, 'child.parent is set');
			assert.ok(!child[R], 'child has nothing rightward');
			assert.ok(!child[L], 'child has nothing leftward');

			assert.equal(parent.ends[L], child, 'child is parent.ends[L]');
			assert.equal(parent.ends[R], child, 'child is parent.ends[R]');
		});

		test('with two children from the left', () => {
			const parent = new TNode();
			const one = new TNode();
			const two = new TNode();

			one.adopt(parent);
			two.adopt(parent, one);

			assertTwoChildren(parent, one, two);
		});

		test('with two children from the right', () => {
			const parent = new TNode();
			const one = new TNode();
			const two = new TNode();

			two.adopt(parent);
			one.adopt(parent, undefined, two);

			assertTwoChildren(parent, one, two);
		});

		test('adding one in the middle', () => {
			const parent = new TNode();
			const leftward = new TNode();
			const rightward = new TNode();
			const middle = new TNode();

			leftward.adopt(parent);
			rightward.adopt(parent, leftward);
			middle.adopt(parent, leftward, rightward);

			assert.equal(middle.parent, parent, 'middle.parent is set');
			assert.equal(middle[L], leftward, 'middle[L] is set');
			assert.equal(middle[R], rightward, 'middle[R] is set');

			assert.equal(leftward[R], middle, 'leftward[R] is middle');
			assert.equal(rightward[L], middle, 'rightward[L] is middle');

			assert.equal(parent.ends[L], leftward, 'parent.ends[L] is leftward');
			assert.equal(parent.ends[R], rightward, 'parent.ends[R] is rightward');
		});
	});

	suite('disown', () => {
		const assertSingleChild = (parent, child) => {
			assert.equal(parent.ends[L], child, 'parent.ends[L] is child');
			assert.equal(parent.ends[R], child, 'parent.ends[R] is child');
			assert.ok(!child[L], 'child has nothing leftward');
			assert.ok(!child[R], 'child has nothing rightward');
		};

		test('the empty case', () => {
			const parent = new TNode();
			const child = new TNode();

			child.adopt(parent);
			child.disown();

			assert.ok(!parent.ends[L], 'parent has no left end child');
			assert.ok(!parent.ends[R], 'parent has no right end child');
		});

		test('disowning the right end child', () => {
			const parent = new TNode();
			const one = new TNode();
			const two = new TNode();

			one.adopt(parent);
			two.adopt(parent, one);

			two.disown();

			assertSingleChild(parent, one);

			assert.equal(two.parent, parent, 'two retains its parent');
			assert.equal(two[L], one, 'two retains its [L]');

			assert.throws(() => two.disown(), 'disown fails on a malformed tree');
		});

		test('disowning the left end child', () => {
			const parent = new TNode();
			const one = new TNode();
			const two = new TNode();

			one.adopt(parent);
			two.adopt(parent, one);

			one.disown();

			assertSingleChild(parent, two);

			assert.equal(one.parent, parent, 'one retains its parent');
			assert.equal(one[R], two, 'one retains its [R]');

			assert.throws(() => one.disown(), 'disown fails on a malformed tree');
		});

		test('disowning the middle', () => {
			const parent = new TNode();
			const leftward = new TNode();
			const rightward = new TNode();
			const middle = new TNode();

			leftward.adopt(parent);
			rightward.adopt(parent, leftward);
			middle.adopt(parent, leftward, rightward);

			middle.disown();

			assert.equal(leftward[R], rightward, 'leftward[R] is rightward');
			assert.equal(rightward[L], leftward, 'rightward[L] is leftward');
			assert.equal(parent.ends[L], leftward, 'parent.ends[L] is leftward');
			assert.equal(parent.ends[R], rightward, 'parent.ends[R] is rightward');

			assert.equal(middle.parent, parent, 'middle retains its parent');
			assert.equal(middle[R], rightward, 'middle retains its [R]');
			assert.equal(middle[L], leftward, 'middle retains its [L]');

			assert.throws(() => middle.disown(), 'disown fails on a malformed tree');
		});
	});

	suite('fragments', () => {
		test('an empty fragment', () => {
			const empty = new Fragment();
			let count = 0;

			empty.each(() => ++count);

			assert.equal(count, 0, 'each is a noop on an empty fragment');
		});

		test('half-empty fragments are disallowed', () => {
			assert.throws(() => new Fragment(new TNode(), 0), 'half-empty on the right');
			assert.throws(() => new Fragment(0, new TNode()), 'half-empty on the left');
		});

		test('directionalized constructor call', () => {
			const ChNode = class extends TNode {
				constructor(ch) {
					super();
					this.ch = ch;
				}
			};
			const parent = new TNode();
			new ChNode('a').adopt(parent, parent.ends[R]);
			const b = new ChNode('b').adopt(parent, parent.ends[R]);
			new ChNode('c').adopt(parent, parent.ends[R]);
			const d = new ChNode('d').adopt(parent, parent.ends[R]);
			new ChNode('e').adopt(parent, parent.ends[R]);

			const cat = (str, node) => str + node.ch;
			assert.equal('bcd', new Fragment(b, d).fold('', cat));
			assert.equal('bcd', new Fragment(b, d, L).fold('', cat));
			assert.equal('bcd', new Fragment(d, b, R).fold('', cat));
			assert.throws(() => new Fragment(d, b, L));
			assert.throws(() => new Fragment(b, d, R));
		});

		test('disown is idempotent', () => {
			const parent = new TNode();
			const one = new TNode().adopt(parent);
			const two = new TNode().adopt(parent, one);

			const frag = new Fragment(one, two);
			frag.disown();
			frag.disown();
		});
	});
});
