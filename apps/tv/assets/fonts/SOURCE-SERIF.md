# Source Serif 4 — static fonts

Copyright 2014–2023 Adobe. Licensed under SIL Open Font License 1.1; the
complete license distributed with Adobe's release is in
SourceSerif-LICENSE.md.

Official release:
https://github.com/adobe-fonts/source-serif/releases/tag/4.005R

Files copied unchanged from source-serif-4.005_Desktop.zip, under TTF/:

- SourceSerif4-Regular.ttf
- SourceSerif4-Semibold.ttf

These are static desktop TTFs. The app does not subset, convert, rename, or
synthesize weights from them. They are used for non-Armenian reading text and
reading titles; Armenian continues to use the separately pinned Noto Serif
Armenian assets.

SHA-256:

| File | Hash |
| --- | --- |
| Regular | e5a4ee6a3d87bb9024796be390c6771e2a0eb1883dae25effaf57ca01668e24b |
| Semibold | 36db62940cb5728b12b1802476dc7fcf4c6c519a7bdd476ba23a4e555fc4655f |

npm run check:fonts validates these exact hashes and static tables. Runtime
shaping and optical comparison still require native visual review.
