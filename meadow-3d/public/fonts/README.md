# UI fonts

The game serves Inter (Latin and Latin Extended) and Noto Sans Thai (Thai) locally as
variable WOFF2 fonts. Both support weights 100–900. Normal Thai/English screens load
about 75 KB of font data; Latin Extended loads only when needed.

Keep `Inter-OFL.txt` and `NotoSansThai-OFL.txt` with redistributed font files. Both
families use the SIL Open Font License 1.1. `sources.json` records the Google Fonts
download URLs and SHA-256 hashes of the unmodified files.

`src/fonts.css` owns the font faces and DOM stack. `src/fonts.ts` shares that stack
with canvas nameplates and loads both scripts before their first measurement.
