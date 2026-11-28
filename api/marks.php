<?php
// Markerte bilder (1.jpg → 1M.jpg). Lagres på serveren til Wasabi er satt opp.
// POST multipart (job, of, name, file) · POST {a:'delete', job, name} · GET ?job=&name= (viser filen)
require __DIR__ . '/lib.php';
require_user();
function mk_dir(string $job): string { $j = preg_replace('/[^A-Za-z0-9_-]/', '', $job); if ($j === '') fail('Mangler prosjekt'); $d = __DIR__ . '/data/marks/' . $j; if (!is_dir($d)) mkdir($d, 0750, true); return $d; }
function mk_name(string $n): string { $n = basename($n); if (!preg_match('/^[A-Za-z0-9_-]{1,80}M\.jpg$/', $n)) fail('Ugyldig filnavn (skal slutte på M.jpg)'); return $n; }
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  if (!empty($_FILES['file'])) {
    $job = (string)($_POST['job'] ?? ''); $name = mk_name((string)($_POST['name'] ?? ''));
    $f = $_FILES['file']; if ($f['error'] !== UPLOAD_ERR_OK) fail('Opplastingen feilet (' . $f['error'] . ')');
    $info = @getimagesize($f['tmp_name']); if (!$info || $info[2] !== IMAGETYPE_JPEG) fail('Filen er ikke en JPG');
    move_uploaded_file($f['tmp_name'], mk_dir($job) . '/' . $name) || fail('Kunne ikke lagre filen', 500);
    json_out(['ok' => true, 'name' => $name, 'url' => 'marks.php?job=' . rawurlencode($job) . '&name=' . rawurlencode($name)]);
  }
  $b = body();
  if (($b['a'] ?? '') === 'delete') { $p = mk_dir((string)($b['job'] ?? '')) . '/' . mk_name((string)($b['name'] ?? '')); if (is_file($p)) unlink($p); json_out(['ok' => true]); }
  fail('Ukjent handling');
}
$p = mk_dir((string)($_GET['job'] ?? '')) . '/' . mk_name((string)($_GET['name'] ?? ''));
if (!is_file($p)) fail('Fant ikke filen', 404);
header('Content-Type: image/jpeg'); header('Content-Length: ' . filesize($p)); header('Cache-Control: private, max-age=86400');
header('Content-Disposition: ' . (isset($_GET['dl']) ? 'attachment' : 'inline') . '; filename="' . basename($p) . '"'); readfile($p);
