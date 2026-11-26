<?php
// Plantegningsagent. Plantegningen lagres som en scene (JSON) per prosjekt og etasje. Agenten (Claude) gjør endringer
// gjennom verktøyene i prompts/plantegning.md, og ingenting publiseres før Studiovest godkjenner.
require_once __DIR__ . '/lib.php';

const PLAN_TITLES = ['Kjeller', 'Underetasje', '1.Etasje', '2.Etasje', '3.Etasje', 'Loft', 'Leilighet'];
const PLAN_LABELS = ['Stue', 'Spisestue', 'Kjøkken', 'Soverom', 'Bad', 'WC', 'Vaskerom', 'Entré', 'Gang', 'Bod', 'Kontor', 'Hems', 'Loftstue', 'Kjellerstue', 'Garderobe',
  'Teknisk rom', 'Garasje', 'Carport', 'Balkong', 'Terrasse', 'Veranda', 'Uteplass', 'Inngangsparti', 'Overbygd inngangsparti', 'Trapperom'];
const PLAN_WET = ['Bad', 'WC', 'Vaskerom'];
const PLAN_OUTDOOR = ['Balkong', 'Terrasse', 'Veranda', 'Uteplass', 'Inngangsparti', 'Overbygd inngangsparti'];
const PLAN_OFFICES = ['em_norge', 'em1_sor', 'aktiv_sunnhordland', 'nordvik'];
// portalens kontor-id → stil i plantegningen
const PLAN_OFFICE_OF = ['emn' => 'em_norge', 'em1' => 'em1_sor', 'aksun' => 'aktiv_sunnhordland', 'nvhar' => 'nordvik', 'nvsun' => 'nordvik', 'nvhau' => 'nordvik'];

function plan_tables(): void {
  $p = db(); $ai = is_sqlite($p) ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY'; $tx = is_sqlite($p) ? 'TEXT' : 'LONGTEXT';
  $eng = is_sqlite($p) ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
  $p->exec("CREATE TABLE IF NOT EXISTS plan_scene (tenant_id VARCHAR(40) NOT NULL, job_id VARCHAR(20) NOT NULL, floor VARCHAR(20) NOT NULL, scene $tx, version INT NOT NULL DEFAULT 1, updated_at VARCHAR(25), updated_by VARCHAR(190), PRIMARY KEY (tenant_id, job_id, floor))$eng");
  $p->exec("CREATE TABLE IF NOT EXISTS plan_history (id $ai, tenant_id VARCHAR(40), job_id VARCHAR(20), floor VARCHAR(20), version INT, scene $tx, at VARCHAR(25), by_who VARCHAR(190))$eng");
  $p->exec("CREATE TABLE IF NOT EXISTS plan_session (id $ai, tenant_id VARCHAR(40) NOT NULL, job_id VARCHAR(20), floor VARCHAR(20), status VARCHAR(30), request $tx, from_who VARCHAR(190), messages $tx, draft $tx, base_version INT, question $tx, summary $tx, info VARCHAR(500), tokens_in INT DEFAULT 0, tokens_out INT DEFAULT 0, created_at VARCHAR(25), updated_at VARCHAR(25))$eng");
}

// ---------- lagring ----------
function plan_get(string $job, string $floor): ?array {
  $s = db()->prepare('SELECT scene, version FROM plan_scene WHERE tenant_id=? AND job_id=? AND floor=?'); $s->execute([SV_TENANT, $job, $floor]); $r = $s->fetch();
  return $r ? ['scene' => json_decode((string)$r['scene'], true), 'version' => (int)$r['version']] : null;
}
function plan_put(string $job, string $floor, array $scene, string $by, ?int $expect = null): int {
  $cur = plan_get($job, $floor); $p = db();
  if ($cur && $expect !== null && $cur['version'] !== $expect) throw new Exception('Plantegningen er endret av noen andre siden forslaget ble laget. Kjør agenten på nytt.');
  $json = json_encode($scene, JSON_UNESCAPED_UNICODE);
  if ($cur) {
    $p->prepare('INSERT INTO plan_history (tenant_id, job_id, floor, version, scene, at, by_who) VALUES (?,?,?,?,?,?,?)')->execute([SV_TENANT, $job, $floor, $cur['version'], json_encode($cur['scene'], JSON_UNESCAPED_UNICODE), now(), $by]);
    $p->prepare('UPDATE plan_scene SET scene=?, version=version+1, updated_at=?, updated_by=? WHERE tenant_id=? AND job_id=? AND floor=?')->execute([$json, now(), $by, SV_TENANT, $job, $floor]);
    return $cur['version'] + 1;
  }
  $p->prepare('INSERT INTO plan_scene (tenant_id, job_id, floor, scene, version, updated_at, updated_by) VALUES (?,?,?,?,1,?,?)')->execute([SV_TENANT, $job, $floor, $json, now(), $by]);
  return 1;
}

