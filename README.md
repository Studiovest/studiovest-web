# Studiovest.no — ny nettside

Statisk nettside (HTML, CSS, JS). Ingen WordPress, ingen byggesteg.

- **Forhåndsvisning:** publiseres automatisk til GitHub Pages ved hver push til `main`.
- **Produksjon (senere):** studiovest.no på one.com via SFTP, når designet er godkjent.
- Forhåndsvisningen har `noindex` og `robots.txt` som blokkerer søkemotorer. Fjernes ved lansering.

## Design

Struktur og bevegelse inspirert av landonorris.com, tilpasset et mediebyrå og med Studiovests egne farger
(papirhvit #F2EEE8, mørkerom #161412, stein #C9C1B6, sand #D9A866, brun #8B5A3A).

- **Laster:** STUDIO/VEST og teller 0–100, gardinen trekkes opp.
- **Meny:** fullskjerm. 2×2 bildegrid (svart-hvitt) til venstre, store lenker til høyre. Hover gir farge på bildet
  og håndtegnet strek under lenken. Bildene følger musen. Esc lukker.
- **Hero:** linse som følger musen og viser ferdig redigert bilde over råfilen. Ordet i tittelen og bildet bytter
  (med pauseknapp).
- **Gigantiske linjer:** to rader i hver sin retning, farten følger scrollingen. Portrett med håndtegnet sløyfe.
- **Manifest:** ord for ord lyses opp mens man scroller.
- **Kollasj:** spredte bilder i ulik fart (parallakse), bakgrunnen glir fra mørk til stein til lys.
- **Foto / Film:** bildene glir inn fra skjermkantene.
- **Fire kapitler:** forskjøvet rutenett, bildene bytter og tekst vises ved hover.
- **Timebank:** svevende bilder i ulik fart. **Vifte:** kort i bue som roterer og kan dras.
- **Bunn:** stort mørkt kort med hakk på toppen.
- Teknikk: GSAP + ScrollTrigger og Lenis (myk scrolling) i `assets/vendor/`. Alt slås av ved redusert bevegelse.
- Skrift: Hanken Grotesk og Gloock, lokalt i `assets/fonts/`. Kotelinjene er generert, ligger i `index.html` (`#topo`).

## Bilder

Alle bilder ligger i `assets/photos/`, navngitt etter felt (`bolig-*`, `bedrift-*`, `skole-*`, `maritim-*`).
I `assets/main.js`: hero-bildene i `slides`, viften i `fanPhotos`. Kapittelbildene står i `data-photos` i `index.html`.

Skole- og barnehagebilder: bare bilder med skriftlig samtykke fra foresatte til markedsføring.
