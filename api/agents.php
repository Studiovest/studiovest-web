<?php
// Agenter: oversikt, av/på og «kjør nå» for alle agentene i portalen.
// GET → status, kostnad, kø og siste hendelser per agent. POST {a:'toggle', id, on} · {a:'run', id} · {a:'budget', usd}
require __DIR__ . '/agent.php';
require_once __DIR__ . '/enrich.php';
require_once __DIR__ . '/cubicasa.php';
require_once __DIR__ . '/plan.php';
$u = require_user(); @set_time_limit(90);
agent_tables(); enrich_tables(); cc_tables(); plan_tables();
$month = gmdate('Y-m-01'); $p = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $b = body(); $id = (string)($b['id'] ?? ''); $by = (string)($u['name'] ?: $u['email']);
  if (($b['a'] ?? '') === 'toggle') { if (!in_array($id, AGENT_IDS, true)) fail('Ukjent agent'); agent_set($id, ['on' => !empty($b['on']), 'by' => $by, 'at' => now()]); json_out(['ok' => true]); }
  if (($b['a'] ?? '') === 'budget') { set_meta('agent_budget', (string)max(1, (float)($b['usd'] ?? 50))); json_out(['ok' => true]); }
  if (($b['a'] ?? '') === 'run') {
    try {
      if ($id === 'email') { if (!agent_on()) fail('Mangler CLAUDE_KEY_EMAIL'); $r = agent_run(25, 8); agent_ran('email', $r['info']); json_out(['ok' => true, 'info' => $r['info']]); }
      if ($id === 'address') { $r = enrich_jobs(5); agent_ran('address', $r['info']); json_out(['ok' => true, 'info' => $r['info']]); }
      if ($id === 'cubicasa') { if (!cc_on()) fail('Mangler CUBICASA_API_KEY'); $r = cc_sync(); agent_ran('cubicasa', $r['info']); json_out(['ok' => true, 'info' => $r['info']]); }
      if ($id === 'floorplan_edit') { $r = plan_continue(2); json_out(['ok' => true, 'info' => $r['n'] ? $r['n'] . ' forespørsler fortsatt' : 'ingen forespørsler venter']); }
      fail('Denne agenten kjører i GitHub Actions hvert 30. minutt og kan ikke startes herfra');
    } catch (Throwable $e) { agent_ran($id, $e->getMessage(), false); fail($e->getMessage(), 500); }
  }
  fail('Ukjent handling');
}

function q1(string $sql, array $a = []) { $s = db()->prepare($sql); $s->execute($a); return $s->fetch() ?: []; }
function qa(string $sql, array $a = []): array { $s = db()->prepare($sql); $s->execute($a); return $s->fetchAll(); }
function ran(string $id): ?array { $r = json_decode((string)(get_meta('ran_' . $id) ?? ''), true); return is_array($r) ? $r : null; }
$T = SV_TENANT; $cfg = agent_cfg();

$em = q1("SELECT COUNT(*) n, COALESCE(SUM(tokens_in),0) i, COALESCE(SUM(tokens_out),0) o, COALESCE(SUM(CASE WHEN job_id IS NOT NULL AND status IN ('opprettet','sjekk') THEN 1 ELSE 0 END),0) jobs, COALESCE(SUM(CASE WHEN status IN ('sjekk','feil') THEN 1 ELSE 0 END),0) chk FROM agent_mail WHERE tenant_id=? AND created_at >= ?", [$T, $month]);
$geo = q1("SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN status='ok' THEN 1 ELSE 0 END),0) ok, COALESCE(SUM(CASE WHEN status='velg' THEN 1 ELSE 0 END),0) velg FROM geo_log WHERE tenant_id=? AND at >= ?", [$T, $month]);
$cc = q1("SELECT COALESCE(SUM(CASE WHEN status='koblet' THEN 1 ELSE 0 END),0) koblet, COALESCE(SUM(CASE WHEN status IN ('umatchet','flere') THEN 1 ELSE 0 END),0) open FROM cc_order WHERE tenant_id=? AND created_at >= ?", [$T, $month]);
$fp = q1("SELECT COUNT(*) n, COALESCE(SUM(tokens_in),0) i, COALESCE(SUM(tokens_out),0) o, COALESCE(SUM(CASE WHEN status='levert' THEN 1 ELSE 0 END),0) ok, COALESCE(SUM(CASE WHEN status IN ('sjekk','feil') THEN 1 ELSE 0 END),0) chk, COALESCE(SUM(CASE WHEN status IN ('venter','kjører') THEN 1 ELSE 0 END),0) q FROM fp_job WHERE tenant_id=? AND created_at >= ?", [$T, $month]);
$pe = q1("SELECT COUNT(*) n, COALESCE(SUM(tokens_in),0) i, COALESCE(SUM(tokens_out),0) o, COALESCE(SUM(CASE WHEN status='til godkjenning' THEN 1 ELSE 0 END),0) appr, COALESCE(SUM(CASE WHEN status IN ('spørsmål','feil','manuell') THEN 1 ELSE 0 END),0) chk, COALESCE(SUM(CASE WHEN status IN ('venter','kjører') THEN 1 ELSE 0 END),0) q FROM plan_session WHERE tenant_id=? AND created_at >= ?", [$T, $month]);

