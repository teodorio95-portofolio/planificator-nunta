<script lang="ts">
	import { page } from '$app/state';
	import InstallHint from '#lib/InstallHint.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The card WhatsApp and iMessage show for the app's main link.
	const title = $derived(data.couple.length ? `Nunta ${data.couple.join(' & ')}` : 'Planificatorul de nuntă');
</script>

<svelte:head>
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content="Invitați, mese, buget și ziua nunții, într-un singur loc." />
	<meta property="og:image" content={new URL('/og.png', page.url.origin).href} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<main class="login">
	<!-- Before signing in: installed first, the Home Screen app needs only one Google sign-in. -->
	<div class="hint"><InstallHint /></div>
	<div class="card form-stack">
		<p class="eyebrow">Planificatorul de nuntă</p>
		<h1>Bine ați <em>revenit</em></h1>
		{#if form?.error ?? data.error}<p class="flash error">{form?.error ?? data.error}</p>{/if}
		{#if data.password}
			<form method="POST" action="?next={encodeURIComponent(data.next)}&/password" class="form-stack">
				<label>
					Parola
					<!-- svelte-ignore a11y_autofocus -->
					<input type="password" name="password" required autocomplete="current-password" autofocus />
				</label>
				<button class="btn">Intră</button>
			</form>
		{/if}
		{#if data.google}
			<!-- A full page load: the endpoint answers with a redirect to Google. -->
			<a class="btn" class:ghost={data.password} href="/auth/google?next={encodeURIComponent(data.next)}" data-sveltekit-reload>
				Intră cu Google
			</a>
		{/if}
		<a class="small muted" href="/confidentialitate">Confidențialitate</a>
	</div>
</main>

<style>
	.login {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		align-content: center;
		padding: 16px;
	}
	.hint {
		width: min(380px, 100%);
	}
	.hint:empty {
		display: none;
	}
	.card {
		width: min(380px, 100%);
		padding: 32px 28px;
	}
</style>
