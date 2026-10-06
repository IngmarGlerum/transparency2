import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';

export interface Rapport {
  titel: string;
  kenmerk: string;
  datum: string;
  intro: string;
  vervolg: { organisatie: string; tekst: string }[];
  secties: { titel: string; bron: string; rijen: [string, string][] }[];
}

const LINTBLAUW = '#154273';
const GRIJS = '#545d68';

/** Maakt een PDF van het bevestigingsrapport en biedt die aan als download. pdfmake wordt pas bij gebruik geladen. */
export async function downloadRapportPdf(r: Rapport, bestandsnaam: string) {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  pdfMake.addVirtualFileSystem(vfs);

  const secties: Content[] = r.secties.flatMap((s) => [
    { text: s.titel, style: 'kop3', margin: [0, 14, 0, 2] },
    { text: `Bron: ${s.bron}`, style: 'bron', margin: [0, 0, 0, 6] },
    {
      table: {
        widths: ['40%', '60%'],
        body: s.rijen.map(([label, waarde]) => [
          { text: label, bold: true },
          { text: waarde },
        ]),
      },
      layout: {
        hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length ? 0 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => '#cad0d6',
        paddingTop: () => 4,
        paddingBottom: () => 4,
      },
    },
  ]);

  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [50, 90, 50, 60],
    info: { title: `${r.titel} – ${r.kenmerk}`, author: 'Mijn Overheid (prototype)' },
    header: {
      margin: [50, 0, 50, 0],
      columns: [
        { canvas: [{ type: 'rect', x: 0, y: 0, w: 28, h: 56, color: LINTBLAUW }], width: 40 },
        {
          stack: [
            { text: 'Mijn Overheid', bold: true, fontSize: 12 },
            { text: 'Prototype', italics: true, fontSize: 9, color: GRIJS },
          ],
          margin: [0, 22, 0, 0],
        },
      ],
    },
    footer: (pagina, totaal) => ({
      margin: [50, 20, 50, 0],
      columns: [
        { text: `Kenmerk ${r.kenmerk} · Prototype: er is niets echt verstuurd`, fontSize: 8, color: GRIJS },
        { text: `Pagina ${pagina} van ${totaal}`, alignment: 'right', fontSize: 8, color: GRIJS },
      ],
    }),
    content: [
      { text: r.titel, style: 'kop1' },
      {
        table: {
          widths: ['auto', '*'],
          body: [
            [{ text: 'Kenmerk', bold: true }, r.kenmerk],
            [{ text: 'Datum', bold: true }, r.datum],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 10],
      },
      { text: r.intro, margin: [0, 0, 0, 6] },
      { text: 'Wat gebeurt er nu?', style: 'kop2' },
      { ul: r.vervolg.map((v) => ({ text: [{ text: `${v.organisatie}: `, bold: true }, v.tekst], margin: [0, 0, 0, 4] })) },
      { text: 'Overzicht van je gegevens', style: 'kop2' },
      ...secties,
    ],
    styles: {
      kop1: { fontSize: 20, bold: true, color: LINTBLAUW, margin: [0, 0, 0, 10] },
      kop2: { fontSize: 14, bold: true, color: LINTBLAUW, margin: [0, 16, 0, 6] },
      kop3: { fontSize: 11.5, bold: true },
      bron: { fontSize: 8.5, color: GRIJS, italics: true },
    },
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.25 },
  };

  await pdfMake.createPdf(doc).download(bestandsnaam);
}
