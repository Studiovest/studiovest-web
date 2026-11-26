#!/usr/bin/env python3
"""Plantegningsagenten (leveranse). Kjøres i GitHub Actions av «Portal-jobber» når portalen har plantegningsjobber som venter.
Henter jobben fra api/floorjobs.php, lar Claude styre verktøyene i prompt.md, kjører toolkit/floorplan.py og leverer JPG-ene til prosjektet.

Miljø: SITE (https://studiovest.no), CRON_TOKEN, ANTHROPIC_API_KEY, valgfritt FLOORPLAN_MODEL. Tester: FP_FAKE=fil med ferdige svar."""
import base64, io, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, uuid

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.environ.get('SITE', 'https://studiovest.no').rstrip('/')
TOKEN = os.environ.get('CRON_TOKEN', '')
MODEL = os.environ.get('FLOORPLAN_MODEL') or 'claude-sonnet-5-5'
FAKE = os.environ.get('FP_FAKE')


def api(a, id=None, data=None, files=None, raw=False):
    q = {'token': TOKEN, 'a': a}
    if id is not None: q['id'] = id
    url = SITE + '/api/floorjobs.php?' + urllib.parse.urlencode(q)
    headers, body = {}, None
    if files is not None:
        b = uuid.uuid4().hex; parts = []
        for k, v in (data or {}).items():
            parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        for k, path in files.items():
            parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{os.path.basename(path)}"\r\nContent-Type: image/jpeg\r\n\r\n'.encode() + open(path, 'rb').read() + b'\r\n')
        body = b''.join(parts) + f'--{b}--\r\n'.encode(); headers['Content-Type'] = 'multipart/form-data; boundary=' + b
    elif data is not None:
        body = json.dumps(data).encode(); headers['Content-Type'] = 'application/json'
    with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers), timeout=120) as r:
        out = r.read()
    return out if raw else json.loads(out)


def claude(system, tools, messages, step):
    if FAKE:
        script = json.load(open(FAKE))
        return {'content': script[step] if step < len(script) else [{'type': 'text', 'text': 'Ferdig.'}], 'usage': {}}
    req = {'model': MODEL, 'max_tokens': 2048, 'system': system, 'tools': tools, 'messages': messages}
    for attempt in range(3):
        try:
            r = urllib.request.Request('https://api.anthropic.com/v1/messages', data=json.dumps(req).encode(),
                                       headers={'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': os.environ['ANTHROPIC_API_KEY']})
            with urllib.request.urlopen(r, timeout=180) as res:
                return json.loads(res.read())
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 529) and attempt < 2: time.sleep(10 * (attempt + 1)); continue
            raise RuntimeError(f'Claude API {e.code}: {e.read()[:300]!r}')


