<?php
// Faste jobber. Kalles hvert 15. minutt av GitHub Actions (cron.yml) med hemmelig nøkkel. Små steg, så PHP-tidsgrensen holder.
require __DIR__ . '/lib.php';
$tok = (string)($_GET['token'] ?? '');
if (!hash_equals(substr(hash('sha256', app_secret() . '|cron'), 0, 32), $tok)) fail('Ingen tilgang', 403);
$done = [];
try { db()->prepare('DELETE FROM login_tokens WHERE expires < ?')->execute([time() - 86400]); $done[] = 'gamle innloggingslenker slettet'; } catch (Throwable $e) { $done[] = 'opprydding feilet'; }
if (s3_on() && get_meta('s3_setup') !== 'ok') { $r = s3_setup(); set_meta('s3_setup', $r['ok'] ? 'ok' : 'feil'); $done[] = 'wasabi: ' . $r['info']; }
// E-postagent: les nye bestillinger fra meglere og lag prosjekter (krever ANTHROPIC_API_KEY)
require_once __DIR__ . '/agent.php';
if (agent_on()) { try { $r = agent_run(20, 8); $done[] = 'agent: ' . $r['info']; } catch (Throwable $e) { $done[] = 'agent feilet: ' . substr($e->getMessage(), 0, 200); } }
// Adresseagent: finner postnummer, kommune og gnr/bnr for nye prosjekter (Kartverket, gratis)
require_once __DIR__ . '/enrich.php';
try { $r = enrich_jobs(5); if ($r['n']) $done[] = 'adresse: ' . $r['info']; } catch (Throwable $e) { $done[] = 'adresse feilet: ' . substr($e->getMessage(), 0, 200); }
// Plantegningsagent: fortsetter forespørsler som gikk tom for tid
require_once __DIR__ . '/plan.php';
if (cfg('ANTHROPIC_API_KEY')) { try { $r = plan_continue(2); if ($r['n']) $done[] = 'plantegning: ' . $r['n'] . ' fortsatt'; } catch (Throwable $e) { $done[] = 'plantegning feilet: ' . substr($e->getMessage(), 0, 200); } }
$info = implode('; ', $done);
db()->prepare('INSERT INTO cron_runs (task, ok, info, at) VALUES (?,?,?,?)')->execute(['kvarter', 1, $info, now()]);
db()->exec('DELETE FROM cron_runs WHERE id < (SELECT m FROM (SELECT MAX(id) - 2000 AS m FROM cron_runs) t)');
json_out(['ok' => true, 'done' => $done]);
