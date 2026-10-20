# Studiovest.no — ny nettside

Statisk nettside (HTML, CSS, JS). Ingen WordPress, ingen byggesteg.

- **Forhåndsvisning:** publiseres automatisk til GitHub Pages ved hver push til `main`.
- **Produksjon (senere):** studiovest.no på one.com via SFTP, når designet er godkjent.
- Forhåndsvisningen har `noindex` og `robots.txt` som blokkerer søkemotorer. Fjernes ved lansering.

## Design

Konsept «Fremkalling»: svart som et mørkerom. Bildene fremkalles fra sort når de vises
(hero, bildeviseren under «Fire kapitler»), og manifestet lyses opp linje for linje mens man scroller.
Ingen aksentfarge — all farge kommer fra fotografiene.

- Skrift: Hanken Grotesk (lette vekter i store titler). Ligger lokalt i `assets/fonts/`, ingen Google Fonts.
- Farger: se `:root` øverst i `assets/style.css`.

## Bilder

Alle bilder ligger i `assets/photos/`, navngitt etter felt (`bolig-*`, `bedrift-*`, `skole-*`, `maritim-*`).
Hero-bildene velges i `assets/main.js` (listen `slides`), bildene per kapittel i listen `fields`.

Skole- og barnehagebilder: bare bilder med skriftlig samtykke fra foresatte til markedsføring.
