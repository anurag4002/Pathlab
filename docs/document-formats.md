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
