/* Community BINs flasher — flashes UNTESTED community-submitted factory images.
   Same esptool-js flow as the main flasher, plus a hard "untested" gate on every
   flash and SHA-256 verification of the fetched bytes. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var images = [], selId = null, flashing = false;
  var logText = '// community flasher idle — pick an image (or your own .bin), plug the Sheen in, hit CONNECT\n// these images are UNTESTED and UNVERIFIED. read the banner above.';

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function sel() { for (var i = 0; i < images.length; i++) if (images[i].id === selId) return images[i]; return null; }
  function log(l) {
    logText = (logText + '\n' + l).split('\n').slice(-300).join('\n');
    var el = $('c-log'); el.textContent = logText; el.scrollTop = el.scrollHeight;
  }
  function setProgress(p) {
    var el = $('c-progress');
    if (p >= 0) { var n = Math.round(p / 5); el.textContent = '[' + '█'.repeat(n) + '░'.repeat(20 - n) + '] ' + p + '%'; }
    else el.textContent = '';
  }
  function setFlashing(on) {
    flashing = on;
    $('c-flash').disabled = on; $('c-local').disabled = on;
    if (on) $('c-flash').textContent = '[ FLASHING… ]';
    else { setProgress(-1); renderPane(); }
  }

  async function sha256hex(buf) {
    var dig = await crypto.subtle.digest('SHA-256', buf);
    var b = new Uint8Array(dig), h = '';
    for (var i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, '0');
    return h;
  }

  function renderPane() {
    var s = sel();
    $('c-select').value = selId || '';
    var box = $('c-desc'); box.innerHTML = '';
    if (s) {
      var d = document.createElement('div'); d.textContent = s.desc; box.appendChild(d);
      var meta = document.createElement('div'); meta.className = 'c-meta';
      meta.appendChild(document.createTextNode('by ' + (s.author || 'anonymous') + ' · '));
      var a = document.createElement('a'); a.href = s.source; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'source ↗';
      meta.appendChild(a);
      if (s.submitted) meta.appendChild(document.createTextNode(' · submitted ' + s.submitted));
      box.appendChild(meta);
      $('c-flash').textContent = '[ CONNECT & FLASH ]';
      $('c-flash').disabled = false;
    } else {
      box.textContent = images.length
        ? 'select an image above'
        : 'No community images yet — be the first (see "Submit an image" below). You can still flash your own .bin with FLASH LOCAL .BIN.';
      $('c-flash').textContent = '[ CONNECT & FLASH ]';
      $('c-flash').disabled = true;
    }
  }

  // Hard gate shown before EVERY community flash — these images are untested.
  function showGate(name) {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,12,14,0.82);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
      var box = document.createElement('div');
      box.style.cssText = "max-width:540px;width:100%;background:#fbf9f3;border:2px solid #d6008f;border-radius:14px;padding:22px 24px;font-family:'IBM Plex Mono',monospace;color:#14181b;box-shadow:0 20px 60px rgba(0,0,0,0.45);";
      var h = document.createElement('div'); h.style.cssText = 'font-weight:800;font-size:18px;margin-bottom:10px;color:#d6008f;'; h.textContent = '⚠ Untested community image';
      var p = document.createElement('div'); p.style.cssText = 'font-size:13.5px;line-height:1.55;margin-bottom:16px;';
      p.innerHTML = "You're about to flash <strong>" + esc(name) + "</strong> — a community-submitted image that <strong>Retia has NOT tested or verified</strong>. It may not boot, may misbehave, or may need manual recovery (hold BOOT while plugging in USB). Continue only if you own this Sheen and accept that risk.";
      var btns = document.createElement('div'); btns.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
      var cancel = document.createElement('button'); cancel.textContent = 'Cancel';
      cancel.style.cssText = 'padding:9px 14px;border:1px solid #98a09a;background:#fff;border-radius:8px;font-family:inherit;font-weight:600;cursor:pointer;';
      var ok = document.createElement('button'); ok.textContent = 'I understand — flash it';
      ok.style.cssText = 'padding:9px 14px;border:1px solid #d6008f;background:#d6008f;color:#fff;border-radius:8px;font-family:inherit;font-weight:700;cursor:pointer;';
      function close(v) { try { document.body.removeChild(ov); } catch (_) {} resolve(v); }
      cancel.addEventListener('click', function () { close(false); });
      ok.addEventListener('click', function () { close(true); });
      ov.addEventListener('click', function (e) { if (e.target === ov) close(false); });
      btns.appendChild(cancel); btns.appendChild(ok);
      box.appendChild(h); box.appendChild(p); box.appendChild(btns);
      ov.appendChild(box); document.body.appendChild(ov);
    });
  }

  async function doFlash() {
    var s = sel();
    if (!s) { log('!! no image selected — use FLASH LOCAL .BIN with your own file'); return; }
    if (flashing) return;
    if (!navigator.serial) { log('!! Web Serial not available — use Chrome, Edge, or recent Firefox over HTTPS'); return; }
    var ok = await showGate(s.name);
    if (!ok) { log('!! flash cancelled'); return; }
    setFlashing(true); setProgress(-1);
    try {
      log('$ fetch ' + s.file);
      var resp = await fetch(s.url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status + ' fetching image');
      var buf = new Uint8Array(await resp.arrayBuffer());
      if (s.sha256) {
        log('$ verify sha256 ' + s.file);
        var got = await sha256hex(buf);
        if (got !== s.sha256.toLowerCase()) throw new Error('integrity check FAILED — refusing to flash. expected ' + s.sha256.slice(0, 16) + '…, got ' + got.slice(0, 16) + '…');
        log('   ok — ' + got.slice(0, 16) + '… matches community.json');
      }
      await flashBytes(buf, s.file, s.addr || 0);
    } catch (e) { log('!! ' + e.message); setFlashing(false); }
  }

  async function flashLocal(ev) {
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file || flashing) return;
    if (!navigator.serial) { log('!! Web Serial not available — use Chrome, Edge, or recent Firefox over HTTPS'); return; }
    var ok = await showGate(file.name + ' (your local file)');
    if (!ok) { log('!! flash cancelled'); return; }
    setFlashing(true); setProgress(-1);
    try { var buf = new Uint8Array(await file.arrayBuffer()); await flashBytes(buf, file.name, 0); }
    catch (e) { log('!! ' + e.message); setFlashing(false); }
  }

  async function flashBytes(buf, name, addr) {
    var T = window.esptooljs;
    if (!T || !T.ESPLoader) throw new Error('esptool-js not loaded yet — retry in a moment');
    log('   ' + (buf.length / 1048576).toFixed(2) + ' MB loaded');
    var binStr = '';
    for (var i = 0; i < buf.length; i += 32768) binStr += String.fromCharCode.apply(null, buf.subarray(i, Math.min(i + 32768, buf.length)));
    log('$ requesting serial port… pick the Sheen in the browser dialog');
    var port = await navigator.serial.requestPort();
    var transport = new T.Transport(port, true);
    try {
      var term = { clean: function () {}, writeLine: function (l) { log('   ' + l); }, write: function () {} };
      var loader = new T.ESPLoader({ transport: transport, baudrate: 460800, terminal: term });
      log('$ esptool connect --baud 460800');
      var chip = await loader.main();
      log('   detected: ' + chip);
      log('$ write-flash 0x' + addr.toString(16) + ' ' + name);
      await loader.writeFlash({
        fileArray: [{ data: binStr, address: addr }],
        flashSize: 'keep', flashMode: 'keep', flashFreq: 'keep', eraseAll: false, compress: true,
        reportProgress: function (idx, written, total) { setProgress(Math.round(written / total * 100)); }
      });
      log('   write complete — resetting');
      try {
        if (typeof loader.hardReset === 'function') await loader.hardReset();
        else if (transport.setRTS) { await transport.setRTS(true); await new Promise(function (r) { setTimeout(r, 100); }); await transport.setRTS(false); }
      } catch (_) { log('   auto-reset skipped — unplug and replug the Sheen to boot'); }
      log(':: done. if the screen is dark or it misbehaves, this untested image may not fit the badge — recover by holding BOOT while plugging in, then flash an official build from the main list.');
    } finally {
      try { await transport.disconnect(); } catch (_) {}
      setFlashing(false);
    }
  }

  function boot() {
    fetch('community.json').then(function (r) { return r.json(); }).then(function (m) {
      images = m.images || [];
      selId = images[0] && images[0].id;
      var s = $('c-select'); s.innerHTML = '';
      if (!images.length) { var o = document.createElement('option'); o.value = ''; o.textContent = '— no community images yet —'; s.appendChild(o); }
      images.forEach(function (im) {
        var o = document.createElement('option'); o.value = im.id;
        o.textContent = im.name + (im.author ? ' — ' + im.author : '');
        s.appendChild(o);
      });
      renderPane();
    }).catch(function (e) { log('!! failed to load community.json: ' + e.message); });

    $('c-select').addEventListener('change', function (ev) { selId = ev.target.value; renderPane(); });
    $('c-flash').addEventListener('click', doFlash);
    $('c-local').addEventListener('click', function () { $('c-file').click(); });
    $('c-file').addEventListener('change', flashLocal);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
