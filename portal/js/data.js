/* Studiovest portal — dummydata.
   Alle navn, adresser, firma, priser og tall er oppdiktet for å vise hvordan portalen ser ut.
   Datoer regnes relativt til i dag, så demoen alltid ser fersk ut. */
(function () {
  'use strict';

  // ---------- dato-hjelpere ----------
  var now = new Date(); now.setHours(0, 0, 0, 0);
  // "Arbeidsdag 0": i dag hvis hverdag, ellers neste mandag
  var base = new Date(now);
  while (base.getDay() === 0 || base.getDay() === 6) base.setDate(base.getDate() + 1);
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function wd(n) { // n arbeidsdager fra base (kan være negativ)
    var d = new Date(base), step = n < 0 ? -1 : 1, left = Math.abs(n);
    while (left > 0) { d.setDate(d.getDate() + step); if (d.getDay() !== 0 && d.getDay() !== 6) left--; }
    return d;
  }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function W(n) { return iso(wd(n)); }
  function D(n) { return iso(addDays(now, n)); }

  // ---------- liten deterministisk tilfeldighet ----------
  var seed = 7;
  function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }

  var P = '../assets/photos/';
  var img = {
    stue: P + 'bolig-stue.jpg', kjokken: P + 'bolig-kjokken.jpg', loft: P + 'bolig-loft.jpg',
    tomanns: P + 'bolig-tomannsbolig.jpg', hytte: P + 'bolig-hytte.jpg',
    portrett: P + 'bedrift-portrett.jpg', kontor: P + 'bedrift-kontor.jpg', bygg: P + 'bedrift-bygg.jpg',
    sveiser: P + 'maritim-sveiser.jpg', skip: P + 'maritim-skip.jpg', kai: P + 'maritim-fiskebat.jpg',
    latter: P + 'skole-latter.jpg', lek: P + 'skole-lek.jpg', klasse: P + 'skole-klasse.jpg'
  };

  // ---------- team ----------
  var team = [
    { id: 'ak', name: 'Aleksander Koløy', role: 'Daglig leder · fotograf · drone', short: 'AK' },
    { id: 'hv', name: 'Hanne Vik', role: 'Fotograf · video', short: 'HV' },
    { id: 'ed', name: 'Redigering', role: 'Etterarbeid (ekstern)', short: 'RE' }
  ];

  // ---------- tjenester bolig ----------
  var boligServices = [
    { id: 'f20', name: 'Boligfoto, 20 bilder', price: 3490, min: 60, group: 'Foto', on: true, desc: 'Interiør og eksteriør. Passer leiligheter.' },
    { id: 'f30', name: 'Boligfoto, 30 bilder', price: 4290, min: 90, group: 'Foto', on: true, desc: 'Eneboliger og større leiligheter.' },
    { id: 'f40', name: 'Boligfoto, 40 bilder', price: 5190, min: 120, group: 'Foto', on: true, desc: 'Store eiendommer, gårdsbruk, næring.' },
    { id: 'dr', name: 'Dronefoto, 8 bilder', price: 1900, min: 30, group: 'Luft', on: true, desc: 'Avhengig av vær. Flyttes kostnadsfritt ved regn og vind.' },
    { id: 'kv', name: 'Kveldsbilde', price: 1200, min: 30, group: 'Foto', on: true, desc: 'Ekte skumring på stedet, eller digital kveld merket som illustrasjon.' },
    { id: 'vi', name: 'Boligvideo, 60–90 sek', price: 6900, min: 90, group: 'Video', on: true, desc: 'Liggende til Finn og nettside.' },
    { id: 're', name: 'SoMe-reel 9:16', price: 2900, min: 45, group: 'Video', on: true, desc: 'Stående klipp til Instagram, Facebook og TikTok.' },
    { id: 'p2', name: 'Plantegning 2D', price: 1490, min: 30, group: 'Plantegning', on: true, desc: 'Målt opp på stedet, levert innen 2 virkedager.' },
    { id: 'p3', name: 'Plantegning 3D', price: 2490, min: 30, group: 'Plantegning', on: true, desc: 'Møblert 3D, i tillegg til 2D.' },
    { id: '36', name: '360°-visning', price: 2900, min: 45, group: 'Video', on: false, desc: 'Virtuell visning. Aktiveres når utstyr er på plass.' },
    { id: 'vm', name: 'Digital møblering, per bilde', price: 390, min: 0, group: 'Etterarbeid', on: true, desc: 'Merkes alltid «Illustrasjon» i leveransen.' },
    { id: 'ex', name: 'Ekspress, levert innen 24 t', price: 900, min: 0, group: 'Tillegg', on: true, desc: 'Prioritert redigering.' }
  ];

  var offices = [
    { id: 'fjm', name: 'Fjordmegling Stord', town: 'Leirvik', agreement: 'Kontorpris −8 %', invoice: 'Samlefaktura til kontoret, EHF', brokers: ['Kari Lunde', 'Jonas Myklebust', 'Sigrid Tveit'], ytd: 312400 },
    { id: 'kmh', name: 'Kystmegleren Haugesund', town: 'Haugesund', agreement: 'Listepris', invoice: 'Per oppdrag, til megler', brokers: ['Eirik Sæther', 'Line Hovda'], ytd: 188900 },
    { id: 'sue', name: 'Sunnhordland Eiendom', town: 'Husnes', agreement: 'Kontorpris −5 %', invoice: 'Samlefaktura månedlig', brokers: ['Tone Rydland', 'Martin Opsal'], ytd: 241300 },
    { id: 'hbm', name: 'Hardanger Boligmegling', town: 'Rosendal', agreement: 'Listepris', invoice: 'Per oppdrag', brokers: ['Ole Bjørkås'], ytd: 64200 }
  ];

  var stages = ['Bestilt', 'Planlagt', 'Fotografert', 'Redigering', 'Levert'];

  var boligJobs = [
    { id: 'B-2611', addr: 'Sjøgata 14', town: 'Leirvik', office: 'fjm', broker: 'Kari Lunde', nr: '1126-0418', stage: 'Planlagt', date: W(0), time: '09:00', services: ['f30', 'dr', 'p2'], seller: 'Per og Anne Hauge', phone: '912 34 567', access: 'Selger hjemme', type: 'Enebolig', cover: img.tomanns, by: 'ak', weather: 'Lettskyet, 4 m/s' },
    { id: 'B-2612', addr: 'Kvernhusvegen 3B', town: 'Husnes', office: 'sue', broker: 'Tone Rydland', nr: '2026-0771', stage: 'Planlagt', date: W(0), time: '11:30', services: ['f20', 'p2'], seller: 'Lene Aasen', phone: '934 11 208', access: 'Nøkkel hos megler', type: 'Leilighet', cover: img.stue, by: 'ak', weather: '' },
    { id: 'B-2613', addr: 'Nesvegen 41', town: 'Halsnøy', office: 'fjm', broker: 'Jonas Myklebust', nr: '1126-0422', stage: 'Planlagt', date: W(0), time: '14:00', services: ['f40', 'dr', 'vi', 're', 'kv'], seller: 'Familien Øvrebø', phone: '975 02 331', access: 'Selger hjemme', type: 'Fritidsbolig', cover: img.hytte, by: 'ak', weather: 'Opphold, 6 m/s' },
    { id: 'B-2608', addr: 'Skeisvegen 9', town: 'Stord', office: 'fjm', broker: 'Sigrid Tveit', nr: '1126-0409', stage: 'Redigering', date: W(-1), time: '10:00', services: ['f30', 'p2', 'p3'], seller: 'Ingrid Brekke', phone: '416 90 554', access: 'Nøkkelboks', type: 'Rekkehus', cover: img.kjokken, by: 'hv', due: W(0) },
    { id: 'B-2607', addr: 'Fjellsætervegen 22', town: 'Haugesund', office: 'kmh', broker: 'Eirik Sæther', nr: 'KH-26-311', stage: 'Redigering', date: W(-1), time: '13:00', services: ['f30', 'dr', 're'], seller: 'Rune Skår', phone: '992 54 310', access: 'Selger hjemme', type: 'Enebolig', cover: img.tomanns, by: 'ak', due: W(0) },
    { id: 'B-2605', addr: 'Loftsgata 5', town: 'Leirvik', office: 'fjm', broker: 'Kari Lunde', nr: '1126-0401', stage: 'Levert', date: W(-4), time: '09:30', services: ['f20', 'p2', 'vm'], seller: 'Mats Hjelmeland', phone: '948 22 017', access: 'Nøkkel hos megler', type: 'Leilighet', cover: img.loft, by: 'hv', delivered: W(-3), published: W(-2) },
    { id: 'B-2604', addr: 'Rosendalsvegen 118', town: 'Rosendal', office: 'hbm', broker: 'Ole Bjørkås', nr: 'HB-0093', stage: 'Levert', date: W(-6), time: '12:00', services: ['f40', 'dr', 'vi', 'kv'], seller: 'Dødsbo v/ Hilde Lie', phone: '907 66 281', access: 'Nøkkel hos megler', type: 'Gårdsbruk', cover: img.hytte, by: 'ak', delivered: W(-5), published: W(-4) },
    { id: 'B-2603', addr: 'Torgvegen 2', town: 'Husnes', office: 'sue', broker: 'Martin Opsal', nr: '2026-0759', stage: 'Fotografert', date: W(-1), time: '15:00', services: ['f20', 'kv'], seller: 'Aud Kvinge', phone: '955 40 902', access: 'Selger hjemme', type: 'Leilighet', cover: img.stue, by: 'hv', due: W(1) },
    { id: 'B-2614', addr: 'Bekkjarvik brygge 6', town: 'Bømlo', office: 'kmh', broker: 'Line Hovda', nr: 'KH-26-318', stage: 'Bestilt', date: W(2), time: '10:00', services: ['f30', 'dr', 'vi'], seller: 'Arne Vikse', phone: '913 87 440', access: 'Selger hjemme', type: 'Enebolig', cover: img.tomanns, by: 'ak', wish: 'Helst formiddag, før kl. 12' },
    { id: 'B-2615', addr: 'Ølve terrasse 12', town: 'Ølve', office: 'fjm', broker: 'Kari Lunde', nr: '1126-0430', stage: 'Bestilt', date: W(3), time: '13:00', services: ['f20', 're'], seller: 'Stine Nygård', phone: '480 12 776', access: 'Nøkkelboks', type: 'Leilighet', cover: img.kjokken, by: 'hv', wish: 'Fleksibel' },
    { id: 'B-2616', addr: 'Valevåg sjøhus', town: 'Sveio', office: 'kmh', broker: 'Eirik Sæther', nr: 'KH-26-320', stage: 'Bestilt', date: W(4), time: '09:00', services: ['f30', 'dr', 'kv', 'p2'], seller: 'Hans Valen', phone: '414 30 662', access: 'Selger hjemme', type: 'Fritidsbolig', cover: img.hytte, by: 'ak', wish: 'Drone avhenger av vind' },
    { id: 'B-2601', addr: 'Kyrkjevegen 7', town: 'Uskedalen', office: 'sue', broker: 'Tone Rydland', nr: '2026-0744', stage: 'Levert', date: W(-9), time: '11:00', services: ['f30', 'dr', 'p2'], seller: 'Bjørn Rabben', phone: '901 23 118', access: 'Selger hjemme', type: 'Enebolig', cover: img.tomanns, by: 'ak', delivered: W(-8), published: W(-8), sold: W(-1) }
  ];

  // ---------- bedrift ----------
  var companies = [
    { id: 'vke', name: 'Vestkraft Energi AS', town: 'Husnes', contact: 'Marte Haugland', title: 'Kommunikasjonsansvarlig', email: 'marte@vestkraft.example', source: 'Direkte', ytd: 286500, bank: { plan: 'Medium', hours: 8, used: 5.5, rollover: 2 } },
    { id: 'hmv', name: 'Husnes Mek. Verksted', town: 'Husnes', contact: 'Geir Tofte', title: 'Daglig leder', email: 'geir@husnesmek.example', source: 'Via Kviteberg', ytd: 74800, bank: null },
    { id: 'htk', name: 'Halsnøy Tannklinikk', town: 'Halsnøy', contact: 'Silje Eide', title: 'Klinikkleder', email: 'silje@htk.example', source: 'Via Kviteberg', ytd: 21900, bank: { plan: 'Liten', hours: 4, used: 4, rollover: 0 } },
    { id: 'rfh', name: 'Rosendal Fjordhotell', town: 'Rosendal', contact: 'Andreas Moe', title: 'Markedssjef', email: 'andreas@rfh.example', source: 'Direkte', ytd: 118200, bank: { plan: 'Stor', hours: 16, used: 6, rollover: 4 } },
    { id: 'lad', name: 'Leirvik Advokatfirma', town: 'Leirvik', contact: 'Camilla Berge', title: 'Partner', email: 'camilla@lad.example', source: 'Via Kviteberg', ytd: 32400, bank: null }
  ];

  var bizStages = ['Forespørsel', 'Tilbud sendt', 'Planlegging', 'Produksjon', 'Gjennomgang', 'Levert'];
  var bizProjects = [
    { id: 'P-341', company: 'vke', title: 'Rekrutteringsfilm «Bli med på laget»', kind: 'Film', stage: 'Gjennomgang', date: W(-3), due: W(3), value: 64000, progress: 80, cover: img.sveiser,
      brief: 'Film på 90 sek og tre korte klipp til LinkedIn. Mål: flere søkere til lærlingplasser innen elektro og mekanikk.', audience: 'Ungdom 16–24 år i Sunnhordland', deliver: ['Hovedfilm 90 sek 16:9', '3 × 20 sek 9:16 med teksting', 'Stillbilder fra opptak (15)'],
      shots: [['Drone over damanlegget i morgenlys', true], ['Lærling på verkstedet, nærbilder av hender', true], ['Intervju: avdelingsleder', true], ['Intervju: lærling, 2. år', true], ['Laget på vei ut i båt', false], ['Kantina, lunsj, latter', true]],
      people: [['Ola Brekke', 'Avdelingsleder', 'Signert'], ['Emil Sandvik', 'Lærling', 'Signert'], ['Nora Fet', 'Elektriker', 'Signert'], ['Kjell Ask', 'Fagarbeider', 'Venter']] },
    { id: 'P-338', company: 'vke', title: 'Ansattportretter, 42 personer', kind: 'Portretter', stage: 'Levert', date: W(-12), due: W(-8), value: 38500, progress: 100, cover: img.portrett,
      brief: 'Ensartede portretter til nettside, intranett og presse. Lys grå bakgrunn, naturlig uttrykk.', audience: 'Nettside, presse', deliver: ['42 portretter, 2 utsnitt hver', 'Uredigerte favoritter til intern bruk'], shots: [], people: [] },
    { id: 'P-344', company: 'hmv', title: 'Verksted og folk i arbeid', kind: 'Foto', stage: 'Planlegging', date: W(4), due: W(9), value: 18900, progress: 25, cover: img.sveiser,
      brief: 'Ny nettside fra Kviteberg trenger ekte bilder: verksted, sveising, maskinpark og 6 portretter.', audience: 'Kunder i offshore og havbruk', deliver: ['40 redigerte bilder', '6 portretter'],
      shots: [['Sveising med gnister, mørk hall', false], ['Maskinpark, oversikt', false], ['Portretter ved arbeidsplassen', false], ['Fasade og skilt', false]],
      people: [['Geir Tofte', 'Daglig leder', 'Signert'], ['Arvid Lie', 'Sveiser', 'Ikke sendt']] },
    { id: 'P-345', company: 'rfh', title: 'Vintersesong: rom, mat og fjord', kind: 'Foto + video', stage: 'Produksjon', date: W(1), due: W(7), value: 42000, progress: 45, cover: img.hytte,
      brief: 'Nye bilder til booking-sider og en 30 sek film til annonser. Fokus på ro, lys og lokal mat.', audience: 'Par 30–60 år, Bergen og Oslo', deliver: ['50 bilder', 'Film 30 sek 16:9 og 9:16'],
      shots: [['Suite med fjordutsikt i blå time', false], ['Kokk anretter, nærbilde', false], ['Badstue ved sjøen', false]], people: [['Andreas Moe', 'Markedssjef', 'Signert']] },
    { id: 'P-346', company: 'lad', title: 'Partnerportretter og kontor', kind: 'Portretter', stage: 'Tilbud sendt', date: '', due: '', value: 14500, progress: 10, cover: img.kontor, brief: '5 partnere, felles bilde og kontor.', audience: 'Nettside', deliver: ['5 portretter', 'Gruppebilde', '10 kontorbilder'], shots: [], people: [] },
    { id: 'P-347', company: 'htk', title: 'Timebank november: SoMe-innhold', kind: 'Timebank', stage: 'Planlegging', date: W(5), due: W(8), value: 0, progress: 15, cover: img.kontor, brief: 'Fire innlegg: nytt behandlingsrom, team, tips om tannpuss for barn.', audience: 'Familier på Halsnøy og i Kvinnherad', deliver: ['8 bilder', '2 reels'], shots: [], people: [] },
    { id: 'P-349', company: 'rfh', title: 'Forespørsel: julebord-film', kind: 'Film', stage: 'Forespørsel', date: '', due: '', value: 0, progress: 0, cover: img.kai, brief: 'Ønsker kort film til julebordsalget. Frist for tilbud fredag.', audience: 'Bedrifter i regionen', deliver: [], shots: [], people: [] }
  ];

  var bankLog = [
    { company: 'vke', date: W(-14), h: 3, what: 'Opptak på damanlegget, drone + foto' },
    { company: 'vke', date: W(-6), h: 2.5, what: 'Portretter av to nyansatte og LinkedIn-klipp' },
    { company: 'rfh', date: W(-10), h: 4, what: 'Høstmeny, matbilder og kjøkken' },
    { company: 'rfh', date: W(-2), h: 2, what: 'Reels fra badstue og brygge' },
    { company: 'htk', date: W(-8), h: 4, what: 'Behandlingsrom og team' }
  ];

  var videoComments = [
    { t: 6, who: 'Marte Haugland', text: 'Kan vi bruke logoen i hvit her i stedet for blå?', done: true },
    { t: 23, who: 'Marte Haugland', text: 'Nydelig dronebilde! Kan det få stå et sekund lenger?', done: true },
    { t: 41, who: 'Ola Brekke', text: 'Teksten sier «elektriker» – det skal være «energimontør».', done: false },
    { t: 67, who: 'Marte Haugland', text: 'Musikken blir litt høy under intervjuet med Emil.', done: false }
  ];

  // ---------- markedsføring ----------
  var channels = { ig: 'Instagram', fb: 'Facebook', li: 'LinkedIn', tt: 'TikTok', web: 'Nettside' };
  var posts = [
    { d: D(-6), company: 'rfh', ch: 'ig', title: 'Høstmeny-karusell', status: 'Publisert', reach: 4820 },
    { d: D(-4), company: 'vke', ch: 'li', title: 'Ny lærling: Emil', status: 'Publisert', reach: 3110 },
    { d: D(-2), company: 'htk', ch: 'fb', title: 'Velkommen til nytt behandlingsrom', status: 'Publisert', reach: 1290 },
    { d: D(1), company: 'vke', ch: 'li', title: 'Rekrutteringsfilm: teaser', status: 'Til godkjenning' },
    { d: D(2), company: 'rfh', ch: 'ig', title: 'Reel: badstue i blå time', status: 'Planlagt' },
    { d: D(4), company: 'hmv', ch: 'fb', title: 'Bak kulissene på verkstedet', status: 'Produksjon' },
    { d: D(6), company: 'vke', ch: 'web', title: 'Artikkel: Livet på damanlegget', status: 'Produksjon' },
    { d: D(8), company: 'rfh', ch: 'fb', title: 'Julebord – siste ledige datoer', status: 'Idé' },
    { d: D(9), company: 'htk', ch: 'ig', title: 'Tips: tannpuss for de minste', status: 'Til godkjenning' },
    { d: D(11), company: 'vke', ch: 'li', title: 'Rekrutteringsfilm: lansering', status: 'Planlagt' },
    { d: D(13), company: 'rfh', ch: 'tt', title: 'Kokken lager rakfisk-taco', status: 'Idé' },
    { d: D(15), company: 'hmv', ch: 'li', title: 'Ny nettside er live', status: 'Planlagt' },
    { d: D(18), company: 'vke', ch: 'ig', title: 'Portrettserie: folka bak strømmen', status: 'Idé' }
  ];
  var campaigns = [
    { company: 'vke', name: 'Lærlinger 2027', period: 'Nov–jan', budget: 25000, spent: 6200, reach: 18400, clicks: 612, goal: '40 søknader', result: '11 søknader så langt', status: 'Aktiv' },
    { company: 'rfh', name: 'Vinterpakke', period: 'Okt–des', budget: 40000, spent: 21800, reach: 52300, clicks: 1904, goal: '120 bookinger', result: '74 bookinger', status: 'Aktiv' },
    { company: 'hmv', name: 'Lansering ny nettside', period: 'Des', budget: 8000, spent: 0, reach: 0, clicks: 0, goal: '500 besøk første uke', result: '–', status: 'Planlagt' }
  ];

  // ---------- skolefoto ----------
  var first = ['Emma', 'Noah', 'Nora', 'Oskar', 'Sofie', 'Lukas', 'Ella', 'Jakob', 'Ingrid', 'Filip', 'Olivia', 'William', 'Maja', 'Henrik', 'Leah', 'Isak', 'Frida', 'Aksel', 'Selma', 'Mathias', 'Tiril', 'Elias', 'Hedda', 'Johannes', 'Live', 'Sander', 'Mia', 'Magnus', 'Vilde', 'Tobias'];
  var last = ['Haugland', 'Eide', 'Tveit', 'Rabben', 'Nygård', 'Sæbø', 'Myklebust', 'Opsal', 'Vikse', 'Kvinge', 'Skår', 'Hauge', 'Aasen', 'Lie', 'Brekke', 'Hovda', 'Rydland', 'Tofte'];
  function makeClass(name, n, teacher) {
    var list = [];
    for (var i = 0; i < n; i++) {
      var r = rnd();
      var consent = r < 0.78 ? 'Ja' : r < 0.86 ? 'Kun gruppebilde' : r < 0.9 ? 'Nei' : 'Ikke svart';
      var photo = consent === 'Nei' ? 'Skal ikke' : consent === 'Kun gruppebilde' ? 'Kun gruppe' : rnd() < 0.08 ? 'Fravær' : 'Tatt';
      list.push({ id: name + '-' + (i + 1), name: pick(first) + ' ' + pick(last), cls: name, consent: consent, photo: photo, code: 'FJT-' + name.replace(/\W/g, '') + '-' + Math.floor(rnd() * 9000 + 1000), order: photo === 'Tatt' && rnd() < 0.62 ? Math.round((rnd() * 4 + 1)) * 149 : 0, opened: rnd() < 0.86 });
    }
    return { name: name, teacher: teacher, pupils: list };
  }
  var fjordtun = ['1A', '2A', '3A', '4A', '4B', '5A', '6A', '7A'].map(function (c, i) { return makeClass(c, 18 + (i * 3) % 7, ['Randi Holm', 'Per Lunde', 'Siri Aksnes', 'Kåre Vik', 'Mona Strand', 'Trond Eik', 'Liv Hamre', 'Arne Dahl'][i]); });
  // demo-barnet (foresatt-visning) og søsken
  fjordtun[4].pupils[2] = { id: '4B-3', name: 'Emma Haugland', cls: '4B', consent: 'Ja', photo: 'Tatt', code: 'FJT-4B-7K2Q', order: 0, opened: true, sibling: '1A-5' };
  fjordtun[0].pupils[4] = { id: '1A-5', name: 'Nora Haugland', cls: '1A', consent: 'Ja', photo: 'Tatt', code: 'FJT-1A-7K2Q', order: 0, opened: true, sibling: '4B-3' };

  var schoolDays = [
    { id: 'S-fjt', school: 'Fjordtun skule', kind: 'Barneskole 1–7', town: 'Halsnøy', contact: 'Rektor Bente Sørheim', date: W(-5), phase: 'Bestilling åpen', closes: D(9), classes: fjordtun, dpa: true, retake: W(8), commission: 10, deleteAt: '24 mnd etter fotodag' },
    { id: 'S-sjb', school: 'Sjøbakken barnehage', kind: 'Barnehage, 4 avdelinger', town: 'Husnes', contact: 'Styrer Hilde Nes', date: W(3), phase: 'Forberedelse', closes: '', classes: ['Maurtua', 'Ekornet', 'Revehiet', 'Bjørnehiet'].map(function (c, i) { return makeClass(c, 12 + i * 2, ['Anne', 'Kari', 'Tore', 'Eva'][i] + ' (pedagogisk leder)'); }), dpa: true, retake: '', commission: 10, deleteAt: '24 mnd etter fotodag', friends: true },
    { id: 'S-lyu', school: 'Lyngheia ungdomsskule', kind: 'Ungdomsskole 8–10', town: 'Stord', contact: 'Inspektør Rolf Tangen', date: W(12), phase: 'Avtale', closes: '', classes: [], dpa: false, retake: '', commission: 8, deleteAt: '24 mnd etter fotodag' },
    { id: 'S-hkb', school: 'Høylandsbygd skule', kind: 'Barneskole 1–7', town: 'Høylandsbygd', contact: 'Rektor Jan Aase', date: W(-40), phase: 'Levert', closes: D(-120), classes: [], dpa: true, retake: '', commission: 10, deleteAt: '24 mnd etter fotodag', revenue: 61400, orders: 142, pupilsCount: 168 }
  ];
  // plan for fotodagen i barnehagen
  var dayPlan = [
    ['08:15', 'Rigging i gymsal', 'Studio'], ['08:45', 'Maurtua — portretter', '12 barn'], ['09:20', 'Maurtua — gruppebilde', ''], ['09:35', 'Ekornet — portretter', '14 barn'],
    ['10:15', 'Ekornet — gruppebilde', ''], ['10:30', 'Pause, frukt', ''], ['10:45', 'Revehiet — portretter', '16 barn'], ['11:30', 'Lunsj (barna)', ''],
    ['12:15', 'Bjørnehiet — portretter', '18 barn'], ['13:00', 'Vennebilder og søsken', 'Bare med samtykke fra begge familier'], ['13:45', 'Personalbilde', '']
  ];

  var schoolProducts = [
    { id: 'd1', name: 'Digital fil, ett bilde', price: 149, kind: 'digital', desc: 'Full oppløsning, uten vannmerke. Lastes ned straks.' },
    { id: 'dall', name: 'Alle digitale bilder av barnet', price: 349, kind: 'digital', desc: 'Alle poser + klassebilde. Det mest valgte.' },
    { id: 'p13', name: 'Utskrift 13×18', price: 89, kind: 'print', desc: 'Fotopapir, matt.' },
    { id: 'p18', name: 'Utskrift 18×24', price: 149, kind: 'print', desc: 'Fotopapir, matt.' },
    { id: 'pkl', name: 'Klassebilde 20×30 med navn', price: 149, kind: 'print', desc: 'Trykt med navneliste.' },
    { id: 'kal', name: 'Kalender 2027', price: 199, kind: 'print', desc: 'Tolv måneder med ditt utvalg.' }
  ];

  // ---------- drift ----------
  var invoices = [
    { nr: '26-1184', to: 'Fjordmegling Stord', area: 'bolig', sum: 48230, date: D(-28), due: D(-14), status: 'Betalt', chan: 'EHF' },
    { nr: '26-1191', to: 'Vestkraft Energi AS', area: 'bedrift', sum: 38500, date: D(-20), due: D(-6), status: 'Forfalt', chan: 'EHF' },
    { nr: '26-1197', to: 'Kystmegleren Haugesund · Rune Skår', area: 'bolig', sum: 5490, date: D(-9), due: D(5), status: 'Sendt', chan: 'E-post' },
    { nr: '26-1199', to: 'Rosendal Fjordhotell', area: 'bedrift', sum: 21000, date: D(-7), due: D(7), status: 'Sendt', chan: 'EHF' },
    { nr: '26-1200', to: 'Halsnøy Tannklinikk (timebank nov)', area: 'mark', sum: 7600, date: D(-1), due: D(13), status: 'Sendt', chan: 'EHF' },
    { nr: '26-1201', to: 'Hardanger Boligmegling', area: 'bolig', sum: 13290, date: D(-1), due: D(13), status: 'Sendt', chan: 'E-post' },
    { nr: '—', to: 'Sunnhordland Eiendom (samlefaktura okt)', area: 'bolig', sum: 22760, date: '', due: '', status: 'Utkast', chan: 'EHF' },
    { nr: 'Vipps', to: 'Fjordtun skule · foresatte', area: 'skole', sum: 23838, date: D(0), due: '', status: 'Løpende', chan: 'Vipps' }
  ];

  var revenue = { // per måned, tusen kr
    months: ['Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov'],
    bolig: [92, 61, 104, 128, 141, 38], bedrift: [24, 8, 31, 66, 88, 21], skole: [0, 0, 12, 71, 18, 24], mark: [4, 4, 6, 12, 15, 8]
  };

  var storage = {
    total: 4000, // GB
    areas: [
      { key: 'bolig', label: 'Bolig', gb: 1120, files: 48210, rule: 'RAW slettes 12 mnd etter levering. Ferdige bilder til eiendommen er solgt + 12 mnd.' },
      { key: 'bedrift', label: 'Bedrift', gb: 640, files: 18930, rule: 'Så lenge kundeavtalen løper. Film-råmateriale 24 mnd.' },
      { key: 'skole', label: 'Skolefoto', gb: 210, files: 26120, rule: 'Slettes automatisk 24 mnd etter fotodag. Fravalgte barn slettes straks.' },
      { key: 'mark', label: 'Markedsføring', gb: 65, files: 3410, rule: 'Kampanjemateriell 36 mnd.' }
    ],
    upcoming: [
      { what: 'RAW-filer · 9 boligoppdrag fra okt. 2025', when: D(6), gb: 84, area: 'bolig' },
      { what: 'Skolefoto · Kloster skule, fotodag sep. 2024', when: D(12), gb: 31, area: 'skole' },
      { what: 'Slettebegjæring · 1 elev, Fjordtun skule', when: D(1), gb: 0.2, area: 'skole' },
      { what: 'Film-råmateriale · Rosendal Fjordhotell sommer 2024', when: D(27), gb: 212, area: 'bedrift' }
    ]
  };

  var automations = [
    { id: 'a1', area: 'bolig', name: 'Ny bestilling fra megler', on: true, runs: 46, trigger: 'Megler sender bestilling', steps: ['E-post: bekreftelse til megler', 'SMS: til selger med forslag til tid', 'Oppretter oppdrag i kalender', 'Varsel til fotograf'] },
    { id: 'a2', area: 'bolig', name: 'Klargjøring dagen før', on: true, runs: 41, trigger: '1 dag før fotografering, kl. 12', steps: ['SMS til selger: «Slik gjør du boligen klar»', 'Værsjekk for drone', 'Hvis vind > 8 m/s: foreslå ny dag for drone'] },
    { id: 'a3', area: 'bolig', name: 'Levert til megler', on: true, runs: 38, trigger: 'Oppdrag settes til Levert', steps: ['Lager Finn-, trykk- og SoMe-formater', 'E-post til megler med lenke', 'Faktura til kontoret (samlefaktura eller enkelt)'] },
    { id: 'a4', area: 'bolig', name: 'Lisens utløper', on: true, runs: 7, trigger: '30 dager før bildelisensen utløper', steps: ['E-post til megler: forlenge eller avslutte', 'Hvis solgt: arkiver og planlegg sletting av RAW'] },
    { id: 'a14', area: 'bolig', name: 'Be om omtale', on: true, runs: 21, trigger: '7 dager etter levering', steps: ['SMS til megler med lenke til Google-omtale', 'Hopper over meglere som har gitt omtale siste 6 mnd'] },
    { id: 'a15', area: 'bolig', name: 'Selger har ikke valgt tid', on: true, runs: 9, trigger: '24 timer etter SMS uten svar', steps: ['Ny SMS til selger', 'Varsel til megler etter 48 timer'] },
    { id: 'a5', area: 'bedrift', name: 'Ny versjon til gjennomgang', on: true, runs: 12, trigger: 'Ny filmversjon lastes opp', steps: ['E-post til kontaktperson med lenke', 'Påminnelse etter 3 virkedager uten svar'] },
    { id: 'a6', area: 'bedrift', name: 'Timebank nesten brukt', on: true, runs: 3, trigger: 'Under 1 time igjen i måneden', steps: ['E-post til kunde med forslag om påfyll', 'Varsel til Studiovest'] },
    { id: 'a7', area: 'bedrift', name: 'Samtykke fra ansatte', on: true, runs: 19, trigger: 'Person lagt til i opptaksliste', steps: ['Sender samtykkeskjema for bilde og film', 'Påminnelse etter 2 dager', 'Flagger i opptaksliste hvis ikke signert'] },
    { id: 'a8', area: 'skole', name: 'Informasjon og samtykke før fotodag', on: true, runs: 2, trigger: '14 dager før fotodag', steps: ['E-post til foresatte via skolens liste', 'Samtykke: portrett / kun gruppebilde / nei', 'Påminnelse til de som ikke har svart, 7 dager før'] },
    { id: 'a9', area: 'skole', name: 'Bestilling åpner', on: true, runs: 3, trigger: '3 virkedager etter fotodag', steps: ['E-post og SMS med personlig kode', 'Søsken samles i én bestilling'] },
    { id: 'a10', area: 'skole', name: 'Påminnelse før frist', on: true, runs: 3, trigger: '3 dager før bestillingen stenger', steps: ['Bare til de som ikke har bestilt', 'Hopper over de som har reservert seg mot påminnelser'] },
    { id: 'a11', area: 'skole', name: 'Automatisk sletting', on: true, runs: 1, trigger: '24 mnd etter fotodag', steps: ['Varsler skolen 30 dager før', 'Sletter bilder, koder og klasselister', 'Lager slettebekreftelse til skolen'] },
    { id: 'a12', area: 'mark', name: 'Innlegg til godkjenning', on: true, runs: 22, trigger: 'Innlegg settes til «Til godkjenning»', steps: ['E-post til kunde med forhåndsvisning', 'Planlegger publisering når godkjent'] },
    { id: 'a13', area: 'mark', name: 'Månedsrapport', on: false, runs: 0, trigger: '1. hver måned', steps: ['Henter rekkevidde og klikk', 'Lager PDF-rapport', 'E-post til kunde'] }
  ];

  var templates = [
    { id: 't1', area: 'bolig', name: 'Bekreftelse til megler', subject: 'Bestilling mottatt: {{adresse}}', body: 'Hei {{megler.fornavn}},\n\nTakk for bestillingen av {{tjenester}} i {{adresse}}. Vi tar kontakt med {{selger.navn}} i dag og avtaler tid.\n\nDu følger oppdraget her: {{lenke}}\n\nHilsen\nStudiovest' },
    { id: 't2', area: 'bolig', name: 'SMS til selger: klargjøring', subject: 'SMS', body: 'Hei {{selger.fornavn}}! Studiovest kommer {{dato}} kl. {{tid}} for å fotografere boligen. Tips: rydd benker, skru på alle lys, åpne gardiner. Spørsmål? Svar på denne SMS-en.' },
    { id: 't3', area: 'bolig', name: 'Levering til megler', subject: 'Bildene er klare: {{adresse}}', body: 'Hei {{megler.fornavn}},\n\nBildene fra {{adresse}} er klare i Finn-, trykk- og SoMe-format. Plantegning og video ligger i samme mappe.\n\n{{lenke}}\n\nHusk kreditering: «Foto: Studiovest».' },
    { id: 't4', area: 'skole', name: 'Bestilling åpner', subject: 'Skolebildene av {{barn.fornavn}} er klare', body: 'Hei,\n\nBildene fra fotodagen på {{skole}} er klare. Bruk koden {{kode}} på lenken under. Du velger bare det du vil ha – ingen faste pakker.\n\n{{lenke}}\n\nBestillingen stenger {{frist}}.' },
    { id: 't5', area: 'skole', name: 'Samtykke før fotodag', subject: 'Fotodag på {{skole}} {{dato}}: ditt valg', body: 'Hei,\n\n{{dato}} er det fotodag. Velg om {{barn.fornavn}} skal være med på portrett og gruppebilde, bare gruppebilde, eller ikke fotograferes. Det tar ett minutt:\n\n{{lenke}}\n\nVi deler ikke bildene med noen andre enn dere og skolen.' },
    { id: 't6', area: 'bedrift', name: 'Ny versjon til gjennomgang', subject: 'Ny versjon klar: {{prosjekt}}', body: 'Hei {{kunde.fornavn}},\n\nVersjon {{versjon}} av {{prosjekt}} er klar. Klikk i filmen der du vil kommentere, så lander kommentaren på riktig sekund.\n\n{{lenke}}' }
  ];

  var outbox = [
    { t: '10:42', to: 'kari.lunde@fjordmegling.example', subj: 'Bestilling mottatt: Ølve terrasse 12', area: 'bolig', st: 'Åpnet' },
    { t: '10:41', to: '+47 480 12 776', subj: 'SMS: forslag til tid, Ølve terrasse 12', area: 'bolig', st: 'Levert' },
    { t: '09:15', to: '312 foresatte · Fjordtun skule', subj: 'Påminnelse: 9 dager igjen', area: 'skole', st: '71 % åpnet' },
    { t: '08:30', to: 'marte@vestkraft.example', subj: 'Ny versjon klar: Rekrutteringsfilm v2', area: 'bedrift', st: 'Klikket' },
    { t: 'I går', to: 'eirik.saether@kystmegleren.example', subj: 'Bildene er klare: Fjellsætervegen 22', area: 'bolig', st: 'Planlagt' },
    { t: 'I går', to: 'silje@htk.example', subj: 'Timebanken er brukt opp for november', area: 'bedrift', st: 'Åpnet' },
    { t: 'I går', to: '64 foresatte · Sjøbakken barnehage', subj: 'Fotodag: ditt valg', area: 'skole', st: '58 % svart' }
  ];

  var activity = [
    { t: '10:42', area: 'bolig', text: '<b>Kari Lunde</b> bestilte foto og reel til Ølve terrasse 12' },
    { t: '10:05', area: 'skole', text: '<b>14 nye bestillinger</b> fra Fjordtun skule i dag · 2 086 kr' },
    { t: '09:51', area: 'bedrift', text: '<b>Marte Haugland</b> la til 2 kommentarer i Rekrutteringsfilm v2' },
    { t: '09:12', area: 'mark', text: '<b>Rosendal Fjordhotell</b> godkjente «Reel: badstue i blå time»' },
    { t: '08:40', area: 'skole', text: 'Slettebegjæring fra foresatt, Fjordtun 6A · behandles innen 30 dager' },
    { t: '08:02', area: 'bolig', text: 'Værvarsel: drone ved Nesvegen 41 ser bra ut (6 m/s)' }
  ];

  window.SV_DATA = {
    today: now, base: base, iso: iso, W: W, D: D, wd: wd, addDays: addDays,
    img: img, team: team, boligServices: boligServices, offices: offices, stages: stages, boligJobs: boligJobs,
    companies: companies, bizStages: bizStages, bizProjects: bizProjects, bankLog: bankLog, videoComments: videoComments,
    channels: channels, posts: posts, campaigns: campaigns,
    schoolDays: schoolDays, dayPlan: dayPlan, schoolProducts: schoolProducts,
    invoices: invoices, revenue: revenue, storage: storage, automations: automations, templates: templates, outbox: outbox, activity: activity
  };
})();