// ---------- geometri ----------
function pg_pip(array $pt, array $poly): bool {
  $in = false; $n = count($poly);
  for ($i = 0, $j = $n - 1; $i < $n; $j = $i++) {
    [$xi, $yi] = $poly[$i]; [$xj, $yj] = $poly[$j];
    if ((($yi > $pt[1]) !== ($yj > $pt[1])) && ($pt[0] < ($xj - $xi) * ($pt[1] - $yi) / (($yj - $yi) ?: 1e-9) + $xi)) $in = !$in;
  }
  return $in;
}
function pg_rect(float $cx, float $cy, float $w, float $h, float $rot): array {
  $a = deg2rad($rot); $c = cos($a); $s = sin($a); $out = [];
  foreach ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as [$sx, $sy]) { $x = $sx * $w / 2; $y = $sy * $h / 2; $out[] = [$cx + $x * $c - $y * $s, $cy + $x * $s + $y * $c]; }
  return $out;
}
function pg_fx(array $f): array { return pg_rect((float)$f['x'], (float)$f['y'], (float)$f['w'], (float)$f['h'], (float)($f['rotation'] ?? 0)); }
// Overlapper to konvekse polygoner med mer enn $tol cm? (SAT)
function pg_overlap(array $a, array $b, float $tol = 0.5): bool {
  foreach ([$a, $b] as $poly) {
    $n = count($poly);
    for ($i = 0; $i < $n; $i++) {
      $p1 = $poly[$i]; $p2 = $poly[($i + 1) % $n]; $ax = -($p2[1] - $p1[1]); $ay = $p2[0] - $p1[0]; $l = hypot($ax, $ay) ?: 1; $ax /= $l; $ay /= $l;
      $pa = array_map(fn($p) => $p[0] * $ax + $p[1] * $ay, $a); $pb = array_map(fn($p) => $p[0] * $ax + $p[1] * $ay, $b);
      if (min(max($pa), max($pb)) - max(min($pa), min($pb)) <= $tol) return false;
    }
  }
  return true;
}
function pg_wall_t(array $w): float { return ($w['kind'] ?? 'interior') === 'exterior' ? 17.0 : (($w['kind'] ?? '') === 'separator' ? 0.0 : 12.0); }
function pg_wall_geo(array $w): array {
  $a = $w['start']; $b = $w['end']; $dx = $b[0] - $a[0]; $dy = $b[1] - $a[1]; $len = hypot($dx, $dy) ?: 1e-9;
  return ['a' => $a, 'b' => $b, 'len' => $len, 'u' => [$dx / $len, $dy / $len], 'n' => [-$dy / $len, $dx / $len]];
}
function pg_wall_band(array $w): array {
  $g = pg_wall_geo($w); $t = pg_wall_t($w) / 2; [$nx, $ny] = $g['n']; [$a, $b] = [$g['a'], $g['b']];
  return [[$a[0] + $nx * $t, $a[1] + $ny * $t], [$b[0] + $nx * $t, $b[1] + $ny * $t], [$b[0] - $nx * $t, $b[1] - $ny * $t], [$a[0] - $nx * $t, $a[1] - $ny * $t]];
}
function pg_find(array $list, string $id): ?int { foreach ($list as $i => $x) if ((string)($x['id'] ?? '') === $id) return $i; return null; }
function pg_room(array $s, string $id): ?array { $i = pg_find($s['rooms'] ?? [], $id); return $i === null ? null : $s['rooms'][$i]; }
function pg_room_name(array $s, ?string $id): string { $r = $id ? pg_room($s, $id) : null; return $r ? (string)($r['label'] ?? $r['id']) : (string)$id; }
// Svingområdet til en dør: kvadrat (bredde × bredde) på siden døren slår inn mot.
function pg_swing(array $s, array $o): ?array {
  if (($o['type'] ?? '') !== 'door') return null;
  $wi = pg_find($s['walls'] ?? [], (string)$o['wall_id']); if ($wi === null) return null;
  $g = pg_wall_geo($s['walls'][$wi]); [$ux, $uy] = $g['u']; [$nx, $ny] = $g['n']; $off = (float)$o['offset']; $wd = (float)$o['width'];
  $p0 = [$g['a'][0] + $ux * $off, $g['a'][1] + $uy * $off]; $p1 = [$p0[0] + $ux * $wd, $p0[1] + $uy * $wd];
  $side = 1; $room = !empty($o['opens_into']) ? pg_room($s, (string)$o['opens_into']) : null;
  if ($room) { $mid = [($p0[0] + $p1[0]) / 2 + $nx * 25, ($p0[1] + $p1[1]) / 2 + $ny * 25]; $side = pg_pip($mid, $room['polygon']) ? 1 : -1; }
  if (($o['swing'] ?? 'in') === 'out') $side = -$side;
  $t = pg_wall_t($s['walls'][$wi]) / 2; $sx = $nx * $side; $sy = $ny * $side;
  $q0 = [$p0[0] + $sx * $t, $p0[1] + $sy * $t]; $q1 = [$p1[0] + $sx * $t, $p1[1] + $sy * $t];
  return [$q0, $q1, [$q1[0] + $sx * $wd, $q1[1] + $sy * $wd], [$q0[0] + $sx * $wd, $q0[1] + $sy * $wd]];
}

