<?php
// Plantegningsagent for portalen.
// GET ?job=ID  → scener og forespørsler for prosjektet
// POST {a:'run', job, floor, text, from} · {a:'answer', id, text} · {a:'approve', id} · {a:'reject', id} · {a:'save', job, floor, scene}
require __DIR__ . '/plan.php';
$u = require_user(); plan_tables(); @set_time_limit(120);
$on = claude_key('FLOORPLAN_EDIT') !== '' || (bool)cfg('PLAN_FAKE');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $b = body(); $a = (string)($b['a'] ?? ''); $by = (string)($u['name'] ?: $u['email']);
  try {
    if ($a === 'save') { // legg inn eller erstatt en plantegning (scene-JSON), f.eks. fra Cubicasa-import
      $sc = $b['scene'] ?? null; if (!is_array($sc) || empty($sc['rooms']) || empty($sc['walls'])) fail('Ugyldig plantegning: mangler rom eller vegger');
      if (!in_array($sc['office'] ?? '', PLAN_OFFICES, true)) fail('Ukjent kontorstil (office)');
      json_out(['ok' => true, 'version' => plan_put((string)$b['job'], (string)$b['floor'], $sc, $by), 'warnings' => plan_check($sc)]);
    }
    if (!$on) fail('Agenten er ikke slått på (mangler CLAUDE_KEY_FLOORPLAN_EDIT)');
    if ($a === 'run') json_out(['ok' => true] + plan_request((string)$b['job'], (string)$b['floor'], trim((string)$b['text']), (string)($b['from'] ?? $by)));
    if ($a === 'answer') json_out(['ok' => true] + plan_answer((int)$b['id'], trim((string)$b['text'])));
    if ($a === 'approve') json_out(['ok' => true] + plan_approve((int)$b['id'], $by));
    if ($a === 'reject') { $r = plan_session((int)$b['id']); plan_save_session((int)$r['id'], ['status' => 'avvist', 'info' => 'Avvist av ' . $by]); json_out(['ok' => true]); }
  } catch (Throwable $e) { fail($e->getMessage(), 500); }
  fail('Ukjent handling');
}
$job = (string)($_GET['job'] ?? '');
$sc = db()->prepare('SELECT floor, scene, version, updated_at FROM plan_scene WHERE tenant_id=? AND job_id=?'); $sc->execute([SV_TENANT, $job]);
$scenes = []; foreach ($sc->fetchAll() as $r) $scenes[$r['floor']] = ['scene' => json_decode((string)$r['scene'], true), 'version' => (int)$r['version'], 'at' => $r['updated_at']];
$ss = db()->prepare('SELECT id, floor, status, request, from_who, draft, question, summary, info, tokens_in, tokens_out, created_at, updated_at FROM plan_session WHERE tenant_id=? AND job_id=? ORDER BY id DESC LIMIT 20');
$ss->execute([SV_TENANT, $job]); $rows = $ss->fetchAll();
foreach ($rows as &$r) { $r['draft'] = $r['status'] === 'til godkjenning' ? json_decode((string)$r['draft'], true) : null; $r['usd'] = round(((int)$r['tokens_in'] * 3 + (int)$r['tokens_out'] * 15) / 1e6, 3); } unset($r);
json_out(['ok' => true, 'on' => $on, 'scenes' => $scenes, 'sessions' => $rows]);
