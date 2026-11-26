#!/usr/bin/env python3
"""Henter Kartverkets åpne «Matrikkelen Adresse Leilighetsnivå» for kommunene Studiovest dekker,
og lager api/data/units.json: adresseId -> liste med bruksenhetsnummer (H0101, H0201 …). Kjøres månedlig av units.yml."""
import io, json, re, sys, urllib.request, zipfile, xml.etree.ElementTree as ET
KOMMUNER = ['4611', '4612', '4613', '4614', '4615', '4616', '4617', '4618', '4619', '4620', '4622', '1106', '1145', '1146', '1149', '1160']
FEED = 'https://nedlasting.geonorge.no/geonorge/ATOM-feeds/MatrikkelenAdresseLeilighetsniva_AtomFeedGML.xml'
sample = '--sample' in sys.argv
feed = urllib.request.urlopen(FEED, timeout=60).read().decode()
urls = {}
for u in re.findall(r'href="([^"]+?Basisdata_(\d{4})_[^"]+?_GML\.zip)"', feed):
    if u[1] in KOMMUNER: urls.setdefault(u[1], u[0])
print('Fant', len(urls), 'av', len(KOMMUNER), 'kommuner')
loc = lambda t: t.rsplit('}', 1)[-1]
out = {}
for k, url in sorted(urls.items()):
    z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(url, timeout=120).read()))
    name = [n for n in z.namelist() if n.lower().endswith('.gml')][0]
    n = 0
    for ev, el in ET.iterparse(z.open(name), events=('end',)):
        if loc(el.tag) not in ('featureMember', 'member'): continue
        f = el[0] if len(el) else el
        if sample and n < 2 and any(re.search('etasje|bruksenhetsnummer|lopenummer', loc(x.tag), re.I) for x in f.iter()):
            print(k, [(loc(x.tag), (x.text or '').strip()) for x in f.iter() if len(x) == 0 and (x.text or '').strip()][:4] + [(loc(x.tag), (x.text or '').strip()) for x in f.iter() if re.search('etasje|bruksenhet|lopenummer|adresseId|adressetekst|nummer$', loc(x.tag), re.I)]); n += 1
        aid, units = None, []
        for x in f.iter():
            t = loc(x.tag).lower()
            if t in ('adresseid', 'adresseidentifikasjon') and (x.text or '').strip().isdigit(): aid = x.text.strip()
            if t == 'bruksenhetsnummer':
                txt = ''.join(x.itertext()).strip()
                if re.fullmatch(r'[HUKL]\d{4}', txt): units.append(txt)
        if aid and units: out.setdefault(aid, []).extend(units)
        el.clear()
    print(k, url.rsplit('/', 1)[-1], 'adresser med enheter totalt:', len(out))
    if sample: break
out = {a: sorted(set(u)) for a, u in out.items() if len(set(u)) > 1 or u[0] != 'H0101'}
if not sample:
    json.dump(out, open('api/data/units.json', 'w'), separators=(',', ':'))
    print('Skrev api/data/units.json med', len(out), 'adresser')