// ---------- kontroll ----------
function plan_check(array $s): array {
  $w = [];
  $title = (string)($s['floor_title'] ?? '');
  if ($title !== '' && !in_array($title, PLAN_TITLES, true)) $w[] = "Etasjetittel «{$title}» følger ikke standarden (" . implode(', ', PLAN_TITLES) . ')';
  foreach ($s['rooms'] ?? [] as $r) {
    $l = (string)($r['label'] ?? '');
    if ($l !== '' && !in_array($l, PLAN_LABELS, true)) $w[] = "Rom {$r['id']}: navnet «{$l}» er ikke et standard romnavn";
    $want = in_array($l, PLAN_WET, true) ? 'wet' : (in_array($l, PLAN_OUTDOOR, true) ? 'outdoor' : 'room');
    if ($l !== '' && in_array($l, PLAN_LABELS, true) && ($r['surface'] ?? 'room') !== $want) $w[] = "Rom {$r['id']} ($l): surface er «" . ($r['surface'] ?? 'room') . "», skal være «{$want}»";
  }
  $fx = $s['fixtures'] ?? []; $swings = [];
  foreach ($s['openings'] ?? [] as $o) {
    $wi = pg_find($s['walls'] ?? [], (string)($o['wall_id'] ?? ''));
    if ($wi === null) { $w[] = "Åpning {$o['id']}: veggen {$o['wall_id']} finnes ikke"; continue; }
    $len = pg_wall_geo($s['walls'][$wi])['len'];
    if ((float)$o['offset'] < 0 || (float)$o['offset'] + (float)$o['width'] > $len + 0.5) $w[] = "Åpning {$o['id']} går utenfor veggen {$o['wall_id']} (veggen er " . round($len) . ' cm)';
    if (($sw = pg_swing($s, $o))) $swings[$o['id']] = $sw;
  }
  $ops = $s['openings'] ?? [];
  for ($i = 0; $i < count($ops); $i++) for ($k = $i + 1; $k < count($ops); $k++) {
    $a = $ops[$i]; $b = $ops[$k]; if (($a['wall_id'] ?? '') !== ($b['wall_id'] ?? '')) continue;
    if ((float)$a['offset'] < (float)$b['offset'] + (float)$b['width'] - 0.5 && (float)$b['offset'] < (float)$a['offset'] + (float)$a['width'] - 0.5) $w[] = "Åpningene {$a['id']} og {$b['id']} overlapper i veggen {$a['wall_id']}";
  }
  foreach ($fx as $i => $f) {
    $poly = pg_fx($f); $room = pg_room($s, (string)($f['room_id'] ?? ''));
    if (!$room) $w[] = "Inventar {$f['id']}: rommet " . ($f['room_id'] ?? '?') . ' finnes ikke';
    else {
      $c = [(float)$f['x'], (float)$f['y']];
      foreach ($poly as $p) { $q = [$p[0] + ($c[0] - $p[0]) * 0.02, $p[1] + ($c[1] - $p[1]) * 0.02]; if (!pg_pip($q, $room['polygon'])) { $w[] = "Inventar {$f['id']} ({$f['type']}) stikker utenfor rommet " . pg_room_name($s, $room['id']); break; } }
    }
    foreach ($s['walls'] ?? [] as $wl) if (pg_wall_t($wl) > 0 && pg_overlap($poly, pg_wall_band($wl), 1.0)) { $w[] = "Inventar {$f['id']} ({$f['type']}) overlapper veggen {$wl['id']}"; break; }
    for ($k = $i + 1; $k < count($fx); $k++) if (pg_overlap($poly, pg_fx($fx[$k]), 1.0) && !in_array($f['type'] ?? '', ['sink', 'stove', 'cooktop'], true) && !in_array($fx[$k]['type'] ?? '', ['sink', 'stove', 'cooktop'], true)) $w[] = "Inventar {$f['id']} og {$fx[$k]['id']} overlapper";
    foreach ($swings as $oid => $sw) if (pg_overlap($poly, $sw, 1.0)) $w[] = "Inventar {$f['id']} ({$f['type']}) står i svingområdet til døren $oid";
  }
  return $w;
}

