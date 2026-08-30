# newsheen.site

Getting-started + in-browser flasher for the **Newsheen** — the ESP32-S3 "Pusheen puck"
(`esp32_base_puck_v2`) that lives inside Retia's translucent silicone cat lamp.

Static site, no build step, served from the repo root via GitHub Pages. Sibling to
[catbadge.online](https://catbadge.online).

## What's here

- `index.html` — the whole page (getting started, flasher, serial monitor, firmware catalog, hardware).
- `app.js` — catalog render + Web Serial flasher (esptool-js 0.4.1, vendored) + serial monitor.
  Verifies each image's SHA-256 against the manifest before writing, and gates transmit/attack-capable
  builds behind an authorization affirmation.
- `manifest.json` — the firmware catalog. Every hosted build pins a `sha256` and is served
  same-origin from `firmware/` (browsers CORS-block raw GitHub fetches).
- `firmware/` — the `.bin` images, mirrored from [scriptkitty.sh](https://scriptkitty.sh).
- `vendor/` — self-hosted fonts + the vendored esptool bundle (no runtime CDN; strict CSP).

## Firmware

Ten builds for the puck: WLEDkitty, Newsheen Radio (+ offline atlas), Meshtastic, MeshCore
(Bluetooth + USB), Reticulum RNode, and three dual-use tools — Motoko, Bit Pirate, and the
Bad Nugget BadUSB — which are labeled by capability and require an authorization confirmation
before flashing. Sources live under [github.com/RetiaLLC](https://github.com/RetiaLLC).

## Updating firmware

Re-mirror from scriptkitty.sh and refresh the pinned hashes:

```bash
# for each id: curl https://scriptkitty.sh/firmware/<id>.bin -o firmware/<id>.bin
# then recompute sha256 and update manifest.json
git add firmware manifest.json && git commit -m "refresh firmware" && git push
```

Pages rebuilds in ~30–60 s.
