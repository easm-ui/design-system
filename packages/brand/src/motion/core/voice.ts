// The rhythm of the EASM voice: three real spoken phrases (the brand voice, "Chief of Staff"), turned into a loudness
// envelope at 60 samples/s and quantised to one base-36 character per sample (7.15 s loop, 429 bytes).
// Used when an animation should speak but has no audio to follow (demos, previews, a waveform's "voice" mode).

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const LOOP =
  '06gkuzzxvtromnooonmkjnnmquuutroljhfiouvvsqnpstsrqqqqqqqqppponlkkkkkkjihkmnnnnnnmlkigfffeeddddcccba987655433322222211' +
  '000000000000000000000000004antxyzzzzzzyxvuuwwvusqomljiiihgfdba9776544332222111111110000002clpsssrpnljikrvxyyxvtsqomki' +
  'gilllllkjhgedgjjiihfehijjlmmmmmmlkkjjjiihghhhhgfeecb987600000000000000000000000000000000004bfjopppqtuusqomkmmllkkkkmo' +
  'pponklsuwyzzzxvtqnmmoqssromkjhedba000000000000000000000000000000000000000000000';

export const VOICE_FPS = 60;
const ENV = /* @__PURE__ */ Array.from(LOOP, ch => DIGITS.indexOf(ch) / 35);
export const VOICE_LOOP_SECONDS = ENV.length / VOICE_FPS;

/** The EASM voice's loudness (0–1) at time t, looping; linear between samples. */
export function voiceAt(t: number): number {
  const n = ENV.length;
  let f = (t * VOICE_FPS) % n;
  if (f < 0) f += n;
  const i = Math.floor(f), k = f - i;
  return ENV[i] * (1 - k) + ENV[(i + 1) % n] * k;
}
