#!/usr/bin/env python3
"""Leser GitHub-hemmeligheten STUDIOVEST_CONFIG (linjer med NØKKEL=verdi), skjuler verdiene i loggen,
avleder APP_SECRET og CRON_TOKEN, og skriver api/config.php for one.com. Ingen hemmeligheter havner i git."""
import os, sys, json, hashlib, base64

raw = os.environ.get('CFG', '')
cfg = {}
for line in raw.splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    cfg[k.strip().upper()] = v.strip().strip('"').strip("'")

for v in cfg.values():
    if len(v) >= 4:
        print(f'::add-mask::{v}')

need = ['SFTP_HOST', 'SFTP_USER', 'SFTP_PASSWORD']
ready = all(cfg.get(k) for k in need)
seed = '|'.join([cfg.get('DB_PASSWORD', ''), cfg.get('SFTP_PASSWORD', ''), cfg.get('SFTP_USER', '')])
app_secret = hashlib.sha256(('sv|' + seed).encode()).hexdigest()
cron_token = hashlib.sha256((app_secret + '|cron').encode()).hexdigest()[:32]
print(f'::add-mask::{app_secret}')
print(f'::add-mask::{cron_token}')

site = cfg.get('SITE_URL', 'https://studiovest.no').rstrip('/')
out = os.environ.get('GITHUB_OUTPUT')
if out:
    with open(out, 'a') as f:
        f.write(f'ready={"true" if ready else "false"}\n')
        f.write(f'has_db={"true" if cfg.get("DB_NAME") else "false"}\n')
        f.write(f'site={site}\n')
env = os.environ.get('GITHUB_ENV')
if env:
    with open(env, 'a') as f:
        for k in ['SFTP_HOST', 'SFTP_USER', 'SFTP_PASSWORD', 'SFTP_PORT', 'WEBROOT']:
            if cfg.get(k):
                f.write(f'{k}={cfg[k]}\n')
        f.write(f'CRON_TOKEN={cron_token}\n')
        for k in ['ANTHROPIC_API_KEY', 'FLOORPLAN_MODEL', 'CUBICASA_API_KEY']:
            if cfg.get(k):
                f.write(f'{k}={cfg[k]}\n')

if len(sys.argv) > 2 and sys.argv[1] == 'php':
    keys = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASSWORD', 'MAIL_FROM',
            'ADMIN_EMAIL', 'WASABI_KEY', 'WASABI_SECRET', 'WASABI_BUCKET', 'WASABI_REGION',
            'ANTHROPIC_API_KEY', 'IMAP_HOST', 'IMAP_PORT', 'IMAP_USER', 'IMAP_PASSWORD', 'AGENT_MODEL', 'AGENT_MAX_PER_DAY', 'AGENT_DOMAINS', 'PLAN_MODEL', 'GOOGLE_MAPS_KEY', 'CUBICASA_API_KEY']
    php = {k: cfg[k] for k in keys if cfg.get(k)}
    php['APP_SECRET'] = app_secret
    php['BASE_URL'] = site
    b64 = base64.b64encode(json.dumps(php).encode()).decode()
    with open(sys.argv[2], 'w') as f:
        f.write("<?php\n// Laget automatisk ved publisering. Ikke rediger. Ikke legg i git.\nreturn json_decode(base64_decode('" + b64 + "'), true);\n")
    print('Skrev ' + sys.argv[2] + ' med nøkler: ' + ', '.join(sorted(k for k in php if 'PASS' not in k and 'SECRET' not in k)))
