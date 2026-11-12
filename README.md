# WagenRit – Ritten Logboek voor Bedrijfswagens

**WagenRit (Ritten Logboek)** is een professionele, moderne webapplicatie voor de registratie en het beheer van ritten met bedrijfswagens binnen teams en organisaties.

De app is primair ontworpen voor gebruik op smartphones en tablets (met grote touch-vriendelijke knoppen en duidelijke statussen), maar functioneert eveneens uitstekend op desktop.

---

## Inhoudsopgave

1. [Doel & Kernfunctionaliteiten](#doel--kernfunctionaliteiten)
2. [Belangrijkste Bedrijfsregels](#belangrijkste-bedrijfsregels)
3. [Rollen & Bevoegdheden](#rollen--bevoegdheden)
4. [Gebruikte Technologieën](#gebruikte-technologieën)
5. [Installatie- & Ontwikkelgids](#installatie--ontwikkelgids)
6. [Hosten met Docker & Docker Compose](#hosten-met-docker--docker-compose)
7. [Handleiding voor Medewerkers](#handleiding-voor-medewerkers)
8. [Handleiding voor Beheerders](#handleiding-voor-beheerders)
9. [Datamodel & Beveiliging](#datamodel--beveiliging)

---

## Doel & Kernfunctionaliteiten

Binnen bedrijven waar meerdere medewerkers gebruikmaken van een gedeeld wagenpark ontstaat er regelmatig onduidelijkheid over wie op welk moment met welke wagen heeft gereden. Dit leidt tot discussies bij verkeersboetes, schadeclaims, onderhoud of brandstofverbruik.

**WagenRit lost dit op door:**
- Exact en transparant vast te leggen wie wanneer welke wagen bestuurde.
- Het registreren van begin- en eindkilometerstanden en het specifieke doel van elke rit.
- Een geautomatiseerde overdracht af te dwingen zodat wagens nooit "spookritten" achterlaten.
- Teams en afdelingen elk hun eigen afgeschermde wagenpark te geven.
- Uitgebreide daglogboeken en CSV-exportmogelijkheden te bieden aan wagenbeheerders.

---

## Belangrijkste Bedrijfsregels

### 1. Maximaal één openstaande rit per wagen (Automatische Overdracht)
Per wagen mag er in het systeem te allen tijde slechts **één openstaande rit** bestaan:
- Als **Gebruiker B** een nieuwe rit start voor een wagen waarvoor **Gebruiker A** nog een openstaande rit heeft (bijvoorbeeld vergeten af te sluiten), sluit het systeem de rit van Gebruiker A **automatisch af**:
  - `stop_tijd` = starttijd van de nieuwe rit van Gebruiker B
  - `stop_km` = startkilometerstand van de nieuwe rit van Gebruiker B
  - `status` = `"automatisch_afgesloten"` (gemarkeerd met een blauwe badge)
- De overdracht gebeurt **atomisch en server-side** (via MariaDB SQL-transacties met `BEGIN TRANSACTION`, `COMMIT` en `ROLLBACK`), waardoor race conditions worden uitgesloten.

### 2. Editeerbare tijdstippen (nooit in de toekomst)
- Zowel bij het starten als stoppen van een rit staat standaard het **huidige tijdstip** ingevuld.
- Medewerkers kunnen de tijd aanpassen (bijvoorbeeld als zij 20 minuten geleden al zijn vertrokken en pas later registreren).
- **Validatieregel:** Een start- of eindtijd kan **nooit later liggen dan het actuele moment van registratie**. Een eindtijd kan bovendien niet vóór de starttijd van de rit liggen.

### 3. Direct afsluiten zonder pop-ups
- Registraties en afsluitingen verlopen via overzichtelijke in-page formulieren zonder storende dialoogvensters of dubbele pop-up bevestigingen.
- Eén klik op *"Rit direct afsluiten"* volstaat om de kilometers op te slaan en de wagen vrij te geven.

### 4. Afscherming per Team / Wagenpark
- Medewerkers zien uitsluitend de bedrijfswagens van de teams/afdelingen waaraan zij zijn toegewezen.
- Medewerkers kunnen aan één of meerdere teams worden gekoppeld.

### 5. QR-code per Wagen (Stickers scannen)
- Voor elke wagen in het wagenpark kan de beheerder met één klik een **QR-code sticker** genereren en downloaden of afdrukken.
- De QR-code wordt in de wagen gekleefd (op dashboard of ruit).
- Wanneer een medewerker de QR-code met zijn smartphone scant:
  - Indien de medewerker al een openstaande rit heeft voor die wagen: opent direct het scherm om de rit **direct af te sluiten**.
  - Indien er nog geen rit actief is: opent direct het scherm om een **nieuwe rit te starten** met die wagen vooraf geselecteerd.

### 6. Configureerbare Ritdoelen (Tags)
- Beheerders kunnen via het tabblad **Ritdoelen & Richtgetal** naar wens tags toevoegen, bewerken, verwijderen of resetten naar de standaardlijst.
- Wijzigingen zijn onmiddellijk realtime beschikbaar voor alle medewerkers als snelle touch-knoppen bij het starten van een rit.

### 7. Detectie van Kilometer-afwijkingen (KM-sprongen)
- Als een rit start met een kilometerstand die verschilt van de vorige afgesloten stand van die wagen (bijv. door een vergeten rit of overgeslagen registratie), detecteert het systeem dit verschil automatisch.
- **Geen hinder voor de gebruiker:** de medewerker kan gewoon vertrekken en hoeft zich geen zorgen te maken.
- **Zichtbaar voor de beheerder:** in het dagoverzicht, zoekscherm en beheerpaneel wordt een duidelijke waarschuwing getoond met het exacte aantal kilometers afwijking.

### 8. Richtgetal dagelijkse kilometers (Typefout-preventie)
- Zowel organisatie-breed als per specifieke wagen kan een richtgetal (bv. 50 km) worden ingesteld.
- Als een medewerker per ongeluk een typefout maakt bij het afsluiten (bijv. 100 km ingeeft terwijl 30 km gebruikelijk is), toont de app direct een vriendelijke waarschuwingsbanner ter controle.
- Ook beheerders kunnen in het overzicht filteren op ritten die het richtgetal overschrijden.

### 9. Module Vervoer Zoeken (Collega's Oppikken)
- **Aan- en uitschakelbaar:** De beheerder kan deze module naar wens in- of uitschakelen via het Beheerpaneel (Instellingen).
- **Vervoer zoeken knop:** Naast "Nieuwe rit" verschijnt de knop "Vervoer zoeken".
- **Formulierinvoer:**
  - *Waar je nu bent (vertreklocatie):* dropdown met dezelfde ritdoelen/locaties als de ritten, inclusief optie voor vrije tekstinvoer.
  - *Naar waar je moet (bestemming):* dropdown met dezelfde ritdoelen/locaties + optie voor vrije invoer.
  - *Materiaal meevervoeren:* vinkje *"Ik heb materiaal bij dat mee vervoerd moet worden"*, zodat chauffeurs weten dat er koffers of gereedschap meemoeten.
- **Pushmelding naar actieve chauffeurs:**
  - Iedereen die op dat moment een wagen in bezit heeft (`open rit`), ontvangt direct een gerichte pushmelding.
  - Bij het openen van de melding belandt de chauffeur op de ophaalpagina met route- en materiaalgegevens.
  - **Aankomsttijd (ETA) selectie:** Keuze uit snelle knoppen voor **5m**, **10m**, **15m** of een **eigen waarde** in minuten.
- **Bevestiging & automatische herhaling:**
  - Zodra een chauffeur accepteert, ontvangt de aanvrager direct een pushmelding met de naam van de chauffeur, nummerplaat, wagen en de geschatte aankomsttijd.
  - **5-minuten timer:** Indien niemand reageert, stuurt de achtergrondservice na 5 minuten automatisch een herinneringspushmelding naar de chauffeurs totdat er vervoer is gevonden.

---

## Rollen & Bevoegdheden (Strikte Hiërarchie)

Het systeem hanteert een strikte rolhiërarchie: **Gebruiker < Wagen Administrator < Systeem Administrator**:

| Rol | Rechten & Mogelijkheden |
|---|---|
| **1. Medewerker / Bestuurder** (`user`) | - Inloggen via Google Account of gastprofiel<br>- Ziet enkel actieve wagens van de eigen toegewezen teams<br>- Nieuwe rit starten met starttijd, startkm en ritdoel<br>- Eigen openstaande rit direct afsluiten met stopkm<br>- Dagelijkse kilometerstanden invoeren (ochtend/avond)<br>- Eigen rithistoriek en daglogboeken raadplegen<br>- **Eigen gefilterde ritten direct exporteren naar CSV** in het zoekscherm<br>- Persoonlijke wekelijkse herinneringen instellen |
| **2. Wagen Administrator** (`fleet_admin`) | - Alle rechten van een medewerker<br>- **Strikte team-afscherming:** Heeft **enkel toegang tot de wagens en ritten van zijn eigen team(s)**. Kan geen wagens of ritten van andere teams inkijken of beheren.<br>- Wagens van het eigen team beheren (toevoegen, bewerken, activeren/deactiveren, QR-code stickers genereren)<br>- Openstaande ritten van het eigen team inzien en vergeten ritten handmatig afsluiten met stopkm, stoptijd en reden<br>- Dagelijks daglogboek raadplegen voor de eigen teamwagens<br>- Gefilterde ritten van het eigen team exporteren naar CSV<br>- Medewerkers koppelen aan de eigen teams en rollen beheren tot niveau `fleet_admin`<br>- **Veiligheidsbeperking:** Een Wagen Administrator mag **nooit** de rechten van een `admin` (Systeem Administrator) toekennen, intrekken of wijzigen. |
| **3. Systeem Administrator** (`admin`) | - Alle rechten van een Wagen Administrator<br>- **Exclusieve globale toegang:** Als **enige rol** bevoegd om alle wagens, teams en ritten van de gehele organisatie in te kijken en te beheren.<br>- Aparte groepen en teams definiëren (bijv. *Bouw & Montage*, *Service & Onderhoud*, *Centraal Wagenpark*)<br>- Wagens toewijzen en herverdelen over alle teams<br>- Als enige de rol `admin` (Systeem Administrator) toekennen of intrekken<br>- Volledig overzicht en beheer over alle wagenparken en profielen van de organisatie |

---

## Gebruikte Technologieën

- **Frontend & PWA Framework:** React 19 (Functional Components, Hooks)
  - Volledige **Progressive Web App (PWA)** met Service Worker caching en installatiemogelijkheid voor iPhone, Android en Desktop.
  - Offline fallback ondersteuning.
- **Programmeertaal:** TypeScript (strikte type safety en relationele datamodellen).
- **Build Tooling:** Vite 8 met HMR-optimalisaties.
- **Styling:** Tailwind CSS v4 (sobere, professionele UI, geoptimaliseerd voor touch-interfaces).
- **Iconen:** Lucide React.
- **Database & Data-opslag:** MariaDB (Relationele SQL Database)
  - SQL DDL migratiescript in `src/db/schema.sql` met automatische tabelinitialisatie en indexen.
  - Atomische ritoverdrachten via SQL-transacties (`conn.beginTransaction()`, `conn.commit()`, `conn.rollback()`).
  - Tweetraps veerkrachtige fallback-modus (`.mariadb_local_store.json`), waardoor de applicatie altijd beschikbaar blijft, zelfs als de databaseverbinding offline is.
- **Full-stack Backend & API:** Node.js, Express, officiële `mariadb` driver met connection pool.
- **Realtime Synchronisatie:** Native HTTP Server-Sent Events (`/api/events`), waardoor ritten en voertuigstatussen direct live worden bijgewerkt op alle geopende schermen zonder polling.
- **Authenticatie:** Google Identity Provider (Google OAuth) / Firebase Auth met rollensysteem (`user`, `fleet_admin`, `admin`).
- **Data Export:** CSV-exporteur met UTF-8 BOM ondersteuning voor Microsoft Excel.
- **Achtergrondservice & Pushmeldingen (Stap 2):** Node.js, Express, `web-push` met VAPID-authenticatie
  - 24/7 Server Cron ticker (Europe/Brussels) die ingestelde herinneringen controleert.
  - Directe push naar Apple (APNs) en Google (FCM) push-servers, ook wanneer de smartphone vergrendeld is en de browser gesloten.
  - Automatische herhalende meldingen voor de module *Vervoer Zoeken* (collega oppikken met verwachte aankomsttijd).

---

## Installatie- & Ontwikkelgids

### Vereisten
- [Node.js](https://nodejs.org/) versie 20 of hoger
- [npm](https://www.npmjs.com/) (meegeleverd met Node.js)
- [MariaDB](https://mariadb.org/) versie 10.5+ of 11.x (lokaal, Docker of remote)

### 1. Repository klonen en afhankelijkheden installeren
```bash
# Ga naar de projectmap
cd ritten-logboek

# Installeer de benodigde npm packages
npm install
```

### 2. MariaDB Configuratie (.env)
Maak in de hoofdmap een `.env` bestand aan (zie ook `.env.example`):

```env
# MariaDB Verbindingsparameters
MARIADB_HOST=0.tcp.eu.ngrok.io   # Uw domeinnaam, IP of ngrok host (zonder tcp://)
MARIADB_PORT=24206               # Standaard 3306, of de poort van uw tunnel
MARIADB_USER=admin               # Uw databasegebruiker
MARIADB_PASSWORD=uw_wachtwoord   # Uw databasewachtwoord
MARIADB_DATABASE=RittenLogger    # De naam van uw database
MARIADB_SSL=false                # Zet op true indien SSL/TLS vereist is
```

#### Lokale MariaDB koppelen via Ngrok
Wilt u de app in de cloud laten verbinden met een lokale MariaDB op uw computer?
1. **Zorg dat MariaDB luistert op alle netwerkpoorten:**
   In uw `my.ini` (Windows) of `my.cnf` (Linux/Mac):
   ```ini
   bind-address = 0.0.0.0
   ```
2. **Geef de gebruiker toegang vanop afstand (%):**
   Voer in phpMyAdmin of uw MySQL-terminal uit:
   ```sql
   CREATE USER IF NOT EXISTS 'admin'@'%' IDENTIFIED BY 'uw_wachtwoord';
   GRANT ALL PRIVILEGES ON RittenLogger.* TO 'admin'@'%';
   FLUSH PRIVILEGES;
   ```
3. **Start de ngrok tunnel:**
   ```bash
   ngrok tcp 3306
   ```
   Ngrok geeft u een forwarding URL zoals `tcp://0.tcp.eu.ngrok.io:24206`. Vul `0.tcp.eu.ngrok.io` in bij `MARIADB_HOST` en `24206` bij `MARIADB_PORT`.
4. **Verbinding testen:**
   Ga in de app naar **Instellingen & Account** en klik bij de MariaDB-kaart op **"Verbinding testen"**.

### 3. Ontwikkelserver starten
```bash
npm run dev
```
De applicatie is vervolgens toegankelijk op `http://localhost:3000`.

### 4. Productie-build uitvoeren
```bash
npm run build
```
Dit compileert de TypeScript-code en bundleert de geoptimaliseerde statische bestanden naar de map `dist/`.

### 5. Type-checking & Code Quality
```bash
npm run lint
```

---

## Hosten met Docker & Docker Compose

Voor eenvoudige, betrouwbare hosting op een Linux-server, Synology NAS, VPS of lokale computer is een complete Docker-configuratie voorzien (`Dockerfile`, `docker-compose.yml`, `.dockerignore` en `.env.docker.example`).

### Snelle Start in 1 Commando
Voer in de hoofdmap van het project uit:

```bash
docker compose up -d --build
```

Dit start automatisch drie gekoppelde containers op:
1. **`wagenrit_app`** (poort `3000`): De gecompileerde Node.js Express server met React PWA.
2. **`wagenrit_mariadb`** (poort `3306`): De MariaDB 11 server met permanente data-opslag op het volume `mariadb_data`.
3. **`wagenrit_phpmyadmin`** (poort `8080`): Visuele beheertool in uw webbrowser om tabellen en data in te zien.

### Automatische database-initialisatie
Bij de allereerste keer dat `docker compose up` wordt uitgevoerd, koppelt Docker het SQL-schema `src/db/schema.sql` automatisch aan `/docker-entrypoint-initdb.d/01_schema.sql`. Alle tabellen, indexen en relaties worden direct aangemaakt. U hoeft geen handmatige SQL-scripts uit te voeren!

### Toegankelijkheid na opstarten
- **WagenRit Applicatie:** [http://localhost:3000](http://localhost:3000)
- **phpMyAdmin Database Beheer:** [http://localhost:8080](http://localhost:8080)
  - Gebruiker: `wagenrit_user` (of `root`)
  - Wachtwoord: `wagenrit_secret_pass` (of `root_secret_pass`)
- **MariaDB Directe Poort:** `localhost:3306`

### Eigen poorten of wachtwoorden instellen
Kopieer optioneel het bestand `.env.docker.example` naar `.env`:
```bash
cp .env.docker.example .env
```
Pas in `.env` naar wens de poorten (`APP_PORT`, `DB_PORT`, `PMA_PORT`) of wachtwoorden aan.

### Nuttige Docker commando's
```bash
# Containers stoppen
docker compose down

# Logs van de applicatie bekijken
docker compose logs -f app

# Status van containers controleren
docker compose ps

# Containers herstarten na code-updates
docker compose up -d --build
```

---

## Handleiding voor Medewerkers

### Een nieuwe rit starten
1. Navigeer in het menu naar **Nieuwe rit** (of klik op het dashboard bij afwezigheid van een openstaande rit).
2. Kies de gewenste bedrijfswagen uit de lijst van jouw team.
3. Controleer de **Starttijd**: standaard staat *Nu* ingevuld. Indien je al bent weggereden, pas je het tijdstip eenvoudig aan of kies je een snelknop (*-15 min*, *-30 min*).
4. Vul de **Startkilometerstand** in (standaard staat de laatst bekende kilometerstand vooraf ingevuld).
5. Kies of typ het **Doel van de rit** (bijv. *Klantbezoek*, *Materiaal ophalen*, *Interventie*).
6. Klik op **Rit starten**. De rit is direct actief op jouw dashboard.

### Een rit afsluiten
1. Open de applicatie. Bovenin jouw dashboard staat de actieve kaart **Mijn openstaande rit**.
2. Klik op de groene knop **Rit afsluiten**.
3. Controleer de **Eindtijd** en pas deze aan indien je al eerder bent gestopt.
4. Voer de **Stopkilometerstand** in. Het aantal gereden kilometers wordt live berekend.
5. Vul eventueel een opmerking in (bijv. *"Wagen getankt"*).
6. Klik op **Rit direct afsluiten**. De rit wordt onmiddellijk opgeslagen en de wagen is direct beschikbaar voor de volgende collega.

### Dagregistratie & Herinneringen (Mobiele Pushberichten)
- Onder het tabblad **Dagstand** kun je dagelijks een beginstand (ochtend) of eindstand (avond) vastleggen.
- **Wekelijkse Pushmeldingen naar je gsm:**
  - Stel persoonlijke herinneringen in per weekdag (bijvoorbeeld maandag t/m vrijdag om 07:30 en 17:30).
  - Ontvang automatisch een pushmelding op je smartphone op het ingestelde vertrekuur met de tekst:
    > *"Tijd voor vertrek! Vergeet je startkilometerstand voor je gebruikte wagen niet te noteren."*
  - 's Avonds ontvang je een herinnering om de stopkilometerstand te noteren.
  - **iPhone (iOS 16.4+) tip:** Tik in Safari onderaan op het **Deel**-icoon en kies **Zet op beginscherm**. Open de app vanaf je beginscherm om pushnotificaties direct op je toestel te activeren.
  - **Android tip:** Druk in Chrome op *"Toevoegen aan startscherm"* of activeer pushmeldingen met één klik via de knop *"Pushmeldingen inschakelen op dit toestel"*.


---

## Handleiding voor Beheerders

### Dagoverzicht & Ritloggings per datum
1. Klik in het menu op **Zoeken** of kies op het dashboard voor **Daglogboek raadplegen**.
2. Standaard opent het **Dagoverzicht** voor *Vandaag*.
3. Gebruik de knoppen `< Vorige dag`, `Volgende dag >` of de kalender om elke willekeurige datum te inspecteren.
4. U ziet direct een chronologisch overzicht van alle ritten van die dag met:
   - Bestuurder, wagen, nummerplaat en afdeling
   - Exacte start- en stoptijden en gereden kilometers
   - Status (normaal afgesloten of automatisch overgedragen)
5. Klik op **Exporteer deze dag** om een CSV-rapport van die specifieke dag te downloaden.

### Vergeten ritten handmatig afsluiten
1. Ga naar **Beheer** > tabblad **Openstaande ritten**.
2. Klik bij de betreffende rit op **Vergeten rit handmatig afsluiten**.
3. Voer de juiste stopkilometerstand, het werkelijke stoptijdstip en de reden van handmatige interventie in.
4. De rit krijgt de status *Afgesloten* met een duidelijke vermelding van de beheerder en reden.

### Groepen, Teams en Wagenparken beheren (Systeembeheer)
1. Ga naar **Beheer** > tabblad **Groepen & Teams**.
2. Maak een nieuw team aan (bijv. *"Regio Antwerpen"*).
3. Ga naar het tabblad **Wagens** en koppel de gewenste wagens aan dit team.
4. Ga naar het tabblad **Gebruikers** en vink bij de gewenste medewerkers het team aan. Vanaf dat moment zien die medewerkers uitsluitend de wagens van dat team.

---

## Datamodel & Beveiliging

Het relationele database-schema is gedefinieerd in **`src/db/schema.sql`** en wordt bij de eerste verbinding automatisch aangemaakt.

### Tabellen in MariaDB
- **`teams`**: Bedrijfsafdelingen en wagenparkteams (`id`, `name`, `description`, `is_active`, `created_at`).
- **`profiles`**: Gebruikersprofielen en toegangsrollen (`id`, `full_name`, `email`, `role`, `team_ids` (JSON), `is_active`, `created_at`).
- **`vehicles`**: Bedrijfswagens (`id`, `team_id`, `license_plate`, `brand`, `model`, `nickname`, `is_active`, `last_known_km`, `expected_daily_km`, `created_at`).
- **`trips`**: Volledig rittenlogboek (`id`, `team_id`, `vehicle_id`, `user_id`, `user_name`, `user_email`, `license_plate`, `vehicle_name`, `start_time`, `start_km`, `end_time`, `end_km`, `purpose`, `notes`, `status`, `closed_automatically`, `closed_reason`, `closed_by_user_id`, `closed_by_user_name`, `km_discrepancy`, `has_km_discrepancy`, `is_unusual_distance`, `expected_trip_km`, `created_at`, `updated_at`).
- **`daily_readings`**: Dagelijkse kilometerstand-controles (`id`, `team_id`, `vehicle_id`, `user_id`, `user_name`, `reading_date`, `reading_type`, `km`, `recorded_at`, `created_at`).
- **`app_settings`**: Globale instellingen (`id`, `purposes_json`, `default_expected_daily_km`, `ride_request_module_enabled`, `updated_at`).
- **`ride_requests`**: Vervoersaanvragen voor collega-oppikmodule (`id`, `requester_id`, `requester_name`, `requester_phone`, `team_id`, `from_location`, `to_location`, `has_materials`, `notes`, `status`, `created_at`, `last_notified_at`, `retry_count`, `driver_id`, `driver_name`, `driver_vehicle_id`, `driver_license_plate`, `driver_vehicle_name`, `eta_minutes`, `accepted_at`).
- **`push_subscriptions`**: Web Push registraties van mobiele apparaten voor achtergrondnotificaties (`id`, `user_id`, `user_name`, `subscription_json`, `created_at`, `updated_at`).

### Beveiliging & Transacties
- **SQL Transacties:** De automatische overdracht van ritten wordt atomisch uitgevoerd met `BEGIN TRANSACTION`, `COMMIT` en `ROLLBACK`, waardoor dubbele actieve ritten per wagen strikt onmogelijk zijn.
- **Data Proxy:** De browser/PWA communiceert uitsluitend via HTTPS REST API routes (`/api/*`), waardoor databasetokens en SQL-credentials veilig op de backend blijven.

---

## Licentie

Gedistribueerd onder de **Apache-2.0** licentie.
