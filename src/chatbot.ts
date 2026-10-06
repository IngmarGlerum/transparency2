import {
  adresTekst,
  datumNl,
  eigendomVan,
  geldigBsn,
  isEigenaar,
  mooiePostcode,
  huisnummerVolledig,
  volledigeNaam,
  zoekAdres,
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
  | 'meeverhuizers'
  | 'woningNieuw'
  | 'woningOud'
  | 'onderneming'
  | 'ondernemingMee'
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

const JA = /^(ja|jazeker|klopt|correct|juist|yes|j|zeker|dat klopt)\b/i;
const NEE = /^(nee|neen|no|n|klopt niet|niet)\b/i;
const jaNee = (t: string) => (JA.test(t.trim()) ? 'ja' : NEE.test(t.trim()) ? 'nee' : undefined);
const JA_NEE = ['Ja, dat klopt', 'Nee'];
const GEEN = 'Geen van deze';

const metVlag = (s: Situatie, vlaggen: Record<string, boolean>): Situatie => ({
  ...s,
  vlaggen: { ...s.vlaggen, ...vlaggen },
});

const kortAdres = (a: Row) => `${mooiePostcode(a.postcode)} ${huisnummerVolledig(a)}`;
const gezinsleden = (p: Row) => (p.gezinsleden_op_adres ? p.gezinsleden_op_adres.split('|') : []);
const zonderBsn = (lid: string) => lid.replace(/\s*\(\d+\)$/, '');
const vestigingenOpWoonadres = (s: Situatie, d: Datasets) => d.vestigingen.get(s.persoon!.nummeraanduiding) ?? [];
const naamGelijk = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function parseAdres(t: string): { postcode: string; nr: string; rest: string } | undefined {
  const pc = /(\d{4})\s?([a-z]{2})\b/i.exec(t);
  if (!pc) return undefined;
  const rest = (t.slice(0, pc.index) + ' ' + t.slice(pc.index + pc[0].length)).trim();
  const nr = /(\d+)\s*-?\s*([a-z0-9]{0,4}(?:\s+[a-z0-9]{1,4})?)\s*$/i.exec(rest) ?? /(\d+)/.exec(rest);
  if (!nr) return undefined;
  return { postcode: pc[1] + pc[2], nr: nr[1], rest: nr[2] ?? '' };
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
        'Ik stel je een paar vragen om je situatie te begrijpen. Op basis daarvan stel ik één formulier voor je samen, met gegevens die de overheid al van je heeft.',
        'Waarmee kan ik je helpen?',
      ],
      antwoorden: ['Ik ga verhuizen', 'Iets anders'],
    }),
    verwerk: (t) =>
      /verhui|nieuw(e)? (adres|woning|huis)|adres ?wijzig|ander adres/i.test(t)
        ? { volgende: 'identificatie', zeg: ['Goed, dan help ik je met je verhuizing.'] }
        : { zeg: ['In dit prototype kan ik je alleen helpen met het doorgeven van een verhuizing. Ga je verhuizen?'] },
  },

  identificatie: {
    vraag: (_s, d) => ({
      berichten: [
        'Normaal log je eerst in met DigiD. In dit prototype kies je een testpersoon, of typ je een burgerservicenummer (BSN) uit de BRP-testset.',
      ],
      antwoorden: d.demo
        .map((x) => d.personen.get(x.bsn))
        .filter((p): p is Row => Boolean(p))
        .map((p) => `${volledigeNaam(p)} (${p.bsn})`),
    }),
    verwerk: (t, s, d) => {
      const bsn = /\d{9}/.exec(t.replace(/[\s.]/g, ''))?.[0];
      if (!bsn) return { zeg: ['Ik herken geen BSN in je antwoord. Een BSN bestaat uit 9 cijfers.'] };
      const persoon = d.personen.get(bsn);
      if (!persoon)
        return {
          zeg: [
            geldigBsn(bsn)
              ? 'Ik kan dit BSN niet vinden in de Basisregistratie Personen. Kies een testpersoon.'
              : `${bsn} is geen geldig BSN (de elfproef klopt niet). Probeer het opnieuw.`,
          ],
        };
      return { situatie: { ...s, persoon, huidigAdres: d.adressen.get(persoon.nummeraanduiding) }, volgende: 'bevestigPersoon' };
    },
  },

  bevestigPersoon: {
    vraag: (s) => {
      const p = s.persoon!;
      return {
        berichten: [
          `Ik heb je gevonden in de Basisregistratie Personen (RvIG): **${volledigeNaam(p)}**${p.geboortedatum ? `, geboren op ${datumNl(p.geboortedatum)}` : ''}.`,
          `Je staat ingeschreven op **${adresTekst(s.huidigAdres)}**${p.gemeente ? ` in de gemeente ${p.gemeente}` : ''}. Klopt dat?`,
        ],
        antwoorden: JA_NEE,
      };
    },
    verwerk: (t, s) => {
      const a = jaNee(t);
      if (a === 'ja')
        return {
          situatie: { ...s, persoonBevestigd: true },
          volgende: 'nieuwAdres',
          zeg: ['Dank je. Je persoonsgegevens staan nu in het formulier.'],
        };
      if (a === 'nee')
        return {
          situatie: { ...s, persoon: undefined, huidigAdres: undefined },
          volgende: 'identificatie',
          zeg: ['Kloppen je gegevens in de BRP niet? Neem dan contact op met je gemeente. Laten we eerst controleren of je de juiste persoon hebt gekozen.'],
        };
      return { zeg: ['Antwoord met ja of nee.'] };
    },
  },

  nieuwAdres: {
    vraag: (s, d) => {
      const eigen = eigendomVan(d, s.persoon!.bsn)
        .map((na) => d.adressen.get(na))
        .filter((a): a is Row => Boolean(a))
        .sort((a, b) => Number(/woon/.test(b.gebruiksdoel)) - Number(/woon/.test(a.gebruiksdoel)));
      return {
        berichten: ['Wat wordt je nieuwe adres? Typ je postcode en huisnummer, bijvoorbeeld "3132 BD 99".'],
        antwoorden: eigen.slice(0, 3).map(kortAdres),
      };
    },
    verwerk: (t, s, d) => {
      const invoer = parseAdres(t);
      if (!invoer) return { zeg: ['Ik herken geen postcode en huisnummer. Typ bijvoorbeeld "3132 BD 99".'] };
      const adres = zoekAdres(d, invoer.postcode, invoer.nr, invoer.rest, s.persoon!.bsn);
      if (!adres) return { zeg: ['Ik kan dit adres niet vinden in de Basisregistratie Adressen en Gebouwen. Controleer de postcode en het huisnummer.'] };
      if (adres.nummeraanduiding === s.persoon!.nummeraanduiding) return { zeg: ['Dit is je huidige adres. Wat wordt je nieuwe adres?'] };
      return { situatie: { ...s, nieuwAdres: adres }, volgende: 'bevestigAdres' };
    },
  },

  bevestigAdres: {
    vraag: (s) => ({
      berichten: [
        `Je nieuwe adres wordt **${adresTekst(s.nieuwAdres)}**${s.nieuwAdres!.gemeente ? ` (gemeente ${s.nieuwAdres!.gemeente})` : ''}. Klopt dat?`,
      ],
      antwoorden: JA_NEE,
    }),
    verwerk: (t, s) => {
      const a = jaNee(t);
      if (a === 'ja') {
        const zeg =
          s.nieuwAdres!.gemeente && s.persoon!.gemeente && s.nieuwAdres!.gemeente !== s.persoon!.gemeente
            ? [`Je verhuist naar een andere gemeente. We geven je verhuizing door aan de gemeente ${s.nieuwAdres!.gemeente}.`]
            : [];
        const gezin = gezinsleden(s.persoon!).length > 0;
        return {
          situatie: { ...metVlag(s, { verhuizing: true }), meeverhuizers: gezin ? s.meeverhuizers : 'Alleen ikzelf' },
          volgende: gezin ? 'meeverhuizers' : 'woningNieuw',
          zeg,
        };
      }
      if (a === 'nee') return { situatie: { ...s, nieuwAdres: undefined }, volgende: 'nieuwAdres' };
      return { zeg: ['Antwoord met ja of nee.'] };
    },
  },

  meeverhuizers: {
    vraag: (s) => {
      const leden = gezinsleden(s.persoon!).map(zonderBsn);
      return {
        berichten: [`Volgens de BRP wonen ook **${leden.join(', ')}** op je huidige adres. Verhuizen zij met je mee?`],
        antwoorden: ['Ja, allemaal', 'Nee, alleen ik'],
      };
    },
    verwerk: (t, s) => {
      const a = /allemaal/i.test(t) ? 'ja' : /alleen ik/i.test(t) ? 'nee' : jaNee(t);
      if (!a) return { zeg: ['Antwoord met ja of nee. Verhuizen maar een paar personen mee? Kies "Ja" en pas het daarna aan in het formulier.'] };
      const meeverhuizers = a === 'ja' ? gezinsleden(s.persoon!).map(zonderBsn).join(', ') : 'Alleen ikzelf';
      return {
        situatie: { ...s, meeverhuizers },
        volgende: 'woningNieuw',
        zeg: a === 'ja' ? ['Ik geef de verhuizing ook voor hen door.'] : [],
      };
    },
  },

  woningNieuw: {
    vraag: (s, d) => {
      const n = s.nieuwAdres!;
      if (isEigenaar(d, s.persoon!.bsn, n.nummeraanduiding))
        return {
          berichten: [
            `Volgens het Kadaster sta jij als eigenaar geregistreerd van ${n.straat} ${huisnummerVolledig(n)}${n.gebruiksdoel ? ` (gebruiksdoel: ${n.gebruiksdoel.replace(/,/g, ', ')})` : ''}. Je nieuwe woning is dus een **koopwoning**. Klopt dat?`,
          ],
          antwoorden: JA_NEE,
        };
      return {
        berichten: ['Volgens het Kadaster sta je niet als eigenaar van je nieuwe adres geregistreerd. Ga je deze woning **huren**?'],
        antwoorden: ['Ja, ik ga huren', 'Nee, ik heb hem gekocht'],
      };
    },
    verwerk: (t, s, d) => {
      const eigenaar = isEigenaar(d, s.persoon!.bsn, s.nieuwAdres!.nummeraanduiding);
      const a = jaNee(t) ?? (/koop|gekocht/i.test(t) ? (eigenaar ? 'ja' : 'nee') : /huur/i.test(t) ? (eigenaar ? 'nee' : 'ja') : undefined);
      if (!a) return { zeg: ['Antwoord met ja of nee.'] };
      const koop = eigenaar ? a === 'ja' : a === 'nee';
      const zeg = [];
      if (koop && !eigenaar)
        zeg.push('Let op: de overdracht staat nog niet ingeschreven in het Kadaster. Je kunt doorgaan; de gegevens worden later gecontroleerd.');
      if (!koop && eigenaar)
        zeg.push('Je staat in het Kadaster als eigenaar geregistreerd. Ik ga uit van een huurwoning, maar controleer dit later bij het Kadaster.');
      zeg.push(koop ? 'Ik heb de gegevens van het Kadaster over je nieuwe woning toegevoegd.' : 'Ik noteer dat je nieuwe woning een huurwoning is.');
      return {
        situatie: metVlag(s, { nieuw_koop: koop, nieuw_huur: !koop, nieuw_eigendom_geregistreerd: koop && eigenaar }),
        volgende: 'woningOud',
        zeg,
      };
    },
  },

  woningOud: {
    vraag: (s, d) => {
      if (isEigenaar(d, s.persoon!.bsn, s.persoon!.nummeraanduiding))
        return {
          berichten: ['Volgens het Kadaster ben je eigenaar van je huidige woning. Dat is dus een **koopwoning**. Klopt dat?'],
          antwoorden: JA_NEE,
        };
      return {
        berichten: ['Volgens het Kadaster sta je niet als eigenaar van je huidige woning geregistreerd. Je **huurt** je huidige woning dus. Klopt dat?'],
        antwoorden: JA_NEE,
      };
    },
    verwerk: (t, s, d) => {
      const a = jaNee(t);
      if (!a) return { zeg: ['Antwoord met ja of nee.'] };
      const eigenaar = isEigenaar(d, s.persoon!.bsn, s.persoon!.nummeraanduiding);
      const koop = eigenaar ? a === 'ja' : a === 'nee';
      const zeg = [];
      if (!koop && s.vlaggen.nieuw_koop)
        zeg.push('Je gaat van een huurwoning naar een koopwoning. Ik heb vragen toegevoegd over het beëindigen van je huur en over huurtoeslag.');
      return { situatie: metVlag(s, { oud_koop: koop, oud_huur: !koop }), volgende: 'onderneming', zeg };
    },
  },

  onderneming: {
    vraag: (s, d) => {
      const vs = vestigingenOpWoonadres(s, d);
      if (vs.length === 0)
        return {
          berichten: ['Ik heb in het Handelsregister van KVK geen actieve onderneming op je woonadres gevonden. Klopt het dat je geen onderneming vanuit huis hebt?'],
          antwoorden: JA_NEE,
        };
      if (vs.length === 1) {
        const v = vs[0];
        const berichten = [
          `Volgens het Handelsregister van KVK is op je woonadres ingeschreven: **${v.handelsnaam}** (${v.rechtsvorm.toLowerCase()}, KVK ${v.kvk_nummer}), eigenaar: ${v.eigenaar_naam}.`,
        ];
        if (!naamGelijk(v.eigenaar_naam, volledigeNaam(s.persoon!)))
          berichten.push('Let op: de naam van de eigenaar in het Handelsregister wijkt af van jouw naam in de BRP.');
        berichten.push('Is dit jouw onderneming?');
        return { berichten, antwoorden: JA_NEE };
      }
      return {
        berichten: [`Op je woonadres staan ${vs.length} actieve ondernemingen ingeschreven in het Handelsregister. Welke is van jou?`],
        antwoorden: [...vs.slice(0, 6).map((v) => `${v.handelsnaam} (KVK ${v.kvk_nummer})`), GEEN],
      };
    },
    verwerk: (t, s, d) => {
      const vs = vestigingenOpWoonadres(s, d);
      let gekozen: Row | undefined;
      if (vs.length > 1) {
        if (t === GEEN || jaNee(t) === 'nee') gekozen = undefined;
        else {
          gekozen = vs.find((v) => t.includes(v.kvk_nummer) || t.toLowerCase().includes(v.handelsnaam.toLowerCase()));
          if (!gekozen) return { zeg: ['Kies een van de ondernemingen, of "Geen van deze".'] };
        }
      } else {
        const a = jaNee(t);
        if (!a) return { zeg: ['Antwoord met ja of nee.'] };
        if (vs.length === 0)
          return {
            volgende: 'verhuisdatum',
            zeg: a === 'nee' ? ['Staat je onderneming niet op je woonadres ingeschreven? Dan hoef je het vestigingsadres niet te wijzigen. Twijfel je? Neem contact op met KVK.'] : [],
          };
        gekozen = a === 'ja' ? vs[0] : undefined;
      }
      if (!gekozen)
        return {
          situatie: { ...metVlag(s, { onderneming_verhuist_mee: false }), onderneming: undefined },
          volgende: 'verhuisdatum',
          zeg: ['Dan verandert er voor jou niets in het Handelsregister.'],
        };
      return { situatie: { ...s, onderneming: gekozen }, volgende: 'ondernemingMee' };
    },
  },

  ondernemingMee: {
    vraag: (s) => ({
      berichten: [`Het vestigingsadres van **${s.onderneming!.handelsnaam}** is je woonadres. Verhuist je onderneming mee naar **${adresTekst(s.nieuwAdres)}**?`],
      antwoorden: ['Ja, mijn onderneming verhuist mee', 'Nee'],
    }),
    verwerk: (t, s) => {
      const a = jaNee(t);
      if (!a) return { zeg: ['Antwoord met ja of nee.'] };
      const mee = a === 'ja';
      return {
        situatie: metVlag(s, { onderneming_verhuist_mee: mee }),
        volgende: 'verhuisdatum',
        zeg: mee
          ? ['Ik heb de wijziging van je vestigingsadres bij KVK aan het formulier toegevoegd. Het nieuwe bezoekadres wordt je nieuwe woonadres.']
          : ['Let op: je onderneming mag niet ingeschreven blijven op een adres waar je niet meer woont of werkt. Geef het nieuwe vestigingsadres apart door aan KVK.'],
      };
    },
  },

  verhuisdatum: {
    vraag: () => ({
      berichten: ['Op welke datum verhuis je? Typ de datum als dd-mm-jjjj.'],
      antwoorden: [datumNl(plusDagen(isoVandaag(), 14))],
    }),
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
        `je verhuizing doorgeven aan ${s.nieuwAdres?.gemeente ? `de gemeente ${s.nieuwAdres.gemeente}` : 'je nieuwe gemeente'} (BRP, RvIG)`,
        v.onderneming_verhuist_mee && `het vestigingsadres van ${s.onderneming?.handelsnaam} wijzigen (KVK)`,
        v.nieuw_koop && 'de gegevens van je koopwoning controleren (Kadaster)',
        v.oud_huur && 'het einde van je huurwoning en eventuele huurtoeslag regelen',
      ].filter(Boolean);
      return {
        berichten: [
          `Samengevat: je verhuist op ${datumNl(s.verhuisdatum)} van een ${v.oud_huur ? 'huurwoning' : 'koopwoning'} naar een ${v.nieuw_koop ? 'koopwoning' : 'huurwoning'}${v.onderneming_verhuist_mee ? ', en je onderneming verhuist mee' : ''}.`,
          `Je doel: ${doelen.join('; ')}.`,
          'Het formulier is compleet. Controleer de gegevens, vul de open vragen in en verstuur alles in één keer. Heb je nog een vraag? Stel hem hier.',
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
      return { zeg: ['Daar kan ik in dit prototype geen antwoord op geven. Je kunt het formulier verder invullen.'] };
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
