# Studiovest.no — ny nettside

Statisk nettside (HTML, CSS, JS). Ingen WordPress, ingen byggesteg.

- **Forhåndsvisning:** publiseres automatisk til GitHub Pages ved hver push til `main`.
- **Produksjon (senere):** studiovest.no på one.com via SFTP, når designet er godkjent.
- Forhåndsvisningen har `noindex` og `robots.txt` som blokkerer søkemotorer. Fjernes ved lansering.

## Versjoner

- **Versjon 1** (godkjent 25.10.2026): commit `57f6a33` på `main`.
  Fast kopi som alltid kan åpnes: `/versjon-1/` på forhåndsvisningen. Den mappen endres aldri.
- Rulle tilbake forsiden til versjon 1: `git checkout 57f6a33 -- index.html assets`, commit og push
  (mappen `versjon-1/` røres ikke).
- **A/B-sammenligning (forhåndsvisning):** `/` er versjon A (hero med fargeflate og plantegning, inspirert av
  for-living.it). `/versjon-b/` er versjon B (fullskjerms bilde i bevegelse og tynn Bodoni-serif, inspirert av
  astemia.it). Resten av siden er felles (samme `assets/`). Knappen «A / B» nede til høyre bytter; fjernes ved lansering.

## Design

Bygger på versjon 1 (struktur og bevegelse inspirert av landonorris.com, Studiovests egne farger:
papirhvit #F2EEE8, mørkerom #161412, stein #C9C1B6, sand #D9A866, brun #8B5A3A). Endringer etter versjon 1:

- **Hero:** bildet vises i full farge (linsen med grå råfil og «boble» er fjernet). Ordet og bildet bytter fortsatt.
- **Gyldne kotelinjer:** linjene lyser opp i gull rundt musen, i alle seksjoner med kotelinjer og i menyen.
- **Partnere & kunder (ny, mellom Foto/Film og Fire kapitler):** logoslider som på landonorris.com, med håndskrevet
  «Samarbeid». Logoene følger fargetemaet: svarte på lys bakgrunn, hvite når siden går over til mørk.
  Logoer: Aktiv, EiendomsMegler 1, Nordvik, EIE, Eiendomsmegler Norge, Kviteberg (hentet fra deres nettsider).
- **Gigantiske linjer:** mindre tekst.
- **Til toppen:** pil nede til høyre som dukker opp når man har scrollet helt ned.

Uendret fra versjon 1: laster, meny, gigantiske linjer, manifest, kollasj, Foto/Film, Fire kapitler, Timebank, vifte, bunn.
Teknikk: GSAP + ScrollTrigger og Lenis i `assets/vendor/`. Skrift: Hanken Grotesk, Gloock og Ms Madi, lokalt i `assets/fonts/`.

## Bilder

Alle bilder ligger i `assets/photos/`, navngitt etter felt (`bolig-*`, `bedrift-*`, `skole-*`, `maritim-*`).
I `assets/main.js`: hero-bildene i `slides`, viften i `fanPhotos`. Kapittelbildene står i `data-photos` i `index.html`.

Skole- og barnehagebilder: bare bilder med skriftlig samtykke fra foresatte til markedsføring.
