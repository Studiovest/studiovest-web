# Studiovest.no — ny nettside

Statisk nettside (HTML, CSS, JS). Ingen WordPress, ingen byggesteg.

- **Forhåndsvisning:** publiseres automatisk til GitHub Pages ved hver push til `main`.
- **Produksjon (senere):** studiovest.no på one.com via SFTP, når designet er godkjent.
- Forhåndsvisningen har `noindex` og `robots.txt` som blokkerer søkemotorer. Fjernes ved lansering.

## Design

Konsept «Fremkalling», levende versjon: svart som et mørkerom, og siden er i bevegelse hele tiden.

- **Hero:** fullskjerms bildeslider (pil, sveip, klikk på bildet, autospill med pause). Nye bilder feies inn og fremkalles,
  ordet i overskriften bytter i takt, linjene glir inn fra venstre, høyre og nedenfra ved sidelast. Parallakse ved scroll.
- **Kapitler:** listen glir inn fra venstre, bildeviseren avdekkes fra høyre; nye bilder feies inn.
- **Utvalgt arbeid:** horisontal bildeslider som styres av scroll på PC (kan også dras med musen), og sveipes på mobil.
- **Manifest:** linjene glir inn vekselvis fra venstre og høyre, og lyses opp mens man leser.
- **Øvrig:** titler stiger opp ord for ord / bokstav for bokstav, egen markør på PC, magnetiske knapper,
  toppmeny som gjemmer seg ved scroll ned, fremdriftslinje øverst.
- Alt slås av for besøkende som har valgt redusert bevegelse i systemet sitt.
- Markering i HTML: `data-reveal="left|right|up|down|clip-right|clip-up"`, `data-stagger`, `data-split` (` / ` = linjeskift).
- Skrift: Hanken Grotesk, lokalt i `assets/fonts/`. Farger: `:root` i `assets/style.css`.

## Bilder

Alle bilder ligger i `assets/photos/`, navngitt etter felt (`bolig-*`, `bedrift-*`, `skole-*`, `maritim-*`).
I `assets/main.js`: hero-bildene i `slides`, bildene per kapittel i `fields`, slideren «Utvalgt arbeid» i `work`.

Skole- og barnehagebilder: bare bilder med skriftlig samtykke fra foresatte til markedsføring.
