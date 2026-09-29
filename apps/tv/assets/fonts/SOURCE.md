# Noto Serif Armenian — static fonts

Copyright 2022 The Noto Project Authors (https://github.com/notofonts/armenian).
Licensed under SIL Open Font License 1.1; the complete, unchanged license is in
`OFL.txt`, and the release's attribution list is in `AUTHORS.txt`.

Official project: https://github.com/notofonts/armenian

Exact release archive:
https://github.com/notofonts/armenian/releases/download/NotoSerifArmenian-v2.008/NotoSerifArmenian-v2.008.zip

Files copied unchanged from the archive:

- `NotoSerifArmenian/googlefonts/ttf/NotoSerifArmenian-Regular.ttf`
- `NotoSerifArmenian/googlefonts/ttf/NotoSerifArmenian-Bold.ttf`
- `OFL.txt` and `AUTHORS.txt`

These are the full-coverage **static** TTFs distributed by the official Armenian
project, not fonts downloaded from the Google Fonts API. No variable font,
subsetting, conversion, renaming of the font family, or modification is involved.
The smaller `unhinted/ttf` files lack U+0301/U+0304 and are deliberately not used.

License review: OFL 1.1 permits embedding and redistribution with software. Keep
this attribution and OFL with redistributed assets; do not sell the fonts alone.
The font remains under OFL; the app need not adopt OFL. No modified font is shipped.

SHA-256:

| File | Hash |
| --- | --- |
| Regular | `2c489e2ed0cd0fe7a302e5e04cab452633afe77a51e96a4592eb2ef533300cf3` |
| Bold | `e7e59b075ee1cb526fe570491325c60574878b18756e83bff784bccc653de043` |
| OFL.txt | `0468358b316f69f405b55cadf8a8314e16e3610b8feaad96772bd5d968112d02` |

`npm run check:fonts` validates the font hashes, absence of an `fvar` table,
and nonzero cmap glyph coverage for the Grabar/punctuation/combining-mark sample.
Visual shaping still needs platform QA; glyph coverage alone does not prove it.

`license.json` contains the exact OFL text for the in-app attribution sheet so
license attribution also ships inside native and web bundles. The font guard
checks that this copy matches `OFL.txt`.
