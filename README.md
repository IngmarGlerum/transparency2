# Mijn Overheid – prototype "Verhuizen met één formulier"

Prototype van een overheidswebsite in Rijkshuisstijl (NL Design System / Rijkshuisstijl Community).
Een digitale assistent stelt controlevragen om de situatie en het doel van de gebruiker vast te stellen.
Op basis daarvan wordt links één formulier samengesteld met velden en gegevens uit RvIG (BRP), KVK (Handelsregister) en het Kadaster.

**Use case:** iemand verhuist van een huurwoning naar een koopwoning en heeft een eenmanszaak waarvan het
vestigingsadres op het woonadres staat. Het vestigingsadres verhuist mee.

## Starten

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # productiebuild in dist/
```

## Schermen

1. **Home** (`#/`): header "Welkom op Mijn Overheid" met de knop **Start een proces**.
2. **Proces** (`#/proces`): links het formulier dat stap voor stap wordt samengesteld, rechts de chatbot.
3. **Bevestiging** (`#/bevestiging`): overzicht per organisatie en wat er daarna gebeurt.

## Testpersonen

| Persoon | BSN | Situatie |
|---|---|---|
| Sanne de Vries | 999990548 | **Hoofdscenario:** huur (Kerkstraat 12, Utrecht) → koop (Lindelaan 8, Bilthoven, postcode `3721 AB 8`), eenmanszaak op woonadres |
| Ahmed Bakker | 999990822 | Huur → huur (bijv. `2312 DL 101 A`), geen onderneming |
| Lotte van Dijk | 999991644 | Koop → koop (`6715 PN 17`), onderneming op ander adres (blijft) |

## Data (CSV)

De datasets staan in `public/data/` en worden in de browser ingeladen (scheidingsteken `;`, `,` of tab wordt automatisch herkend; kolomnamen zijn niet hoofdlettergevoelig).

| Bestand | Bron | Belangrijkste kolommen |
|---|---|---|
| `rvig_brp_personen.csv` | RvIG / BRP | `bsn`, `voornamen`, `voorvoegsel`, `geslachtsnaam`, `geboortedatum`, `straat`, `huisnummer`, `huisnummertoevoeging`, `postcode`, `woonplaats` |
| `kvk_handelsregister.csv` | KVK | `kvk_nummer`, `vestigingsnummer`, `handelsnaam`, `rechtsvorm`, `eigenaar_bsn`, `bezoek_*`, `post_*`, `telefoon` |
| `kadaster_objecten.csv` | Kadaster | `kadastrale_aanduiding`, `straat`, `huisnummer`, `toevoeging`, `postcode`, `plaats`, `eigenaar_naam`, `eigenaar_bsn`, `datum_eigendom`, `koopsom`, `hypotheekhouder`, `woz_waarde` |
| `formulier_velden.csv` | Veldencatalogus | zie hieronder |

De huidige bestanden bevatten fictieve voorbeeldgegevens. Vervang ze door de echte datasets; wijken de kolomnamen af,
pas dan de verwijzingen aan in `src/data.ts`, `src/chatbot.ts` en de kolom `prefill` van de veldencatalogus.

### Veldencatalogus (`formulier_velden.csv`)

Elke rij is één formulierveld. Het formulier wordt samengesteld uit alle velden waarvan de **voorwaarde** past bij de situatie.

| Kolom | Betekenis |
|---|---|
| `veld_id` | Unieke sleutel |
| `bron` | `RvIG`, `KVK` of `Kadaster` |
| `sectie` | Blok in het formulier |
| `type` | `text`, `date`, `number`, `postcode`, `tel`, `radio` |
| `verplicht` / `bewerkbaar` | `ja` / `nee`. Een veld zonder waarde uit een registratie is altijd invulbaar. |
| `voorwaarde` | Situatievlag(gen): `altijd`, `verhuizing`, `nieuw_koop`, `nieuw_huur`, `oud_huur`, `oud_koop`, `onderneming_verhuist_mee`. Combineer met `&` (en), `\|` (of), `!` (niet). |
| `prefill` | Pad naar een registratiegegeven, bijv. `persoon.bsn`, `nieuw.adres`, `kadaster_nieuw.koopsom`, `onderneming.handelsnaam`, `situatie.verhuisdatum` |
| `opties` | Keuzes voor `radio`, gescheiden door `\|` |
| `uitleg` | Toelichting onder het label |

## Opbouw

- `src/data.ts`: CSV's laden en zoeken (adressen, BSN-elfproef)
- `src/chatbot.ts`: regelgebaseerde assistent (stappen met controlevragen), bepaalt de situatievlaggen
- `src/situatie.ts`: formulier samenstellen op basis van voorwaarden en vooringevulde gegevens
- `src/components/`: Home, Proces (formulier + chat), Bevestiging, header/footer

## Let op

- De Rijkshuisstijl-tokens mogen volgens de licentie alleen gebruikt worden door (opdrachtnemers van) de centrale overheid.
  Voor ander gebruik kun je een ander NL Design System-thema kiezen.
- Dit is een prototype: er is geen echte DigiD-login en er worden geen gegevens verstuurd.
