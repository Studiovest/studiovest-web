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

// Meglerkontor: id, navn, hvem fakturaen går til som standard, og kommuner de dekker (for adressesøk).
const SV_SUNN = ['Stord', 'Fitjar', 'Bømlo', 'Kvinnherad', 'Tysnes', 'Sveio'];
const AGENT_OFFICES = [
  'emn' => ['Eiendomsmegler Norge', 'kunde', SV_SUNN],
  'em1' => ['Eiendomsmegler 1', 'kontor', SV_SUNN],
  'nvhar' => ['Nordvik Hardanger', 'kunde', ['Ullensvang', 'Kvam', 'Eidfjord', 'Ulvik', 'Kvinnherad']],
  'nvsun' => ['Nordvik Sunnhordland', 'kontor', SV_SUNN],
  'nvhau' => ['Nordvik Haugesund', 'kunde', ['Haugesund', 'Karmøy', 'Tysvær', 'Sveio', 'Bokn', 'Vindafjord', 'Etne']],
  'aksun' => ['Aktiv Sunnhordland', 'kontor', SV_SUNN],
];
function office_areas(string $id): array { return AGENT_OFFICES[$id][2] ?? array_values(array_unique(array_merge(SV_SUNN, ['Haugesund', 'Ullensvang', 'Kvam', 'Etne', 'Vindafjord']))); }

function agent_on(): bool { return claude_key('EMAIL') !== '' || cfg('AGENT_FAKE'); }

