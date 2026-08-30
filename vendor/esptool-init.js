// Exposes the vendored esptool-js classes on window for the classic-script flasher.
// Externalized from an inline <script> so the page's CSP can use script-src 'self'
// (no 'unsafe-inline'). Import is relative to THIS file (vendor/), hence './'.
import { ESPLoader, Transport } from "./esptool-bundle.js";
window.esptooljs = { ESPLoader, Transport };
