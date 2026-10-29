<script lang="ts">
	import '@fontsource/cormorant-garamond/400.css';
	import '@fontsource/great-vibes/400.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Plic from '#lib/Plic.svelte';
	import { formatDate } from '#lib/calc.ts';
	import { googleCalendarUrl } from '#lib/calendar.ts';
	import { countdown, monogramOf, weddingStart } from '#lib/invitation.ts';
	import type { PageProps } from './$types';

	// Like the printed-invitation sites' save the date: one screen, the envelope, the card, how long
	// is left and a way into the calendar. The venue and the program wait for the invitation.
	let { data }: PageProps = $props();

	const e = $derived(data.event);
	const couple = $derived([e.partner1, e.partner2].filter(Boolean));
	const initials = $derived(monogramOf(e.partner1, e.partner2, e.monogram));
	const cover = $derived(data.media.cover);
	const day = $derived(e.wedding_date ? formatDate(e.wedding_date) : '');
	const title = $derived(couple.length ? `Nunta ${couple.join(' & ')}` : 'Nunta');
	// The card WhatsApp and iMessage show for the link: no household name, the link may be forwarded,
	// and not the date; the picture is the couple's cover photo, else the sealed envelope (static/og.png).
	const preview = $derived({
		title: couple.length ? `Save the date · ${couple.join(' & ')}` : 'Save the date',
		description: 'Aveți o scrisoare de la noi. Deschideți plicul.',
		image: new URL(cover ?? '/og.png', page.url.origin).href
	});

	const google = $derived(
		e.wedding_date
			? googleCalendarUrl({
					date: e.wedding_date,
					title,
					location: e.venue,
					description: 'Save the date! Invitația cu toate detaliile vine în curând.'
				})
			: null
	);

	// Days, hours and minutes, no seconds: the day is months away.
	const start = $derived(e.wedding_date ? weddingStart(e.wedding_date, e.ceremony) : null);
	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 10_000);
		return () => clearInterval(timer);
	});
	const left = $derived(start === null ? null : countdown(start, now));

	let stage = $state<'closed' | 'opening' | 'open'>('closed');
	let mounted = $state(false);
	onMount(() => (mounted = true));
</script>

