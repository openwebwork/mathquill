import { TNode } from 'tree/node';
import { Fragment } from 'tree/fragment';
import { assert } from './support/assert';

suite('tree', function () {
	suite('adopt', function () {
		const assertTwoChildren = (parent, one, two) => {
			assert.equal(one.parent, parent, 'one.parent is set');
			assert.equal(two.parent, parent, 'two.parent is set');

			assert.ok(!one.left, 'one has nothing leftward');
			assert.equal(one.right, two, 'one.right is two');
			assert.equal(two.left, one, 'two.left is one');
			assert.ok(!two.right, 'two has nothing rightward');

			assert.equal(parent.ends.left, one, 'parent.ends.left is one');
			assert.equal(parent.ends.right, two, 'parent.ends.right is two');
		};

		test('the empty case', function () {
			const parent = new TNode();
			const child = new TNode();

			child.adopt(parent);

			assert.equal(child.parent, parent, 'child.parent is set');
			assert.ok(!child.right, 'child has nothing rightward');
			assert.ok(!child.left, 'child has nothing leftward');

			assert.equal(parent.ends.left, child, 'child is parent.ends.left');
			assert.equal(parent.ends.right, child, 'child is parent.ends.right');
		});

		test('with two children from the left', function () {
			const parent = new TNode();
			const one = new TNode();
			const two = new TNode();

			one.adopt(parent);
			two.adopt(parent, one);

			assertTwoChildren(parent, one, two);
		});

		test('with two children from the right', function () {
			const parent = new TNode();
			const one = new TNode();
			const two = new TNode();

			two.adopt(parent);
			one.adopt(parent, undefined, two);

			assertTwoChildren(parent, one, two);
		});

		test('adding one in the middle', function () {
			const parent = new TNode();
			const leftward = new TNode();
			const rightward = new TNode();
			const middle = new TNode();

			leftward.adopt(parent);
			rightward.adopt(parent, leftward);
			middle.adopt(parent, leftward, rightward);

			assert.equal(middle.parent, parent, 'middle.parent is set');
			assert.equal(middle.left, leftward, 'middle.left is set');
			assert.equal(middle.right, rightward, 'middle.right is set');

			assert.equal(leftward.right, middle, 'leftward.right is middle');
			assert.equal(rightward.left, middle, 'rightward.left is middle');

			assert.equal(parent.ends.left, leftward, 'parent.ends.left is leftward');
			assert.equal(parent.ends.right, rightward, 'parent.ends.right is rightward');
		});
	});

	suite('disown', function () {
		const assertSingleChild = (parent, child) => {
			assert.equal(parent.ends.left, child, 'parent.ends.left is child');
			assert.equal(parent.ends.right, child, 'parent.ends.right is child');
			assert.ok(!child.left, 'child has nothing leftward');
			assert.ok(!child.right, 'child has nothing rightward');
		};

		test('the empty case', function () {
			const parent = new TNode();
			const child = new TNode();

			child.adopt(parent);
			child.disown();

			assert.ok(!parent.ends.left, 'parent has no left end child');
			assert.ok(!parent.ends.right, 'parent has no right end child');
		});

		test('disowning the right end child', function () {
			const parent = new TNode();
			const one = new TNode();
			const two = new TNode();

			one.adopt(parent);
			two.adopt(parent, one);

			two.disown();

			assertSingleChild(parent, one);

			assert.equal(two.parent, parent, 'two retains its parent');
			assert.equal(two.left, one, 'two retains its .left');

			assert.throws(() => two.disown(), 'disown fails on a malformed tree');
		});

		test('disowning the left end child', function () {
			const parent = new TNode();
			const one = new TNode();
			const two = new TNode();

			one.adopt(parent);
			two.adopt(parent, one);

			one.disown();

			assertSingleChild(parent, two);

			assert.equal(one.parent, parent, 'one retains its parent');
			assert.equal(one.right, two, 'one retains its .right');

			assert.throws(() => one.disown(), 'disown fails on a malformed tree');
		});

		test('disowning the middle', function () {
			const parent = new TNode();
			const leftward = new TNode();
			const rightward = new TNode();
			const middle = new TNode();

			leftward.adopt(parent);
			rightward.adopt(parent, leftward);
			middle.adopt(parent, leftward, rightward);

			middle.disown();

			assert.equal(leftward.right, rightward, 'leftward.right is rightward');
			assert.equal(rightward.left, leftward, 'rightward.left is leftward');
			assert.equal(parent.ends.left, leftward, 'parent.ends.left is leftward');
			assert.equal(parent.ends.right, rightward, 'parent.ends.right is rightward');

			assert.equal(middle.parent, parent, 'middle retains its parent');
			assert.equal(middle.right, rightward, 'middle retains its .right');
			assert.equal(middle.left, leftward, 'middle retains its .left');

			assert.throws(() => middle.disown(), 'disown fails on a malformed tree');
		});
	});

	suite('fragments', function () {
		test('an empty fragment', function () {
			const empty = new Fragment();
			let count = 0;

			empty.each(() => ++count);

			assert.equal(count, 0, 'each is a noop on an empty fragment');
		});

		test('half-empty fragments are disallowed', function () {
			assert.throws(() => new Fragment(new TNode(), 0), 'half-empty on the right');
			assert.throws(() => new Fragment(0, new TNode()), 'half-empty on the left');
		});

		test('directionalized constructor call', function () {
			const ChNode = class extends TNode {
				constructor(ch) {
					super();
					this.ch = ch;
				}
			};
			const parent = new TNode();
			new ChNode('a').adopt(parent, parent.ends.right);
			const b = new ChNode('b').adopt(parent, parent.ends.right);
			new ChNode('c').adopt(parent, parent.ends.right);
			const d = new ChNode('d').adopt(parent, parent.ends.right);
			new ChNode('e').adopt(parent, parent.ends.right);

			const cat = (str, node) => str + node.ch;
			assert.equal('bcd', new Fragment(b, d).fold('', cat));
			assert.equal('bcd', new Fragment(b, d, 'left').fold('', cat));
			assert.equal('bcd', new Fragment(d, b, 'right').fold('', cat));
			assert.throws(() => new Fragment(d, b, 'left'));
			assert.throws(() => new Fragment(b, d, 'right'));
		});

		test('disown is idempotent', function () {
			const parent = new TNode();
			const one = new TNode().adopt(parent);
			const two = new TNode().adopt(parent, one);

			const frag = new Fragment(one, two);
			frag.disown();
			frag.disown();
		});
	});
});
