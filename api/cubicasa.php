<?php
// Cubicasa: finner ferdige plantegningsordrer og kobler dem til riktig prosjekt i portalen ut fra adressen.
// Kjøres fra cron.php hvert 30. minutt når CUBICASA_API_KEY er satt. Ordre som kobles, blir en plantegningsjobb (fp_job)
// som plantegningsagenten i GitHub Actions lager, sjekker og leverer. API: https://integrate.docs.cubi.casa
require_once __DIR__ . '/lib.php';

const CC_BASE = 'https://app.cubi.casa/api/integrate/v3';

function cc_on(): bool { return (bool)cfg('CUBICASA_API_KEY'); }
function cc_tables(): void {
  $p = db(); $ai = is_sqlite($p) ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY'; $tx = is_sqlite($p) ? 'TEXT' : 'LONGTEXT';
  $p->exec("CREATE TABLE IF NOT EXISTS fp_job (id $ai, tenant_id VARCHAR(40) NOT NULL, job_id VARCHAR(20), order_id VARCHAR(80), status VARCHAR(20), first_floor VARCHAR(120), notes $tx, pdf VARCHAR(190), summary $tx, reason $tx, files $tx, log $tx, tokens_in INT DEFAULT 0, tokens_out INT DEFAULT 0, by_who VARCHAR(190), created_at VARCHAR(25), updated_at VARCHAR(25))");
  $p->exec("CREATE TABLE IF NOT EXISTS cc_order (order_id VARCHAR(80) PRIMARY KEY, tenant_id VARCHAR(40) NOT NULL, address VARCHAR(255), status VARCHAR(20), job_id VARCHAR(20), candidates $tx, raw $tx, created_at VARCHAR(25), updated_at VARCHAR(25))");
}
function cc_get(string $path, array $q = []): array {
  $url = CC_BASE . $path . ($q ? '?' . http_build_query($q) : '');
  if (cfg('CC_FAKE')) { $f = json_decode((string)file_get_contents((string)cfg('CC_FAKE')), true) ?: []; return $f[$path] ?? []; }
  $c = curl_init($url); curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_HTTPHEADER => ['api-key: ' . cfg('CUBICASA_API_KEY'), 'Accept: application/json']]);
  $r = curl_exec($c); $code = (int)curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c);
  if ($code !== 200) throw new Exception('Cubicasa svarte ' . $code . ': ' . substr((string)$r, 0, 200));
  return json_decode((string)$r, true) ?: [];
}

