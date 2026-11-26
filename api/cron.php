<?php
// Faste jobber. Kalles hvert 30. minutt av GitHub Actions (cron.yml) med hemmelig nøkkel. Små steg, så PHP-tidsgrensen holder.
require __DIR__ . '/lib.php';
$tok = (string)($_GET['token'] ?? '');
if (!hash_equals(substr(hash('sha256', app_secret() . '|cron'), 0, 32), $tok)) fail('Ingen tilgang', 403);
$done = [];
try { db()->prepare('DELETE FROM login_tokens WHERE expires < ?')->execute([time() - 86400]); $done[] = 'gamle innloggingslenker slettet'; } catch (Throwable $e) { $done[] = 'opprydding feilet'; }
if (s3_on() && get_meta('s3_setup') !== 'ok') { $r = s3_setup(); set_meta('s3_setup', $r['ok'] ? 'ok' : 'feil'); $done[] = 'wasabi: ' . $r['info']; }
// E-postagent: les nye bestillinger fra meglere og lag prosjekter (krever ANTHROPIC_API_KEY)
require_once __DIR__ . '/agent.php';
if (agent_on() && agent_enabled('email')) { try { $r = agent_run(20, 8); $done[] = 'agent: ' . $r['info']; agent_ran('email', $r['info']); } catch (Throwable $e) { $done[] = 'agent feilet: ' . substr($e->getMessage(), 0, 200); agent_ran('email', $e->getMessage(), false); } }
// Adresseagent: finner postnummer, kommune og gnr/bnr for nye prosjekter (Kartverket, gratis)
require_once __DIR__ . '/enrich.php';
if (agent_enabled('address')) { try { $r = enrich_jobs(5); if ($r['n']) $done[] = 'adresse: ' . $r['info']; agent_ran('address', $r['info']); } catch (Throwable $e) { $done[] = 'adresse feilet: ' . substr($e->getMessage(), 0, 200); agent_ran('address', $e->getMessage(), false); } }
// Cubicasa: kobler ferdige plantegningsordrer til prosjekter (plantegningsagenten i GitHub Actions leverer dem)
require_once __DIR__ . '/cubicasa.php';
if (cc_on() && agent_enabled('cubicasa')) { try { $r = cc_sync(); if ($r['ny'] || $r['koblet'] || strpos($r['info'], 'første') === 0) $done[] = 'cubicasa: ' . $r['info']; agent_ran('cubicasa', $r['info']); } catch (Throwable $e) { $done[] = 'cubicasa feilet: ' . substr($e->getMessage(), 0, 200); agent_ran('cubicasa', $e->getMessage(), false); } }
// Plantegningsagent: fortsetter forespørsler som gikk tom for tid
require_once __DIR__ . '/plan.php';
if (claude_key('FLOORPLAN_EDIT') !== '' && agent_enabled('floorplan_edit')) { try { $r = plan_continue(2); if ($r['n']) $done[] = 'plantegning: ' . $r['n'] . ' fortsatt'; } catch (Throwable $e) { $done[] = 'plantegning feilet: ' . substr($e->getMessage(), 0, 200); } }
$info = implode('; ', $done);
db()->prepare('INSERT INTO cron_runs (task, ok, info, at) VALUES (?,?,?,?)')->execute(['kvarter', 1, $info, now()]);
db()->exec('DELETE FROM cron_runs WHERE id < (SELECT m FROM (SELECT MAX(id) - 2000 AS m FROM cron_runs) t)');
json_out(['ok' => true, 'done' => $done]);
