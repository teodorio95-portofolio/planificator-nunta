import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter(),
			// adapter-node guesses an https origin from the Host header, which would refuse every form on
			// plain http://localhost. hooks.server.ts checks Origin against Host instead, scheme-agnostic.
			csrf: { trustedOrigins: ['*'] }
		})
	]
});
