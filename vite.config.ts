import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
	build: {
		target: 'chrome105',
		lib: {
			entry: join(projectRoot, 'src/index.ts'),
			formats: ['es'],
			fileName: () => 'index.js',
		},
		sourcemap: true,
		minify: false,
		emptyOutDir: true,
	},
})
