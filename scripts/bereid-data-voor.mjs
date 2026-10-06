#!/usr/bin/env node
/**
 * Zet de ruwe exports (RvIG/BRP, BSN-nummeraanduidingen, KVK) om naar compacte, gekoppelde CSV's voor de app.
 *
 * Gebruik:  node scripts/bereid-data-voor.mjs <map-met-bronbestanden> [uitvoermap]
 *
 * Verwachte bronbestanden (een voorvoegsel zoals "1221308f-" in de naam mag):
 *   BRP_Alle_PLen_1.csv                     persoonslijsten (cat. 01, 05, 08, 09)
 *   BRP_Pl_data_samengevat.csv              gemeentenaam per persoonslijst
 *   BSN_nummeraanduidingen.csv              bsn -> BAG-nummeraanduiding (woonadres = BRP, objectadres = Kadaster)
 *   DimBezoekadressenVestigingenActueel.csv KVK-bezoekadressen met BAG-nummeraanduiding
 *   Ondernemingen.csv                       KVK-ondernemingen met AdresID
 *
 * Koppelsleutel tussen de registraties is de BAG-nummeraanduiding (16 cijfers).
 */
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const [bronMap, uitMap = 'public/data'] = process.argv.slice(2);
if (!bronMap) {
  console.error('Gebruik: node scripts/bereid-data-voor.mjs <map-met-bronbestanden> [uitvoermap]');
  process.exit(1);
}

if (!fs.existsSync(bronMap) || !fs.statSync(bronMap).isDirectory()) {
  console.error(`De map "${bronMap}" bestaat niet. Maak hem aan en zet de vijf bronbestanden (CSV) erin.`);
  process.exit(1);
}

/** Vergelijkt bestandsnamen los van hoofdletters, spaties/underscores, voorvoegsels ("1221308f-") en kopie-nummers (" (1)"). */
const sleutel = (bestand) =>
  bestand
    .toLowerCase()
    .replace(/\.csv$/, '')
    .replace(/\s*\(\d+\)$/, '')
    .replace(/[\s_-]+/g, '');

function vind(naam) {
  const gezocht = sleutel(naam);
  const csvs = fs.readdirSync(bronMap).filter((x) => /\.csv$/i.test(x));
  const f = csvs.find((x) => sleutel(x) === gezocht) ?? csvs.find((x) => sleutel(x).endsWith(gezocht));
  if (!f) {
    console.error(`Bronbestand ${naam} niet gevonden in ${bronMap}.`);
    console.error(csvs.length ? `Gevonden CSV-bestanden:\n  ${csvs.join('\n  ')}` : 'Er staan geen CSV-bestanden in deze map.');
    process.exit(1);
  }
  return path.join(bronMap, f);
}

function lees(naam) {
  const tekst = fs.readFileSync(vind(naam), 'utf8').replace(/^﻿/, '');
  return Papa.parse(tekst, { header: true, skipEmptyLines: true, delimitersToGuess: [';', ','] }).data;
}

function schrijf(naam, rijen, kolommen) {
  fs.mkdirSync(uitMap, { recursive: true });
  const csv = Papa.unparse({ fields: kolommen, data: rijen.map((r) => kolommen.map((k) => r[k] ?? '')) }, { delimiter: ';' });
  fs.writeFileSync(path.join(uitMap, naam), csv + '\n');
  console.log(`${naam}: ${rijen.length} rijen`);
}

/** jjjjmmdd -> jjjj-mm-dd; onbekende delen (00) leveren een lege waarde op. */
const isoDatum = (d = '') => (/^\d{8}$/.test(d) && !d.endsWith('00') && d.slice(4, 6) !== '00' ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : '');
const naam = (...delen) => delen.filter(Boolean).join(' ');

// ---------- RvIG: BRP ----------
const P = '01_Persoon_';
const H = '05_Huwelijk_';
const V = '08_Verblijfplaats_';
const K = '09_Kind_';

const samengevat = new Map(lees('BRP_Pl_data_samengevat.csv').map((r) => [r.pl, r]));
const plen = new Map(); // pl -> { persoon, verblijf, partners[], kinderen[] }
for (const r of lees('BRP_Alle_PLen_1.csv')) {
  const pl = plen.get(r.pl) ?? { partners: [], kinderen: [] };
  plen.set(r.pl, pl);
  // Versie V0001 is de actuele persoonslijst; oudere versies (V0002, ...) zijn historie.
  if (r.c01_ID && r.c01_ID.includes('_V0001_')) pl.persoon = r;
  // De eerste categorie 08 is de actuele verblijfplaats (zelfde als adresID in de samenvatting).
  if (r.c08_ID && !pl.verblijf) pl.verblijf = r;
  if (r[`${H}02_Naam_Geslachtsnaam`] && !r[`${H}07_Ontbinding_Datum_ontbinding`]) pl.partners.push(r);
  if (r[`${K}01_Identificatienummers_Burgerservicenummer`]) pl.kinderen.push(r[`${K}01_Identificatienummers_Burgerservicenummer`]);
}