<svelte:head>
	<title>{couple.length ? `${couple.join(' & ')} — save the date` : 'Save the date'}</title>
	<meta name="robots" content="noindex" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={preview.title} />
	<meta property="og:description" content={preview.description} />
	<meta property="og:image" content={preview.image} />
	{#if !cover}
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<Plic name={data.household.name} {initials} music={data.media.music} bind:stage />

<!-- Roughens the edges of the paper sheet, like torn handmade paper (as on the invitation). -->
<svg class="defs" aria-hidden="true" width="0" height="0">
	<filter id="hartie-rupta">
		<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" seed="7" />
		<feDisplacementMap in="SourceGraphic" scale="16" />
	</filter>
</svg>

<!-- The couple's cover photo, as on the invitation, held still behind the sheet; a pastel wash without one. -->
{#if cover}
	<img class="fundal" src={cover} alt="" />
{:else}
	<div class="fundal fara-poza" aria-hidden="true"></div>
{/if}

<!-- Sealed under the envelope, then the sheet and each part on it rise in turn as it opens. -->
<main class="save-the-date" class:arata={stage !== 'closed'} inert={mounted && stage !== 'open'}>
	<div class="foaie">
		<div class="felicitare rasare" style="--i: 0">
			<p class="caps">Save the date</p>
			{#if couple.length}
				<h1 class="nume">{couple[0]}{#if couple[1]}<span class="si">&amp;</span>{couple[1]}{/if}</h1>
			{/if}
			<p class="caps">Ne căsătorim!</p>
			{#if day}<p class="data">{day}</p>{/if}
			{#if e.venue}<p class="caps">{e.venue}</p>{/if}
		</div>

		{#if left}
			<dl class="ceas rasare" style="--i: 1" aria-label="Timp rămas până la nuntă">
				<div><dt>{left.days === 1 ? 'zi' : 'zile'}</dt><dd>{left.days}</dd></div>
				<div><dt>{left.hours === 1 ? 'oră' : 'ore'}</dt><dd>{left.hours}</dd></div>
				<div><dt>{left.minutes === 1 ? 'minut' : 'minute'}</dt><dd>{left.minutes}</dd></div>
			</dl>
		{/if}

		{#if google}
			<!-- A <details>, so the choice opens without JavaScript too. -->
			<details class="calendar rasare" style="--i: 2">
				<summary>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<rect x="3.5" y="5" width="17" height="15.5" rx="1.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" />
					</svg>
					Adaugă în calendar
				</summary>
				<div class="optiuni">
					<a href={google} target="_blank" rel="noopener">Google</a>
					<a href="{page.url.pathname}/nunta.ics">Apple</a>
					<a href="{page.url.pathname}/nunta.ics">Outlook</a>
				</div>
			</details>
		{/if}

		<p class="caps rasare" style="--i: 3">Invitația, cu toate detaliile, vine în curând</p>
	</div>
</main>

<style>
	/* The save the date keeps the card's own colours whatever look the device chose for the app. */
	:global(body:has(.save-the-date)) {
		background: #f4ebe1;
		color-scheme: light;
	}
	.save-the-date {
		--hartie: #f4ebe1;
		--cerneala: #5a4b45;
		/* Darker than on plain paper: the sheet lets the photo through. */
		--estompat: #7a6a60;
		--piersica: #d9876f;
		min-height: 100svh;
		box-sizing: border-box;
		display: grid;
		place-items: center;
		padding: calc(24px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom));
		color: var(--cerneala);
		font-family: 'Cormorant Garamond', serif;
		text-align: center;
	}
	.defs {
		position: absolute;
	}
	.fundal {
		position: fixed;
		inset: 0;
		z-index: -1;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 62%;
	}

	.fara-poza {
		background:
			radial-gradient(ellipse at 15% 20%, rgb(214 170 180 / 0.5), transparent 45%),
			radial-gradient(ellipse at 85% 35%, rgb(160 178 140 / 0.45), transparent 50%),
			radial-gradient(ellipse at 50% 95%, rgb(230 200 160 / 0.5), transparent 55%),
			var(--hartie);
	}

	/* Thin torn paper: the photo shows through, a little. */
	.foaie {
		position: relative;
		isolation: isolate;
		width: min(100%, 500px);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		padding: 30px 14px 34px;
	}
	.foaie::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background: rgb(251 246 238 / 0.7);
		filter: url(#hartie-rupta) drop-shadow(0 8px 18px rgb(60 45 35 / 0.22));
	}
	/* The card itself: a ruled border around the names and the day. */
	.felicitare {
		width: min(100%, 360px);
		box-sizing: border-box;
		display: grid;
		gap: 14px;
		justify-items: center;
		padding: 40px 20px;
		border: 1px solid rgb(90 75 69 / 0.3);
		outline: 1px solid rgb(90 75 69 / 0.3);
		outline-offset: -8px;
	}
	.nume {
		margin: 0;
		font-family: 'Great Vibes', cursive;
		font-weight: 400;
		font-size: clamp(2.6rem, 12vw, 3.4rem);
		line-height: 1.1;
		color: var(--cerneala);
	}
	.si {
		display: block;
		font-size: 0.6em;
		color: var(--piersica);
	}
	.data {
		margin: 0;
		font-size: 1.6rem;
		letter-spacing: 0.04em;
	}
	.caps {
		margin: 0;
		font-family: var(--sans);
		font-size: 0.62rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: var(--estompat);
	}

	.ceas {
		display: flex;
		margin: 0;
	}
	.ceas div {
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		min-width: 84px;
		padding: 0 14px;
	}
	.ceas div + div {
		border-left: 1px solid rgb(90 75 69 / 0.25);
	}
	.ceas dd {
		margin: 0;
		font-family: 'Great Vibes', cursive;
		font-size: 2.6rem;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}
	.ceas dt {
		font-family: var(--sans);
		font-size: 0.6rem;
		letter-spacing: 0.26em;
		text-transform: uppercase;
		color: var(--estompat);
	}

	.calendar {
		display: grid;
		justify-items: center;
		gap: 12px;
	}
	.calendar summary {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 13px 26px;
		border-radius: 999px;
		background: var(--piersica);
		color: #fffaf5;
		font-family: var(--sans);
		font-size: 0.64rem;
		letter-spacing: 0.26em;
		text-transform: uppercase;
		cursor: pointer;
		list-style: none;
		box-shadow: 0 6px 16px rgb(217 135 111 / 0.3);
		transition: background-color 0.25s;
	}
	.calendar summary::-webkit-details-marker {
		display: none;
	}
	.calendar summary:hover,
	.calendar[open] summary {
		background: #c97560;
	}
	.calendar svg {
		width: 15px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
	}
	.optiuni {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
	}
	.optiuni a {
		padding: 9px 18px;
		border: 1px solid rgb(90 75 69 / 0.35);
		border-radius: 999px;
		color: var(--cerneala);
		font-family: var(--sans);
		font-size: 0.62rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		text-decoration: none;
		transition:
			background-color 0.25s,
			color 0.25s;
	}
	.optiuni a:hover {
		background: var(--cerneala);
		color: var(--hartie);
	}

	/* While the envelope slides away the sheet rises, then each part on it in turn. */
	.arata .foaie {
		animation: rasare 1s cubic-bezier(0.2, 0.7, 0.3, 1) 1.1s both;
	}
	.arata .rasare {
		animation: rasare 0.9s cubic-bezier(0.2, 0.7, 0.3, 1) both;
		animation-delay: calc(1.5s + var(--i, 0) * 0.35s);
	}
	@keyframes rasare {
		from {
			opacity: 0;
			translate: 0 18px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.arata .foaie,
		.arata .rasare {
			animation: none;
		}
	}
</style>
