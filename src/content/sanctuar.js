// Fișa Santuário de Nossa Senhora do Cabo Espichel: textul care se deschide din
// eticheta de pe hartă.
//
// Date, nu cod. Fiecare afirmație are sursa ei primară, cu adresa de unde se
// poate citi, și a trecut prin agentul verificator-surse (2026-09-29; ce s-a schimbat
// în v0.0.11, pe 2026-09-30). Fișa SIPA
// (monumentos.gov.pt) nu mai răspunde; se citește din Arquivo.pt, arhiva web
// portugheză. La fel fișa Património Cultural, a cărei adresă nouă refuză
// cererile automate. Unde sursele se contrazic, se spune.

const SIPA = {
  nume: 'SIPA, fișa IPA.00006165',
  url: 'https://arquivo.pt/noFrame/replay/20240101000000/http://www.monumentos.gov.pt/Site/APP_PagesUser/SIPA.aspx?id=6165',
};
const PATRIMONIO = {
  nume: 'Património Cultural, fișa 73479',
  url: 'https://arquivo.pt/noFrame/replay/20200101000000/http://www.patrimoniocultural.gov.pt/pt/patrimonio/patrimonio-imovel/pesquisa-do-patrimonio/classificado-ou-em-vias-de-classificacao/geral/view/73479',
};
const CAMARA = {
  nume: 'Câmara Municipal de Sesimbra',
  url: 'https://www.sesimbra.pt/conhecer/patrimonio/patrimonio-edificado/santuario-do-cabo',
};
const VISIT_SESIMBRA = {
  nume: 'Visit Sesimbra',
  url: 'https://www.visitsesimbra.pt/to-visit/62/santu-rio-do-cabo-espichel',
};
const REVIVE_ANEXA = {
  nume: 'Margarida Elias, memoria istorică anexată concursului REVIVE (anexa 3)',
  url: 'https://revive.turismodeportugal.pt/sites/default/files/CE_Anexo3_MemoriaHistorica_CaboEspichel.pdf',
};
const REVIVE_PAGINA = {
  nume: 'REVIVE, pagina Santuário do Cabo Espichel',
  url: 'https://revive.turismodeportugal.pt/pt-pt/santuario-espichel',
};
const CAMARA_TEMPORADA = {
  nume: 'Câmara Municipal de Sesimbra, Temporada de Música da Casa da Ópera',
  url: 'https://www.sesimbra.pt/agenda-online/evento/temporada-de-musica-da-casa-de-opera-do-cabo-espichel-64',
};
const PINHO_LEAL = {
  nume: 'Pinho Leal, Portugal Antigo e Moderno, vol. IX (1880), p. 137',
  url: 'https://archive.org/stream/portugalantigoe06ferrgoog#page/n141/mode/1up',
};
const PINHO_LEAL_138 = {
  nume: 'Pinho Leal, Portugal Antigo e Moderno, vol. IX (1880), p. 138',
  url: 'https://archive.org/stream/portugalantigoe06ferrgoog#page/n142/mode/1up',
};

