// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { User } from '#lib/access.ts';
import type { Mode, Theme } from '#lib/theme.ts';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Set by hooks.server.ts on every request; null = not signed in. */
			user: User | null;
			/** The colour theme from the cookie; '' = the original. */
			theme: Theme;
			/** Light or dark from the cookie; '' = the device's own. */
			mode: Mode;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
