<script lang="ts">
	import '@fontsource/great-vibes/400.css';

	// The envelope a guest's link opens on (the invitation and the save the date): closed until tapped,
	// then it opens and leaves the page under it. Without JavaScript it is never shown (see the
	// <noscript> below); a page that should skip it starts with `stage` 'open'.
	let {
		stage = $bindable('closed'),
		name,
		initials,
		music = null
	}: { stage?: 'closed' | 'opening' | 'open'; name: string; initials: string; music?: string | null } = $props();

	const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

	// The music the couple uploaded in Setări, started by the tap that opens the envelope, since
	// browsers only play sound after one. No file, no music and no button.
	let audio = $state<HTMLAudioElement>();
	let playing = $state(false);
	function play() {
		if (!audio) return;
		// Fades in; iOS ignores the volume and plays it as is.
		audio.volume = 0;
		audio.play().then(
			() => {
				playing = true;
				const fade = setInterval(() => {
					if (!audio || audio.volume >= 0.6) return clearInterval(fade);
					audio.volume = Math.min(0.6, audio.volume + 0.05);
				}, 150);
			},
			() => (playing = false)
		);
	}
	function toggleMusic() {
		if (playing) {
			audio?.pause();
			playing = false;
		} else play();
	}
	// Quiet while the guest is in another app or tab, back when they return.
	$effect(() => {
		const onVisibility = () => {
			if (!audio || !playing) return;
			if (document.hidden) audio.pause();
			else audio.play().catch(() => {});
		};
		document.addEventListener('visibilitychange', onVisibility);
		return () => document.removeEventListener('visibilitychange', onVisibility);
	});

	function openEnvelope() {
		if (stage !== 'closed') return;
		play();
		if (still()) {
			stage = 'open';
			return;
		}
		stage = 'opening';
		setTimeout(() => (stage = 'open'), 2300);
	}
	$effect(() => {
		document.documentElement.classList.toggle('sealed', stage !== 'open');
		return () => document.documentElement.classList.remove('sealed');
	});
</script>

<svelte:head>
	<noscript><style>[data-plic] { display: none !important; }</style></noscript>
</svelte:head>

