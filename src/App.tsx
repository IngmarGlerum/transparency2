import { useEffect, useState } from 'react';
import { laadDatasets, type Datasets } from './data';
import { Bevestiging } from './components/Bevestiging';
import { Home } from './components/Home';
import { Container, Footer, Header } from './components/Layout';
import { Proces, type Inzending } from './components/Proces';

const huidigeRoute = () => window.location.hash.replace(/^#/, '') || '/';

export default function App() {
  const [route, setRoute] = useState(huidigeRoute);
  const [data, setData] = useState<Datasets>();
  const [fout, setFout] = useState<string>();
  const [inzending, setInzending] = useState<Inzending>();

  useEffect(() => {
    const opWijziging = () => {
      setRoute(huidigeRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', opWijziging);
    return () => window.removeEventListener('hashchange', opWijziging);
  }, []);

  useEffect(() => {
    laadDatasets().then(setData, (e: Error) => setFout(e.message));
  }, []);

  const verstuurd = (i: Inzending) => {
    setInzending(i);
    window.location.hash = '/bevestiging';
  };

  let inhoud;
  if (route === '/proces' || (route === '/bevestiging' && !inzending)) {
    inhoud = fout ? (
      <Container>
        <div className="utrecht-alert utrecht-alert--error" role="alert">
          <p className="utrecht-paragraph">De gegevens konden niet worden geladen: {fout}</p>
        </div>
      </Container>
    ) : data ? (
      <Proces data={data} onVerstuurd={verstuurd} />
    ) : (
      <Container>
        <p className="utrecht-paragraph">Gegevens laden…</p>
      </Container>
    );
  } else if (route === '/bevestiging' && inzending) {
    inhoud = <Bevestiging inzending={inzending} />;
  } else {
    inhoud = <Home />;
  }

  return (
    <div className="mo-pagina">
      <Header />
      <main id="inhoud" className="mo-main">
        {inhoud}
      </main>
      <Footer />
    </div>
  );
}
