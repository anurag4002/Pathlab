# Report and bill formats

Administrators can open **Setup > Lab Profile > Edit profile** and use
**Report and bill formats** to create a copy, rename it, change its appearance,
and choose separate defaults for reports and bills. **Save changes** persists
the formats and defaults. Cancel restores the previously saved settings.

The initial format follows the supplied Pure Path Lab reference: A4 paper,
branded header and watermark, patient/barcode/date/QR band, outlined results
table, flags before the result value, interpretation notes, end marker,
actual report signatures, footer and page numbers. Invoices use the same
branding and patient band, with an item table and payment totals.

Format controls cover margins, header/footer height, font, body size, row
spacing, table appearance, flag placement, patient layout, accent color and
titles. Existing profile toggles control the sections included in the output.
Turn off reference branding to use the editable lab identity text. Custom
JPG/PNG uploads override the corresponding artwork; uploaded PDF reports
remain original documents and are not re-typeset as template artwork.

**Preview selected format as PDF** renders the current draft with clearly
marked sample data. It does not save settings or create a patient record.
The preview can also be downloaded. Subsequent report/invoice PDF downloads,
QR downloads and clinical print actions use the saved defaults. USG and
X-ray report previews use the same generated PDF as their print action.

The renderer repeats patient details and table headings on subsequent pages
and splits long rows and notes before the footer area. Reference artwork
contains no patient data or signature images. Signature images are loaded
from the report's recorded sign-offs.

Each standalone test or billed panel/package starts on a new page within
the same report PDF. Panel parameters stay together (for example, CBC),
and the relevant saved descriptions, interpretations, specimen/method
information, end marker and recorded signatures stay with that section.
Results that need more space can continue before the next report begins.

Interpretation headings and lists are formatted separately, and source line
wraps become compact paragraphs. The renderer measures each section together
with its end marker, disclaimer and signatures, choosing compact spacing and,
when needed, two columns of notes to keep results and guidance on one page.
Interpretation tables have a shaded header, padded cells, a complete grid and
balanced column widths. Each interpretation table stays together. Notes must
fit on a results page: they cannot create extra report pages. If complete text
cannot fit at 7.5 points or larger, the PDF endpoint returns an actionable 422
error asking the lab to shorten the saved guidance or disable interpretations,
rather than silently dropping clinical text.

Import bookkeeping such as `Migrated from Labsmart (9/9 tests linked)` and
input types such as `Numeric` are excluded from clinical descriptions.
KFT uses its editable database panel/package description, including the
supplied reference's creatinine explanation and paired increased/decreased
causes. `node backend/scripts/updateKftReportGuidance.js --apply` seeds this
content only into empty/import-placeholder KFT descriptions, backing up the
old records first. Its versioned source is `kft-guidance.json`; report rendering
does not hardcode the text or overwrite clinical edits.
This script also clears migration bookkeeping from other panel/package
descriptions where the source provides no clinical panel description.
Unedited imported test guidance is not repeated beneath a KFT panel with a
clinical description;
lab-edited test interpretations remain additional notes. Standalone tests
continue to print their full saved interpretations.

CBC uses the user's concise **Possible causes of abnormal parameters** table
once, in place of long imported explanations for each CBC measurement.
`node backend/scripts/updateCbcReportGuidance.js --apply` stores the provided
guidance in the editable descriptions of CBC panels/packages and backs up
previous descriptions. Its versioned source is `cbc-guidance.json`. Edit the
CBC panel description to change this guidance. Individual test guidance stays
in the catalogue and appears when that test is reported separately.
Repeated text is deduplicated ignoring case and whitespace differences.

The catalog importer reads names/categories/fees from `labsmart_tests_parsed`,
field links/units from `labsmart_fields`, and exact day/sex bands and text
references from `labsmart_ranges_parsed`. It obtains clinical text from
`labsmart_testinterp_formatted.json`, which preserves the original HTML's
table columns as tab-delimited rows. The original cleaned export is retained.
`prepareLabsmartInterpretations.py` can regenerate the formatted text from
the user's `labsmart_edits_parsed.json`. Imported input types stay in
`sourceType`, not in clinical descriptions; genuine physiological descriptions
are extracted when present. Missing source content stays blank. Importing
backs up catalog records and retains clinical edits and existing formulas.

Both result-entry screens show a live differential-count total after the
five percentage fields. A complete total of 100% is shown in green; missing
values or an incorrect total are indicated without changing entered results.
Absolute differential counts are excluded from this percentage summary.

Validation:

```text
cd backend
node --test tests/documentTemplates.test.js tests/formattedPdf.test.js
node tests/renderDocumentFixtures.js
```

The fixture command writes three sample PDFs to `tmp/pdfs` for visual review.
These generated files are ignored by Git. Frontend validation uses
`npm run build --prefix frontend` from the repository root.

The permanent default is stored in
`backend/src/assets/document-formats/pure-path-reference.json`, alongside its
header, watermark and invoice/report footer artwork. Vercel includes this
directory in the production function. Missing temporary uploads fall back to
the bundled artwork automatically, so deployment needs no manual re-upload.
