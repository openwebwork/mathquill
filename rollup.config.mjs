import typescript from 'rollup-plugin-ts';

export default {
	input: 'src/publicapi.ts',
	output: [
		{ file: 'dist/index.cjs', format: 'cjs' },
		{ file: 'dist/index.mjs', format: 'es' }
	],
	plugins: [
		typescript({ browserslist: false, tsconfig: (resolvedConfig) => ({ ...resolvedConfig, declaration: true }) })
	],
	onLog(level, log, handler) {
		// The circular dependencies that are detected don't matter once bundled. So hide the warnings about them.
		if (log.code === 'CIRCULAR_DEPENDENCY') return;
		handler(level, log);
	}
};
