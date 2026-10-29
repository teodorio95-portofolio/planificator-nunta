<script lang="ts">
	import '@fontsource/cormorant-garamond/300.css';
	import '@fontsource/cormorant-garamond/400.css';
	import '@fontsource/great-vibes/400.css';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import Plic from '#lib/Plic.svelte';
	import ProgramIcon from '#lib/ProgramIcon.svelte';
	import { formatDate } from '#lib/calc.ts';
	import {
		countdown,
		daysAround,
		monogramOf,
		programIcon,
		timeIn,
		weddingStart,
		withoutTime
	} from '#lib/invitation.ts';
	import { MENUS } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const e = $derived(data.event);
	const h = $derived(data.household);
	const couple = $derived([e.partner1, e.partner2].filter(Boolean));
	const initials = $derived(monogramOf(e.partner1, e.partner2, e.monogram));
	const cover = $derived(data.media.cover);
	// The card WhatsApp and iMessage show for the link: no household name, the link may be forwarded;
	// the picture is the couple's cover photo, else the sealed envelope (static/og.png).
	const preview = $derived({
		title: couple.length ? `Nunta ${couple.join(' & ')}` : 'Invitație la nuntă',
		description: 'Aveți o invitație de la noi. Deschideți plicul.',
		image: new URL(cover ?? '/og.png', page.url.origin).href
	});

	const date = $derived(
		e.wedding_date
			? {
					weekday: formatDate(e.wedding_date, { weekday: 'long', day: undefined, month: undefined, year: undefined }),
					day: formatDate(e.wedding_date, { month: undefined, year: undefined }),
					month: formatDate(e.wedding_date, { day: undefined, year: undefined }),
					year: formatDate(e.wedding_date, { day: undefined, month: undefined }),
					long: formatDate(e.wedding_date),
					around: daysAround(e.wedding_date)
				}
			: null
	);
	const ceremonyTime = $derived(timeIn(e.ceremony));
	const ceremonyPlace = $derived(withoutTime(e.ceremony));
	const maps = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
	const waze = (q: string) => `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;

	// The countdown ticks in the browser; the server renders the value at the time of the request.
	const start = $derived(e.wedding_date ? weddingStart(e.wedding_date, e.ceremony) : null);
	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
	const left = $derived(start === null ? null : countdown(start, now));

	// The envelope (src/lib/Plic.svelte, with the music); after a plain form post the guest skips it.
	let stage = $state<'closed' | 'opening' | 'open'>(untrack(() => (form ? 'open' : 'closed')));
	let mounted = $state(false);
	const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
	onMount(() => (mounted = true));

	// Sections rise into place as they scroll into view.
	function reveal(node: HTMLElement) {
		if (still()) return;
		node.classList.add('reveal');
		const io = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				node.classList.add('shown');
				io.disconnect();
			},
			{ rootMargin: '0px 0px -12% 0px' }
		);
		io.observe(node);
		return { destroy: () => io.disconnect() };
	}

	// Local editable copy seeded once from the server, so the menu fields can hide for people
	// who are not coming without waiting for a round-trip.
	let answers = $state(
		untrack(() =>
			Object.fromEntries(
				data.household.guests.map((g) => [g.id, g.attending === null ? '' : String(g.attending)])
			)
		) as Record<number, string>
	);
	let editing = $state(untrack(() => !data.household.responded));
	let submitting = $state(false);

	const anyComing = $derived(Object.values(answers).some((v) => v === '1'));
	const nr = (i: number) => String(i + 1).padStart(2, '0');
	// A pair of leaves on the garland's stem at x, pointing away from the centre (d = -1 left, 1 right).
	const leaves = (x: number, d: number) =>
		[1, -1]
			.map((up) => `M${x} 20c${6 * d} ${-9 * up} ${16 * d} ${-11 * up} ${22 * d} ${-8 * up}` +
				`c${-4 * d} ${8 * up} ${-14 * d} ${11 * up} ${-22 * d} ${8 * up}z`)
			.join('');
</script>

<svelte:head>
	<title>{couple.length ? `${couple.join(' & ')} — invitație` : 'Invitație la nuntă'}</title>
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

<!-- Roughens the edges of the paper sheets, like torn handmade paper. -->
<svg class="defs" aria-hidden="true" width="0" height="0">
	<filter id="hartie-rupta">
		<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" seed="7" />
		<feDisplacementMap in="SourceGraphic" scale="16" />
	</filter>
</svg>

<Plic name={h.name} {initials} music={data.media.music} bind:stage />

<main class="invitatie" inert={mounted && stage !== 'open'}>
	<section class="hero" class:fara-poza={!cover}>
		{#if cover}
			<img class="fundal" src={cover} alt="" fetchpriority="high" />
			<!-- The photo carries on below the first screen, turned and fading into the paper. -->
			<img class="prelungire" src={cover} alt="" />
		{/if}
		<div class="foaie">
			{#if couple.length}
				<h1 class="nume">
					{couple[0]}{#if couple[1]}<span class="si">&amp;</span>{couple[1]}{/if}
				</h1>
			{/if}
			<p class="caps">Vă invităm să sărbătoriți<br />alături de noi nunta noastră</p>
			{#if date}
				<div class="data">
					<span class="caps">{date.month}</span>
					<span class="zi"><i></i>{date.day}<i></i></span>
					<span class="caps">{date.weekday}</span>
					<span class="caps">{date.year}</span>
				</div>
			{/if}
			{#if e.venue}
				<p class="caps">Vă așteptăm la</p>
				<p class="loc">{e.venue}</p>
			{/if}
		</div>
		<a class="jos" href="#numaratoare" aria-label="Mai departe">
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
		</a>
	</section>

	{#if date}
		<section id="numaratoare" class="sectiune" use:reveal>
			<h2>Mai sunt</h2>
			<p class="sub">până pe {date.long}</p>
			<div class="rama">
				{#if left}
					<dl class="ceas">
						<div><dt>{left.days === 1 ? 'Zi' : 'Zile'}</dt><dd>{left.days}</dd></div>
						<div><dt>{left.hours === 1 ? 'Oră' : 'Ore'}</dt><dd>{left.hours}</dd></div>
						<div><dt>{left.minutes === 1 ? 'Minut' : 'Minute'}</dt><dd>{left.minutes}</dd></div>
						<div><dt>{left.seconds === 1 ? 'Secundă' : 'Secunde'}</dt><dd>{left.seconds}</dd></div>
					</dl>
				{:else}
					<p class="gata">Casă de piatră!</p>
				{/if}
			</div>
		</section>
	{/if}

	{#if e.ceremony || e.venue}
		<section class="sectiune verde">
			<div use:reveal>
				<h2>Celebrarea</h2>
				<p class="caps">{e.ceremony && e.venue ? 'Cununia & petrecerea' : e.ceremony ? 'Cununia' : 'Petrecerea'}</p>
			</div>
			{#if e.ceremony}
				<article class="chenar" use:reveal>
					<span class="medalion"><ProgramIcon name="biserica" /></span>
					<p class="caps">Cununia religioasă</p>
					<h3>{ceremonyPlace}</h3>
					{#if date}<p class="cand">{date.weekday}, {date.long}</p>{/if}
					{#if ceremonyTime}
						<p class="ora">ora {String(ceremonyTime[0]).padStart(2, '0')}:{String(ceremonyTime[1]).padStart(2, '0')}</p>
					{/if}
					<div class="butoane">
						<a class="buton deschis" href={maps(ceremonyPlace)} target="_blank" rel="noopener">Vezi pe hartă</a>
					</div>
				</article>
			{/if}
			{#if e.venue}
				<article class="chenar" use:reveal>
					<span class="medalion"><ProgramIcon name="sampanie" /></span>
					<p class="caps">Petrecerea</p>
					<h3>{e.venue}</h3>
					{#if e.venue_address}<p class="caps adresa-loc">{e.venue_address}</p>{/if}
					{#if date}<p class="cand">{date.weekday}, {date.long}</p>{/if}
					<div class="butoane">
						<a class="buton deschis" href={maps(e.venue_address || e.venue)} target="_blank" rel="noopener"
							>Vezi pe hartă</a
						>
						<a class="buton deschis" href={waze(e.venue_address || e.venue)} target="_blank" rel="noopener">Waze</a>
					</div>
				</article>
			{/if}
		</section>
	{/if}

	{#if data.program.length}
		<section class="sectiune" use:reveal>
			<h2>Ziua cea mare</h2>
			<p class="caps">Programul{date ? ` · ${date.weekday}, ${date.day} ${date.month}` : ''}</p>
			{#if date}
				<ol class="zile" aria-hidden="true">
					{#each date.around as d, i (i)}
						<li class:noi={i === 2}>
							{#if i === 2}
								<svg viewBox="0 0 32 30"><path d="M16 29C6 21 1 15.5 1 9.5 1 4.8 4.6 1 9 1c3 0 5.4 1.6 7 4 1.6-2.4 4-4 7-4 4.4 0 8 3.8 8 8.5 0 6-5 11.5-15 19.5z" /></svg>
							{/if}
							<span>{d}</span>
						</li>
					{/each}
				</ol>
			{/if}
			<ol class="program">
				{#each data.program as it, i (it.id)}
					{@const pic = programIcon(it.title)}
					<li class:dreapta={i % 2 === 1}>
						<div class="text">
							<span class="caps">{it.start_time}</span>
							<span class="titlu">{it.title}</span>
							{#if it.place}<span class="unde">{it.place}</span>{/if}
						</div>
						<span class="punct" aria-hidden="true"></span>
						<div class="poza">{#if pic}<span class="icon"><ProgramIcon name={pic} /></span>{/if}</div>
					</li>
				{/each}
			</ol>
		</section>
	{/if}

	<!-- A sprig of leaves between the program and the answer. -->
	<svg class="ghirlanda" viewBox="0 0 240 40" aria-hidden="true">
		<path d="M20 20h200" />
		<path d="M120 20c-6-8-6-14 0-18 6 4 6 10 0 18zM120 20c6 8 6 14 0 18-6-4-6-10 0-18z" />
		{#each [-1, 1] as dir (dir)}
			{#each [28, 52, 76] as dx (dx)}
				<path d={leaves(120 + dir * dx, dir)} />
			{/each}
		{/each}
	</svg>

	<section id="confirmare" class="sectiune confirmare" use:reveal>
		<h2>Confirmare</h2>
		<p class="romb" aria-hidden="true"><i></i><b></b><i></i></p>
		{#if e.rsvp_deadline}
			<p class="caps">Vă rugăm să ne răspundeți<br />până pe {formatDate(e.rsvp_deadline)}</p>
		{/if}
		<p class="cui">Pentru {h.name}</p>

		{#if (form?.saved || h.responded) && !editing}
			<div class="multumim">
				<h3>{anyComing ? 'Vă mulțumim, ne vedem la nuntă!' : 'Vă mulțumim pentru răspuns'}</h3>
				<p>
					{anyComing
						? 'Ne bucurăm enorm că veți fi alături de noi.'
						: 'Ne pare rău că nu puteți ajunge. Vă purtăm în gând.'}
				</p>
				<button class="buton" onclick={() => (editing = true)}>Modificați răspunsul</button>
			</div>
		{:else}
			{#if form?.error}<p class="eroare">{form.error}</p>{/if}
			<form
				method="POST"
				use:enhance={() => {
					submitting = true;
					return async ({ update, result }) => {
						await update({ reset: false });
						submitting = false;
						if (result.type === 'success') editing = false;
					};
				}}
			>
				{#each h.guests as g, i (g.id)}
					<fieldset>
						<legend><span class="nr">{nr(i)}</span>{g.name}</legend>
						<label class="optiune" class:ales={answers[g.id] === '1'}>
							<input type="radio" name="attending_{g.id}" value="1" bind:group={answers[g.id]} required />
							Da, cu drag
						</label>
						<!-- Right under the yes, as the rest of that answer. -->
						{#if answers[g.id] === '1'}
							<div class="detalii">
								<label>
									<span class="caps">Meniu</span>
									<select name="menu_{g.id}" value={g.menu}>
										{#each Object.entries(MENUS) as [v, l] (v)}
											{#if v !== 'copil' || g.is_child}<option value={v}>{l}</option>{/if}
										{/each}
									</select>
								</label>
								<label>
									<span class="caps">Alergii sau restricții</span>
									<input name="dietary_{g.id}" value={g.dietary} maxlength="200" placeholder="opțional" />
								</label>
							</div>
						{/if}
						<label class="optiune" class:ales={answers[g.id] === '0'}>
							<input type="radio" name="attending_{g.id}" value="0" bind:group={answers[g.id]} />
							Din păcate, nu
						</label>
					</fieldset>
				{/each}

				<fieldset>
					<legend><span class="nr">{nr(h.guests.length)}</span>Un gând pentru miri</legend>
					<textarea name="note" rows="4" maxlength="1000" placeholder="Ne-ar bucura să vă citim.">{h.note}</textarea>
				</fieldset>

				<button class="buton plin" disabled={submitting}>
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" /></svg>
					{submitting ? 'Se trimite…' : 'Trimite răspunsul'}
				</button>
			</form>
		{/if}
	</section>

	<section class="hero final" class:fara-poza={!cover}>
		{#if cover}<img class="fundal" src={cover} alt="" loading="lazy" />{/if}
		<div class="foaie" use:reveal>
			<p class="caps">Vă așteptăm cu drag</p>
			{#if couple.length}
				<p class="nume">{couple[0]}{#if couple[1]}<span class="si">&amp;</span>{couple[1]}{/if}</p>
			{/if}
			{#if date}<p class="caps">{date.long}</p>{/if}
		</div>
	</section>
</main>

<style>
	/* The invitation keeps its own paper colours whatever look the device chose for the app. */
	:global(body:has(.invitatie)) {
		background: #f6f1e5;
		color-scheme: light;
	}
	.defs {
		position: absolute;
	}

	.invitatie {
		--hartie: #f6f1e5;
		--foaie: #fbf7ee;
		--cerneala: #4b5638;
		--text: #5d614e;
		--estompat: #8c8c78;
		--linie: #cfc8b0;
		--verde: #5e6c49;
		--ales: #ebe5d2;
		--roz: #c07a8b;
		background: var(--hartie);
		color: var(--text);
		font-family: 'Cormorant Garamond', serif;
		font-weight: 400;
		font-size: 1.15rem;
		line-height: 1.5;
		overflow-x: clip;
	}
	h2,
	h3,
	.nume {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 300;
		color: var(--cerneala);
		margin: 0;
		letter-spacing: 0.01em;
	}
	h2 {
		font-size: clamp(2.3rem, 9vw, 2.9rem);
		line-height: 1.1;
	}
	h3 {
		font-size: 1.7rem;
		line-height: 1.15;
	}
	.caps {
		font-family: var(--sans);
		font-size: 0.66rem;
		font-weight: 400;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: var(--estompat);
		line-height: 1.9;
		margin: 0;
	}

	/* ——— The cover photo (or a pastel wash without one) with the paper sheet ——— */
	.hero {
		position: relative;
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: 64px 16px 96px;
		isolation: isolate;
	}
	.fara-poza {
		background:
			radial-gradient(ellipse at 15% 20%, rgb(214 170 180 / 0.45), transparent 45%),
			radial-gradient(ellipse at 85% 30%, rgb(160 178 140 / 0.4), transparent 50%),
			radial-gradient(ellipse at 50% 95%, rgb(230 200 160 / 0.45), transparent 55%),
			var(--hartie);
	}
	.fundal {
		position: absolute;
		inset: 0;
		z-index: -1;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 62%;
	}
	/* A copy of the photo below the first screen: its bottom carries on for a short while and fades
	   into the paper above the countdown. */
	.prelungire {
		position: absolute;
		top: calc(100% - 50px);
		left: 0;
		z-index: -1;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 62%;
		/* Turned half a circle rather than mirrored, so it reads as more garden, not a reflection. */
		transform: rotate(180deg);
		/* Masked before the turn, so its bottom is what stays: it fades in over the last 50px of the
		   photo, so the two cross-fade without a seam, then fades into the paper. */
		mask-image: linear-gradient(
			to top,
			transparent,
			#000 50px,
			rgb(0 0 0 / 0.65) 85px,
			rgb(0 0 0 / 0.3) 125px,
			rgb(0 0 0 / 0.08) 155px,
			transparent 175px
		);
		pointer-events: none;
	}
	.foaie {
		position: relative;
		width: min(100%, 330px);
		padding: 44px 26px;
		text-align: center;
		display: grid;
		gap: 14px;
		justify-items: center;
	}
	.foaie::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		/* Thin paper: the photo shows through, just a little. */
		background: rgb(251 247 238 / 0.9);
		filter: url(#hartie-rupta) drop-shadow(0 6px 14px rgb(60 55 35 / 0.14));
	}
	.nume {
		font-size: clamp(2.6rem, 12vw, 3.3rem);
		line-height: 1.02;
		display: grid;
		margin-bottom: 6px;
	}
	.si {
		font-size: 0.42em;
		font-style: italic;
		color: var(--estompat);
		margin: 4px 0;
	}
	.data {
		display: grid;
		justify-items: center;
		margin: 6px 0 4px;
	}
	.zi {
		display: flex;
		align-items: center;
		gap: 14px;
		font-size: 2.6rem;
		font-weight: 300;
		line-height: 1.1;
		color: var(--cerneala);
		font-variant-numeric: lining-nums;
	}
	.zi i {
		width: 34px;
		height: 1px;
		background: var(--linie);
	}
	.loc {
		margin: -8px 0 0;
		font-size: 1.35rem;
		color: var(--cerneala);
		line-height: 1.25;
	}
	.jos {
		position: absolute;
		bottom: calc(22px + env(safe-area-inset-bottom));
		left: 50%;
		translate: -50% 0;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: rgb(251 247 238 / 0.7);
		backdrop-filter: blur(3px);
		animation: plutire 2.2s ease-in-out infinite;
	}
	.jos svg {
		width: 20px;
		fill: none;
		stroke: var(--cerneala);
		stroke-width: 1.4;
	}
	@keyframes plutire {
		50% {
			translate: -50% 6px;
		}
	}

	/* ——— Sections ——— */
	.sectiune {
		max-width: 520px;
		margin: 0 auto;
		padding: 88px 24px;
		text-align: center;
		display: grid;
		gap: 10px;
		justify-items: center;
	}
	/* Room for the photo's fading reflection above the title. */
	#numaratoare {
		/* Positioned, so its text paints over the reflection rather than under it. */
		position: relative;
		padding-top: 120px;
	}
	.sub {
		margin: 0;
		color: var(--estompat);
	}
	/* A double ruled frame with a diamond at each corner, around the clock. */
	.rama {
		position: relative;
		width: min(100%, 320px);
		margin-top: 22px;
		padding: 40px 24px;
		display: grid;
		place-items: center;
		border: 1px solid var(--linie);
		outline: 1px solid var(--linie);
		outline-offset: 6px;
		background: var(--foaie);
	}
	.rama::before,
	.rama::after {
		content: '';
		position: absolute;
		width: 9px;
		height: 9px;
		rotate: 45deg;
		background: var(--roz);
		top: -11px;
		left: 50%;
		translate: -50% 0;
	}
	.rama::after {
		top: auto;
		bottom: -11px;
	}
	.ceas {
		margin: 0;
		display: grid;
		gap: 10px;
	}
	.ceas div {
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
	}
	.ceas dd {
		margin: 0;
		font-family: 'Great Vibes', cursive;
		font-size: 2.7rem;
		line-height: 1;
		color: var(--cerneala);
		font-variant-numeric: tabular-nums;
	}
	.ceas dt {
		font-size: 1.05rem;
		color: var(--text);
	}
	.gata {
		font-family: 'Great Vibes', cursive;
		font-size: 2.6rem;
		color: var(--cerneala);
	}

	/* Green, like the deep olive pages of a printed invitation suite. */
	/* The green grows out of the paper and melts back into it; the in-between stops ease the blend so
	   it reads as a wash of colour rather than a band. */
	.verde {
		max-width: none;
		padding-block: 190px;
		background:
			radial-gradient(ellipse 90% 35% at 50% 28%, rgb(255 255 255 / 0.06), transparent 70%),
			linear-gradient(
				to bottom,
				var(--hartie) 0,
				color-mix(in srgb, var(--verde) 10%, var(--hartie)) 30px,
				color-mix(in srgb, var(--verde) 35%, var(--hartie)) 70px,
				color-mix(in srgb, var(--verde) 70%, var(--hartie)) 110px,
				color-mix(in srgb, var(--verde) 92%, var(--hartie)) 140px,
				var(--verde) 170px,
				var(--verde) calc(100% - 170px),
				color-mix(in srgb, var(--verde) 92%, var(--hartie)) calc(100% - 140px),
				color-mix(in srgb, var(--verde) 70%, var(--hartie)) calc(100% - 110px),
				color-mix(in srgb, var(--verde) 35%, var(--hartie)) calc(100% - 70px),
				color-mix(in srgb, var(--verde) 10%, var(--hartie)) calc(100% - 30px),
				var(--hartie) 100%
			);
		gap: 28px;
	}
	.verde h2,
	.verde h3 {
		color: var(--hartie);
	}
	.verde .caps {
		color: rgb(246 241 229 / 0.72);
	}
	.chenar {
		position: relative;
		width: min(100%, 400px);
		padding: 70px 26px 32px;
		margin-top: 46px;
		display: grid;
		gap: 8px;
		justify-items: center;
		color: rgb(246 241 229 / 0.9);
		/* A double gold-cream rule, the inner one inset. */
		box-shadow:
			inset 0 0 0 1px rgb(236 220 180 / 0.75),
			inset 0 0 0 6px var(--verde),
			inset 0 0 0 7px rgb(236 220 180 / 0.45);
	}
	.medalion {
		position: absolute;
		top: -48px;
		left: 50%;
		translate: -50% 0;
		width: 96px;
		height: 96px;
		padding: 18px;
		border-radius: 50%;
		color: var(--verde);
		background: var(--hartie);
		box-shadow:
			0 0 0 1px rgb(236 220 180 / 0.75),
			0 0 0 6px var(--verde),
			0 0 0 7px rgb(236 220 180 / 0.45);
	}
	.cand {
		margin: 6px 0 0;
		font-style: italic;
		font-size: 1rem;
	}
	.ora {
		margin: 0;
		font-size: 1.35rem;
		color: var(--hartie);
	}
	.adresa-loc {
		letter-spacing: 0.2em;
	}
	.butoane {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
		margin-top: 14px;
	}
	.buton {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 13px 24px;
		border: 1px solid var(--cerneala);
		background: transparent;
		color: var(--cerneala);
		font-family: var(--sans);
		font-size: 0.64rem;
		letter-spacing: 0.26em;
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
		transition:
			background-color 0.25s,
			color 0.25s;
	}
	.buton:hover {
		background: var(--cerneala);
		color: var(--hartie);
	}
	.buton.deschis {
		border-color: rgb(246 241 229 / 0.7);
		color: var(--hartie);
	}
	.buton.deschis:hover {
		background: var(--hartie);
		color: var(--verde);
	}
	.buton.plin {
		width: 100%;
		padding: 17px;
		background: var(--verde);
		border-color: var(--verde);
		color: var(--hartie);
	}
	.buton.plin:hover {
		background: var(--cerneala);
	}
	.buton:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.buton svg {
		width: 15px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linejoin: round;
	}

	/* ——— The program ——— */
	.zile {
		list-style: none;
		margin: 26px 0 8px;
		padding: 0;
		display: flex;
		align-items: center;
		gap: 18px;
		font-size: 1.35rem;
		color: var(--estompat);
		font-variant-numeric: lining-nums;
	}
	.zile li {
		position: relative;
		display: grid;
		place-items: center;
	}
	.zile .noi {
		width: 52px;
		height: 48px;
		color: var(--hartie);
	}
	.zile svg {
		position: absolute;
		inset: 0;
		fill: var(--verde);
	}
	.zile .noi span {
		position: relative;
		margin-top: -4px;
	}
	.program {
		list-style: none;
		margin: 26px 0 0;
		padding: 0;
		width: 100%;
		position: relative;
	}
	/* The thread the moments hang on. */
	.program::before {
		content: '';
		position: absolute;
		left: 50%;
		top: 8px;
		bottom: 8px;
		width: 1px;
		background: var(--linie);
	}
	.program li {
		display: grid;
		grid-template-columns: 1fr 28px 1fr;
		align-items: center;
		min-height: 104px;
	}
	.program .text {
		display: grid;
		text-align: right;
	}
	.program .poza {
		display: flex;
		justify-content: flex-start;
	}
	.program .dreapta .text {
		order: 3;
		text-align: left;
	}
	.program .dreapta .punct {
		order: 2;
	}
	.program .dreapta .poza {
		order: 1;
		justify-content: flex-end;
	}
	.punct {
		justify-self: center;
		width: 9px;
		height: 9px;
		rotate: 45deg;
		background: var(--verde);
		box-shadow: 0 0 0 5px var(--hartie);
	}
	.program .icon {
		display: block;
		width: 64px;
		height: 64px;
		color: var(--verde);
	}
	.titlu {
		font-size: 1.3rem;
		line-height: 1.2;
		color: var(--cerneala);
	}
	.unde {
		font-size: 0.95rem;
		font-style: italic;
		color: var(--estompat);
	}

	.ghirlanda {
		display: block;
		width: min(80%, 320px);
		margin: 8px auto 0;
		fill: none;
		stroke: var(--verde);
		stroke-width: 1.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* ——— RSVP ——— */
	.romb {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 6px;
	}
	.romb i {
		width: 54px;
		height: 1px;
		background: var(--linie);
	}
	.romb b {
		width: 6px;
		height: 6px;
		rotate: 45deg;
		border: 1px solid var(--estompat);
	}
	.confirmare .cui {
		margin: 10px 0 0;
		font-size: 2rem;
	}
	form {
		width: 100%;
		display: grid;
		gap: 34px;
		margin-top: 26px;
		text-align: left;
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 10px;
	}
	legend {
		padding: 0 0 12px;
		font-size: 1.25rem;
		color: var(--cerneala);
	}
	.nr {
		font-family: var(--sans);
		font-size: 0.66rem;
		letter-spacing: 0.2em;
		color: var(--estompat);
		margin-right: 14px;
		vertical-align: 2px;
	}
	.optiune {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 15px 18px;
		border: 1px solid var(--linie);
		font-size: 1.12rem;
		color: var(--text);
		cursor: pointer;
		transition:
			background-color 0.2s,
			border-color 0.2s;
	}
	.optiune.ales {
		background: var(--ales);
		border-color: var(--cerneala);
	}
	.optiune input {
		appearance: none;
		margin: 0;
		width: 17px;
		height: 17px;
		border-radius: 50%;
		border: 1px solid var(--cerneala);
		display: grid;
		place-items: center;
	}
	.optiune input::after {
		content: '';
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--cerneala);
		scale: 0;
		transition: scale 0.15s;
	}
	.optiune input:checked::after {
		scale: 1;
	}
	.detalii {
		display: grid;
		gap: 12px;
		padding: 18px;
		/* Hangs off the chosen yes, in the same border. */
		border: 1px solid var(--cerneala);
		border-top: 0;
		margin-top: -10px;
		background: rgb(235 229 210 / 0.4);
	}
	.detalii label {
		gap: 6px;
		color: inherit;
		font-size: inherit;
	}
	form :is(input:not([type='radio']), select, textarea) {
		border-radius: 0;
		border: 1px solid var(--linie);
		background: #fcfaf4;
		color: var(--text);
		font-family: 'Cormorant Garamond', serif;
		font-size: 1.1rem;
		padding: 12px 14px;
	}
	form :is(input, select, textarea):focus-visible {
		outline: 1px solid var(--cerneala);
		outline-offset: 0;
	}
	form ::placeholder {
		color: #b3ae9a;
		font-style: italic;
	}
	.eroare {
		margin: 18px 0 0;
		padding: 12px 16px;
		border: 1px solid var(--roz);
		color: #9a4a5c;
		font-size: 1.05rem;
	}
	.multumim {
		margin-top: 22px;
		padding: 34px 24px;
		width: 100%;
		display: grid;
		gap: 12px;
		justify-items: center;
		border: 1px solid var(--linie);
		outline: 1px solid var(--linie);
		outline-offset: -7px;
	}
	.multumim p {
		margin: 0 0 8px;
	}

	.final {
		min-height: 88svh;
	}
	/* The photo fades in from the paper above it rather than starting at a hard edge. */
	.final .fundal {
		mask-image: linear-gradient(to bottom, transparent, rgb(0 0 0 / 0.3) 9%, rgb(0 0 0 / 0.75) 19%, #000 30%);
	}
	.final .foaie {
		gap: 10px;
	}

	/* Scroll-in, only when the browser runs the script that adds .reveal. */
	.invitatie :global(.reveal) {
		opacity: 0;
		translate: 0 26px;
		transition:
			opacity 0.9s ease,
			translate 0.9s ease;
	}
	.invitatie :global(.reveal.shown) {
		opacity: 1;
		translate: 0 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.jos {
			animation: none;
		}
	}
</style>
