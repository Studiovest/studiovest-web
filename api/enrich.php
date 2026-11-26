<?php
// Adresseagent: fyller ut postnummer, poststed, kommune, gnr/bnr og kartpunkt for prosjekter med ufullstendig adresse.
// Bruker Kartverkets åpne adresse-API (Geonorge). Gratis, ingen nøkkel, ingen Claude-kostnad. Logges i egen tabell.
require_once __DIR__ . '/agent.php';

function enrich_tables(): void {
  $p = db(); $ai = is_sqlite($p) ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
  $p->exec("CREATE TABLE IF NOT EXISTS geo_log (id $ai, tenant_id VARCHAR(40) NOT NULL, job_id VARCHAR(20), query VARCHAR(200), status VARCHAR(20), hits INT, at VARCHAR(25))");
}

function geo_fetch(string $q): array {
  if (cfg('GEO_FAKE')) { $f = json_decode((string)file_get_contents((string)cfg('GEO_FAKE')), true) ?: []; return $f[$q] ?? []; }
  $url = 'https://ws.geonorge.no/adresser/v1/sok?' . http_build_query(['sok' => $q, 'treffPerSide' => 200, 'utkoordsys' => 4258]);
  $c = curl_init($url); curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12, CURLOPT_HTTPHEADER => ['Accept: application/json']]);
  $r = curl_exec($c); $code = curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c);
  if ($r === false || $code !== 200) throw new Exception('Geonorge svarte ikke (' . $code . ')');
  return (json_decode((string)$r, true)['adresser'] ?? []);
}

function geo_pack(array $a): array {
  $uc = fn($s) => mb_convert_case(mb_strtolower((string)$s), MB_CASE_TITLE);
  return ['id' => (string)($a['adresseid'] ?? ''), 'addr' => (string)($a['adressetekst'] ?? ''), 'postnr' => (string)($a['postnummer'] ?? ''), 'poststed' => $uc($a['poststed'] ?? ''),
    'kommune' => $uc($a['kommunenavn'] ?? ''), 'knr' => (string)($a['kommunenummer'] ?? ''), 'gnr' => $a['gardsnummer'] ?? null, 'bnr' => $a['bruksnummer'] ?? null,
    'lat' => $a['representasjonspunkt']['lat'] ?? null, 'lon' => $a['representasjonspunkt']['lon'] ?? null];
}

// Slår opp én adresse. $town = sted fra e-posten (kan være tomt), $areas = kommuner kontoret dekker.
// Returnerer ['status' => 'ok'|'velg'|'ingen', 'geo' => ?, 'options' => [...]]
function geo_lookup(string $addr, string $town, array $areas): array {
  $addr = trim(preg_replace('/\s+/', ' ', $addr)); if ($addr === '' || $addr === 'Uten adresse') return ['status' => 'ingen', 'options' => []];
  $low = fn($s) => mb_strtolower(trim((string)$s));
  $hits = geo_fetch($addr);
  // Bare treff der gatenavn og husnummer faktisk stemmer
  $hits = array_values(array_filter($hits, fn($a) => strpos(norm_addr((string)$a['adressetekst']), norm_addr($addr)) === 0 || norm_addr((string)$a['adressetekst']) === norm_addr($addr)));
  $pick = [];
  if ($town !== '') $pick = array_values(array_filter($hits, fn($a) => in_array($low($town), [$low($a['poststed'] ?? ''), $low($a['kommunenavn'] ?? '')], true) || (preg_match('/^\d{4}$/', $town) && $a['postnummer'] === $town)));
  // kontorets vanlige kommuner først, så hele arbeidsområdet (kontorene tar av og til oppdrag utenfor sitt område)
  foreach ([$areas, SV_WORK_AREA] as $set) { if ($pick) break; $ar = array_map($low, $set); $pick = array_values(array_filter($hits, fn($a) => in_array($low($a['kommunenavn'] ?? ''), $ar, true))); }
  if (!$pick && $town === '' && count($hits) <= 3) $pick = $hits;
  // Nøyaktig treff foretrekkes framfor «Haugen 23B» når e-posten sier «Haugen 23»
  $exact = array_values(array_filter($pick, fn($a) => norm_addr((string)$a['adressetekst']) === norm_addr($addr)));
  if (count($exact) === 1) $pick = $exact;
  $opts = array_map('geo_pack', array_slice($pick, 0, 8));
  if (count($pick) === 1) return ['status' => 'ok', 'geo' => $opts[0], 'options' => []];
  return ['status' => $pick ? 'velg' : 'ingen', 'options' => $opts, 'hits' => count($hits)];
}

