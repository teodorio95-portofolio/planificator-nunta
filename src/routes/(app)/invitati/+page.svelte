<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { page } from '$app/state';
	import { formatDate } from '#lib/calc.ts';
	import { fold } from '#lib/guests.ts';
	import { touchSheet } from '#lib/touch-sheet.ts';
	import { CATEGORIES, SIDES, SUBCATEGORIES, categoryLabel, type Category, type Side } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let query = $state('');
	let side = $state<Side | ''>('');
	// 'none' picks the uncategorised ones; '' means every category.
	let category = $state<Category | 'none'>('');
	let status = $state('');
	let tbd = $state<'' | 'da' | 'nu'>('');
	let copied = $state<number | null>(null);

	// The sheet view mirrors the guest spreadsheet; the remembered choice is a per-browser convenience.
	const VIEW_KEY = 'invitati-view';
	let view = $state<'tabel' | 'familii'>('tabel');
	onMount(() => {
		try {
			if (localStorage.getItem(VIEW_KEY) === 'familii') view = 'familii';
		} catch {
			// Storage blocked: keep the default.
		}
	});
	// On touch screens the sheet slides sideways only and the page does the vertical scrolling.
	let sheetWrap = $state<HTMLDivElement>();
	$effect(() => (sheetWrap ? touchSheet(sheetWrap) : undefined));

	function setView(v: typeof view) {
		view = v;
		try {
			localStorage.setItem(VIEW_KEY, v);
		} catch {
			// Not remembered, still switched.
		}
	}

	const STATUS = { pending: 'Fără răspuns', yes: 'Vin', no: 'Nu vin' } as const;
	const SORTS = { category: 'Categorie', file: 'Ca în fișier', name: 'Nume', side: 'Partea', size: 'Nr. persoane' } as const;
	let sort = $state<keyof typeof SORTS>('category');
	const sideRank = (s: Side) => Object.keys(SIDES).indexOf(s);

	const filtered = $derived(
		data.households.filter(
			(h) =>
				(!side || h.side === side) &&
				(!category || h.category === (category === 'none' ? '' : category)) &&
				(!status || h.status === status) &&
				(!tbd || !!h.tbd === (tbd === 'da')) &&
				(!query ||
					fold(h.name).includes(fold(query)) ||
					h.guests.some((g) => fold(g.name).includes(fold(query))))
		)
	);

	// The server sends them in category order; the other orders are stable re-sorts of it.
	const sorted = $derived.by(() => {
		const list = [...filtered];
		if (sort === 'file') list.sort((a, b) => a.id - b.id);
		if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
		if (sort === 'side') list.sort((a, b) => sideRank(a.side) - sideRank(b.side));
		if (sort === 'size') list.sort((a, b) => b.guests.length - a.guests.length);
		return list;
	});

	const sum = (list: typeof data.households, f: (h: (typeof list)[number]) => number) =>
		list.reduce((n, h) => n + f(h), 0);
	const tbdPeople = $derived(sum(data.households, (h) => (h.tbd ? h.guests.length : 0)));
	const totals = $derived({
		guests: sum(filtered, (h) => h.guests.length),
		children: sum(filtered, (h) => h.guests.filter((g) => g.is_child).length),
		tbd: sum(filtered, (h) => (h.tbd ? h.guests.length : 0)),
		yes: sum(filtered, (h) => h.guests.filter((g) => g.attending === 1).length)
	});

	const canEdit = $derived(data.user.role !== 'reader');
	// Cell edits save on change and keep the sheet as it is while it reloads.
	const keep: SubmitFunction = () => ({ update }) => update({ reset: false });
	const save = (e: Event) => (e.currentTarget as HTMLFormElement).requestSubmit();
	const confirmReplace: SubmitFunction = ({ formData, cancel }) => {
		const ask =
			'Familiile și invitații care nu sunt în fișier vor fi șterși, cu răspunsurile și locurile lor la mese. ' +
			'Faceți întâi un backup din Setări dacă nu aveți unul. Continuați?';
		if (formData.get('replace') && !confirm(ask)) cancel();
	};
	const lines = (s: string) => Math.max(1, s.split('\n').length);

	// What the link and WhatsApp buttons send: the save the date months ahead, the invitation (RSVP) later.
	// Both use the family's token, so a new link in the family's page changes both.
	let send = $state<'std' | 'rsvp'>('rsvp');
	const linkUrl = (token: string) => `${page.url.origin}/${send === 'std' ? 's' : 'r'}/${token}`;

	function waLink(phone: string, token: string) {
		const s = data.settings;
		const couple = [s.partner1, s.partner2].filter(Boolean).join(' și ');
		const text =
			send === 'std'
				? `Bună! ${couple ? couple + ' se căsătoresc' : 'Ne căsătorim'}${s.wedding_date ? ` pe ${formatDate(s.wedding_date)}` : ''} — păstrați data! ${linkUrl(token)}`
				: `Bună! ${couple ? couple + ' vă invită' : 'Vă invităm'} la nuntă. Vă rugăm să ne confirmați prezența aici: ${linkUrl(token)}`;
		// Romanian local numbers (07xx…) need the 40 country prefix for wa.me.
		const digits = phone.replace(/\D/g, '').replace(/^0(?=7)/, '40');
		return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
	}

	async function copy(id: number, token: string) {
		await navigator.clipboard.writeText(linkUrl(token));
		copied = id;
		setTimeout(() => (copied = null), 1500);
	}
