<?php
// Opplasting og nedlasting via Wasabi. POST {name, type, size, kind, ref} → signert PUT-lenke. GET ?key=… → signert visningslenke.
require __DIR__ . '/lib.php';
$u = require_user();
if (!s3_on()) fail('Lagring (Wasabi) er ikke satt opp ennå', 503);
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $b = body();
  $name = preg_replace('/[^A-Za-z0-9._-]+/', '-', (string)($b['name'] ?? 'fil')) ?: 'fil';
  $kind = in_array($b['kind'] ?? '', ['raw', 'edit', 'web', 'thumb', 'doc'], true) ? $b['kind'] : 'doc';
  $ref = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($b['ref'] ?? 'diverse')) ?: 'diverse';
  $key = $u['tenant_id'] . '/' . $kind . '/' . $ref . '/' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '-' . $name;
  db()->prepare('INSERT INTO files (tenant_id, s3key, name, type, size, kind, ref, created_at) VALUES (?,?,?,?,?,?,?,?)')->execute([$u['tenant_id'], $key, $name, (string)($b['type'] ?? ''), (int)($b['size'] ?? 0), $kind, $ref, now()]);
  json_out(['ok' => true, 'key' => $key, 'url' => s3_presign('PUT', $key, 3600)]);
}
$key = (string)($_GET['key'] ?? '');
if (strpos($key, $u['tenant_id'] . '/') !== 0) fail('Ingen tilgang', 403); // kun egne filer
json_out(['ok' => true, 'url' => s3_presign('GET', $key, 3600)]);
