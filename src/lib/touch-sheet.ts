// The guest sheet on phones and tablets.
//
// The sheet only scrolls sideways; up and down always move the page (CSS: no vertical scroll of
// its own, `touch-action: pan-y`). Each drag moves along one axis, picked from its first movement,
// so the sheet never drifts diagonally, and the sideways scroll is done here, so it stops at the
// edges instead of bouncing. The header row is kept under the app's top bar, which
// `position: sticky` cannot do once the sheet is not its own vertical scroller.

/** Attaches the touch behaviour to the sheet's scroll box; returns the cleanup. Does nothing with a mouse. */
export function touchSheet(wrap: HTMLElement): () => void {
	if (!matchMedia('(pointer: coarse)').matches) return () => {};

	let start: { x: number; y: number; left: number } | null = null;
	let axis: 'x' | 'y' | null = null;
	let last = { x: 0, t: 0 };
	let velocity = 0; // px per ms, sideways
	let glide = 0;

	const stopGlide = () => {
		cancelAnimationFrame(glide);
		glide = 0;
	};

	const down = (e: TouchEvent) => {
		stopGlide();
		start = null;
		if (e.touches.length !== 1) return;
		const t = e.touches[0];
		start = { x: t.clientX, y: t.clientY, left: wrap.scrollLeft };
		axis = null;
		velocity = 0;
		last = { x: t.clientX, t: e.timeStamp };
	};

	const move = (e: TouchEvent) => {
		if (!start || e.touches.length !== 1) return;
		const t = e.touches[0];
		const dx = t.clientX - start.x;
		axis ??= Math.abs(dx) > Math.abs(t.clientY - start.y) ? 'x' : 'y';
		if (axis === 'y') return; // the browser scrolls the page
		e.preventDefault(); // and nothing vertical while the sheet slides
		wrap.scrollLeft = start.left - dx;
		const dt = e.timeStamp - last.t;
		if (dt > 0) velocity = 0.8 * ((t.clientX - last.x) / dt) + 0.2 * velocity;
		last = { x: t.clientX, t: e.timeStamp };
	};

	// A flick keeps the sheet sliding for a moment, like native scrolling.
	const up = (e: TouchEvent) => {
		if (axis === 'x' && e.timeStamp - last.t < 80 && Math.abs(velocity) > 0.05) {
			let v = velocity;
			let prev = performance.now();
			const step = (now: number) => {
				const dt = now - prev;
				prev = now;
				wrap.scrollLeft -= v * dt;
				v *= 0.995 ** dt;
				glide = Math.abs(v) > 0.02 ? requestAnimationFrame(step) : 0;
			};
			glide = requestAnimationFrame(step);
		}
		start = null;
		axis = null;
	};

	// The header row follows the page under the app's sticky top bar, within the sheet.
	const head = wrap.querySelector('thead');
	const foot = wrap.querySelector('tfoot');
	const appBar = document.querySelector('header');
	let frame = 0;
	const placeHead = () => {
		frame = 0;
		if (!head) return;
		const r = wrap.getBoundingClientRect();
		const room = r.height - head.offsetHeight - (foot?.offsetHeight ?? 0);
		const y = Math.min(Math.max(0, (appBar?.getBoundingClientRect().bottom ?? 0) - r.top), Math.max(0, room));
		wrap.style.setProperty('--head-y', `${y}px`);
	};
	const schedule = () => {
		frame ||= requestAnimationFrame(placeHead);
	};
	const resized = new ResizeObserver(schedule);

	wrap.addEventListener('touchstart', down, { passive: true });
	wrap.addEventListener('touchmove', move, { passive: false });
	wrap.addEventListener('touchend', up);
	wrap.addEventListener('touchcancel', up);
	addEventListener('scroll', schedule, { passive: true });
	addEventListener('resize', schedule);
	resized.observe(wrap);
	placeHead();

	return () => {
		stopGlide();
		cancelAnimationFrame(frame);
		resized.disconnect();
		wrap.removeEventListener('touchstart', down);
		wrap.removeEventListener('touchmove', move);
		wrap.removeEventListener('touchend', up);
		wrap.removeEventListener('touchcancel', up);
		removeEventListener('scroll', schedule);
		removeEventListener('resize', schedule);
		wrap.style.removeProperty('--head-y');
	};
}
