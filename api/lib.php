<?php
// Studiovest API — felles kode. Kjører på one.com (PHP 8 + MariaDB). Lokalt kan SQLite brukes for testing.
// config.php lages automatisk ved publisering (fra GitHub-hemmeligheten STUDIOVEST_CONFIG) og ligger aldri i git.
declare(strict_types=1);

const SV_TENANT = 'studiovest'; // alle rader merkes med kunde (tenant) fra dag én

function cfg(string $k, $def = null) {
  static $c = null;
  if ($c === null) { $f = __DIR__ . '/config.php'; $c = is_file($f) ? (require $f) : []; if (!is_array($c)) $c = []; }
  $v = $c[$k] ?? getenv('SV_' . $k);
  return ($v === false || $v === null || $v === '') ? $def : $v;
}

function json_out($data, int $code = 200): void {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function fail(string $msg, int $code = 400): void { json_out(['ok' => false, 'error' => $msg], $code); }
function body(): array { $b = json_decode(file_get_contents('php://input') ?: '[]', true); return is_array($b) ? $b : []; }
function base_url(): string { $u = cfg('BASE_URL'); if ($u) return rtrim($u, '/'); $h = $_SERVER['HTTP_HOST'] ?? 'studiovest.no'; return 'https://' . $h; }

// ---------- database ----------
function db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  if (cfg('DB_DRIVER') === 'sqlite') {
    $pdo = new PDO('sqlite:' . cfg('DB_FILE', __DIR__ . '/data/dev.sqlite'));
  } else {
    $dsn = 'mysql:host=' . cfg('DB_HOST', 'localhost') . ';dbname=' . cfg('DB_NAME', '') . ';charset=utf8mb4';
    $pdo = new PDO($dsn, (string)cfg('DB_USER', ''), (string)cfg('DB_PASSWORD', ''), [PDO::ATTR_TIMEOUT => 8]);
  }
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
  migrate($pdo);
  return $pdo;
}
function is_sqlite(PDO $p): bool { return $p->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'; }

// Oppretter tabellene automatisk (idempotent). Ingen manuell installasjon.
function migrate(PDO $p): void {
  $ai = is_sqlite($p) ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
  $tx = is_sqlite($p) ? 'TEXT' : 'LONGTEXT';
  $eng = is_sqlite($p) ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
  $ver = 3;
  try { $cur = (int)$p->query("SELECT v FROM sv_meta WHERE k='schema'")->fetchColumn(); } catch (Throwable $e) { $cur = 0; }
  if ($cur >= $ver) return;
  $sql = [
    "CREATE TABLE IF NOT EXISTS sv_meta (k VARCHAR(60) PRIMARY KEY, v $tx)$eng",
    "CREATE TABLE IF NOT EXISTS tenants (id VARCHAR(40) PRIMARY KEY, name VARCHAR(120), domain VARCHAR(190), created_at VARCHAR(25))$eng",
    "CREATE TABLE IF NOT EXISTS users (id $ai, tenant_id VARCHAR(40) NOT NULL, email VARCHAR(190) NOT NULL, name VARCHAR(120), role VARCHAR(30) NOT NULL DEFAULT 'studio', created_at VARCHAR(25), last_login VARCHAR(25))$eng",
    "CREATE TABLE IF NOT EXISTS login_tokens (hash CHAR(64) PRIMARY KEY, user_id INT NOT NULL, expires INT NOT NULL, used INT NOT NULL DEFAULT 0)$eng",
    "CREATE TABLE IF NOT EXISTS app_state (tenant_id VARCHAR(40) NOT NULL, scope VARCHAR(40) NOT NULL, data $tx, version INT NOT NULL DEFAULT 0, updated_at VARCHAR(25), updated_by VARCHAR(190), PRIMARY KEY (tenant_id, scope))$eng",
    "CREATE TABLE IF NOT EXISTS files (id $ai, tenant_id VARCHAR(40) NOT NULL, s3key VARCHAR(500) NOT NULL, name VARCHAR(255), type VARCHAR(100), size BIGINT, kind VARCHAR(20), ref VARCHAR(60), created_at VARCHAR(25))$eng",
    "CREATE TABLE IF NOT EXISTS mail_log (id $ai, tenant_id VARCHAR(40), to_addr VARCHAR(190), subject VARCHAR(255), ok INT, info VARCHAR(255), sent_at VARCHAR(25))$eng",
    "CREATE TABLE IF NOT EXISTS cron_runs (id $ai, task VARCHAR(60), ok INT, info VARCHAR(500), at VARCHAR(25))$eng",
  ];
  foreach ($sql as $q) $p->exec($q);
  try { $p->exec('CREATE UNIQUE INDEX ux_users_email ON users (tenant_id, email)'); } catch (Throwable $e) {}
  set_meta('schema', (string)$ver, $p);
  // første kunde og administrator
  if (!$p->query("SELECT 1 FROM tenants WHERE id='" . SV_TENANT . "'")->fetchColumn()) {
    $s = $p->prepare('INSERT INTO tenants (id, name, domain, created_at) VALUES (?,?,?,?)');
    $s->execute([SV_TENANT, 'Studiovest', 'studiovest.no', now()]);
  }
  seed_admins($p);
}
function seed_admins(PDO $p): void {
  foreach (array_filter(array_map('trim', explode(',', (string)cfg('ADMIN_EMAIL', '')))) as $e) {
    $e = strtolower($e);
    $s = $p->prepare('SELECT id FROM users WHERE tenant_id=? AND email=?'); $s->execute([SV_TENANT, $e]);
    if (!$s->fetchColumn()) $p->prepare('INSERT INTO users (tenant_id, email, name, role, created_at) VALUES (?,?,?,?,?)')->execute([SV_TENANT, $e, '', 'studio', now()]);
  }
}
function get_meta(string $k, ?PDO $p = null) { $p = $p ?: db(); $s = $p->prepare('SELECT v FROM sv_meta WHERE k=?'); $s->execute([$k]); $v = $s->fetchColumn(); return $v === false ? null : $v; }
function set_meta(string $k, string $v, ?PDO $p = null): void {
  $p = $p ?: db(); $s = $p->prepare('UPDATE sv_meta SET v=? WHERE k=?'); $s->execute([$v, $k]);
  if (!$s->rowCount()) { try { $p->prepare('INSERT INTO sv_meta (k, v) VALUES (?,?)')->execute([$k, $v]); } catch (Throwable $e) {} }
}
function now(): string { return gmdate('Y-m-d\TH:i:s\Z'); }

// Leser portalens data (app_state), lar $fn endre den, og lagrer med versjonssjekk. Prøver på nytt hvis noen lagret samtidig.
// $fn(array &$state): mixed. Returnerer det $fn returnerer. Returner null fra $fn for å avbryte uten å lagre.
function state_mutate(callable $fn, string $scope = 'studio', string $by = 'agent') {
  $p = db();
  for ($try = 0; $try < 6; $try++) {
    $s = $p->prepare('SELECT data, version FROM app_state WHERE tenant_id=? AND scope=?'); $s->execute([SV_TENANT, $scope]); $row = $s->fetch();
    $state = $row ? (json_decode((string)$row['data'], true) ?: []) : [];
    $res = $fn($state); if ($res === null) return null;
    $json = json_encode($state, JSON_UNESCAPED_UNICODE);
    if ($row) { $u = $p->prepare('UPDATE app_state SET data=?, version=version+1, updated_at=?, updated_by=? WHERE tenant_id=? AND scope=? AND version=?'); $u->execute([$json, now(), $by, SV_TENANT, $scope, (int)$row['version']]); if ($u->rowCount()) return $res; }
    else { try { $p->prepare('INSERT INTO app_state (tenant_id, scope, data, version, updated_at, updated_by) VALUES (?,?,?,?,?,?)')->execute([SV_TENANT, $scope, $json, 1, now(), $by]); return $res; } catch (Throwable $e) {} }
    usleep(200000);
  }
  throw new Exception('Kunne ikke lagre (for mange samtidige endringer)');
}

// ---------- innlogging ----------
function start_session(): void {
  if (session_status() === PHP_SESSION_ACTIVE) return;
  session_name('svsess');
  session_set_cookie_params(['lifetime' => 60 * 60 * 24 * 30, 'path' => '/', 'secure' => !empty($_SERVER['HTTPS']) || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https', 'httponly' => true, 'samesite' => 'Lax']);
  ini_set('session.gc_maxlifetime', (string)(60 * 60 * 24 * 30));
  session_start();
}
function current_user(): ?array {
  start_session();
  if (empty($_SESSION['uid'])) return null;
  $s = db()->prepare('SELECT id, tenant_id, email, name, role FROM users WHERE id=?'); $s->execute([$_SESSION['uid']]);
  $u = $s->fetch(); return $u ?: null;
}
function require_user(): array { $u = current_user(); if (!$u) fail('Ikke innlogget', 401); return $u; }
function app_secret(): string { return (string)cfg('APP_SECRET', 'dev-secret-change-me'); }

// ---------- e-post (SMTP over SSL, f.eks. send.one.com:465) ----------
function send_mail(string $to, string $subject, string $text, ?string $html = null): bool {
  $host = (string)cfg('MAIL_HOST', 'send.one.com'); $port = (int)cfg('MAIL_PORT', 465);
  $user = (string)cfg('MAIL_USER', ''); $pass = (string)cfg('MAIL_PASSWORD', ''); $from = (string)cfg('MAIL_FROM', $user);
  $ok = false; $info = '';
  if (cfg('MAIL_DRIVER') === 'log' || !$user) {
    @mkdir(__DIR__ . '/data', 0700, true);
    file_put_contents(__DIR__ . '/data/mail.log', now() . " TO:$to SUBJ:$subject\n$text\n\n", FILE_APPEND);
    $ok = true; $info = 'logget (ingen SMTP satt opp)';
  } else {
    try {
      $fp = @stream_socket_client("ssl://$host:$port", $errno, $errstr, 15);
      if (!$fp) throw new Exception("tilkobling: $errstr");
      $rd = function () use ($fp) { $r = ''; while (($l = fgets($fp, 515)) !== false) { $r .= $l; if (isset($l[3]) && $l[3] === ' ') break; } return $r; };
      $cmd = function (string $c, string $want) use ($fp, $rd) { fwrite($fp, $c . "\r\n"); $r = $rd(); if (strpos($r, $want) !== 0) throw new Exception(trim($r)); return $r; };
      $r = $rd(); if (strpos($r, '220') !== 0) throw new Exception(trim($r));
      $cmd('EHLO studiovest.no', '250');
      $cmd('AUTH LOGIN', '334'); $cmd(base64_encode($user), '334'); $cmd(base64_encode($pass), '235');
      $cmd('MAIL FROM:<' . $from . '>', '250'); $cmd('RCPT TO:<' . $to . '>', '25'); $cmd('DATA', '354');
      $b = 'b' . bin2hex(random_bytes(8));
      $hdr = 'From: Studiovest <' . $from . ">\r\nTo: <$to>\r\nSubject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\nDate: " . date('r') . "\r\nMessage-ID: <" . bin2hex(random_bytes(8)) . "@studiovest.no>\r\nMIME-Version: 1.0\r\n";
      if ($html) $msg = $hdr . "Content-Type: multipart/alternative; boundary=\"$b\"\r\n\r\n--$b\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text)) . "--$b\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html)) . "--$b--\r\n";
      else $msg = $hdr . "Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text));
      $cmd(str_replace("\n.", "\n..", $msg) . "\r\n.", '250'); $cmd('QUIT', '221'); fclose($fp);
      $ok = true;
    } catch (Throwable $e) { $info = substr($e->getMessage(), 0, 250); }
  }
  try { db()->prepare('INSERT INTO mail_log (tenant_id, to_addr, subject, ok, info, sent_at) VALUES (?,?,?,?,?,?)')->execute([SV_TENANT, $to, $subject, $ok ? 1 : 0, $info, now()]); } catch (Throwable $e) {}
  return $ok;
}

// ---------- Wasabi (S3-kompatibel lagring) ----------
function s3_on(): bool { return (bool)(cfg('WASABI_KEY') && cfg('WASABI_SECRET') && cfg('WASABI_BUCKET')); }
function s3_host(): string { $r = (string)cfg('WASABI_REGION', 'eu-central-1'); return 's3.' . $r . '.wasabisys.com'; }
function s3_enc(string $key): string { return implode('/', array_map('rawurlencode', explode('/', $key))); }
// Forhåndssignert lenke (AWS Signature V4, query): nettleseren laster opp/ned direkte, uten å gå via one.com.
function s3_presign(string $method, string $key, int $expires = 900, array $extraQuery = []): string {
  $region = (string)cfg('WASABI_REGION', 'eu-central-1'); $host = s3_host(); $bucket = (string)cfg('WASABI_BUCKET');
  $t = time(); $amz = gmdate('Ymd\THis\Z', $t); $day = gmdate('Ymd', $t); $scope = "$day/$region/s3/aws4_request";
  $path = '/' . $bucket . '/' . s3_enc($key);
  $q = array_merge($extraQuery, ['X-Amz-Algorithm' => 'AWS4-HMAC-SHA256', 'X-Amz-Credential' => cfg('WASABI_KEY') . '/' . $scope, 'X-Amz-Date' => $amz, 'X-Amz-Expires' => (string)$expires, 'X-Amz-SignedHeaders' => 'host']);
  ksort($q); $qs = implode('&', array_map(fn($k, $v) => rawurlencode($k) . '=' . rawurlencode($v), array_keys($q), $q));
  $canon = "$method\n$path\n$qs\nhost:$host\n\nhost\nUNSIGNED-PAYLOAD";
  $sts = "AWS4-HMAC-SHA256\n$amz\n$scope\n" . hash('sha256', $canon);
  $k = hash_hmac('sha256', 'aws4_request', hash_hmac('sha256', 's3', hash_hmac('sha256', $region, hash_hmac('sha256', $day, 'AWS4' . cfg('WASABI_SECRET'), true), true), true), true);
  return "https://$host$path?$qs&X-Amz-Signature=" . hash_hmac('sha256', $sts, $k);
}
// Signert forespørsel fra serveren (brukes til å opprette bøtte og sette CORS automatisk).
function s3_request(string $method, string $path, string $query = '', string $payload = '', array $headers = []): array {
  $region = (string)cfg('WASABI_REGION', 'eu-central-1'); $host = s3_host();
  $t = time(); $amz = gmdate('Ymd\THis\Z', $t); $day = gmdate('Ymd', $t); $scope = "$day/$region/s3/aws4_request";
  $ph = hash('sha256', $payload);
  $h = array_change_key_case($headers + ['host' => $host, 'x-amz-date' => $amz, 'x-amz-content-sha256' => $ph], CASE_LOWER); ksort($h);
  $ch = ''; foreach ($h as $k => $v) $ch .= $k . ':' . trim((string)$v) . "\n";
  $sh = implode(';', array_keys($h));
  $canon = "$method\n$path\n$query\n$ch\n$sh\n$ph";
  $sts = "AWS4-HMAC-SHA256\n$amz\n$scope\n" . hash('sha256', $canon);
  $k = hash_hmac('sha256', 'aws4_request', hash_hmac('sha256', 's3', hash_hmac('sha256', $region, hash_hmac('sha256', $day, 'AWS4' . cfg('WASABI_SECRET'), true), true), true), true);
  $auth = "AWS4-HMAC-SHA256 Credential=" . cfg('WASABI_KEY') . "/$scope, SignedHeaders=$sh, Signature=" . hash_hmac('sha256', $sts, $k);
  $hl = ['Authorization: ' . $auth]; foreach ($h as $kk => $v) if ($kk !== 'host') $hl[] = "$kk: $v";
  $c = curl_init("https://$host$path" . ($query ? "?$query" : ''));
  curl_setopt_array($c, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $hl, CURLOPT_TIMEOUT => 20]);
  if ($payload !== '') curl_setopt($c, CURLOPT_POSTFIELDS, $payload);
  $out = curl_exec($c); $code = (int)curl_getinfo($c, CURLINFO_HTTP_CODE); $err = curl_error($c); curl_close($c);
  return ['code' => $code, 'body' => (string)$out, 'err' => $err];
}
// Oppretter bøtta (hvis den mangler) og setter CORS slik at portalen kan laste opp direkte. Kjøres én gang.
function s3_setup(): array {
  if (!s3_on()) return ['ok' => false, 'info' => 'Wasabi er ikke satt opp ennå'];
  $b = '/' . cfg('WASABI_BUCKET');
  $head = s3_request('HEAD', $b);
  if ($head['code'] === 404) {
    $region = (string)cfg('WASABI_REGION', 'eu-central-1');
    $xml = '<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><LocationConstraint>' . $region . '</LocationConstraint></CreateBucketConfiguration>';
    $r = s3_request('PUT', $b, '', $xml); if ($r['code'] >= 300) return ['ok' => false, 'info' => 'Kunne ikke opprette bøtte: HTTP ' . $r['code'] . ' ' . substr(strip_tags($r['body']), 0, 160)];
  } elseif ($head['code'] >= 300) return ['ok' => false, 'info' => 'Wasabi svarte HTTP ' . $head['code'] . ($head['err'] ? ' (' . $head['err'] . ')' : '') . '. Sjekk nøkkel, region og bøttenavn.'];
  $origins = array_unique(array_filter([base_url(), 'https://studiovest.no', 'https://www.studiovest.no', 'https://studiovest.github.io']));
  $xml = '<CORSConfiguration><CORSRule>' . implode('', array_map(fn($o) => "<AllowedOrigin>$o</AllowedOrigin>", $origins)) . '<AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>';
  $r = s3_request('PUT', $b, 'cors=', $xml, ['content-md5' => base64_encode(md5($xml, true)), 'content-type' => 'application/xml']);
  if ($r['code'] >= 300) return ['ok' => false, 'info' => 'Bøtta finnes, men CORS feilet: HTTP ' . $r['code']];
  return ['ok' => true, 'info' => 'Bøtte og CORS klar'];
}
