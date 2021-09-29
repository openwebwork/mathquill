// Controller for a MathQuill instance,
// on which services are registered with

// Controller.open(function(_) { ... });

class Controller {
	constructor(root, container, options) {
		this.id = root.id;
		this.data = {};

		this.root = root;
		this.container = container;
		this.options = options;

		root.controller = this;

		this.cursor = new Cursor(root, options);
	}

	handle(name, dir) {
		const handlers = this.options.handlers;
		if (handlers && handlers.fns[name]) {
			const mq = new handlers.APIClasses[this.KIND_OF_MQ](this);
			if (dir === L || dir === R) handlers.fns[name](dir, mq);
			else handlers.fns[name](mq);
		}
	}

	static notifyees = [];

	static onNotify(f) { Controller.notifyees.push(f); };

	notify(...args) {
		for (const notifyee of Controller.notifyees) {
			notifyee.apply(this.cursor, args);
		}
		return this;
	}
}