$agents = [
  ['id' => 'email', 'name' => 'E-postagent', 'what' => 'Leser innboksen, lager prosjekter fra bestillinger, oppdaterer endringer og sender plantegningsendringer videre. Flytter registrerte e-poster til «' . (cfg('AGENT_FOLDER', 'Registrerte bestillinger') ?: 'ingen mappe') . '».',
   'claude' => true, 'key' => claude_key('EMAIL') !== '', 'where' => 'one.com', 'can_run' => true,
   'stats' => [['E-poster lest', (int)$em['n']], ['Prosjekter laget', (int)$em['jobs']], ['Til sjekk', (int)$em['chk']]], 'usd' => claude_usd((int)$em['i'], (int)$em['o']),
   'recent' => array_map(fn($r) => ['at' => $r['created_at'], 'text' => ($r['subject'] ?: '(uten emne)') . ' · ' . $r['from_name'], 'status' => $r['status'], 'job' => $r['job_id']], qa("SELECT created_at, subject, from_name, status, job_id FROM agent_mail WHERE tenant_id=? AND status <> 'ignorert' ORDER BY id DESC LIMIT 6", [$T]))],
  ['id' => 'address', 'name' => 'Adresseagent', 'what' => 'Finner postnummer, kommune, gnr/bnr, bygningstype og leilighetsnummer hos Kartverket for nye prosjekter.',
   'claude' => false, 'key' => true, 'where' => 'one.com', 'can_run' => true,
   'stats' => [['Slått opp', (int)$geo['n']], ['Funnet', (int)$geo['ok']], ['Må velges', (int)$geo['velg']]], 'usd' => 0,
   'recent' => array_map(fn($r) => ['at' => $r['at'], 'text' => $r['query'], 'status' => $r['status'], 'job' => $r['job_id']], qa('SELECT at, query, status, job_id FROM geo_log WHERE tenant_id=? ORDER BY id DESC LIMIT 6', [$T]))],
  ['id' => 'cubicasa', 'name' => 'Cubicasa-henting', 'what' => 'Ser etter ferdige Cubicasa-ordrer og kobler dem til prosjektet med samme adresse.',
   'claude' => false, 'key' => cc_on(), 'key_name' => 'CUBICASA_API_KEY', 'where' => 'one.com', 'can_run' => true,
   'stats' => [['Koblet', (int)$cc['koblet']], ['Uten prosjekt', (int)$cc['open']]], 'usd' => 0,
   'recent' => array_map(fn($r) => ['at' => $r['updated_at'], 'text' => $r['address'], 'status' => $r['status'], 'job' => $r['job_id']], qa("SELECT updated_at, address, status, job_id FROM cc_order WHERE tenant_id=? AND status <> 'gammel' ORDER BY updated_at DESC LIMIT 6", [$T]))],
  ['id' => 'floorplan', 'name' => 'Plantegningsagent', 'what' => 'Lager ferdige plantegninger i meglerkontorets mal fra Cubicasa, sjekker dem og legger dem på prosjektet.',
   'claude' => true, 'key' => claude_key('FLOORPLAN') !== '', 'where' => 'GitHub Actions', 'can_run' => false,
   'stats' => [['Levert', (int)$fp['ok']], ['I kø', (int)$fp['q']], ['Til sjekk', (int)$fp['chk']]], 'usd' => claude_usd((int)$fp['i'], (int)$fp['o']),
   'recent' => array_map(fn($r) => ['at' => $r['updated_at'], 'text' => $r['summary'] ?: ($r['reason'] ?: 'Plantegninger'), 'status' => $r['status'], 'job' => $r['job_id']], qa('SELECT updated_at, job_id, status, summary, reason FROM fp_job WHERE tenant_id=? ORDER BY id DESC LIMIT 6', [$T]))],
  ['id' => 'floorplan_edit', 'name' => 'Plantegningsredigering', 'what' => 'Gjør endringer på plantegningen når megler, kunde eller fotograf ber om det (i portalen eller på e-post). Du godkjenner før noe publiseres.',
   'claude' => true, 'key' => claude_key('FLOORPLAN_EDIT') !== '', 'where' => 'one.com', 'can_run' => true,
   'stats' => [['Forespørsler', (int)$pe['n']], ['Til godkjenning', (int)$pe['appr']], ['Til sjekk', (int)$pe['chk']]], 'usd' => claude_usd((int)$pe['i'], (int)$pe['o']),
   'recent' => array_map(fn($r) => ['at' => $r['updated_at'], 'text' => mb_substr((string)$r['request'], 0, 90), 'status' => $r['status'], 'job' => $r['job_id']], qa('SELECT updated_at, job_id, status, request FROM plan_session WHERE tenant_id=? ORDER BY id DESC LIMIT 6', [$T]))],
];
foreach ($agents as &$a) { $a['on'] = agent_enabled($a['id']); $a['changed'] = $cfg[$a['id']] ?? null; $a['last'] = ran($a['id']); $a['key_name'] = $a['key_name'] ?? ($a['claude'] ? 'CLAUDE_KEY_' . strtoupper($a['id']) : null); } unset($a);
$total = array_sum(array_column($agents, 'usd'));
json_out(['ok' => true, 'agents' => $agents, 'month' => ['usd' => round($total, 2), 'budget' => (float)(get_meta('agent_budget') ?? 50)],
  'last_cron' => q1('SELECT at, info FROM cron_runs ORDER BY id DESC LIMIT 1') ?: null, 'schedule' => 'hvert 30. minutt']);
