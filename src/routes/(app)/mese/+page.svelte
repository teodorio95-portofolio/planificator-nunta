<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { tick } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { HALL_SLOTS, tableCapacities } from '#lib/floorplan.ts';
	import { fold } from '#lib/guests.ts';
	import { CATEGORIES, SIDES, categoryLabel, type Table } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Room template preview: the tables the estimate needs, as the server will build them.
	let tplSeats = $state(8);
	let tplHead = $state(4);
	const tplPlan = $derived(tableCapacities(data.expected - (Number(tplHead) || 0), Number(tplSeats) || 0));
	const tplSummary = $derived(
		[...Map.groupBy(tplPlan, (c) => c)]
			.sort(([a], [b]) => b - a)
			.map(([c, ts]) => `${ts.length} ${ts.length === 1 ? 'masă' : 'mese'} de ${c}`)
			.join(' + ')
	);
	const tplTotal = $derived(tplPlan.reduce((s, c) => s + c, 0) + (Number(tplHead) || 0));

	// Seating: tap guests (or a household name), then tap a table. Desktop can also drag chips.
	const selected = new SvelteSet<number>();
	// Arrange mode: tables and floor items are dragged to their real place in the room.
	let arrange = $state(false);
	let focused = $state<{ type: 'table' | 'item'; id: number } | null>(null);
	let dropTarget = $state<number | 'none' | null>(null);
	let plan = $state<HTMLDivElement>();
	let scroller = $state<HTMLDivElement>();

	// Zoom: 1 fits the whole plan to the screen width; the buttons or a two-finger pinch go up to 4x.
	const ZOOM_MAX = 4;
	let zoom = $state(1);

	/** Zooms around a point on screen (the pinch centre, or the middle of the visible plan), keeping it in place. */
	async function setZoom(z: number, cx?: number, cy?: number) {
		const next = Math.min(ZOOM_MAX, Math.max(1, Math.round(z * 100) / 100));
		if (!scroller || !plan || next === zoom) return;
		const r = scroller.getBoundingClientRect();
		const pr = plan.getBoundingClientRect();
		const x = (cx ?? r.left + r.width / 2) - r.left;
		const y = (cy ?? Math.min(Math.max(innerHeight / 2, pr.top), pr.bottom)) - pr.top;
		const ratio = next / zoom;
		const left = (scroller.scrollLeft + x) * ratio - x;
		zoom = next;
		await tick();
		scroller.scrollLeft = left;
		window.scrollBy(0, y * ratio - y);
	}

	// Pinch on touch screens. Touch listeners are passive in Svelte, and this one must stop the browser
	// from zooming the whole page, so it is added by hand. One finger still scrolls as usual.
	let pinch: { dist: number; zoom: number } | null = null;
	const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
	$effect(() => {
		const el = scroller;
		if (!el) return;
		const start = (e: TouchEvent) => {
			if (e.touches.length === 2) pinch = { dist: spread(e.touches), zoom };
		};
		const move = (e: TouchEvent) => {
			if (!pinch || e.touches.length !== 2) return;
			e.preventDefault();
			const [a, b] = [e.touches[0], e.touches[1]];
			setZoom((pinch.zoom * spread(e.touches)) / pinch.dist, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
		};
		const end = (e: TouchEvent) => {
			if (e.touches.length < 2) pinch = null;
		};
		// Safari's own pinch gesture, on top of the touch events.
		const gesture = (e: Event) => e.preventDefault();
		el.addEventListener('touchstart', start, { passive: true });
		el.addEventListener('touchmove', move, { passive: false });
		el.addEventListener('touchend', end);
		el.addEventListener('touchcancel', end);
		el.addEventListener('gesturestart', gesture);
		return () => {
			el.removeEventListener('touchstart', start);
			el.removeEventListener('touchmove', move);
			el.removeEventListener('touchend', end);
			el.removeEventListener('touchcancel', end);
			el.removeEventListener('gesturestart', gesture);
		};
	});

	// Positions being dragged, or dropped and not yet confirmed by the server.
	const moved = new SvelteMap<string, { x: number; y: number }>();
	let drag: { key: string; type: 'table' | 'item'; id: number; startX: number; startY: number; dist: number } | null =
		null;

	const unseated = $derived(data.guests.filter((g) => g.table_id === null));
	const byTable = $derived(Map.groupBy(data.guests.filter((g) => g.table_id !== null), (g) => g.table_id!));

	// Search by guest or family name: narrows the unseated list and points at the tables of those already seated.
	let query = $state('');
	const q = $derived(fold(query));
	const matches = (g: (typeof data.guests)[number]) => !q || fold(g.name).includes(q) || fold(g.household).includes(q);
	const seatedMatches = $derived(q ? data.guests.filter((g) => g.table_id !== null && matches(g)) : []);
	const matchTables = $derived(new Set(seatedMatches.map((g) => g.table_id)));
	const tableName = (id: number) => data.tables.find((t) => t.id === id)?.name ?? '';
	// The parents' acquaintances get one section per side, so each set of parents' friends can share tables.
	const sectionLabel = (g: (typeof data.guests)[number]) => {
		const label = categoryLabel(g) || CATEGORIES[''];
		const perSide = g.category === 'cunostinte' && g.subcategory === 'parinti' && g.side !== 'comun';
		return perSide ? `${label} ${SIDES[g.side].toLowerCase()}` : label;
	};
	// Guests arrive sorted by category, then bride's side first, so sections and households keep that order.
	const unseatedSections = $derived(
		[...Map.groupBy(unseated.filter(matches), sectionLabel)].map(([label, guests]) => ({
			label,
			ids: guests.map((g) => g.id),
			households: [...Map.groupBy(guests, (g) => g.household_id).values()]
		}))
	);
	const seats = $derived(data.tables.reduce((s, t) => s + t.capacity, 0));
	const focusedTable = $derived(focused?.type === 'table' ? data.tables.find((t) => t.id === focused!.id) : undefined);
	const focusedItem = $derived(focused?.type === 'item' ? data.items.find((i) => i.id === focused!.id) : undefined);

	const pos = (type: string, o: { id: number; x: number; y: number }) => moved.get(`${type}:${o.id}`) ?? o;

	async function post(action: string, fields: Record<string, string | number>) {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.set(k, String(v));
		await fetch(`?/${action}`, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
		await invalidateAll();
	}

	async function assign(ids: number[], tableId: number | null) {
		if (!ids.length) return;
		selected.clear();
		await post('assign', { guest_ids: ids.join(','), table_id: tableId ?? '' });
	}

	function toggle(id: number) {
		if (selected.has(id)) selected.delete(id);
		else selected.add(id);
	}

	function toggleGroup(ids: number[]) {
		const all = ids.every((id) => selected.has(id));
		for (const id of ids) {
			if (all) selected.delete(id);
			else selected.add(id);
		}
	}

	function onChipDragStart(e: DragEvent, id: number) {
		const ids = selected.has(id) ? [...selected] : [id];
		e.dataTransfer?.setData('text/plain', ids.join(','));
	}

	function onDrop(e: DragEvent, tableId: number | null) {
		e.preventDefault();
		dropTarget = null;
		const ids = (e.dataTransfer?.getData('text/plain') ?? '').split(',').map(Number).filter(Boolean);
		assign(ids, tableId);
	}

	function pointerDown(e: PointerEvent, type: 'table' | 'item', o: { id: number; x: number; y: number }) {
		if (!arrange) return;
		e.preventDefault();
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		drag = { key: `${type}:${o.id}`, type, id: o.id, startX: e.clientX, startY: e.clientY, dist: 0 };
	}

	function pointerMove(e: PointerEvent) {
		if (!drag || !plan) return;
		const r = plan.getBoundingClientRect();
		drag.dist = Math.max(drag.dist, Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY));
		if (drag.dist < 4) return;
		const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 2) / 2;
		moved.set(drag.key, {
			x: clamp(((e.clientX - r.left) / r.width) * 100),
			y: clamp(((e.clientY - r.top) / r.height) * 100)
		});
	}

	async function pointerUp() {
		if (!drag) return;
		const d = drag;
		drag = null;
		const p = moved.get(d.key);
		if (d.dist < 4 || !p) {
			moved.delete(d.key);
			focused = { type: d.type, id: d.id };
			return;
		}
		await post('position', { type: d.type, id: d.id, x: p.x, y: p.y });
		moved.delete(d.key);
	}

	function onTableClick(t: Table) {
		if (arrange) return;
		if (selected.size) assign([...selected], t.id);
		else focused = focused?.type === 'table' && focused.id === t.id ? null : { type: 'table', id: t.id };
	}

	// Round tables grow a little with their seat count; long tables stretch.
	const tableWidth = (t: Table) =>
		t.shape === 'rotunda' ? Math.min(16, 5 + t.capacity * 0.75) : Math.min(42, 7 + t.capacity * 2);

	function roundSeats(n: number) {
		return Array.from({ length: n }, (_, i) => {
			const a = (i / n) * Math.PI * 2 - Math.PI / 2;
			return { x: 50 + 42 * Math.cos(a), y: 50 + 42 * Math.sin(a) };
		});
	}

	function longSeats(n: number) {
		const top = Math.ceil(n / 2);
		const row = (count: number, y: number) =>
			Array.from({ length: count }, (_, i) => ({ x: count === 1 ? 120 : 40 + (160 * i) / (count - 1), y }));
		return [...row(top, 12), ...row(n - top, 88)];
	}
