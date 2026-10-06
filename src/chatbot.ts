import {
  brpAdres,
  datumNl,
  geldigBsn,
  isZelfdeAlsWoonadres,
  kadasterAdres,
  kadasterVanPersoon,
  kvkBezoekadres,
  kvkOpWoonadres,
  volledigeNaam,
  zoekKadaster,
  type Datasets,
  type Row,
} from './data';
import type { Situatie } from './situatie';

/**
 * Regelgebaseerde assistent. Elke stap stelt een (controle)vraag en verwerkt het antwoord.
 * Zo worden de situatie (wie, waar, koop/huur, onderneming) en het doel (verhuizing doorgeven) bepaald.
 */

export type StapId =
  | 'doel'
  | 'identificatie'
  | 'bevestigPersoon'
  | 'nieuwAdres'
  | 'bevestigAdres'
  | 'woningNieuw'
  | 'woningOud'
  | 'woningOudVraag'
  | 'onderneming'
  | 'verhuisdatum'
  | 'klaar';

export interface BotBeurt {
  berichten: string[];
  antwoorden?: string[];
}

interface Verwerking {
  situatie?: Situatie;
  volgende?: StapId;
  zeg?: string[];
}

interface Stap {
  vraag(s: Situatie, d: Datasets): BotBeurt;
  verwerk(invoer: string, s: Situatie, d: Datasets): Verwerking;
}

const JA = /^(ja|jazeker|klopt|correct|juist|yes|j|zeker|dat klopt|ja,? (dat )?klopt)\b/i;
const NEE = /^(nee|neen|no|n|klopt niet|niet)\b/i;
const jaNee = (t: string) => (JA.test(t.trim()) ? 'ja' : NEE.test(t.trim()) ? 'nee' : undefined);
const JA_NEE = ['Ja, dat klopt', 'Nee'];

const metVlag = (s: Situatie, vlaggen: Record<string, boolean>): Situatie => ({
  ...s,
  vlaggen: { ...s.vlaggen, ...vlaggen },
});

function parseAdres(t: string): { postcode: string; nr: string; toev?: string } | undefined {
  const pc = /(\d{4})\s?([a-z]{2})\b/i.exec(t);
  if (!pc) return undefined;
  const rest = (t.slice(0, pc.index) + ' ' + t.slice(pc.index + pc[0].length)).trim();
  const nr = /(\d+)\s*[-\s]?\s*([a-z]{1,4}\b)?/i.exec(rest);
  if (!nr) return undefined;
  return { postcode: pc[1] + pc[2], nr: nr[1], toev: nr[2] };
}

