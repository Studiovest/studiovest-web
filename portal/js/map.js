/* Kart på prosjektsiden: adressen med eiendomsgrenser (Kartverket, åpne data) og Google Street View.
   Kartgrunnlag: Kartverkets topografiske kart (gratis, åpent). Eiendomsgrenser: Matrikkelkart WMS (CC BY 4.0).
   Street View: innebygd hvis GOOGLE_MAPS_KEY er satt (Maps Embed API, gratis), ellers knapp som åpner Google Maps. */
(function () {
  'use strict';
  var SV = window.SV, esc = SV.esc, ic = SV.icon;
  var API = location.pathname.replace(/\/portal(\/.*)?$/, '') + '/api/', KEY = null, keyAsked = false, leaflet = null, MAPS = {};
  var DEMO_PT = { lat: 59.7795, lon: 5.4997, demo: true }; // Leirvik sentrum, bare for eksempeldata
  function gkey() { if (SV.live && !keyAsked) { keyAsked = true; fetch(API + 'public.php', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) { if (d.gmaps) { KEY = d.gmaps; SV.render(); } }).catch(function () {}); } return KEY; }
  function loadLeaflet() {
    if (leaflet) return leaflet;
    leaflet = new Promise(function (ok, no) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
      var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = function () { ok(window.L); }; s.onerror = no; document.head.appendChild(s);
    });
    return leaflet;
  }
  function point(j) { var g = SV.geo ? SV.geo(j) : null; if (g && g.status === 'ok' && g.lat) return { lat: +g.lat, lon: +g.lon }; return SV.live ? null : DEMO_PT; }
  var TAB = {};
  SV.mapCard = function (j) {
    var p = point(j), k = gkey(), tab = TAB[j.id] || 'kart';
    if (!p) return '';
    var sv = 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + p.lat + ',' + p.lon;
    var tabs = [['kart', 'Kart og grenser'], ['sv', 'Street View']].concat(k ? [['fly', 'Flyfoto']] : []);
    var body = tab === 'kart' ? '<div class="mapbox" id="map-' + esc(j.id) + '" data-lat="' + p.lat + '" data-lon="' + p.lon + '"></div>' :
      k ? '<iframe class="mapbox" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen title="' + (tab === 'sv' ? 'Street View' : 'Flyfoto') + '" src="https://www.google.com/maps/embed/v1/' + (tab === 'sv' ? 'streetview?location=' + p.lat + ',' + p.lon + '&fov=80' : 'view?center=' + p.lat + ',' + p.lon + '&zoom=19&maptype=satellite') + '&key=' + encodeURIComponent(k) + '"></iframe>' :
      '<div class="mapbox map-sv"><p>' + ic('pin') + 'Street View åpnes i Google Maps.</p><a class="btn btn-dark btn-s" target="_blank" rel="noopener" href="' + sv + '">Åpne Street View</a><p class="small muted">Innebygd Street View krever en Google-nøkkel (GOOGLE_MAPS_KEY). Mange adresser utenfor byene har ikke Street View.</p></div>';
    return '<div class="card"><div class="card-h"><h3>Kart</h3><div class="seg-mini">' + tabs.map(function (t) { return '<button class="fbtn' + (t[0] === tab ? ' on' : '') + '" data-act="mapTab" data-id="' + esc(j.id) + '" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="card-b" style="padding-top:0">' + body + '<p class="hint" style="margin-top:8px">' + (p.demo ? 'Eksempelkart. På ekte prosjekter vises adressen fra adresseagenten. ' : '') + (tab === 'kart' ? 'Kart og eiendomsgrenser: © Kartverket.' : '') + (k && tab !== 'kart' ? ' Mangler Street View på adressen, viser Google nærmeste bilde.' : '') + ' <a target="_blank" rel="noopener" href="' + sv + '">Street View i ny fane</a></p></div></div>';
  };
  SV.on('mapTab', function (el) { TAB[el.getAttribute('data-id')] = el.getAttribute('data-t'); SV.render(); });
  // tegn kartene etter hver visning
  SV.mapInit = function () {
    var els = document.querySelectorAll('div.mapbox[id^="map-"]'); if (!els.length) return;
    loadLeaflet().then(function (L) {
      els.forEach(function (el) {
        if (el._map) return; var lat = +el.getAttribute('data-lat'), lon = +el.getAttribute('data-lon');
        var m = L.map(el, { zoomControl: true, scrollWheelZoom: false }).setView([lat, lon], 18); el._map = m;
        var topo = L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png', { maxZoom: 20, maxNativeZoom: 18, attribution: '© Kartverket' }).addTo(m);
        var grey = L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png', { maxZoom: 20, maxNativeZoom: 18, attribution: '© Kartverket' });
        var grenser = L.tileLayer.wms('https://wms.geonorge.no/skwms1/wms.matrikkelkart', { layers: 'matrikkelkart', format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 20, attribution: 'Eiendomsgrenser © Kartverket' }).addTo(m);
        L.control.layers({ 'Topografisk': topo, 'Gråtone': grey }, { 'Eiendomsgrenser og gnr/bnr': grenser }, { collapsed: true }).addTo(m);
        L.circleMarker([lat, lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#c0392b', fillOpacity: 1 }).addTo(m);
        m.on('focus click', function () { m.scrollWheelZoom.enable(); }); m.on('blur mouseout', function () { m.scrollWheelZoom.disable(); });
      });
    }).catch(function () { els.forEach(function (el) { el.innerHTML = '<p class="small muted" style="padding:16px">Kartet kunne ikke lastes.</p>'; }); });
  };
})();
