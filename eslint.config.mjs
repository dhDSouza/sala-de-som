import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'
import prettierRecommended from 'eslint-plugin-prettier/recommended'

export default defineConfig([
	...nextVitals,
	...nextTypeScript,
	prettierRecommended,
	{
		rules: {
			'react-hooks/set-state-in-effect': 'off',
			'padding-line-between-statements': [
				'error',
				{ blankLine: 'always', prev: 'directive', next: '*' },
				{ blankLine: 'any', prev: 'directive', next: 'directive' },
				{ blankLine: 'always', prev: 'import', next: '*' },
				{ blankLine: 'any', prev: 'import', next: 'import' },
				{ blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
				{ blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
				{ blankLine: 'always', prev: '*', next: ['function', 'class'] },
				{ blankLine: 'always', prev: ['function', 'class'], next: '*' },
				{ blankLine: 'always', prev: '*', next: 'return' },
			],
		},
	},
	globalIgnores(['.next/**', 'node_modules/**', 'dist-db/**']),
])
