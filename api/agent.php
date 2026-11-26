<?php
// E-postagent: henter ny e-post fra imap.one.com, lar Claude lese bestillinger fra meglere,
// og oppretter prosjekter i portalen. Kjøres fra cron.php hvert 15. minutt, i små steg.
//
// Oppsett (STUDIOVEST_CONFIG): ANTHROPIC_API_KEY (påkrevd), IMAP_USER/IMAP_PASSWORD (standard: MAIL_USER/MAIL_PASSWORD),
// IMAP_HOST (imap.one.com), AGENT_MODEL (claude-sonnet-5-5), AGENT_MAX_PER_DAY (100), AGENT_DOMAINS (meglerdomener, komma).
declare(strict_types=1);
require_once __DIR__ . '/lib.php';

const AGENT_SERVICES = [
  'f20' => 'Liten fotopakke (20 bilder)', 'f30' => 'Standard fotopakke', 'f40' => 'Premium fotopakke (med 5 kveldsbilder)',
  'ut' => 'Ekstra utefotografering', 'to' => 'Tomtefoto', 'vm' => 'Virtuell møblering (per bilde)',
  'kv' => 'Kveldsbilde redigert fra dagbilde (per bilde)', 'ex' => 'Ekspress, levert innen 24 timer',
];

function agent_on(): bool { return (bool)cfg('ANTHROPIC_API_KEY') || cfg('AGENT_FAKE'); }

function agent_tables(): void {
  $p = db(); $ai = is_sqlite($p) ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
  $tx = is_sqlite($p) ? 'TEXT' : 'LONGTEXT'; $eng = is_sqlite($p) ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
  $p->exec("CREATE TABLE IF NOT EXISTS agent_mail (id $ai, tenant_id VARCHAR(40) NOT NULL, uid BIGINT, message_id VARCHAR(255), from_name VARCHAR(190), from_addr VARCHAR(190), subject VARCHAR(255), received VARCHAR(25), body $tx, status VARCHAR(20), job_id VARCHAR(30), data $tx, info VARCHAR(500), tokens_in INT, tokens_out INT, tries INT NOT NULL DEFAULT 0, created_at VARCHAR(25))$eng");
  try { $p->exec('CREATE UNIQUE INDEX ux_agent_mail_mid ON agent_mail (tenant_id, message_id)'); } catch (Throwable $e) {}
}

// ---------------- IMAP (ren PHP, krever ikke imap-utvidelsen) ----------------
final class Imap {
  private $fp; private int $n = 0;
  function __construct(string $host, int $port, bool $ssl, string $user, string $pass) {
    $this->fp = @stream_socket_client(($ssl ? 'ssl://' : 'tcp://') . "$host:$port", $no, $err, 20);
    if (!$this->fp) throw new Exception("IMAP-tilkobling feilet: $err");
    stream_set_timeout($this->fp, 30);
    $this->line();
    $this->cmd('LOGIN ' . $this->q($user) . ' ' . $this->q($pass));
  }
  private function q(string $s): string { return '"' . addcslashes($s, "\\\"") . '"'; }
  private function line(): string { $l = fgets($this->fp, 65536); if ($l === false) throw new Exception('IMAP: tilkoblingen ble brutt'); return $l; }
  // Sender kommando og returnerer [linjer, literaler]. Literaler ({n}) leses nøyaktig.
  function cmd(string $c): array {
    $tag = 'A' . (++$this->n); fwrite($this->fp, "$tag $c\r\n");
    $lines = []; $lits = [];
    while (true) {
      $l = $this->line();
      if (preg_match('/\{(\d+)\}\r\n$/', $l, $m)) {
        $len = (int)$m[1]; $buf = '';
        while (strlen($buf) < $len) { $chunk = fread($this->fp, min(65536, $len - strlen($buf))); if ($chunk === false || $chunk === '') throw new Exception('IMAP: avbrutt under lesing'); $buf .= $chunk; }
        $lits[] = $buf; $lines[] = $l; continue;
      }
      if (strpos($l, "$tag ") === 0) { if (!preg_match('/^' . $tag . ' OK/i', $l)) throw new Exception('IMAP: ' . trim(substr($l, strlen($tag) + 1))); break; }
      $lines[] = $l;
    }
    return [$lines, $lits];
  }
  function select(string $box = 'INBOX'): int { [$ls] = $this->cmd('SELECT ' . $this->q($box)); foreach ($ls as $l) if (preg_match('/UIDVALIDITY (\d+)/i', $l, $m)) return (int)$m[1]; return 0; }
  function search(string $crit): array { [$ls] = $this->cmd('UID SEARCH ' . $crit); foreach ($ls as $l) if (stripos($l, '* SEARCH') === 0) return array_map('intval', array_filter(preg_split('/\s+/', trim(substr($l, 8))))); return []; }
  function fetch(int $uid): ?string { [, $lits] = $this->cmd("UID FETCH $uid (BODY.PEEK[])"); return $lits[0] ?? null; }
  function close(): void { try { $this->cmd('LOGOUT'); } catch (Throwable $e) {} if ($this->fp) fclose($this->fp); }
}

