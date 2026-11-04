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
6. [Handleiding voor Medewerkers](#handleiding-voor-medewerkers)
7. [Handleiding voor Beheerders](#handleiding-voor-beheerders)
8. [Datamodel & Beveiliging](#datamodel--beveiliging)

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
- De overdracht gebeurt **atomisch en server-side** (via Firestore transacties), waardoor race conditions worden uitgesloten.

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

---

## Rollen & Bevoegdheden

Het systeem kent 3 duidelijk gescheiden rollen:

| Rol | Rechten & Mogelijkheden |
|---|---|
| **1. Medewerker / Bestuurder** (`user`) | - Inloggen via Google Account of gastprofiel<br>- Ziet enkel actieve wagens van de eigen toegewezen teams<br>- Nieuwe rit starten met starttijd, startkm en ritdoel<br>- Eigen openstaande rit direct afsluiten met stopkm<br>- Dagelijkse kilometerstanden invoeren (ochtend/avond)<br>- Eigen rithistoriek en gereden kilometers raadplegen<br>- Persoonlijke wekelijkse herinneringen instellen |
| **2. Wagen Administrator** (`fleet_admin`) | - Alle rechten van een medewerker<br>- Wagens van het wagenpark beheren (toevoegen, bewerken, activeren/deactiveren)<br>- Openstaande ritten inzien en vergeten ritten handmatig afsluiten met stopkm, stoptijd en reden<br>- Dagelijks daglogboek raadplegen (alle ritten van een gekozen datum)<br>- Volledig rittenoverzicht met filters doorzoeken en exporteren naar CSV<br>- Medewerkers toewijzen aan wagenparken |
| **3. Systeem / Groeps-Administrator** (`admin`) | - Alle rechten van een Wagen Administrator<br>- Aparte groepen en teams definiëren (bijv. *Bouw & Montage*, *Service & Onderhoud*, *Centraal Wagenpark*)<br>- Wagens toewijzen aan specifieke groepen/teams<br>- Rollen toekennen aan gebruikers (`user`, `fleet_admin`, `admin`)<br>- Volledig overzicht over alle wagenparken van de organisatie |

---

## Gebruikte Technologieën

- **Frontend Framework:** React 19 (Functional Components, Hooks)
- **Programmeertaal:** TypeScript (strikte type safety en data models)
- **Build Tooling:** Vite 8 met HMR-optimalisaties
- **Styling:** Tailwind CSS v4 (sobere, professionele UI, geoptimaliseerd voor touch-interfaces)
- **Iconen:** Lucide React
- **Database & Realtime Backend:** Google Cloud Firestore (Enterprise Edition)
  - Realtime synchronisatie via `onSnapshot` listeners
  - Atomische ritoverdrachten via `runTransaction`
  - Beveiligingsregels via `firestore.rules`
- **Authenticatie:** Firebase Authentication met Google Identity Provider (Google OAuth)
- **Data Export:** CSV-exporteur met UTF-8 BOM ondersteuning voor Microsoft Excel

---

## Installatie- & Ontwikkelgids

### Vereisten
- [Node.js](https://nodejs.org/) versie 20 of hoger
- [npm](https://www.npmjs.com/) (meegeleverd met Node.js)

### 1. Repository klonen en afhankelijkheden installeren
```bash
# Ga naar de projectmap
cd ritten-logboek

# Installeer de benodigde npm packages
npm install
```

### 2. Firebase Configuratie
Het project bevat het configuratiebestand `firebase-applet-config.json` in de hoofdmap van het project:
```json
{
  "projectId": "ambient-option-2fx4d",
  "appId": "1:71388204634:web:73265bc375827c5bb21263",
  "apiKey": "AIzaSy...",
  "authDomain": "ambient-option-2fx4d.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-rittenlogboek-2fcfca51-ee68-43ed-a0fb-72736e04a0f7"
}
```
*Opmerking:* Bij gebruik in Google AI Studio wordt deze configuratie automatisch beheerd.

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

### Dagregistratie & Herinneringen
- Onder het tabblad **Dagstand** kun je dagelijks een beginstand (ochtend) of eindstand (avond) vastleggen.
- Stel persoonlijke herinneringen in per weekdag (bijvoorbeeld maandag t/m vrijdag om 07:30 en 17:30).

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

### Collecties in Firestore
- `profiles/{userId}`: Gebruikersprofielen met `fullName`, `email`, `role` (`user` \| `fleet_admin` \| `admin`), `teamIds` (array van strings) en `isActive`.
- `teams/{teamId}`: Teams en afdelingen met `name`, `description` en `isActive`.
- `vehicles/{vehicleId}`: Wagenpark met `teamId`, `licensePlate`, `brand`, `model`, `nickname`, `lastKnownKm` en `isActive`.
- `trips/{tripId}`: Rittenlogboek met `vehicleId`, `userId`, `startTime`, `startKm`, `endTime`, `endKm`, `purpose`, `status` (`open` \| `closed` \| `auto_closed`), `closedAutomatically`, `closedReason` en timestamps.
- `daily_readings/{readingId}`: Dagelijkse kilometerstand-controles (`start` of `stop`).
- `notification_settings/{userId}`: Wekelijkse herinneringstijden per weekdag.

### Beveiliging
De Firestore-database wordt beschermd door beveiligingsregels in `firestore.rules`. Alleen geverifieerde verzoeken worden verwerkt, en beheeracties (zoals teamcreatie of gebruikersrechten) zijn voorbehouden aan beheerders.

---

## Licentie

Gedistribueerd onder de **Apache-2.0** licentie.
