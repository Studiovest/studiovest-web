<?php
// Portalens data per kunde (tenant). GET = hent, PUT = lagre med versjon (hindrer at to enheter overskriver hverandre).
require __DIR__ . '/lib.php';
$u = require_user();
$scope = preg_replace('/[^a-z0-9_-]/', '', (string)($_GET['scope'] ?? 'studio')) ?: 'studio';
$s = db()->prepare('SELECT data, version, updated_at, updated_by FROM app_state WHERE tenant_id=? AND scope=?'); $s->execute([$u['tenant_id'], $scope]); $row = $s->fetch();
if ($_SERVER['REQUEST_METHOD'] === 'GET') json_out(['ok' => true, 'data' => $row ? json_decode((string)$row['data'], true) : null, 'version' => $row ? (int)$row['version'] : 0, 'updated_at' => $row['updated_at'] ?? null, 'updated_by' => $row['updated_by'] ?? null]);
if ($_SERVER['REQUEST_METHOD'] === 'PUT' || $_SERVER['REQUEST_METHOD'] === 'POST') {
  $b = body(); if (!isset($b['data']) || !is_array($b['data'])) fail('Mangler data');
  $json = json_encode($b['data'], JSON_UNESCAPED_UNICODE);
  if (strlen($json) > 8 * 1024 * 1024) fail('For store data', 413);
  $ver = (int)($b['version'] ?? -1);
  if ($row) {
    if ($ver !== (int)$row['version']) json_out(['ok' => false, 'error' => 'konflikt', 'version' => (int)$row['version']], 409);
    $q = db()->prepare('UPDATE app_state SET data=?, version=version+1, updated_at=?, updated_by=? WHERE tenant_id=? AND scope=? AND version=?');
    $q->execute([$json, now(), $u['email'], $u['tenant_id'], $scope, $ver]);
    if (!$q->rowCount()) json_out(['ok' => false, 'error' => 'konflikt'], 409);
    json_out(['ok' => true, 'version' => $ver + 1]);
  }
  db()->prepare('INSERT INTO app_state (tenant_id, scope, data, version, updated_at, updated_by) VALUES (?,?,?,?,?,?)')->execute([$u['tenant_id'], $scope, $json, 1, now(), $u['email']]);
  json_out(['ok' => true, 'version' => 1]);
}
fail('Metode ikke støttet', 405);