// ---------------- MIME ----------------
function mime_hdr(string $v): string { $d = @iconv_mime_decode($v, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8'); return trim($d !== false ? $d : $v); }
function mime_split(string $raw): array {
  $raw = str_replace("\r\n", "\n", $raw); $pos = strpos($raw, "\n\n");
  $head = $pos === false ? $raw : substr($raw, 0, $pos); $body = $pos === false ? '' : substr($raw, $pos + 2);
  $head = preg_replace("/\n[ \t]+/", ' ', $head); $h = [];
  foreach (explode("\n", $head) as $l) { $i = strpos($l, ':'); if ($i) { $k = strtolower(trim(substr($l, 0, $i))); $h[$k] = ($h[$k] ?? '') === '' ? trim(substr($l, $i + 1)) : $h[$k]; } }
  return [$h, $body];
}
function mime_param(string $v, string $p): string { return preg_match('/' . $p . '\s*=\s*"?([^";]+)"?/i', $v, $m) ? $m[1] : ''; }
function to_utf8(string $s, string $cs): string { $cs = strtoupper($cs ?: 'UTF-8'); if ($cs === 'UTF-8' || $cs === 'US-ASCII') return $s; $r = @mb_convert_encoding($s, 'UTF-8', $cs); return $r !== false && $r !== '' ? $r : (@iconv($cs, 'UTF-8//IGNORE', $s) ?: $s); }
function html_text(string $h): string {
  $h = preg_replace('#<(script|style)[^>]*>.*?</\1>#is', '', $h);
  $h = preg_replace('#<br\s*/?>|</(p|div|tr|li|h\d)>#i', "\n", $h);
  return trim(preg_replace("/\n{3,}/", "\n\n", html_entity_decode(strip_tags($h), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
}
// Returnerer ['text'=>, 'html'=>, 'files'=>[navn]]
function mime_walk(array $h, string $body, array &$out): void {
  $ct = $h['content-type'] ?? 'text/plain'; $type = strtolower(trim(explode(';', $ct)[0]));
  if (strpos($type, 'multipart/') === 0) {
    $b = mime_param($ct, 'boundary'); if (!$b) return;
    foreach (array_slice(explode('--' . $b, $body), 1) as $part) {
      if (strpos($part, '--') === 0) break;
      [$ph, $pb] = mime_split(ltrim($part, "\r\n")); mime_walk($ph, $pb, $out);
    }
    return;
  }
  $enc = strtolower($h['content-transfer-encoding'] ?? '');
  if ($enc === 'base64') $body = base64_decode(preg_replace('/\s+/', '', $body)) ?: '';
  elseif ($enc === 'quoted-printable') $body = quoted_printable_decode($body);
  $disp = strtolower($h['content-disposition'] ?? ''); $name = mime_param($disp ?: $ct, 'filename') ?: mime_param($ct, 'name');
  if ($name || strpos($disp, 'attachment') === 0) { $out['files'][] = mime_hdr($name ?: 'vedlegg'); return; }
  $txt = to_utf8($body, mime_param($ct, 'charset'));
  if ($type === 'text/plain' && $out['text'] === '') $out['text'] = $txt;
  elseif ($type === 'text/html' && $out['html'] === '') $out['html'] = $txt;
}
function mime_parse(string $raw): array {
  [$h, $body] = mime_split($raw); $out = ['text' => '', 'html' => '', 'files' => []]; mime_walk($h, $body, $out);
  $from = mime_hdr($h['from'] ?? ''); $addr = preg_match('/<([^>]+)>/', $from, $m) ? $m[1] : trim($from);
  $name = trim(preg_replace('/<[^>]+>/', '', $from), " \"'") ?: $addr;
  $text = $out['text'] !== '' ? $out['text'] : html_text($out['html']);
  // kutt sitert historikk (svar/videresending) under første «Fra:»/«From:»-blokk etter litt tekst
  $text = trim(preg_split('/\n(?:-{2,}\s*(?:Opprinnelig|Original|Videresendt|Forwarded)|(?:Fra|From):\s.+\n(?:Sendt|Sent|Date|Dato):)/i', $text)[0] ?? $text);
  $d = strtotime($h['date'] ?? '') ?: time();
  return ['message_id' => trim($h['message-id'] ?? '', '<> ') ?: sha1($raw), 'from_name' => $name, 'from_addr' => strtolower($addr), 'subject' => mime_hdr($h['subject'] ?? ''),
    'date' => gmdate('Y-m-d\TH:i:s\Z', $d), 'text' => mb_substr($text, 0, 12000), 'files' => $out['files'], 'auto' => isset($h['list-unsubscribe']) || isset($h['auto-submitted']) && stripos($h['auto-submitted'], 'no') !== 0 || preg_match('/no-?reply|mailer-daemon|postmaster/i', $addr)];
}

// ---------------- forhåndssortering (gratis) ----------------
function agent_candidate(array $m): bool {
  if ($m['auto']) return false;
  $own = array_filter([strtolower((string)cfg('MAIL_USER')), strtolower((string)cfg('IMAP_USER'))]);
  if (in_array($m['from_addr'], $own, true)) return false;
  $dom = substr(strrchr($m['from_addr'], '@') ?: '', 1);
  $known = array_filter(array_map('trim', explode(',', strtolower((string)cfg('AGENT_DOMAINS', '')))));
  if ($dom && in_array($dom, $known, true)) return true;
  $t = mb_strtolower($m['subject'] . "\n" . $m['text']);
  $order = preg_match('/bestill|fotografer|boligfoto|fotopakke|oppdrag|foto av|bilder av|befaring|tomtefoto|kveldsbild|utefoto|plantegning|visning|salgsoppgave|oppdragsn/u', $t);
  $place = preg_match('/\b[a-zæøå]+(?:vegen|veien|gata|gaten|gate|veg|vei|brygge|terrasse|tunet|plassen|bakken|stien|lia|haugen|myra|åsen|flaten|neset|kroken|vika|toppen)?\s+\d{1,4}\s?[a-z]?\b/u', $t);
  return $order && ($place || preg_match('/selger|eier|megler/u', $t));
}

// ---------------- Claude ----------------
function agent_prompt(): string {
  $svc = ''; foreach (AGENT_SERVICES as $k => $v) $svc .= "- $k: $v\n";
  return "Du leser e-post til Studiovest, et foto- og mediebyrå i Sunnhordland som tar boligfoto for eiendomsmeglere.\n" .
    "Avgjør om e-posten er en bestilling av boligfoto (eller endring av en bestilling), og hent ut feltene. Meglere skriver ofte kort: navn, telefon, e-post til selger og en adresse.\n" .
    "Produkter (bruk id-ene):\n$svc" .
    "Regler: Ingen pakke nevnt → la services være tom (ikke gjett). «N kveldsbilder» → kv med qty N. «virtuell møblering av N bilder» → vm med qty N. «haster»/«ekspress»/«i morgen tidlig» → ex.\n" .
    "Adresse: bare gate og nummer i addr; sted/poststed i town. Selger er boligeieren, ikke megleren. Megleren er avsenderen hvis ingenting annet står.\n" .
    "Ønsket tidspunkt, nøkkel, visning og annet nyttig går i note, kort. Sett missing til felter som mangler og som trengs (f.eks. addr, seller_phone, services).\n" .
    "confidence: høy hvis det tydelig er en bestilling med adresse; lav hvis usikker. Ikke finn på noe som ikke står i e-posten.";
}
function agent_tool(): array {
  $s = ['type' => 'string'];
  return ['name' => 'registrer_bestilling', 'description' => 'Registrer resultatet av å lese e-posten.',
    'input_schema' => ['type' => 'object', 'required' => ['is_order', 'confidence'], 'properties' => [
      'is_order' => ['type' => 'boolean'], 'confidence' => ['type' => 'string', 'enum' => ['høy', 'lav']],
      'addr' => $s, 'town' => $s, 'type' => ['type' => 'string', 'description' => 'Boligtype, f.eks. Enebolig, Leilighet, Rekkehus, Hytte'],
      'nr' => ['type' => 'string', 'description' => 'Oppdragsnummer'], 'office' => ['type' => 'string', 'description' => 'Meglerkontor'], 'broker' => ['type' => 'string', 'description' => 'Megler (navn)'],
      'services' => ['type' => 'array', 'items' => ['type' => 'string', 'enum' => array_keys(AGENT_SERVICES)]],
      'qty' => ['type' => 'object', 'description' => 'Antall for vm og kv, f.eks. {"kv":3}', 'additionalProperties' => ['type' => 'integer']],
      'seller' => $s, 'seller_email' => $s, 'seller_phone' => $s, 'access' => ['type' => 'string', 'description' => 'Nøkkel/tilgang'],
      'note' => $s, 'missing' => ['type' => 'array', 'items' => $s],
    ]]];
}
function agent_extract(array $m): array {
  $fake = cfg('AGENT_FAKE'); if ($fake) { $f = json_decode((string)$fake, true); return ['data' => $f, 'in' => 0, 'out' => 0]; }
  $user = "Fra: {$m['from_name']} <{$m['from_addr']}>\nEmne: {$m['subject']}\nDato: {$m['date']}\n" . ($m['files'] ? 'Vedlegg: ' . implode(', ', $m['files']) . "\n" : '') . "\n" . $m['text'];
  $req = ['model' => (string)cfg('AGENT_MODEL', 'claude-sonnet-5-5'), 'max_tokens' => 1024, 'system' => agent_prompt(),
    'tools' => [agent_tool()], 'tool_choice' => ['type' => 'tool', 'name' => 'registrer_bestilling'],
    'messages' => [['role' => 'user', 'content' => $user]]];
  $c = curl_init('https://api.anthropic.com/v1/messages');
  curl_setopt_array($c, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 45, CURLOPT_POSTFIELDS => json_encode($req, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER => ['content-type: application/json', 'anthropic-version: 2023-06-01', 'x-api-key: ' . cfg('ANTHROPIC_API_KEY')]]);
  $res = curl_exec($c); $code = (int)curl_getinfo($c, CURLINFO_HTTP_CODE); $err = curl_error($c); curl_close($c);
  $j = json_decode((string)$res, true);
  if ($code !== 200 || !is_array($j)) throw new Exception('Claude API: HTTP ' . $code . ' ' . ($err ?: substr((string)($j['error']['message'] ?? $res), 0, 200)));
  foreach ($j['content'] ?? [] as $b) if (($b['type'] ?? '') === 'tool_use') return ['data' => $b['input'], 'in' => (int)($j['usage']['input_tokens'] ?? 0), 'out' => (int)($j['usage']['output_tokens'] ?? 0)];
  throw new Exception('Claude API: mangler svar');
}

// ---------------- prosjekt i portalen ----------------
function add_weekdays(int $n): string { $t = time(); while ($n > 0) { $t += 86400; $w = (int)date('N', $t); if ($w < 6) $n--; } return date('Y-m-d', $t); }
function agent_create_job(array $d, array $m, int $mailId): string {
  $p = db(); $covers = ['bolig-stue.jpg', 'bolig-kjokken.jpg', 'bolig-tomannsbolig.jpg', 'bolig-loft.jpg'];
  for ($try = 0; $try < 5; $try++) {
    $s = $p->prepare('SELECT data, version FROM app_state WHERE tenant_id=? AND scope=?'); $s->execute([SV_TENANT, 'studio']); $row = $s->fetch();
    $state = $row ? (json_decode((string)$row['data'], true) ?: []) : [];
    $jobs = $state['newJobs'] ?? []; $n = count($jobs);
    foreach ($jobs as $j) if (($j['agent']['mail'] ?? null) === $mailId) return (string)$j['id']; // allerede laget
    $ids = array_column($jobs, 'id'); $k = $n; do { $id = 'B-' . (2620 + $k++); } while (in_array($id, $ids, true));
    $svc = array_values(array_intersect((array)($d['services'] ?? []), array_keys(AGENT_SERVICES)));
    $qty = []; foreach ((array)($d['qty'] ?? []) as $q => $v) if (in_array($q, ['vm', 'kv'], true) && (int)$v > 0) $qty[$q] = (int)$v;
    $missing = array_values(array_filter((array)($d['missing'] ?? [])));
    if (empty($d['addr'])) $missing[] = 'adresse';
    if (!$svc) $missing[] = 'pakke';
    $check = ($d['confidence'] ?? 'lav') !== 'høy' || $missing;
    $job = ['id' => $id, 'addr' => trim((string)($d['addr'] ?? '')) ?: 'Uten adresse', 'town' => trim((string)($d['town'] ?? '')), 'office' => '', 'broker' => trim((string)($d['broker'] ?? $m['from_name'])),
      'nr' => trim((string)($d['nr'] ?? '')) ?: '–', 'stage' => 'Opprettet', 'date' => add_weekdays(3), 'time' => '10:00', 'services' => $svc, 'qty' => (object)$qty,
      'seller' => trim((string)($d['seller'] ?? '')) ?: 'Kunde', 'email' => trim((string)($d['seller_email'] ?? '')), 'phone' => trim((string)($d['seller_phone'] ?? '')) ?: '–',
      'access' => trim((string)($d['access'] ?? '')), 'type' => trim((string)($d['type'] ?? '')), 'cover' => '../assets/photos/' . $covers[$n % 4], 'by' => 'ak',
      'wish' => trim((string)($d['note'] ?? '')), 'created' => date('Y-m-d'), 'source' => 'e-post',
      'agent' => ['mail' => $mailId, 'status' => $check ? 'sjekk' : 'ok', 'missing' => array_values(array_unique($missing)), 'from' => $m['from_name'] . ' <' . $m['from_addr'] . '>', 'subject' => $m['subject'], 'office' => trim((string)($d['office'] ?? '')), 'at' => now()]];
    $state['newJobs'] = array_merge($jobs, [$job]);
    $json = json_encode($state, JSON_UNESCAPED_UNICODE);
    if ($row) { $u = $p->prepare('UPDATE app_state SET data=?, version=version+1, updated_at=?, updated_by=? WHERE tenant_id=? AND scope=? AND version=?'); $u->execute([$json, now(), 'agent', SV_TENANT, 'studio', (int)$row['version']]); if ($u->rowCount()) return $id; }
    else { try { $p->prepare('INSERT INTO app_state (tenant_id, scope, data, version, updated_at, updated_by) VALUES (?,?,?,?,?,?)')->execute([SV_TENANT, 'studio', $json, 1, now(), 'agent']); return $id; } catch (Throwable $e) {} }
    usleep(200000); // noen lagret samtidig: prøv igjen med fersk versjon
  }
  throw new Exception('Kunne ikke lagre prosjektet (for mange samtidige endringer)');
}

// Leser én lagret e-post med Claude og lager prosjekt. Brukes for nye e-poster og ved nytt forsøk.
function agent_process(array $row, int &$used, ?array $m = null): string {
  $p = db(); $mid = (int)$row['id']; $p->prepare('UPDATE agent_mail SET tries=tries+1 WHERE id=?')->execute([$mid]);
  $m = $m ?: ['from_name' => $row['from_name'], 'from_addr' => $row['from_addr'], 'subject' => $row['subject'], 'date' => $row['received'], 'text' => (string)$row['body'], 'files' => []];
  try {
    $r = agent_extract($m); $used++; $d = (array)$r['data'];
    $status = 'ikke bestilling'; $job = null;
    if (!empty($d['is_order'])) { $job = agent_create_job($d, $m, $mid); $status = (($d['confidence'] ?? '') === 'høy' && !empty($d['addr']) && !empty($d['services'])) ? 'opprettet' : 'sjekk'; }
    $p->prepare('UPDATE agent_mail SET status=?, job_id=?, data=?, info=?, tokens_in=?, tokens_out=? WHERE id=?')->execute([$status, $job, json_encode($d, JSON_UNESCAPED_UNICODE), '', $r['in'], $r['out'], $mid]);
    return $status . ($job ? " $job" : '') . ': ' . mb_substr((string)$m['subject'], 0, 60);
  } catch (Throwable $e) { $p->prepare('UPDATE agent_mail SET status=?, info=? WHERE id=?')->execute(['feil', substr($e->getMessage(), 0, 480), $mid]); return 'feil: ' . $e->getMessage(); }
}

// ---------------- én kjøring ----------------
function agent_run(int $budget = 20, int $max = 8): array {
  if (!agent_on()) return ['ok' => true, 'info' => 'agent av (mangler ANTHROPIC_API_KEY)'];
  agent_tables(); $t0 = time(); $p = db(); $log = [];
  $user = (string)cfg('IMAP_USER', cfg('MAIL_USER', '')); $pass = (string)cfg('IMAP_PASSWORD', cfg('MAIL_PASSWORD', ''));
  if (!$user || !$pass) return ['ok' => false, 'info' => 'mangler IMAP-bruker/passord'];
  $today = gmdate('Y-m-d'); $used = (int)$p->query("SELECT COUNT(*) FROM agent_mail WHERE tokens_in > 0 AND created_at >= '$today'")->fetchColumn();
  $cap = (int)cfg('AGENT_MAX_PER_DAY', 100);
  $im = new Imap((string)cfg('IMAP_HOST', 'imap.one.com'), (int)cfg('IMAP_PORT', 993), cfg('IMAP_SSL', '1') !== '0', $user, $pass);
  try {
    // først: prøv på nytt e-post som feilet eller ventet på dagsgrensen (maks 2 per runde)
    $rs = $p->prepare("SELECT * FROM agent_mail WHERE tenant_id=? AND status IN ('feil','venter') AND tries < 3 AND created_at >= ? ORDER BY id LIMIT 2");
    $rs->execute([SV_TENANT, gmdate('Y-m-d\\TH:i:s\\Z', time() - 2 * 86400)]);
    foreach ($rs->fetchAll() as $row) { if ($used >= $cap) break; agent_process($row, $used); }
    $uv = $im->select('INBOX'); $last = (int)(get_meta('imap_uid') ?? 0);
    if ((string)$uv !== (string)get_meta('imap_uidvalidity')) { $last = 0; set_meta('imap_uidvalidity', (string)$uv); }
    $uids = $last ? array_values(array_filter($im->search('UID ' . ($last + 1) . ':*'), fn($u) => $u > $last)) : $im->search('SINCE ' . date('d-M-Y', time() - 2 * 86400));
    sort($uids);
    foreach (array_slice($uids, 0, $max) as $uid) {
      if (time() - $t0 > $budget) break;
      $raw = $im->fetch($uid); set_meta('imap_uid', (string)$uid);
      if ($raw === null) continue;
      $m = mime_parse($raw);
      $ex = $p->prepare('SELECT id FROM agent_mail WHERE tenant_id=? AND message_id=?'); $ex->execute([SV_TENANT, $m['message_id']]); if ($ex->fetchColumn()) continue;
      $cand = agent_candidate($m);
      $ins = $p->prepare('INSERT INTO agent_mail (tenant_id, uid, message_id, from_name, from_addr, subject, received, body, status, created_at, tokens_in, tokens_out) VALUES (?,?,?,?,?,?,?,?,?,?,0,0)');
      $ins->execute([SV_TENANT, $uid, $m['message_id'], $m['from_name'], $m['from_addr'], mb_substr($m['subject'], 0, 250), $m['date'], $cand ? $m['text'] : '', $cand ? 'leser' : 'ignorert', now()]);
      $mid = (int)$p->lastInsertId();
      if (!$cand) continue;
      if ($used >= $cap) { $p->prepare('UPDATE agent_mail SET status=?, info=? WHERE id=?')->execute(['venter', 'dagsgrense nådd', $mid]); continue; }
      $row = $p->query('SELECT * FROM agent_mail WHERE id=' . $mid)->fetch();
      $log[] = agent_process($row, $used, $m);
    }
  } finally { $im->close(); }
  return ['ok' => true, 'info' => $log ? implode('; ', $log) : 'ingen nye bestillinger'];
}