// ---------- adressematching ----------
function cc_norm(string $s): string { $s = mb_strtolower(trim($s)); $s = strtr($s, ['é' => 'e', 'ü' => 'u', 'ö' => 'ø', 'ä' => 'æ']); return trim(preg_replace('/[^a-z0-9æøå]+/u', ' ', $s)); }
// «Haugen 23B» → ['haugen', '23b']
function cc_split(string $addr): array {
  $a = cc_norm(explode(',', $addr)[0]);
  if (preg_match('/^(.*?)\s*(\d+)\s*([a-z]?)\b/u', $a, $m) && trim($m[1]) !== '') return [trim($m[1]), $m[2] . $m[3]];
  return [$a, ''];
}
function cc_street_eq(string $a, string $b): bool {
  $a = str_replace(['vegen', 'veien', 'gata', 'gaten', ' '], ['veg', 'veg', 'gt', 'gt', ''], $a); $b = str_replace(['vegen', 'veien', 'gata', 'gaten', ' '], ['veg', 'veg', 'gt', 'gt', ''], $b);
  if ($a === $b) return true;
  $l = max(mb_strlen($a), mb_strlen($b)); return $l >= 5 && levenshtein($a, $b) <= ($l >= 10 ? 2 : 1); // skrivefeil: «Hagen» / «Haugen»
}
// Returnerer [score, grunn] for hvor godt ordren passer prosjektet. 0 = ikke.
function cc_score(array $o, array $j): array {
  $oa = $o['address'] ?? []; $ostreet = trim(($oa['street'] ?? '') . ' ' . ($oa['number'] ?? '')) ?: (string)($oa['full_address'] ?? '');
  if (trim($ostreet) === '') $ostreet = (string)($o['info']['add_info'] ?? $o['info']['external_id'] ?? '');
  [$os, $on] = cc_split($ostreet); if ($os === '') return [0, ''];
  $best = [0, ''];
  foreach (array_filter([(string)($j['addr'] ?? ''), (string)($j['geo']['addr'] ?? '')]) as $ja) {
    [$js, $jn] = cc_split($ja); if ($js === '') continue;
    if (!cc_street_eq($os, $js)) continue;
    if ($on !== $jn) { if ($on === '' || $jn === '' || preg_replace('/\D/', '', $on) !== preg_replace('/\D/', '', $jn)) continue; $s = 60; } else $s = 80; // 23 mot 23B gir lavere poeng
    $ot = cc_norm((string)($oa['city'] ?? '')); $opost = preg_replace('/\D/', '', (string)($oa['postalCode'] ?? ''));
    $jt = cc_norm((string)($j['town'] ?? $j['geo']['poststed'] ?? '')); $jpost = (string)($j['geo']['postnr'] ?? '');
    if (($opost && $jpost && $opost === $jpost) || ($ot && $jt && $ot === $jt)) $s += 20;
    elseif (($opost && $jpost && $opost !== $jpost) && ($ot && $jt && $ot !== $jt)) $s -= 50; // annet sted med samme gatenavn
    if ($s > $best[0]) $best = [$s, "$os $on ↔ $js $jn"];
  }
  return $best;
}
function cc_state(): array { $s = db()->prepare('SELECT data FROM app_state WHERE tenant_id=? AND scope=?'); $s->execute([SV_TENANT, 'studio']); return json_decode((string)$s->fetchColumn(), true) ?: []; }
// Første etasje for prosjektet: satt i portalen (fpFirst), ellers tom (agenten bruker da Cubicasas oversikt).
function cc_first(array $st, string $job): string { return trim((string)($st['fpFirst'][$job] ?? '')); }
function cc_queue(string $orderId, string $job, string $first, string $by): int {
  db()->prepare('INSERT INTO fp_job (tenant_id, job_id, order_id, status, first_floor, notes, files, by_who, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    ->execute([SV_TENANT, $job, $orderId, 'venter', $first, '', '[]', $by, now(), now()]);
  return (int)db()->lastInsertId();
}

function cc_match(array $o, array $jobs): array {
  $cand = [];
  foreach ($jobs as $j) { [$sc, $why] = cc_score($o, $j); if ($sc >= 60) $cand[] = ['job' => $j['id'], 'addr' => trim(($j['addr'] ?? '') . ', ' . ($j['town'] ?? ''), ', '), 'score' => $sc, 'why' => $why]; }
  usort($cand, fn($a, $b) => $b['score'] <=> $a['score']);
  $top = $cand && (count($cand) === 1 || $cand[0]['score'] > $cand[1]['score']) && $cand[0]['score'] >= 80 ? $cand[0] : null;
  if ($top) { // har prosjektet allerede en annen Cubicasa-ordre, må Studiovest velge selv (ny levering eller feil prosjekt?)
    $q = db()->prepare("SELECT order_id FROM fp_job WHERE tenant_id=? AND job_id=? AND order_id IS NOT NULL AND order_id <> ? LIMIT 1"); $q->execute([SV_TENANT, $top['job'], (string)($o['id'] ?? '')]);
    if ($q->fetchColumn()) { $cand[0]['why'] .= ' (prosjektet har allerede en Cubicasa-ordre)'; $top = null; }
  }
  return [$top, $cand];
}
// Fast jobb: ser etter nye ferdige ordrer og kobler dem til prosjekter.
function cc_sync(): array {
  cc_tables(); $res = cc_get('/orders', ['status' => 'Ready', 'limit' => 50]); $items = $res['items'] ?? [];
  $st = cc_state(); $jobs = $st['newJobs'] ?? []; $n = ['ny' => 0, 'koblet' => 0, 'umatchet' => 0];
  $first = get_meta('cc_init') !== 'ok'; // første gang: ordrer som allerede er ferdige, er levert på gamlemåten og hoppes over
  $seen = db()->prepare('SELECT 1 FROM cc_order WHERE tenant_id=? AND order_id=?');
  $ins = db()->prepare('INSERT INTO cc_order (order_id, tenant_id, address, status, job_id, candidates, raw, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)');
  foreach ($items as $o) {
    $oid = (string)($o['id'] ?? ''); if ($oid === '') continue;
    $seen->execute([SV_TENANT, $oid]); if ($seen->fetchColumn()) continue;
    $addr = (string)($o['address']['full_address'] ?? trim(($o['address']['street'] ?? '') . ' ' . ($o['address']['number'] ?? '')));
    $raw = json_encode(['address' => $o['address'] ?? [], 'info' => ['add_info' => $o['info']['add_info'] ?? null, 'external_id' => $o['info']['external_id'] ?? null, 'created_at' => $o['info']['created_at'] ?? null]], JSON_UNESCAPED_UNICODE);
    if ($first) { $ins->execute([$oid, SV_TENANT, $addr, 'gammel', null, '[]', $raw, now(), now()]); continue; }
    $n['ny']++; [$top, $cand] = cc_match($o, $jobs);
    if ($top) { cc_queue($oid, $top['job'], cc_first($st, $top['job']), 'cubicasa'); $n['koblet']++; } else $n['umatchet']++;
    $ins->execute([$oid, SV_TENANT, $addr, $top ? 'koblet' : ($cand ? 'flere' : 'umatchet'), $top['job'] ?? null, json_encode($cand, JSON_UNESCAPED_UNICODE), $raw, now(), now()]);
  }
  if ($first) { set_meta('cc_init', 'ok'); return ['ny' => 0, 'koblet' => 0, 'umatchet' => 0, 'info' => 'første kjøring: ' . count($items) . ' eldre ordrer registrert og hoppet over']; }
  // prøv igjen for ordrer uten prosjekt (prosjektet kan ha blitt laget etterpå)
  $old = db()->prepare("SELECT order_id, raw FROM cc_order WHERE tenant_id=? AND status IN ('umatchet','flere') AND created_at > ?"); $old->execute([SV_TENANT, gmdate('Y-m-d\TH:i:s\Z', time() - 60 * 86400)]);
  foreach ($old->fetchAll() as $r) {
    [$top, $cand] = cc_match(json_decode((string)$r['raw'], true) ?: [], $jobs);
    if ($top) { cc_queue($r['order_id'], $top['job'], cc_first($st, $top['job']), 'cubicasa'); $n['koblet']++; }
    db()->prepare('UPDATE cc_order SET status=?, job_id=?, candidates=?, updated_at=? WHERE tenant_id=? AND order_id=?')->execute([$top ? 'koblet' : ($cand ? 'flere' : 'umatchet'), $top['job'] ?? null, json_encode($cand, JSON_UNESCAPED_UNICODE), now(), SV_TENANT, $r['order_id']]);
  }
  return $n + ['info' => count($items) . ' ferdige ordrer sjekket: ' . $n['koblet'] . ' koblet, ' . $n['umatchet'] . ' uten sikkert prosjekt'];
}
// Manuell kobling fra portalen
function cc_link(string $orderId, string $job, string $by): int {
  cc_tables(); db()->prepare("UPDATE cc_order SET status='koblet', job_id=?, updated_at=? WHERE tenant_id=? AND order_id=?")->execute([$job, now(), SV_TENANT, $orderId]);
  return cc_queue($orderId, $job, cc_first(cc_state(), $job), $by);
}
