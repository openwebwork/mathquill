import MathQuill from '__PUBLIC_API__';
import 'css/main.less';

declare global {
	const VERSION: string;
}

MathQuill.VERSION = VERSION;

window.MathQuill = MathQuill;
