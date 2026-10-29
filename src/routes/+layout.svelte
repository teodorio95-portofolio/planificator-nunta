<script lang="ts">
	import '@fontsource/cormorant-garamond/400-italic.css';
	import '@fontsource/cormorant-garamond/500.css';
	import '@fontsource/cormorant-garamond/500-italic.css';
	import '@fontsource/cormorant-garamond/600.css';
	import '@fontsource/manrope/400.css';
	import '@fontsource/manrope/500.css';
	import '@fontsource/manrope/600.css';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { modeCookie, setAppearance, THEME_COLORS, themeCookie } from '#lib/theme.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Seeded by the server from the cookies; the header changes it at once, without a reload.
	let theme = $derived(data.theme);
	let mode = $derived(data.mode);
	setAppearance({
		get theme() {
			return theme;
		},
		set theme(t) {
			theme = t;
			document.documentElement.dataset.theme = t;
			document.cookie = themeCookie(t);
		},
		get mode() {
			return mode;
		},
		set mode(m) {
			mode = m;
			document.documentElement.dataset.mode = m;
			document.cookie = modeCookie(m);
		}
	});
	const barColor = $derived(THEME_COLORS[theme]);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- Add to Home Screen / install: iOS wants an opaque PNG, not the SVG. -->
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="apple-mobile-web-app-title" content="Nunta" />
	{#if mode}
		<meta name="theme-color" content={barColor[mode]} />
	{:else}
		<meta name="theme-color" content={barColor.light} media="(prefers-color-scheme: light)" />
		<meta name="theme-color" content={barColor.dark} media="(prefers-color-scheme: dark)" />
	{/if}
	<title>Nunta noastră</title>
</svelte:head>

{@render children()}
