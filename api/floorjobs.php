<?php
// Ferdige plantegninger (leveranse). Studiovest laster opp Cubicasa-PDF-en på prosjektet (senere gjør Floorplan-fetcher-agenten det),
// og plantegningsagenten i GitHub Actions (.github/floorplan/agent.py) lager, sjekker og leverer JPG-ene i kontorets mal.
//
// Innlogget (portalen):  GET ?job=ID · POST multipart (pdf, job, first, notes) · POST {a:'retry', id} · GET ?a=file&id=&name=
// Agenten (?token=):     GET a=pending · GET a=project&id= · GET a=pdf&id= · POST a=save&id= / a=flag&id= (multipart file, summary/reason) · POST a=usage&id=
require __DIR__ . '/lib.php';
require_once __DIR__ . '/agent.php';
require_once __DIR__ . '/cubicasa.php';

const FP_OFFICE = ['emn' => 'em_norge', 'em1' => 'em1_sor', 'aksun' => 'aktiv_sunnhordland', 'nvhar' => 'nordvik', 'nvsun' => 'nordvik', 'nvhau' => 'nordvik'];
const FP_STATUS = ['venter', 'kjører', 'levert', 'sjekk', 'feil'];

function fp_tables(): void { cc_tables(); }
function fp_dir(int $id): string { $d = __DIR__ . '/data/plans/' . $id; if (!is_dir($d)) mkdir($d, 0750, true); return $d; }
function fp_row(int $id): array { $s = db()->prepare('SELECT * FROM fp_job WHERE tenant_id=? AND id=?'); $s->execute([SV_TENANT, $id]); $r = $s->fetch(); if (!$r) fail('Fant ikke jobben', 404); return $r; }
function fp_set(int $id, array $f): void { $f['updated_at'] = now(); db()->prepare('UPDATE fp_job SET ' . implode(', ', array_map(fn($k) => "$k=?", array_keys($f))) . ' WHERE tenant_id=? AND id=?')->execute(array_merge(array_values($f), [SV_TENANT, $id])); }
function fp_public(array $r): array { $r['files'] = json_decode((string)$r['files'], true) ?: []; $r['usd'] = round(((int)$r['tokens_in'] * 3 + (int)$r['tokens_out'] * 15) / 1e6, 3); unset($r['log']); return $r; }
function fp_project(string $jobId): ?array {
  $s = db()->prepare('SELECT data FROM app_state WHERE tenant_id=? AND scope=?'); $s->execute([SV_TENANT, 'studio']);
  foreach ((json_decode((string)$s->fetchColumn(), true) ?: [])['newJobs'] ?? [] as $j) if (($j['id'] ?? '') === $jobId) return $j;
  return null;
}
// «Haugen 23», «Stord» → 23_haugen_stord
function fp_slug(string $addr, string $town): string {
  $a = trim($addr); $num = '';
  if (preg_match('/^(.*?)\s+(\d+\s*[A-Za-z]?)$/u', $a, $m)) { $a = $m[1]; $num = str_replace(' ', '', $m[2]); }
  $t = mb_strtolower(trim($num . ' ' . $a . ' ' . $town)); $t = strtr($t, ['æ' => 'ae', 'ø' => 'o', 'å' => 'a', 'é' => 'e', 'ü' => 'u', 'ö' => 'o', 'ä' => 'a']);
  return trim(preg_replace('/[^a-z0-9]+/', '_', $t), '_') ?: 'plantegning';
}
function fp_upload(int $id, string $field): array {
  $f = $_FILES[$field] ?? null; if (!$f || $f['error'] !== UPLOAD_ERR_OK) fail('Mangler fil (' . ($f['error'] ?? 'ingen') . ')');
  $name = preg_replace('/[^A-Za-z0-9_.-]/', '_', basename((string)$f['name']));
  if (!preg_match('/\.(jpe?g|png|pdf)$/i', $name)) fail('Bare JPG, PNG eller PDF');
  move_uploaded_file($f['tmp_name'], fp_dir($id) . '/' . $name) || fail('Kunne ikke lagre filen', 500);
  return ['name' => $name, 'size' => (int)$f['size']];
}
function fp_send(int $id, string $name): void {
  $name = basename($name); $path = fp_dir($id) . '/' . $name; if (!is_file($path)) fail('Fant ikke filen', 404);
  $type = preg_match('/\.pdf$/i', $name) ? 'application/pdf' : (preg_match('/\.png$/i', $name) ? 'image/png' : 'image/jpeg');
  header('Content-Type: ' . $type); header('Content-Length: ' . filesize($path)); header('Content-Disposition: ' . (isset($_GET['dl']) ? 'attachment' : 'inline') . '; filename="' . $name . '"');
  header('Cache-Control: private, max-age=3600'); readfile($path); exit;
}

