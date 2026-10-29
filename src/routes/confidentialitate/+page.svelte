<!-- Public privacy note, linked from Google's sign-in screen (Google Auth Platform → Branding). -->
<svelte:head>
	<title>Confidențialitate · Nunta noastră</title>
</svelte:head>

<main class="page">
	<article class="card form-stack">
		<p class="eyebrow">Planificatorul de nuntă</p>
		<h1>Confidențialitate</h1>

		<p>
			Aplicația aceasta este planificatorul privat al nunții noastre. Nu este un serviciu public și nu
			are scop comercial.
		</p>

		<h2>Autentificarea</h2>
		<p>
			Mirii și familia intră cu o parolă sau cu contul Google. La intrarea cu Google primim doar adresa de e-mail a contului, ca să verificăm dacă este pe lista
			persoanelor cu acces (miri și familie). Nu primim parola, contactele sau alte date din contul
			Google. După autentificare, browserul păstrează un cookie de sesiune timp de 30 de zile; pe server
			rămân adresa de e-mail (sau rolul, la intrarea cu parolă), tipul de dispozitiv și data conectării.
			Invitații nu au cont: fiecare familie primește un link privat de confirmare.
		</p>

		<h2>Datele invitaților</h2>
		<p>
			Pentru organizare păstrăm numele invitaților, numărul de telefon pentru invitație și răspunsurile
			la confirmare (prezență, meniu, restricții alimentare). Le folosim doar pentru nuntă, nu le
			împărțim cu nimeni și nu le folosim pentru reclame.
		</p>

		<h2>Unde sunt păstrate</h2>
		<p>
			Datele stau într-un singur fișier pe serverul ales de miri, fără servicii terțe de analiză sau
			reclame, cu copii de siguranță ținute de miri. Le ștergem după nuntă.
		</p>

		<h2>Întrebări sau ștergere</h2>
		<p>
			Dacă vreți să știți ce date avem despre voi sau vreți să le ștergem, scrieți-le mirilor și le
			ștergem.
		</p>
	</article>
</main>

<style>
	article {
		max-width: 680px;
		margin: 0 auto;
		padding: 32px 28px;
	}
</style>
