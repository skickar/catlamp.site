# Cat lamp for catlamp.site

This is a photo-inspired model, with proportions estimated from the supplied photographs. The upper shell is not a dimensionally accurate scan. The base uses the supplied BasicBase-v4.STL unchanged except for centering, orientation, and uniform unit conversion. Its diameter is approximately 90 mm and its height 16.598 mm. The cable and surrounding objects are omitted.

## Add to your website

Upload this entire folder as `/cat-lamp/` on your host, then add:

```html
<iframe
  src="/cat-lamp/index.html?embed=1"
  title="Rotating color-changing cat lamp"
  style="width:100%;height:650px;border:0;background:transparent"
  loading="lazy">
</iframe>
```

The model rotates once every 48 seconds and smoothly cycles colors every 72 seconds. Drag to turn; scroll or pinch to zoom. Buttons pause rotation and hold the current color. Reduced-motion preferences start both animations paused. Render work pauses when the page is hidden. The viewer needs WebGL. To preview the unzipped download, open cat-lamp/index.html in your browser. Its rendering code is bundled inline, so it needs no local server. For embedding on your website, upload the folder as described above.

All runtime dependencies are included; there are no CDN requests. The Three.js license is included in vendor/THREE-LICENSE.txt.

## Files

- `BasicBase-v4.STL`: original supplied base.
- `base-data.js`: original STL bytes embedded for offline viewing.
- `cat-lamp.glb`: self-contained glTF 2.0 asset with 43,358 triangles, four materials, and a 48-second rotation clip. In another viewer, enable and loop the animation clip. GLB uses meters. The supplied STL is interpreted as millimeters.
- `model.js`: editable mesh construction, silhouette, materials, and face.
- `viewer.js`: lighting, rotation, color cycle, and camera controls.
- `index.html`: standalone viewer with all rendering code bundled inline; also the embeddable page.

For source edits, rebuild the inline bundle with scripts/bundle-viewer.mjs from the full project source.

Color animation is implemented in viewer.js because standard glTF does not universally support animated material colors. The GLB includes a warm emissive material; color cycling is provided by the included viewer. It does not bake the halo or light pool into the asset.

Change `/48` and `/72` in viewer.js to adjust rotation and color-cycle durations. Edit the `palette` array for custom colors. Remove `?embed=1` to show the title and download link.

Validation: GLB header and declared length, finite geometry, front-face ray intersection, mesh/material/animation counts, JavaScript syntax, and site production build. The rounded revision was visually checked from front, side, rear, and top in the browser; rotation, color cycling, and pause controls were checked. Its body depth is 95% of its width, based on the reference photos. Direct file opening could not be tested because the testing browser blocks file URLs.

Latest revision: broad circular lower skirt seats around the CAD base, fuller lower body, and rounded ears. Use the included HTML to see this revision; the previously hosted preview may still show the older model.

Final detail: a small raised dark push button is modeled at the front of the base. It is a visual model detail; the viewer controls remain below the lamp.