function agent_tables(): void {
  $p = db(); $ai = is_sqlite($p) ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
  $tx = is_sqlite($p) ? 'TEXT' : 'LONGTEXT'; $eng = is_sqlite($p) ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
  $p->exec("CREATE TABLE IF NOT EXISTS agent_mail (id $ai, tenant_id VARCHAR(40) NOT NULL, uid BIGINT, message_id VARCHAR(255), from_name VARCHAR(190), from_addr VARCHAR(190), subject VARCHAR(255), received VARCHAR(25), body $tx, status VARCHAR(20), job_id VARCHAR(30), data $tx, info VARCHAR(500), tokens_in INT, tokens_out INT, tries INT NOT NULL DEFAULT 0, created_at VARCHAR(25))$eng");
  try { $p->exec('ALTER TABLE agent_mail ADD COLUMN moved INT NOT NULL DEFAULT 0'); } catch (Throwable $e) {} // finnes fra før
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
  function caps(): string { [$ls] = $this->cmd('CAPABILITY'); return strtoupper(implode(' ', $ls)); }
  // Finner mappen (uansett prefiks, f.eks. «INBOX.Registrerte bestillinger»), eller lager den. Returnerer det kodede mappenavnet.
  function folder(string $name): string {
    $enc = function_exists('mb_convert_encoding') ? mb_convert_encoding($name, 'UTF7-IMAP', 'UTF-8') : $name;
    [$ls] = $this->cmd('LIST "" "*"');
    foreach ($ls as $l) if (preg_match('/^\* LIST \([^)]*\) (?:"(.)"|NIL) (?:"((?:[^"\\\\]|\\\\.)*)"|(\S+))/i', trim($l), $m)) {
      $full = stripcslashes($m[2] !== '' ? $m[2] : ($m[3] ?? '')); $d = $m[1] ?? '';
      $last = $d !== '' ? substr($full, (int)strrpos($full, $d) + ($d !== '' && strrpos($full, $d) !== false ? 1 : 0)) : $full;
      if (strcasecmp($last, $enc) === 0 || strcasecmp($full, $enc) === 0) return $full;
    }
    $prefix = '';
    try { [$ns] = $this->cmd('NAMESPACE'); foreach ($ns as $l) if (preg_match('/^\* NAMESPACE \(\("([^"]*)"/i', $l, $m)) $prefix = $m[1]; } catch (Throwable $e) {}
    $full = $prefix . $enc; $this->cmd('CREATE ' . $this->q($full)); try { $this->cmd('SUBSCRIBE ' . $this->q($full)); } catch (Throwable $e) {}
    return $full;
  }
  // Flytter e-post (UID-er i valgt mappe) til mappen. Bruker MOVE om serveren kan, ellers COPY + slett.
  function move(array $uids, string $folder): void {
    if (!$uids) return; $set = implode(',', array_map('intval', $uids)); $caps = $this->caps();
    if (strpos($caps, ' MOVE') !== false) { $this->cmd("UID MOVE $set " . $this->q($folder)); return; }
    $this->cmd("UID COPY $set " . $this->q($folder)); $this->cmd("UID STORE $set +FLAGS.SILENT (\\Deleted)");
    $this->cmd(strpos($caps, 'UIDPLUS') !== false ? "UID EXPUNGE $set" : 'EXPUNGE');
  }
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
    "Meglerkontor (office_id) – velg ut fra avsenderens signatur, e-postdomene eller tekst. Tom hvis ukjent:\n" . implode('', array_map(fn($k, $o) => "- $k: {$o[0]} (faktura til " . ($o[1] === 'kunde' ? 'kunden direkte' : 'meglerkontoret') . " som standard)\n", array_keys(AGENT_OFFICES), AGENT_OFFICES)) .
    "invoice_to: sett bare hvis e-posten sier noe om hvem fakturaen skal til (f.eks. «faktura direkte til selger/kunde» → kunde, «fakturer oss/kontoret» → kontor). Ellers ukjent.\n" .
    "Endring av tidligere bestilling (f.eks. «fakturaen for Haugen 23 skal likevel til kunden», ny telefon, ekstra kveldsbilder): sett is_update=true og update_ref til adressen eller oppdragsnummeret den gjelder, og fyll bare inn feltene som endres.\n" .
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
      'office_id' => ['type' => 'string', 'enum' => array_merge([''], array_keys(AGENT_OFFICES))],
      'invoice_to' => ['type' => 'string', 'enum' => ['kontor', 'kunde', 'ukjent']],
      'is_update' => ['type' => 'boolean', 'description' => 'Endrer en bestilling som allerede er sendt'],
      'update_ref' => ['type' => 'string', 'description' => 'Adresse eller oppdragsnummer for bestillingen som endres'],
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
    CURLOPT_HTTPHEADER => ['content-type: application/json', 'anthropic-version: 2023-06-01', 'x-api-key: ' . claude_key('EMAIL')]]);
  $res = curl_exec($c); $code = (int)curl_getinfo($c, CURLINFO_HTTP_CODE); $err = curl_error($c); curl_close($c);
  $j = json_decode((string)$res, true);
  if ($code !== 200 || !is_array($j)) throw new Exception('Claude API: HTTP ' . $code . ' ' . ($err ?: substr((string)($j['error']['message'] ?? $res), 0, 200)));
  foreach ($j['content'] ?? [] as $b) if (($b['type'] ?? '') === 'tool_use') return ['data' => $b['input'], 'in' => (int)($j['usage']['input_tokens'] ?? 0), 'out' => (int)($j['usage']['output_tokens'] ?? 0)];
  throw new Exception('Claude API: mangler svar');
}

