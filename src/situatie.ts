import {
  brpAdres,
  kadasterAdres,
  kvkBezoekadres,
  volledigeNaam,
  type Row,
  type VeldDefinitie,
} from './data';

/** Wat de chatbot over de situatie en het doel van de gebruiker heeft vastgesteld. */
export interface Situatie {
  persoon?: Row;
  persoonBevestigd: boolean;
  nieuwAdres?: Row; // Kadaster-object van het nieuwe adres
  kadasterOud?: Row; // Kadaster-object van het huidige adres
  onderneming?: Row;
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

/** Bouwt de gegevensbronnen waaruit `prefill`-paden (bijv. `onderneming.handelsnaam`) worden gelezen. */
function prefillContext(s: Situatie): Record<string, Row> {
  const p = s.persoon ?? {};
  const n = s.nieuwAdres ?? {};
  const k = s.onderneming ?? {};
  return {
    persoon: { ...p, volledige_naam: s.persoon ? volledigeNaam(p) : '', adres: s.persoon ? brpAdres(p) : '' },
    nieuw: {
      ...n,
      adres: s.nieuwAdres ? kadasterAdres(n) : '',
      huisnummer_volledig: [n.huisnummer, n.toevoeging].filter(Boolean).join(' '),
    },
    kadaster_nieuw: n,
    kadaster_oud: s.kadasterOud ?? {},
    onderneming: { ...k, bezoekadres: s.onderneming ? kvkBezoekadres(k) : '' },
    situatie: {
      verhuisdatum: s.verhuisdatum ?? '',
      meeverhuizers: '',
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
