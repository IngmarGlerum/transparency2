import { Container, PrototypeMelding } from './Layout';

export function Home() {
  return (
    <>
      <section className="mo-hero">
        <Container>
          <h1 className="nl-heading nl-heading--level-1">Welkom op Mijn Overheid</h1>
          <p className="utrecht-paragraph utrecht-paragraph--lead mo-hero__lead">
            Regel je zaken met de overheid op één plek. Onze digitale assistent stelt je een paar vragen en maakt één
            formulier voor alle organisaties die het nodig hebben.
          </p>
          <a className="utrecht-button-link utrecht-button-link--html-a utrecht-button-link--primary-action mo-start" href="#/proces">
            Start een proces
          </a>
        </Container>
      </section>
      <Container>
        <PrototypeMelding />
        <h2 className="nl-heading nl-heading--level-2">Zo werkt het</h2>
        <ol className="utrecht-ordered-list mo-stappen">
          <li className="utrecht-ordered-list__item">Vertel de assistent wat je wilt regelen, bijvoorbeeld een verhuizing.</li>
          <li className="utrecht-ordered-list__item">De assistent controleert je situatie met gegevens van RvIG, KVK en het Kadaster.</li>
          <li className="utrecht-ordered-list__item">Je krijgt één formulier dat al zoveel mogelijk is ingevuld.</li>
          <li className="utrecht-ordered-list__item">Na het versturen geven wij de wijzigingen door aan alle betrokken organisaties.</li>
        </ol>
      </Container>
    </>
  );
}