const adressen = new Map(); // nummeraanduiding -> adres
const personen = [];
for (const [plNr, { persoon: p, verblijf: v, partners, kinderen }] of plen) {
  const bsn = p?.[`${P}01_Identificatienummers_Burgerservicenummer`];
  const na = v?.[`${V}11_Adres_Identificatiecode_nummeraanduiding`];
  if (!bsn || !na || !v[`${V}11_Adres_Postcode`]) continue;
  const gemeente = samengevat.get(plNr)?.gemeentenaam ?? '';
  if (!adressen.has(na))
    adressen.set(na, {
      nummeraanduiding: na,
      straat: v[`${V}11_Adres_Straatnaam`],
      huisnummer: v[`${V}11_Adres_Huisnummer`],
      huisletter: v[`${V}11_Adres_Huisletter`],
      toevoeging: v[`${V}11_Adres_Huisnummertoevoeging`],
      postcode: v[`${V}11_Adres_Postcode`],
      plaats: v[`${V}11_Adres_Woonplaatsnaam`] || gemeente,
      gemeente,
      gebruiksdoel: '',
      bron: 'BRP',
    });
  const partner = partners[0];
  personen.push({
    bsn,
    voornamen: p[`${P}02_Naam_Voornamen`],
    voorvoegsel: p[`${P}02_Naam_Voorvoegsel_geslachtsnaam`],
    geslachtsnaam: p[`${P}02_Naam_Geslachtsnaam`],
    geboortedatum: isoDatum(p[`${P}03_Geboorte_Geboortedatum`]),
    geslacht: p[`${P}04_Geslacht_Geslachtsaanduiding`],
    nummeraanduiding: na,
    adres_sinds: isoDatum(v[`${V}10_Adreshouding_Datum_aanvang_adreshouding`]) || isoDatum(v[`${V}09_Gemeente_Datum_inschrijving`]),
    gemeentecode: v[`${V}09_Gemeente_Gemeente_van_inschrijving`],
    gemeente,
    partner_bsn: partner?.[`${H}01_Identificatienummers_Burgerservicenummer`] ?? '',
    partner_naam: partner ? naam(partner[`${H}02_Naam_Voornamen`], partner[`${H}02_Naam_Voorvoegsel_geslachtsnaam`], partner[`${H}02_Naam_Geslachtsnaam`]) : '',
    kinderen_bsn: kinderen.join(','),
  });
}

// Gezinsleden die op hetzelfde adres wonen: partner en kinderen uit de persoonslijst.
const perBsn = new Map(personen.map((p) => [p.bsn, p]));
for (const p of personen) {
  const kandidaten = [p.partner_bsn, ...p.kinderen_bsn.split(',')].filter(Boolean);
  p.gezinsleden_op_adres = [...new Set(kandidaten)]
    .map((b) => perBsn.get(b))
    .filter((g) => g && g.nummeraanduiding === p.nummeraanduiding)
    .map((g) => `${naam(g.voornamen, g.voorvoegsel, g.geslachtsnaam)} (${g.bsn})`)
    .join('|');
}

// ---------- Kadaster: objecten in eigendom (objectadres) ----------
const bekendeBsn = new Set(personen.map((p) => p.bsn));
const relaties = lees('BSN_nummeraanduidingen.csv');
const eigendom = relaties
  .filter((r) => r.relatie === 'objectadres' && bekendeBsn.has(r.bsn))
  .map((r) => ({ bsn: r.bsn, nummeraanduiding: r.nummeraanduiding, brp_toegewezen: r.brp_toegewezen }));

// ---------- KVK ----------
const kvkAdressen = new Map(lees('DimBezoekadressenVestigingenActueel.csv').map((a) => [a.AdresID, a]));
for (const a of kvkAdressen.values()) {
  const na = a.BagIDNummeraanduiding;
  if (!na) continue;
  const bestaand = adressen.get(na);
  if (bestaand) {
    // BRP-adres blijft leidend; neem alleen het gebruiksdoel uit de BAG-gegevens over.
    if (!bestaand.gebruiksdoel) bestaand.gebruiksdoel = a.BagGebruiksdoelen ?? '';
    continue;
  }
  adressen.set(na, {
    nummeraanduiding: na,
    straat: a.Straatnaam,
    huisnummer: a.Huisnummer,
    huisletter: a.HuisLetter,
    toevoeging: a.HuisnummerToevoeging,
    postcode: a.Postcode,
    plaats: a.Plaats,
    gemeente: a.Gemeente,
    gebruiksdoel: a.BagGebruiksdoelen ?? '',
    bron: 'KVK',
  });
}

