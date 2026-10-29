<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { formatDate } from '#lib/calc.ts';
	import { CATEGORIES, MENUS, SIDES, SUBCATEGORIES } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const h = $derived(data.household);
	const link = $derived(`${page.url.origin}/r/${h.token}`);
	const stdLink = $derived(`${page.url.origin}/s/${h.token}`);
	const attendingValue = (a: number | null) => (a === null ? '' : String(a));
</script>

<div class="page-head">
	<div>
		<p class="eyebrow"><a href="/invitati">← Invitați</a></p>
		<h1>{h.name}</h1>
	</div>
</div>

{#if form?.message}<p class="flash">{form.message}</p>{/if}
{#if form?.error}<p class="flash error">{form.error}</p>{/if}

<form method="POST" action="?/save" use:enhance={() => ({ update }) => update({ reset: false })}>
	<section class="card form-stack">
		<div class="form-row">
			<label>Nume <input name="name" value={h.name} required /></label>
			<label>
				Partea
				<select name="side" value={h.side}>
					{#each Object.entries(SIDES) as [v, l] (v)}<option value={v}>{l}</option>{/each}
				</select>
			</label>
			<label>
				Categorie
				<select name="category" value={h.category}>
					{#each Object.entries(CATEGORIES) as [v, l] (v)}<option value={v}>{l}</option>{/each}
				</select>
			</label>
			<label>
				Subcategorie
				<select name="subcategory" value={h.subcategory}>
					{#each Object.entries(SUBCATEGORIES) as [v, l] (v)}<option value={v}>{l}</option>{/each}
				</select>
			</label>
			<label>Telefon <input name="phone" value={h.phone} inputmode="tel" /></label>
		</div>
		<label>
			Observații
			<textarea name="notes" rows="2" placeholder="ex. David 4 ani, +1 de confirmat" value={h.notes}></textarea>
		</label>
		<label class="check">
			<input type="checkbox" name="tbd" checked={!!h.tbd} /> TBD — încă nu știm sigur dacă îi invităm
		</label>
		<label class="check">
			<input type="checkbox" name="invite_sent" checked={!!h.invite_sent} /> Invitația a fost trimisă
		</label>
	</section>

	<section class="card">
		<h2>Membri</h2>
		<div class="table-wrap">
			<table class="list">
				<thead>
					<tr><th>Nume</th><th>Copil</th><th>Prezență</th><th>Meniu</th><th>Restricții</th><th></th></tr>
				</thead>
				<tbody>
					{#each h.guests as g (g.id)}
						<tr>
							<td>
								<input type="hidden" name="guest_id" value={g.id} />
								<input name="name_{g.id}" value={g.name} aria-label="Nume" />
							</td>
							<td><input type="checkbox" name="child_{g.id}" checked={!!g.is_child} aria-label="Copil" /></td>
							<td>
								<select name="attending_{g.id}" value={attendingValue(g.attending)} aria-label="Prezență">
									<option value="">Fără răspuns</option>
									<option value="1">Vine</option>
									<option value="0">Nu vine</option>
								</select>
							</td>
							<td>
								<select name="menu_{g.id}" value={g.menu} aria-label="Meniu">
									{#each Object.entries(MENUS) as [v, l] (v)}<option value={v}>{l}</option>{/each}
								</select>
							</td>
							<td><input name="dietary_{g.id}" value={g.dietary} placeholder="ex. fără gluten" aria-label="Restricții" /></td>
							<td>
								<button class="btn danger small" formaction="?/deleteGuest" name="delete_guest_id" value={g.id} formnovalidate>
									Șterge
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="card form-stack">
		<h2>Dar</h2>
		<div class="form-row">
			<label>Sumă <input name="gift_amount" inputmode="decimal" value={h.gift_amount || ''} placeholder="0" /></label>
			<label>
				Monedă
				<select name="gift_currency" value={h.gift_currency}>
					<option>RON</option>
					<option>EUR</option>
				</select>
			</label>
			<label>
				Metodă
				<select name="gift_method" value={h.gift_method}>
					<option value="">—</option>
					<option value="numerar">Numerar</option>
					<option value="transfer">Transfer bancar</option>
				</select>
			</label>
		</div>
	</section>

	<div class="save"><button class="btn">Salvează modificările</button></div>
</form>

<div class="grid cols-2">
	<section class="card form-stack">
		<h3>Adaugă membri</h3>
		<form method="POST" action="?/addGuests" use:enhance class="form-stack">
			<textarea name="members" rows="2" placeholder={'Nume Prenume\nCopil (copil)'}></textarea>
			<div><button class="btn ghost small">Adaugă</button></div>
		</form>
	</section>

	<section class="card form-stack">
		<h3>Mută un membru</h3>
		<form method="POST" action="?/move" use:enhance class="form-stack">
			<select name="move_guest_id" aria-label="Membru" required>
				{#each h.guests as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
			</select>
			<select name="target" aria-label="Familia nouă" required>
				<option value="" disabled selected>în familia…</option>
				<option value="new">— o familie nouă, separată —</option>
				{#each data.others as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
			</select>
			<div><button class="btn ghost small">Mută</button></div>
		</form>
	</section>
</div>

<div class="grid cols-2 second">
	<section class="card form-stack">
		<h3>Confirmare online</h3>
		<input readonly value={link} aria-label="Link RSVP" onfocus={(e) => e.currentTarget.select()} />
		{#if h.responded_at}
			<p class="small muted">Au răspuns pe {formatDate(h.responded_at.slice(0, 10))}.</p>
		{/if}
		{#if h.rsvp_note}<blockquote>„{h.rsvp_note}”</blockquote>{/if}
		<div class="row">
			<a class="btn ghost small" href={link} target="_blank" rel="noopener">Deschide</a>
			<form method="POST" action="?/newLink" use:enhance>
				<button class="link-btn">Generează link nou</button>
			</form>
		</div>
		<h3>Save the date</h3>
		<input readonly value={stdLink} aria-label="Link save the date" onfocus={(e) => e.currentTarget.select()} />
		<div class="row">
			<a class="btn ghost small" href={stdLink} target="_blank" rel="noopener">Deschide</a>
		</div>
	</section>
</div>

<form
	method="POST"
	action="?/delete"
	class="delete"
	use:enhance={({ cancel }) => {
		if (!confirm(`Ștergeți „${h.name}” cu toți membrii?`)) cancel();
	}}
>
	<button class="btn danger small">Șterge familia</button>
</form>

<style>
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9rem;
		color: var(--ink);
	}
	.save {
		margin: 16px 0 24px;
	}
	td input:not([type='checkbox']),
	td select {
		min-width: 120px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	blockquote {
		margin: 0;
		font-family: var(--serif);
		font-style: italic;
		font-size: 1.15rem;
	}
	.second {
		margin-top: 16px;
	}
	.delete {
		margin-top: 24px;
		text-align: right;
	}
	.eyebrow a {
		color: inherit;
		text-decoration: none;
	}
</style>
