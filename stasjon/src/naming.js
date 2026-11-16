'use strict';
// Filnavnmal: {skole}/{klasse}/{kode}_{nr}  ->  FJT2026/4B/FJT-4B-7K2Q_0001.jpg
// Tokens: {skole} {klasse} {kode} {fornavn} {etternavn} {nr} {nr2} {dato} {tid} {stasjon}

const SAFE = /[^A-Za-z0-9ÆØÅæøå._-]+/g;

function clean(v) {
  return String(v == null ? '' : v).trim().replace(SAFE, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function pad(n, w) { return String(n).padStart(w, '0'); }

function render(template, ctx) {
  const now = ctx.now || new Date();
  const parts = String(ctx.name || '').trim().split(/\s+/);
  const values = {
    skole: ctx.session, klasse: ctx.group, kode: ctx.code,
    fornavn: parts[0] || '', etternavn: parts.length > 1 ? parts[parts.length - 1] : '',
    nr: pad(ctx.seq, 4), nr2: pad(ctx.seq, 2),
    dato: now.getFullYear() + pad(now.getMonth() + 1, 2) + pad(now.getDate(), 2),
    tid: pad(now.getHours(), 2) + pad(now.getMinutes(), 2) + pad(now.getSeconds(), 2),
    stasjon: ctx.station
  };
  const out = template.replace(/\{(\w+)\}/g, (m, k) => (k in values ? clean(values[k]) : m));
  // mapper med / er lov, men aldri .. eller absolutt sti
  const segs = out.split('/').map(clean).filter(s => s && s !== '.' && s !== '..');
  if (!segs.length) throw new Error('Filnavnmalen ga tomt navn');
  return segs.join('/') + (ctx.ext || '').toLowerCase();
}

module.exports = { render, clean };