// ---------- endringer ----------
function pe_need(array $e, string ...$keys): void { foreach ($keys as $k) if (!array_key_exists($k, $e)) throw new Exception("{$e['op']}: mangler «{$k}»"); }
function pe_idx(array $s, string $list, string $id, string $what): int { $i = pg_find($s[$list] ?? [], $id); if ($i === null) throw new Exception("Fant ikke $what «{$id}»"); return $i; }
function pe_newid(array $list, string $pre): string { $n = count($list) + 1; $ids = array_column($list, 'id'); while (in_array($pre . $n, $ids, true)) $n++; return $pre . $n; }
// Bruker alle endringene, eller ingen (kaster unntak). Returnerer [ny scene, nye advarsler, beskrivelse].
function plan_apply(array $s, array $edits): array {
  $before = plan_check($s); $log = [];
  foreach ($edits as $e) {
    $op = (string)($e['op'] ?? '');
    switch ($op) {
      case 'rename_room': pe_need($e, 'room_id', 'label'); $i = pe_idx($s, 'rooms', $e['room_id'], 'rommet'); $old = $s['rooms'][$i]['label'] ?? '';
        $s['rooms'][$i]['label'] = (string)$e['label'];
        foreach ($s['labels'] ?? [] as $k => $l) if (($l['room_id'] ?? '') === $e['room_id']) $s['labels'][$k]['text'] = (string)$e['label'];
        $log[] = "Rom $old → {$e['label']}"; break;
      case 'set_room_type': pe_need($e, 'room_id'); $i = pe_idx($s, 'rooms', $e['room_id'], 'rommet');
        if (isset($e['type'])) $s['rooms'][$i]['type'] = (string)$e['type'];
        if (isset($e['surface'])) { if (!in_array($e['surface'], ['room', 'wet', 'outdoor'], true)) throw new Exception('surface må være room, wet eller outdoor'); $s['rooms'][$i]['surface'] = $e['surface']; }
        $log[] = "Romtype {$e['room_id']}"; break;
      case 'remove_fixture': pe_need($e, 'fixture_id'); $i = pe_idx($s, 'fixtures', $e['fixture_id'], 'inventaret'); $log[] = 'Fjernet ' . $s['fixtures'][$i]['type'] . ' i ' . pg_room_name($s, $s['fixtures'][$i]['room_id'] ?? null);
        array_splice($s['fixtures'], $i, 1); break;
      case 'add_fixture': pe_need($e, 'fixture'); $f = (array)$e['fixture']; foreach (['type', 'room_id', 'x', 'y', 'w', 'h'] as $k) if (!isset($f[$k])) throw new Exception("add_fixture: mangler fixture.$k");
        if (!pg_room($s, (string)$f['room_id'])) throw new Exception("Fant ikke rommet «{$f['room_id']}»");
        $f['id'] = (string)($f['id'] ?? '') ?: pe_newid($s['fixtures'] ?? [], 'f'); if (pg_find($s['fixtures'] ?? [], $f['id']) !== null) throw new Exception("Inventar-id «{$f['id']}» finnes fra før");
        $f['rotation'] = (float)($f['rotation'] ?? 0); $s['fixtures'][] = $f; $log[] = "La til {$f['type']} i " . pg_room_name($s, $f['room_id']); break;
      case 'move_fixture': pe_need($e, 'fixture_id', 'x', 'y'); $i = pe_idx($s, 'fixtures', $e['fixture_id'], 'inventaret'); $s['fixtures'][$i]['x'] = (float)$e['x']; $s['fixtures'][$i]['y'] = (float)$e['y'];
        if (isset($e['room_id'])) $s['fixtures'][$i]['room_id'] = (string)$e['room_id']; $log[] = "Flyttet {$e['fixture_id']}"; break;
      case 'resize_fixture': pe_need($e, 'fixture_id', 'w', 'h'); $i = pe_idx($s, 'fixtures', $e['fixture_id'], 'inventaret'); $s['fixtures'][$i]['w'] = (float)$e['w']; $s['fixtures'][$i]['h'] = (float)$e['h']; $log[] = "Endret størrelse på {$e['fixture_id']}"; break;
      case 'rotate_fixture': pe_need($e, 'fixture_id', 'rotation'); $i = pe_idx($s, 'fixtures', $e['fixture_id'], 'inventaret'); $s['fixtures'][$i]['rotation'] = fmod((float)$e['rotation'], 360); $log[] = "Rotert {$e['fixture_id']}"; break;
      case 'add_opening': pe_need($e, 'opening'); $o = (array)$e['opening']; foreach (['wall_id', 'type', 'offset', 'width'] as $k) if (!isset($o[$k])) throw new Exception("add_opening: mangler opening.$k");
        pe_idx($s, 'walls', (string)$o['wall_id'], 'veggen'); if (!in_array($o['type'], ['door', 'window', 'passage'], true)) throw new Exception('type må være door, window eller passage');
        $o['id'] = (string)($o['id'] ?? '') ?: pe_newid($s['openings'] ?? [], 'o'); if ($o['type'] === 'door') { $o['hinge'] = $o['hinge'] ?? 'start'; $o['swing'] = $o['swing'] ?? 'in'; }
        $s['openings'][] = $o; $log[] = "La til {$o['type']} i veggen {$o['wall_id']}"; break;
      case 'remove_opening': pe_need($e, 'opening_id'); $i = pe_idx($s, 'openings', $e['opening_id'], 'åpningen'); $log[] = 'Fjernet ' . $s['openings'][$i]['type'] . " {$e['opening_id']}"; array_splice($s['openings'], $i, 1); break;
      case 'move_opening': pe_need($e, 'opening_id', 'offset'); $i = pe_idx($s, 'openings', $e['opening_id'], 'åpningen'); $s['openings'][$i]['offset'] = (float)$e['offset']; $log[] = "Flyttet {$e['opening_id']}"; break;
      case 'set_door_swing': pe_need($e, 'opening_id'); $i = pe_idx($s, 'openings', $e['opening_id'], 'åpningen');
        if (($s['openings'][$i]['type'] ?? '') !== 'door') throw new Exception("{$e['opening_id']} er ikke en dør");
        foreach (['swing' => ['in', 'out'], 'hinge' => ['start', 'end']] as $k => $ok) if (isset($e[$k])) { if (!in_array($e[$k], $ok, true)) throw new Exception("$k må være " . implode(' eller ', $ok)); $s['openings'][$i][$k] = $e[$k]; }
        if (isset($e['opens_into'])) $s['openings'][$i]['opens_into'] = (string)$e['opens_into']; $log[] = "Endret slagretning på døren {$e['opening_id']}"; break;
      case 'set_opening_type': pe_need($e, 'opening_id', 'type'); $i = pe_idx($s, 'openings', $e['opening_id'], 'åpningen'); if (!in_array($e['type'], ['door', 'window', 'passage'], true)) throw new Exception('type må være door, window eller passage');
        $s['openings'][$i]['type'] = $e['type']; if ($e['type'] === 'door') { $s['openings'][$i]['hinge'] = $s['openings'][$i]['hinge'] ?? 'start'; $s['openings'][$i]['swing'] = $s['openings'][$i]['swing'] ?? 'in'; }
        $log[] = "{$e['opening_id']} er nå {$e['type']}"; break;
      case 'add_wall': pe_need($e, 'wall'); $w = (array)$e['wall']; foreach (['kind', 'start', 'end'] as $k) if (!isset($w[$k])) throw new Exception("add_wall: mangler wall.$k");
        $w['id'] = (string)($w['id'] ?? '') ?: pe_newid($s['walls'] ?? [], 'w'); $s['walls'][] = $w; $log[] = "La til vegg {$w['id']}"; break;
      case 'remove_wall': pe_need($e, 'wall_id'); $i = pe_idx($s, 'walls', $e['wall_id'], 'veggen');
        $s['openings'] = array_values(array_filter($s['openings'] ?? [], fn($o) => ($o['wall_id'] ?? '') !== $e['wall_id'])); array_splice($s['walls'], $i, 1); $log[] = "Fjernet veggen {$e['wall_id']}"; break;
      case 'move_label': pe_need($e, 'x', 'y'); $id = (string)($e['label_id'] ?? ''); $k = $id !== '' ? pg_find($s['labels'] ?? [], $id) : null;
        if ($k === null && !empty($e['room_id'])) foreach ($s['labels'] ?? [] as $kk => $l) if (($l['room_id'] ?? '') === $e['room_id']) { $k = $kk; break; }
        if ($k === null) throw new Exception('Fant ikke etiketten'); $s['labels'][$k]['x'] = (float)$e['x']; $s['labels'][$k]['y'] = (float)$e['y']; $log[] = 'Flyttet romnavn'; break;
      case 'set_floor_title': pe_need($e, 'title'); $s['floor_title'] = (string)$e['title']; $log[] = "Etasjetittel {$e['title']}"; break;
      default: throw new Exception("Ukjent operasjon «{$op}»");
    }
  }
  $after = plan_check($s);
  return [$s, array_values(array_diff($after, $before)), $log, count(array_intersect($after, $before))];
}

