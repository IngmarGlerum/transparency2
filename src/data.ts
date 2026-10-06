import Papa from 'papaparse';

/** Eén rij uit een CSV-bestand; kolomnamen zijn genormaliseerd naar kleine letters. */
export type Row = Record<string, string>;

export interface Datasets {
  /** RvIG – Basisregistratie Personen, één rij per persoon met actuele verblijfplaats */
  personen: Map<string, Row>;
  /** Adressen per BAG-nummeraanduiding (de koppelsleutel tussen alle registraties) */
  adressen: Map<string, Row>;
  /** Adressen per postcode, om een ingetypt adres op te zoeken */
  adressenPerPostcode: Map<string, Row[]>;
  /** Kadaster – BAG-nummeraanduidingen van objecten in eigendom, per BSN */
  eigendom: Map<string, string[]>;
  /** KVK – actieve vestigingen per BAG-nummeraanduiding */
  vestigingen: Map<string, Row[]>;
  /** Testpersonen voor de demo */
  demo: Row[];
  /** Catalogus van formuliervelden, met bron en voorwaarde */
  velden: VeldDefinitie[];
}

export type VeldType = 'text' | 'date' | 'number' | 'postcode' | 'tel' | 'radio';

export interface VeldDefinitie {
  id: string;
  bron: string;
  sectie: string;
  label: string;
  type: VeldType;
  verplicht: boolean;
  bewerkbaar: boolean;
  voorwaarde: string;
  prefill: string;
  opties: string[];
  uitleg: string;
}

/** Bestanden in public/data. Alle behalve formulier_velden.csv worden gemaakt met `npm run data -- <bronmap>`. */
export const BESTANDEN = {
  personen: 'rvig_brp_personen.csv',
  adressen: 'bag_adressen.csv',
  eigendom: 'kadaster_eigendom.csv',
  vestigingen: 'kvk_vestigingen.csv',
  demo: 'demo_personen.csv',
  velden: 'formulier_velden.csv',
} as const;

async function laadCsv(bestand: string): Promise<Row[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${bestand}`);
  const tekst = res.ok ? await res.text() : '';
  // Vite levert index.html terug voor een ontbrekend bestand.
  if (!res.ok || tekst.trimStart().startsWith('<'))
    throw new Error(`${bestand} ontbreekt. Maak de data aan met: npm run data -- <map-met-bronbestanden>`);
  return Papa.parse<Row>(tekst, {
    header: true,
    skipEmptyLines: 'greedy',
    delimitersToGuess: [';', ',', '\t', '|'],
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
    transform: (v) => v.trim(),
  }).data;
}

const isJa = (v: string | undefined) => /^(ja|j|true|1|yes|y)$/i.test(v ?? '');

function naarVeld(r: Row): VeldDefinitie {
  return {
    id: r.veld_id,
    bron: r.bron,
    sectie: r.sectie,
    label: r.label,
    type: (r.type || 'text') as VeldType,
    verplicht: isJa(r.verplicht),
    bewerkbaar: isJa(r.bewerkbaar),
    voorwaarde: r.voorwaarde || 'altijd',
    prefill: r.prefill ?? '',
    opties: r.opties ? r.opties.split('|').map((o) => o.trim()) : [],
    uitleg: r.uitleg ?? '',
  };
}

function groepeer(rijen: Row[], sleutel: string): Map<string, Row[]> {
  const m = new Map<string, Row[]>();
  for (const r of rijen) m.set(r[sleutel], [...(m.get(r[sleutel]) ?? []), r]);
  return m;
}

export async function laadDatasets(): Promise<Datasets> {
  const [personen, adressen, eigendom, vestigingen, demo, velden] = await Promise.all([
    laadCsv(BESTANDEN.personen),
    laadCsv(BESTANDEN.adressen),
    laadCsv(BESTANDEN.eigendom),
    laadCsv(BESTANDEN.vestigingen),
    laadCsv(BESTANDEN.demo),
    laadCsv(BESTANDEN.velden),
  ]);
  const eigendomPerBsn = new Map<string, string[]>();
  for (const e of eigendom) eigendomPerBsn.set(e.bsn, [...(eigendomPerBsn.get(e.bsn) ?? []), e.nummeraanduiding]);
  return {
    personen: new Map(personen.map((p) => [p.bsn, p])),
    adressen: new Map(adressen.map((a) => [a.nummeraanduiding, a])),
    adressenPerPostcode: groepeer(adressen.map((a) => ({ ...a, postcode: normPostcode(a.postcode) })), 'postcode'),
    eigendom: eigendomPerBsn,
    vestigingen: groepeer(vestigingen, 'nummeraanduiding'),
    demo,
    velden: velden.filter((v) => v.veld_id).map(naarVeld),
  };
}

// ---------- Hulpfuncties voor adressen en personen ----------

export const normPostcode = (p = '') => p.replace(/\s+/g, '').toUpperCase();
export const mooiePostcode = (p = '') => {
  const n = normPostcode(p);
  return n.length === 6 ? `${n.slice(0, 4)} ${n.slice(4)}` : n;
};

export function volledigeNaam(p: Row): string {
  return [p.voornamen, p.voorvoegsel, p.geslachtsnaam].filter(Boolean).join(' ');
}

/** Huisnummer met huisletter en toevoeging, bijvoorbeeld "12 A bis". */
export const huisnummerVolledig = (a: Row) => [a.huisnummer + (a.huisletter ?? ''), a.toevoeging].filter(Boolean).join(' ');

export const adresTekst = (a: Row | undefined) =>
  a ? `${a.straat} ${huisnummerVolledig(a)}, ${mooiePostcode(a.postcode)} ${a.plaats}` : '';

export const woonadres = (d: Datasets, p: Row) => d.adressen.get(p.nummeraanduiding);
export const eigendomVan = (d: Datasets, bsn: string) => d.eigendom.get(bsn) ?? [];
export const isEigenaar = (d: Datasets, bsn: string, nummeraanduiding: string) => eigendomVan(d, bsn).includes(nummeraanduiding);

/** Zoekt een adres op postcode en huisnummer (met eventuele huisletter/toevoeging). Adressen in eigendom gaan voor. */
export function zoekAdres(d: Datasets, postcode: string, nr: string, rest = '', bsn?: string): Row | undefined {
  const kandidaten = (d.adressenPerPostcode.get(normPostcode(postcode)) ?? []).filter((a) => a.huisnummer === nr);
  const r = rest.replace(/\s+/g, '').toLowerCase();
  const passend = kandidaten.filter((a) => !r || `${a.huisletter ?? ''}${a.toevoeging ?? ''}`.toLowerCase() === r);
  const lijst = passend.length ? passend : kandidaten;
  return lijst.find((a) => bsn && isEigenaar(d, bsn, a.nummeraanduiding)) ?? lijst[0];
}

/** Elfproef voor een burgerservicenummer. */
export function geldigBsn(bsn: string): boolean {
  if (!/^\d{9}$/.test(bsn)) return false;
  let som = 0;
  for (let i = 0; i < 8; i++) som += Number(bsn[i]) * (9 - i);
  som -= Number(bsn[8]);
  return som % 11 === 0;
}

export function datumNl(iso: string | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

export const euro = (v: string | undefined) =>
  v && !Number.isNaN(Number(v))
    ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(v))
    : v ?? '';
