// Extension to the Controller that allows exporting of  math in a human-readable text format.

import type { Constructor } from 'src/constants';
import type { ControllerBase } from 'src/controller';

export const ExportText = <TBase extends Constructor<ControllerBase>>(Base: TBase) =>
	class extends Base {
		exportText() {
			return this.root.foldChildren('', (text, child) => text + child.text());
		}
	};