// ---------- stil og forhåndsvisning ----------
function plan_styles(): array {
  static $st = null; if ($st !== null) return $st;
  $t = (string)file_get_contents(__DIR__ . '/prompts/plantegning.md');
  $st = preg_match('/```json\s*(\{.*\})\s*```/s', $t, $m) ? (json_decode($m[1], true)['offices'] ?? []) : [];
  return $st;
}
function pv_col($im, string $hex) { $h = ltrim($hex, '#'); return imagecolorallocate($im, hexdec(substr($h, 0, 2)), hexdec(substr($h, 2, 2)), hexdec(substr($h, 4, 2))); }
// Tegner scenen som PNG (forenklet utgave av kontorstilen, bare for at agenten skal se resultatet). Null hvis GD mangler.
function plan_png(array $s, int $W = 1100, int $H = 820): ?string {
  if (!function_exists('imagecreatetruecolor')) return null;
  $style = plan_styles()[$s['office'] ?? 'em_norge']['plan'] ?? ['wall' => '#101010', 'room' => '#f4f0ed', 'wet' => '#e6f5ff', 'outdoor' => '#eaeaea', 'line' => '#101010'];
  $pts = []; foreach ($s['walls'] ?? [] as $w) { $pts[] = $w['start']; $pts[] = $w['end']; } foreach ($s['rooms'] ?? [] as $r) foreach ($r['polygon'] as $p) $pts[] = $p;
  if (!$pts) return null;
  $minx = min(array_column($pts, 0)); $maxx = max(array_column($pts, 0)); $miny = min(array_column($pts, 1)); $maxy = max(array_column($pts, 1));
  $sc = min(($W - 80) / max(1, $maxx - $minx), ($H - 120) / max(1, $maxy - $miny)); $ox = ($W - ($maxx - $minx) * $sc) / 2; $oy = 40 + (($H - 120) - ($maxy - $miny) * $sc) / 2;
  $P = fn($p) => [(int)round($ox + ($p[0] - $minx) * $sc), (int)round($oy + ($p[1] - $miny) * $sc)];
  $flat = function ($poly) use ($P) { $o = []; foreach ($poly as $p) { $q = $P($p); $o[] = $q[0]; $o[] = $q[1]; } return $o; };
  $im = imagecreatetruecolor($W, $H); imageantialias($im, true);
  $white = imagecolorallocate($im, 255, 255, 255); $wall = pv_col($im, $style['wall']); $line = pv_col($im, $style['line'] ?? $style['wall']); $grey = imagecolorallocate($im, 150, 150, 150);
  imagefill($im, 0, 0, $white); $font = __DIR__ . '/fonts/DejaVuSans.ttf'; $ttf = is_file($font) && function_exists('imagettftext');
  $poly = function ($pts, $col, $fill = true) use ($im, $flat) { $f = $flat($pts); if (PHP_VERSION_ID >= 80000) { $fill ? imagefilledpolygon($im, $f, $col) : imagepolygon($im, $f, $col); } else { $fill ? imagefilledpolygon($im, $f, count($pts), $col) : imagepolygon($im, $f, count($pts), $col); } };
  foreach ($s['rooms'] ?? [] as $r) $poly($r['polygon'], pv_col($im, $style[$r['surface'] ?? 'room'] ?? $style['room']));
  foreach ($s['walls'] ?? [] as $w) { $t = pg_wall_t($w) / 2; if ($t > 0) foreach ([$w['start'], $w['end']] as $c) $poly([[$c[0] - $t, $c[1] - $t], [$c[0] + $t, $c[1] - $t], [$c[0] + $t, $c[1] + $t], [$c[0] - $t, $c[1] + $t]], $wall); }
  foreach ($s['walls'] ?? [] as $w) { if (pg_wall_t($w) > 0) $poly(pg_wall_band($w), $wall); else { imagesetthickness($im, 2); $a = $P($w['start']); $b = $P($w['end']); imageline($im, $a[0], $a[1], $b[0], $b[1], pv_col($im, '#e8c34a')); imagesetthickness($im, 1); } }
  foreach ($s['openings'] ?? [] as $o) {
    $wi = pg_find($s['walls'] ?? [], (string)$o['wall_id']); if ($wi === null) continue; $wl = $s['walls'][$wi]; $g = pg_wall_geo($wl); [$ux, $uy] = $g['u']; [$nx, $ny] = $g['n'];
    $t = pg_wall_t($wl) / 2 + 0.6; $p0 = [$g['a'][0] + $ux * $o['offset'], $g['a'][1] + $uy * $o['offset']]; $p1 = [$p0[0] + $ux * $o['width'], $p0[1] + $uy * $o['width']];
    $band = [[$p0[0] + $nx * $t, $p0[1] + $ny * $t], [$p1[0] + $nx * $t, $p1[1] + $ny * $t], [$p1[0] - $nx * $t, $p1[1] - $ny * $t], [$p0[0] - $nx * $t, $p0[1] - $ny * $t]];
    $poly($band, $o['type'] === 'passage' ? pv_col($im, $style['room']) : $white);
    if ($o['type'] === 'window') { $poly($band, $line, false); $a = $P($p0); $b = $P($p1); imageline($im, $a[0], $a[1], $b[0], $b[1], $line); }
    if ($o['type'] === 'door' && ($sw = pg_swing($s, $o))) {
      $hinge = ($o['hinge'] ?? 'start') === 'end' ? $p1 : $p0; $other = ($o['hinge'] ?? 'start') === 'end' ? $p0 : $p1;
      $dir = [($sw[3][0] - $sw[0][0]) / max(1e-9, $o['width']), ($sw[3][1] - $sw[0][1]) / max(1e-9, $o['width'])]; // retning inn i rommet
      $along = [($other[0] - $hinge[0]) / $o['width'], ($other[1] - $hinge[1]) / $o['width']]; $a15 = deg2rad(15);
      $leaf = [$hinge[0] + ($along[0] * cos($a15) + $dir[0] * sin($a15)) * $o['width'], $hinge[1] + ($along[1] * cos($a15) + $dir[1] * sin($a15)) * $o['width']];
      $h = $P($hinge); $l = $P($leaf); imagesetthickness($im, 2); imageline($im, $h[0], $h[1], $l[0], $l[1], $line); imagesetthickness($im, 1);
      $ang = fn($v) => rad2deg(atan2($v[1], $v[0])); $s1 = $ang([$along[0], $along[1]]); $s2 = $ang([$leaf[0] - $hinge[0], $leaf[1] - $hinge[1]]); $d = (int)round(2 * $o['width'] * $sc);
      [$from, $to] = fmod($s2 - $s1 + 360, 360) < 180 ? [$s1, $s2] : [$s2, $s1]; imagearc($im, $h[0], $h[1], $d, $d, (int)round($from), (int)round($to), $line);
    }
  }
  foreach ($s['fixtures'] ?? [] as $f) { $c = pg_fx($f); $poly($c, $white); $poly($c, $line, false); if ($ttf) { $q = $P([$f['x'], $f['y']]); imagettftext($im, 8, 0, $q[0] - 3 * strlen($f['type']), $q[1] + 4, $grey, $font, $f['type']); } }
  if ($ttf) {
    foreach ($s['labels'] ?? [] as $l) { $q = $P([$l['x'], $l['y']]); $b = imagettfbbox(13, 0, $font, $l['text']); imagettftext($im, 13, 0, $q[0] - (int)(($b[2] - $b[0]) / 2), $q[1] + 6, $line, $font, $l['text']); }
    if (!empty($s['floor_title'])) { $b = imagettfbbox(16, 0, $font, $s['floor_title']); imagettftext($im, 16, 0, (int)(($W - ($b[2] - $b[0])) / 2), $H - 30, $line, $font, $s['floor_title']); }
  }
  ob_start(); imagepng($im); imagedestroy($im); return base64_encode((string)ob_get_clean());
}

