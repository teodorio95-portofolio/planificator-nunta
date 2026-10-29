<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDate, todayIso } from '#lib/calc.ts';
	import { currentId, dayMinutes, duration, formatDuration, fromMinutes, overlaps } from '#lib/schedule.ts';
	import type { ScheduleItem } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const s = $derived(data.settings);
	const clashes = $derived(overlaps(data.schedule));
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
		update({ reset: false });

	// Free time before each item, measured from the end (or start) of the one before.
	const gapBefore = (i: number) => {
		if (i === 0) return 0;
		const prev = data.schedule[i - 1];
		const prevEnd = dayMinutes(prev.start_time) + (duration(prev.start_time, prev.end_time) ?? 0);
		return dayMinutes(data.schedule[i].start_time) - prevEnd;
	};

	// Only in the browser, and only on the wedding day: which moment is happening now.
	let now = $state('');
	$effect(() => {
		if (!s.wedding_date) return;
		const tick = () => {
			const d = new Date();
			now = todayIso(d) === s.wedding_date ? fromMinutes(d.getHours() * 60 + d.getMinutes()) : '';
		};
		tick();
		const timer = setInterval(tick, 30_000);
		return () => clearInterval(timer);
	});
	const current = $derived(now ? currentId(data.schedule, now) : null);
</script>

<div class="page-head">
	<div>
		<p class="eyebrow">
			{[s.wedding_date && formatDate(s.wedding_date, { weekday: 'long' }), s.venue].filter(Boolean).join(' · ') ||
				'Ziua nunții'}
		</p>
		<h1>Desfășurătorul <em>zilei</em></h1>
	</div>
	<button class="btn ghost small no-print" onclick={() => window.print()}>Printează</button>
</div>

