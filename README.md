# Studiovest.no — ny nettside

Statisk nettside (HTML, CSS, JS). Ingen WordPress, ingen byggesteg.

- **Forhåndsvisning:** publiseres automatisk til GitHub Pages ved hver push til `main`.
- **Produksjon (senere):** studiovest.no på one.com via SFTP, når designet er godkjent.
- Forhåndsvisningen har `noindex` og `robots.txt` som blokkerer søkemotorer. Fjernes ved lansering.

## Design

Konsept «Kontaktarket»: siden leses som en fotografs arbeidsark. Bildene ligger i filmstriper,
og fotografens fettstift-merker (beskjæringshjørner i hero, sirkler rundt valgte bilder) er eneste fargeinnslag.

- Skrift: Schibsted Grotesk (overskrifter, meny) og Newsreader (brødtekst). Ligger lokalt i `assets/fonts/`, ingen Google Fonts.
- Farger: se `:root` øverst i `assets/style.css`.

## Bilder

Alle bilder ligger i `assets/photos/`, navngitt etter felt (`bolig-*`, `bedrift-*`, `skole-*`, `maritim-*`).
Hero-bildene velges i `assets/main.js` (listen `slides`); filmstripene står i `index.html`.

Skole- og barnehagebilder: bare bilder med skriftlig samtykke fra foresatte til markedsføring.
