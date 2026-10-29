<script lang="ts">
	import { enhance } from '$app/forms';
	import { ROLE_LABELS } from '#lib/access.ts';
	import { attendanceShare, headcount } from '#lib/calc.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const s = $derived(data.settings);
	const initials = $derived(
		[s.partner1, s.partner2]
			.map((n) => n.trim()[0]?.toUpperCase())
			.filter(Boolean)
			.join('&')
	);
	const MEDIA = [
		{ kind: 'cover', label: 'Poza de fundal', accept: 'image/jpeg,image/png,image/webp' },
		{ kind: 'music', label: 'Muzica', accept: 'audio/mpeg,audio/mp4,.mp3,.m4a' }
	] as const;
	let currency = $derived(s.currency);
	const unit = $derived(currency === 'EUR' ? '€' : 'lei');
	let rate = $derived(s.attendance_rate);
	const expected = $derived.by(() => {
		const hc = headcount(data.everyone, attendanceShare({ attendance_rate: Number(rate) || 0 }));
		return hc.expectedAdults + hc.expectedChildren;
	});
</script>

<div class="page-head">
	<div>
		<p class="eyebrow">Configurare</p>
		<h1>Setări</h1>
	</div>
</div>

{#if form?.message}<p class="flash">{form.message}</p>{/if}

<form
	method="POST"
	action="?/save"
	use:enhance={() => async ({ update }) => update({ reset: false })}
	class="form-stack"
>
	<section class="card form-stack">
		<h2>Nunta</h2>
		<div class="form-row">
			<label>Mireasa <input name="partner1" value={s.partner1} placeholder="Ana" /></label>
			<label>Mirele <input name="partner2" value={s.partner2} placeholder="Mihai" /></label>
			<label>Data nunții <input type="date" name="wedding_date" value={s.wedding_date} /></label>
		</div>
		<div class="form-row">
			<label>Locația petrecerii <input name="venue" value={s.venue} placeholder="Restaurantul…" /></label>
			<label>Adresa (pentru hartă) <input name="venue_address" value={s.venue_address} /></label>
		</div>
		<div class="form-row">
			<label>Cununia (biserică, oră) <input name="ceremony" value={s.ceremony} placeholder="Biserica…, ora 15:00" /></label>
			<label>Termen confirmare <input type="date" name="rsvp_deadline" value={s.rsvp_deadline} /></label>
		</div>
		<div class="form-row">
			<label>
				Monograma de pe sigiliu
				<input name="monogram" value={s.monogram} maxlength="4" placeholder={initials || 'A&M'} />
			</label>
		</div>
		<p class="small muted">
			Numele, data, locurile și termenul apar pe invitație și pe save the date. Monograma (maxim 4 caractere)
			e presată în sigiliul plicului; goală, sunt inițialele voastre.
		</p>
	</section>

	<section class="card form-stack">
		<h2>Bani</h2>
		<div class="form-row">
			<label>
				Moneda principală
				<select name="currency" bind:value={currency}>
					<option value="RON">Lei (RON)</option>
					<option value="EUR">Euro (EUR)</option>
				</select>
			</label>
			<label>Curs EUR → lei <input name="eur_rate" inputmode="decimal" value={s.eur_rate} /></label>
			<label>Buget maxim ({unit}) <input name="budget_total" inputmode="decimal" value={s.budget_total || ''} placeholder="opțional" /></label>
		</div>
		<div class="form-row">
			<label>
				Contribuție nași + părinți ({unit})
				<input name="family_contribution" inputmode="decimal" value={s.family_contribution || ''} placeholder="0" />
			</label>
			<label>
				Dar mediu estimat / persoană ({unit})
				<input name="gift_estimate" inputmode="decimal" value={s.gift_estimate || ''} placeholder="0" />
			</label>
		</div>
		<div class="form-row">
			<label>
				Prezență estimată din toți invitații (%)
				<input name="attendance_rate" inputmode="numeric" bind:value={rate} placeholder="100" />
			</label>
			<p class="small muted estimate">
				≈ <strong>{expected}</strong> persoane: {rate || 0}% din cei {data.answers.invited} invitați. Cei marcați „vin”
				nu schimbă cifra; ea crește doar dacă sunt mai mulți confirmați ({data.answers.confirmed}) și scade doar dacă
				rămân mai puțini fără refuz ({data.answers.invited - data.answers.declined}). Costurile per persoană și darul
				de echilibru folosesc această cifră.
			</p>
		</div>
		<p class="small muted">
			Sumele de mai sus sunt în moneda principală. Nașii, părinții mirilor și mirii (categoria se setează la
			fiecare familie) nu intră în calculul darului mediu.
		</p>
	</section>

	<div><button class="btn">Salvează</button></div>
</form>

<section class="card form-stack media">
	<h2>Invitația</h2>
	<p class="small muted">
		O poză a voastră sau a locației apare pe fundalul invitației, al save the date-ului și pe Acasă (de preferat
		pe verticală, JPG sau WebP, sub 8 MB). Muzica (MP3 sau M4A, sub 10 MB) pornește când invitatul deschide
		plicul; folosiți o piesă pe care aveți dreptul să o distribuiți.
	</p>
	{#if form?.error}<p class="flash error">{form.error}</p>{/if}
	{#each MEDIA as m (m.kind)}
		{@const url = data.media[m.kind]}
		<div class="upload">
			<strong>{m.label}</strong>
			{#if url && m.kind === 'cover'}
				<img src={url} alt="Poza de fundal a invitației" />
			{:else if url}
				<audio src={url} controls preload="none"></audio>
			{:else}
				<span class="small muted">Nimic încărcat.</span>
			{/if}
			<form method="POST" action="?/uploadMedia" enctype="multipart/form-data" use:enhance class="row">
				<input type="hidden" name="kind" value={m.kind} />
				<input type="file" name="file" accept={m.accept} required />
				<button class="btn small">Încarcă</button>
			</form>
			{#if url}
				<form method="POST" action="?/removeMedia" use:enhance>
					<input type="hidden" name="kind" value={m.kind} />
					<button class="btn ghost small">Șterge</button>
				</form>
			{/if}
		</div>
	{/each}
</section>

<section class="card form-stack backup">
	<h2>Date</h2>
	<p class="small muted">Totul stă într-un singur fișier SQLite pe serverul vostru. Descărcați o copie din când în când.</p>
	<div class="row">
		<a class="btn ghost small" href="/setari/backup" data-sveltekit-reload>Descarcă backup</a>
		<a class="btn ghost small" href="/invitati/export.csv" data-sveltekit-reload>Export invitați (CSV)</a>
	</div>
</section>

{#if data.password}
	<section class="card form-stack access">
		<h2>Parole</h2>
		<p class="small muted">
			Fiecare rol are o parolă comună, din <code>.env</code>: <code>ADMIN_PASSWORD</code>,
			<code>EDITOR_PASSWORD</code>, <code>READER_PASSWORD</code>. Schimbată acolo (și containerul repornit),
			deconectează pe toți cei care intraseră cu parola veche.
		</p>
	</section>
{/if}

{#if data.google}
	<section class="card form-stack access">
		<h2>Cine are acces cu Google</h2>
		<p class="small muted">
			Doar aceste conturi Google pot intra. Readerii (doar citire) se adaugă și se scot de aici. Adminii și
			editorii se schimbă în <code>.env</code> (<code>ADMIN_EMAILS</code>, <code>EDITOR_EMAILS</code>), apoi
			se repornește containerul.
		</p>
		{#if form?.error}<p class="flash error">{form.error}</p>{/if}
		{#each data.access as l (l.role)}
			{@const added = l.role === 'reader' ? data.addedReaders : []}
			<div>
				<strong>{ROLE_LABELS[l.role]}</strong>
				<span class="small muted">({l.variable}{added.length ? ' + adăugați aici' : ''})</span>
				{#if l.emails.length || added.length}
					<ul>
						{#each l.emails as email (email)}<li>{email}</li>{/each}
						{#each added as r (r.email)}
							<li>
								<form method="POST" action="?/removeReader" use:enhance class="reader">
									<span>
										{r.email}
										<span class="small muted">· adăugat {r.added_at.slice(0, 10)}{r.added_by ? ` de ${r.added_by}` : ''}</span>
									</span>
									<input type="hidden" name="email" value={r.email} />
									<button class="btn ghost small">Scoate</button>
								</form>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="small muted">Nimeni.</p>
				{/if}
			</div>
		{/each}
		<form method="POST" action="?/addReader" use:enhance class="add-reader">
			<label>
				Adaugă un reader (contul Google)
				<input type="email" name="email" required autocomplete="off" placeholder="nume@gmail.com" value={form?.email ?? ''} />
			</label>
			<button class="btn small">Adaugă</button>
		</form>
		<p class="small muted">
			Un reader vede toate paginile în afară de Setări și Notițe, fără să poată schimba ceva (poate doar adăuga
			sarcini). Scos de aici, e deconectat imediat de pe toate dispozitivele.
		</p>
	</section>
{/if}

{#if data.sessions.length}
	<section class="card form-stack sessions">
		<h2>Dispozitive conectate</h2>
		<p class="small muted">
			Cine are acces se stabilește mai sus. Aici deconectați un telefon pierdut sau un dispozitiv
			necunoscut.
		</p>
		{#each data.sessions as s (s.id)}
			<form method="POST" action="?/revoke" use:enhance class="session">
				<div>
					<strong>{s.email}</strong>
					{#if s.current}<span class="small muted">(acest dispozitiv)</span>{/if}
					<div class="small muted">{s.device} · conectat din {s.created_at.slice(0, 10)}</div>
				</div>
				<input type="hidden" name="id" value={s.id} />
				<button class="btn ghost small">Deconectează</button>
			</form>
		{/each}
	</section>
{/if}

<style>
	.media,
	.backup,
	.access,
	.sessions {
		margin-top: 24px;
	}
	.access ul {
		margin: 4px 0 0;
		padding-left: 18px;
	}
	.access code {
		word-break: break-all;
	}
	.reader {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex-wrap: wrap;
		padding: 2px 0;
	}
	.reader > span {
		overflow-wrap: anywhere;
	}
	.add-reader {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		flex-wrap: wrap;
	}
	.add-reader label {
		flex: 1 1 240px;
	}
	.session {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.upload {
		display: grid;
		gap: 8px;
		justify-items: start;
	}
	.upload img {
		max-width: min(100%, 220px);
		max-height: 220px;
		border-radius: 8px;
		object-fit: cover;
	}
	.upload audio {
		max-width: 100%;
	}
	.row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
</style>
