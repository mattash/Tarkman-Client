# Tarkman design trial foundation

This framework-free package supplies candidate semantic color data and generated CSS for application trials. It has no runtime dependencies and contains no React, DOM, React Native, navigation, or icon code.

`tokens.json` is the source. Regenerate `web.css` with `npm run build --prefix packages/tarkman-design` and verify it with `npm run check --prefix packages/tarkman-design`. The check fails if `web.css` is stale or if any paired foreground/background token falls below its contrast target (4.5:1 for text, 3:1 for control borders and focus). CI runs it on every pull request. The API and values remain provisional while the application trial is reviewed.
