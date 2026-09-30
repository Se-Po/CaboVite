// Clădirile din afara sanctuarului, pe hartă: ce spune panoul punctului când un clic
// cade pe una, după prefixul cheii din cladiri_vN.json.
//
// Date, nu cod. Numele proprii vin din eticheta `name` a OpenStreetMap (ODbL),
// nu dintr-o sursă primară portugheză; restul descrie numai unde stă clădirea.
// Nimic de aici nu spune la ce servește o clădire.

export const CLADIRI = {
  nume_elemente: [
    // OSM, calea 156262927: name=Farol do Cabo Espichel, man_made=lighthouse.
    ['far.', 'Farol do Cabo Espichel'],
    ['cladire.156262936', 'clădirea lipită de far'],
    ['cladire.', 'clădire de lângă far'],
    // OSM, calea 96521141: name=Casa da Ronca, ruins=yes. NEVERIFICAT într-o sursă primară.
    ['ruina.96521141', 'Casa da Ronca'],
    ['ruina.', 'clădire de lângă Casa da Ronca'],
  ],
};
