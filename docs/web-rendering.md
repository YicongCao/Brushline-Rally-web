# Web rendering parity

The page targets physical pixels (including Retina), capped at 1920 × 1080.
Small windows use their actual physical pixels, without forced upscaling.
The root canvas expands its logical layout to the window aspect ratio, while
the driving HUD retains a centered safe area so its gauges cannot overlap.
The offscreen showcase/garage follows that budget instead of imposing a second
720p ceiling. Keep the logical UI canvas at 1280 × 720: it controls layout, not
3D framebuffer resolution.

`web-shell/index.html` receives two-second wall-frame samples from WebPlatform.
Resolution stays at native pixels up to the cap even under sustained load.
The tested CPU/draw-call-bound scene did not gain meaningful fps from lowering
resolution; avoid blurring small windows to hide that bottleneck. Shared Web
settings now apply low-detail scenery and disable lens flare in actual races,
showcases, settings reset and menus, rather than only the menu's settings object.
Explicit saved user preferences still take precedence. This is not a promise
of 60 fps on every device.
Use `?render_stats=1` on a versioned `/play/<build>/` URL to show actual render
size, fps and p95. Its bounded history stays in the canvas DOM; nothing is sent
to a server, and no graphics setting is persisted in the player's save.

## Color contract

Godot 4.7.2 Compatibility's scene shader converts ALBEDO and EMISSION from sRGB
to linear after `fragment()`. Forward+ accepts linear values there. The old
port handed both renderers the same procedural linear constants/vertex colors;
Compatibility decoded them again. Conversely, source_color uniforms/textures
arrive in different spaces before pigment mixing.

`render_color.gdshaderinc` bridges those boundaries. Keep pigment arithmetic
linear, decode source_color inputs on Compatibility, and encode final outputs
there. Do not gamma-convert masks, road-zone COLOR channels, normals or alpha.
Forward+ helpers are identities. LIGHT_COLOR and the ALBEDO received by light()
are already linear; only source_color uniforms used there need the input helper.

Compatibility also tone-maps a shadow-casting directional light in a separate
additive pass. It cannot exactly match Forward+'s HDR light accumulation. Web
sun gains are calibrated against fixed native captures: autumn .70, coast .40,
desert .50; unshadowed highland dusk stays unchanged. This avoids blown highlights
without raising exposure or whitening shadows. The sky uses a 64px incremental
reflection cubemap; the visible sky remains full-resolution.

## Reproduce

- `node scripts/web/check-shell.mjs`: Retina/1080p limits, clarity under sustained load,
  background exclusion, loader progress and HTTP template integration.
- `npm run web:check`: host/range/isolation/rollback tests.
- `godot --path . --rendering-method gl_compatibility --script res://scripts/dev/web_render_probe.gd`
- Repeat with `--rendering-method forward_plus`; images are in
  `logs/web-render-reference/`. Four fixed stages at 1920 × 1080, isolated profile.
- Export, run Chrome at 1920 × 1080, play the showcase and actually drive. Check
  console errors and the optional stats; native measurements are not WebGL fps.

The independent desktop repository is not changed by this port.
