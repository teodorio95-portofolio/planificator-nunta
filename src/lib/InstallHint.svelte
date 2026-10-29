<script lang="ts">
	import { onMount } from 'svelte';

	// "Add to Home Screen" help on phones and tablets. iOS lets no page install itself, so iPhone and
	// iPad get the two taps to make; Chrome on Android offers its own install prompt, kept for a button.
	// Hidden once opened from the Home Screen, with a mouse (the Mac stays as it is), or after "Nu acum".
	const KEY = 'install-hint-dismissed';
	type InstallPrompt = Event & { prompt(): Promise<void> };

	let mode = $state<'ios' | 'prompt' | null>(null);
	let deferred: InstallPrompt | null = null;

	onMount(() => {
		const standalone =
			matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;
		let dismissed = false;
		try {
			dismissed = localStorage.getItem(KEY) === '1';
		} catch {
			// Storage blocked: show it, it can still be closed for this visit.
		}
		if (standalone || dismissed || !matchMedia('(pointer: coarse)').matches) return;
		// iPadOS says it is a Mac; touch points give it away (a Mac has none).
		const ua = navigator.userAgent;
		if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 0)) {
			mode = 'ios';
			return;
		}
		const onPrompt = (e: Event) => {
			e.preventDefault();
			deferred = e as InstallPrompt;
			mode = 'prompt';
		};
		addEventListener('beforeinstallprompt', onPrompt);
		return () => removeEventListener('beforeinstallprompt', onPrompt);
	});

	function dismiss() {
		mode = null;
		try {
			localStorage.setItem(KEY, '1');
		} catch {
			// Not remembered, still closed.
		}
	}

	async function install() {
		await deferred?.prompt();
		deferred = null;
		mode = null;
	}
</script>

{#if mode}
	<aside class="install no-print" aria-label="Adăugați aplicația pe ecranul principal">
		<div class="text">
			<strong>Țineți aplicația pe telefon</strong>
			{#if mode === 'ios'}
				<p>
					Apăsați
					<svg class="share" viewBox="0 0 20 24" aria-label="Share" role="img">
						<path d="M10 2v13M5.5 6.5 10 2l4.5 4.5" />
						<path d="M6.5 10H3.5v11.5h13V10h-3" />
					</svg>
					<b>Share</b> (dacă nu se vede, e în meniul <b>⋯</b>), apoi
					<b>„Adaugă pe ecranul principal”</b> (Add to Home Screen).
				</p>
			{:else}
				<p>Se deschide ca o aplicație, direct de pe ecranul principal.</p>
			{/if}
		</div>
		<div class="actions">
			{#if mode === 'prompt'}<button class="btn small" onclick={install}>Instalează</button>{/if}
			<button class="link-btn" onclick={dismiss}>Nu acum</button>
		</div>
	</aside>
{/if}

<style>
	.install {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 16px;
		margin-bottom: 16px;
		padding: 12px 16px;
		border: 1px solid color-mix(in srgb, var(--gold) 35%, transparent);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--gold) 10%, var(--surface));
		font-size: 0.9rem;
	}
	.text {
		flex: 1 1 220px;
	}
	.text p {
		margin: 2px 0 0;
		color: var(--muted);
	}
	.share {
		width: 16px;
		height: 19px;
		vertical-align: -3px;
		fill: none;
		stroke: var(--accent-ink);
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 14px;
	}
</style>
