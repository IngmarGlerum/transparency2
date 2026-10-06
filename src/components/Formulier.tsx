import type { FormEvent } from 'react';
import { datumNl, euro, mooiePostcode, type VeldDefinitie } from '../data';
import { BRON_INFO, type Sectie } from '../situatie';

interface Props {
  secties: Sectie[];
  waarden: Record<string, string>;
  vooringevuld: Record<string, string>;
  fouten: Record<string, string>;
  compleet: boolean;
  onWijzig: (id: string, waarde: string) => void;
  onVerstuur: () => void;
}

/** Een veld met een waarde uit een register is alleen-lezen, tenzij het bewerkbaar is of de registratie leeg is. */
const isAlleenLezen = (v: VeldDefinitie, vooringevuld: string) => !v.bewerkbaar && vooringevuld !== '';

function weergave(v: VeldDefinitie, waarde: string) {
  if (v.type === 'date') return datumNl(waarde);
  if (v.type === 'number') return euro(waarde);
  if (v.type === 'postcode') return mooiePostcode(waarde);
  return waarde;
}

function Veld({ v, waarde, alleenLezen, fout, onWijzig }: { v: VeldDefinitie; waarde: string; alleenLezen: boolean; fout?: string; onWijzig: (w: string) => void }) {
  const id = `veld-${v.id}`;
  const beschrijving = v.uitleg ? `${id}-uitleg` : undefined;
  const foutId = fout ? `${id}-fout` : undefined;
  const describedBy = [beschrijving, foutId].filter(Boolean).join(' ') || undefined;
  const label = (
    <>
      {v.label}
      {!v.verplicht && <span className="mo-optioneel"> (niet verplicht)</span>}
    </>
  );

  if (v.type === 'radio' && !alleenLezen) {
    return (
      <div className={`utrecht-form-fieldset utrecht-form-fieldset--distanced${fout ? ' utrecht-form-fieldset--invalid' : ''}`} data-veld={v.id}>
        <fieldset className="utrecht-form-fieldset__fieldset utrecht-form-fieldset--html-fieldset" aria-describedby={describedBy} aria-invalid={fout ? true : undefined}>
          <legend className="utrecht-form-fieldset__legend utrecht-form-fieldset__legend--html-legend">{label}</legend>
          {v.uitleg && (
            <div id={beschrijving} className="utrecht-form-field-description">
              {v.uitleg}
            </div>
          )}
          {fout && (
            <div id={foutId} className="utrecht-form-field-error-message">
              {fout}
            </div>
          )}
          {v.opties.map((o, i) => (
            <div key={o} className="utrecht-form-field utrecht-form-field--radio">
              <div className="utrecht-form-field__input">
                <input
                  type="radio"
                  id={`${id}-${i}`}
                  name={id}
                  className={`utrecht-radio-button utrecht-radio-button--html-input${fout ? ' utrecht-radio-button--invalid' : ''}`}
                  checked={waarde === o}
                  onChange={() => onWijzig(o)}
                />
              </div>
              <div className="utrecht-form-field__label utrecht-form-field__label--radio">
                <label className="utrecht-form-label utrecht-form-label--radio" htmlFor={`${id}-${i}`}>
                  {o}
                </label>
              </div>
            </div>
          ))}
        </fieldset>
      </div>
    );
  }

  const inputType = alleenLezen ? 'text' : v.type === 'date' ? 'date' : v.type === 'tel' ? 'tel' : 'text';
  return (
    <div className={`utrecht-form-field utrecht-form-field--text utrecht-form-field--distanced${fout ? ' utrecht-form-field--invalid' : ''}`} data-veld={v.id}>
      <div className="utrecht-form-field__label">
        <label className="utrecht-form-label" htmlFor={id}>
          {label}
        </label>
      </div>
      {v.uitleg && (
        <div id={beschrijving} className="utrecht-form-field-description">
          {v.uitleg}
        </div>
      )}
      {fout && (
        <div id={foutId} className="utrecht-form-field-error-message">
          {fout}
        </div>
      )}
      <div className="utrecht-form-field__input">
        <input
          id={id}
          type={inputType}
          inputMode={v.type === 'number' ? 'numeric' : undefined}
          className={[
            'utrecht-textbox utrecht-textbox--html-input',
            alleenLezen && 'utrecht-textbox--read-only mo-alleen-lezen',
            fout && 'utrecht-textbox--invalid',
            v.type === 'postcode' && 'utrecht-textbox--postal-code-nl-size',
          ]
            .filter(Boolean)
            .join(' ')}
          value={alleenLezen ? weergave(v, waarde) : waarde}
          readOnly={alleenLezen}
          aria-describedby={describedBy}
          aria-invalid={fout ? true : undefined}
          required={v.verplicht}
          onChange={(e) => onWijzig(e.target.value)}
        />
      </div>
    </div>
  );
}