// ---------- agenten ----------
function plan_system(): string {
  return (string)file_get_contents(__DIR__ . '/prompts/plantegning.md') . "\n\n# Teknisk format (fra portalen)\n" .
    "- `plan_id` har formen «<prosjekt>:<etasje>», f.eks. «B-2620:f1».\n" .
    "- Inventar (`fixtures`): `x`, `y` er midtpunktet, `w` × `h` er bredde og dybde før rotasjon, `rotation` i grader med klokka. Alt i cm.\n" .
    "- Åpninger: `offset` er avstanden i cm fra veggens `start` til åpningens begynnelse, målt langs veggen. `hinge` = start/end er den enden av åpningen som er nærmest veggens start/end.\n" .
    "- Vegger: `start` og `end` er senterlinjen. Utvendige vegger er 17 cm tykke, innvendige 12 cm. `kind: separator` er Cubicasa-strek mellom rom (den gule streken), ikke en vegg.\n" .
    "- Endringene i `apply_edits` er objekter med `op` + feltene, f.eks. {\"op\":\"rename_room\",\"room_id\":\"r3\",\"label\":\"Kontor\"}, {\"op\":\"set_room_type\",\"room_id\":\"r3\",\"type\":\"office\",\"surface\":\"room\"}, " .
    "{\"op\":\"add_fixture\",\"fixture\":{\"type\":\"washer\",\"room_id\":\"r5\",\"x\":120,\"y\":80,\"w\":60,\"h\":60,\"rotation\":0}}, {\"op\":\"set_door_swing\",\"opening_id\":\"o4\",\"swing\":\"out\"}, {\"op\":\"remove_wall\",\"wall_id\":\"w12\"}.\n" .
    "- Etter `apply_edits` får du bare advarsler som endringen din skapte. Advarsler som fantes fra før, skal du la være.";
}
function plan_tools(): array {
  $id = ['plan_id' => ['type' => 'string']];
  return [
    ['name' => 'get_plan', 'description' => 'Henter gjeldende scene (JSON) og en forhåndsvisning.', 'input_schema' => ['type' => 'object', 'properties' => $id, 'required' => ['plan_id']]],
    ['name' => 'apply_edits', 'description' => 'Bruker alle endringene samtidig (alt eller ingenting). Returnerer ny scene, forhåndsvisning og nye advarsler.', 'input_schema' => ['type' => 'object', 'properties' => $id + ['edits' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['op' => ['type' => 'string', 'enum' => ['rename_room', 'set_room_type', 'remove_fixture', 'add_fixture', 'move_fixture', 'resize_fixture', 'rotate_fixture', 'add_opening', 'remove_opening', 'move_opening', 'set_door_swing', 'set_opening_type', 'add_wall', 'remove_wall', 'move_label', 'set_floor_title']]], 'required' => ['op']]]], 'required' => ['plan_id', 'edits']]],
    ['name' => 'ask_user', 'description' => 'Stiller personen ett kort spørsmål. Agenten venter til svaret kommer.', 'input_schema' => ['type' => 'object', 'properties' => ['question' => ['type' => 'string']], 'required' => ['question']]],
    ['name' => 'submit_for_approval', 'description' => 'Sender endringen til godkjenning hos Studiovest.', 'input_schema' => ['type' => 'object', 'properties' => $id + ['summary' => ['type' => 'string']], 'required' => ['plan_id', 'summary']]],
  ];
}
function plan_claude(array $messages): array {
  $fake = cfg('PLAN_FAKE');
  if ($fake) { // tester: forhåndsdefinerte svar, ett per kall
    $script = json_decode((string)file_get_contents((string)$fake), true); $n = 0; foreach ($messages as $m) if ($m['role'] === 'assistant') $n++;
    return ['content' => $script[$n] ?? [['type' => 'text', 'text' => 'Ferdig.']], 'usage' => ['input_tokens' => 0, 'output_tokens' => 0]];
  }
  $req = ['model' => (string)cfg('PLAN_MODEL', 'claude-sonnet-5-5'), 'max_tokens' => 4096, 'system' => plan_system(), 'tools' => plan_tools(), 'messages' => $messages];
  $c = curl_init('https://api.anthropic.com/v1/messages');
  curl_setopt_array($c, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 90, CURLOPT_POSTFIELDS => json_encode($req, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER => ['content-type: application/json', 'anthropic-version: 2023-06-01', 'x-api-key: ' . claude_key('FLOORPLAN_EDIT')]]);
  $res = curl_exec($c); $code = (int)curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c); $j = json_decode((string)$res, true);
  if ($code !== 200 || !is_array($j)) throw new Exception('Claude API: HTTP ' . $code . ' ' . substr((string)($j['error']['message'] ?? $res), 0, 200));
  return $j;
}
function plan_session(int $id): array { $s = db()->prepare('SELECT * FROM plan_session WHERE tenant_id=? AND id=?'); $s->execute([SV_TENANT, $id]); $r = $s->fetch(); if (!$r) throw new Exception('Fant ikke forespørselen'); return $r; }
function plan_save_session(int $id, array $f): void {
  $f['updated_at'] = now(); $set = implode(', ', array_map(fn($k) => "$k=?", array_keys($f)));
  db()->prepare("UPDATE plan_session SET $set WHERE tenant_id=? AND id=?")->execute(array_merge(array_values($f), [SV_TENANT, $id]));
}
function plan_result(array $scene, string $text, bool $img = true): array {
  $out = [['type' => 'text', 'text' => $text . "\n\nScene:\n" . json_encode($scene, JSON_UNESCAPED_UNICODE)]];
  if ($img && ($png = plan_png($scene))) $out[] = ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => 'image/png', 'data' => $png]];
  return $out;
}
// Fjerner bilder fra eldre meldinger, så lagringen og tokenbruken holder seg liten.
function plan_slim(array $msgs): array {
  $last = count($msgs) - 1;
  foreach ($msgs as $i => &$m) if ($i < $last && is_array($m['content'])) foreach ($m['content'] as &$b) if (($b['type'] ?? '') === 'tool_result' && is_array($b['content'] ?? null))
    $b['content'] = array_values(array_map(fn($c) => ($c['type'] ?? '') === 'image' ? ['type' => 'text', 'text' => '[eldre forhåndsvisning utelatt]'] : $c, $b['content']));
  return $msgs;
}

