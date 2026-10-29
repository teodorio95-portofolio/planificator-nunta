import { defineConfig } from 'vitest/config';

// Unit tests cover the pure modules in src/lib, so they run without the SvelteKit plugin.
export default defineConfig({
	test: {
		include: ['src/**/*.test.ts']
	}
});
