import type { ReactNode } from 'react';

export function Header() {
  return (
    <header className="mo-header">
      <a className="nl-skip-link" href="#inhoud">
        Naar de inhoud
      </a>
      <div className="mo-logo-wrap">
        <a className="mo-logo" href="#/" aria-label="Mijn Overheid, naar de homepage">
          <span className="mo-logo__lint" aria-hidden="true" />
          <span className="mo-logo__tekst">
            <span className="mo-logo__titel">Mijn Overheid</span>
            <span className="mo-logo__sub">Prototype</span>
          </span>
        </a>
      </div>
      <nav className="mo-nav" aria-label="Hoofdmenu">
        <ul className="mo-nav__lijst">
          <li>
            <a className="mo-nav__link" href="#/">
              Home
            </a>
          </li>
          <li>
            <a className="mo-nav__link" href="#/proces">
              Zaken regelen
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mo-footer">
      <div className="mo-container">
        <p className="mo-footer__tagline">Prototype: één formulier voor verhuizen, met gegevens van RvIG, KVK en Kadaster.</p>
        <ul className="mo-footer__links">
          <li>Er worden geen gegevens verstuurd</li>
          <li>Testgegevens uit CSV-bestanden</li>
          <li>Gebouwd met NL Design System</li>
        </ul>
      </div>
    </footer>
  );
}

export function PrototypeMelding() {
  return (
    <div className="utrecht-alert utrecht-alert--info mo-prototype" role="note">
      <div className="utrecht-alert__content">
        <div className="utrecht-alert__message">
          <p className="utrecht-paragraph">
            <strong>Dit is een prototype.</strong> Deze website is geen officiële overheidsdienst. Alle gegevens zijn
            fictieve testgegevens.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Container({ children, breed = false }: { children: ReactNode; breed?: boolean }) {
  return <div className={breed ? 'mo-container mo-container--breed' : 'mo-container'}>{children}</div>;
}