{#if stage !== 'open'}
	<div class="plic-scena" data-plic class:opening={stage === 'opening'}>
		<button class="plic" onclick={openEnvelope} aria-label="Deschideți invitația">
			<span class="clapa">
				<span class="adresa">
					<span class="pentru">Pentru</span>
					<span class="cui">{name}</span>
				</span>
			</span>
			<span class="buzunar"></span>
			<span class="sigiliu" aria-hidden="true"><span>{initials || '♥'}</span></span>
			<span class="indiciu">Atingeți pentru a deschide</span>
		</button>
	</div>
{/if}

{#if music}
	<audio bind:this={audio} src={music} loop preload="none"></audio>
	{#if stage !== 'closed'}
		<button
			class="sunet"
			onclick={toggleMusic}
			aria-label={playing ? 'Oprește muzica' : 'Pornește muzica'}
			aria-pressed={playing}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
				{#if playing}
					<path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />
				{:else}
					<path d="M16 9.5l5 5M21 9.5l-5 5" />
				{/if}
			</svg>
		</button>
	{/if}
{/if}

<style>
	:global(html.sealed) {
		overflow: hidden;
	}

	/* ——— The envelope ——— */
	.plic-scena {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: grid;
		/* Centred even when the envelope is larger than the screen and cut on both sides. */
		place-items: center;
		place-content: center;
		overflow: hidden;
		background-color: #e6dac3;
		transition: background-color 0.4s ease 0.2s;
	}
	/* Around the envelope on a wide screen: a soft light on the table it lies on. */
	.plic-scena::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at 50% 40%, #f3ebdd, #d9cbb0);
		transition: opacity 0.4s ease 0.2s;
	}
	.plic-scena.opening {
		background-color: transparent;
	}
	.plic-scena.opening::before {
		opacity: 0;
	}
	.opening .plic {
		box-shadow: none;
		transition: box-shadow 0.4s ease 0.2s;
	}
	.plic {
		position: relative;
		/* The envelope is 9:16: as tall as the screen; on a wide screen, as wide as it allows. */
		width: min(100vw, calc(100svh * 9 / 16));
		height: 100svh;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		font: inherit;
		color: inherit;
		-webkit-tap-highlight-color: transparent;
		box-shadow: 0 24px 60px rgb(70 55 30 / 0.28);
	}
	/* Phones and tablets upright, Safari's toolbars included, are a little wider than 9:16: there
	   the envelope covers the whole screen, keeping its shape, and loses a strip at the top and bottom. */
	@media (max-aspect-ratio: 3 / 4) {
		.plic {
			width: max(100vw, calc(100svh * 9 / 16));
			height: max(100svh, calc(100vw * 16 / 9));
		}
	}
	.clapa,
	.buzunar {
		position: absolute;
		inset: 0;
	}
	/* Paper drawn in CSS: the flap darkens towards its point at 58.5% of the height, where it casts on the pocket. */
	.clapa {
		z-index: 2;
		background:
			radial-gradient(ellipse at 50% 0%, rgb(255 255 255 / 0.5), transparent 60%),
			linear-gradient(to bottom, #f6efe2 0%, #ece2cf 40%, #dccdb2 58.5%);
		clip-path: polygon(0 0, 100% 0, 100% 27%, 50% 58.5%, 0 27%);
		transform-origin: 50% 0;
		/* Spelled out at rest too, so the browser turns it through 3D instead of jumping to the end. */
		transform: perspective(1600px) rotateX(0deg);
		transition:
			transform 1.2s cubic-bezier(0.45, 0, 0.25, 1) 0.3s,
			opacity 0.35s ease 1.15s;
	}
	/* The pocket, with the two side folds meeting under the flap. */
	.buzunar {
		z-index: 1;
		background:
			/* Each fold runs from a bottom corner up to just under the seal: the 50% line of a corner-to-corner
			   gradient crosses the other two corners of its box, here the lower half of each side. */
			linear-gradient(to bottom right, transparent calc(50% - 1px), rgb(120 95 60 / 0.2) 50%, transparent calc(50% + 1px))
				0 100% / 50% 40% no-repeat,
			linear-gradient(to bottom left, transparent calc(50% - 1px), rgb(120 95 60 / 0.2) 50%, transparent calc(50% + 1px))
				100% 100% / 50% 40% no-repeat,
			linear-gradient(to bottom, #e9dec9, #f3ebdd 70%, #efe5d3);
		clip-path: polygon(0 27%, 50% 58.5%, 100% 27%, 100% 100%, 0 100%);
		transition:
			transform 1s cubic-bezier(0.6, 0, 0.3, 1) 1.05s,
			opacity 0.6s ease 1.45s;
	}
	.opening .clapa {
		transform: perspective(1600px) rotateX(178deg);
		opacity: 0;
	}
	.opening .buzunar {
		transform: translateY(105%);
		opacity: 0;
	}
	.adresa {
		position: absolute;
		top: 33%;
		left: 18%;
		right: 18%;
		display: grid;
		gap: 2px;
		text-align: center;
		color: #5a5446;
	}
	.pentru {
		font-family: var(--sans);
		font-size: 0.62rem;
		letter-spacing: 0.32em;
		text-transform: uppercase;
		color: #8f8775;
	}
	.cui {
		font-family: 'Great Vibes', cursive;
		font-size: clamp(1.7rem, 7.5vw, 2.2rem);
		line-height: 1.15;
		color: var(--cerneala, #4b5638);
	}
	.sigiliu {
		position: absolute;
		z-index: 3;
		left: 50%;
		top: 58.5%;
		width: 88px;
		height: 88px;
		translate: -50% -50%;
		display: grid;
		place-items: center;
		/* Wax: uneven at the edge, darker where it pooled. */
		border-radius: 47% 53% 49% 51% / 52% 47% 53% 48%;
		background: radial-gradient(circle at 34% 28%, #e3a2b2 0%, #bd6b80 38%, #94435a 78%, #7c3449 100%);
		box-shadow:
			0 6px 14px rgb(80 30 45 / 0.35),
			inset 0 -5px 10px rgb(60 15 30 / 0.3),
			inset 0 3px 6px rgb(255 220 230 / 0.35);
		animation: puls 2.4s ease-in-out infinite;
		transition:
			transform 0.4s ease,
			opacity 0.35s ease;
	}
	.sigiliu::before {
		content: '';
		position: absolute;
		inset: 10px;
		border-radius: 50%;
		border: 1.5px solid rgb(255 225 232 / 0.45);
		box-shadow: inset 0 1px 3px rgb(60 15 30 / 0.35);
	}
	/* Pressed into the wax: three capitals fit the ring in a serif, not in the script. */
	.sigiliu span {
		font-family: 'Cormorant Garamond', serif;
		font-style: italic;
		font-weight: 500;
		font-size: 1.45rem;
		letter-spacing: 0.06em;
		color: #f8e4ea;
		text-shadow:
			0 -1px 0 rgb(80 25 40 / 0.6),
			0 1px 0 rgb(255 230 236 / 0.4);
	}
	.opening .sigiliu {
		transform: scale(1.35);
		opacity: 0;
		animation: none;
	}
	@keyframes puls {
		0%,
		100% {
			box-shadow:
				0 6px 14px rgb(80 30 45 / 0.35),
				0 0 0 0 rgb(192 122 139 / 0.45),
				inset 0 -5px 10px rgb(60 15 30 / 0.3),
				inset 0 3px 6px rgb(255 220 230 / 0.35);
		}
		50% {
			box-shadow:
				0 6px 14px rgb(80 30 45 / 0.35),
				0 0 0 14px rgb(192 122 139 / 0),
				inset 0 -5px 10px rgb(60 15 30 / 0.3),
				inset 0 3px 6px rgb(255 220 230 / 0.35);
		}
	}
	/* On the screen, not the envelope, which may run past the bottom edge. */
	.indiciu {
		position: fixed;
		z-index: 3;
		left: 50%;
		bottom: calc(6svh + env(safe-area-inset-bottom));
		translate: -50% 0;
		white-space: nowrap;
		padding: 9px 18px;
		background: rgb(251 247 238 / 0.82);
		backdrop-filter: blur(3px);
		font-family: var(--sans);
		font-size: 0.6rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: #6f6a58;
		transition: opacity 0.3s ease;
	}
	.opening .indiciu {
		opacity: 0;
	}

	/* The sound button, in the corner like on the printed-invitation sites. */
	.sunet {
		position: fixed;
		z-index: 40;
		right: calc(16px + env(safe-area-inset-right));
		bottom: calc(16px + env(safe-area-inset-bottom));
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: rgb(251 247 238 / 0.9);
		box-shadow: 0 2px 10px rgb(60 55 35 / 0.18);
		cursor: pointer;
	}
	.sunet svg {
		width: 22px;
		fill: none;
		stroke: #4b5638;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	@media (prefers-reduced-motion: reduce) {
		.sigiliu {
			animation: none;
		}
	}
</style>
