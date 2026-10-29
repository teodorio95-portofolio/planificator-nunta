<script lang="ts">
	import { enhance } from '$app/forms';
	import { canAct } from '#lib/access.ts';
	import { formatDate, taskDueDate, todayIso } from '#lib/calc.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Readers may add tasks, but ticking and deleting stay with the couple.
	const canTick = $derived(canAct(data.user.role, '/sarcini', 'toggle'));
	const canDelete = $derived(canAct(data.user.role, '/sarcini', 'delete'));

	let showDone = $state(false);
	const today = todayIso();
	const wedding = $derived(data.settings.wedding_date);

	const withDue = $derived(
		data.tasks
			.map((t) => ({ ...t, due: wedding ? taskDueDate(wedding, t.days_before) : '' }))
			.sort((a, b) => a.due.localeCompare(b.due) || a.id - b.id)
	);
	const open = $derived(withDue.filter((t) => !t.done));
	const done = $derived(withDue.filter((t) => t.done));
	const pct = $derived(data.tasks.length ? (done.length / data.tasks.length) * 100 : 0);

	// Group open tasks by month, with overdue ones first.
	const groups = $derived.by(() => {
		const out: { label: string; overdue: boolean; tasks: typeof open }[] = [];
		for (const t of open) {
			const overdue = !!t.due && t.due < today;
			const label = overdue
				? 'Întârziate'
				: t.due
					? formatDate(t.due, { day: undefined, month: 'long', year: 'numeric' })
					: 'Fără dată';
			const last = out.at(-1);
			if (last?.label === label) last.tasks.push(t);
			else out.push({ label, overdue, tasks: [t] });
		}
		return out;
	});
</script>

<div class="page-head">
	<div>
		<p class="eyebrow">{done.length} din {data.tasks.length} finalizate</p>
		<h1>Sarcinile <em>noastre</em></h1>
	</div>
</div>

<div class="progress big"><span style="width: {pct}%"></span></div>

{#if form?.error}<p class="flash error">{form.error}</p>{/if}
{#if !wedding}
	<p class="flash">Setați data nunții în <a href="/setari">Setări</a> — termenele se calculează automat din ea.</p>
{/if}

<form method="POST" action="?/add" use:enhance class="card add">
	<div class="form-row">
		<label class="grow">Sarcină nouă <input name="title" placeholder="ex. Probă machiaj" required /></label>
		<label>Termen <input type="date" name="due" /></label>
		<div><button class="btn">Adaugă</button></div>
	</div>
</form>

{#each groups as g (g.label)}
	<section class="month">
		<h3 class:late={g.overdue}>{g.label}</h3>
		<ul class="card tasks">
			{#each g.tasks as t (t.id)}
				{@render task(t)}
			{/each}
		</ul>
	</section>
{/each}

{#if done.length}
	<button class="link-btn" onclick={() => (showDone = !showDone)}>
		{showDone ? 'Ascunde' : 'Arată'} sarcinile finalizate ({done.length})
	</button>
	{#if showDone}
		<ul class="card tasks done-list">
			{#each done as t (t.id)}
				{@render task(t)}
			{/each}
		</ul>
	{/if}
{/if}

{#snippet task(t: (typeof withDue)[number])}
	<li class:done={t.done}>
		{#if canTick}
			<form method="POST" action="?/toggle" use:enhance>
				<input type="hidden" name="id" value={t.id} />
				<button class="check" aria-label={t.done ? 'Marchează nefinalizată' : 'Marchează finalizată'}>
					{t.done ? '✓' : ''}
				</button>
			</form>
		{:else}
			<span class="check" aria-label={t.done ? 'Finalizată' : 'Nefinalizată'}>{t.done ? '✓' : ''}</span>
		{/if}
		<div class="body">
			<span class="title">{t.title}</span>
			<span class="small muted">{t.category}{t.due ? ` · ${formatDate(t.due, { year: undefined })}` : ''}</span>
		</div>
		{#if canDelete}
			<form method="POST" action="?/delete" use:enhance>
				<input type="hidden" name="id" value={t.id} />
				<button class="remove" aria-label="Șterge">×</button>
			</form>
		{/if}
	</li>
{/snippet}

<style>
	.progress.big {
		height: 8px;
		margin-bottom: 20px;
	}
	.add {
		margin-bottom: 24px;
	}
	.add .form-row {
		grid-template-columns: 1fr 180px auto;
	}
	.month h3 {
		margin: 20px 0 8px;
	}
	.late {
		color: var(--bad);
	}
	.tasks {
		list-style: none;
		margin: 0;
		padding: 4px 16px;
	}
	.tasks li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
	}
	.tasks li:last-child {
		border-bottom: 0;
	}
	.body {
		flex: 1;
		display: grid;
	}
	.done .title {
		text-decoration: line-through;
		color: var(--muted);
	}
	.check {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1.5px solid var(--muted);
		background: none;
		color: var(--bg);
		cursor: pointer;
		font-size: 0.8rem;
		display: grid;
		place-items: center;
	}
	span.check {
		flex: none;
		cursor: default;
	}
	.done .check {
		background: var(--accent);
		border-color: var(--accent);
	}
	.remove {
		background: none;
		border: 0;
		color: var(--muted);
		cursor: pointer;
		font-size: 1.1rem;
		opacity: 0.5;
	}
	.remove:hover {
		opacity: 1;
		color: var(--bad);
	}
	.done-list {
		margin-top: 12px;
	}
	@media (max-width: 600px) {
		.add .form-row {
			grid-template-columns: 1fr;
		}
	}
</style>
