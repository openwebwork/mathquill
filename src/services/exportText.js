// Extension to the Controller that allows exporting of  math in a human-readable text format.

export const ExportText = (base) => class extends base {
	exportText() {
		return this.root.foldChildren('', (text, child) => text + child.text());
	};
};
