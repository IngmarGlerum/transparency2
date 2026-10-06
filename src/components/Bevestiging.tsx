import { useState } from 'react';
import { datumNl, euro, type VeldDefinitie } from '../data';
import { BRON_INFO } from '../situatie';
import { Container } from './Layout';
import type { Inzending } from './Proces';

const VERVOLG: Record<string, string> = {
  RvIG: 'Je nieuwe gemeente verwerkt de verhuizing in de BRP. Andere overheidsorganisaties, zoals de Belastingdienst en Dienst Toeslagen, krijgen je nieuwe adres automatisch.',
  KVK: 'KVK wijzigt het bezoek- en postadres van je vestiging in het Handelsregister. Je ontvangt een bevestiging met een nieuw uittreksel.',
  Kadaster: 'De gegevens over je woning zijn gecontroleerd met de Basisregistratie Kadaster. Woon je eerst in een huurwoning, dan geven we het einde van de huur door aan Dienst Toeslagen.',
};

const toon = (v: VeldDefinitie, w: string) => (v.type === 'date' ? datumNl(w) : v.type === 'number' ? euro(w) : w) || '—';

export function Bevestiging({ inzending }: { inzending: Inzending }) {
  const bronnen = [...new Set(inzending.secties.map((s) => s.bron))];
  const [kenmerk] = useState(() => `MO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`);

  return (
    <Container>
      <h1 className="nl-heading nl-heading--level-1">Je verhuizing is doorgegeven</h1>
      <div className="utrecht-alert utrecht-alert--ok" role="status">
        <div className="utrecht-alert__content">
          <div className="utrecht-alert__message">
            <p className="utrecht-paragraph">
              Bedankt. We hebben je gegevens ontvangen en doorgestuurd naar {bronnen.map((b) => BRON_INFO[b]?.naam ?? b).join(', ')}.
              Je kenmerk is <strong>{kenmerk}</strong>. (Prototype: er is niets echt verstuurd.)
            </p>
          </div>
        </div>
      </div>

      <h2 className="nl-heading nl-heading--level-2">Wat gebeurt er nu?</h2>
      <ul className="utrecht-unordered-list">
        {bronnen.map((b) => (
          <li key={b} className="utrecht-unordered-list__item">
            <strong>{BRON_INFO[b]?.naam ?? b}:</strong> {VERVOLG[b] ?? 'Je wijziging wordt verwerkt.'}
          </li>
        ))}
      </ul>

      <h2 className="nl-heading nl-heading--level-2">Overzicht van je gegevens</h2>
      {inzending.secties.map((s) => (
        <section key={s.titel} className="mo-overzicht">
          <h3 className="nl-heading nl-heading--level-3">
            {s.titel} <span className="mo-bron">Bron: {BRON_INFO[s.bron]?.naam ?? s.bron}</span>
          </h3>
          <dl className="utrecht-data-list utrecht-data-list--rows">
            {s.velden.map((v) => (
              <div key={v.id} className="utrecht-data-list__item">
                <dt className="utrecht-data-list__item-key">{v.label}</dt>
                <dd className="utrecht-data-list__item-value utrecht-data-list__item-value--html-dd">{toon(v, inzending.waarden[v.id] ?? '')}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <p className="utrecht-paragraph">
        <a className="utrecht-button-link utrecht-button-link--html-a utrecht-button-link--secondary-action" href="#/">
          Terug naar Mijn Overheid
        </a>
      </p>
    </Container>
  );
}
