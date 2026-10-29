<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { formatDate, formatMoney, toRon } from '#lib/calc.ts';
	import { EXPENSE_CATEGORIES, EXPENSE_KINDS } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let giftFilter = $state<'coming' | 'all'>('coming');

	// The per-family gift list stays folded unless opened; the choice is a per-browser convenience.
	const GIFTS_KEY = 'buget-gifts-open';
	let giftsOpen = $state(false);
	onMount(() => {
		try {
			giftsOpen = localStorage.getItem(GIFTS_KEY) === '1';
		} catch {
			// Storage blocked: stay folded.
		}
	});
	// Reads the element, not giftsOpen: this handler can run before bind:open has updated it.
	function rememberGifts(e: Event) {
		try {
			localStorage.setItem(GIFTS_KEY, (e.currentTarget as HTMLDetailsElement).open ? '1' : '0');
		} catch {
			// Not remembered, still toggled.
		}
	}

	const s = $derived(data.settings);
	const fmt = (n: number) => formatMoney(n, s);
	const budgetTotal = $derived(toRon(s.budget_total, s.currency, s.eur_rate));
	const projected = $derived(data.income - data.money.total);
	const order = (c: string) => (EXPENSE_CATEGORIES.indexOf(c) + 100) % 100;
	const categories = $derived(
		[...Map.groupBy(data.expenses, (e) => e.category)]
			.sort(([a], [b]) => order(a) - order(b))
			.map(([cat, items]) => {
				const total = items.reduce((t, e) => t + e.total, 0);
				const paid = items.reduce((t, e) => t + Math.min(e.total, toRon(e.paid, e.currency, s.eur_rate)), 0);
				return { cat, items, total, paid, paidPct: total ? (paid / total) * 100 : 0 };
			})
	);
	const pct = (n: number) => (n > 0 && n < 1 ? '<1%' : `${Math.round(n)}%`);
	const unitLabel = (e: (typeof data.expenses)[number]) => {
		const price = `${e.amount.toLocaleString('ro-RO')} ${e.currency === 'EUR' ? '€' : 'lei'}`;
		if (e.kind === 'per_adult') return `${price} × ${data.hc.expectedAdults} adulți`;
		if (e.kind === 'per_child') return `${price} × ${data.hc.expectedChildren} copii`;
		return '';
	};
	const balance = $derived(data.gifts - data.money.total);
	const overBudget = $derived(budgetTotal > 0 && data.money.total > budgetTotal);
	const giftRows = $derived(
		giftFilter === 'all' ? data.giftRows : data.giftRows.filter((r) => r.coming || r.gift_amount > 0)
	);
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
		update({ reset: false });
</script>

<div class="page-head">
	<div>
		<p class="eyebrow">
			Calculat pentru {data.hc.expectedAdults} adulți și {data.hc.expectedChildren} copii
			({s.attendance_rate}% din invitați) · 1 EUR = {s.eur_rate} lei
		</p>
		<h1>Bugetul <em>nostru</em></h1>
	</div>
</div>

