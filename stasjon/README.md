# Studiovest Stasjon

Vårt eget tethering-program for skolefoto og portrettdager. Kjører på stasjons-PC-en, med kameraet i
USB-C-kabel (Tether Tools TetherPro Optima 10G, USB-C rett til vinkel).

## Hva det gjør

1. **Klikk på navnet** i listen til den som sitter foran kamera (lang liste: skriv noen bokstaver i søket og trykk Enter).
2. **Ta bildet** med kameraets utløser. Bildet kommer over kabelen og
   - får navn etter mal, f.eks. `FJT2026/4B/FJT-4B-7K2Q_0001.jpg`
   - får en XMP-fil med personens ID fra klasselisten (`dc:identifier`), så det finner riktig barn selv om filen får nytt navn
   - kopieres til backup-disken (ekstern SSD)
   - legges i opplastingskøen til portalen. Køen ligger på disk og tåler nettbrudd og omstart.
3. **Klikk neste navn** når du går videre. Forrige person blir ferdig av seg selv.
   Eller trykk **Enter = ferdig**, så velges neste i listen automatisk. Barn uten samtykke hoppes over.

Ingen QR-kort eller skanner trengs.

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

Test: `npm test` (19 tester, simulert kamera).

## Filnavnmal

`{skole}` `{klasse}` `{kode}` `{fornavn}` `{etternavn}` `{nr}` `{nr2}` `{dato}` `{tid}` `{stasjon}`

- Skolefoto: `{skole}/{klasse}/{kode}_{nr}` → `FJT2026/4B/FJT-4B-7K2Q_0001.jpg`
- Portrettdag: `{etternavn}_{fornavn}_{nr}` → `Brekke_Ola_0001.jpg`

`/` lager mapper. Malen kan ikke skrive utenfor biblioteket.

## Portalen

Med `portalUrl` og `portalToken` satt lastes hvert bilde opp med `PUT {portalUrl}/api/stasjon/bilder`
(kode, nummer, sha256, stasjon). Uten portal kopieres filene til `data/lastet-opp/` for test.
Klasselisten (`roster.json`) skal hentes fra portalen før fotodagen når den ekte portalen er bygget.
