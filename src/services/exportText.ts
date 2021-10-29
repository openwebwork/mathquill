// Extension to the Controller that allows exporting of  math in a human-readable text format.

import type { Controllerable } from 'src/controller';

export const ExportText = <TBase extends Controllerable>(Base: TBase) => class extends Base {
	exportText() {
		return this.root.foldChildren('', (text, child) => text + child.text());
	};
};
