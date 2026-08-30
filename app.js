/* ScriptKitty DEF CON Badge — catalog render + Web Serial flasher + serial monitor + spin widget.
   Flasher/serial logic ported from the design reference (esptool-js 0.4.1, vendored). */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  // --- state -----------------------------------------------------------------
  var fw = [];
  var selId = null;
  var selBuild = 0;
  var flashing = false;
  var flashLogText = '// flasher idle — pick a build, plug the Sheen in, hit CONNECT\n// tip: close other serial monitors first. one client per port.';
  var serText = '// serial monitor idle — plug a Sheen in and hit CONNECT';
  var serOn = false;
  var serPort = null, serReader = null, serReading = false;
  // firmwareId -> {tag, count} for the [guides] cross-link (filled from tutorials/tutorials.json)
  var guidesByFw = {};

  function sel() { for (var i = 0; i < fw.length; i++) if (fw[i].id === selId) return fw[i]; return null; }
  function curBuild() { var s = sel(); return (s && s.builds[selBuild]) || null; }

  // Integrity: SHA-256 of the fetched image, hex. Lets the flasher refuse a bin whose
  // bytes don't match the hash pinned in manifest.json — so a swapped/corrupted image
  // can't be written to hardware even if it was served from this origin.
  async function sha256hex(buf) {
    var dig = await crypto.subtle.digest('SHA-256', buf);
    var b = new Uint8Array(dig), h = '';
    for (var i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, '0');
    return h;
  }

  // --- terminals -------------------------------------------------------------
  function flog(l) {
    flashLogText = (flashLogText + '\n' + l).split('\n').slice(-300).join('\n');
    var el = $('flash-log'); el.textContent = flashLogText; el.scrollTop = el.scrollHeight;
  }
  function serAppend(t) {
    serText = (serText + t).slice(-24000);
    var el = $('ser-log'); el.textContent = serText; el.scrollTop = el.scrollHeight;
  }
  function slog(l) { serAppend('\n' + l); }
  function setProgress(pct) {
    var el = $('flash-progress');
    if (pct >= 0) {
      var n = Math.round(pct / 5);
      el.textContent = '[' + '█'.repeat(n) + '░'.repeat(20 - n) + '] ' + pct + '%';
    } else el.textContent = '';
  }
  function setFlashing(on) {
    flashing = on;
    $('btn-flash').disabled = on;
    $('btn-local').disabled = on;
    if (on) $('btn-flash').textContent = '[ FLASHING… ]';
    else { setProgress(-1); renderFlashPane(); }
  }

  // --- flash pane ------------------------------------------------------------
  function renderFlashPane() {
    var s = sel();
    $('fw-select').value = selId || '';
    $('fw-desc').textContent = s ? s.desc : 'loading catalog…';
    var note = $('fw-note');
    if (s && s.note) { note.textContent = s.note; note.style.display = 'block'; }
    else note.style.display = 'none';
    var hasBuilds = !!(s && s.builds.length);
    $('fw-builds').style.display = hasBuilds ? 'grid' : 'none';
    $('fw-nobuild').style.display = (s && !s.builds.length) ? 'block' : 'none';
    if (s && s.page) $('fw-page').href = s.page;
    // Context-aware primary button: flash a hosted image, or (when there's none) send
    // the user to the release page instead of erroring on an empty build list.
    var btn = $('btn-flash');
    if (hasBuilds) { btn.textContent = '[ CONNECT & FLASH ]'; btn.dataset.mode = 'flash'; }
    else { btn.textContent = '[ OPEN RELEASE PAGE ↗ ]'; btn.dataset.mode = 'page'; }
    var rows = $('fw-build-rows');
    rows.innerHTML = '';
    if (hasBuilds) {
      s.builds.forEach(function (b, i) {
        var row = document.createElement('div');
        row.className = 'build-row' + (i === selBuild ? ' sel' : '');
        var mark = document.createElement('span');
        mark.style.cssText = "font-family:'IBM Plex Mono',monospace; color:#00a35f; font-size:13px;";
        mark.textContent = i === selBuild ? '[x]' : '[ ]';
        var file = document.createElement('span');
        file.style.cssText = "font-family:'IBM Plex Mono',monospace; color:#14181b; font-size:13px; font-weight:600;";
        file.textContent = b.file;
        var label = document.createElement('span');
        label.style.cssText = 'color:#98a09a; font-size:12.5px;';
        label.textContent = b.label;
        row.appendChild(mark); row.appendChild(file); row.appendChild(label);
        row.addEventListener('click', function () { selBuild = i; renderFlashPane(); });
        rows.appendChild(row);
      });
    }
  }

  function pickFirmware(id) { selId = id; selBuild = 0; renderFlashPane(); }

  // --- catalog ---------------------------------------------------------------
  function renderCatalog() {
    var cat = $('catalog');
    cat.innerHTML = '';
    fw.forEach(function (f) {
      var row = document.createElement('div');
      row.className = 'cat-row';

      var tile = document.createElement('div');
      tile.style.cssText = 'width:56px; height:56px; background:#fff; border:1px solid #d5cfc0; border-radius:12px; display:flex; align-items:center; justify-content:center; overflow:hidden;';
      if (f.logo) {
        var img = document.createElement('div');
        img.setAttribute('role', 'img');
        img.setAttribute('aria-label', f.name + ' logo');
        img.style.cssText = 'width:38px; height:38px; background-image:url(\'' + f.logo + '\'); background-size:' +
          (f.logoCover ? 'cover' : 'contain') + '; background-position:' + (f.logoCover ? 'left center' : 'center') + '; background-repeat:no-repeat;';
        tile.appendChild(img);
      } else if (f.mark) {
        var mk = document.createElement('span');
        mk.style.cssText = "font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:15px; color:#00a35f;";
        mk.textContent = f.mark;
        tile.appendChild(mk);
      }

      var nameCol = document.createElement('div');
      var nm = document.createElement('div');
      nm.style.cssText = 'color:#14181b; font-weight:800; font-size:21px; letter-spacing:-0.5px;';
      nm.textContent = f.name;
      var vr = document.createElement('div');
      vr.style.cssText = "font-family:'IBM Plex Mono',monospace; color:#98a09a; font-size:12.5px; margin-top:6px;";
      vr.textContent = f.ver;
      nameCol.appendChild(nm); nameCol.appendChild(vr);

      var descCol = document.createElement('div');
      descCol.className = 'cat-desc';
      descCol.style.cssText = 'font-size:14.5px;';
      descCol.appendChild(document.createTextNode(f.desc));
      var bl = document.createElement('div');
      bl.style.cssText = "font-family:'IBM Plex Mono',monospace; color:#98a09a; font-size:12px; margin-top:8px;";
      bl.textContent = '└─ ' + f.buildsLine;
      descCol.appendChild(bl);

      var links = document.createElement('div');
      links.className = 'cat-links';
      links.style.cssText = "display:flex; flex-direction:column; gap:8px; align-items:flex-end; font-family:'IBM Plex Mono',monospace; font-size:13px; font-weight:600;";
      var lf = document.createElement('a');
      lf.href = '#flash'; lf.textContent = '[flash]';
      lf.addEventListener('click', function () { pickFirmware(f.id); });
      var ld = document.createElement('a');
      ld.href = f.docs; ld.target = '_blank'; ld.rel = 'noopener'; ld.className = 'link-dim'; ld.textContent = '[docs]';
      var ls = document.createElement('a');
      ls.href = f.src; ls.target = '_blank'; ls.rel = 'noopener'; ls.className = 'link-dim'; ls.textContent = '[src]';
      links.appendChild(lf); links.appendChild(ld); links.appendChild(ls);

      // cross-link to Tutorials when a guide is tagged to this firmware
      var g = guidesByFw[f.id];
      if (g) {
        var lg = document.createElement('a');
        lg.href = 'tutorials/?tag=' + g.tag;
        lg.className = 'link-guide';
        lg.textContent = g.count > 1 ? '[guides ' + g.count + ']' : '[guide]';
        links.appendChild(lg);
      }

      row.appendChild(tile); row.appendChild(nameCol); row.appendChild(descCol); row.appendChild(links);
      cat.appendChild(row);
    });
  }

  // Build firmwareId -> {tag,count} from the tutorials manifest so catalog rows can
  // link to their guides. Additive + fault-tolerant: never blocks the catalog render.
  function loadGuideLinks() {
    fetch('tutorials/tutorials.json').then(function (r) { return r.json(); }).then(function (data) {
      var tags = data.tags || {}, list = data.tutorials || [];
      Object.keys(tags).forEach(function (t) {
        var fwId = tags[t] && tags[t].firmware;
        if (!fwId) return;
        var n = list.filter(function (g) { return (g.tags || []).indexOf(t) !== -1; }).length;
        if (n) guidesByFw[fwId] = { tag: t, count: n };
      });
      if (fw.length) renderCatalog();
    }).catch(function () { /* tutorials optional — leave catalog as-is */ });
  }

  // --- authorization gate (transmit/attack-capable firmware) -----------------
  // Honest label + an "I own / am authorized" affirmation before flashing any
  // gate:true build (Wi-Fi deauth, BLE spoof, RF jam, LoRa TX). Resolves true only
  // on explicit confirmation.
  function showAuthGate(s) {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,12,14,0.82);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
      var box = document.createElement('div');
      box.style.cssText = "max-width:520px;width:100%;background:#fbf9f3;border:2px solid #00a35f;border-radius:14px;padding:22px 24px;font-family:'IBM Plex Mono',monospace;color:#14181b;box-shadow:0 20px 60px rgba(0,0,0,0.45);";
      var h = document.createElement('div');
      h.style.cssText = 'font-weight:800;font-size:18px;margin-bottom:10px;';
      h.textContent = '⚠ Authorization required';
      var sub = document.createElement('div');
      sub.style.cssText = 'font-size:13.5px;line-height:1.5;margin-bottom:10px;color:#333;';
      sub.textContent = s.name + ' is a transmit- and attack-capable tool. Flashing it lets the Sheen:';
      var ul = document.createElement('ul');
      ul.style.cssText = 'margin:0 0 12px 18px;font-size:13px;color:#8a1f1f;';
      (s.capabilities || []).forEach(function (c) { var li = document.createElement('li'); li.textContent = c; li.style.marginBottom = '3px'; ul.appendChild(li); });
      var warn = document.createElement('div');
      warn.style.cssText = 'font-size:13px;line-height:1.5;margin-bottom:16px;';
      warn.textContent = 'Only continue if you OWN or are explicitly AUTHORIZED to test the hardware, networks, and RF you will point it at. Transmitting against systems you do not own may be illegal.';
      var btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
      var cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      cancel.style.cssText = 'padding:9px 14px;border:1px solid #98a09a;background:#fff;border-radius:8px;font-family:inherit;font-weight:600;cursor:pointer;';
      var ok = document.createElement('button');
      ok.textContent = 'I own / am authorized — continue';
      ok.style.cssText = 'padding:9px 14px;border:1px solid #00a35f;background:#00a35f;color:#fff;border-radius:8px;font-family:inherit;font-weight:700;cursor:pointer;';
      function close(v) { try { document.body.removeChild(ov); } catch (_) {} resolve(v); }
      cancel.addEventListener('click', function () { close(false); });
      ok.addEventListener('click', function () { close(true); });
      ov.addEventListener('click', function (e) { if (e.target === ov) close(false); });
      btns.appendChild(cancel); btns.appendChild(ok);
      box.appendChild(h); box.appendChild(sub); box.appendChild(ul); box.appendChild(warn); box.appendChild(btns);
      ov.appendChild(box); document.body.appendChild(ov);
    });
  }

  // --- flasher (esptool-js 0.4.1) --------------------------------------------
  async function doFlash() {
    var b = curBuild();
    if (!b) { flog('!! no hosted build selected — use FLASH LOCAL .BIN with a downloaded image'); return; }
    if (flashing) return;
    var gs = sel();
    if (gs && gs.gate) {
      var authed = await showAuthGate(gs);
      if (!authed) { flog('!! flash cancelled — authorization not confirmed'); return; }
      flog('   authorization confirmed by user — proceeding');
    }
    if (!navigator.serial) { flog('!! Web Serial not available — use Chrome, Edge or recent Firefox over HTTPS'); return; }
    setFlashing(true); setProgress(-1);
    try {
      flog('$ fetch ' + b.file);
      var resp = await fetch(b.url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status + ' fetching image');
      var buf = new Uint8Array(await resp.arrayBuffer());
      if (b.sha256) {
        flog('$ verify sha256 ' + b.file);
        var got = await sha256hex(buf);
        if (got !== b.sha256.toLowerCase()) {
          throw new Error('integrity check FAILED — refusing to flash. expected ' + b.sha256.slice(0, 16) + '…, got ' + got.slice(0, 16) + '…');
        }
        flog('   ok — ' + got.slice(0, 16) + '… matches manifest');
      }
      await flashBytes(buf, b.file, b.addr || 0, !!b.erase);
    } catch (e) {
      flog('!! ' + e.message);
      if (/fetch|CORS|network/i.test(e.message + '')) flog('   (image fetch failed — check your connection, or download the .bin from the release page and use FLASH LOCAL .BIN)');
      setFlashing(false);
    }
  }

  async function flashLocal(ev) {
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file || flashing) return;
    if (!navigator.serial) { flog('!! Web Serial not available — use Chrome, Edge or recent Firefox over HTTPS'); return; }
    setFlashing(true); setProgress(-1);
    try {
      var buf = new Uint8Array(await file.arrayBuffer());
      await flashBytes(buf, file.name, 0, false);
    } catch (e) { flog('!! ' + e.message); setFlashing(false); }
  }

  async function flashBytes(buf, name, addr, erase) {
    var T = window.esptooljs;
    if (!T || !T.ESPLoader) throw new Error('esptool-js not loaded yet — retry in a moment');
    flog('   ' + (buf.length / 1048576).toFixed(2) + ' MB loaded');
    var binStr = '';
    for (var i = 0; i < buf.length; i += 32768) binStr += String.fromCharCode.apply(null, buf.subarray(i, Math.min(i + 32768, buf.length)));
    flog('$ requesting serial port… pick the Sheen in the browser dialog');
    var port = await navigator.serial.requestPort();
    var transport = new T.Transport(port, true);
    try {
      var term = { clean: function () {}, writeLine: function (l) { flog('   ' + l); }, write: function () {} };
      var loader = new T.ESPLoader({ transport: transport, baudrate: 460800, terminal: term });
      flog('$ esptool connect --baud 460800');
      var chip = await loader.main();
      flog('   detected: ' + chip);
      if (erase) flog('   erase-all first (clears any saved Wi-Fi / config)');
      flog('$ write-flash 0x' + addr.toString(16) + ' ' + name);
      await loader.writeFlash({
        fileArray: [{ data: binStr, address: addr }],
        flashSize: 'keep', flashMode: 'keep', flashFreq: 'keep', eraseAll: !!erase, compress: true,
        reportProgress: function (idx, written, total) { setProgress(Math.round(written / total * 100)); }
      });
      flog('   write complete — resetting');
      try {
        if (typeof loader.hardReset === 'function') await loader.hardReset();
        else if (transport.setRTS) { await transport.setRTS(true); await new Promise(function (r) { setTimeout(r, 100); }); await transport.setRTS(false); }
      } catch (_) { flog('   auto-reset skipped — unplug and replug the Sheen to boot'); }
      flog(':: done. unplug and replug the Sheen and it will boot. purr.');
    } finally {
      try { await transport.disconnect(); } catch (_) {}
      setFlashing(false);
    }
  }

  // --- serial monitor --------------------------------------------------------
  function setSerBtn() { $('btn-ser').textContent = serOn ? '[ DISCONNECT ]' : '[ CONNECT ]'; }

  async function serConnect() {
    if (!navigator.serial) { slog('!! Web Serial not available — use Chrome, Edge or recent Firefox'); return; }
    try {
      var port = await navigator.serial.requestPort();
      await port.open({ baudRate: parseInt($('ser-baud').value, 10) });
      serPort = port; serReading = true;
      serOn = true; setSerBtn();
      slog(':: connected @ ' + $('ser-baud').value + ' baud (DTR held steady — no download-mode trap)');
      var dec = new TextDecoder();
      while (port.readable && serReading) {
        var reader = port.readable.getReader(); serReader = reader;
        try {
          for (;;) {
            var r = await reader.read();
            if (r.done) break;
            if (r.value) serAppend(dec.decode(r.value, { stream: true }));
          }
        } catch (_) {} finally { reader.releaseLock(); }
      }
      serOn = false; setSerBtn();
    } catch (e) { slog('!! ' + e.message); serOn = false; setSerBtn(); }
  }

  async function serDisconnect() {
    serReading = false;
    try { if (serReader) await serReader.cancel(); } catch (_) {}
    try { if (serPort) await serPort.close(); } catch (_) {}
    serPort = null;
    serOn = false; setSerBtn(); slog(':: disconnected');
  }

  async function serSendLine() {
    var t = $('ser-in').value;
    if (!t) return;
    var p = serPort;
    if (!p || !p.writable) { slog('!! not connected'); return; }
    try {
      var w = p.writable.getWriter();
      await w.write(new TextEncoder().encode(t + '\n'));
      w.releaseLock();
      slog('> ' + t);
    } catch (e) { slog('!! ' + e.message); }
    $('ser-in').value = '';
  }

  // --- spin-the-badge widget -------------------------------------------------
  function startSpin() {
    var stage = $('spin-stage'), card = $('spin-card');
    if (!stage || !card) return;
    var ry = -22, rx = 10, vy = 0, drag = false, px = 0, py = 0;
    var idleT = performance.now();
    stage.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      drag = true; px = ev.clientX; py = ev.clientY; vy = 0; idleT = performance.now();
      stage.style.cursor = 'grabbing';
    });
    window.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var dx = ev.clientX - px, dy = ev.clientY - py;
      px = ev.clientX; py = ev.clientY;
      ry += dx * 0.45; rx = Math.max(-35, Math.min(35, rx - dy * 0.25));
      vy = dx * 0.45; idleT = performance.now();
    });
    window.addEventListener('pointerup', function () { drag = false; stage.style.cursor = 'grab'; });
    (function tick() {
      requestAnimationFrame(tick);
      if (!drag) {
        vy *= 0.95; ry += vy;
        if (performance.now() - idleT > 2500) { ry += 0.1; rx += (10 - rx) * 0.02; }
      }
      card.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
    })();
  }

  // --- chapter rail scrollspy ------------------------------------------------
  // Highlights the section you're currently reading: the last one whose top has
  // passed a line ~30% down the viewport. Always exactly one active, no gaps.
  function initChapters() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.chapters a[data-sec]'));
    if (!links.length) return;
    var secs = links.map(function (a) { return document.getElementById(a.getAttribute('data-sec')); }).filter(Boolean);
    function update() {
      var current;
      // at the very bottom of the page, the last section wins even if it never
      // reaches the line (there's no more content below it to scroll).
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = secs[secs.length - 1].id;
      } else {
        var line = window.innerHeight * 0.3;
        current = links[0].getAttribute('data-sec');
        secs.forEach(function (el) { if (el.getBoundingClientRect().top <= line) current = el.id; });
      }
      links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-sec') === current); });
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // --- boot ------------------------------------------------------------------
  function boot() {
    fetch('manifest.json').then(function (r) { return r.json(); }).then(function (m) {
      fw = m.firmware;
      selId = fw[0] && fw[0].id;
      selBuild = 0;
      var s = $('fw-select');
      s.innerHTML = '';
      fw.forEach(function (f) {
        var o = document.createElement('option');
        o.value = f.id; o.textContent = f.name + ' — ' + f.ver;
        s.appendChild(o);
      });
      renderFlashPane();
      renderCatalog();
    }).catch(function (e) { flog('!! failed to load manifest.json: ' + e.message); });

    $('fw-select').addEventListener('change', function (ev) { pickFirmware(ev.target.value); });
    $('btn-flash').addEventListener('click', function () {
      var s = sel();
      if (this.dataset.mode === 'page') {
        if (s && s.page) window.open(s.page, '_blank', 'noopener');
        return;
      }
      doFlash();
    });
    $('btn-local').addEventListener('click', function () { $('fw-file').click(); });
    $('fw-file').addEventListener('change', flashLocal);
    $('btn-ser').addEventListener('click', function () { serOn ? serDisconnect() : serConnect(); });
    $('btn-ser-clear').addEventListener('click', function () { serText = ''; $('ser-log').textContent = ''; });
    $('btn-ser-send').addEventListener('click', serSendLine);
    $('ser-in').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') serSendLine(); });
    startSpin();
    initChapters();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
