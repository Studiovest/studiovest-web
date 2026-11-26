<?php
// Agent-logg for portalen. GET = siste e-poster agenten har sett. POST {a:'retry', id} = les på nytt. POST {a:'run'} = kjør nå.
require __DIR__ . '/agent.php';
$u = require_user();
if (!agent_on()) json_out(['ok' => true, 'on' => false, 'rows' => []]);
agent_tables();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $b = body();
  if (($b['a'] ?? '') === 'run') { try { json_out(['ok' => true] + agent_run(25, 8)); } catch (Throwable $e) { fail($e->getMessage(), 500); } }
  if (($b['a'] ?? '') === 'retry') {
    $s = db()->prepare('SELECT * FROM agent_mail WHERE tenant_id=? AND id=?'); $s->execute([$u['tenant_id'], (int)($b['id'] ?? 0)]); $row = $s->fetch();
    if (!$row || !$row['body']) fail('Fant ikke e-posten (eller den ble ikke lagret fordi den ikke så ut som en bestilling)', 404);
    $used = 0; json_out(['ok' => true, 'info' => agent_process($row, $used)]);
  }
  fail('Ukjent handling');
}
$rows = db()->prepare("SELECT id, from_name, from_addr, subject, received, status, job_id, info, data, tokens_in, tokens_out FROM agent_mail WHERE tenant_id=? AND status <> 'ignorert' ORDER BY id DESC LIMIT 100");
$rows->execute([$u['tenant_id']]); $out = $rows->fetchAll();
foreach ($out as &$r) { $r['data'] = $r['data'] ? json_decode($r['data'], true) : null; } unset($r);
$m = db()->prepare("SELECT COALESCE(SUM(tokens_in),0) i, COALESCE(SUM(tokens_out),0) o, COUNT(*) n FROM agent_mail WHERE tenant_id=? AND created_at >= ?");
$m->execute([$u['tenant_id'], gmdate('Y-m-01')]); $mo = $m->fetch();
$seen = db()->prepare('SELECT COUNT(*) FROM agent_mail WHERE tenant_id=? AND created_at >= ?'); $seen->execute([$u['tenant_id'], gmdate('Y-m-01')]);
require_once __DIR__ . '/enrich.php'; enrich_tables();
$g = db()->prepare("SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN status='ok' THEN 1 ELSE 0 END),0) ok FROM geo_log WHERE tenant_id=? AND at >= ?"); $g->execute([$u['tenant_id'], gmdate('Y-m-01')]); $geo = $g->fetch();
json_out(['ok' => true, 'on' => true, 'rows' => $out, 'geo' => ['n' => (int)$geo['n'], 'ok' => (int)$geo['ok']], 'month' => ['emails' => (int)$seen->fetchColumn(), 'tokens_in' => (int)$mo['i'], 'tokens_out' => (int)$mo['o'],
  'usd' => claude_usd((int)$mo['i'], (int)$mo['o'])], 'last_run' => db()->query('SELECT at FROM cron_runs ORDER BY id DESC LIMIT 1')->fetchColumn() ?: null]);
