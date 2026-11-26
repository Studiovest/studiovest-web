<?php
// Innlogging med lenke på e-post (ingen passord). ?a=me | request (POST {email}) | verify (&t=...) | logout
require __DIR__ . '/lib.php';
$a = $_GET['a'] ?? 'me';
if ($a === 'me') { $u = current_user(); json_out(['ok' => true, 'user' => $u]); }
if ($a === 'logout') { start_session(); $_SESSION = []; session_destroy(); json_out(['ok' => true]); }
if ($a === 'request') {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Bruk POST', 405);
  $email = strtolower(trim((string)(body()['email'] ?? '')));
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Ugyldig e-postadresse');
  // enkel bremse mot misbruk: maks 5 lenker per adresse per time
  $s = db()->prepare('SELECT COUNT(*) FROM mail_log WHERE to_addr=? AND subject LIKE ? AND sent_at > ?');
  $s->execute([$email, 'Logg inn%', gmdate('Y-m-d\TH:i:s\Z', time() - 3600)]);
  if ((int)$s->fetchColumn() >= 5) fail('For mange forsøk. Prøv igjen om en time.', 429);
  $s = db()->prepare('SELECT id FROM users WHERE tenant_id=? AND email=?'); $s->execute([SV_TENANT, $email]); $uid = $s->fetchColumn();
  if ($uid) {
    $tok = bin2hex(random_bytes(24));
    db()->prepare('INSERT INTO login_tokens (hash, user_id, expires, used) VALUES (?,?,?,0)')->execute([hash('sha256', $tok), $uid, time() + 900]);
    $link = base_url() . '/api/auth.php?a=verify&t=' . $tok;
    send_mail($email, 'Logg inn i Studiovest-portalen', "Hei!\n\nTrykk på lenken for å logge inn (gyldig i 15 minutter):\n$link\n\nHar du ikke bedt om dette, kan du se bort fra e-posten.\n\nStudiovest",
      '<p>Hei!</p><p><a href="' . htmlspecialchars($link) . '" style="display:inline-block;background:#161412;color:#fff;padding:12px 20px;border-radius:99px;text-decoration:none">Logg inn i portalen</a></p><p style="color:#777">Lenken er gyldig i 15 minutter. Har du ikke bedt om dette, kan du se bort fra e-posten.</p>');
  }
  json_out(['ok' => true]); // samme svar uansett, så ingen kan sjekke hvilke adresser som finnes
}
if ($a === 'verify') {
  $tok = (string)($_GET['t'] ?? '');
  $s = db()->prepare('SELECT user_id, expires, used FROM login_tokens WHERE hash=?'); $s->execute([hash('sha256', $tok)]); $r = $s->fetch();
  if (!$r || $r['used'] || $r['expires'] < time()) { header('Location: ' . portal_url() . '/?login=utlopt'); exit; }
  db()->prepare('UPDATE login_tokens SET used=1 WHERE hash=?')->execute([hash('sha256', $tok)]);
  db()->prepare('UPDATE users SET last_login=? WHERE id=?')->execute([now(), $r['user_id']]);
  start_session(); session_regenerate_id(true); $_SESSION['uid'] = (int)$r['user_id'];
  header('Location: ' . portal_url() . '/'); exit;
}
fail('Ukjent handling', 404);
