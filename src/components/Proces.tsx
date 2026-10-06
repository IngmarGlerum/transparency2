import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { beantwoord, STAPPEN, type StapId } from '../chatbot';
import type { Datasets } from '../data';
import { legeSituatie, prefillWaarde, stelFormulierSamen, type Sectie, type Situatie } from '../situatie';
import { Chat, type ChatBericht } from './Chat';
import { Formulier } from './Formulier';
import { Container } from './Layout';

export interface Inzending {
  secties: Sectie[];
  waarden: Record<string, string>;
  situatie: Situatie;
}

const TYPEN_MS = 450;

export function Proces({ data, onVerstuurd }: { data: Datasets; onVerstuurd: (i: Inzending) => void }) {
  const volgnummer = useRef(0);
  const timers = useRef<number[]>([]);
  const [berichten, setBerichten] = useState<ChatBericht[]>([]);
  const [antwoorden, setAntwoorden] = useState<string[]>([]);
  const [bezig, setBezig] = useState(false);
  const [stap, setStap] = useState<StapId>('doel');
  const [situatie, setSituatie] = useState<Situatie>(legeSituatie);
  /** Alleen de waarden die de gebruiker zelf heeft ingevuld of aangepast. */
  const [invoer, setInvoer] = useState<Record<string, string>>({});
  const [fouten, setFouten] = useState<Record<string, string>>({});

  const botZegt = useCallback((teksten: string[], nieuweAntwoorden: string[] = []) => {
    setBezig(true);
    setAntwoorden([]);
    teksten.forEach((tekst, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setBerichten((b) => [...b, { id: volgnummer.current++, van: 'bot', tekst }]);
          if (i === teksten.length - 1) {
            setBezig(false);
            setAntwoorden(nieuweAntwoorden);
          }
        }, TYPEN_MS * (i + 1)),
      );
    });
    if (teksten.length === 0) {
      setBezig(false);
      setAntwoorden(nieuweAntwoorden);
    }
  }, []);

  const start = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setBerichten([]);
    setStap('doel');
    setSituatie(legeSituatie());
    setInvoer({});
    setFouten({});
    const eerste = STAPPEN.doel.vraag(legeSituatie(), data);
    botZegt(eerste.berichten, eerste.antwoorden);
  }, [botZegt, data]);

  useEffect(() => {
    start();
    return () => timers.current.forEach(clearTimeout);
  }, [start]);

  const onAntwoord = (tekst: string) => {
    setBerichten((b) => [...b, { id: volgnummer.current++, van: 'gebruiker', tekst }]);
    const r = beantwoord(stap, tekst, situatie, data);
    setSituatie(r.situatie);
    setStap(r.stap);
    botZegt(r.beurt.berichten, r.beurt.antwoorden);
  };

  const secties = useMemo(() => stelFormulierSamen(data.velden, situatie), [data.velden, situatie]);
  const zichtbareVelden = useMemo(() => secties.flatMap((s) => s.velden), [secties]);
  const vooringevuld = useMemo(
    () => Object.fromEntries(zichtbareVelden.map((v) => [v.id, prefillWaarde(v.prefill, situatie)])),
    [zichtbareVelden, situatie],
  );

  // Registratiegegevens vullen het formulier, maar wat de gebruiker zelf invult gaat voor.
  const waarden = useMemo(() => ({ ...vooringevuld, ...invoer }), [vooringevuld, invoer]);

  const onWijzig = (id: string, w: string) => {
    setInvoer((o) => ({ ...o, [id]: w }));
    setFouten((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== id)));
  };

  const onVerstuur = () => {
    const nieuweFouten: Record<string, string> = {};
    for (const v of zichtbareVelden) {
      const w = (waarden[v.id] ?? '').trim();
      if (v.verplicht && !w) nieuweFouten[v.id] = `Vul "${v.label}" in.`;
      else if (w && v.type === 'postcode' && !/^\d{4}\s?[a-z]{2}$/i.test(w)) nieuweFouten[v.id] = `"${v.label}" moet een postcode zijn, bijvoorbeeld 1234 AB.`;
      else if (w && v.type === 'number' && Number.isNaN(Number(w))) nieuweFouten[v.id] = `"${v.label}" moet een getal zijn.`;
    }
    setFouten(nieuweFouten);
    if (Object.keys(nieuweFouten).length === 0) onVerstuurd({ secties, waarden, situatie });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Container breed>
      <nav className="utrecht-breadcrumb-nav mo-kruimel" aria-label="Kruimelpad">
        <ol className="utrecht-breadcrumb-nav__list">
          <li className="utrecht-breadcrumb-nav__item">
            <a className="utrecht-breadcrumb-nav__link utrecht-link" href="#/">Home</a>
          </li>
          <li className="utrecht-breadcrumb-nav__item" aria-current="page">Verhuizing doorgeven</li>
        </ol>
      </nav>
      <h1 className="nl-heading nl-heading--level-1">Start een proces</h1>
      <div className="mo-proces">
        <div className="mo-proces__formulier">
          <Formulier
            secties={secties}
            waarden={waarden}
            vooringevuld={vooringevuld}
            fouten={fouten}
            compleet={stap === 'klaar'}
            onWijzig={onWijzig}
            onVerstuur={onVerstuur}
          />
        </div>
        <aside className="mo-proces__chat">
          <Chat berichten={berichten} antwoorden={antwoorden} bezig={bezig} onAntwoord={onAntwoord} onOpnieuw={start} />
        </aside>
      </div>
    </Container>
  );
}
