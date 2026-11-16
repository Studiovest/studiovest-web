# Studiovest Stasjon

Vårt eget tethering-program for skolefoto og portrettdager. Kjører på stasjons-PC-en, med kameraet i
USB-C-kabel (Tether Tools TetherPro Optima 10G, USB-C rett til vinkel).

## Hva det gjør

1. **Klikk på navnet** i listen til den som sitter foran kamera (lang liste: skriv noen bokstaver i søket og trykk Enter).
2. **Ta bildet** med kameraets utløser. Bildet kommer over kabelen og
   - får navn etter mal, f.eks. `FJT2026/4B/FJT-4B-7K2Q_0001.jpg`
   - får en XMP-fil med personens ID fra klasselisten (`dc:identifier`), så det finner riktig barn selv om filen får nytt navn
   - kopieres til backup-disken (ekstern SSD)
   - vises **stort med en gang** på skjermen, og i galleriet under med alle bildene av personen
   - legges i opplastingskøen til portalen. Køen ligger på disk og tåler nettbrudd og omstart.
3. **Klikk neste navn** når du går videre. Forrige person blir ferdig av seg selv.
   Eller trykk **Enter = ferdig**, så velges neste i listen automatisk. Barn uten samtykke hoppes over.

Ingen QR-kort eller skanner trengs.

## Kontroll på stedet

Alt vises rett fra PC-en, så det går like fort uten nett.
- **← →** blar i bildene til personen. Nye bilder hopper frem av seg selv (hvis du ser på det siste).
- **Klikk på bildet** = 100 % for å sjekke skarphet i øynene. Flytt musen for å se rundt. Klikk igjen eller Esc for å gå ut.
- **F** = favoritt, **X** = forkast. Står i XMP som stjerner (5) og avvist (−1), så Lightroom og Capture One ser det.
  Forkastede bilder lastes ikke opp.
- Fotograferer du bare i RAW, hentes det innebygde JPG-bildet ut av RAW-filen, så du ser bildet like fort.
- Dagen lagres på disk (`data/okt.json`). Etter omstart eller tomt batteri er galleri, favoritter og status der.

## Opplasting etterpå (`uploadMode`)

- `"etterpå"` (standard): ingenting lastes opp på stedet. Alt ligger på PC-en og SSD-en.
  Opplastingen starter av seg selv når PC-en er på et kjent wifi (`syncWifi`, f.eks. `["Studiovest"]`),
  eller med «Last opp nå». JPG først, så RAW. Kan settes på pause.
- `"med-en-gang"`: laster opp fortløpende når det er nett.

Sikkerhet:
- Barn med «nei», «bare gruppebilde» eller ubesvart samtykke gir **rød stopp**. Bilder som likevel tas,
  havner i `karantene/` og lastes aldri opp.
- Bilder tatt før noen er valgt, havner i `usortert/`.
- RAW og JPG fra samme utløsning får samme nummer.

## Kamera (`driver` i config)

| Driver | Hvordan | Når |
|---|---|---|
| `gphoto2` | Direkte over kabelen med libgphoto2 (åpen kildekode). Kameraets utløser brukes. | Linux og macOS. Støtter de fleste Sony-, Canon- og Nikon-modeller. |
| `folder` | Følger en mappe. Kameraprodusentens gratis tether-program (Sony Imaging Edge / Remote, Canon EOS Utility, Nikon NX Tether) lagrer dit. | Virker med alle kamera, også på Windows. |
| `simulator` | Lager testbilder. | Utvikling og opplæring uten kamera. |

Neste steg for direkte styring og live view fra skjermen: Sony Camera Remote SDK (gratis fra Sony),
eller Canon EDSDK / Nikon SDK, avhengig av kameramodell.

## Kom i gang

Krever Node.js 20 eller nyere. Ingen andre pakker.

```
cd stasjon
cp config.example.json config.json      # endre stier, stasjonsnavn og driver
cp eksempel/roster.json data/roster.json
npm run sim                             # test uten kamera
npm start                               # med kamera
```

Åpne http://localhost:7420 på stasjons-PC-en.

Test: `npm test` (27 tester, simulert kamera).

## Filnavnmal

`{skole}` `{klasse}` `{kode}` `{fornavn}` `{etternavn}` `{nr}` `{nr2}` `{dato}` `{tid}` `{stasjon}`

- Skolefoto: `{skole}/{klasse}/{kode}_{nr}` → `FJT2026/4B/FJT-4B-7K2Q_0001.jpg`
- Portrettdag: `{etternavn}_{fornavn}_{nr}` → `Brekke_Ola_0001.jpg`

`/` lager mapper. Malen kan ikke skrive utenfor biblioteket.

## Portalen

Med `portalUrl` og `portalToken` satt lastes hvert bilde opp med `PUT {portalUrl}/api/stasjon/bilder`
(kode, nummer, sha256, stasjon). Uten portal kopieres filene til `data/lastet-opp/` for test.
Klasselisten (`roster.json`) skal hentes fra portalen før fotodagen når den ekte portalen er bygget.
