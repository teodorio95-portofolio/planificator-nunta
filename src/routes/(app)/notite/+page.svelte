<script lang="ts">
	import { tick } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { formatMoney } from '#lib/calc.ts';
	import { cost, formatAmount, noteTotal, quantity } from '#lib/notes.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Like Notes on a Mac: the list on the left, the open note as a blank page on the right. On a
	// phone, one at a time: the list, or (with ?n=) the note and a way back.
	const picked = $derived(Number(page.url.searchParams.get('n')) || 0);
	const current = $derived(data.notes.find((n) => n.id === picked) ?? (picked ? undefined : data.notes[0]));
	// Form actions keep ?n=, or an enhanced form would land on plain /notite and lose the open note.
	const act = (name: string) => (picked ? `?n=${picked}&/${name}` : `?/${name}`);

	// The page is typed into local state and saved in the background, so a reload of the data after
	// a save never overwrites what is being typed. It is filled again only when another note opens.
	let title = $state('');
	let body = $state('');
	let status = $state<'' | 'saving' | 'saved' | 'error'>('');
	// The calculator is a bar at the foot of the page; it stays open or closed from note to note.
	let calcOpen = $state(false);
	let loaded = 0;
	$effect.pre(() => {
		if (current && current.id !== loaded) {
			loaded = current.id;
			title = current.title;
			body = current.body;
			status = '';
		}
	});

	let timer: ReturnType<typeof setTimeout> | undefined;
	const post = (action: string, fields: Record<string, string | number>, keepalive = false) => {
		const f = new FormData();
		for (const [k, v] of Object.entries(fields)) f.set(k, String(v));
		return fetch(`/notite?/${action}`, {
			method: 'POST',
			body: f,
			keepalive,
			headers: { accept: 'application/json', 'x-sveltekit-action': 'true' }
		});
	};
	async function persist(keepalive = false) {
		clearTimeout(timer);
		timer = undefined;
		if (!loaded) return;
		status = 'saving';
		const ok = await post('save', { id: loaded, title, body }, keepalive)
			.then((r) => r.ok)
			.catch(() => false);
		status = ok ? 'saved' : 'error';
		if (ok && !keepalive) invalidateAll();
	}
	// Saves a moment after typing stops, and at once when leaving the note.
	const typed = () => {
		status = '';
		clearTimeout(timer);
		timer = setTimeout(persist, 700);
	};
	// Closing the tab: keepalive lets the last save outlive the page.
	const flush = () => timer && persist(true);
	beforeNavigate(({ to }) => {
		if (timer) persist();
		// Like Notes: a note left completely empty is not kept (but not the one being opened).
		const leaving = current && Number(to?.url.searchParams.get('n')) !== current.id;
		if (leaving && current && !title.trim() && !body.trim() && !current.rows.length)
			post('delete', { id: current.id }).then(() => invalidateAll());
	});

	let titleField = $state<HTMLInputElement>();
	let bodyField = $state<HTMLTextAreaElement>();
	const opened: SubmitFunction = () => async ({ result, update }) => {
		await update();
		if (result.type === 'success' && result.data?.id) {
			await goto(`?n=${result.data.id}`);
			await tick();
			titleField?.focus();
		}
	};
	// The text grows with what is written instead of scrolling inside a box.
	function autosize(el: HTMLTextAreaElement, _value: string) {
		const fit = () => {
			el.style.height = 'auto';
			el.style.height = `${el.scrollHeight}px`;
		};
		fit();
		return { update: fit };
	}

	let query = $state('');
	const q = $derived(query.trim().toLowerCase());
	const firstLine = (s: string) => s.split('\n').find((l) => l.trim())?.trim() ?? '';
	// The open note shows in the list as it is being typed.
	const live = $derived(data.notes.map((n) => (n.id === current?.id ? { ...n, title, body } : n)));
	const listed = $derived(
		q ? live.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)) : live
	);
	const heading = (n: { title: string; body: string }) => n.title.trim() || firstLine(n.body) || 'Notiță nouă';
	const preview = (n: { title: string; body: string }) =>
		(n.title.trim() ? firstLine(n.body) : n.body.split('\n').filter((l) => l.trim())[1]?.trim()) || 'Fără alt text';

	// Calculator lines save on change (leaving a field) and keep what is on screen while the page reloads.
	const keep: SubmitFunction = () => ({ update }) => update({ reset: false });
	const save = (e: Event) => (e.currentTarget as HTMLFormElement).requestSubmit();
	const confirmDelete: SubmitFunction = ({ cancel }) => {
		if (!confirm('Ștergeți notița, cu tot calculul ei?')) return cancel();
		clearTimeout(timer);
		timer = undefined;
		return async ({ update }) => {
			loaded = 0;
			await update();
			await goto('/notite');
		};
	};
	// Florists quote in lei, so the calculator stays in lei; the total adds euros when the app shows euros.
	const lei = (ron: number) => formatMoney(ron, { currency: 'RON', eur_rate: data.settings.eur_rate });
	const inEur = $derived(data.settings.currency === 'EUR' && data.settings.eur_rate > 0);
	const total = (ron: number) => (inEur ? `${lei(ron)} (≈ ${formatMoney(ron, data.settings)})` : lei(ron));
	const who = (email: string) => email.split('@')[0];
	// SQLite keeps UTC; a fixed zone so the server and the browser print the same time.
	const stamp = new Intl.DateTimeFormat('ro-RO', {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Bucharest'
	});
	const when = (utc: string) => stamp.format(new Date(`${utc.replace(' ', 'T')}Z`));