</script>

<div class="page-head">
	<div>
		<p class="eyebrow">{data.households.length} familii</p>
		<h1>Invitații <em>noștri</em></h1>
	</div>
	{#if data.user.role !== 'reader'}
		<a class="btn ghost small" href="/invitati/export.csv" data-sveltekit-reload>Export CSV</a>
	{/if}
</div>

{#if form?.message}<p class="flash">{form.message}</p>{/if}
{#if form?.error}<p class="flash error">{form.error}</p>{/if}

<div class="stats">
	<div class="stat"><div class="value">{data.hc.invited}</div><div class="label">invitați ({data.hc.children} copii{tbdPeople ? `, ${tbdPeople} TBD` : ''})</div></div>
	<div class="stat"><div class="value">{data.hc.confirmed}</div><div class="label">vin</div></div>
	<div class="stat"><div class="value">{data.hc.declined}</div><div class="label">nu vin</div></div>
	<div class="stat"><div class="value">{data.hc.pending}</div><div class="label">fără răspuns</div></div>
</div>

<div class="grid cols-2 add">
	<details class="card" open={data.households.length === 0}>
		<summary><h3>Adaugă o familie</h3></summary>
		<form method="POST" action="?/add" use:enhance class="form-stack">
			<label>Nume familie / invitat <input name="name" placeholder="Familia Popescu" required /></label>
			<div class="form-row">
				<label>
					Partea
					<select name="side">
						{#each Object.entries(SIDES) as [v, l] (v)}<option value={v}>{l}</option>{/each}
					</select>
				</label>
				<label>
					Categorie
					<select name="category" value="">
						{#each Object.entries(CATEGORIES) as [v, l] (v)}<option value={v}>{l}</option>{/each}
					</select>
				</label>
				<label>
					Subcategorie
					<select name="subcategory">
						{#each Object.entries(SUBCATEGORIES) as [v, l] (v)}<option value={v}>{l}</option>{/each}
					</select>
				</label>
				<label>Telefon <input name="phone" inputmode="tel" placeholder="07…" /></label>
			</div>
			<label>
				Membri — câte unul pe rând, adăugați „(copil)” pentru copii
				<textarea name="members" rows="4" placeholder={'Ion Popescu\nMaria Popescu\nAndrei (copil)'}></textarea>
			</label>
			<label>Observații <input name="notes" placeholder="ex. +1 de confirmat" /></label>
			<label class="check"><input type="checkbox" name="tbd" /> TBD — încă nu știm sigur dacă îi invităm</label>
			<div><button class="btn">Adaugă</button></div>
		</form>
	</details>

	<details class="card">
		<summary><h3>Import din Excel / CSV</h3></summary>
		<form
			method="POST"
			action="?/import"
			enctype="multipart/form-data"
			use:enhance={confirmReplace}
			class="form-stack"
		>
			<p class="small muted">
				Fișierul <code>.xlsx</code> cu lista de invitați merge direct: prima foaie, un rând per invitat, familia
				pe celule unite. Coloane: <code>familii</code> / <code>familie</code>, <code>invitat</code> /
				<code>nume</code> (obligatoriu), <code>din partea</code> (mire / mireasă), <code>categorie</code> (miri /
				nași / familie / prieteni / colegi / cunoștințe), <code>subcategorie</code> (părinți, soră, veri, unchi /
				mătuși, alte rude, serviciu, fost serviciu, facultate, liceu, altele), <code>observatii</code>, <code>tbd</code> (?),
				<code>copil</code> (da), <code>meniu</code>, <code>restrictii</code>, <code>telefon</code>. Pentru CSV
				separatorul e „,” sau „;”.
			</p>
			<input type="file" name="file" accept=".xlsx,.csv,text/csv" required />
			<label class="check">
				<input type="checkbox" name="replace" />
				Înlocuiește lista cu cea din fișier
			</label>
			<p class="small muted">
				Fără bifă: se adaugă doar ce lipsește, nimic nu se dublează. Cu bifă: familiile care nu sunt în fișier se
				șterg; cele găsite după nume își păstrează răspunsurile, meniurile și locurile la mese.
			</p>
			<div><button class="btn ghost">Importă</button></div>
		</form>
	</details>
</div>

{#if data.households.length}
	<section class="card">
		<div class="toolbar">
			<div class="seg" role="group" aria-label="Vizualizare">
				<button type="button" class:on={view === 'tabel'} aria-pressed={view === 'tabel'} onclick={() => setView('tabel')}>
					Tabel
				</button>
				<button type="button" class:on={view === 'familii'} aria-pressed={view === 'familii'} onclick={() => setView('familii')}>
					Familii
				</button>
			</div>
			{#if view === 'familii'}
				<div class="seg" role="group" aria-label="Ce trimitem">
					<button type="button" class:on={send === 'std'} aria-pressed={send === 'std'} onclick={() => (send = 'std')}>
						Save the date
					</button>
					<button type="button" class:on={send === 'rsvp'} aria-pressed={send === 'rsvp'} onclick={() => (send = 'rsvp')}>
						Invitație
					</button>
				</div>
			{/if}
			<label class="sort">
				Ordine
				<select bind:value={sort}>
					{#each Object.entries(SORTS) as [v, l] (v)}<option value={v}>{l}</option>{/each}
				</select>
			</label>
		</div>
		<div class="filters">
			<input type="search" placeholder="Caută după nume…" bind:value={query} aria-label="Caută" />
			<select bind:value={side} aria-label="Partea">
				<option value="">Toate părțile</option>
				{#each Object.entries(SIDES) as [v, l] (v)}<option value={v}>{l}</option>{/each}
			</select>
			<select bind:value={category} aria-label="Categorie">
				<option value="">Toate categoriile</option>
				{#each Object.entries(CATEGORIES) as [v, l] (v)}<option value={v || 'none'}>{l}</option>{/each}
			</select>
			<select bind:value={status} aria-label="Răspuns">
				<option value="">Toate răspunsurile</option>
				{#each Object.entries(STATUS) as [v, l] (v)}<option value={v}>{l}</option>{/each}
			</select>
			<select bind:value={tbd} aria-label="TBD">
				<option value="">TBD: toți</option>
				<option value="da">Doar TBD</option>
				<option value="nu">Fără TBD</option>
			</select>
		</div>

		{#if view === 'tabel'}
			<div class="sheet-wrap" bind:this={sheetWrap}>
				<table class="sheet">
					<thead>
						<tr>
							<th class="fam">Familii</th>
							<th>Invitat</th>
							<th>Din partea</th>
							<th>Categorie</th>
							<th>Subcategorie</th>
							<th class="num" title="Număr persoane / familie">Nr.</th>
							<th>Observații</th>
							<th class="mid">TBD</th>
							<th class="mid">Copil</th>
							<th>Răspuns</th>
						</tr>
					</thead>
					{#each sorted as h (h.id)}
						{@const n = Math.max(1, h.guests.length)}
						<tbody class:tbd={h.tbd}>
							{#each h.guests.length ? h.guests : [null] as g, j (g?.id ?? 0)}
								<tr>
									{#if j === 0}
										<td class="fam" rowspan={n}><a href="/invitati/{h.id}">{h.name}</a></td>
									{/if}
									<td class="guest" class:muted={!g}>{g?.name ?? 'fără membri'}</td>
									{#if j === 0}
										<td rowspan={n}>
											{#if canEdit}
												<form method="POST" action="?/cell" use:enhance={keep} onchange={save}>
													<input type="hidden" name="id" value={h.id} />
													<input type="hidden" name="field" value="side" />
													<select name="value" value={h.side} aria-label="Din partea">
														{#each Object.entries(SIDES) as [v, l] (v)}<option value={v}>{l}</option>{/each}
													</select>
												</form>
											{:else}{SIDES[h.side]}{/if}
										</td>
										<td rowspan={n}>
											{#if canEdit}
												<form method="POST" action="?/cell" use:enhance={keep} onchange={save}>
													<input type="hidden" name="id" value={h.id} />
													<input type="hidden" name="field" value="category" />
													<select name="value" value={h.category} aria-label="Categorie">
														{#each Object.entries(CATEGORIES) as [v, l] (v)}<option value={v}>{v ? l : '—'}</option>{/each}
													</select>
												</form>
											{:else}{h.category ? CATEGORIES[h.category] : ''}{/if}
										</td>
										<td rowspan={n}>
											{#if canEdit}
												<form method="POST" action="?/cell" use:enhance={keep} onchange={save}>
													<input type="hidden" name="id" value={h.id} />
													<input type="hidden" name="field" value="subcategory" />
													<select name="value" value={h.subcategory} aria-label="Subcategorie">
														{#each Object.entries(SUBCATEGORIES) as [v, l] (v)}<option value={v}>{l}</option>{/each}
													</select>
												</form>
											{:else}{h.subcategory ? SUBCATEGORIES[h.subcategory] : ''}{/if}
										</td>
										<td class="num" rowspan={n}>{h.guests.length}</td>
										<td class="notes" rowspan={n}>
											{#if canEdit}
												<form method="POST" action="?/cell" use:enhance={keep} onchange={save}>
													<input type="hidden" name="id" value={h.id} />
													<input type="hidden" name="field" value="notes" />
													<textarea name="value" rows={lines(h.notes)} value={h.notes} aria-label="Observații"></textarea>
												</form>
											{:else}{h.notes}{/if}
										</td>
										<td class="mid" rowspan={n}>
											{#if canEdit}
												<form method="POST" action="?/cell" use:enhance={keep} onchange={save}>
													<input type="hidden" name="id" value={h.id} />
													<input type="hidden" name="field" value="tbd" />
													<input type="checkbox" name="value" value="1" checked={!!h.tbd} aria-label="TBD" />
												</form>
											{:else if h.tbd}?{/if}
										</td>
									{/if}
									<td class="mid">
										{#if g && canEdit}
											<form method="POST" action="?/cell" use:enhance={keep} onchange={save}>
												<input type="hidden" name="id" value={g.id} />
												<input type="hidden" name="field" value="child" />
												<input type="checkbox" name="value" value="1" checked={!!g.is_child} aria-label="Copil" />
											</form>
										{:else if g?.is_child}DA{/if}
									</td>
									<td>
										{#if g}
											{@const s = g.attending === 1 ? 'yes' : g.attending === 0 ? 'no' : 'pending'}
											{#if canEdit}
												<form method="POST" action="?/cell" use:enhance={keep} onchange={save}>
													<input type="hidden" name="id" value={g.id} />
													<input type="hidden" name="field" value="attending" />
													<select class="answer {s}" name="value" value={g.attending === null ? '' : String(g.attending)} aria-label="Răspuns">
														<option value="">—</option>
														<option value="1">Vine</option>
														<option value="0">Nu vine</option>
													</select>
												</form>
											{:else}
												<span class="pill {s}">{s === 'yes' ? 'Vine' : s === 'no' ? 'Nu vine' : '—'}</span>
											{/if}
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					{:else}
						<tbody><tr><td colspan="10" class="muted">Niciun rezultat.</td></tr></tbody>
					{/each}
					<tfoot>
						<tr>
							<td class="fam">{filtered.length} familii</td>
							<td>{totals.guests} invitați</td>
							<td colspan="3"></td>
							<td class="num">{totals.guests}</td>
							<td></td>
							<td class="mid">{totals.tbd || ''}</td>
							<td class="mid">{totals.children || ''}</td>
							<td>{totals.yes} vin</td>
						</tr>
					</tfoot>
				</table>
			</div>
		{:else}
			<ul class="households">
				{#each sorted as h (h.id)}
					<li>
						<div class="who">
							<a class="name" href="/invitati/{h.id}">{h.name}</a>
							{#if h.category || h.subcategory}<span class="pill gold">{categoryLabel(h)}</span>{/if}
							{#if h.tbd}<span class="pill pending" title="Încă nu știm sigur dacă îi invităm">TBD</span>{/if}
							<div class="members small muted">
								{h.guests.map((g) => g.name + (g.is_child ? ' (copil)' : '')).join(', ') || 'fără membri'}
							</div>
							{#if h.notes}<div class="notes-line small">{h.notes}</div>{/if}
						</div>
						<div class="meta">
							<span class="small muted">{SIDES[h.side]}</span>
							<span class="pill {h.status}">{STATUS[h.status]}</span>
						</div>
						<div class="actions">
							<form method="POST" action="?/toggleInvite" use:enhance>
								<input type="hidden" name="id" value={h.id} />
								<button class="link-btn" class:sent={h.invite_sent} title="Marchează invitația ca trimisă">
									{h.invite_sent ? '✓ trimisă' : 'netrimisă'}
								</button>
							</form>
							<button class="btn ghost small" type="button" onclick={() => copy(h.id, h.token)}>
								{copied === h.id ? 'Copiat!' : send === 'std' ? 'Link save the date' : 'Link RSVP'}
							</button>
							{#if h.phone}
								<a class="btn ghost small" href={waLink(h.phone, h.token)} target="_blank" rel="noopener">WhatsApp</a>
							{/if}
						</div>
					</li>
				{:else}
					<li class="muted">Niciun rezultat.</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style>
	.add {
		margin-bottom: 16px;
	}
	details.card + details.card {
		margin-top: 0;
	}
	summary {
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary h3 {
		display: inline;
	}
	summary::after {
		content: '+';
		float: right;
		color: var(--muted);
		font-size: 1.3rem;
		line-height: 1;
	}
	details[open] summary::after {
		content: '−';
	}
	details[open] summary {
		margin-bottom: 14px;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9rem;
		color: var(--ink);
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 12px;
	}
	.seg {
		display: inline-flex;
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 3px;
	}
	.seg button {
		border: 0;
		background: none;
		padding: 5px 14px;
		border-radius: 999px;
		font-size: 0.85rem;
		color: var(--muted);
		cursor: pointer;
	}
	.seg button.on {
		background: var(--ink);
		color: var(--bg);
	}
	.sort {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.sort select {
		width: auto;
		padding: 5px 9px;
		font-size: 0.85rem;
	}
	.filters {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 10px;
		margin-bottom: 8px;
	}
	.filters input {
		grid-column: span 2;
	}
	.notes-line {
		white-space: pre-line;
		color: var(--warn);
	}

	/* The sheet view: a grid like the guest spreadsheet, the family merged over its members. */
	/* The header and totals take --sheet-head from app.css: green, or lilac with the wedding theme. */
	.sheet-wrap {
		--row-bg: var(--surface);
		overflow: auto;
		max-height: 75vh;
		margin: 12px -20px 0;
		border-top: 1px solid var(--line);
	}
	.sheet {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 0.85rem;
	}
	.sheet th,
	.sheet td {
		border-right: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		padding: 4px 8px;
		text-align: left;
		vertical-align: middle;
		background: var(--row-bg);
	}
	.sheet th {
		position: sticky;
		top: 0;
		z-index: 2;
		background: var(--sheet-head);
		color: var(--ink);
		font-weight: 700;
		white-space: nowrap;
	}
	.sheet .fam {
		position: sticky;
		left: 0;
		z-index: 1;
		min-width: 140px;
		max-width: 220px;
		font-weight: 600;
	}
	.sheet th.fam {
		z-index: 3;
	}
	.sheet .fam a {
		color: var(--ink);
		text-decoration: none;
	}
	.sheet .fam a:hover {
		text-decoration: underline;
	}
	.sheet tbody:nth-of-type(even) {
		--row-bg: color-mix(in srgb, var(--surface-2) 55%, var(--surface));
	}
	.sheet tbody.tbd {
		--row-bg: color-mix(in srgb, var(--warn) 9%, var(--surface));
	}
	.sheet tbody:hover {
		--row-bg: var(--accent-soft);
	}
	.sheet tfoot td {
		position: sticky;
		bottom: 0;
		background: var(--sheet-head);
		font-weight: 600;
		white-space: nowrap;
	}
	.sheet .guest {
		white-space: nowrap;
	}
	.sheet .num {
		text-align: right;
	}
	.sheet .mid {
		text-align: center;
	}
	.sheet td.notes {
		min-width: 112px;
		white-space: pre-line;
		color: var(--warn);
	}
	.sheet select,
	.sheet textarea {
		width: 100%;
		min-width: 104px;
		min-height: 0;
		padding: 2px 4px;
		border: 1px solid transparent;
		border-radius: 4px;
		background: transparent;
		font-size: inherit;
		resize: none;
	}
	.sheet textarea {
		color: var(--warn);
		field-sizing: content;
		line-height: 1.35;
	}
	.sheet select:hover,
	.sheet textarea:hover,
	.sheet textarea:focus {
		border-color: var(--line);
		background: var(--surface);
	}
	.sheet input[type='checkbox'] {
		width: 16px;
		height: 16px;
		vertical-align: middle;
	}
	.sheet .pill {
		font-size: 0.7rem;
		padding: 1px 8px;
	}
	/* The answer reads like the status pills, and stays a select to set it by hand. */
	.sheet select.answer {
		min-width: 0;
		width: auto;
		padding: 1px 4px 1px 8px;
		border-radius: 999px;
		font-size: 0.75rem;
	}
	.sheet select.answer.yes {
		background: color-mix(in srgb, var(--ok) 15%, transparent);
		color: var(--ok);
	}
	.sheet select.answer.no {
		background: color-mix(in srgb, var(--bad) 13%, transparent);
		color: var(--bad);
	}
	.sheet select.answer.pending {
		color: var(--muted);
	}
	/* Touch screens: no vertical scroll inside the sheet (the page scrolls), no bounce, and sideways
	   dragging is done by touch-sheet.ts, which also moves the header row along via --head-y. */
	@media (pointer: coarse) {
		.sheet-wrap {
			max-height: none;
			overflow-y: hidden;
			overscroll-behavior-x: none;
			touch-action: pan-y pinch-zoom;
		}
		.sheet thead th {
			transform: translateY(var(--head-y, 0));
		}
		.sheet tfoot td {
			position: static;
		}
	}
	/* iOS zooms into fields under 16px; on touch screens the sheet's fields grow instead. */
	@media (pointer: coarse) {
		.sort select,
		.sheet select,
		.sheet textarea,
		.sheet select.answer {
			font-size: 16px;
		}
	}
	.households {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.households li {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 8px 16px;
		align-items: center;
		padding: 14px 0;
		border-bottom: 1px solid var(--line);
	}
	.households li:last-child {
		border-bottom: 0;
	}
	.name {
		font-weight: 600;
		color: var(--ink);
		text-decoration: none;
		margin-right: 6px;
	}
	.name:hover {
		text-decoration: underline;
	}
	.meta {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.actions {
		display: flex;
		gap: 8px;
		align-items: center;
		justify-content: end;
	}
	.sent {
		color: var(--ok);
		text-decoration: none;
	}
	code {
		font-size: 0.8rem;
		background: var(--surface-2);
		padding: 1px 5px;
		border-radius: 4px;
	}
	@media (max-width: 720px) {
		.filters {
			grid-template-columns: 1fr 1fr;
		}
		.filters input {
			grid-column: 1 / -1;
		}
		.sheet .fam {
			min-width: 120px;
		}
		.households li {
			grid-template-columns: 1fr auto;
		}
		.actions {
			grid-column: 1 / -1;
			justify-content: start;
		}
	}
</style>
