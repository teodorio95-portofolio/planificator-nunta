<script lang="ts">
	import { daysBetween, formatDate, formatMoney, todayIso } from '#lib/calc.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const s = $derived(data.settings);
	const fmt = (n: number) => formatMoney(n, s);
	const today = todayIso();
	const daysLeft = $derived(s.wedding_date ? daysBetween(today, s.wedding_date) : null);
	const paidPct = $derived(data.money.total ? (data.money.paid / data.money.total) * 100 : 0);
	const expected = $derived(data.hc.expectedAdults + data.hc.expectedChildren);
	const rsvpPct = $derived(
		data.households.total ? (data.households.answered / data.households.total) * 100 : 0
	);
	const cover = $derived(data.cover);
</script>

<!-- The couple's cover photo (Setări → Invitația), from the top of the screen behind the header down
     to the countdown, where it melts into the page. -->
{#if cover}
	<div class="backdrop no-print">
		<img src={cover} alt="" fetchpriority="high" />
	</div>
{/if}
<section class="hero">
	<div class="hero-text">
		{#if s.wedding_date}
			<p class="eyebrow">{formatDate(s.wedding_date, { weekday: 'long' })}{s.venue ? ` · ${s.venue}` : ''}</p>
			<h1>
				{#if daysLeft !== null && daysLeft > 0}
					Mai sunt <em>{daysLeft}</em> {daysLeft === 1 ? 'zi' : 'zile'}
				{:else if daysLeft === 0}
					Astăzi e <em>ziua cea mare</em>
				{:else}
					Casă de piatră!
				{/if}
			</h1>
		{:else}
			<p class="eyebrow">Bun venit</p>
			<h1>Să începem <em>planificarea</em></h1>
			<p>
				Completați numele și data nunții în <a href="/setari">Setări</a> — termenele sarcinilor se calculează
				automat din dată.
			</p>
		{/if}
	</div>
</section>

<div class="stats">
	<a class="stat" href="/invitati">
		<div class="value">{data.hc.confirmed}<span class="of"> / {data.hc.invited}</span></div>
		<div class="label">invitați confirmați</div>
	</a>
	<a class="stat" href="/invitati">
		<div class="value">~{expected}</div>
		<div class="label">estimați că vin ({data.hc.pending} fără răspuns)</div>
	</a>
	<a class="stat" href="/buget">
		<div class="value">{fmt(data.money.total)}</div>
		<div class="label">
			cost estimat{#if data.max.total > data.money.total} · dacă vin toți {fmt(data.max.total)}{/if}
		</div>
	</a>
	<a class="stat highlight" href="/buget">
		<div class="value">{fmt(data.breakEven)}</div>
		<div class="label">dar de echilibru / persoană</div>
	</a>
</div>

<div class="grid cols-2">
	<section class="card">
		<div class="head">
			<h2>Următoarele <em>sarcini</em></h2>
			<a class="small" href="/sarcini">{data.tasksLeft} rămase →</a>
		</div>
		{#if !s.wedding_date}
			<p class="muted">Setați data nunții ca să vedeți termenele.</p>
		{:else if data.nextTasks.length === 0}
			<p class="muted">Totul e bifat. Bucurați-vă!</p>
		{:else}
			<ul class="tasks">
				{#each data.nextTasks as t (t.id)}
					<li>
						<span>{t.title}</span>
						<span class="pill" class:no={t.due < today}>
							{t.due < today ? 'întârziat' : formatDate(t.due, { year: undefined })}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="card">
		<div class="head">
			<h2>Pe <em>scurt</em></h2>
		</div>
		<div class="meter">
			<div class="row">
				<span>Familii care au răspuns</span>
				<span>{data.households.answered} / {data.households.total}</span>
			</div>
			<div class="progress"><span style="width: {rsvpPct}%"></span></div>
		</div>
		<div class="meter">
			<div class="row">
				<span>Plătit din buget</span>
				<span>{fmt(data.money.paid)} / {fmt(data.money.total)}</span>
			</div>
			<div class="progress"><span style="width: {Math.min(100, paidPct)}%"></span></div>
		</div>
		<div class="meter">
			<div class="row">
				<span>Darurile acoperă</span>
				<span>{Math.round(data.coverage)}% din cheltuieli</span>
			</div>
			<div class="progress gold"><span style="width: {Math.min(100, data.coverage)}%"></span></div>
		</div>
		<p class="small muted">
			{data.hc.expectedAdults} adulți și {data.hc.expectedChildren} copii estimați ({s.attendance_rate}% din
			invitați){#if data.max.people > expected}; maxim {data.max.people} dacă vin
				toți{/if}. Invitații trimise:
			{data.households.inviteSent} din {data.households.total} familii.
			{#if data.income}Venituri estimate: {fmt(data.income)} ({data.income >= data.money.total ? '+' : '−'}{fmt(
					Math.abs(data.income - data.money.total)
				)}).{/if}
		</p>
	</section>
</div>

<style>
	/* Positioned against the document, so it starts at the very top and spans the whole width; under
	   the page's content. */
	.backdrop {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 600px;
		z-index: -1;
		/* About the header's height. */
		--wash: 118px;
		overflow: hidden;
	}
	/* An eased fade melts the photo into the page. */
	.backdrop img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 62%;
		--fade: linear-gradient(
			#000 45%,
			rgb(0 0 0 / 0.97) 50.5%,
			rgb(0 0 0 / 0.9) 56%,
			rgb(0 0 0 / 0.78) 61.5%,
			rgb(0 0 0 / 0.65) 67%,
			rgb(0 0 0 / 0.5) 72.5%,
			rgb(0 0 0 / 0.35) 78%,
			rgb(0 0 0 / 0.22) 83.5%,
			rgb(0 0 0 / 0.1) 89%,
			rgb(0 0 0 / 0.03) 94.5%,
			transparent
		);
		-webkit-mask-image: var(--fade);
		mask-image: var(--fade);
	}
	/* A light wash of the header's colour under its frosted glass, fading out below it. */
	.backdrop::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			color-mix(in srgb, var(--header, var(--bg)) 40%, transparent),
			color-mix(in srgb, var(--header, var(--bg)) 25%, transparent) var(--wash),
			transparent calc(var(--wash) + 110px)
		);
	}
	.hero {
		display: flex;
		align-items: flex-end;
		min-height: 360px;
		margin-bottom: 24px;
	}
	.hero-text {
		/* A glow of the page's own colour, so the words read where the photo has not quite faded. */
		text-shadow:
			0 0 18px var(--bg),
			0 0 36px var(--bg);
	}
	.hero-text .eyebrow {
		margin: 0 0 6px;
		color: var(--ink);
	}
	.hero h1 {
		margin: 0;
		font-size: clamp(2.5rem, 7vw, 4.2rem);
	}
	.hero-text p:not(.eyebrow) {
		max-width: 46ch;
		margin: 10px 0 0;
	}
	@media (max-width: 820px) {
		.backdrop {
			height: 480px;
			--wash: 60px;
		}
		.hero {
			min-height: 300px;
		}
	}
	@media print {
		.hero {
			min-height: 0;
		}
	}
	.stat {
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s;
	}
	.stat:hover {
		border-color: var(--muted);
	}
	.of {
		font-size: 1.1rem;
		color: var(--muted);
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}
	.tasks {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.tasks li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		align-items: center;
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
	}
	.tasks li:last-child {
		border-bottom: 0;
	}
	.meter {
		margin-bottom: 16px;
	}
	.meter .row {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 0.88rem;
		margin-bottom: 6px;
	}
	.meter .row span:last-child {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.progress.gold > span {
		background: var(--gold);
	}
</style>