// Bygningstype (SSBs koder, brukt i matrikkelen). Bare boligtypene; andre vises som «Annen bygning (kode)».
const BYGG_TYPER = [111 => 'Enebolig', 112 => 'Enebolig med hybel', 113 => 'Våningshus', 121 => 'Tomannsbolig', 122 => 'Tomannsbolig', 123 => 'Våningshus, tomannsbolig', 124 => 'Våningshus, tomannsbolig',
  131 => 'Rekkehus', 133 => 'Kjedehus', 135 => 'Terrassehus', 136 => 'Småhus med 3 boliger eller flere', 141 => 'Boligblokk, 2 etasjer', 142 => 'Boligblokk, 3–4 etasjer', 143 => 'Boligblokk, 5 etasjer eller flere',
  144 => 'Sammenbygd boligblokk, 2 etasjer', 145 => 'Sammenbygd boligblokk, 3–4 etasjer', 146 => 'Sammenbygd boligblokk, 5 etasjer eller flere', 151 => 'Bo- og servicesenter', 152 => 'Studenthjem', 159 => 'Bofellesskap',
  161 => 'Hytte / fritidsbolig', 162 => 'Helårsbolig brukt som fritidsbolig', 163 => 'Våningshus brukt som fritidsbolig', 171 => 'Seterhus', 172 => 'Skogs- og utmarkskoie', 181 => 'Garasje / uthus', 182 => 'Garasje / uthus til fritidsbolig', 183 => 'Naust / båthus', 193 => 'Boligbrakke', 199 => 'Annen boligbygning'];
function bygg_navn(int $k): string { return BYGG_TYPER[$k] ?? ('Annen bygning (' . $k . ')'); }

// Finner bygningen på adressen i Matrikkelen Bygningspunkt (åpen WFS). Velger bygningen som er knyttet til adressen, ellers nærmeste bolig.
function geo_building(array $g): array {
  if (empty($g['lat'])) return [];
  if (cfg('GEO_FAKE')) { $f = json_decode((string)file_get_contents((string)cfg('GEO_FAKE')), true) ?: []; $xml = $f['wfs'] ?? ''; }
  else {
    $lat = (float)$g['lat']; $lon = (float)$g['lon'];
    $url = 'https://wfs.geonorge.no/skwms1/wfs.matrikkelen-bygningspunkt?service=WFS&version=2.0.0&request=GetFeature&typeNames=app:Bygning&count=40&bbox=' .
      ($lat - 0.0006) . ',' . ($lon - 0.0012) . ',' . ($lat + 0.0006) . ',' . ($lon + 0.0012) . ',urn:ogc:def:crs:EPSG::4258';
    $c = curl_init($url); curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]); $xml = (string)curl_exec($c); curl_close($c);
  }
  $best = null;
  foreach (preg_split('/<(?:\w+:)?member>/', $xml) as $blk) {
    if (!preg_match('/<(?:\w+:)?bygningstype>(\d+)</', $blk, $t)) continue;
    preg_match('/<(?:\w+:)?bygningsnummer>(\d+)</', $blk, $nr); preg_match('/<(?:\w+:)?pos>([\d.]+) ([\d.]+)</', $blk, $p);
    $linked = !empty($g['id']) && preg_match('/<(?:\w+:)?adresseId>' . preg_quote((string)$g['id'], '/') . '</', $blk);
    $k = (int)$t[1]; $d = $p ? hypot(((float)$p[1] - (float)$g['lat']) * 111000, ((float)$p[2] - (float)$g['lon']) * 55000) : 9999;
    $score = ($linked ? 0 : 10000) + ($k >= 100 && $k < 180 ? 0 : 5000) + $d;
    if (!$best || $score < $best['score']) $best = ['score' => $score, 'kode' => $k, 'bygnr' => $nr[1] ?? '', 'sikker' => (bool)$linked];
  }
  return $best ? ['bygg' => bygg_navn($best['kode']), 'byggkode' => $best['kode'], 'bygnr' => $best['bygnr'], 'byggSikker' => $best['sikker']] : [];
}