{#if form?.error}<p class="flash error">{form.error}</p>{/if}

<div class="stats">
	<div class="stat">
		<div class="value">{fmt(data.money.total)}</div>
		<div class="label">
			cost estimat{#if budgetTotal} · <span class:bad={overBudget}>buget {fmt(budgetTotal)}</span>{/if}{#if data.maxTotal > data.money.total}
				· dacă vin toți {fmt(data.maxTotal)}{/if}
		</div>
	</div>
	<div class="stat"><div class="value">{fmt(data.money.paid)}</div><div class="label">plătit</div></div>
	<div class="stat"><div class="value">{fmt(data.money.remaining)}</div><div class="label">rest de plată</div></div>
	<div class="stat highlight">
		<div class="value">{fmt(data.breakEven)}</div>
		<div class="label">dar de echilibru / persoană ({fmt(data.breakEven * 2)} / cuplu)</div>
	</div>
</div>

<section class="card">
	<h2>Cheltuieli</h2>
	<p class="small muted">
		„Per adult” și „per copil” se înmulțesc automat cu numărul estimat de invitați. Atingeți o linie ca s-o
		modificați.
	</p>

	{#each categories as c (c.cat)}
		<details class="group" open>
			<summary class="cat">
				<span class="cat-head">
					<span class="chev" aria-hidden="true">›</span>
					<h3>{c.cat}</h3>
					<span class="cat-total">{fmt(c.total)}</span>
				</span>
				<span class="pay" title="{pct(c.paidPct)} achitat">
					<span style="width: {c.paidPct}%"></span>
				</span>
				<span class="small muted">
					{c.items.length}
					{c.items.length === 1 ? 'cheltuială' : 'cheltuieli'} ·
					{#if c.paid >= c.total - 0.5}
						achitat integral
					{:else}
						achitat {pct(c.paidPct)}{c.paid > 0 ? ` (${fmt(c.paid)})` : ''} · rest {fmt(c.total - c.paid)}
					{/if}
				</span>
			</summary>
			<div class="items">
				{#each c.items as e (e.id)}
					{@const paidRon = toRon(e.paid, e.currency, s.eur_rate)}
					<details class="exp">
						<summary>
							<span class="what">
								{e.name}
								<span class="small muted">{[e.vendor, unitLabel(e)].filter(Boolean).join(' · ')}</span>
							</span>
							{#if paidRon > 0}
								<span class="pill" class:yes={paidRon >= e.total - 0.5}>
									{paidRon >= e.total - 0.5 ? 'achitat' : `avans ${fmt(paidRon)}`}
								</span>
							{/if}
							<span class="total">{fmt(e.total)}</span>
						</summary>
						<form method="POST" action="?/updateExpense" use:enhance={keep} class="exp-form">
							<input type="hidden" name="id" value={e.id} />
							{@render fields(e)}
							<div class="exp-actions">
								<button class="btn small">Salvează</button>
								<button class="btn danger small" formaction="?/deleteExpense">Șterge</button>
							</div>
						</form>
					</details>
				{/each}
			</div>
		</details>
	{/each}

	<details class="exp add" open={data.expenses.length === 0}>
		<summary><span class="what">+ Adaugă o cheltuială</span></summary>
		<form method="POST" action="?/addExpense" use:enhance class="exp-form">
			{@render fields()}
			<div class="exp-actions"><button class="btn small">Adaugă</button></div>
		</form>
	</details>
</section>

<section class="card balance">
	<div>
		<p class="eyebrow">Estimare înainte de nuntă</p>
		<p class="big">
			Venituri minus costuri:
			<strong class:pos={projected >= 0} class:neg={projected < 0}>{projected >= 0 ? '+' : '−'}{fmt(Math.abs(projected))}</strong>
		</p>
		<p class="small muted">
			Daruri estimate: {data.hc.payingAdults} invitați adulți × {fmt(toRon(s.gift_estimate, s.currency, s.eur_rate))}
			dar mediu. Darul de echilibru exclude nașii, părinții, mirii și copiii. Sumele
			se modifică din {#if data.user.role === 'admin'}<a href="/setari">Setări</a>{:else}Setări (doar
				administratorul){/if}.
		</p>
	</div>
</section>

<section class="card balance">
	<div>
		<p class="eyebrow">Bilanțul real (daruri înregistrate)</p>
		<p class="big">
			{fmt(data.gifts)} <span class="muted">daruri</span> − {fmt(data.money.total)}
			<span class="muted">cheltuieli</span> =
			<strong class:pos={balance >= 0} class:neg={balance < 0}>{balance >= 0 ? '+' : '−'}{fmt(Math.abs(balance))}</strong>
		</p>
	</div>
	<div class="cover">
		<div class="progress"><span style="width: {Math.min(100, data.coverage)}%"></span></div>
		<span class="small muted">Darurile acoperă {Math.round(data.coverage)}% din cheltuieli</span>
	</div>
</section>

{#snippet fields(e?: (typeof data.expenses)[number])}
	<label>
		Categorie
		<select name="category" value={e?.category ?? EXPENSE_CATEGORIES[0]}>
			{#each EXPENSE_CATEGORIES as c (c)}<option>{c}</option>{/each}
		</select>
	</label>
	<label class="wide">Descriere <input name="name" value={e?.name ?? ''} placeholder="ex. Meniu restaurant" required /></label>
	<label>Furnizor <input name="vendor" value={e?.vendor ?? ''} /></label>
	<label>
		Tip
		<select name="kind" value={e?.kind ?? 'fixed'}>
			{#each Object.entries(EXPENSE_KINDS) as [v, l] (v)}<option value={v}>{l}</option>{/each}
		</select>
	</label>
	<label>Preț <input name="amount" value={e?.amount ?? ''} inputmode="decimal" placeholder="0" /></label>
	<label>
		Monedă
		<select name="currency" value={e?.currency ?? s.currency}><option>RON</option><option>EUR</option></select>
	</label>
	<label>Plătit / avans <input name="paid" value={e?.paid || ''} inputmode="decimal" placeholder="0" /></label>
	<label>Scadență <input type="date" name="due_date" value={e?.due_date ?? ''} /></label>
{/snippet}

<details class="card gifts" bind:open={giftsOpen} ontoggle={rememberGifts}>
	<summary>
		<h2>Daruri <em>primite</em></h2>
		<p class="small muted">
			Total: {fmt(data.gifts)}. {giftsOpen ? 'Se salvează la fiecare rând.' : 'Atingeți ca să vedeți lista.'}
		</p>
	</summary>
	<div class="gift-head">
		<select bind:value={giftFilter} aria-label="Filtru">
			<option value="coming">Doar cei care vin</option>
			<option value="all">Toate familiile</option>
		</select>
	</div>
	<div class="table-wrap">
		<table class="list">
			<tbody>
				{#each giftRows as r (r.id)}
					<tr>
						<td><a href="/invitati/{r.id}">{r.name}</a></td>
						<td class="gift">
							<form method="POST" action="?/setGift" use:enhance={keep} class="gift-form">
								<input type="hidden" name="id" value={r.id} />
								<input name="gift_amount" inputmode="decimal" value={r.gift_amount || ''} placeholder="0" class="n" aria-label="Sumă" />
								<select name="gift_currency" value={r.gift_currency} aria-label="Monedă"><option>RON</option><option>EUR</option></select>
								<select name="gift_method" value={r.gift_method} aria-label="Metodă">
									<option value="">—</option>
									<option value="numerar">Numerar</option>
									<option value="transfer">Transfer</option>
								</select>
								<button class="btn ghost small">OK</button>
							</form>
						</td>
					</tr>
				{:else}
					<tr><td class="muted">Nicio familie confirmată încă.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</details>

{#if data.expenses.some((e) => e.due_date && e.paid < e.amount)}
	<section class="card">
		<h3>Plăți scadente</h3>
		<ul class="due">
			{#each data.expenses
				.filter((e) => e.due_date && e.paid < e.amount)
				.sort((a, b) => a.due_date.localeCompare(b.due_date)) as e (e.id)}
				<li><span>{e.name}{e.vendor ? ` — ${e.vendor}` : ''}</span><span class="muted">{formatDate(e.due_date)}</span></li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.bad {
		color: var(--bad);
	}
	.balance {
		display: grid;
		grid-template-columns: 1fr minmax(200px, 300px);
		gap: 16px;
		align-items: center;
	}
	.big {
		font-family: var(--serif);
		font-size: 1.5rem;
		margin: 4px 0 0;
	}
	.pos {
		color: var(--ok);
	}
	.neg {
		color: var(--bad);
	}
	.cover .progress span {
		background: var(--gold);
	}
	.cover .small {
		display: block;
		margin-top: 6px;
	}
	.group {
		margin-top: 16px;
	}
	.cat {
		display: grid;
		gap: 6px;
		padding: 12px 14px;
		background: var(--surface-2);
		border-radius: 12px;
		cursor: pointer;
		list-style: none;
	}
	.cat::-webkit-details-marker {
		display: none;
	}
	.cat-head {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}
	.cat h3 {
		flex: 1;
		margin: 0;
	}
	.chev {
		color: var(--muted);
		transition: transform 0.15s;
	}
	.group[open] > .cat .chev {
		transform: rotate(90deg);
	}
	.cat-total {
		font-family: var(--serif);
		font-size: 1.3rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.pay {
		display: block;
		height: 6px;
		background: var(--line);
		border-radius: 3px;
		overflow: hidden;
	}
	.pay span {
		display: block;
		height: 100%;
		background: var(--ok);
	}
	.items {
		margin: 4px 0 0 14px;
		padding-left: 12px;
		border-left: 2px solid var(--line);
	}
	.exp summary {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
		cursor: pointer;
		list-style: none;
	}
	.exp summary::-webkit-details-marker {
		display: none;
	}
	.exp summary:hover .what {
		color: var(--accent-ink);
	}
	.what {
		flex: 1;
		display: grid;
	}
	.total {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		min-width: 80px;
		text-align: right;
	}
	.exp-form {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 10px;
		padding: 14px;
		margin: 8px 0 12px;
		background: var(--surface-2);
		border-radius: 12px;
	}
	.exp-form .wide {
		grid-column: span 2;
	}
	/* On a phone two 150px columns do not fit, but .wide still forces a second one: overflow. */
	@media (max-width: 480px) {
		.exp-form {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.exp-form input[type='date'] {
			min-width: 0;
		}
	}
	.exp-actions {
		grid-column: 1 / -1;
		display: flex;
		gap: 8px;
	}
	.add summary {
		color: var(--accent-ink);
		border-bottom: 0;
		margin-top: 12px;
	}
	.gifts > summary {
		position: relative;
		padding-right: 28px;
		cursor: pointer;
		list-style: none;
	}
	.gifts > summary::-webkit-details-marker {
		display: none;
	}
	.gifts > summary::after {
		content: '+';
		position: absolute;
		top: 6px;
		right: 0;
		color: var(--muted);
		font-size: 1.3rem;
		line-height: 1;
	}
	.gifts[open] > summary::after {
		content: '−';
	}
	.gifts > summary p {
		margin: 0;
	}
	.gift-head {
		display: flex;
		justify-content: end;
		margin: 12px 0 4px;
	}
	.gift-head select {
		width: auto;
	}
	.gift-form {
		display: flex;
		gap: 6px;
		justify-content: end;
	}
	.gift-form select,
	.gift-form input {
		width: auto;
		padding: 6px 8px;
	}
	.gift-form .n {
		max-width: 110px;
		text-align: right;
	}
	td a {
		color: var(--ink);
		text-decoration: none;
	}
	.due {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.due li {
		display: flex;
		justify-content: space-between;
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
	}
	@media (max-width: 720px) {
		.balance {
			grid-template-columns: 1fr;
		}
		.gift-form {
			flex-wrap: wrap;
			justify-content: start;
		}
	}
</style>
