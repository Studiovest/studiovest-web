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
- **Forsiden nå (29.10.2026):** nøyaktig versjon 1, identisk med `/versjon-1/`.
- **Lagrede tillegg (ikke i bruk):** commit `cc58c64` har hero uten linse, gyldne linjer ved musepeker, logoslider
  (Aktiv, EiendomsMegler 1, Nordvik, EIE, Eiendomsmegler Norge, Kviteberg), mindre gigantiske linjer og til-toppen-pil.
  Kan hentes inn igjen enkeltvis.

## Design

Versjon 1: struktur og bevegelse inspirert av landonorris.com, Studiovests egne farger
(papirhvit #F2EEE8, mørkerom #161412, stein #C9C1B6, sand #D9A866, brun #8B5A3A).
Teknikk: GSAP + ScrollTrigger og Lenis i `assets/vendor/`. Skrift: Hanken Grotesk, Gloock og Ms Madi, lokalt i `assets/fonts/`.

## Bilder

Alle bilder ligger i `assets/photos/`, navngitt etter felt (`bolig-*`, `bedrift-*`, `skole-*`, `maritim-*`).
I `assets/main.js`: hero-bildene i `slides`, viften i `fanPhotos`. Kapittelbildene står i `data-photos` i `index.html`.

Skole- og barnehagebilder: bare bilder med skriftlig samtykke fra foresatte til markedsføring.