fp_tables();
$tok = (string)($_GET['token'] ?? '');
if ($tok !== '') {
  // ---------- agenten i GitHub Actions ----------
  if (!hash_equals(substr(hash('sha256', app_secret() . '|cron'), 0, 32), $tok)) fail('Ingen tilgang', 403);
  $a = (string)($_GET['a'] ?? ''); $id = (int)($_GET['id'] ?? 0);
  if ($a === 'pending') {
    if (!agent_enabled('floorplan')) json_out(['ok' => true, 'ids' => [], 'info' => 'plantegningsagenten er slått av']);
    $s = db()->prepare("SELECT id FROM fp_job WHERE tenant_id=? AND (status='venter' OR (status='kjører' AND updated_at < ?)) ORDER BY id LIMIT 5");
    $s->execute([SV_TENANT, gmdate('Y-m-d\TH:i:s\Z', time() - 1800)]); json_out(['ok' => true, 'ids' => array_map('intval', $s->fetchAll(PDO::FETCH_COLUMN))]);
  }
  $r = fp_row($id);
  if ($a === 'project') {
    $j = fp_project((string)$r['job_id']) ?: [];
    $off = (string)($j['office'] ?? ''); $name = AGENT_OFFICES[$off][0] ?? ($off ?: 'ukjent');
    fp_set($id, ['status' => 'kjører']);
    json_out(['ok' => true, 'project_id' => (string)$id, 'portal_job' => $r['job_id'], 'address' => trim(($j['addr'] ?? '') . ', ' . ($j['town'] ?? $j['geo']['poststed'] ?? ''), ', '),
      'office' => $name, 'office_key' => FP_OFFICE[$off] ?? null, 'first_floor' => $r['first_floor'] ?: (string)((cc_state()['fpFirst'] ?? [])[$r['job_id']] ?? ''), 'notes' => (string)$r['notes'],
      'address_slug' => fp_slug((string)($j['addr'] ?? 'plantegning'), (string)($j['town'] ?? $j['geo']['poststed'] ?? '')),
      'first_floor_source' => $r['first_floor'] !== '' ? 'satt i portalen' : 'ikke satt (bruk Cubicasas oversikt)',
      'cubicasa_order_id' => $r['order_id'] ?: 'portal-' . $id, 'uploaded_pdf' => $r['pdf']]);
  }
  if ($a === 'pdf') fp_send($id, (string)$r['pdf']);
  if ($a === 'save' || $a === 'flag') {
    $files = json_decode((string)$r['files'], true) ?: [];
    if (!empty($_FILES['file'])) { $up = fp_upload($id, 'file'); $up['floor'] = (string)($_POST['floor'] ?? ''); $files = array_values(array_filter($files, fn($f) => $f['name'] !== $up['name'])); $files[] = $up; }
    $f = ['files' => json_encode($files, JSON_UNESCAPED_UNICODE)];
    if (isset($_POST['done'])) { $f['status'] = $a === 'save' ? 'levert' : 'sjekk'; if ($a === 'save') $f['summary'] = (string)($_POST['summary'] ?? ''); else $f['reason'] = (string)($_POST['reason'] ?? ''); }
    fp_set($id, $f); json_out(['ok' => true, 'files' => count($files)]);
  }
  if ($a === 'usage') { $b = body(); agent_ran('floorplan', !empty($b['error']) ? (string)$b['error'] : 'jobb ' . $id . ' ferdig', empty($b['error'])); fp_set($id, ['tokens_in' => (int)($b['in'] ?? 0), 'tokens_out' => (int)($b['out'] ?? 0), 'log' => substr((string)($b['log'] ?? ''), 0, 20000)] + (!empty($b['error']) ? ['status' => 'feil', 'reason' => substr((string)$b['error'], 0, 500)] : [])); json_out(['ok' => true]); }
  fail('Ukjent handling');
}

// ---------- portalen ----------
$u = require_user();
if (($_GET['a'] ?? '') === 'file') { fp_row((int)$_GET['id']); fp_send((int)$_GET['id'], (string)($_GET['name'] ?? '')); }
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  if (!empty($_FILES['pdf'])) {
    $job = (string)($_POST['job'] ?? ''); $first = trim((string)($_POST['first'] ?? ''));
    if ($job === '' || $first === '') fail('Velg prosjekt og første etasje');
    db()->prepare('INSERT INTO fp_job (tenant_id, job_id, status, first_floor, notes, files, by_who, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
      ->execute([SV_TENANT, $job, 'venter', $first, trim((string)($_POST['notes'] ?? '')), '[]', $u['email'], now(), now()]);
    $id = (int)db()->lastInsertId(); $up = fp_upload($id, 'pdf'); if (!preg_match('/\.pdf$/i', $up['name'])) fail('Last opp Cubicasa-PDF-en (uten mål)');
    fp_set($id, ['pdf' => $up['name']]); json_out(['ok' => true, 'id' => $id]);
  }
  $b = body();
  if (($b['a'] ?? '') === 'link') { $id = cc_link((string)$b['order'], (string)$b['job'], $u['email']); json_out(['ok' => true, 'id' => $id]); }
  if (($b['a'] ?? '') === 'ignore') { cc_tables(); db()->prepare("UPDATE cc_order SET status='ignorert', updated_at=? WHERE tenant_id=? AND order_id=?")->execute([now(), SV_TENANT, (string)$b['order']]); json_out(['ok' => true]); }
  if (($b['a'] ?? '') === 'retry') { fp_row((int)$b['id']); fp_set((int)$b['id'], ['status' => 'venter', 'reason' => null]); json_out(['ok' => true]); }
  fail('Ukjent handling');
}
if (($_GET['a'] ?? '') === 'unmatched') { // Cubicasa-ordrer agenten ikke kunne koble sikkert
  $s = db()->prepare("SELECT order_id, address, status, candidates, created_at FROM cc_order WHERE tenant_id=? AND status IN ('umatchet','flere') ORDER BY created_at DESC LIMIT 30"); $s->execute([SV_TENANT]);
  json_out(['ok' => true, 'on' => cc_on(), 'orders' => array_map(fn($r) => ['candidates' => json_decode((string)$r['candidates'], true) ?: []] + $r, $s->fetchAll())]);
}
$s = db()->prepare('SELECT * FROM fp_job WHERE tenant_id=? AND job_id=? ORDER BY id DESC LIMIT 20'); $s->execute([SV_TENANT, (string)($_GET['job'] ?? '')]);
json_out(['ok' => true, 'on' => claude_key('FLOORPLAN') !== '', 'cubicasa' => cc_on(), 'jobs' => array_map('fp_public', $s->fetchAll())]);