{#if form?.error}<p class="flash error no-print">{form.error}</p>{/if}
{#if now}
	<p class="flash no-print">
		Este {now}.{current ? ` Acum: ${data.schedule.find((it) => it.id === current)?.title}.` : ''}
	</p>
{/if}

{#if data.schedule.length === 0}
	<div class="card empty">
		<h3>Nimic planificat încă</h3>
		<p>Adăugați primul moment al zilei mai jos.</p>
	</div>
{/if}

<ol class="timeline">
	{#each data.schedule as it, i (it.id)}
		{@const len = duration(it.start_time, it.end_time)}
		{@const gap = gapBefore(i)}
		{#if gap > 0}
			<li class="gap small muted">{formatDuration(gap)} liber</li>
		{/if}
		<li class="moment" class:now={it.id === current}>
			<details>
				<summary>
					<span class="time">
						<span class="start">{it.start_time}</span>
						{#if it.end_time}<span class="end">până la {it.end_time}</span>{/if}
					</span>
					<span class="what">
						<span class="title">{it.title}</span>
						{#if it.place || it.people}
							<span class="small muted">{[it.place, it.people].filter(Boolean).join(' · ')}</span>
						{/if}
						{#if it.notes}<span class="notes small">{it.notes}</span>{/if}
					</span>
					<span class="tags">
						{#if it.id === current}<span class="pill yes">acum</span>{/if}
						{#if clashes.has(it.id)}<span class="pill no">se suprapune</span>{/if}
						{#if len}<span class="pill">{formatDuration(len)}</span>{/if}
						{#if it.on_invite}<span class="pill">pe invitație</span>{/if}
					</span>
				</summary>
				<div class="edit no-print">
					<form method="POST" action="?/update" use:enhance={keep} class="item-form">
						<input type="hidden" name="id" value={it.id} />
						{@render fields(it)}
						<div class="actions">
							<button class="btn small">Salvează</button>
							<button class="btn danger small" formaction="?/delete">Șterge</button>
						</div>
					</form>
					<form method="POST" action="?/shift" use:enhance={keep} class="shift">
						<input type="hidden" name="id" value={it.id} />
						<span class="small muted">Mută acest moment și tot ce urmează:</span>
						{#each [-15, 15, 30, 60] as m (m)}
							<button class="btn ghost small" name="minutes" value={m}>{m > 0 ? '+' : '−'}{Math.abs(m)} min</button>
						{/each}
					</form>
				</div>
			</details>
		</li>
	{/each}
</ol>

<details class="card add no-print" open={data.schedule.length === 0}>
	<summary>+ Adaugă un moment</summary>
	<form method="POST" action="?/add" use:enhance class="item-form">
		{@render fields()}
		<div class="actions"><button class="btn small">Adaugă</button></div>
	</form>
</details>

{#snippet fields(it?: ScheduleItem)}
	<div class="form-row">
		<label>De la <input type="time" name="start_time" value={it?.start_time ?? ''} required /></label>
		<label>Până la <input type="time" name="end_time" value={it?.end_time ?? ''} /></label>
		<label class="wide">Ce <input name="title" value={it?.title ?? ''} placeholder="ex. Primirea invitaților" required /></label>
	</div>
	<div class="form-row">
		<label>Unde <input name="place" value={it?.place ?? ''} placeholder="ex. Restaurantul" /></label>
		<label>Cine <input name="people" value={it?.people ?? ''} placeholder="ex. Nașii, fotograful" /></label>
	</div>
	<label>Note <textarea name="notes" rows="2" value={it?.notes ?? ''}></textarea></label>
	<label class="check">
		<input type="checkbox" name="on_invite" checked={!!it?.on_invite} />
		Pe invitație: invitații văd ora și titlul în programul zilei
	</label>
{/snippet}

<style>
	.timeline {
		list-style: none;
		margin: 0 0 24px;
		padding: 0;
		position: relative;
	}
	/* The vertical line the moments hang on. */
	.timeline::before {
		content: '';
		position: absolute;
		left: 7px;
		top: 12px;
		bottom: 12px;
		width: 2px;
		background: var(--line);
	}
	.moment {
		position: relative;
		padding-left: 28px;
		margin-bottom: 10px;
	}
	.moment::before {
		content: '';
		position: absolute;
		left: 1px;
		top: 22px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--bg);
		border: 2px solid var(--gold);
	}
	.moment.now::before {
		background: var(--accent);
		border-color: var(--accent);
	}
	.moment details {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
	}
	.moment.now details {
		border-color: var(--accent);
	}
	summary {
		list-style: none;
		cursor: pointer;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.moment summary {
		display: grid;
		grid-template-columns: 96px 1fr auto;
		gap: 16px;
		align-items: start;
		padding: 14px 18px;
	}
	.time {
		display: grid;
	}
	.start {
		font-family: var(--serif);
		font-size: 2rem;
		line-height: 1;
		font-variant-numeric: lining-nums tabular-nums;
	}
	.end {
		font-size: 0.78rem;
		color: var(--muted);
		margin-top: 4px;
	}
	.what {
		display: grid;
		gap: 2px;
	}
	.title {
		font-size: 1.05rem;
		font-weight: 500;
	}
	.notes {
		white-space: pre-line;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: 6px;
	}
	.gap {
		padding: 0 0 10px 28px;
		font-style: italic;
	}
	.edit {
		border-top: 1px solid var(--line);
		padding: 16px 18px;
		display: grid;
		gap: 16px;
	}
	.item-form {
		display: grid;
		gap: 12px;
	}
	.item-form .form-row:first-child {
		grid-template-columns: 130px 130px 1fr;
	}
	.actions {
		display: flex;
		gap: 8px;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.shift {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.add summary {
		font-weight: 500;
	}
	.add[open] summary {
		margin-bottom: 14px;
	}
	@media (max-width: 600px) {
		.moment summary {
			grid-template-columns: 72px 1fr;
		}
		.start {
			font-size: 1.6rem;
		}
		.tags {
			grid-column: 2;
			justify-content: start;
		}
		.item-form .form-row:first-child {
			grid-template-columns: 1fr 1fr;
		}
		.wide {
			grid-column: 1 / -1;
		}
	}
	@media print {
		.moment details {
			break-inside: avoid;
			box-shadow: none;
		}
	}
</style>