export const SANCTUAR = {
  nume: 'Santuário de Nossa Senhora do Cabo Espichel',
  eticheta: 'Santuário de Nossa Senhora do Cabo Espichel',
  fapte: [
    {
      text: 'Cultul Nossa Senhora do Cabo e atestat din 1366, într-un document din cancelaria regelui D. Pedro I, care pomenește drumurile de pelerinaj spre Santa Maria do Cabo.',
      surse: [SIPA, CAMARA],
    },
    {
      text: 'Ermida da Memória, capela mică de lângă faleză, a fost ridicată în secolul al XV-lea, după tradiție în locul unde a fost găsită imaginea Fecioarei.',
      surse: [SIPA],
    },
    {
      text: 'Biserica de azi a fost începută în 1701, pe locul uneia mai vechi, și inaugurată în iulie 1707, când imaginea Fecioarei a fost mutată în ea din ermidă. Proiectul e atribuit, fără unanimitate, arhitectului regal João Antunes; Património Cultural dă ca alternativă pe părintele Francisco Tinoco da Silva.',
      surse: [SIPA, REVIVE_ANEXA, PATRIMONIO],
    },
    {
      text: 'Casele pelerinilor — cele două aripi lungi, cu arcade la parter — au fost începute în 1715. Lucrările s-au intensificat între 1745 și 1760, iar aripa de nord a fost prelungită în 1794.',
      surse: [SIPA],
    },
    {
      text: 'În 1880, Pinho Leal număra 63 de arce la aripa de nord și 47 la cea de sud, sub o arcadă comună, pe sub care se putea ajunge la biserică ferit de soare și de ploaie.',
      surse: [PINHO_LEAL],
    },
    {
      text: 'Între aripi stă terreiro-ul, o piață dreptunghiulară de 27 m lățime și circa 150 m lungime, cu un cruzeiro — o cruce pe o platformă cu trei trepte — la capătul de est.',
      surse: [SIPA],
    },
    {
      text: 'Casa da Água, hexagonală, e din 1770; din azulejos-urile ei, plăcile smălțuite de la Fábrica de Belém, au rămas doar urme. În ea se termină apeductul sanctuarului, construit tot atunci: circa 2 km, de la izvorul din Azóia.',
      surse: [SIPA],
    },
    {
      text: 'Casa da Ópera, din care azi au rămas doar urme, a fost ridicată în 1770 de círio-ul din Lisabona — o confrerie de pelerini —, cu decoruri și amenajări.',
      surse: [SIPA, REVIVE_ANEXA, CAMARA_TEMPORADA],
    },
    {
      text: 'Biserica, casele pelerinilor și terreiro-ul sunt clasate Imóvel de Interesse Público prin Decretul nr. 37 728 din 5 ianuarie 1950.',
      surse: [PATRIMONIO, SIPA],
    },
  ],
  conflicte: [
    {
      text: 'Visit Sesimbra, portalul turistic al Câmarei, datează Casa da Ópera „de finais de oitocentos" — de la sfârșitul secolului al XIX-lea —, în aceeași frază care așază edificiile principale între 1701 și 1770; pagina REVIVE a imobilului repetă datarea. Niciuna nu spune pe ce se sprijină. Memoria istorică anexată concursului REVIVE și pagina de agendă a Câmarei o pun în 1770, iar în 1880 Pinho Leal o găsea deja uzată, cu rândul de loje de odinioară înlocuit de o galerie.',
      surse: [VISIT_SESIMBRA, REVIVE_PAGINA, REVIVE_ANEXA, CAMARA_TEMPORADA, PINHO_LEAL_138],
    },
  ],
  // Ce spune panoul punctului când un clic cade pe o clădire, după prefixul cheii
  // din sanctuar_vN.json. Numele portugheze sunt cele din fișa SIPA.
  nume_elemente: [
    ['biserica.', 'Igreja de Nossa Senhora do Cabo'],
    ['aripa_n.corp_legatura', 'corpul de legătură dintre biserică și aripa de nord'],
    ['aripa_s.corp_legatura', 'corpul de legătură dintre biserică și aripa de sud'],
    ['aripa_s.est_cafenea', 'capătul de est al aripii de sud (cafeneaua)'],
    ['aripa_n.', 'casele pelerinilor, aripa de nord'],
    ['aripa_s.', 'casele pelerinilor, aripa de sud'],
    ['fatada', 'Igreja de Nossa Senhora do Cabo, fațada'],
    ['casa_agua', 'Casa da Água'],
    ['ermida', 'Ermida da Memória'],
    ['casa_opera', 'Casa da Ópera, în ruină'],
    ['ruina_nv', 'ruină la nord-vest de biserică'],
    ['ruina_se', 'ruină la sud-est de terreiro'],
    ['cercado', 'zidul cercado-ului, incinta Casei da Água'],
    ['apeduct', 'apeductul Casei da Água'],
    ['cruzeiro', 'cruzeiro-ul terreiro-ului'],
    ['ruine_spate_n', 'încăperi în ruină din spatele aripii de nord'],
    ['toalete', 'toaletele'],
    ['casuta_cercado', 'căsuța de lângă colțul de sud-est al cercado-ului'],
  ],
  despre_model: 'Acoperișurile sunt măsurate pe LiDAR-ul DGT din 2024–2025, pe modelul de suprafață, acolo unde acesta trece cu peste un metru de teren. Biserica și aripile sunt conturate pe aceleași măsurători; Casa da Água, Casa da Ópera, zidurile, apeductul și suprafețele de pe teren iau conturul din OpenStreetMap. Arcadele, ferestrele și portalurile sunt citite pe o fotografie rectificată. Unde fotografia nu ajunge — cam trei sferturi din lungimea aripilor —, arcele și ferestrele etajului sunt câte le-a numărat Pinho Leal în 1880, împărțite la pas egal: numărul are sursă, pozițiile nu sunt măsurate. Ornamentele sunt simplificate.',
};
