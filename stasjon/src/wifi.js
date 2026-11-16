'use strict';
// Navnet på wifi-nettet PC-en er koblet til (SSID), eller null. Brukes til å starte opplastingen av seg selv
// når stasjonen kommer hjem til et kjent nett. Fungerer på macOS, Windows og Linux uten ekstra pakker.
const { execFile } = require('child_process');

function run(cmd, args) {
  return new Promise(res => execFile(cmd, args, { timeout: 4000 }, (err, out) => res(err ? '' : String(out))));
}

async function currentSsid() {
  if (process.platform === 'darwin') {
    // nyere macOS: ipconfig getsummary, eldre: networksetup
    let out = await run('ipconfig', ['getsummary', 'en0']);
    let m = /^\s*SSID\s*:\s*(.+)$/m.exec(out);
    if (!m) { out = await run('networksetup', ['-getairportnetwork', 'en0']); m = /Network:\s*(.+)$/m.exec(out); }
    return m ? m[1].trim() : null;
  }
  if (process.platform === 'win32') {
    const out = await run('netsh', ['wlan', 'show', 'interfaces']);
    const m = /^\s*SSID\s*:\s*(.+)$/m.exec(out);
    return m ? m[1].trim() : null;
  }
  const out = await run('iwgetid', ['-r']);
  return out.trim() || null;
}

module.exports = { currentSsid };