// Ny forespørsel: lag økt og kjør. $from = hvem som ba om endringen (navn og rolle).
// Legger en forespørsel i kø (status «venter»). Uten redigerbar plantegning lagres den som «manuell», så Studiovest ser den på prosjektet.
function plan_queue(string $job, string $floor, string $text, string $from): int {
  plan_tables(); $cur = plan_get($job, $floor);
  db()->prepare('INSERT INTO plan_session (tenant_id, job_id, floor, status, request, from_who, messages, draft, base_version, info, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    ->execute([SV_TENANT, $job, $floor, $cur ? 'venter' : 'manuell', $text, $from, json_encode([['role' => 'user', 'content' => "Endringsønske for plantegning $job:$floor fra $from:\n\n$text"]], JSON_UNESCAPED_UNICODE),
      $cur ? json_encode($cur['scene'], JSON_UNESCAPED_UNICODE) : null, $cur['version'] ?? 0, $cur ? null : 'Plantegningen er ikke lagt inn som redigerbar tegning. Må gjøres manuelt.', now(), now()]);
  return (int)db()->lastInsertId();
}
function plan_request(string $job, string $floor, string $text, string $from, int $budget = 50): array {
  plan_tables(); if (!plan_get($job, $floor)) throw new Exception('Plantegningen for denne etasjen er ikke lagt inn i portalen ennå.');
  return plan_step(plan_queue($job, $floor, $text, $from), $budget);
}
// Endringsønske fra e-post: finner etasjen(e) og starter agenten. Returnerer antall forespørsler.
const PLAN_FLOOR_WORDS = ['k' => '/kjeller|underetasje|u\.?\s*etg/i', 'f1' => '/(^|\D)1\.?\s*(etasje|etg)|første etasje|hovedetasje/i', 'f2' => '/(^|\D)2\.?\s*(etasje|etg)|andre etasje/i', 'f3' => '/(^|\D)3\.?\s*(etasje|etg)/i', 'l' => '/loft/i'];
function plan_from_mail(string $job, string $text, string $floorHint, string $from): array {
  plan_tables(); $s = db()->prepare('SELECT floor FROM plan_scene WHERE tenant_id=? AND job_id=?'); $s->execute([SV_TENANT, $job]); $floors = $s->fetchAll(PDO::FETCH_COLUMN);
  if (!$floors) return ['ids' => [plan_queue($job, 'f1', $text, $from)], 'manual' => true];
  $pick = array_values(array_filter($floors, fn($f) => isset(PLAN_FLOOR_WORDS[$f]) && $floorHint !== '' && preg_match(PLAN_FLOOR_WORDS[$f], $floorHint)));
  if (!$pick) $pick = $floors; // etasjen er ikke nevnt: agenten ser på alle og lar være å endre der ønsket ikke passer
  $note = count($pick) > 1 ? "\n\n(Etasjen er ikke nevnt i e-posten. Gjelder ikke ønsket denne etasjen, gjør ingen endringer og si det kort.)" : '';
  $ids = []; foreach ($pick as $f) $ids[] = plan_queue($job, $f, $text . $note, $from);
  plan_step($ids[0], 20); // første etasje med en gang; resten fortsetter i neste kjøring
  return ['ids' => $ids, 'manual' => false];
}
function plan_answer(int $id, string $answer): array {
  $r = plan_session($id); if ($r['status'] !== 'spørsmål') throw new Exception('Agenten venter ikke på svar');
  $msgs = json_decode((string)$r['messages'], true); $tid = null;
  for ($i = count($msgs) - 1; $i >= 0 && !$tid; $i--) if ($msgs[$i]['role'] === 'assistant') foreach ($msgs[$i]['content'] as $b) if (($b['type'] ?? '') === 'tool_use' && $b['name'] === 'ask_user') $tid = $b['id'];
  $res = ['type' => 'tool_result', 'tool_use_id' => $tid, 'content' => $answer];
  if (end($msgs)['role'] === 'user') $msgs[count($msgs) - 1]['content'][] = $res; else $msgs[] = ['role' => 'user', 'content' => [$res]];
  plan_save_session($id, ['messages' => json_encode($msgs, JSON_UNESCAPED_UNICODE), 'status' => 'kjører', 'question' => null]);
  return plan_step($id);
}
// Kjører agenten til den spør, sender til godkjenning, eller går tom for tid/runder.
function plan_step(int $id, int $budget = 50): array {
  $t0 = time(); $r = plan_session($id); $msgs = json_decode((string)$r['messages'], true); $draft = json_decode((string)$r['draft'], true);
  $pid = $r['job_id'] . ':' . $r['floor']; $tin = (int)$r['tokens_in']; $tout = (int)$r['tokens_out'];
  for ($round = 0; $round < 10; $round++) {
    if (time() - $t0 > $budget) { plan_save_session($id, ['messages' => json_encode(plan_slim($msgs), JSON_UNESCAPED_UNICODE), 'draft' => json_encode($draft, JSON_UNESCAPED_UNICODE), 'status' => 'venter', 'tokens_in' => $tin, 'tokens_out' => $tout]); return ['status' => 'venter']; }
    try { $res = plan_claude(plan_slim($msgs)); }
    catch (Throwable $e) { plan_save_session($id, ['status' => 'feil', 'info' => substr($e->getMessage(), 0, 450)]); return ['status' => 'feil', 'info' => $e->getMessage()]; }
    $tin += (int)($res['usage']['input_tokens'] ?? 0); $tout += (int)($res['usage']['output_tokens'] ?? 0);
    $msgs[] = ['role' => 'assistant', 'content' => $res['content']]; $results = []; $stop = null;
    foreach ($res['content'] as $b) {
      if (($b['type'] ?? '') !== 'tool_use') continue; $in = $b['input'] ?? [];
      if (isset($in['plan_id']) && $in['plan_id'] !== $pid) { $results[] = ['type' => 'tool_result', 'tool_use_id' => $b['id'], 'is_error' => true, 'content' => "Du kan bare endre $pid."]; continue; }
      switch ($b['name']) {
        case 'get_plan': $results[] = ['type' => 'tool_result', 'tool_use_id' => $b['id'], 'content' => plan_result($draft, "Plan $pid, kontorstil " . ($draft['office'] ?? '?') . '. Eksisterende advarsler: ' . (implode('; ', plan_check($draft)) ?: 'ingen'))]; break;
        case 'apply_edits':
          try { [$new, $warn, $log, $old] = plan_apply($draft, (array)($in['edits'] ?? [])); $draft = $new;
            $results[] = ['type' => 'tool_result', 'tool_use_id' => $b['id'], 'content' => plan_result($draft, "Utført: " . implode('; ', $log) . "\nNye advarsler: " . ($warn ? implode('; ', $warn) : 'ingen') . ($old ? " ($old advarsler fantes fra før)" : ''))]; }
          catch (Throwable $e) { $results[] = ['type' => 'tool_result', 'tool_use_id' => $b['id'], 'is_error' => true, 'content' => 'Ingen endringer ble gjort: ' . $e->getMessage()]; }
          break;
        case 'ask_user': $stop = ['status' => 'spørsmål', 'question' => (string)($in['question'] ?? ''), 'tid' => $b['id']]; break;
        case 'submit_for_approval': if ($stop) { $results[] = ['type' => 'tool_result', 'tool_use_id' => $b['id'], 'is_error' => true, 'content' => 'Vent på svaret før du sender til godkjenning.']; break; }
          $stop = ['status' => 'til godkjenning', 'summary' => (string)($in['summary'] ?? '')];
          $results[] = ['type' => 'tool_result', 'tool_use_id' => $b['id'], 'content' => 'Sendt til godkjenning.']; break;
        default: $results[] = ['type' => 'tool_result', 'tool_use_id' => $b['id'], 'is_error' => true, 'content' => 'Ukjent verktøy'];
      }
    }
    if ($stop && $stop['status'] === 'spørsmål') {
      if ($results) $msgs[] = ['role' => 'user', 'content' => $results]; // svaret på spørsmålet legges til her når det kommer
      unset($stop['tid']);
      plan_save_session($id, ['messages' => json_encode(plan_slim($msgs), JSON_UNESCAPED_UNICODE), 'draft' => json_encode($draft, JSON_UNESCAPED_UNICODE), 'status' => 'spørsmål', 'question' => $stop['question'], 'tokens_in' => $tin, 'tokens_out' => $tout]);
      return $stop;
    }
    if ($results) $msgs[] = ['role' => 'user', 'content' => $results];
    if ($stop || !$results) {
      $text = implode(' ', array_map(fn($b) => $b['text'] ?? '', array_filter($res['content'], fn($b) => ($b['type'] ?? '') === 'text')));
      $st = $stop ? 'til godkjenning' : 'svar'; // «svar» = agenten avslo eller forklarte uten å endre noe
      plan_save_session($id, ['messages' => json_encode(plan_slim($msgs), JSON_UNESCAPED_UNICODE), 'draft' => json_encode($draft, JSON_UNESCAPED_UNICODE), 'status' => $st, 'summary' => $stop['summary'] ?? trim($text), 'tokens_in' => $tin, 'tokens_out' => $tout]);
      return ['status' => $st, 'summary' => $stop['summary'] ?? trim($text)];
    }
  }
  plan_save_session($id, ['messages' => json_encode(plan_slim($msgs), JSON_UNESCAPED_UNICODE), 'draft' => json_encode($draft, JSON_UNESCAPED_UNICODE), 'status' => 'feil', 'info' => 'For mange runder uten å bli ferdig', 'tokens_in' => $tin, 'tokens_out' => $tout]);
  return ['status' => 'feil', 'info' => 'For mange runder'];
}
function plan_approve(int $id, string $by): array {
  $r = plan_session($id); if ($r['status'] !== 'til godkjenning') throw new Exception('Ikke klar til godkjenning');
  $v = plan_put($r['job_id'], $r['floor'], json_decode((string)$r['draft'], true), $by, (int)$r['base_version']);
  plan_save_session($id, ['status' => 'godkjent', 'info' => "Publisert som versjon $v av $by"]); return ['version' => $v];
}
// Fast jobb: fortsetter økter som gikk tom for tid.
function plan_continue(int $max = 2): array {
  plan_tables(); $s = db()->prepare("SELECT id FROM plan_session WHERE tenant_id=? AND status='venter' ORDER BY id LIMIT $max"); $s->execute([SV_TENANT]);
  $ids = $s->fetchAll(PDO::FETCH_COLUMN); foreach ($ids as $id) plan_step((int)$id, 25); return ['n' => count($ids)];
}
