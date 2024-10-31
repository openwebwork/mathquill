// Virtual Node class

import type { Direction } from 'src/constants';
import { L } from 'src/constants';

export class VNode {
	contents: Node[] = [];

	constructor(dom?: string | Node | Node[] | VNode) {
		if (dom instanceof VNode) this.contents.push(...dom.contents);
		else if (dom instanceof Node) this.contents.push(dom);
		else if (dom instanceof Array) this.contents.push(...dom);
		else if (dom) {
			const fragment = document.createRange().createContextualFragment(dom);
			this.contents.push(...fragment.children);
		}
	}

	add(el: Node | Node[] | VNode) {
		this.contents.push(...(el instanceof VNode ? el.contents : el instanceof Array ? el : [el]));

		// Sort the contents into document order.
		this.contents.sort((a: Node, b: Node) => {
			if (a === b) return 0;

			const position = a.compareDocumentPosition(b);

			if (position & Node.DOCUMENT_POSITION_FOLLOWING || position & Node.DOCUMENT_POSITION_CONTAINED_BY)
				return -1;
			else if (position & Node.DOCUMENT_POSITION_PRECEDING || position & Node.DOCUMENT_POSITION_CONTAINS)
				return 1;

			return 0;
		});
	}

	// The following methods are guaranteed to return a valid Element or CharacterData object.
	get first() {
		return this.contents[0] instanceof Element || this.contents[0] instanceof CharacterData
			? this.contents[0]
			: document.createElement('span');
	}
	get last() {
		const last = this.contents[this.contents.length - 1];
		return last instanceof Element || last instanceof CharacterData ? last : document.createElement('span');
	}

	// These methods are guaranteed to return a valid HTMLElement object.
	get firstElement() {
		return this.first instanceof HTMLElement ? this.first : document.createElement('span');
	}
	get lastElement() {
		return this.last instanceof HTMLElement ? this.last : document.createElement('span');
	}

	detach() {
		this.contents.forEach((child) => {
			(child as Element).remove();
		});
	}

	remove() {
		this.detach();
		this.contents = [];
	}

	empty() {
		this.contents.forEach((child) => {
			while (child.firstChild) child.firstChild.remove();
			child.textContent = '';
		});
	}

	children(selector?: string) {
		return new VNode(
			this.contents.reduce<Node[]>((ret, el) => {
				ret.push(
					...Array.from(el.childNodes).filter((child) => {
						return (
							child.nodeType !== 3 && (!selector || (child instanceof Element && child.matches(selector)))
						);
					})
				);
				return ret;
			}, [])
		);
	}

	find(selector: string) {
		return new VNode(
			this.contents.reduce<Node[]>((ret, el) => {
				ret.push(...(el as Element).querySelectorAll(selector));
				return ret;
			}, [])
		);
	}

	addClass(...tokens: string[]) {
		this.contents.forEach((child) => {
			if (child instanceof Element) child.classList.add(...tokens);
		});
	}

	removeClass(...tokens: string[]) {
		this.contents.forEach((child) => {
			if (child instanceof Element) child.classList.remove(...tokens);
		});
	}

	toggleClass(token: string, state: boolean) {
		this.contents.forEach((child) => {
			if (child instanceof Element) child.classList.toggle(token, state);
		});
	}

	hasClass(token: string) {
		for (const child of this.contents) {
			if (child instanceof Element && child.classList.contains(token)) return true;
		}
		return false;
	}

	html(contents: string): this;
	html(): string;
	html(contents?: string): string | this {
		if (typeof contents === 'string') {
			this.contents.forEach((elt) => {
				if (elt instanceof Element) elt.innerHTML = contents;
			});
			return this;
		}
		return this.firstElement.innerHTML;
	}

	text(contents: string): this;
	text(): string;
	text(contents?: string): string | this {
		if (contents) {
			this.contents.forEach((elt) => {
				if (elt instanceof Element) elt.textContent = contents;
			});
			return this;
		}
		return this.contents.reduce((ret, child) => {
			return `${ret}${child.textContent ?? ''}`;
		}, '');
	}

	insDirOf(dir: Direction, vNode: Element | CharacterData | VNode) {
		if (vNode instanceof VNode && !vNode.contents.length) return;
		if (dir === L) (vNode instanceof VNode ? vNode.first : vNode).before(...this.contents);
		else (vNode instanceof VNode ? vNode.last : vNode).after(...this.contents);
	}

	insAtDirEnd(dir: Direction, vNode: Element | VNode) {
		if (vNode instanceof VNode && !vNode.contents.length) return;
		if (dir === L) (vNode instanceof VNode ? vNode.firstElement : vNode).prepend(...this.contents);
		else (vNode instanceof VNode ? vNode.lastElement : vNode).append(...this.contents);
	}
}
