# Mijn Overheid – prototype "Verhuizen met één formulier"

Prototype van een overheidswebsite in Rijkshuisstijl (NL Design System / Rijkshuisstijl Community).
Een digitale assistent stelt controlevragen om de situatie en het doel van de gebruiker vast te stellen.
Op basis daarvan wordt links één formulier samengesteld met velden en gegevens uit RvIG (BRP), KVK (Handelsregister) en het Kadaster.

**Use case:** iemand verhuist van een huurwoning naar een koopwoning en heeft een eenmanszaak waarvan het
vestigingsadres op het woonadres staat. Het vestigingsadres verhuist mee.

## Starten

```bash
npm install
npm run data -- <map-met-bronbestanden>   # maakt public/data/*.csv uit de ruwe exports
npm run dev                                # http://localhost:5173
npm run build                              # productiebuild in dist/
```

## Schermen

1. **Home** (`#/`): header "Welkom op Mijn Overheid" met de knop **Start een proces**.
2. **Proces** (`#/proces`): links het formulier dat stap voor stap wordt samengesteld, rechts de chatbot.
3. **Bevestiging** (`#/bevestiging`): overzicht per organisatie en wat er daarna gebeurt.

## Data

### Bronbestanden

De ruwe exports staan **niet** in de repository (ze bevatten BSN's en namen). Zet ze in een eigen map (bijv. `data/bron/`, staat in `.gitignore`) en draai `npm run data -- data/bron`.

| Bestand | Registratie | Gebruik |
|---|---|---|
| `BRP_Alle_PLen_1.csv` | RvIG / BRP | Persoonslijsten: cat. 01 (persoon, versie V0001 = actueel), 05 (partner), 08 (eerste = actuele verblijfplaats), 09 (kinderen) |
| `BRP_Pl_data_samengevat.csv` | RvIG / BRP | Gemeentenaam per persoonslijst |
| `BSN_nummeraanduidingen.csv` | BRP + Kadaster | `woonadres` (bron BRP) en `objectadres` (bron XML, opgevat als **Kadaster-eigendom**) per BSN |
| `DimBezoekadressenVestigingenActueel.csv` | KVK | Bezoekadres van vestigingen met BAG-nummeraanduiding en gebruiksdoel |
| `Ondernemingen.csv` | KVK | Onderneming, rechtsvorm, eigenaar, activiteit, actief; gekoppeld via `AdresID` |

### Koppeling

Alle registraties zijn gekoppeld via de **BAG-nummeraanduiding** (16 cijfers):

- **BRP → woonadres**: de actuele verblijfplaats van de persoon.
- **Kadaster → eigendom**: `objectadres`-regels. Staat de nummeraanduiding van het (nieuwe) adres bij de BSN, dan is het een koopwoning; anders huur.
- **KVK → vestiging op woonadres**: ondernemingen waarvan het bezoekadres dezelfde nummeraanduiding heeft als het woonadres. De assistent vraagt of de onderneming van de gebruiker is.

Bevindingen over de testdata:
- Voor dezelfde nummeraanduiding wijkt de adrestekst in het KVK-bestand af van de BRP. De BRP-tekst is leidend.
- De naam van de KVK-eigenaar komt zelden overeen met de BRP-naam. De assistent meldt dat als controlepunt.
- Er zijn geen koopsom, aktedatum of hypotheekgegevens. Die velden vult de gebruiker zelf in.

### Gegenereerde bestanden (`public/data/`)

| Bestand | Inhoud |
|---|---|
| `rvig_brp_personen.csv` | bsn, naam, geboortedatum, nummeraanduiding, gemeente, partner, gezinsleden op adres |
| `bag_adressen.csv` | nummeraanduiding → straat, huisnummer, huisletter, toevoeging, postcode, plaats, gemeente, gebruiksdoel |
| `kadaster_eigendom.csv` | bsn → nummeraanduiding (objecten in eigendom) |
| `kvk_vestigingen.csv` | actieve ondernemingen met nummeraanduiding van het bezoekadres |
| `demo_personen.csv` | testpersonen voor de snelknoppen in de chat |
| `formulier_velden.csv` | veldencatalogus (wel in git) |

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
| `prefill` | Pad naar een gegeven, bijv. `persoon.bsn`, `huidig.adres`, `nieuw.gemeente`, `kadaster_nieuw.nummeraanduiding`, `onderneming.handelsnaam`, `situatie.verhuisdatum` |
| `opties` | Keuzes voor `radio`, gescheiden door `\|` |
| `uitleg` | Toelichting onder het label |

## Opbouw

- `scripts/bereid-data-voor.mjs`: ruwe exports omzetten en koppelen
- `src/data.ts`: CSV's laden en zoeken (adressen op postcode, eigendom, vestigingen)
- `src/chatbot.ts`: regelgebaseerde assistent (stappen met controlevragen), bepaalt de situatievlaggen
- `src/situatie.ts`: formulier samenstellen op basis van voorwaarden en vooringevulde gegevens
- `src/components/`: Home, Proces (formulier + chat), Bevestiging, header/footer

## Let op

- De Rijkshuisstijl-tokens mogen volgens de licentie alleen gebruikt worden door (opdrachtnemers van) de centrale overheid.
  Voor ander gebruik kun je een ander NL Design System-thema kiezen.
- Dit is een prototype: er is geen echte DigiD-login en er worden geen gegevens verstuurd.