def img_block(path, width=1100):
    from PIL import Image
    im = Image.open(path).convert('RGB'); im.thumbnail((width, width))
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=82)
    return {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': base64.b64encode(buf.getvalue()).decode()}}


TOOLS = [
    {'name': 'get_project', 'description': 'Prosjektet: adresse, office (meglerkontor), office_key (toolkit-nøkkel eller null hvis kontoret ikke har mal), first_floor, address_slug, notater og Cubicasa-ordre-id.',
     'input_schema': {'type': 'object', 'properties': {'project_id': {'type': 'string'}}, 'required': ['project_id']}},
    {'name': 'cubicasa_get_order', 'description': 'Ordrestatus og leveransefiler (PDF uten mål og med mål).',
     'input_schema': {'type': 'object', 'properties': {'order_id': {'type': 'string'}}, 'required': ['order_id']}},
    {'name': 'cubicasa_get_overview', 'description': 'Forhåndsvisning av siste PDF-side, der Cubicasa viser alle etasjene med navn.',
     'input_schema': {'type': 'object', 'properties': {'order_id': {'type': 'string'}}, 'required': ['order_id']}},
    {'name': 'render_floorplans', 'description': 'Kjører Studiovest-toolkit på PDF-en. Returnerer én ferdig JPG per etasje med forhåndsvisning, og en logg.',
     'input_schema': {'type': 'object', 'properties': {'project_id': {'type': 'string'}, 'pdf_url': {'type': 'string'}, 'office': {'type': 'string'}, 'first': {'type': 'string'}, 'prefix': {'type': 'string'}}, 'required': ['project_id', 'pdf_url', 'office', 'first', 'prefix']}},
    {'name': 'save_deliverables', 'description': 'Legger de ferdige filene på prosjektet og markerer jobben som levert.',
     'input_schema': {'type': 'object', 'properties': {'project_id': {'type': 'string'}, 'files': {'type': 'array', 'items': {'type': 'string'}}, 'summary': {'type': 'string'}}, 'required': ['project_id', 'files', 'summary']}},
    {'name': 'flag_for_review', 'description': 'Stopper jobben og ber Studiovest se på den. Legg ved filene i files hvis de er brukbare.',
     'input_schema': {'type': 'object', 'properties': {'project_id': {'type': 'string'}, 'reason': {'type': 'string'}, 'files': {'type': 'array', 'items': {'type': 'string'}}}, 'required': ['project_id', 'reason']}},
]


def run(job_id):
    work = tempfile.mkdtemp(prefix=f'fp{job_id}_'); pdf = os.path.join(work, 'order.pdf'); rendered = {}
    open(pdf, 'wb').write(api('pdf', job_id, raw=True))
    system = open(os.path.join(HERE, 'prompt.md'), encoding='utf-8').read() + (
        '\n\n# Teknisk (portalen)\n- project_id er portalens jobbnummer. Bruk `office_key` fra get_project som office i render_floorplans; er den null, har kontoret ingen mal.'
        '\n- Ordren er Cubicasa-PDF-en Studiovest har lastet opp (uten mål). Bruk `pdf_url` fra cubicasa_get_order.'
        '\n- I save_deliverables og flag_for_review oppgir du filnavnene fra render_floorplans.')
    msgs = [{'role': 'user', 'content': f'Plantegningsordren for prosjekt {job_id} er klar. Lag, sjekk og lever plantegningene.'}]
    tin = tout = 0; log = []; done = False
    for step in range(14):
        res = claude(system, TOOLS, msgs, step)
        tin += res.get('usage', {}).get('input_tokens', 0); tout += res.get('usage', {}).get('output_tokens', 0)
        msgs.append({'role': 'assistant', 'content': res['content']}); results = []
        for b in res['content']:
            if b.get('type') == 'text' and b['text'].strip(): log.append('Agent: ' + b['text'].strip())
            if b.get('type') != 'tool_use': continue
            name, inp = b['name'], b.get('input', {}); log.append(f'{name}({json.dumps(inp, ensure_ascii=False)[:300]})')
            try:
                if inp.get('project_id') not in (None, str(job_id)): raise ValueError(f'Feil prosjekt. Denne jobben er {job_id}.')
                if name == 'get_project':
                    out = [{'type': 'text', 'text': json.dumps(api('project', job_id), ensure_ascii=False)}]
                elif name == 'cubicasa_get_order':
                    out = [{'type': 'text', 'text': json.dumps({'status': 'delivered', 'files': [{'type': 'pdf_without_dimensions', 'url': 'order.pdf'}], 'note': 'PDF med mål er ikke lastet opp.'})}]
                elif name == 'cubicasa_get_overview':
                    n = int(subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout.split('Pages:')[1].split()[0])
                    subprocess.run(['pdftoppm', '-f', str(n), '-l', str(n), '-r', '70', '-png', pdf, os.path.join(work, 'overview')], check=True)
                    ov = sorted(f for f in os.listdir(work) if f.startswith('overview'))[-1]
                    out = [{'type': 'text', 'text': f'Siste side (side {n} av {n}):'}, img_block(os.path.join(work, ov), 1400)]
                elif name == 'render_floorplans':
                    od = os.path.join(work, 'out'); subprocess.run(['rm', '-rf', od])
                    p = subprocess.run([sys.executable, os.path.join(HERE, 'toolkit', 'floorplan.py'), pdf, '--office', inp['office'], '--first', inp['first'], '--prefix', inp['prefix'], '--json', '--out', od], capture_output=True, text=True)
                    if p.returncode != 0: raise RuntimeError((p.stderr or p.stdout).strip()[-600:])
                    r = json.loads(p.stdout.strip().splitlines()[-1]); rendered = {os.path.basename(f['file']): f for f in r['files']}
                    out = [{'type': 'text', 'text': json.dumps({'office': r['office'], 'floor_pages': r['floor_pages'], 'files': [{'file': k, 'floor': v['floor'], 'page': v['page']} for k, v in rendered.items()], 'log': r.get('log', [])}, ensure_ascii=False)}]
                    for k, v in rendered.items(): out += [{'type': 'text', 'text': f'Forhåndsvisning {k} ({v["floor"]}):'}, img_block(v['file'])]
                elif name in ('save_deliverables', 'flag_for_review'):
                    files = [f for f in inp.get('files', []) if f in rendered]
                    miss = [f for f in inp.get('files', []) if f not in rendered]
                    if miss: raise ValueError('Ukjente filer: ' + ', '.join(miss))
                    a = 'save' if name == 'save_deliverables' else 'flag'
                    for f in files: api(a, job_id, data={'floor': rendered[f]['floor']}, files={'file': rendered[f]['file']})
                    api(a, job_id, data={'done': '1', 'summary': inp.get('summary', ''), 'reason': inp.get('reason', '')}, files={})
                    out = [{'type': 'text', 'text': 'Levert.' if a == 'save' else 'Sendt til Studiovest.'}]; done = True
                else: raise ValueError('Ukjent verktøy')
                results.append({'type': 'tool_result', 'tool_use_id': b['id'], 'content': out})
            except Exception as e:
                log.append('  feil: ' + str(e)[:300]); results.append({'type': 'tool_result', 'tool_use_id': b['id'], 'is_error': True, 'content': str(e)[:1500]})
        if done or not results: break
        # behold bare de nyeste bildene, så forespørslene holder seg små
        for m in msgs[:-1]:
            if m['role'] == 'user' and isinstance(m['content'], list):
                for r in m['content']:
                    if isinstance(r.get('content'), list): r['content'] = [c if c.get('type') != 'image' else {'type': 'text', 'text': '[eldre bilde utelatt]'} for c in r['content']]
        msgs.append({'role': 'user', 'content': results})
    err = None if done else 'Agenten ble ikke ferdig (verken levert eller sendt til sjekk).'
    api('usage', job_id, data={'in': tin, 'out': tout, 'log': '\n'.join(log), 'error': err})
    print(f'Jobb {job_id}: {"ferdig" if done else "ikke ferdig"} · {tin} inn / {tout} ut tokens')


if __name__ == '__main__':
    ids = [int(x) for x in sys.argv[1:]] or api('pending')['ids']
    for i in ids:
        try: run(i)
        except Exception as e:
            print(f'Jobb {i} feilet: {e}', file=sys.stderr)
            try: api('usage', i, data={'error': str(e)[:500]})
            except Exception: pass