// ---------------- prosjekt i portalen ----------------
function add_weekdays(int $n): string { $t = time(); while ($n > 0) { $t += 86400; $w = (int)date('N', $t); if ($w < 6) $n--; } return date('Y-m-d', $t); }
function norm_addr(string $a): string { return preg_replace('/[^a-z0-9æøå]/u', '', mb_strtolower($a)); }
// Finn et eksisterende prosjekt ut fra adresse eller oppdragsnummer (for endringer på e-post).
function find_job(array $jobs, string $ref): ?int {
  $r = norm_addr($ref); if ($r === '') return null;
  foreach (array_reverse($jobs, true) as $i => $j) { $a = norm_addr((string)($j['addr'] ?? '')); $n = norm_addr((string)($j['nr'] ?? ''));
    if (($a !== '' && (strpos($r, $a) === 0 || strpos($a, $r) === 0)) || ($n !== '' && strlen($n) > 3 && $n === $r)) return $i; }
  return null;
}
// Endring på e-post: oppdaterer feltene som er oppgitt. Returnerer prosjekt-id, eller null hvis prosjektet ikke finnes.
function agent_update_job(array $d, array $m, int $mailId): ?string {
  return state_mutate(function (array &$st) use ($d, $m, $mailId) {
    $jobs = $st['newJobs'] ?? []; $i = find_job($jobs, (string)($d['update_ref'] ?? $d['addr'] ?? $d['nr'] ?? '')); if ($i === null) return null;
    $j = &$st['newJobs'][$i]; $ch = [];
    if (in_array($d['invoice_to'] ?? '', ['kontor', 'kunde'], true)) { $j['billTo'] = $d['invoice_to']; $st['billTo'][$j['id']] = $d['invoice_to']; $ch[] = 'faktura til ' . $d['invoice_to']; }
    foreach (['seller' => 'seller', 'seller_email' => 'email', 'seller_phone' => 'phone', 'access' => 'access', 'type' => 'type', 'nr' => 'nr'] as $from => $to)
      if (!empty($d[$from])) { $j[$to] = trim((string)$d[$from]); $ch[] = $to; }
    $svc = array_values(array_intersect((array)($d['services'] ?? []), array_keys(AGENT_SERVICES)));
    if ($svc) { $j['services'] = array_values(array_unique(array_merge((array)($j['services'] ?? []), $svc))); $ch[] = 'tjenester'; }
    foreach ((array)($d['qty'] ?? []) as $q => $v) if (in_array($q, ['vm', 'kv'], true) && (int)$v > 0) { $j['qty'] = (array)($j['qty'] ?? []); $j['qty'][$q] = (int)$v; }
    if (!empty($d['note'])) { $j['wish'] = trim(((string)($j['wish'] ?? '')) . ' ' . trim((string)$d['note'])); $ch[] = 'notat'; }
    $j['agentLog'][] = ['mail' => $mailId, 'at' => now(), 'from' => $m['from_name'], 'subject' => $m['subject'], 'changes' => $ch];
    return (string)$j['id'];
  });
}
function agent_create_job(array $d, array $m, int $mailId): string {
  $covers = ['bolig-stue.jpg', 'bolig-kjokken.jpg', 'bolig-tomannsbolig.jpg', 'bolig-loft.jpg'];
  return state_mutate(function (array &$st) use ($d, $m, $mailId, $covers) {
    $jobs = $st['newJobs'] ?? []; $n = count($jobs);
    foreach ($jobs as $j) if (($j['agent']['mail'] ?? null) === $mailId) return (string)$j['id']; // allerede laget
    $ids = array_column($jobs, 'id'); $k = $n; do { $id = 'B-' . (2620 + $k++); } while (in_array($id, $ids, true));
    $svc = array_values(array_intersect((array)($d['services'] ?? []), array_keys(AGENT_SERVICES)));
    $qty = []; foreach ((array)($d['qty'] ?? []) as $q => $v) if (in_array($q, ['vm', 'kv'], true) && (int)$v > 0) $qty[$q] = (int)$v;
    $missing = array_values(array_filter((array)($d['missing'] ?? [])));
    if (empty($d['addr'])) $missing[] = 'adresse';
    if (!$svc) $missing[] = 'pakke';
    $off = isset(AGENT_OFFICES[$d['office_id'] ?? '']) ? $d['office_id'] : '';
    if (!$off) $missing[] = 'meglerkontor';
    $bill = in_array($d['invoice_to'] ?? '', ['kontor', 'kunde'], true) ? $d['invoice_to'] : ($off ? AGENT_OFFICES[$off][1] : 'kontor');
    $check = ($d['confidence'] ?? 'lav') !== 'høy' || $missing;
    $st['newJobs'][] = ['id' => $id, 'addr' => trim((string)($d['addr'] ?? '')) ?: 'Uten adresse', 'town' => trim((string)($d['town'] ?? '')), 'office' => $off, 'billTo' => $bill, 'broker' => trim((string)($d['broker'] ?? $m['from_name'])),
      'nr' => trim((string)($d['nr'] ?? '')) ?: '–', 'stage' => 'Opprettet', 'date' => add_weekdays(3), 'time' => '10:00', 'services' => $svc, 'qty' => (object)$qty,
      'seller' => trim((string)($d['seller'] ?? '')) ?: 'Kunde', 'email' => trim((string)($d['seller_email'] ?? '')), 'phone' => trim((string)($d['seller_phone'] ?? '')) ?: '–',
      'access' => trim((string)($d['access'] ?? '')), 'type' => trim((string)($d['type'] ?? '')), 'cover' => '../assets/photos/' . $covers[$n % 4], 'by' => 'ak',
      'wish' => trim((string)($d['note'] ?? '')), 'created' => date('Y-m-d'), 'source' => 'e-post',
      'agent' => ['mail' => $mailId, 'status' => $check ? 'sjekk' : 'ok', 'missing' => array_values(array_unique($missing)), 'from' => $m['from_name'] . ' <' . $m['from_addr'] . '>', 'subject' => $m['subject'], 'office' => trim((string)($d['office'] ?? '')), 'billNote' => in_array($d['invoice_to'] ?? '', ['kontor', 'kunde'], true) ? 'Oppgitt i e-posten' : '', 'at' => now()]];
    return $id;
  });
}