export function Formulier({ secties, waarden, vooringevuld, fouten, compleet, onWijzig, onVerstuur }: Props) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onVerstuur();
  };
  const foutLijst = Object.entries(fouten);

  if (secties.length === 0) {
    return (
      <div className="mo-formulier mo-formulier--leeg">
        <h2 className="nl-heading nl-heading--level-2">Jouw formulier</h2>
        <p className="utrecht-paragraph">
          Hier verschijnt je formulier. Beantwoord de vragen van de assistent; op basis van je situatie voegen we velden
          toe uit de registraties van <strong>RvIG</strong>, <strong>KVK</strong> en het <strong>Kadaster</strong>.
        </p>
      </div>
    );
  }

  return (
    <form className="mo-formulier" onSubmit={submit} noValidate>
      <h2 className="nl-heading nl-heading--level-2">Jouw formulier: verhuizing doorgeven</h2>
      <p className="utrecht-paragraph">
        Gegevens met een grijze achtergrond komen uit een overheidsregistratie. Klopt iets niet? Neem dan contact op met
        de organisatie die bij het blok staat.
      </p>

      {foutLijst.length > 0 && (
        <div className="utrecht-alert utrecht-alert--error" role="alert">
          <div className="utrecht-alert__content">
            <div className="utrecht-alert__message">
              <p className="utrecht-paragraph">
                <strong>Controleer de volgende velden:</strong>
              </p>
              <ul className="utrecht-unordered-list">
                {foutLijst.map(([id, f]) => (
                  <li key={id} className="utrecht-unordered-list__item">
                    <a className="utrecht-link" href={`#veld-${id}`} onClick={(e) => {
                        e.preventDefault();
                        (document.getElementById(`veld-${id}`) ?? document.getElementsByName(`veld-${id}`)[0])?.focus();
                      }}>
                      {f}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {secties.map((s) => {
        const bron = BRON_INFO[s.bron] ?? { naam: s.bron, register: '' };
        return (
          <section key={s.titel} className={`mo-sectie mo-sectie--${s.bron.toLowerCase()}`} aria-labelledby={`sectie-${s.titel}`}>
            <div className="mo-sectie__kop">
              <h3 id={`sectie-${s.titel}`} className="nl-heading nl-heading--level-3">
                {s.titel}
              </h3>
              <span className="mo-bron" title={bron.register}>
                Bron: {bron.naam}
                {bron.register && <span className="mo-bron__register"> · {bron.register}</span>}
              </span>
            </div>
            {s.velden.map((v) => (
              <Veld
                key={v.id}
                v={v}
                waarde={waarden[v.id] ?? ''}
                alleenLezen={isAlleenLezen(v, vooringevuld[v.id] ?? '')}
                fout={fouten[v.id]}
                onWijzig={(w) => onWijzig(v.id, w)}
              />
            ))}
          </section>
        );
      })}

      {compleet ? (
        <div className="utrecht-button-group mo-acties">
          <button type="submit" className="utrecht-button utrecht-button--primary-action utrecht-button--submit">
            Controleren en versturen
          </button>
        </div>
      ) : (
        <p className="utrecht-paragraph mo-wacht">Beantwoord eerst alle vragen van de assistent. Daarna kun je het formulier versturen.</p>
      )}
    </form>
  );
}