// Leilighetsnummer (H0101 …) fra api/data/units.json, som oppdateres månedlig fra Kartverket (units.yml).
function geo_units(string $id): array {
  static $u = null; if ($id === '') return [];
  if ($u === null) { $f = __DIR__ . '/data/units.json'; $u = is_file($f) ? (json_decode((string)file_get_contents($f), true) ?: []) : []; }
  return $u[$id] ?? [];
}
function geo_extra(array $g): array { return $g + geo_building($g) + ['units' => geo_units((string)($g['id'] ?? ''))]; }

// Fast jobb: slår opp opptil $max prosjekter som mangler adresseinfo.
function enrich_jobs(int $max = 5): array {
  enrich_tables();
  $s = db()->prepare('SELECT data FROM app_state WHERE tenant_id=? AND scope=?'); $s->execute([SV_TENANT, 'studio']);
  $st = json_decode((string)$s->fetchColumn(), true) ?: [];
  $todo = array_slice(array_values(array_filter($st['newJobs'] ?? [], fn($j) => (empty($j['geo']) || (($j['geo']['status'] ?? '') === 'ok' && !array_key_exists('bygg', $j['geo']))) && ($j['addr'] ?? '') !== '' && ($j['addr'] ?? '') !== 'Uten adresse')), 0, $max);
  if (!$todo) return ['n' => 0, 'info' => 'ingen adresser å slå opp'];
  $res = []; $log = db()->prepare('INSERT INTO geo_log (tenant_id, job_id, query, status, hits, at) VALUES (?,?,?,?,?,?)');
  foreach ($todo as $j) {
    if (($j['geo']['status'] ?? '') === 'ok') { // adressen er valgt i portalen, mangler bygning
      try { $res[$j['id']] = ['status' => 'ok', 'geo' => geo_extra($j['geo']) + ['bygg' => '']]; $log->execute([SV_TENANT, $j['id'], 'bygning ' . $j['addr'], 'ok', 1, now()]); } catch (Throwable $e) {}
      continue;
    }
    try { $r = geo_lookup((string)$j['addr'], (string)($j['town'] ?? ''), office_areas((string)($j['office'] ?? ''))); }
    catch (Throwable $e) { $log->execute([SV_TENANT, $j['id'], $j['addr'], 'feil', 0, now()]); continue; }
    if ($r['status'] === 'ok') { try { $r['geo'] = geo_extra($r['geo']); } catch (Throwable $e) {} }
    $res[$j['id']] = $r; $log->execute([SV_TENANT, $j['id'], $j['addr'] . ' ' . ($j['town'] ?? ''), $r['status'], $r['hits'] ?? count($r['options']) + 1, now()]);
  }
  $count = ['ok' => 0, 'velg' => 0, 'ingen' => 0];
  state_mutate(function (array &$st) use ($res, &$count) {
    foreach ($st['newJobs'] ?? [] as $i => $j) {
      if (!isset($res[$j['id']]) || (!empty($j['geo']) && ($j['geo']['status'] ?? '') !== 'ok')) continue;
      $r = $res[$j['id']]; $count[$r['status']]++;
      if ($r['status'] === 'ok') {
        $g = $r['geo']; $st['newJobs'][$i]['geo'] = $g + ['status' => 'ok', 'at' => now()];
        if (trim((string)($j['town'] ?? '')) === '') $st['newJobs'][$i]['town'] = $g['poststed'];
        if (trim((string)($j['type'] ?? '')) === '' && !empty($g['bygg']) && ($g['byggkode'] ?? 0) < 180) $st['newJobs'][$i]['type'] = $g['bygg'];
        if (norm_addr($g['addr']) !== norm_addr((string)$j['addr'])) $st['newJobs'][$i]['addr'] = $g['addr'];
      } else $st['newJobs'][$i]['geo'] = ['status' => $r['status'], 'options' => $r['options'], 'at' => now()];
    }
    return true;
  }, 'studio', 'adresseagent');
  return ['n' => count($res), 'info' => count($res) . ' slått opp (' . $count['ok'] . ' funnet, ' . $count['velg'] . ' må velges, ' . $count['ingen'] . ' ikke funnet)'];
}