// Leser én lagret e-post med Claude og lager prosjekt. Brukes for nye e-poster og ved nytt forsøk.
function agent_process(array $row, int &$used, ?array $m = null): string {
  $p = db(); $mid = (int)$row['id']; $p->prepare('UPDATE agent_mail SET tries=tries+1 WHERE id=?')->execute([$mid]);
  $m = $m ?: ['from_name' => $row['from_name'], 'from_addr' => $row['from_addr'], 'subject' => $row['subject'], 'date' => $row['received'], 'text' => (string)$row['body'], 'files' => []];
  try {
    $r = agent_extract($m); $used++; $d = (array)$r['data'];
    $status = 'ikke bestilling'; $job = null;
    if (!empty($d['is_update'])) { $job = agent_update_job($d, $m, $mid); if ($job) $status = 'oppdatert'; }
    if (!$job && (!empty($d['is_order']) || !empty($d['is_update']))) { $job = agent_create_job($d, $m, $mid); $status = (($d['confidence'] ?? '') === 'høy' && !empty($d['addr']) && !empty($d['services']) && isset(AGENT_OFFICES[$d['office_id'] ?? ''])) ? 'opprettet' : 'sjekk'; }
    $p->prepare('UPDATE agent_mail SET status=?, job_id=?, data=?, info=?, tokens_in=?, tokens_out=? WHERE id=?')->execute([$status, $job, json_encode($d, JSON_UNESCAPED_UNICODE), '', $r['in'], $r['out'], $mid]);
    return $status . ($job ? " $job" : '') . ': ' . mb_substr((string)$m['subject'], 0, 60);
  } catch (Throwable $e) { $p->prepare('UPDATE agent_mail SET status=?, info=? WHERE id=?')->execute(['feil', substr($e->getMessage(), 0, 480), $mid]); return 'feil: ' . $e->getMessage(); }
}

// ---------------- én kjøring ----------------
function agent_run(int $budget = 20, int $max = 8): array {
  if (!agent_on()) return ['ok' => true, 'info' => 'agent av (mangler CLAUDE_KEY_EMAIL)'];
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
    // registrerte bestillinger flyttes til egen mappe i innboksen (AGENT_FOLDER, tom = ikke flytt)
    $box = trim((string)cfg('AGENT_FOLDER', 'Registrerte bestillinger'));
    if ($box !== '') {
      $mv = $p->prepare("SELECT id, uid FROM agent_mail WHERE tenant_id=? AND status IN ('opprettet','oppdatert','sjekk') AND moved=0 AND uid IS NOT NULL AND uid > 0 AND created_at >= ?");
      $mv->execute([SV_TENANT, gmdate('Y-m-d\\TH:i:s\\Z', time() - 14 * 86400)]); $rows = $mv->fetchAll();
      if ($rows) {
        try { $im->move(array_column($rows, 'uid'), $im->folder($box)); $p->exec('UPDATE agent_mail SET moved=1 WHERE id IN (' . implode(',', array_map('intval', array_column($rows, 'id'))) . ')'); $log[] = count($rows) . ' flyttet til «' . $box . '»'; }
        catch (Throwable $e) { $log[] = 'flytting feilet: ' . substr($e->getMessage(), 0, 120); }
      }
    }
  } finally { $im->close(); }
  return ['ok' => true, 'info' => $log ? implode('; ', $log) : 'ingen nye bestillinger'];
}
