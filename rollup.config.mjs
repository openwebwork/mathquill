import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

export default [
	{
		input: 'src/publicapi.ts',
		output: [
			{ file: 'dist/index.cjs', format: 'cjs' },
			{ file: 'dist/index.mjs', format: 'es' }
		],
		plugins: [typescript({ tsconfig: 'tsconfig-lib.json' })],
		onLog(level, log, handler) {
			// The circular dependencies that are detected don't matter once bundled. So hide the warnings about them.
			if (log.code === 'CIRCULAR_DEPENDENCY') return;
			handler(level, log);
		}
	},
	{
		input: 'src/publicapi.ts',
		output: [
			{ file: 'dist/index.d.cts', format: 'cjs' },
			{ file: 'dist/index.d.mts', format: 'es' }
		],
		plugins: [dts({ tsconfig: 'tsconfig-lib.json' })]
	}
];