// Alleen actieve vestigingen op een woonadres of eigendomsobject van een persoon zijn relevant voor deze use case.
const relevanteNa = new Set([...personen.map((p) => p.nummeraanduiding), ...eigendom.map((e) => e.nummeraanduiding)]);
const vestigingen = [];
for (const o of lees('Ondernemingen.csv')) {
  const a = kvkAdressen.get(o.AdresID);
  if (o.Actief !== 'Ja' || !a?.BagIDNummeraanduiding || !relevanteNa.has(a.BagIDNummeraanduiding)) continue;
  vestigingen.push({
    kvk_nummer: o.KVKNummer,
    handelsnaam: o.HandelsnaamOnderneming,
    rechtsvorm: o.Rechtsvorm,
    eigenaar_naam: o.NaamNatuurlijkPersoon || o.NaamNietNatuurlijkPersoon,
    activiteit_code: (o.dimActiviteitCode ?? '').trim(),
    activiteit: o.ActiviteitOmschrijving,
    actief: o.Actief,
    datum_aanvang: isoDatum(o.AanvangDatum_MA),
    datum_einde: isoDatum(o.EindDatum_MA),
    faillissement: o.Indicator_Faillissement,
    werkzame_personen: String(Number(o.WPFullTime || 0) + Number(o.WPPartTime || 0)),
    aantal_vestigingen: o.AantalVestigingen,
    adres_id: o.AdresID,
    nummeraanduiding: a.BagIDNummeraanduiding,
  });
}

// Alleen adressen die door een persoon, eigendom of vestiging worden gebruikt.
const gebruikteNa = new Set([...relevanteNa, ...vestigingen.map((v) => v.nummeraanduiding)]);
const adresRijen = [...adressen.values()].filter((a) => gebruikteNa.has(a.nummeraanduiding));

// ---------- Demopersonen voor het hoofdscenario ----------
const adresVan = new Map(adresRijen.map((a) => [a.nummeraanduiding, a]));
const eigendomVan = new Map();
for (const e of eigendom) eigendomVan.set(e.bsn, [...(eigendomVan.get(e.bsn) ?? []), e.nummeraanduiding]);
const vestigingenOp = new Map();
for (const v of vestigingen) vestigingenOp.set(v.nummeraanduiding, [...(vestigingenOp.get(v.nummeraanduiding) ?? []), v]);

const demo = [];
const volwassen = (p) => p.geboortedatum && p.geboortedatum <= '2000-01-01';
// Voorkeur voor een persoon wiens achternaam ook in de naam van de KVK-eigenaar staat.
const achternaamInKvk = (p) =>
  p.geslachtsnaam.length > 2 &&
  (vestigingenOp.get(p.nummeraanduiding) ?? []).some((v) => v.eigenaar_naam.toLowerCase().split(/\s+/).includes(p.geslachtsnaam.toLowerCase()));
const kies = (omschrijving, filter) => {
  const kandidaten = personen.filter((x) => volwassen(x) && !demo.some((d) => d.bsn === x.bsn) && filter(x));
  const p = kandidaten.find(achternaamInKvk) ?? kandidaten[0];
  if (p) demo.push({ bsn: p.bsn, omschrijving });
};
const woningObjecten = (p) => (eigendomVan.get(p.bsn) ?? []).filter((na) => /woon/.test(adresVan.get(na)?.gebruiksdoel ?? ''));
const actieveEmz = (p) => (vestigingenOp.get(p.nummeraanduiding) ?? []).filter((v) => v.actief === 'Ja' && v.rechtsvorm === 'Eenmanszaak');
kies('Huur → koop, eenmanszaak op woonadres', (p) => woningObjecten(p).length === 1 && actieveEmz(p).length === 1 && p.gezinsleden_op_adres === '');
kies('Huur → koop, eenmanszaak op woonadres, met gezin', (p) => woningObjecten(p).length === 1 && actieveEmz(p).length === 1 && p.gezinsleden_op_adres !== '');
kies('Huur → koop, geen actieve onderneming op woonadres', (p) =>
  woningObjecten(p).length === 1 && !vestigingenOp.has(p.nummeraanduiding),
);

schrijf('rvig_brp_personen.csv', personen, [
  'bsn', 'voornamen', 'voorvoegsel', 'geslachtsnaam', 'geboortedatum', 'geslacht', 'nummeraanduiding', 'adres_sinds',
  'gemeentecode', 'gemeente', 'partner_bsn', 'partner_naam', 'gezinsleden_op_adres',
]);
schrijf('bag_adressen.csv', adresRijen, [
  'nummeraanduiding', 'straat', 'huisnummer', 'huisletter', 'toevoeging', 'postcode', 'plaats', 'gemeente', 'gebruiksdoel', 'bron',
]);
schrijf('kadaster_eigendom.csv', eigendom, ['bsn', 'nummeraanduiding', 'brp_toegewezen']);
schrijf('kvk_vestigingen.csv', vestigingen, [
  'kvk_nummer', 'handelsnaam', 'rechtsvorm', 'eigenaar_naam', 'activiteit_code', 'activiteit', 'actief', 'datum_aanvang',
  'datum_einde', 'faillissement', 'werkzame_personen', 'aantal_vestigingen', 'adres_id', 'nummeraanduiding',
]);
schrijf('demo_personen.csv', demo, ['bsn', 'omschrijving']);