function parseDatum(t: string): string | undefined {
  let m = /(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{4})/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return m[0];
  const maanden = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  m = new RegExp(`(\\d{1,2})\\s+(${maanden.join('|')})\\s+(\\d{4})`, 'i').exec(t);
  if (m) return `${m[3]}-${String(maanden.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return undefined;
}

const isoVandaag = () => new Date().toISOString().slice(0, 10);
const plusDagen = (iso: string, dagen: number) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + dagen);
  return d.toISOString().slice(0, 10);
};

export const STAPPEN: Record<StapId, Stap> = {
  doel: {
    vraag: () => ({
      berichten: [
        'Hallo! Ik ben de digitale assistent van Mijn Overheid.',
        'Ik stel je een paar vragen om je situatie te begrijpen. Op basis daarvan stel ik links één formulier voor je samen, met gegevens die de overheid al van je heeft.',
        'Waarmee kan ik je helpen?',
      ],
      antwoorden: ['Ik ga verhuizen', 'Iets anders'],
    }),
    verwerk: (t) =>
      /verhui|nieuw(e)? (adres|woning|huis)|adres ?wijzig|ander adres/i.test(t)
        ? { volgende: 'identificatie', zeg: ['Goed, dan help ik je met je verhuizing.'] }
        : {
            zeg: [
              'In dit prototype kan ik je alleen helpen met het doorgeven van een verhuizing. Ga je verhuizen?',
            ],
          },
  },

  identificatie: {
    vraag: (_s, d) => ({
      berichten: [
        'Normaal log je eerst in met DigiD. In dit prototype kies je een testpersoon, of typ je een burgerservicenummer (BSN).',
      ],
      antwoorden: d.brp.map((p) => `${volledigeNaam(p)} (${p.bsn})`),
    }),
    verwerk: (t, s, d) => {
      const bsn = /\d{9}/.exec(t.replace(/[\s.]/g, ''))?.[0];
      if (!bsn) return { zeg: ['Ik herken geen BSN in je antwoord. Een BSN bestaat uit 9 cijfers.'] };
      if (!geldigBsn(bsn)) return { zeg: [`${bsn} is geen geldig BSN (de elfproef klopt niet). Probeer het opnieuw.`] };
      const persoon = d.brp.find((p) => p.bsn === bsn);
      if (!persoon) return { zeg: ['Ik kan dit BSN niet vinden in de Basisregistratie Personen. Kies een testpersoon.'] };
      return { situatie: { ...s, persoon }, volgende: 'bevestigPersoon' };
    },
  },

  bevestigPersoon: {
    vraag: (s) => {
      const p = s.persoon!;
      return {
        berichten: [
          `Ik heb je gevonden in de Basisregistratie Personen (RvIG): **${volledigeNaam(p)}**, geboren op ${datumNl(p.geboortedatum)}.`,
          `Je staat ingeschreven op **${brpAdres(p)}**. Klopt dat?`,
        ],
        antwoorden: JA_NEE,
      };
    },
    verwerk: (t, s, d) => {
      const a = jaNee(t);
      if (a === 'ja')
        return {
          situatie: { ...s, persoonBevestigd: true, kadasterOud: kadasterVanPersoon(d, s.persoon!) },
          volgende: 'nieuwAdres',
          zeg: ['Dank je. Je persoonsgegevens staan nu links in het formulier.'],
        };
      if (a === 'nee')
        return {
          situatie: { ...s, persoon: undefined },
          volgende: 'identificatie',
          zeg: ['Kloppen je gegevens in de BRP niet? Neem dan contact op met je gemeente. Laten we eerst controleren of je de juiste persoon hebt gekozen.'],
        };
      return { zeg: ['Antwoord met ja of nee.'] };
    },
  },

  nieuwAdres: {
    vraag: (s, d) => ({
      berichten: ['Wat wordt je nieuwe adres? Typ je postcode en huisnummer, bijvoorbeeld "3721 AB 8".'],
      antwoorden: d.kadaster
        .filter((o) => !isZelfdeAlsWoonadres(o, s.persoon!))
        .sort((a, b) => Number(b.eigenaar_bsn === s.persoon!.bsn) - Number(a.eigenaar_bsn === s.persoon!.bsn))
        .slice(0, 3)
        .map((o) => `${o.postcode.slice(0, 4)} ${o.postcode.slice(4)} ${o.huisnummer}${o.toevoeging ? ' ' + o.toevoeging : ''}`),
    }),
    verwerk: (t, s, d) => {
      const adres = parseAdres(t);
      if (!adres) return { zeg: ['Ik herken geen postcode en huisnummer. Typ bijvoorbeeld "3721 AB 8".'] };
      const obj = zoekKadaster(d, adres.postcode, adres.nr, adres.toev);
      if (!obj)
        return { zeg: ['Ik kan dit adres niet vinden in de registraties. Controleer de postcode en het huisnummer.'] };
      if (isZelfdeAlsWoonadres(obj, s.persoon!))
        return { zeg: ['Dit is je huidige adres. Wat wordt je nieuwe adres?'] };
      return { situatie: { ...s, nieuwAdres: obj }, volgende: 'bevestigAdres' };
    },
  },

  bevestigAdres: {
    vraag: (s) => ({
      berichten: [`Je nieuwe adres wordt **${kadasterAdres(s.nieuwAdres!)}**. Klopt dat?`],
      antwoorden: JA_NEE,
    }),
    verwerk: (t, s) => {
      const a = jaNee(t);
      if (a === 'ja') return { situatie: metVlag(s, { verhuizing: true }), volgende: 'woningNieuw' };
      if (a === 'nee') return { situatie: { ...s, nieuwAdres: undefined }, volgende: 'nieuwAdres' };
      return { zeg: ['Antwoord met ja of nee.'] };
    },
  },

  woningNieuw: {
    vraag: (s) => {
      const o = s.nieuwAdres!;
      if (o.eigenaar_bsn === s.persoon!.bsn)
        return {
          berichten: [
            `Volgens het Kadaster ben jij sinds ${datumNl(o.datum_eigendom)} eigenaar van ${o.straat} ${o.huisnummer}. Je nieuwe woning is dus een **koopwoning**. Klopt dat?`,
          ],
          antwoorden: JA_NEE,
        };
      return {
        berichten: [`Volgens het Kadaster is ${o.eigenaar_naam} eigenaar van je nieuwe adres. Ga je deze woning **huren**?`],
        antwoorden: ['Ja, ik ga huren', 'Nee, ik heb hem gekocht'],
      };
    },
    verwerk: (t, s) => {
      const eigenaar = s.nieuwAdres!.eigenaar_bsn === s.persoon!.bsn;
      const a = jaNee(t) ?? (/koop|gekocht/i.test(t) ? (eigenaar ? 'ja' : 'nee') : /huur/i.test(t) ? (eigenaar ? 'nee' : 'ja') : undefined);
      if (!a) return { zeg: ['Antwoord met ja of nee.'] };
      const koop = eigenaar ? a === 'ja' : a === 'nee';
      const zeg = [];
      if (koop && !eigenaar)
        zeg.push('Let op: de overdracht staat nog niet ingeschreven in het Kadaster. Je kunt doorgaan; de gegevens worden later gecontroleerd. Vul de koopgegevens zelf in.');
      if (!koop && eigenaar)
        zeg.push('Je staat in het Kadaster als eigenaar geregistreerd. Ik ga uit van een huurwoning, maar controleer dit later bij het Kadaster.');
      zeg.push(koop ? 'Ik heb de gegevens van het Kadaster over je nieuwe woning toegevoegd.' : 'Ik noteer dat je nieuwe woning een huurwoning is.');
      return { situatie: metVlag(s, { nieuw_koop: koop, nieuw_huur: !koop }), volgende: 'woningOud', zeg };
    },
  },

  woningOud: {
    vraag: (s) => {
      const o = s.kadasterOud;
      if (!o) return STAPPEN.woningOudVraag.vraag(s, {} as Datasets);
      if (o.eigenaar_bsn === s.persoon!.bsn)
        return {
          berichten: [`Volgens het Kadaster ben je eigenaar van je huidige woning aan de ${o.straat}. Dat is dus een **koopwoning**. Klopt dat?`],
          antwoorden: JA_NEE,
        };
      return {
        berichten: [
          `Volgens het Kadaster is **${o.eigenaar_naam}** eigenaar van je huidige woning. Je **huurt** je huidige woning dus. Klopt dat?`,
        ],
        antwoorden: JA_NEE,
      };
    },
    verwerk: (t, s, d) => {
      if (!s.kadasterOud) return STAPPEN.woningOudVraag.verwerk(t, s, d);
      const a = jaNee(t);
      if (!a) return { zeg: ['Antwoord met ja of nee.'] };
      const eigenaar = s.kadasterOud.eigenaar_bsn === s.persoon!.bsn;
      const koop = eigenaar ? a === 'ja' : a === 'nee';
      const zeg = [];
      if (!koop && s.vlaggen.nieuw_koop)
        zeg.push('Je gaat van een huurwoning naar een koopwoning. Ik heb vragen toegevoegd over het beëindigen van je huur en over huurtoeslag.');
      return { situatie: metVlag(s, { oud_koop: koop, oud_huur: !koop }), volgende: 'onderneming', zeg };
    },
  },

  woningOudVraag: {
    vraag: () => ({ berichten: ['Is je huidige woning een koopwoning of een huurwoning?'], antwoorden: ['Koopwoning', 'Huurwoning'] }),
    verwerk: (t, s) => {
      if (/koop/i.test(t)) return { situatie: metVlag(s, { oud_koop: true, oud_huur: false }), volgende: 'onderneming' };
      if (/huur/i.test(t)) return { situatie: metVlag(s, { oud_koop: false, oud_huur: true }), volgende: 'onderneming' };
      return { zeg: ['Kies koopwoning of huurwoning.'] };
    },
  },

  onderneming: {
    vraag: (s, d) => {
      const k = d.kvk.find((r) => r.eigenaar_bsn === s.persoon!.bsn);
      if (!k)
        return {
          berichten: ['Ik heb in het Handelsregister van KVK geen onderneming op jouw naam gevonden. Klopt het dat je geen eigen onderneming hebt?'],
          antwoorden: JA_NEE,
        };
      if (kvkOpWoonadres(k, s.persoon!))
        return {
          berichten: [
            `Volgens het Handelsregister van KVK heb je een ${k.rechtsvorm.toLowerCase()}: **${k.handelsnaam}** (KVK ${k.kvk_nummer}).`,
            `Het vestigingsadres van je onderneming is hetzelfde als je woonadres. Verhuist je onderneming mee naar **${kadasterAdres(s.nieuwAdres!)}**?`,
          ],
          antwoorden: ['Ja, mijn onderneming verhuist mee', 'Nee'],
        };
      return {
        berichten: [
          `Je hebt een onderneming: **${k.handelsnaam}** (KVK ${k.kvk_nummer}), gevestigd op ${kvkBezoekadres(k)}.`,
          'Dat is niet je woonadres, dus het vestigingsadres blijft hetzelfde. Klopt dat?',
        ],
        antwoorden: JA_NEE,
      };
    },
    verwerk: (t, s, d) => {
      const k: Row | undefined = d.kvk.find((r) => r.eigenaar_bsn === s.persoon!.bsn);
      const a = jaNee(t);
      if (!a) return { zeg: ['Antwoord met ja of nee.'] };
      if (!k)
        return {
          volgende: 'verhuisdatum',
          zeg: a === 'nee' ? ['Staat je onderneming niet op jouw naam? Neem dan contact op met KVK. We gaan verder met je verhuizing.'] : [],
        };
      const opWoonadres = kvkOpWoonadres(k, s.persoon!);
      const verhuistMee = opWoonadres ? a === 'ja' : a === 'nee';
      const zeg = verhuistMee
        ? ['Ik heb de wijziging van je vestigingsadres bij KVK aan het formulier toegevoegd. Het nieuwe bezoekadres wordt je nieuwe woonadres.']
        : opWoonadres
          ? ['Let op: je onderneming mag niet ingeschreven blijven op een adres waar je niet meer woont of werkt. Geef het nieuwe vestigingsadres apart door aan KVK.']
          : [];
      return {
        situatie: { ...metVlag(s, { onderneming_verhuist_mee: verhuistMee }), onderneming: k },
        volgende: 'verhuisdatum',
        zeg,
      };
    },
  },

  verhuisdatum: {
    vraag: (s) => {
      const voorstel = s.nieuwAdres?.datum_eigendom && s.nieuwAdres.datum_eigendom >= isoVandaag()
        ? s.nieuwAdres.datum_eigendom
        : plusDagen(isoVandaag(), 14);
      return {
        berichten: ['Op welke datum verhuis je? Typ de datum als dd-mm-jjjj.'],
        antwoorden: [datumNl(voorstel)],
      };
    },
    verwerk: (t, s) => {
      const iso = parseDatum(t);
      if (!iso || Number.isNaN(new Date(iso).getTime())) return { zeg: ['Ik herken geen datum. Typ bijvoorbeeld 01-11-2026.'] };
      const vandaag = isoVandaag();
      if (iso > plusDagen(vandaag, 28))
        return { zeg: ['Je kunt een verhuizing maximaal 4 weken van tevoren doorgeven. Kies een eerdere datum, of kom later terug.'] };
      const zeg = iso < plusDagen(vandaag, -5) ? ['Let op: je moet een verhuizing uiterlijk 5 dagen na de verhuisdatum doorgeven. Je bent te laat, maar je kunt de verhuizing nog wel doorgeven.'] : [];
      return { situatie: { ...s, verhuisdatum: iso }, volgende: 'klaar', zeg };
    },
  },

  klaar: {
    vraag: (s) => {
      const v = s.vlaggen;
      const doelen = [
        'je verhuizing doorgeven aan je nieuwe gemeente (BRP, RvIG)',
        v.onderneming_verhuist_mee && `het vestigingsadres van ${s.onderneming?.handelsnaam} wijzigen (KVK)`,
        v.nieuw_koop && 'de gegevens van je koopwoning controleren (Kadaster)',
        v.oud_huur && 'het einde van je huurwoning en eventuele huurtoeslag regelen',
      ].filter(Boolean);
      return {
        berichten: [
          `Samengevat: je verhuist op ${datumNl(s.verhuisdatum)} van een ${v.oud_huur ? 'huurwoning' : 'koopwoning'} naar een ${v.nieuw_koop ? 'koopwoning' : 'huurwoning'}${v.onderneming_verhuist_mee ? ', en je onderneming verhuist mee' : ''}.`,
          `Je doel: ${doelen.join('; ')}.`,
          'Het formulier links is compleet. Controleer de gegevens, vul de open vragen in en verstuur alles in één keer. Heb je nog een vraag? Stel hem hier.',
        ],
        antwoorden: ['Wat gebeurt er met mijn huurtoeslag?', 'Wat doet KVK met mijn wijziging?'],
      };
    },
    verwerk: (t) => {
      if (/huurtoeslag|toeslag/i.test(t))
        return { zeg: ['Huurtoeslag krijg je alleen voor een huurwoning. Als je in een koopwoning gaat wonen, stopt je huurtoeslag vanaf de verhuisdatum. Wij geven je verhuizing door aan Dienst Toeslagen. Te veel ontvangen huurtoeslag moet je terugbetalen.'] };
      if (/kvk|onderneming|bedrijf|vestiging/i.test(t))
        return { zeg: ['KVK past het bezoekadres en (als je dat aangeeft) het postadres van je vestiging aan in het Handelsregister. Je ontvangt een uittreksel met de nieuwe gegevens. Het KVK-nummer blijft hetzelfde.'] };
      if (/woz|gemeentelijke belasting/i.test(t))
        return { zeg: ['De gemeente stelt de WOZ-waarde vast. Als eigenaar ontvang je voortaan de aanslag onroerendezaakbelasting.'] };
      if (/hypotheek|kadaster/i.test(t))
        return { zeg: ['Het Kadaster registreert de eigendom en de hypotheek op basis van de akte van de notaris. Je hoeft dat niet zelf door te geven; controleer alleen of de gegevens kloppen.'] };
      return { zeg: ['Daar kan ik in dit prototype geen antwoord op geven. Je kunt het formulier links verder invullen.'] };
    },
  },
};

export interface ChatResultaat {
  situatie: Situatie;
  stap: StapId;
  beurt: BotBeurt;
}

/** Verwerkt een antwoord van de gebruiker en bepaalt de volgende beurt van de assistent. */
export function beantwoord(stap: StapId, invoer: string, s: Situatie, d: Datasets): ChatResultaat {
  const r = STAPPEN[stap].verwerk(invoer, s, d);
  const situatie = r.situatie ?? s;
  if (!r.volgende) {
    return {
      situatie,
      stap,
      beurt: { berichten: r.zeg ?? [], antwoorden: STAPPEN[stap].vraag(situatie, d).antwoorden },
    };
  }
  const volgende = STAPPEN[r.volgende].vraag(situatie, d);
  return {
    situatie,
    stap: r.volgende,
    beurt: { berichten: [...(r.zeg ?? []), ...volgende.berichten], antwoorden: volgende.antwoorden },
  };
}
