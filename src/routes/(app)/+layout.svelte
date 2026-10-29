<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { PREVIEW_PATH, ROLE_LABELS } from '#lib/access.ts';
	import { daysBetween, todayIso } from '#lib/calc.ts';
	import InstallHint from '#lib/InstallHint.svelte';
	import { getAppearance, MODE_LABELS, MODES, THEME_LABELS } from '#lib/theme.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Line icons for the sections, one path each (a circle is two arcs).
	const ring = (x: number, y: number, r: number) =>
		`M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
	const nav = $derived([
		{ href: '/', label: 'Acasă', icon: 'M4 10.5 12 4l8 6.5V20H14.5v-5.5h-5V20H4z' },
		{
			href: '/invitati',
			label: 'Invitați',
			icon: `${ring(9, 8.5, 3.2)}M3 19.5a6 6 0 0 1 12 0${ring(17, 9.5, 2.4)}M16.5 14.4a4.6 4.6 0 0 1 4.5 4.6`
		},
		{
			href: '/mese',
			label: 'Mese',
			icon: `${ring(12, 12, 4.5)}${ring(12, 3.8, 1.3)}${ring(12, 20.2, 1.3)}${ring(3.8, 12, 1.3)}${ring(20.2, 12, 1.3)}`
		},
		{
			href: '/buget',
			label: 'Buget',
			icon: 'M3.5 7.5h17v12h-17zM3.5 7.5l13-3.5v3.5M16 13.5h1.5'
		},
		{
			href: '/sarcini',
			label: 'Sarcini',
			icon: 'M10 6.5h10M10 12h10M10 17.5h10M3.5 6.5l1.5 1.5 2.5-3M3.5 12l1.5 1.5 2.5-3M4 17.5h3'
		},
		{ href: '/desfasurator', label: 'Desfășurător', icon: `${ring(12, 12, 8.5)}M12 7v5l3.2 2` },
		...(data.user.role === 'admin'
			? [
					{ href: '/notite', label: 'Notițe', icon: 'M6 3.5h8.5l4 4v13H6zM14.5 3.5v4h4M9 12h6.5M9 15.5h4.5' },
					{
						href: '/setari',
						label: 'Setări',
						icon: `M4 7h9M18 7h2M4 17h3M11 17h9${ring(15.5, 7, 2.3)}${ring(9, 17, 2.3)}`
					}
				]
			: [])
	]);

	const couple = $derived(
		[data.settings.partner1, data.settings.partner2].filter(Boolean).join(' & ') || 'Nunta noastră'
	);
	const daysLeft = $derived(
		data.settings.wedding_date ? daysBetween(todayIso(), data.settings.wedding_date) : null
	);
	// A reader has no Setări, so the preview starts from Acasă when switched on there.
	const previewNext = $derived(page.url.pathname.startsWith('/setari') ? '/' : page.url.pathname);
	const look = getAppearance();
	// The account menu (light or dark, preview, sign out) sits behind the initial, and on a phone the
	// sections sit behind the menu button, so the bar stays one line. A tap elsewhere, Escape or
	// moving to another page closes them.
	let account = $state<HTMLDetailsElement>();
	let sections = $state<HTMLDetailsElement>();
	const closeMenus = (e?: Event) => {
		for (const menu of [account, sections]) {
			if (menu?.open && !(e instanceof MouseEvent && menu.contains(e.target as Node))) menu.open = false;
		}
	};
	afterNavigate(() => closeMenus());
	// On Acasă the cover photo runs up behind the header; the header takes its own background back
	// once the page scrolls.
	let scrollY = $state(0);
	const overPhoto = $derived(!!data.cover && page.url.pathname === '/' && scrollY < 8);
	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	const countdown = $derived(
		daysLeft === null || daysLeft < 0 ? '' : daysLeft === 0 ? 'Astăzi!' : `${daysLeft} ${daysLeft === 1 ? 'zi' : 'zile'}`
	);
</script>

{#snippet icon(d: string)}
	<svg viewBox="0 0 24 24" aria-hidden="true"><path {d} /></svg>
{/snippet}

<header class="no-print" class:over-photo={overPhoto}>
	<div class="bar">
		<details class="sections" bind:this={sections}>
			<summary aria-label="Secțiuni">
				<span></span><span></span><span></span>
			</summary>
			<nav class="panel" aria-label="Secțiuni">
				{#if countdown}<p class="countdown">{countdown} până la nuntă</p>{/if}
				{#each nav as item (item.href)}
					<a href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
						{@render icon(item.icon)}{item.label}
					</a>
				{/each}
			</nav>
		</details>
		<a class="brand" href="/">{couple}</a>
		<div class="bar-end">
			{#if countdown}<span class="countdown">{countdown}</span>{/if}
			<button
				type="button"
				class="theme"
				onclick={() => (look.theme = look.theme ? '' : 'nunta')}
				aria-pressed={look.theme === 'nunta'}
				aria-label="Tema: {THEME_LABELS.nunta}"
				title={look.theme ? `Înapoi la tema ${THEME_LABELS[''].toLowerCase()}` : THEME_LABELS.nunta}
			>
				<span></span><span></span><span></span>
			</button>
			<details class="account" bind:this={account}>
				<summary aria-label="Contul vostru" title={data.user.email}>
					{data.user.email.charAt(0).toUpperCase()}
				</summary>
				<div class="menu">
					<p class="who">
						{ROLE_LABELS[data.user.role]}
						{#if data.authEnabled}<span class="small muted">{data.user.email}</span>{/if}
					</p>
					<div class="modes" role="radiogroup" aria-label="Aspect">
						{#each MODES as m (m)}
							<button type="button" role="radio" aria-checked={look.mode === m} onclick={() => (look.mode = m)}>
								<svg viewBox="0 0 24 24" aria-hidden="true">
									{#if m === 'light'}
										<circle cx="12" cy="12" r="4.5" />
										<path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
									{:else if m === 'dark'}
										<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
									{:else}
										<circle cx="12" cy="12" r="8.5" />
										<path d="M12 3.5a8.5 8.5 0 0 1 0 17z" class="fill" />
									{/if}
								</svg>
								{MODE_LABELS[m]}
							</button>
						{/each}
					</div>
					{#if data.user.role === 'admin'}
						<form method="POST" action={PREVIEW_PATH}>
							<input type="hidden" name="as" value="reader" />
							<input type="hidden" name="next" value={previewNext} />
							<button title="Vedeți aplicația cum o văd nașii și părinții">Vezi ca reader</button>
						</form>
					{/if}
					{#if data.authEnabled}
						<form method="POST" action="/logout"><button>Ieșire</button></form>
					{/if}
				</div>
			</details>
		</div>
	</div>
	<nav class="tabs" aria-label="Secțiuni">
		<div>
			{#each nav as item (item.href)}
				<a href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
					{@render icon(item.icon)}{item.label}
				</a>
			{/each}
		</div>
	</nav>
</header>

<svelte:window bind:scrollY onclick={closeMenus} onkeydown={(e) => e.key === 'Escape' && closeMenus()} />

{#if data.user.previewing}
	<form method="POST" action={PREVIEW_PATH} class="preview no-print">
		<input type="hidden" name="next" value={page.url.pathname} />
		<span>Vedeți aplicația ca un cont <strong>Doar citire</strong>, exact cum o văd nașii și părinții.</span>
		<button class="btn small">Înapoi la administrator</button>
	</form>
{/if}

<main class="page">
	<InstallHint />
	{#if data.user.role === 'reader'}
		<p class="flash no-print">Puteți vedea totul, dar nu puteți modifica nimic.</p>
	{/if}
	{@render children()}
</main>

<style>
	header {
		background: color-mix(in srgb, var(--header, var(--bg)) 88%, transparent);
		backdrop-filter: blur(8px);
		position: sticky;
		top: 0;
		z-index: 10;
		/* Below the status bar when opened from the Home Screen. */
		padding-top: env(safe-area-inset-top);
	}
	header {
		transition:
			background-color 0.3s,
			backdrop-filter 0.3s;
	}
	/* Frosted glass over the photo, with the ribbon or hairline faint beneath it. */
	header.over-photo {
		background: color-mix(in srgb, var(--header, var(--bg)) 66%, transparent);
		backdrop-filter: blur(6px) saturate(1.1);
	}
	header.over-photo::after {
		opacity: 0.55;
	}
	/* A hairline, or a ribbon of the palette with the wedding theme. */
	header::after {
		transition: opacity 0.3s;
		content: '';
		position: absolute;
		inset: auto 0 0;
		height: var(--ribbon-height, 1px);
		background: var(--ribbon, var(--line));
	}
	/* On a phone or tablet the header stays put: dragging it neither scrolls nor pulls the page. */
	@media (pointer: coarse) {
		header {
			touch-action: none;
		}
	}
	.bar {
		max-width: 1080px;
		margin: 0 auto;
		padding: 12px 16px 4px;
		/* Above the sections, so the account menu opens over them. */
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.brand {
		font-family: var(--serif);
		font-size: 1.55rem;
		font-style: italic;
		color: var(--brand, var(--ink));
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bar-end {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: none;
	}
	/* Three dots of the wedding palette; ringed while it is on. */
	.theme {
		display: flex;
		padding: 4px;
		border: 1px solid transparent;
		border-radius: 999px;
		background: none;
		cursor: pointer;
	}
	.theme[aria-pressed='true'] {
		border-color: var(--line);
		background: var(--surface);
	}
	.theme span {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #e7c6d3;
		box-shadow: 0 0 0 1.5px var(--bg);
	}
	.theme span + span {
		margin-left: -5px;
	}
	.theme span:nth-child(2) {
		background: #c9b8d9;
	}
	.theme span:nth-child(3) {
		background: #f4a684;
	}
	@media (pointer: coarse) {
		/* A finger-sized target without growing the bar. */
		.theme {
			padding: 10px;
			margin: -6px -10px -6px 0;
		}
	}
	.countdown {
		font-size: 0.78rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--gold);
	}
	/* The sections as one bar of buttons, each label bold, the open one filled. */
	.tabs {
		max-width: 1080px;
		margin: 0 auto;
		padding: 4px 16px 12px;
		display: flex;
	}
	.tabs > div {
		flex: 1;
		display: flex;
		gap: 4px;
		padding: 4px;
		background: color-mix(in srgb, var(--surface) 85%, transparent);
		border: 1px solid var(--line);
		border-radius: 999px;
		box-shadow: var(--shadow);
	}
	.tabs a {
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		padding: 8px 10px;
		border-radius: 999px;
		color: color-mix(in srgb, var(--ink) 80%, var(--muted));
		text-decoration: none;
		font-size: 0.88rem;
		font-weight: 600;
		white-space: nowrap;
		transition:
			color 0.15s,
			background-color 0.15s;
	}
	.tabs a:hover {
		color: var(--ink);
		background: var(--surface-2);
	}
	.tabs a[aria-current='page'] {
		color: var(--nav-active, var(--accent-ink));
		background: var(--accent-soft);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nav-active, var(--accent)) 40%, transparent);
	}
	nav svg {
		flex: none;
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	/* On a phone the sections hide behind the menu button, left of the names. */
	.sections {
		display: none;
	}
	@media (max-width: 820px) {
		.tabs,
		.bar-end > .countdown {
			display: none;
		}
		.bar {
			justify-content: flex-start;
			padding-bottom: 12px;
		}
		.bar-end {
			margin-left: auto;
		}
		.brand {
			font-size: 1.4rem;
		}
		.sections {
			display: block;
			flex: none;
		}
	}
	.sections summary {
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 4px;
		width: 36px;
		height: 36px;
		margin-left: -6px;
		border-radius: 10px;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}
	.sections summary::-webkit-details-marker {
		display: none;
	}
	.sections summary span {
		width: 18px;
		height: 1.5px;
		border-radius: 1px;
		background: var(--ink);
		transition: transform 0.2s ease, opacity 0.2s ease;
	}
	/* The three lines turn into a cross while it is open. */
	.sections[open] summary span:nth-child(1) {
		transform: translateY(5.5px) rotate(45deg);
	}
	.sections[open] summary span:nth-child(2) {
		opacity: 0;
	}
	.sections[open] summary span:nth-child(3) {
		transform: translateY(-5.5px) rotate(-45deg);
	}
	.panel {
		position: absolute;
		top: calc(100% - 4px);
		left: 12px;
		right: 12px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		padding: 10px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 16px;
		box-shadow: 0 18px 40px rgb(0 0 0 / 0.14);
		animation: drop 0.18s ease-out;
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
	}
	.panel .countdown {
		grid-column: 1 / -1;
		margin: 2px 4px 6px;
	}
	.panel a {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 13px 12px;
		border-radius: 11px;
		background: var(--surface-2);
		color: var(--ink);
		text-decoration: none;
		font-size: 0.95rem;
	}
	.panel a svg {
		width: 20px;
		height: 20px;
		color: var(--muted);
	}
	.panel a[aria-current='page'] {
		background: var(--accent-soft);
		color: var(--nav-active, var(--accent-ink));
		font-weight: 600;
	}
	.panel a[aria-current='page'] svg {
		color: inherit;
	}
	.account {
		position: relative;
	}
	.account summary {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: var(--accent-soft);
		color: var(--nav-active, var(--accent-ink));
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}
	.account summary::-webkit-details-marker {
		display: none;
	}
	.account[open] summary {
		box-shadow: 0 0 0 2px var(--bg), 0 0 0 3px var(--nav-active, var(--accent));
	}
	@media (pointer: coarse) {
		.account summary {
			width: 36px;
			height: 36px;
		}
	}
	.menu {
		position: absolute;
		right: 0;
		top: calc(100% + 8px);
		z-index: 1;
		min-width: 240px;
		padding: 6px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 12px;
		box-shadow: var(--shadow);
	}
	.menu > form button {
		display: block;
		width: 100%;
		padding: 9px 10px;
		border: 0;
		border-radius: 8px;
		background: none;
		text-align: left;
		font-size: 0.9rem;
		cursor: pointer;
	}
	.menu > form button:hover {
		background: var(--surface-2);
	}
	/* Automat / Luminos / Întunecat, side by side. */
	.modes {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2px;
		margin: 2px 0 6px;
		padding: 3px;
		border-radius: 10px;
		background: var(--surface-2);
	}
	.modes button {
		display: grid;
		justify-items: center;
		gap: 3px;
		padding: 7px 4px;
		border: 0;
		border-radius: 8px;
		background: none;
		color: var(--muted);
		font-size: 0.74rem;
		cursor: pointer;
	}
	.modes button[aria-checked='true'] {
		background: var(--surface);
		color: var(--nav-active, var(--accent-ink));
		box-shadow: var(--shadow);
		font-weight: 600;
	}
	.modes svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.modes svg .fill {
		fill: currentColor;
		stroke: none;
	}
	.who {
		display: grid;
		margin: 0 0 4px;
		padding: 6px 10px 8px;
		border-bottom: 1px solid var(--line);
		font-size: 0.82rem;
		font-weight: 600;
	}
	.preview {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 8px 14px;
		padding: 10px 16px;
		background: color-mix(in srgb, var(--gold) 16%, var(--bg));
		border-bottom: 1px solid color-mix(in srgb, var(--gold) 35%, transparent);
		font-size: 0.9rem;
		text-align: center;
	}
</style>
