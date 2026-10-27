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

Struktur og bevegelse inspirert av landonorris.com, tilpasset et mediebyrå og med Studiovests egne farger
(papirhvit #F2EEE8, mørkerom #161412, stein #C9C1B6, sand #D9A866, brun #8B5A3A).

- **Laster:** STUDIO/VEST og teller 0–100, gardinen trekkes opp.
- **Meny:** fullskjerm. 2×2 bildegrid (svart-hvitt) til venstre, store lenker til høyre. Hover gir farge på bildet
  og håndtegnet strek under lenken. Bildene følger musen. Esc lukker.
- **Hero (inspirert av for-living.it):** fullskjerm fargeflate i mørk brun (ingen bilde), rolig lintekstur og ett
  mykt lys som glir sakte. En plantegning lyser opp rundt musen. Håndskrift «Fra Sunnhordland», serif-tittel med
  gradient på to linjer (PC), ordet bytter (med pauseknapp).
- **Book en prat:** brun pille (samme farge som ordet i tittelen). Hover inspirert av lusion.co: sand fylles inn fra
  musepekeren, pil glir inn, prikken forsvinner.
- **Gigantiske linjer:** to rader i hver sin retning, farten følger scrollingen. Portrett med håndtegnet sløyfe.
- **Manifest:** ord for ord lyses opp mens man scroller.
- **Kollasj:** spredte bilder i ulik fart (parallakse), bakgrunnen glir fra mørk til stein til lys.
- **Foto / Film:** bildene glir inn fra skjermkantene.
- **Fire kapitler:** forskjøvet rutenett, bildene bytter og tekst vises ved hover.
- **Timebank:** svevende bilder i ulik fart. **Vifte:** kort i bue som roterer og kan dras.
- **Bunn:** stort mørkt kort med hakk på toppen og logoslider (plassholdere «Kundelogo» til ekte logoer kommer).
- Teknikk: GSAP + ScrollTrigger og Lenis (myk scrolling) i `assets/vendor/`. Alt slås av ved redusert bevegelse.
- Skrift: Hanken Grotesk, Gloock, Bodoni Moda (versjon B) og Ms Madi (håndskrift), lokalt i `assets/fonts/`. Kotelinjene er generert, ligger i `index.html` (`#topo`).

## Bilder

Alle bilder ligger i `assets/photos/`, navngitt etter felt (`bolig-*`, `bedrift-*`, `skole-*`, `maritim-*`).
I `assets/main.js`: hero-bildene i `slides`, viften i `fanPhotos`. Kapittelbildene står i `data-photos` i `index.html`.

Skole- og barnehagebilder: bare bilder med skriftlig samtykke fra foresatte til markedsføring.
