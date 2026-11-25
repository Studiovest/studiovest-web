#!/usr/bin/env bash
# Bygger dist/ for produksjon: nettside + portal + api. Fjerner «noindex» fra forsiden,
# lager robots.txt og sitemap.xml, og versjonsmerker filer.
set -euo pipefail
SITE="${1:-https://studiovest.no}"
rm -rf dist && mkdir dist
tar --exclude='./.git' --exclude='./.github' --exclude='./stasjon' --exclude='./dist' --exclude='*.md' \
  --exclude='./api/data/*.sqlite' --exclude='./api/data/mail.log' --exclude='./api/config.php' \
  --exclude='./backup' --exclude='./*.tgz' -cf - . | tar -xf - -C dist
V="${GITHUB_SHA:-local}"; V="${V::8}"
sed -i "s/__V__/$V/g" dist/index.html dist/assets/main.js dist/portal/index.html
# forsiden skal indekseres; portal og versjon-1 skal fortsatt ikke
sed -i '/<meta name="robots" content="noindex/d' dist/index.html
cat > dist/robots.txt <<R
User-agent: *
Disallow: /portal/
Disallow: /api/
Disallow: /versjon-1/
Disallow: /_wordpress/
Sitemap: $SITE/sitemap.xml
R
cat > dist/sitemap.xml <<S
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>$SITE/</loc><lastmod>$(date -u +%F)</lastmod></url></urlset>
S
echo "dist klar: $(du -sh dist | cut -f1)"
