# Lansering av studiovest.no og portalen

Oppsett: **one.com** (nettside, portal, MariaDB-database, e-post) + **Wasabi** (bilder) + **GitHub Actions** (publisering og faste jobber).
Alt publiseres automatisk fra GitHub. Alle passord ligger i én GitHub-hemmelighet: `STUDIOVEST_CONFIG`.

## Det du gjør (én gang)

1. **SFTP-passord (one.com):** Kontrollpanel → SFTP/SSH. Noter vertsnavn, brukernavn og passord (lag nytt passord om du ikke har det).
2. **Database (one.com):** Kontrollpanel → Database (MariaDB) → opprett database. Noter vertsnavn, databasenavn, brukernavn og passord.
3. **E-postkonto for utsending:** Bruk en eksisterende one.com-adresse (eller lag f.eks. portal@…). Noter adresse og passord.
4. **Lim inn i GitHub:** github.com/Studiovest/studiovest-web → Settings → Secrets and variables → Actions → New repository secret.
   Navn: `STUDIOVEST_CONFIG`. Innhold (fyll inn verdiene):

   ```
   SFTP_HOST=
   SFTP_USER=
   SFTP_PASSWORD=
   DB_HOST=
   DB_NAME=
   DB_USER=
   DB_PASSWORD=
   MAIL_USER=
   MAIL_PASSWORD=
   ADMIN_EMAIL=
   ```
   `ADMIN_EMAIL` = adressen(e) som skal kunne logge inn i portalen, komma mellom flere.

5. **Si fra til Claude.** Resten gjøres automatisk (se under).

Senere, når du vil lagre bilder:

6. **Wasabi:** lag konto, velg EU-region, lag en tilgangsnøkkel (Access keys). Legg til fire linjer i samme hemmelighet (Update):
   ```
   WASABI_KEY=
   WASABI_SECRET=
   WASABI_BUCKET=studiovest-bilder
   WASABI_REGION=eu-central-2
   ```
   Bøtta og CORS opprettes automatisk ved første kjøring. Regionkoden står i Wasabi-konsollen (f.eks. eu-central-1 Amsterdam, eu-central-2 Frankfurt).

E-postagent (leser bestillinger fra meglere og lager prosjekter):

7. **Claude API-nøkkel:** console.anthropic.com → API Keys → Create key. Sett gjerne en månedlig grense under Limits (f.eks. 10 $). Legg til i hemmeligheten:
   Én nøkkel per agent, så du ser kostnaden for hver i Claude Console:
   ```
   CLAUDE_KEY_EMAIL=
   CLAUDE_KEY_FLOORPLAN=
   CLAUDE_KEY_FLOORPLAN_EDIT=
   ```
   EMAIL = e-postagenten, FLOORPLAN = plantegningsagenten (levering), FLOORPLAN_EDIT = agenten som endrer plantegninger. Adresseagenten bruker ikke Claude. `ANTHROPIC_API_KEY=` brukes for de agentene som ikke har egen nøkkel.
   Bestillinger agenten har registrert, flyttes til mappen «Registrerte bestillinger» i innboksen (lages automatisk). Annet navn: `AGENT_FOLDER=Mappenavn`. Tom verdi slår av flyttingen.
   Valgfritt: `IMAP_USER=` og `IMAP_PASSWORD=` hvis bestillingene kommer til en annen adresse enn `MAIL_USER`, og `AGENT_DOMAINS=fjordmegling.no,em1.no` for meglerdomener som alltid skal leses.

Plantegningsagent (endrer plantegninger ut fra ønsker fra megler, kunde og fotograf):

8. Bruker `CLAUDE_KEY_FLOORPLAN_EDIT` (se punkt 7). Valgfritt: `PLAN_MODEL=` for en annen Claude-modell (standard `claude-sonnet-5-5`).

Plantegninger fra Cubicasa (agenten henter ferdige ordrer og kobler dem til prosjektet med samme adresse):

10. **Cubicasa-nøkkel:** legg til i hemmeligheten:
    ```
    CUBICASA_API_KEY=
    ```
    Test nøkkelen: Actions → «Cubicasa-test» → Run workflow. Ved første kjøring registreres ordrer som allerede er ferdige, uten å lages på nytt.

Kart med Street View og flyfoto i prosjektene (valgfritt, gratis):

9. **Google-nøkkel:** console.cloud.google.com → lag prosjekt → legg inn betalingskort (Google krever det, men Maps Embed API koster ingenting) → APIs & Services → Library → aktiver **Maps Embed API** → Credentials → Create credentials → API key.
   Begrens nøkkelen: Application restrictions = Websites, legg til `https://studiovest.no/*`. API restrictions = Maps Embed API. Legg til i hemmeligheten:
   ```
   GOOGLE_MAPS_KEY=
   ```
   Uten nøkkel vises kartet med eiendomsgrenser likevel, og Street View åpnes i en ny fane.

Portalen på portal.studiovest.no (gjøres ved lansering):

11. one.com: Kontrollpanel → Avanserte innstillinger → Underdomener → legg til `portal`. Claude finner mappen og legger inn i hemmeligheten:
    ```
    PORTAL_URL=https://portal.studiovest.no
    PORTAL_DIR=<mappen for underdomenet>
    ```
    API-et blir på studiovest.no/api. studiovest.no/portal/ sendes videre til portal.studiovest.no.

## Det som skjer automatisk

| Steg | Hvordan |
|---|---|
| Finne riktig mappe på serveren | Workflow «Live på studiovest.no», modus `probe` |
| Sikkerhetskopi av WordPress | Modus `golive` laster ned alt på serveren og lagrer det i GitHub (artefakt, 90 dager) |
| Flytte WordPress ut av veien | Alt flyttes til `_wordpress/` (slettes ikke, stengt for besøkende) |
| Publisere nettside + portal + API | SFTP fra GitHub, og deretter ved hver endring |
| Database | Tabellene opprettes automatisk første gang `api/health.php` kalles |
| Innlogging i portalen | Lenke på e-post til `ADMIN_EMAIL`, ingen passord |
| Https, www → uten www, gamle WordPress-adresser | `.htaccess` |
| Google | Forsiden indekseres; portal, api og versjon-1 gjør ikke det; `sitemap.xml` lages |
| Faste jobber | Workflow «Portal-jobber» kaller `api/cron.php` hvert 30. minutt |

## Angre lanseringen
Filene til WordPress ligger urørt i `_wordpress/` på serveren, og en full kopi ligger som artefakt i GitHub-kjøringen. Flytt dem tilbake, eller be Claude gjøre det.

## Status
`https://studiovest.no/api/health.php` viser database, e-post, Wasabi og siste kjøring av faste jobber.
