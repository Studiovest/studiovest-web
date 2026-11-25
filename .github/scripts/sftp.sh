#!/usr/bin/env bash
# Publiserer til one.com over SFTP. Modus: probe | golive | deploy
#  probe  = vis mappene på serveren (ingen endringer)
#  golive = sikkerhetskopi av alt på serveren, flytt WordPress-filene til _wordpress/ (slettes ikke), publiser ny side
#  deploy = publiser endringer (kun når siden allerede er lansert)
set -euo pipefail
MODE="${1:-deploy}"; PORT="${SFTP_PORT:-22}"
L() { lftp -u "$SFTP_USER","$SFTP_PASSWORD" -p "$PORT" "sftp://$SFTP_HOST" -e "set sftp:auto-confirm yes; set net:max-retries 2; set net:timeout 30; set cmd:fail-exit yes; $1; bye"; }

# nettrot: WEBROOT fra oppsettet, ellers første vanlige mappe som inneholder en nettside
find_root() {
  if [ -n "${WEBROOT:-}" ]; then echo "$WEBROOT"; return; fi
  for d in www public_html htdocs httpdocs .; do
    if L "cls -1a $d/" 2>/dev/null | sed 's#/$##' | grep -q -E '^(index\.(php|html?)|wp-config\.php|\.studiovest-live)$'; then echo "$d"; return; fi
  done
  echo "."
}

if [ "$MODE" = "probe" ]; then
  echo "== rot =="; L "cls -la" || true
  for d in www public_html htdocs httpdocs; do echo "== $d =="; L "cls -la $d" 2>/dev/null | head -40 || true; done
  echo "Valgt nettrot: $(find_root)"; exit 0
fi

ROOT="$(find_root)"; echo "Nettrot: $ROOT"
LIVE=$(L "cls -1a $ROOT/" 2>/dev/null | grep -c '^\.studiovest-live$' || true)

if [ "$MODE" = "deploy" ] && [ "$LIVE" = "0" ]; then
  echo "::notice::Siden er ikke lansert ennå (WordPress ligger der). Kjør «Live på studiovest.no» med modus golive for å lansere."; exit 0
fi

if [ "$MODE" = "golive" ] && [ "$LIVE" = "0" ]; then
  echo "== Sikkerhetskopi av alt på serveren =="
  # store mediemapper (bilder i wp-content/uploads, virtuell-tur) lastes ikke ned: de blir liggende urørt på serveren
  mkdir -p backup && L "mirror --parallel=4 --exclude-glob wp-content/uploads/ --exclude-glob virtuell-tur/ $ROOT backup"
  tar -czf wordpress-backup.tgz -C backup . && ls -lh wordpress-backup.tgz
  echo "== Flytter eksisterende filer til _wordpress/ =="
  # virtuell-tur/ brukes av lenker ute (visninger), så den blir liggende der den er
  KEEP='^(_wordpress|\.|\.\.|\.well-known|cgi-bin|virtuell-tur)$'
  ITEMS=$(L "cls -1a $ROOT/" | sed 's#/$##' | grep -v -E "$KEEP" || true)
  CMDS="mkdir -p $ROOT/_wordpress"
  for it in $ITEMS; do CMDS="$CMDS; mv $ROOT/$it $ROOT/_wordpress/$it"; done
  L "$CMDS"
  # alt i _wordpress/ er stengt, unntatt opplastede bilder (gamle bildelenker), og PHP kjøres aldri der
  printf 'Require all denied\n' > deny.htaccess
  printf 'Require all granted\n<FilesMatch "\\.(php|phtml|phar)$">\n  Require all denied\n</FilesMatch>\n' > uploads.htaccess
  L "put deny.htaccess -o $ROOT/_wordpress/.htaccess"
  L "put uploads.htaccess -o $ROOT/_wordpress/wp-content/uploads/.htaccess" || echo "Ingen wp-content/uploads, hopper over"
fi

echo "== Publiserer =="
L "mirror -R --parallel=4 --no-perms --exclude-glob api/data/* dist $ROOT"
L "mkdir -p $ROOT/api/data; put dist/api/data/.htaccess -o $ROOT/api/data/.htaccess"
date -u > live-marker && L "put live-marker -o $ROOT/.studiovest-live"
echo "Ferdig."
