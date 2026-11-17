// Names start with a capital letter: "rahul kumar" -> "Rahul Kumar".
// Only the first letter of each word is changed; the rest stays as typed.
export default function capitalizeName(value) {
  return String(value || '').replace(/(^|[\s.'-])(\p{L})/gu, (_, before, letter) => before + letter.toUpperCase());
}
