<?php
// Innstillinger portalen trenger i nettleseren (bare for innloggede). Google-nøkkelen skal begrenses til studiovest.no i Google Cloud.
require __DIR__ . '/lib.php';
require_user();
json_out(['ok' => true, 'gmaps' => (string)cfg('GOOGLE_MAPS_KEY', '')]);