</script>

<svelte:window onpointermove={pointerMove} onpointerup={pointerUp} />

<div class="page-head">
	<div>
		<p class="eyebrow">
			{data.tables.length} mese · {seats} locuri · {data.guests.length - unseated.length} așezați din {data.guests.length}
		</p>
		<h1>Așezarea <em>la mese</em></h1>
	</div>
	<div class="head-actions no-print">
		<button class="btn small" class:ghost={!arrange} onclick={() => ((arrange = !arrange), (focused = null))}>
			{arrange ? 'Gata cu aranjarea' : 'Aranjează sala'}
		</button>
		<button class="btn ghost small" onclick={() => window.print()}>Printează</button>
	</div>
</div>

{#if form?.message}<p class="flash">{form.message}</p>{/if}
{#if form?.error}<p class="flash error">{form.error}</p>{/if}
{#if seats > 0 && seats < data.expected}
	<p class="flash error">
		Estimarea e de ~{data.expected} persoane, dar planul are doar {seats} locuri. Generați din nou planul sau
		adăugați locuri.
	</p>
{/if}

<div class="tools no-print">
	<details class="card">
		<summary>Șablon sală</summary>
		<form
			method="POST"
			action="?/template"
			use:enhance={({ cancel }) => {
				if (data.tables.length && !confirm('Planul actual se înlocuiește și toți invitații devin nealocați. Continuați?')) cancel();
			}}
			class="form-row"
		>
			<label>Locuri / masă <input type="number" name="capacity" min="1" max="20" bind:value={tplSeats} /></label>
			<label>
				Masa mirilor (locuri, 0 = fără)
				<input type="number" name="head_seats" min="0" max="40" bind:value={tplHead} />
			</label>
			<label class="check"><input type="checkbox" name="band" checked /> Formație / DJ</label>
			<div><button class="btn small">Generează</button></div>
		</form>
		<p class="small">
			Pentru ~{data.expected} persoane estimate: <strong>{tplSummary || 'nicio masă'}</strong>
			{#if tplHead > 0}+ masa mirilor de {tplHead}{/if} = {tplTotal} locuri.
		</p>
		<p class="small muted">
			Sala are {HALL_SLOTS} locuri de mese, pe 3 coloane: jumătate deasupra ringului, jumătate dedesubt, întâi
			lângă ring. Masa mirilor e sus, formația pe ring în dreapta; intrarea, barul și candy bar-ul
			sunt pe margini. Estimarea vine din Setări. După generare, „Aranjează sala”
			vă lasă să mutați orice.
		</p>
	</details>

	<details class="card">
		<summary>Adaugă</summary>
		<form method="POST" action="?/addTables" use:enhance class="form-row">
			<label>Mese <input type="number" name="count" min="1" max="50" value="1" /></label>
			<label>Locuri <input type="number" name="capacity" min="1" max="60" value="8" /></label>
			<label>
				Formă
				<select name="shape">
					<option value="rotunda">Rotundă</option>
					<option value="dreptunghiulara">Dreptunghiulară</option>
				</select>
			</label>
			<div><button class="btn small">Adaugă mese</button></div>
		</form>
		<form method="POST" action="?/addItem" use:enhance class="items">
			<span class="small muted">Element pe plan:</span>
			{#each ['Ring de dans', 'Formație / DJ', 'Bar', 'Intrare', 'Candy bar', 'Foto corner'] as label (label)}
				<button class="btn ghost small" name="label" value={label}>{label}</button>
			{/each}
		</form>
	</details>

	<details class="card">
		<summary>Imagine sală</summary>
		<form method="POST" action="?/uploadPlan" enctype="multipart/form-data" use:enhance class="form-row">
			<label>Schiță sau poză de sus a sălii <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required /></label>
			<div><button class="btn small">Încarcă</button></div>
		</form>
		{#if data.hasPlanImage}
			<form method="POST" action="?/removePlan" use:enhance><button class="link-btn">Scoate imaginea</button></form>
		{/if}
		<p class="small muted">Apare estompată sub mese, ca să le puteți potrivi pe planul real.</p>
	</details>
</div>

<div class="layout">
	<aside
		class="card unseated no-print"
		class:over={dropTarget === 'none'}
		ondragover={(e) => {
			e.preventDefault();
			dropTarget = 'none';
		}}
		ondragleave={() => (dropTarget = null)}
		ondrop={(e) => onDrop(e, null)}
	>
		<div class="aside-top">
			<div class="aside-head">
				<h3>Nealocați <span class="muted">({unseated.length})</span></h3>
				{#if selected.size}<button class="link-btn" onclick={() => selected.clear()}>Deselectează</button>{/if}
			</div>
			<p class="small muted hint">
				{selected.size
					? `${selected.size} selectați — atingeți o masă pe plan.`
					: 'Atingeți invitați (sau numele familiei), apoi o masă. Pe calculator îi puteți și trage.'}
			</p>
			<input type="search" class="search" placeholder="Caută după nume…" bind:value={query} aria-label="Caută invitat" />
		</div>
		{#if seatedMatches.length}
			<div class="found">
				<p class="small muted">Deja la mese</p>
				{#each seatedMatches as g (g.id)}
					<button class="found-row" onclick={() => (focused = { type: 'table', id: g.table_id! })}>
						{g.name} <span class="muted">· {tableName(g.table_id!)}</span>
					</button>
				{/each}
			</div>
		{/if}
		{#each unseatedSections as section (section.label)}
			<section class="category">
				<button class="category-head" onclick={() => toggleGroup(section.ids)} title="Selectează toată categoria">
					{section.label} <span class="muted">({section.ids.length})</span>
				</button>
				{#each section.households as group (group[0].household_id)}
					<div class="group">
						<button class="family" onclick={() => toggleGroup(group.map((g) => g.id))}>
							{group[0].household}{group[0].side === 'comun' ? '' : ` · ${SIDES[group[0].side]}`}
						</button>
						{#each group as g (g.id)}
							<button
								class="chip"
								class:selected={selected.has(g.id)}
								class:pending={g.attending === null}
								draggable="true"
								ondragstart={(e) => onChipDragStart(e, g.id)}
								onclick={() => toggle(g.id)}
								title={g.attending === null ? 'Nu a confirmat încă' : ''}
							>
								{g.name}{g.is_child ? ' ·c' : ''}
							</button>
						{/each}
					</div>
				{/each}
			</section>
		{:else}
			<p class="muted small">{q ? 'Niciun invitat nealocat cu numele acesta.' : 'Toți invitații au loc.'}</p>
		{/each}
	</aside>

	<section class="plan-col">
		<div class="zoom no-print" role="group" aria-label="Zoom plan">
			<button class="btn ghost small" onclick={() => setZoom(zoom / 1.5)} disabled={zoom <= 1} aria-label="Micșorează">−</button>
			<button class="btn ghost small" onclick={() => setZoom(1)} disabled={zoom === 1} title="Toată sala pe ecran">
				{Math.round(zoom * 100)}%
			</button>
			<button class="btn ghost small" onclick={() => setZoom(zoom * 1.5)} disabled={zoom >= ZOOM_MAX} aria-label="Mărește">+</button>
		</div>
		<div class="plan-scroll" bind:this={scroller}>
			<div
				class="plan"
				class:arrange
				class:searching={matchTables.size > 0}
				style:width={zoom === 1 ? null : `${zoom * 100}%`}
				bind:this={plan}
			>
				{#if data.hasPlanImage}<img class="bg" src="/mese/plan" alt="" />{/if}

				{#each data.items as it (it.id)}
					{@const p = pos('item', it)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="item"
						class:focused={focused?.type === 'item' && focused.id === it.id}
						style="left: {p.x}%; top: {p.y}%; width: {it.w}%; height: {it.h}%"
						onpointerdown={(e) => pointerDown(e, 'item', it)}
					>
						<span>{it.label}</span>
					</div>
				{/each}

				{#each data.tables as t (t.id)}
					{@const p = pos('table', t)}
					{@const seated = byTable.get(t.id) ?? []}
					<div
						class="table {t.shape}"
						class:over={dropTarget === t.id}
						class:full={seated.length > t.capacity}
						class:done={seated.length === t.capacity}
						class:target={selected.size > 0}
						class:focused={focused?.type === 'table' && focused.id === t.id}
						class:match={matchTables.has(t.id)}
						style="left: {p.x}%; top: {p.y}%; width: {tableWidth(t)}%"
						role="button"
						tabindex="0"
						aria-label="{t.name}, {seated.length} din {t.capacity} locuri"
						onpointerdown={(e) => pointerDown(e, 'table', t)}
						onclick={() => onTableClick(t)}
						onkeydown={(e) => e.key === 'Enter' && onTableClick(t)}
						ondragover={(e) => {
							e.preventDefault();
							dropTarget = t.id;
						}}
						ondragleave={() => (dropTarget = null)}
						ondrop={(e) => onDrop(e, t.id)}
					>
						{#if t.shape === 'rotunda'}
							<svg viewBox="0 0 100 100" aria-hidden="true">
								{#each roundSeats(t.capacity) as s, i (i)}
									<circle class="seat" class:taken={i < seated.length} cx={s.x} cy={s.y} r="6.5" />
								{/each}
								<circle class="top" cx="50" cy="50" r="31" />
							</svg>
						{:else}
							<svg viewBox="0 0 240 100" aria-hidden="true">
								{#each longSeats(t.capacity) as s, i (i)}
									<circle class="seat" class:taken={i < seated.length} cx={s.x} cy={s.y} r="8" />
								{/each}
								<rect class="top" x="22" y="26" width="196" height="48" rx="8" />
							</svg>
						{/if}
						<span class="label">
							<strong>{t.name.replace(/^Masa\s+(?=\d+$)/, '')}</strong>
							<small>{seated.length}/{t.capacity}</small>
						</span>
					</div>
				{/each}

				{#if data.tables.length === 0 && data.items.length === 0}
					<div class="plan-empty">
						<h3>Sala e goală</h3>
						<p class="muted small">Începeți cu „Șablon sală” de mai sus.</p>
					</div>
				{/if}
			</div>
		</div>
		<p class="small muted legend no-print">
			{arrange
				? 'Trageți mesele și elementele în poziția lor reală. Atingeți una ca s-o modificați.'
				: 'Atingeți o masă ca să vedeți cine stă la ea.'}
		</p>

		{#if focusedTable}
			{@const seated = byTable.get(focusedTable.id) ?? []}
			<div class="card detail no-print">
				<div class="detail-head">
					<h3>{focusedTable.name} <span class="muted small">{seated.length}/{focusedTable.capacity}</span></h3>
					<button class="link-btn" onclick={() => (focused = null)}>închide</button>
				</div>
				<ul class="seated">
					{#each seated as g (g.id)}
						<li class:hit={q && matches(g)}>
							{g.name}{g.is_child ? ' (copil)' : ''} <span class="muted small">· {g.household}</span>
							<button class="remove" aria-label="Scoate de la masă" onclick={() => assign([g.id], null)}>×</button>
						</li>
					{:else}
						<li class="muted small">Nimeni încă.</li>
					{/each}
				</ul>
				<form
					method="POST"
					action="?/updateTable"
					use:enhance={() => async ({ update }) => update({ reset: false })}
					class="form-row"
				>
					<input type="hidden" name="id" value={focusedTable.id} />
					<label>Nume <input name="name" value={focusedTable.name} /></label>
					<label>Locuri <input type="number" name="capacity" value={focusedTable.capacity} min="1" max="60" /></label>
					<label>
						Formă
						<select name="shape" value={focusedTable.shape}>
							<option value="rotunda">Rotundă</option>
							<option value="dreptunghiulara">Dreptunghiulară</option>
						</select>
					</label>
					<div class="row">
						<button class="btn small">Salvează</button>
						<button class="btn danger small" formaction="?/deleteTable" onclick={() => (focused = null)}>Șterge</button>
					</div>
				</form>
			</div>
		{:else if focusedItem}
			<div class="card detail no-print">
				<div class="detail-head">
					<h3>{focusedItem.label}</h3>
					<button class="link-btn" onclick={() => (focused = null)}>închide</button>
				</div>
				<form
					method="POST"
					action="?/updateItem"
					use:enhance={() => async ({ update }) => update({ reset: false })}
					class="form-row"
				>
					<input type="hidden" name="id" value={focusedItem.id} />
					<label>Text <input name="label" value={focusedItem.label} /></label>
					<label>Lățime (%) <input type="number" name="w" value={focusedItem.w} min="3" max="100" /></label>
					<label>Înălțime (%) <input type="number" name="h" value={focusedItem.h} min="3" max="100" /></label>
					<div class="row">
						<button class="btn small">Salvează</button>
						<button class="btn danger small" formaction="?/deleteItem" onclick={() => (focused = null)}>Șterge</button>
					</div>
				</form>
			</div>
		{/if}
	</section>
</div>

<!-- Printed under the plan: who sits where. -->
<section class="print-list">
	{#each data.tables as t (t.id)}
		<div>
			<h4>{t.name}</h4>
			<ol>
				{#each byTable.get(t.id) ?? [] as g (g.id)}<li>{g.name}</li>{/each}
			</ol>
		</div>
	{/each}
</section>

<style>
	.head-actions {
		display: flex;
		gap: 8px;
	}
	.tools {
		display: grid;
		gap: 10px;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		margin-bottom: 16px;
		align-items: start;
	}
	.tools .card {
		padding: 12px 16px;
	}
	.tools .card + .card {
		margin-top: 0;
	}
	.tools summary {
		cursor: pointer;
		font-weight: 500;
	}
	.tools details[open] {
		grid-column: 1 / -1;
	}
	.tools details[open] summary {
		margin-bottom: 12px;
	}
	.tools form + form,
	.tools form + p {
		margin-top: 12px;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--ink);
	}
	.items {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	.layout {
		display: grid;
		grid-template-columns: 260px 1fr;
		gap: 16px;
		align-items: start;
	}
	.unseated {
		position: sticky;
		top: 110px;
		max-height: calc(100dvh - 130px);
		overflow-y: auto;
		padding-top: 0;
	}
	/* Count and search stay pinned while the list scrolls under them. */
	.aside-top {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--surface);
		padding-top: 20px;
		border-bottom: 1px solid var(--line);
		margin-bottom: 10px;
	}
	.aside-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.hint {
		margin-top: 0;
	}
	.category {
		margin-bottom: 16px;
		padding-top: 10px;
		border-top: 1px solid var(--line);
	}
	.category-head {
		display: block;
		width: 100%;
		background: none;
		border: 0;
		padding: 0 0 8px;
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--ink);
		cursor: pointer;
		text-align: left;
	}
	.group {
		margin-bottom: 12px;
	}
	.family {
		display: block;
		background: none;
		border: 0;
		padding: 0 0 4px;
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
		cursor: pointer;
		text-align: left;
	}
	.chip {
		display: inline-block;
		margin: 0 4px 4px 0;
		padding: 5px 10px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-size: 0.85rem;
		cursor: grab;
		touch-action: manipulation;
	}
	.chip.pending {
		border-style: dashed;
	}
	.chip.selected {
		background: var(--ink);
		color: var(--bg);
		border-color: var(--ink);
	}
	.over {
		outline: 2px dashed var(--accent);
		outline-offset: 2px;
	}
	.search {
		margin-bottom: 10px;
	}
	.found {
		margin-bottom: 12px;
	}
	.found p {
		margin: 0 0 4px;
	}
	.found-row {
		display: block;
		width: 100%;
		background: none;
		border: 0;
		padding: 3px 0;
		font-size: 0.85rem;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.found-row:hover {
		text-decoration: underline;
	}
	.seated li.hit {
		font-weight: 600;
	}

	/* Floor plan */
	.plan-scroll {
		overflow-x: auto;
		border-radius: var(--radius);
	}
	.zoom {
		display: flex;
		justify-content: end;
		gap: 6px;
		margin-bottom: 8px;
	}
	.zoom .btn {
		min-width: 44px;
		font-variant-numeric: tabular-nums;
	}
	.zoom .btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	/* Fits the column at zoom 1 (a phone sees the whole room); zoom widens it and the strip scrolls sideways. */
	.plan {
		position: relative;
		aspect-ratio: 16 / 10;
		container-type: inline-size;
		background-color: var(--surface);
		background-image:
			linear-gradient(color-mix(in srgb, var(--line) 45%, transparent) 1px, transparent 1px),
			linear-gradient(90deg, color-mix(in srgb, var(--line) 45%, transparent) 1px, transparent 1px);
		background-size: 5% 8%;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		overflow: hidden;
		user-select: none;
	}
	.bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.3;
		pointer-events: none;
	}
	.item,
	.table {
		position: absolute;
		transform: translate(-50%, -50%);
		touch-action: none;
	}
	.item {
		display: grid;
		place-items: center;
		border: 1.5px dashed var(--gold);
		border-radius: 10px;
		background: color-mix(in srgb, var(--gold) 7%, transparent);
		color: var(--gold);
		font-family: var(--serif);
		font-style: italic;
		font-size: 1.6cqw;
		text-align: center;
		padding: 2px;
	}
	.table {
		cursor: default;
	}
	.table svg {
		display: block;
		width: 100%;
		overflow: visible;
	}
	.seat {
		fill: var(--surface);
		stroke: var(--muted);
		stroke-width: 1.5;
	}
	.seat.taken {
		fill: var(--accent);
		stroke: var(--accent);
	}
	.top {
		fill: var(--surface-2);
		stroke: var(--ink);
		stroke-width: 1.2;
	}
	.table.done .top {
		fill: var(--accent-soft);
	}
	.table.full .top {
		stroke: var(--bad);
		stroke-width: 2.5;
	}
	.label {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		text-align: center;
		line-height: 1.05;
		pointer-events: none;
	}
	.label strong {
		font-family: var(--serif);
		font-weight: 500;
		font-size: 2.1cqw;
	}
	.label small {
		font-size: 1.2cqw;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.dreptunghiulara .label strong {
		font-size: 1.5cqw;
	}
	.table.target {
		cursor: pointer;
	}
	.table.target:hover .top {
		stroke: var(--accent);
		stroke-width: 2.5;
	}
	.focused {
		filter: drop-shadow(0 0 0.5cqw color-mix(in srgb, var(--accent) 70%, transparent));
	}
	/* While searching, the tables of the guests found stand out and the rest fade. */
	.plan.searching .table:not(.match) {
		opacity: 0.35;
	}
	.table.match .top {
		stroke: var(--gold);
		stroke-width: 3;
	}
	.plan.arrange .table,
	.plan.arrange .item {
		cursor: grab;
	}
	.plan.arrange .table:active,
	.plan.arrange .item:active {
		cursor: grabbing;
	}
	.plan.arrange {
		border-color: var(--accent);
		border-style: dashed;
	}
	.plan-empty {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		text-align: center;
	}
	.legend {
		margin: 8px 0 0;
	}
	.detail {
		margin-top: 12px;
	}
	.detail-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.seated {
		list-style: none;
		padding: 0;
		margin: 0 0 12px;
		columns: 2;
	}
	.seated li {
		padding: 3px 0;
		break-inside: avoid;
	}
	.remove {
		background: none;
		border: 0;
		color: var(--muted);
		cursor: pointer;
		font-size: 1rem;
	}
	.row {
		display: flex;
		gap: 6px;
	}
	.print-list {
		display: none;
	}
	@media (max-width: 860px) {
		.layout {
			grid-template-columns: 1fr;
		}
		.unseated {
			position: static;
			max-height: 300px;
		}
		.seated {
			columns: 1;
		}
	}
	@media print {
		.layout {
			grid-template-columns: 1fr;
		}
		.plan {
			width: auto !important;
		}
		.print-list {
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			gap: 8px 16px;
			margin-top: 16px;
			font-size: 9pt;
			break-before: page;
		}
		.print-list h4 {
			margin: 0;
			font-family: var(--serif);
			font-size: 12pt;
		}
		.print-list ol {
			margin: 2px 0 0;
			padding-left: 16px;
		}
	}
</style>
