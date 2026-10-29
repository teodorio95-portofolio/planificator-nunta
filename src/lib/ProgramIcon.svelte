<script lang="ts">
	import type { ProgramIcon } from '#lib/invitation.ts';

	// Line drawings for the moments of the program (src/lib/invitation.ts picks which), in the
	// invitation's ink colour: drawn here so the app ships no third-party artwork.
	let { name }: { name: ProgramIcon } = $props();
</script>

<svg viewBox="0 0 64 64" aria-hidden="true">
	{#if name === 'biserica'}
		<path d="M32 6v10M28 10h8M20 30l12-14 12 14M22 28v28h20V28M14 56h36M28 56V44a4 4 0 018 0v12M30 32h4v5h-4z" />
	{:else if name === 'sampanie'}
		<path
			d="M18 10h12l-1 14a5 5 0 01-10 0zM24 29v20M18 50h12M34 10h12l1 14a5 5 0 01-10 0zM40 29v20M34 50h12M19 17h10M35 17h10"
		/>
		<path d="M30 6l2-3M34 6l-2-3M32 8v-2" />
	{:else if name === 'cina'}
		<circle cx="32" cy="34" r="14" />
		<circle cx="32" cy="34" r="9" />
		<path d="M10 18v10a3 3 0 006 0V18M13 31v19M54 18c-4 2-5 8-5 14h5v18" />
	{:else if name === 'tort'}
		<path d="M16 54V40h32v14M20 40V28h24v12M24 28v-8h16v8M12 54h40M32 20v-6" />
		<path d="M32 14c-2-2-1-5 0-6 1 1 2 4 0 6zM16 46c4 3 8-3 12 0s8-3 12 0 8 3 8 0M20 34c3 2 6-2 8 0s5-2 8 0 6 2 8 0" />
	{:else if name === 'dans'}
		<circle cx="24" cy="12" r="4" />
		<circle cx="40" cy="12" r="4" />
		<path d="M24 16v16l-4 22M24 24l8 4 8-4M40 16v12l10 26H30l6-26M24 32l4 22" />
	{:else if name === 'disco'}
		<path d="M32 4v8" />
		<circle cx="32" cy="28" r="16" />
		<path d="M16 28h32M32 12v32M20 18h24M20 38h24M26 13c-3 9-3 21 0 30M38 13c3 9 3 21 0 30" />
		<path d="M8 50l3 3M56 50l-3 3M6 40h4M54 40h4" />
	{:else}
		<path d="M40 10a20 20 0 1014 34A18 18 0 0140 10z" />
		<path d="M14 14l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5zM50 52l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
	{/if}
</svg>

<style>
	svg {
		width: 100%;
		height: 100%;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
