import { useEffect, useRef, useState, type FormEvent } from 'react';

export interface ChatBericht {
  id: number;
  van: 'bot' | 'gebruiker';
  tekst: string;
}

/** Zet **vet** om naar <strong>, zonder HTML te injecteren. */
function Opgemaakt({ tekst }: { tekst: string }) {
  return (
    <>
      {tekst.split(/(\*\*[^*]+\*\*)/g).map((deel, i) =>
        deel.startsWith('**') ? <strong key={i}>{deel.slice(2, -2)}</strong> : <span key={i}>{deel}</span>,
      )}
    </>
  );
}

interface Props {
  berichten: ChatBericht[];
  antwoorden: string[];
  bezig: boolean;
  onAntwoord: (tekst: string) => void;
  onOpnieuw: () => void;
}

export function Chat({ berichten, antwoorden, bezig, onAntwoord, onOpnieuw }: Props) {
  const [invoer, setInvoer] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [berichten, bezig]);

  const verstuur = (e: FormEvent) => {
    e.preventDefault();
    if (!invoer.trim() || bezig) return;
    onAntwoord(invoer.trim());
    setInvoer('');
  };

  return (
    <section className="mo-chat" aria-labelledby="chat-titel">
      <div className="mo-chat__kop">
        <h2 id="chat-titel" className="nl-heading nl-heading--level-3">
          Digitale assistent
        </h2>
        <button type="button" className="utrecht-button utrecht-button--subtle mo-chat__opnieuw" onClick={onOpnieuw}>
          Opnieuw beginnen
        </button>
      </div>
      <div className="mo-chat__log" ref={logRef} role="log" aria-live="polite">
        {berichten.map((b) => (
          <div key={b.id} className={`mo-bericht mo-bericht--${b.van}`}>
            <span className="rhc-visually-hidden">{b.van === 'bot' ? 'Assistent: ' : 'Jij: '}</span>
            <Opgemaakt tekst={b.tekst} />
          </div>
        ))}
        {bezig && (
          <div className="mo-bericht mo-bericht--bot mo-bericht--typen" aria-label="De assistent typt">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
      {!bezig && antwoorden.length > 0 && (
        <div className="mo-chat__suggesties" aria-label="Snelle antwoorden">
          {antwoorden.map((a) => (
            <button key={a} type="button" className="utrecht-button utrecht-button--secondary-action mo-suggestie" onClick={() => onAntwoord(a)}>
              {a}
            </button>
          ))}
        </div>
      )}
      <form className="mo-chat__invoer" onSubmit={verstuur}>
        <label htmlFor="chat-invoer" className="rhc-visually-hidden">
          Je antwoord
        </label>
        <input
          id="chat-invoer"
          className="utrecht-textbox utrecht-textbox--html-input"
          value={invoer}
          onChange={(e) => setInvoer(e.target.value)}
          placeholder="Typ je antwoord…"
          autoComplete="off"
        />
        <button type="submit" className="utrecht-button utrecht-button--primary-action" disabled={bezig || !invoer.trim()}>
          Verstuur
        </button>
      </form>
    </section>
  );
}
