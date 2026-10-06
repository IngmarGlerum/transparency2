import { adresTekst, huisnummerVolledig, volledigeNaam, type Row, type VeldDefinitie } from './data';

/** Wat de chatbot over de situatie en het doel van de gebruiker heeft vastgesteld. */
export interface Situatie {
  persoon?: Row;
  persoonBevestigd: boolean;
  /** Actuele verblijfplaats volgens de BRP */
  huidigAdres?: Row;
  /** Nieuw adres (BAG-nummeraanduiding met adresgegevens) */
  nieuwAdres?: Row;
  /** KVK-vestiging op het woonadres waarvan de gebruiker bevestigt dat die van hem/haar is */
  onderneming?: Row;
  /** Gezinsleden die meeverhuizen (namen) */
  meeverhuizers?: string;
  /** Situatievlaggen; deze worden gebruikt in de kolom `voorwaarde` van formulier_velden.csv */
  vlaggen: Record<string, boolean>;
  verhuisdatum?: string;
}

export const legeSituatie = (): Situatie => ({ persoonBevestigd: false, vlaggen: {} });

/**
 * Evalueert een voorwaarde uit de veldencatalogus.
 * Ondersteunt `altijd`, losse vlaggen, `a&b` (en) en `a|b` (of), en `!a` (niet).
 */
export function voldoetAan(voorwaarde: string, s: Situatie): boolean {
  if (!s.persoonBevestigd) return false;
  return voorwaarde.split('|').some((deel) =>
    deel.split('&').every((term) => {
      const t = term.trim();
      if (!t || t === 'altijd') return true;
      if (t.startsWith('!')) return !s.vlaggen[t.slice(1)];
      return Boolean(s.vlaggen[t]);
    }),
  );
}

const metAdres = (a: Row | undefined): Row =>
  a ? { ...a, adres: adresTekst(a), huisnummer_volledig: huisnummerVolledig(a) } : {};

/** Bouwt de gegevensbronnen waaruit `prefill`-paden (bijv. `onderneming.handelsnaam`) worden gelezen. */
function prefillContext(s: Situatie): Record<string, Row> {
  const p = s.persoon ?? {};
  const naam = s.persoon ? volledigeNaam(p) : '';
  return {
    persoon: { ...p, volledige_naam: naam, adres: adresTekst(s.huidigAdres) },
    huidig: metAdres(s.huidigAdres),
    nieuw: metAdres(s.nieuwAdres),
    kadaster_nieuw: s.nieuwAdres
      ? {
          nummeraanduiding: s.nieuwAdres.nummeraanduiding,
          gebruiksdoel: s.nieuwAdres.gebruiksdoel,
          eigenaar: s.vlaggen.nieuw_eigendom_geregistreerd ? naam : '',
        }
      : {},
    kadaster_oud: {
      eigendom: s.vlaggen.oud_huur ? 'Geen eigendom geregistreerd op je naam' : s.vlaggen.oud_koop ? `Eigendom van ${naam}` : '',
    },
    onderneming: { ...(s.onderneming ?? {}), bezoekadres: s.onderneming ? adresTekst(s.huidigAdres) : '' },
    situatie: {
      verhuisdatum: s.verhuisdatum ?? '',
      meeverhuizers: s.meeverhuizers ?? '',
      postadres_gelijk: s.vlaggen.onderneming_verhuist_mee ? 'Ja' : '',
    },
  };
}

export function prefillWaarde(pad: string, s: Situatie): string {
  if (!pad) return '';
  const [bron, ...rest] = pad.split('.');
  return prefillContext(s)[bron]?.[rest.join('.')] ?? '';
}

export interface Sectie {
  titel: string;
  bron: string;
  velden: VeldDefinitie[];
}

/** Stelt het formulier samen: alleen velden waarvan de voorwaarde past bij de situatie, gegroepeerd per sectie. */
export function stelFormulierSamen(velden: VeldDefinitie[], s: Situatie): Sectie[] {
  const secties: Sectie[] = [];
  for (const v of velden) {
    if (!voldoetAan(v.voorwaarde, s)) continue;
    let sectie = secties.find((x) => x.titel === v.sectie);
    if (!sectie) {
      sectie = { titel: v.sectie, bron: v.bron, velden: [] };
      secties.push(sectie);
    }
    sectie.velden.push(v);
  }
  return secties;
}

export const BRON_INFO: Record<string, { naam: string; register: string }> = {
  RvIG: { naam: 'RvIG', register: 'Basisregistratie Personen (BRP)' },
  KVK: { naam: 'KVK', register: 'Handelsregister' },
  Kadaster: { naam: 'Kadaster', register: 'Basisregistratie Kadaster (BRK)' },
};
