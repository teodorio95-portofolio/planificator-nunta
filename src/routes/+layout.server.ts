import type { LayoutServerLoad } from './$types';

// Every page, the RSVP and sign-in pages too, renders in the look chosen on this device.
export const load: LayoutServerLoad = ({ locals }) => ({ theme: locals.theme, mode: locals.mode });
