// Search text is matched literally: "(", "+", "?" etc. in a name, phone or
// pasted text must not be read as a regular-expression operator (an invalid
// pattern made MongoDB reject the query -> 500).
function escapeRegex(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