</script>

<svelte:window onpagehide={flush} />

{#if form?.error}<p class="flash error">{form.error}</p>{/if}

<div class="notes" class:reading={picked > 0}>
	<aside class="card list">
		<div class="list-head">
			<h3>Notițe <span class="muted">({data.notes.length})</span></h3>
			<form method="POST" action={act('add')} use:enhance={opened}>
				<button class="btn small" title="Notiță nouă" aria-label="Notiță nouă">+ Nouă</button>
			</form>
		</div>
		<input type="search" class="search" placeholder="Caută în notițe…" bind:value={query} aria-label="Caută în notițe" />
		<ul>
			{#each listed as n (n.id)}
				<li>
					<a href="?n={n.id}" class:active={n.id === current?.id} aria-current={n.id === current?.id ? 'page' : undefined}>
						<span class="t">{heading(n)}{#if n.pinned}<span class="pin" title="Fixată sus"> •</span>{/if}</span>
						<span class="small muted p">{when(n.updated_at)} · {preview(n)}</span>
					</a>
				</li>
			{:else}
				<li class="muted small empty">{q ? 'Nicio notiță cu textul acesta.' : 'Nicio notiță încă.'}</li>
			{/each}
		</ul>
	</aside>

	{#if current}
		{@const n = current}
		<article class="card sheet">
			<div class="toolbar small muted">
				<a class="back" href="/notite">‹ Notițe</a>
				<span class="stamp">
					{when(n.updated_at)}{n.updated_by ? ` · ${who(n.updated_by)}` : ''}
					{#if status === 'saving'}· se salvează…{:else if status === 'saved'}· salvat{:else if status === 'error'}<span class="bad"
							>· nesalvat, verificați conexiunea</span
						>{/if}
				</span>
				<span class="tools">
					<form method="POST" action={act('pin')} use:enhance={keep}>
						<input type="hidden" name="id" value={n.id} />
						<button class="link-btn">{n.pinned ? 'Desprinde' : 'Fixează sus'}</button>
					</form>
					<form method="POST" action={act('delete')} use:enhance={confirmDelete}>
						<input type="hidden" name="id" value={n.id} />
						<button class="link-btn danger">Șterge</button>
					</form>
				</span>
			</div>

			<input
				class="title"
				bind:this={titleField}
				bind:value={title}
				oninput={typed}
				onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), bodyField?.focus())}
				placeholder="Titlu"
				aria-label="Titlu"
			/>
			<textarea
				class="body"
				bind:this={bodyField}
				bind:value={body}
				oninput={typed}
				use:autosize={body}
				placeholder="Scrieți aici… idei, contacte, liste, cifre la grămadă."
				aria-label="Text"
			></textarea>

		<details class="calc" bind:open={calcOpen}>
			<summary>
				<strong>Calcul</strong>
				<span class="small muted">
					{n.rows.length
						? `${n.rows.length} ${n.rows.length === 1 ? 'rând' : 'rânduri'}`
						: 'bucăți × unități × preț, pentru flori, decor…'}
				</span>
				{#if n.rows.length}<span class="sum">{total(noteTotal(n.rows))}</span>{/if}
			</summary>
			<div class="calc-row head small muted" aria-hidden="true">
				<span>Ce</span><span>Buc. / unit.</span><span>Unitate</span><span>Nr. unit.</span><span>Total buc.</span><span
					>Preț / buc.</span
				><span>Cost</span><span></span>
			</div>
			{#each n.rows as r (r.id)}
				<div class="calc-row">
					<form method="POST" action={act('saveRow')} use:enhance={keep} onchange={save}>
						<input type="hidden" name="id" value={r.id} />
						<input type="hidden" name="note" value={n.id} />
						<label class="f-item"><span class="cap">Ce</span><input name="item" value={r.item} required /></label>
						<label class="f-per"
							><span class="cap">Bucăți / unitate</span><input name="per_unit" inputmode="decimal" value={r.per_unit} /></label
						>
						<label class="f-unit"><span class="cap">Unitate</span><input name="unit" value={r.unit} /></label>
						<label class="f-units"
							><span class="cap">Nr. unități</span><input name="units" inputmode="decimal" value={r.units} /></label
						>
						<span class="f-qty out"><span class="cap">Total buc.</span>{formatAmount(quantity(r))}</span>
						<label class="f-price"
							><span class="cap">Preț / buc. (lei)</span><input name="price" inputmode="decimal" value={r.price} /></label
						>
						<span class="f-cost out"><span class="cap">Cost</span>{lei(cost(r))}</span>
					</form>
					<form method="POST" action={act('deleteRow')} use:enhance={keep}>
						<input type="hidden" name="id" value={r.id} />
						<input type="hidden" name="note" value={n.id} />
						<button class="remove f-del" aria-label="Șterge rândul {r.item}">×</button>
					</form>
				</div>
			{/each}
			<form method="POST" action={act('addRow')} use:enhance class="calc-row new">
				<input type="hidden" name="note" value={n.id} />
				<label class="f-item"><span class="cap">Ce</span><input name="item" placeholder="ex. Trandafiri" required /></label>
				<label class="f-per"><span class="cap">Bucăți / unitate</span><input name="per_unit" inputmode="decimal" placeholder="7" /></label>
				<label class="f-unit"><span class="cap">Unitate</span><input name="unit" placeholder="vază" /></label>
				<label class="f-units"><span class="cap">Nr. unități</span><input name="units" inputmode="decimal" placeholder="21" /></label>
				<span class="f-qty"></span>
				<label class="f-price"><span class="cap">Preț / buc. (lei)</span><input name="price" inputmode="decimal" placeholder="0" /></label>
				<span class="f-cost"></span>
				<button class="btn small f-del" aria-label="Adaugă rândul">+</button>
			</form>
		</details>
		</article>
	{:else}
		<article class="card sheet blank">
			<p class="muted">
				{picked ? 'Notița aceasta nu mai există.' : 'Apăsați „+ Nouă” și scrieți: idei, contacte, calcule pentru flori și decor.'}
			</p>
		</article>
	{/if}
</div>

<style>
	.notes {
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: 16px;
		align-items: start;
	}
	/* The list stays in view, scrolling on its own, like the guest list on Mese. */
	.list {
		position: sticky;
		top: 110px;
		max-height: calc(100dvh - 130px);
		overflow-y: auto;
		padding: 16px 12px;
	}
	.list-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 6px 10px;
	}
	.list-head h3 {
		margin: 0;
	}
	.search {
		margin-bottom: 8px;
	}
	.list ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.list a {
		display: grid;
		gap: 2px;
		padding: 9px 10px;
		border-radius: 10px;
		color: inherit;
		text-decoration: none;
	}
	.list a:hover {
		background: var(--line);
	}
	.list a.active {
		background: color-mix(in srgb, var(--accent) 16%, transparent);
	}
	.t {
		font-weight: 600;
	}
	.t,
	.p {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.pin {
		color: var(--accent);
	}
	.empty {
		padding: 8px 10px;
	}
	.sheet {
		/* Beside the list, not below it: no .card + .card gap. */
		margin-top: 0;
		min-height: calc(100dvh - 130px);
		padding: 16px 28px 0;
		/* The text takes the page; the calculator bar sits at its foot. */
		display: flex;
		flex-direction: column;
	}
	.blank {
		display: grid;
		place-items: center;
		text-align: center;
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	}
	.back {
		display: none;
	}
	.stamp {
		flex: 1;
	}
	.bad {
		color: var(--bad);
	}
	.tools {
		display: flex;
		gap: 14px;
	}
	/* The page itself: no boxes, just a large first line and room to write. */
	.sheet .title,
	.sheet .body {
		border: 0;
		padding: 0;
		background: none;
		box-shadow: none;
	}
	.sheet .title:focus-visible,
	.sheet .body:focus-visible {
		outline: none;
	}
	.sheet .title {
		font-family: var(--serif);
		font-size: 1.9rem;
		font-weight: 600;
		margin-bottom: 8px;
	}
	.sheet .body {
		display: block;
		/* Grows to fill the page, but never below its own text (autosize sets the height). */
		flex: 1 0 auto;
		min-height: 8em;
		resize: none;
		overflow: hidden;
		line-height: 1.6;
		margin-bottom: 16px;
	}
	/* A one-line bar at the foot of the page, still in view while scrolling a long note. Open, it
	   scrolls inside itself rather than taking over the page. */
	.calc {
		position: sticky;
		bottom: 0;
		margin: 0 -28px;
		padding: 0 28px;
		background: var(--surface);
		border-top: 1px solid var(--line);
		border-radius: 0 0 var(--radius) var(--radius);
	}
	.calc[open] {
		max-height: 45dvh;
		overflow-y: auto;
		padding-bottom: 8px;
	}
	.calc summary {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 12px 0;
		cursor: pointer;
		position: sticky;
		top: 0;
		background: var(--surface);
		z-index: 1;
	}
	.sum {
		margin-left: auto;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.calc input {
		padding: 5px 8px;
		font-size: 0.9rem;
	}
	/* One template for the header, every line and the new line, so the columns line up. */
	.calc-row {
		display: grid;
		grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr)) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) 32px;
		gap: 8px;
		align-items: center;
		margin-bottom: 8px;
	}
	.calc-row > form {
		display: contents;
	}
	.calc-row label {
		display: contents;
	}
	.cap {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.out {
		font-variant-numeric: tabular-nums;
	}
	.f-cost.out {
		font-weight: 600;
	}
	.new input {
		border-style: dashed;
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
	.danger:hover {
		color: var(--bad);
	}
	@media (max-width: 700px) {
		/* One at a time, like Notes on a phone: the list, or the open note with a way back. */
		.notes {
			grid-template-columns: 1fr;
		}
		.list {
			position: static;
			max-height: none;
		}
		.reading .list,
		.notes:not(.reading) .sheet {
			display: none;
		}
		.back {
			display: inline;
		}
		.sheet {
			min-height: 70dvh;
			padding: 14px 18px 0;
		}
		.calc {
			margin: 0 -18px;
			padding: 0 18px;
		}
		.stamp {
			text-align: center;
		}
		.calc-row.head {
			display: none;
		}
		/* A line becomes a small card: what, then the counts, then price and cost, each captioned. */
		.calc-row {
			grid-template-columns: repeat(3, minmax(0, 1fr)) 32px;
			grid-template-areas:
				'item item item del'
				'per unit units .'
				'qty price cost .';
			padding-bottom: 10px;
			border-bottom: 1px solid var(--line);
		}
		.calc-row label,
		.calc-row .f-qty,
		.calc-row .f-cost {
			display: grid;
			gap: 2px;
		}
		.cap {
			position: static;
			width: auto;
			height: auto;
			clip-path: none;
			font-size: 0.75rem;
			color: var(--muted);
			font-weight: 400;
		}
		.f-item {
			grid-area: item;
		}
		.f-per {
			grid-area: per;
		}
		.f-unit {
			grid-area: unit;
		}
		.f-units {
			grid-area: units;
		}
		.f-qty {
			grid-area: qty;
		}
		.f-price {
			grid-area: price;
		}
		.f-cost {
			grid-area: cost;
		}
		.f-del {
			grid-area: del;
			align-self: end;
			margin-bottom: 6px;
		}
	}
</style>
