import Papa from 'papaparse';

/** Eén rij uit een CSV-bestand; kolomnamen zijn genormaliseerd naar kleine letters. */
export type Row = Record<string, string>;

export interface Datasets {
  /** RvIG – Basisregistratie Personen */
  brp: Row[];
  /** KVK – Handelsregister */
  kvk: Row[];
  /** Kadaster – Basisregistratie Kadaster */
  kadaster: Row[];
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

export const BESTANDEN = {
  brp: 'rvig_brp_personen.csv',
  kvk: 'kvk_handelsregister.csv',
  kadaster: 'kadaster_objecten.csv',
  velden: 'formulier_velden.csv',
} as const;

async function laadCsv(bestand: string): Promise<Row[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${bestand}`);
  if (!res.ok) throw new Error(`Kon ${bestand} niet laden (${res.status})`);
  const tekst = await res.text();
  const result = Papa.parse<Row>(tekst, {
    header: true,
    skipEmptyLines: 'greedy',
    delimitersToGuess: [';', ',', '\t', '|'],
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
    transform: (v) => v.trim(),
  });
  return result.data;
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

export async function laadDatasets(): Promise<Datasets> {
  const [brp, kvk, kadaster, velden] = await Promise.all([
    laadCsv(BESTANDEN.brp),
    laadCsv(BESTANDEN.kvk),
    laadCsv(BESTANDEN.kadaster),
    laadCsv(BESTANDEN.velden),
  ]);
  return { brp, kvk, kadaster, velden: velden.filter((v) => v.veld_id).map(naarVeld) };
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

export function adresTekst(straat: string, nr: string, toev: string | undefined, postcode: string, plaats: string) {
  return `${straat} ${nr}${toev ? ` ${toev}` : ''}, ${mooiePostcode(postcode)} ${plaats}`;
}

export const brpAdres = (p: Row) => adresTekst(p.straat, p.huisnummer, p.huisnummertoevoeging, p.postcode, p.woonplaats);
export const kadasterAdres = (o: Row) => adresTekst(o.straat, o.huisnummer, o.toevoeging, o.postcode, o.plaats);
export const kvkBezoekadres = (o: Row) =>
  adresTekst(o.bezoek_straat, o.bezoek_huisnummer, o.bezoek_toevoeging, o.bezoek_postcode, o.bezoek_plaats);

function zelfdeAdres(pc1: string, nr1: string, t1: string | undefined, pc2: string, nr2: string, t2: string | undefined) {
  return (
    normPostcode(pc1) === normPostcode(pc2) &&
    nr1 === nr2 &&
    (t1 ?? '').toLowerCase() === (t2 ?? '').toLowerCase()
  );
}

export function zoekKadaster(data: Datasets, postcode: string, nr: string, toev?: string): Row | undefined {
  const kandidaten = data.kadaster.filter(
    (o) => normPostcode(o.postcode) === normPostcode(postcode) && o.huisnummer === nr,
  );
  if (kandidaten.length <= 1 || toev === undefined) return kandidaten[0];
  return kandidaten.find((o) => (o.toevoeging ?? '').toLowerCase() === toev.toLowerCase()) ?? kandidaten[0];
}

export const kadasterVanPersoon = (data: Datasets, p: Row) =>
  data.kadaster.find((o) =>
    zelfdeAdres(o.postcode, o.huisnummer, o.toevoeging, p.postcode, p.huisnummer, p.huisnummertoevoeging),
  );

export const isZelfdeAlsWoonadres = (o: Row, p: Row) =>
  zelfdeAdres(o.postcode, o.huisnummer, o.toevoeging, p.postcode, p.huisnummer, p.huisnummertoevoeging);

export const kvkOpWoonadres = (k: Row, p: Row) =>
  zelfdeAdres(k.bezoek_postcode, k.bezoek_huisnummer, k.bezoek_toevoeging, p.postcode, p.huisnummer, p.huisnummertoevoeging);

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
