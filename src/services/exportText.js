// Export math in a human-readable text format
// As you can see, only half-baked so far.

Controller.prototype.exportText = function() {
	return this.root.foldChildren('', (text, child) => text + child.text());
};
