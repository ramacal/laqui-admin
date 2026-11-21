// State lotteries of Argentina: one per province plus CABA, as listed by ALEA
// (Asociación de Loterías Estatales Argentinas, alea.org.ar/miembros, read 2026-11-20).
// logoUrl is where `npm run lotteries:logos` downloads the first logo from. Most are ALEA's
// small thumbnails: replace them from Plataforma → Loterías when a better file is at hand.
//
// Lotería Nacional S.E. is not an ALEA member anymore. Its Quiniela is drawn by Lotería de la
// Ciudad (code CIUDAD), so there is no separate "Nacional" row.
//
// quinielaDraws: Laqui offers its Quiniela draws (program, results, orders). Only the
// lotteries Laqui already handled; the rest are listed for their brand.

export type SeedLottery = {
  code: string;
  name: string; // short, as Quiniela shows it
  fullName: string;
  country: string; // ISO code
  province: string | null; // province code; null = a national lottery
  website: string | null;
  logoUrl: string | null;
  quinielaDraws: boolean;
};

const alea = (file: string) => `https://static.wixstatic.com/media/${file}`;

export const LOTTERIES: SeedLottery[] = [
  { code: "CIUDAD", name: "Ciudad", fullName: "Lotería de la Ciudad de Buenos Aires S.E.", country: "AR", province: "C", website: "https://www.loteriadelaciudad.gob.ar/", logoUrl: alea("4c95b9_1854fbda412a48d390f8c2d5140663ca~mv2.jpg"), quinielaDraws: true },
  { code: "PROVINCIA", name: "Provincia", fullName: "Instituto Provincial de Lotería y Casinos de la Provincia de Buenos Aires", country: "AR", province: "B", website: "https://www.loteria.gba.gob.ar/", logoUrl: alea("4c95b9_38f9e3fbce634660aa671a500aa64d53~mv2.jpg"), quinielaDraws: true },
  { code: "CATAMARCA", name: "Catamarca", fullName: "Caja de Crédito y Prestaciones Provincial Catamarca", country: "AR", province: "K", website: "https://capresca.gob.ar/", logoUrl: alea("4c95b9_88a1facce53b469dbc2b8f72737310ff~mv2.jpg"), quinielaDraws: false },
  { code: "CHACO", name: "Chaco", fullName: "Lotería Chaqueña", country: "AR", province: "H", website: "https://loteria.chaco.gov.ar/", logoUrl: alea("4c95b9_17644bb5b98247beb3122bd967accdb6~mv2.jpg"), quinielaDraws: false },
  { code: "CHUBUT", name: "Chubut", fullName: "Instituto de Asistencia Social de Chubut", country: "AR", province: "U", website: "http://loteriadelchubut.com.ar/", logoUrl: alea("4c95b9_d10657261dba43b2bf3a12b6325fc565~mv2.jpg"), quinielaDraws: false },
  { code: "CORDOBA", name: "Córdoba", fullName: "Lotería de la Provincia de Córdoba S.E.", country: "AR", province: "X", website: "https://www.loteriadecordoba.com.ar/", logoUrl: alea("8d9ed8_54bf091ae930487caac565eadac652d7~mv2.png"), quinielaDraws: true },
  { code: "CORRIENTES", name: "Corrientes", fullName: "Instituto de Lotería y Casinos de Corrientes", country: "AR", province: "W", website: "https://www.loteriacorrentina.gov.ar/", logoUrl: alea("8d9ed8_4864935860ad4541aa06c0f3fe12a540~mv2.jpeg"), quinielaDraws: false },
  { code: "ENTRE_RIOS", name: "Entre Ríos", fullName: "Instituto de Ayuda Financiera a la Acción Social de Entre Ríos (IAFAS)", country: "AR", province: "E", website: "https://www.iafas.gov.ar/", logoUrl: alea("4c95b9_eb2a022dec334bff9e08b9b106223f6f~mv2.jpg"), quinielaDraws: true },
  { code: "FORMOSA", name: "Formosa", fullName: "Instituto de Asistencia Social de Formosa", country: "AR", province: "P", website: "https://www.ias.gob.ar/", logoUrl: alea("4c95b9_d8aeffae61d340219bd21d1d0b56245c~mv2.jpg"), quinielaDraws: false },
  { code: "JUJUY", name: "Jujuy", fullName: "Instituto Provincial de Juegos de Azar de Jujuy", country: "AR", province: "Y", website: "https://inprojuy.gob.ar/", logoUrl: alea("8d9ed8_0f2ce6421e9c495c965cb8e302734b49~mv2.png"), quinielaDraws: false },
  { code: "LA_PAMPA", name: "La Pampa", fullName: "Instituto de Seguridad Social de La Pampa", country: "AR", province: "L", website: "https://www.isslapampa.gov.ar/", logoUrl: null, quinielaDraws: false },
  { code: "LA_RIOJA", name: "La Rioja", fullName: "Administración General de Juegos de Azar de La Rioja", country: "AR", province: "F", website: "http://www.ajalar.com.ar/", logoUrl: alea("4c95b9_7fe55d3145c84391a503fe0ad5bb3c39~mv2.jpg"), quinielaDraws: false },
  { code: "MENDOZA", name: "Mendoza", fullName: "Instituto Provincial de Juegos y Casinos de Mendoza", country: "AR", province: "M", website: "http://www.juegosycasinos.mendoza.gov.ar/", logoUrl: alea("8d9ed8_e54971209f30408e8cd8759b3619ca2d~mv2.png"), quinielaDraws: true },
  { code: "MISIONES", name: "Misiones", fullName: "Instituto Provincial de Lotería y Casinos S.E. de Misiones", country: "AR", province: "N", website: "http://www.loteriademisiones.com.ar/", logoUrl: alea("4c95b9_ae3659f976f24d09b0a3960ab3524500~mv2.jpg"), quinielaDraws: false },
  { code: "NEUQUEN", name: "Neuquén", fullName: "Instituto Provincial de Juegos de Azar de Neuquén", country: "AR", province: "Q", website: "https://ijan-neuquen.com/", logoUrl: alea("4c95b9_dea04f00332e4b609ea71f05d9bbd108~mv2.jpg"), quinielaDraws: false },
  { code: "RIO_NEGRO", name: "Río Negro", fullName: "Lotería para Obras de Acción Social de la Provincia de Río Negro", country: "AR", province: "R", website: "https://www.loteriaderionegro.gob.ar/", logoUrl: alea("4c95b9_fb3c6b6d476745959e56782a0e987be9~mv2.jpg"), quinielaDraws: false },
  { code: "SALTA", name: "Salta", fullName: "Ente Regulador del Juego de Azar de la Provincia de Salta", country: "AR", province: "A", website: "http://www.enrejasalta.com.ar/", logoUrl: alea("8d9ed8_99fa2eb61f0c47b9920f3cd59ff0fc83~mv2.jpg"), quinielaDraws: false },
  { code: "SAN_JUAN", name: "San Juan", fullName: "Caja de Acción Social de San Juan", country: "AR", province: "J", website: "http://cas.gob.ar/", logoUrl: alea("8d9ed8_02ddd816e1934198a8540383dee7d2b5~mv2.jpg"), quinielaDraws: false },
  { code: "SAN_LUIS", name: "San Luis", fullName: "Caja Social y Financiera de la Provincia de San Luis", country: "AR", province: "D", website: "http://www.loteriadesanluis.com/", logoUrl: alea("4c95b9_9b27ad7150a74a509587cff1c3b4bd57~mv2.jpg"), quinielaDraws: false },
  { code: "SANTA_CRUZ", name: "Santa Cruz", fullName: "Lotería para Obras de Acción Social de la Provincia de Santa Cruz", country: "AR", province: "Z", website: "http://loteriadesantacruz.gob.ar/", logoUrl: alea("4c95b9_0fe4ad44c8064de0a01c2267484b4723~mv2.jpg"), quinielaDraws: false },
  { code: "SANTA_FE", name: "Santa Fe", fullName: "Caja de Asistencia Social de la Provincia de Santa Fe", country: "AR", province: "S", website: "https://www.loteriasantafe.gov.ar/", logoUrl: alea("8d9ed8_21d53293d0f6480baf7bd3b3eaae58cc~mv2.png"), quinielaDraws: true },
  { code: "SANTIAGO", name: "Santiago del Estero", fullName: "Caja Social de Santiago del Estero", country: "AR", province: "G", website: "http://www.cajasocial-sde.com.ar/", logoUrl: alea("4c95b9_65393bce707743f9bcbdaa60f2d3e999~mv2.jpg"), quinielaDraws: false },
  { code: "TIERRA_DEL_FUEGO", name: "Tierra del Fuego", fullName: "Instituto Provincial de Regulación de Apuestas de Tierra del Fuego (IPRA)", country: "AR", province: "V", website: "http://www.ipra.gov.ar/", logoUrl: alea("4c95b9_cca92cff3052406f9b743869c0026122~mv2.jpg"), quinielaDraws: false },
  { code: "TUCUMAN", name: "Tucumán", fullName: "Caja Popular de Ahorros de la Provincia de Tucumán", country: "AR", province: "T", website: "http://www.cajapopular.gov.ar/", logoUrl: alea("4c95b9_e71cb8d77aec429ba278863b57cfa16e~mv2.jpg"), quinielaDraws: false },
  { code: "MONTEVIDEO", name: "Montevideo", fullName: "Dirección Nacional de Loterías y Quinielas (Uruguay)", country: "UY", province: null, website: null, logoUrl: null, quinielaDraws: true },
];
