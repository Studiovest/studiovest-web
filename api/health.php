<?php
// Status for oppsettet. Oppretter databasetabeller ved første kall, og setter opp Wasabi-bøtta én gang.
require __DIR__ . '/lib.php';
$out = ['ok' => true, 'php' => PHP_VERSION, 'time' => now()];
try { db(); $out['db'] = 'ok'; $out['schema'] = get_meta('schema'); }
catch (Throwable $e) { $out['ok'] = false; $out['db'] = 'feil: ' . substr($e->getMessage(), 0, 160); }
$out['mail'] = cfg('MAIL_USER') ? 'satt opp (' . cfg('MAIL_USER') . ')' : 'mangler';
$out['imap_ext'] = function_exists('imap_open');
$out['curl'] = function_exists('curl_init');
if (s3_on() && ($out['db'] ?? '') === 'ok') {
  $done = get_meta('s3_setup');
  if ($done !== 'ok' || isset($_GET['s3'])) { $r = s3_setup(); set_meta('s3_setup', $r['ok'] ? 'ok' : 'feil'); $out['wasabi'] = $r['info']; }
  else $out['wasabi'] = 'klar (' . cfg('WASABI_BUCKET') . ', ' . cfg('WASABI_REGION') . ')';
} else $out['wasabi'] = s3_on() ? 'venter på database' : 'mangler';
try { $out['last_cron'] = db()->query('SELECT at FROM cron_runs ORDER BY id DESC LIMIT 1')->fetchColumn() ?: null; } catch (Throwable $e) {}
json_out($out, $out['ok'] ? 200 : 500);
