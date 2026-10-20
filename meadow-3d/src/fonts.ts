/** Keep canvas nameplates on the same Latin/Thai pair as the DOM. */
export const UI_FONT_FAMILY = '"Inter", "Noto Sans Thai", sans-serif';

export async function loadUIFonts() {
 if (typeof document === 'undefined' || !document.fonts) return;
 // Canvas textures keep their first paint; load both scripts before measuring names.
 // A failed font download falls back to the browser instead of preventing play.
 await Promise.allSettled([
  document.fonts.load('600 22px Inter', 'The Beginning Online 0123456789'),
  document.fonts.load('600 22px "Noto Sans Thai"', 'ผู้กล้าแห่งนคร'),
 ]);
}
