# planificator-nunta

> **Ce este:** un planificator de nuntă pe care îl instalați voi, făcut pentru nunțile din România:
> lista de invitați pe familii, invitație online cu confirmare (RSVP), așezarea la mese, bugetul cu
> darul de echilibru, sarcinile cu termene și desfășurătorul zilei. Înlocuiește tabelul Excel cu
> 15 foi, cu mai puține ecrane. Datele stau la voi, într-un singur fișier.

| | |
|---|---|
| **Pentru cine** | Miri și familie (nași, părinți), cu roluri: admin, editor, doar citire |
| **Invitați** | Fără cont: fiecare familie primește un link privat (WhatsApp, SMS) |
| **Intrare** | Parolă pe rol, sau contul Google (opțional) |
| **Tehnic** | SvelteKit 3 (Svelte 5), TypeScript, `node:sqlite` (fără module native), adapter-node |
| **Date** | Un fișier SQLite + poza și muzica voastră, într-un volum Docker |
| **Cost** | 0 lei pe calculatorul vostru; online ~7 $/lună pe Render sau un VPS mic al vostru |
| **Licență** | MIT |

```mermaid
flowchart LR
  subgraph Miri["Miri și familia (parolă sau Google)"]
    A[Acasă] --- I[Invitați] --- M[Mese] --- B[Buget] --- S[Sarcini] --- D[Desfășurător] --- T[Setări]
  end
  G([Invitat]) -- "link pe WhatsApp" --> P["/s/token<br/>save the date"]
  G -- "link pe WhatsApp" --> R["/r/token<br/>invitație + RSVP"]
  I -- "import Excel / CSV, export CSV" --> X[(xlsx / CSV)]
  Miri --> DB[(SQLite<br/>/data/nunta.db)]
  R --> DB
```

## Cum arată

Cu datele demo (`DEMO_DATA=true`): o nuntă inventată, fără poză de fundal încărcată.

| Ce primește un invitat, pe telefon | Ce văd mirii |
|---|---|
| <img src="docs/invitatie.gif" width="270" alt="Save the date-ul și invitația pe telefon: plicul cu sigiliu se deschide, apoi numărătoarea, cununia și petrecerea, programul zilei și formularul de confirmare"> | <img src="docs/aplicatie.gif" width="560" alt="Aplicația mirilor: Acasă, Invitați în tabel și pe familii, planul meselor, bugetul, sarcinile, desfășurătorul și setările"> |

## Ce face

1. **Acasă**: câte zile mai sunt, câți au confirmat, costul estimat, darul de echilibru și
   următoarele sarcini.
2. **Invitați**: invitații pe familii, din partea mirelui sau a miresei, pe categorii (miri, nași,
   familie, prieteni, colegi, cunoștințe) și subcategorii (părinți, frați, veri, unchi/mătuși,
   serviciu, facultate…), cu observații și „TBD" pentru cei încă nesiguri. Importă direct fișierul
   `.xlsx` (inclusiv familii pe celule unite) sau CSV; *Înlocuiește lista* sincronizează cu fișierul.
3. **Invitația și confirmarea**: fiecare familie are două linkuri private. *Save the date* arată
   numele, data, câte zile mai sunt și „Adaugă în calendar" (Google, Apple, Outlook). *Invitația* se
   deschide dintr-un plic cu sigiliu și monograma voastră, cu muzica voastră dacă ați încărcat-o:
   numărătoare inversă, cununia și petrecerea cu hartă și Waze, programul zilei și formularul de
   confirmare (vine / nu vine, meniu, alergii, un gând pentru miri).
4. **Mese**: planul sălii dintr-un șablon (mese rotunde, masa mirilor, ringul, formația), pe care le
   mutați unde sunt în realitate, cu o poză a sălii dedesubt. Așezați invitații cu două atingeri:
   persoana sau familia, apoi masa. Se tipărește ca plan plus lista pe mese.
5. **Buget**: costuri fixe, per adult sau per copil, înmulțite cu numărul estimat de invitați
   (procentul de prezență din Setări). Arată soldul estimat (contribuția nașilor și părinților plus
   darul mediu), **darul de echilibru** și soldul real din darurile primite.
6. **Sarcini**: 35 de sarcini tipice pentru o nuntă în România (biserică, Starea Civilă, analize
   prenupțiale…), cu termene calculate din data nunții.
7. **Desfășurător**: ziua nunții pe ore (machiaj, pregătiri, cununie, ședința foto, petrecere). Când
   întârziați, *Mută acest moment și tot ce urmează*. Momentele bifate apar și pe invitație.
8. **Notițe** (doar admin): notițe cu un mic calculator de cantități (7 trandafiri × 21 vaze).

## Instalare

Invitații trebuie să poată deschide linkurile de pe telefon, deci pentru nunta adevărată aplicația
trebuie să fie **online**. Pe calculatorul vostru e bună ca să o încercați sau să planificați doar voi.

