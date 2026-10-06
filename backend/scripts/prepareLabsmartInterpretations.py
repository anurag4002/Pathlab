"""Preserve table columns from the user's original test-edit export.

Usage: python prepareLabsmartInterpretations.py path/to/labsmart_edits_parsed.json
Only the clinical interpretation/method is saved; no patient data is imported.
"""
import html
import json
import pathlib
import re
import sys


def plain(value):
    value = re.sub(r'<br\s*/?>', '\n', value, flags=re.I)
    value = re.sub(r'</(?:p|div|li)\s*>', '\n', value, flags=re.I)
    value = re.sub(r'<[^>]+>', '', value)
    return html.unescape(value).replace('\xa0', ' ')


def clean(value):
    def table(match):
        rows = []
        for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', match[0], flags=re.I | re.S):
            cells = re.findall(r'<t[dh]\b[^>]*>(.*?)</t[dh]>', row, flags=re.I | re.S)
            if cells:
                rows.append('\t'.join(re.sub(r'\s+', ' ', plain(cell)).strip() for cell in cells))
        return '\n\n' + '\n'.join(rows) + '\n\n'
    value = re.sub(r'<table\b[^>]*>.*?</table>', table, value, flags=re.I | re.S)
    # Tabs are intentional column delimiters, preserved by the PDF renderer.
    return '\n'.join(re.sub(r' +', ' ', line).strip(' ') for line in plain(value).splitlines()).strip()


source = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf8'))
output = {}
for source_id, record in source.items():
    if record.get('interpretation'):
        output[source_id] = {'name': record['name'], 'text': clean(record['interpretation']), 'method': record.get('method', '')}
destination = pathlib.Path(__file__).resolve().parent.parent / 'data/labsmart/labsmart_testinterp_formatted.json'
destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(f'Saved {len(output)} clinical interpretations, {sum(chr(9) in r["text"] for r in output.values())} with tables: {destination}')