| Varianta | Pentru cine | Instalați ceva? | Online pentru invitați? |
|---|---|---|---|
| [1. Online, dintr-un click](#1-online-dintr-un-click-render) | oricine | nu | da |
| [2. Pe calculator, o comandă](#2-pe-calculatorul-vostru-o-singură-comandă) | oricine | Docker Desktop | nu |
| [3. Pe serverul vostru](#3-pe-serverul-vostru-cu-domeniul-vostru) | tehnic | Docker pe un VPS | da |

### 1. Online, dintr-un click (Render)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/teodorio95-portofolio/planificator-nunta)

1. Apăsați butonul și faceți-vă cont pe [Render](https://render.com) (cu Google sau GitHub).
2. În formular, la `ADMIN_PASSWORD`, scrieți o parolă a voastră (minim 8 caractere), apoi **Deploy
   Blueprint**. Render adaugă un card de plată: aplicația are nevoie de un disc pentru date, iar
   discul e doar pe planurile plătite.
3. După 1–2 minute primiți o adresă de forma `https://planificator-nunta-xxxx.onrender.com`. Intrați
   cu parola și trimiteți invitaților linkuri de acolo.

Ce trebuie știut:

- **Cost:** în jur de 7,25 $/lună (instanța *Starter* 7 $ + discul de 1 GB 0,25 $), cât e nevoie,
  de obicei câteva luni până după nuntă. Planul gratuit nu are disc și ar pierde lista la fiecare
  repornire, de aceea nu e folosit. Prețurile sunt cele publicate de Render în octombrie 2026.
- **Datele** stau pe disc, în Frankfurt. Render face o copie a discului zilnic și o păstrează 7 zile;
  *Setări → Descarcă backup* rămâne totuși recomandat.
- **Versiuni noi** nu se instalează singure: în Render, *Manual Deploy → Deploy latest reference*.
- **Domeniul vostru** (de ex. `nunta.exemplu.ro`) se adaugă din *Settings → Custom Domains*.
- Dacă formularul nu v-a cerut parola, adăugați-o în *Environment* (`ADMIN_PASSWORD`); până atunci
  aplicația arată doar o pagină care spune ce lipsește.

### 2. Pe calculatorul vostru, o singură comandă

1. Instalați [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac sau Windows) și porniți-l.
2. Deschideți **Terminal** (Mac) sau **PowerShell** (Windows), lipiți comanda de mai jos, înlocuiți
   `alegeti-o-parola` cu o parolă a voastră (minim 8 caractere, fără spații) și apăsați Enter:

   ```bash
   docker run -d --name nunta -p 3000:3000 -v nunta-data:/data -e ADMIN_PASSWORD=alegeti-o-parola --restart unless-stopped ghcr.io/teodorio95-portofolio/planificator-nunta
   ```

3. Deschideți <http://localhost:3000> și intrați cu parola.

Datele rămân în volumul `nunta-data`, chiar dacă opriți sau ștergeți containerul. Vreți întâi să
vedeți cum arată? Adăugați `-e DEMO_DATA=true` înainte de `ghcr.io/…` și aplicația pornește cu o nuntă
inventată (Ana și Mihai, 22 de familii, 50 de invitați, mesele aranjate, un buget); pentru nunta
voastră folosiți apoi alt volum, de ex. `-v nunta-reala:/data`.

Actualizarea la o versiune nouă (datele rămân):

```bash
docker pull ghcr.io/teodorio95-portofolio/planificator-nunta
docker rm -f nunta
# apoi aceeași comandă `docker run` de mai sus
```

### 3. Pe serverul vostru, cu domeniul vostru

Pe un VPS cu Docker, cu domeniul (de ex. `nunta.exemplu.ro`) îndreptat spre server și porturile 80
și 443 deschise:

```bash
git clone https://github.com/teodorio95-portofolio/planificator-nunta.git
cd planificator-nunta
make env          # apoi în .env: ADMIN_PASSWORD=… și DOMAIN=nunta.exemplu.ro
make up-https     # Caddy cere singur certificatul Let's Encrypt
```

Fără `make`: `cp .env.example .env`, completați `.env`, apoi
`BIND_ADDRESS=127.0.0.1 docker compose -f compose.yaml -f compose.https.yaml up -d`.

### Pentru dezvoltare

Cu Node ≥ 24 (dezvoltat pe Node 26) sau Docker cu Compose v2:

```bash
git clone https://github.com/teodorio95-portofolio/planificator-nunta.git
cd planificator-nunta
make env          # creează .env din .env.example
# în .env: ADMIN_PASSWORD=o-parola-lunga (minim 8 caractere)
make up           # http://localhost:3000
```

`make up` construiește imaginea din sursă; `make demo` pornește serverul de dezvoltare pe o bază cu
nunta inventată. `DEMO_DATA=true` în `.env` face același lucru în container, pe o bază goală
(`docker compose down -v` șterge volumul cu tot cu date).

### Primii pași în aplicație

1. **Setări**: numele mirilor, data, locația, biserica cu ora (de ex. „Biserica Sf. Nicolae, ora 15:00"),
   termenul de confirmare, moneda și procentul estimat de prezență.
2. **Setări → Invitația**: o poză de fundal (voi sau locația) și, opțional, muzica.
3. **Invitați**: importați lista din Excel sau adăugați familiile.
4. Din pagina fiecărei familii, trimiteți linkul de save the date sau de invitație pe WhatsApp.

## Intrarea în aplicație

Cel mai simplu: câte o parolă comună pe rol, în `.env`.

| Rol | Parolă | Poate |
|---|---|---|
| Admin | `ADMIN_PASSWORD` | tot, plus Setări, backup, Notițe, dispozitivele conectate |
| Editor | `EDITOR_PASSWORD` | să modifice invitați, mese, buget, sarcini; export CSV |
| Doar citire | `READER_PASSWORD` | să vadă tot în afară de Setări și Notițe; poate adăuga sarcini |

O parolă schimbată (și containerul repornit) deconectează pe toți cei care intraseră cu ea. După 10
parole greșite de la aceeași adresă, încercările se opresc pentru un sfert de oră.

**Google (opțional)**: creați în Google Cloud un client OAuth de tip *Web application*, cu redirect URI
`https://domeniul-vostru/auth/google/callback`, și completați `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
și listele `ADMIN_EMAILS` / `EDITOR_EMAILS` / `READER_EMAILS`. Adminul poate adăuga și din Setări
conturi doar cu citire. Merge pe lângă parole.

**Fără nicio parolă și fără Google aplicația rămâne blocată** (afișează ce trebuie configurat).
`AUTH_DISABLED=true` o deschide oricui, ca admin: doar pentru încercări pe calculatorul vostru.

## Comenzi

```text
make help         toate comenzile
make up / down    pornește / oprește containerul (datele rămân în volumul nunta-data)
make up-https     pornește în spatele Caddy, cu HTTPS pentru DOMAIN
make logs         jurnalul aplicației
make backup       copie a bazei, a pozei și a muzicii în data/backups/<data>/
make dev          server de dezvoltare pe http://localhost:5173 (deschis, ca admin)
make demo         server de dezvoltare pe o bază cu nunta inventată
make test check   teste și verificarea tipurilor
```

## Importul listei de invitați

**Invitați → Import din CSV / Excel**, un rând per persoană. Coloane recunoscute: `familie` /
`familii`, `nume` / `invitat` (obligatoriu), `din partea` (mire / mireasă), `categorie`,
`subcategorie`, `observatii`, `tbd`, `copil` (da), `meniu`, `restrictii`, `telefon`. Pentru CSV,
separatorul e `,` sau `;`.

Fără coloana `familie`, familiile se deduc din ordine: oamenii consecutivi cu același nume de familie
și aceeași parte, rândurile „Soție Andrei" / „Iubit Ana" lângă persoana de deasupra, „Copil …" ca
copii. Reimportul aceluiași fișier nu dublează nimic.

## Structură

```text
src/
  lib/
    access.ts            roluri și ce poate fiecare (testat)
    calc.ts              calculele: prezență, buget, dar de echilibru, termene (testat)
    guests.ts, csv.ts    import și deducerea familiilor (testat)
    invitation.ts        numărătoarea, monograma, iconițele programului (testat)
    Plic.svelte          plicul invitației, cu muzica
    server/
      db.ts              schema SQLite, migrări mici, setări
      auth.ts            parole pe rol, Google, sesiuni (testat)
      media.ts           poza de fundal și muzica încărcate din Setări
      demo.ts            nunta inventată pentru DEMO_DATA=true
  routes/
    (app)/               paginile mirilor: Acasă, invitati, mese, buget, sarcini, desfasurator, setari, notite
    r/[token]/           invitația cu confirmarea (publică, prin link)
    s/[token]/           save the date (public, prin link)
    media/[kind]/        poza și muzica, pentru paginile invitaților
compose.yaml             containerul, cu volumul nunta-data
compose.https.yaml       Caddy în față, cu HTTPS automat
render.yaml              butonul „Deploy to Render": imaginea, discul și parola cerută la creare
docker-entrypoint.mjs    dă discul montat utilizatorului node, apoi rulează aplicația fără root
```

## ⚠️ De reținut

- **Faceți backup** (`make backup` sau *Setări → Descarcă backup*). Nu există copie automată în altă
  parte; `docker compose down -v` șterge volumul cu toate datele.
- **Linkurile invitaților sunt cheile lor**: cine are linkul unei familii poate schimba răspunsul ei.
  Un link scăpat se înlocuiește din pagina familiei (*Generează link nou*).
- **Online, folosiți HTTPS** (`make up-https` sau propriul reverse proxy cu `PROTOCOL_HEADER` și
  `ADDRESS_HEADER`, cu portul aplicației doar pe `127.0.0.1`). Pe `http://` merge pe calculatorul
  vostru și în rețeaua de acasă.
- **Imaginea Docker** se publică în GHCR din CI la primul push pe `main`; până atunci, `make up` o
  construiește local din sursă.
- **Muzica și poza** trebuie să fie ale voastre sau să aveți dreptul să le distribuiți: ele se
  servesc public, oricui are un link de invitație.
- Interfața e doar în română, cu obiceiurile nunților de la noi (nași, dar, cununie religioasă).
