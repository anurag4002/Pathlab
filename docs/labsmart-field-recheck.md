# LabSmart field recheck

Checked against the four user-provided JSON files on 4 October 2026. All four imported copies are byte-for-byte identical to the originals.

Live catalog: 210 tests; 307 source fields; 4446 independently checked age/gender selections; 30 retained formula expressions; 0 remaining mismatches.

Corrections:
- Single-field labels now preserve the source field name, including PH and Urine for ELISA (Pregnency), separately from the catalog test name.
- AFB Sample Type is a specimen input; Positive/Negative is available on its Result field.
- Editable reports select the current patient age/gender range when reopened. Final reports retain their saved reference snapshot.
- Result units always come from the test setup, including tests with blank units. Client-provided units cannot overwrite them.
- The unit column has space for units without splitting them into individual letters. Input widths remain fixed.

Verification: 159 backend tests pass and the frontend builds. In an isolated UI database, all 307 source fields plus seven narrative document inputs render. HIV-1/HIV-2, HCV, HBsAg and AFB Result dropdowns were checked; AFB Sample Type accepted Sputum. Bilirubin 1.2 minus 0.4 produced 0.8; SGOT 40 / SGPT 20 produced 2; Hb 7, RBC 3.11 and Hct 20 produced MCV 64.3, MCH 22.5 and MCHC 35 locally. Hb input width/height remained 188.49 / 38 px before and after entry.

Source limitations: 145 field references are blank and two interpretation records have empty text. The files contain no formula expressions or explicit dropdown option definitions. Existing formulas and configured qualitative choices are retained. Original numeric limits, display text, spelling, units and age boundaries are preserved even where the supplied display text and numeric limits differ.

Recheck command (read-only): `node backend/scripts/recheckLabsmartFields.js --original=<source-directory>`

| Test | Field | Unit | Reference rows | Options | Formula |
|---|---|---|---:|---|---|
| Hemoglobin | Hemoglobin | g/dl | 4 |  |  |
| Total Leukocyte Count | Total Leukocyte Count | cumm | 4 |  |  |
| Differential Leucocyte Count | Neutrophils | % | 1 |  |  |
| Differential Leucocyte Count | Lymphocyte | % | 1 |  |  |
| Differential Leucocyte Count | Eosinophils | % | 1 |  |  |
| Differential Leucocyte Count | Monocytes | % | 1 |  |  |
| Differential Leucocyte Count | Basophils | % | 1 |  |  |
| Differential Leukocyte Count (Absolute count) | Neutrophils | x10^3/μL | 1 |  | fx |
| Differential Leukocyte Count (Absolute count) | Lymphocytes | x10^3/μL | 1 |  | fx |
| Differential Leukocyte Count (Absolute count) | Eosinophils | x10^3/μL | 1 |  | fx |
| Differential Leukocyte Count (Absolute count) | Monocytes | x10^3/μL | 1 |  | fx |
| Differential Leukocyte Count (Absolute count) | Basophils | x10^3/μL | 1 |  | fx |
| Erythrocyte sedimentation rate (Westergren) | Erythrocyte sedimentation rate (Westergren) | mm for 1st hour | 1 |  |  |
| Erythrocyte Sedimentation Rate (Wintrobe) | Erythrocyte Sedimentation Rate (Wintrobe) | mm for 1st hour | 2 |  |  |
| Platelet Count | Platelet Count | lakhs/cumm | 1 |  |  |
| Absolute Eosinophil Count | Absolute Eosinophil Count | cumm | 1 |  | fx |
| Blood Group & Rh. | ABO |  | 0 | A / B / AB / O |  |
| Blood Group & Rh. | Rh (ANTI -D) |  | 0 | Positive / Negative |  |
| Bleeding Time | Bleeding Time | min | 1 |  |  |
| Clotting Time | Clotting Time | min | 1 |  |  |
| Malaria Parasite (Card Test) | Plasmodium falciparum "Pf" |  | 0 | Negative / Positive |  |
| Malaria Parasite (Card Test) | Plasmodium vivax "Pv" |  | 0 | Negative / Positive |  |
| Malaria Parasite (Microscopic) | Malaria Parasite (Microscopic) |  | 0 | Negative / Positive |  |
| Filarial Parasite (Card Test) | Filarial Parasite (Card Test) |  | 0 | Negative / Positive |  |
| Total RBC Count | Total RBC Count | million/cumm | 2 |  |  |
| Hematocrit Value, Hct | Hematocrit Value, Hct | % | 2 |  |  |
| Mean Corpuscular Volume, MCV | Mean Corpuscular Volume, MCV | fL | 1 |  | fx |
| Mean Cell Haemoglobin, MCH | Mean Cell Haemoglobin, MCH | Pg | 1 |  | fx |
| Mean Cell Haemoglobin CON, MCHC | Mean Cell Haemoglobin CON, MCHC | g/dl | 1 |  | fx |
| Mean Platelet Volume, MPV | Mean Platelet Volume, MPV | fL | 1 |  |  |
| Reticulocyte Count | Reticulocyte Count | % | 2 |  |  |
| Glucose-6-phosphate dehydrogenase | Glucose-6-phosphate dehydrogenase | g | 1 |  |  |
| Prothrombin time, PT/INR | Patient Value | seconds | 1 |  |  |
| Prothrombin time, PT/INR | Control Value | seconds | 0 |  |  |
| Prothrombin time, PT/INR | ISI (International sensitivity index) |  | 0 |  |  |
| Prothrombin time, PT/INR | INR Value | % | 1 |  | fx |
| Activated partial thromboplastin time, APTT | Patient Value | seconds | 1 |  |  |
| Activated partial thromboplastin time, APTT | Control Value |  | 0 |  |  |
| WBC Count | WBC Count | mcL | 10 |  |  |
| P-LCR | P-LCR |  | 1 |  |  |
| R.D.W. - CV | R.D.W. - CV | % | 1 |  |  |
| P.D.W. | P.D.W. | fL | 1 |  |  |
| R.D.W. - SD | R.D.W. - SD | fL | 1 |  |  |
| Neutrophil Lymphocyte Ratio | Neutrophil Lymphocyte Ratio |  | 0 |  | fx |
| Lupus Anticoagulant (DRVVT) | Patient Value | seconds | 0 |  |  |
| Lupus Anticoagulant (DRVVT) | Control Value | seconds | 0 |  |  |
| Lupus Anticoagulant (DRVVT) | Screen Ratio |  | 0 |  |  |
| Lupus Anticoagulant (DRVVT) | DRVVT Screening |  | 0 |  |  |
| ADA , SERUM | ADA , SERUM | cumm | 0 |  |  |
| Widal Test (Slide Method) | Salmonella Typhi 'O' |  | 0 |  |  |
| Widal Test (Slide Method) | Salmonella Typhi 'H' |  | 0 |  |  |
| Widal Test (Slide Method) | Salmonella Typhi 'AH' |  | 0 |  |  |
| Widal Test (Slide Method) | Salmonella Typhi 'BH' |  | 0 |  |  |
| Malaria Antigen | IgG |  | 0 | Negative / Positive |  |
| Malaria Antigen | IgM |  | 0 | Negative / Positive |  |
| HIV (Card Test) | HIV - 1 |  | 0 | Negative / Positive |  |
| HIV (Card Test) | HIV - 2 |  | 0 | Negative / Positive |  |
| Hepatitis C Virus, HCV | Hepatitis C Virus, HCV |  | 0 | Negative / Positive |  |
| VDRL | VDRL |  | 0 | Non-reactive / Reactive |  |
| HBsAg | HBsAg |  | 0 | Negative / Positive |  |
| Occult Blood, Stool | Occult Blood, Stool |  | 0 | Absent / Present |  |
| Typhidot Antibodies | IgG |  | 0 | Negative / Positive |  |
| Typhidot Antibodies | IgM |  | 0 | Negative / Positive |  |
| Rubella | IgG | U/mL | 1 |  |  |
| Rubella | IgM | U/mL | 1 |  |  |
| Chikungunya | Chikungunya |  | 0 | Negative / Positive |  |
| Antistreptolysin O, ASO Titer | Antistreptolysin O, ASO Titer | IU/mL | 2 |  |  |
| Rheumatoid Factor, RA (Quantitative) | Rheumatoid Factor, RA (Quantitative) | IU/mL | 1 |  |  |
| Rheumatoid Factor, RA (Qualitative) | Rheumatoid Factor, RA (Qualitative) |  | 0 | Negative / Positive |  |
| C-Reactive Protein, CRP (Quantitative) | C-Reactive Protein, CRP (Quantitative) | mg/L | 1 |  |  |
| C-Reactive Protein, CRP (Qualitative) | C-Reactive Protein, CRP (Qualitative) |  | 0 | Negative / Positive |  |
| Dengue NS1 Antigen | Dengue NS1 Antigen |  | 0 | Negative / Positive |  |
| Dengue (Card Method) | NS1 Antigen |  | 0 | Negative / Positive |  |
| Dengue (Card Method) | IgM |  | 0 | Negative / Positive |  |
| Dengue (Card Method) | IgG |  | 0 | Negative / Positive |  |
| Beta Human Chorionic Gonodotropin (HCG) | Beta Human Chorionic Gonodotropin (HCG) | mIU/mL | 0 |  |  |
| Free PSA | Free PSA | ng/mL | 2 |  |  |
| IgA (Urine) | IgA (Urine) | μg/mL | 1 |  |  |
| Total PSA | Total PSA | ng/mL | 2 |  |  |
| Anti-HBc | Anti-HBc | index/mL | 1 |  |  |
| Anti-HBs | Anti-HBs | mIU/mL | 1 |  |  |
| Anti-HBe | Anti-HBe | index/mL | 1 |  |  |
| HBeAg | HBeAg | index/mL | 1 |  |  |
| Anti-HAV | Anti-HAV | mIU/mL | 1 |  |  |
| HAV IgM | HAV IgM | AU/mL | 1 |  |  |
| Anti Nuclear Antibody (ANA) by ELISA | Anti Nuclear Antibody (ANA) by ELISA | Units | 0 | Negative / Positive |  |
| Insulin Random | Insulin Random | µU/mL | 0 |  |  |
| Testosterone Free | Testosterone Free | pg/mL | 0 |  |  |
| Testosterone Total | Testosterone Total | ng/dl | 0 |  |  |
| Progesterone | Progesterone | ng/mL | 0 |  |  |
| Myoglobin | Myoglobin | ng/mL | 0 |  |  |
| Beta 2 Glycoprotein 1, IgG | Beta 2 Glycoprotein 1, IgG | SGU | 0 |  |  |
| Beta 2 Glycoprotein 1, IgM | Beta 2 Glycoprotein 1, IgM | SMU | 0 |  |  |
| Anti Phospholipid IgG | Anti Phospholipid IgG | GPL U/mL | 0 |  |  |
| Anti Phospholipid IgM | Anti Phospholipid IgM | MPL U/mL | 0 |  |  |
| Anti Cardiolipin IgG | Anti Cardiolipin IgG | GPL | 0 |  |  |
| Anti Cardiolipin IgM | Anti Cardiolipin IgM | MPL | 0 |  |  |
| WEIL FELIX TEST, SERUM | Proteus Antigen OX 19 | Titre | 0 |  |  |
| WEIL FELIX TEST, SERUM | Proteus Antigen OX 2 | Titre | 0 |  |  |
| WEIL FELIX TEST, SERUM | Proteus Antigen OX K | Titre | 0 |  |  |
| Dengue IgG | Dengue IgG |  | 0 | Negative / Positive |  |
| Dengue IgM | Dengue IgM |  | 0 | Negative / Positive |  |
| Dengue IgG & IgM | IgG |  | 0 | Negative / Positive |  |
| Dengue IgG & IgM | IgM |  | 0 | Negative / Positive |  |
| Urine for creatinine | Urine for creatinine |  | 0 |  |  |
| Urine for ELISA (Pregnancy) | Urine for ELISA (Pregnency) |  | 0 | Negative / Positive |  |
| Urine for Fungal | Urine for Fungal |  | 0 |  |  |
| Urine for Ketone | Urine for Ketone |  | 0 |  |  |
| Urine for Microalbumin | Urine for Microalbumin |  | 0 |  |  |
| Urine for Protein | Urine for Protein |  | 0 |  |  |
| Urine Pregnancy Test | Urine Pregnancy Test |  | 0 | Negative / Positive |  |
| Urine for AFB 24 hours | Urine for AFB 24 hours |  | 0 | Negative / Positive |  |
| Urine for Chyle | Urine for Chyle |  | 0 |  |  |
| Semen Examination | Quantity | ml | 1 |  |  |
| Semen Examination | Colour |  | 0 |  |  |
| Semen Examination | Ph |  | 0 |  |  |
| Semen Examination | Collection At |  | 0 |  |  |
| Semen Examination | Liquefaction Time | min | 0 |  |  |
| Semen Examination | Semen Fructose |  | 0 |  |  |
| Semen Examination | Total Sperm Count | million/cumm | 1 |  |  |
| Semen Examination | Rapid Progressive | % | 0 |  |  |
| Semen Examination | Sluggish Progressive | % | 0 |  |  |
| Semen Examination | Non Progressive | % | 0 |  |  |
| Semen Examination | Immotile | % | 0 |  |  |
| Semen Examination | Abnormal Forms | % | 0 |  |  |
| Semen Examination | Epithelial Cells | /HPF | 0 |  |  |
| Semen Examination | R.B.C. | /HPF | 0 |  |  |
| Semen Examination | Pus cell | /HPF | 0 |  |  |
| Urine Sugar Fasting | Urine Sugar Fasting |  | 0 |  |  |
| Stool Routine Examination | Colour |  | 0 |  |  |
| Stool Routine Examination | Consistency |  | 0 |  |  |
| Stool Routine Examination | Mucus |  | 0 |  |  |
| Stool Routine Examination | Blood |  | 0 |  |  |
| Stool Routine Examination | Occult Blood |  | 0 |  |  |
| Stool Routine Examination | Parasites |  | 0 |  |  |
| Stool Routine Examination | Undigested Food Particles |  | 0 |  |  |
| Stool Routine Examination | OVA |  | 0 |  |  |
| Stool Routine Examination | Cysts |  | 0 |  |  |
| Stool Routine Examination | Pus Cells | /HPF | 0 |  |  |
| Stool Routine Examination | Red Blood Cells | /HPF | 0 |  |  |
| Stool Routine Examination | Macrophages |  | 0 |  |  |
| Urine Sugar PP | Urine Sugar PP |  | 0 |  |  |
| Urine Sugar Random | Urine Sugar Random |  | 0 |  |  |
| Urine Routine Examination | Quantity | ml | 0 |  |  |
| Urine Routine Examination | Colour |  | 0 | Pale Yellow / Yellow / Dark Yellow / Colourless / Red |  |
| Urine Routine Examination | Transparency |  | 0 | Clear / Slightly turbid / Turbid |  |
| Urine Routine Examination | Specific Gravity |  | 1 |  |  |
| Urine Routine Examination | pH |  | 1 |  |  |
| Urine Routine Examination | Leukocytes |  | 0 | Absent / Present |  |
| Urine Routine Examination | Blood |  | 0 | Absent / Present |  |
| Urine Routine Examination | Protein / Albumin |  | 0 | Absent / Present |  |
| Urine Routine Examination | Sugar / Glucose |  | 0 | Absent / Present |  |
| Urine Routine Examination | Ketone Bodies |  | 0 | Absent / Present |  |
| Urine Routine Examination | Bilirubin |  | 0 | Absent / Present |  |
| Urine Routine Examination | Nitrite |  | 0 | Absent / Present |  |
| Urine Routine Examination | R.B.C. | /HPF | 0 | Absent / Present |  |
| Urine Routine Examination | Pus Cells | /HPF | 0 | Absent / Present |  |
| Urine Routine Examination | Epithilial Cells | /HPF | 0 | Absent / Present |  |
| Urine Routine Examination | Casts |  | 0 | Absent / Present |  |
| Urine Routine Examination | Crystals |  | 0 |  |  |
| Urine Routine Examination | Bacteria |  | 0 | Absent / Present |  |
| Urine Routine Examination | Others |  | 0 | Absent / Present |  |
| Fluid Examination | Sample Type |  | 0 |  |  |
| Fluid Examination | Coagulum |  | 0 |  |  |
| Fluid Examination | Volume | ml | 0 |  |  |
| Fluid Examination | Appearance |  | 0 |  |  |
| Fluid Examination | Colour |  | 0 |  |  |
| Fluid Examination | pH (Reaction) |  | 0 |  |  |
| Fluid Examination | Protein | mg% | 0 |  |  |
| Fluid Examination | Glucose | mg% | 0 |  |  |
| Fluid Examination | Total Leukocyte Count | cumm | 0 |  |  |
| Fluid Examination | Neutrophils | % | 0 |  |  |
| Fluid Examination | Lymphocyte | % | 0 |  |  |
| Fluid Examination | RBCs |  | 0 |  |  |
| Fluid Examination | Others |  | 0 |  |  |
| Urine Cotinine | Urine Cotinine |  | 0 |  |  |
| Urine Cortisol | Urine Cortisol | μg/24 hrs | 0 |  |  |
| Skin test for Leprosy | Skin test for Leprosy |  | 0 |  |  |
| Gram's Stain | Sample Type |  | 0 |  |  |
| Gram's Stain | Result |  | 0 |  |  |
| Acid - Fast Bacilli | Sample Type |  | 0 |  |  |
| Acid - Fast Bacilli | Result |  | 0 | Negative / Positive |  |
| Skin smear for AFB | Skin smear for AFB |  | 0 | Negative / Positive |  |
| Fungal scraping smear | Fungal scraping smear |  | 0 |  |  |
| Serum Triiodothyronine, T3 | Serum Triiodothyronine, T3 | ng/mL | 1 |  |  |
| Serum thyroxine, T4 | Serum thyroxine, T4 | ug/dL | 1 |  |  |
| Thyroid-Stimulating Hormone, TSH | Thyroid-Stimulating Hormone, TSH | µIU/mL | 1 |  |  |
| Free Triiodothyronine l, FT3 | Free Triiodothyronine l, FT3 | pg/mL | 1 |  |  |
| Free Thyroxine, FT4 | Free Thyroxine, FT4 | pg/mL | 1 |  |  |
| Alfa Fetoprotein, AFP | Alfa Fetoprotein, AFP | ng/mL | 1 |  |  |
| Prolactin | Prolactin | ng/mL | 2 |  |  |
| Luteinising Hormone, LH | Luteinising Hormone, LH | mIU/mL | 0 |  |  |
| Follicle Stimulating Hormone, FSH | Follicle Stimulating Hormone, FSH | mIU/mL | 0 |  |  |
| Folic Acid | Folic Acid | ng/mL | 0 |  |  |
| Serum Phosphorus | Serum Phosphorus | mg/dl | 2 |  |  |
| Serum Creatinine | Serum Creatinine | mg/dl | 2 |  |  |
| Serum Urea | Serum Urea | mg/dl | 7 |  |  |
| Fasting Blood Sugar | Fasting Blood Sugar | mg/dl | 4 |  |  |
| Blood Sugar PP | Blood Sugar PP | mg/dl | 1 |  |  |
| Serum Bilirubin (Total) | Serum Bilirubin (Total) | mg/dl | 2 |  |  |
| Serum Bilirubin (Direct) | Serum Bilirubin (Direct) | mg/dl | 1 |  |  |
| Serum Bilirubin (Indirect) | Serum Bilirubin (Indirect) | mg/dl | 1 |  | fx |
| Serum Uric Acid | Serum Uric Acid | mg/dl | 2 |  |  |
| SGPT (ALT) | SGPT (ALT) | U/I | 2 |  |  |
| SGOT (AST) | SGOT (AST) | U/I | 2 |  |  |
| Serum Protein | Serum Protein | g/dl | 4 |  |  |
| Serum Albumin | Serum Albumin | g/dl | 5 |  |  |
| Serum Alkaline Phosphatase | Serum Alkaline Phosphatase | U/I | 1 |  |  |
| Total Cholesterol | Total Cholesterol | mg/dl | 1 |  |  |
| Triglycerides | Triglycerides | mg/dl | 1 |  |  |
| HDL Cholesterol | HDL Cholesterol | mg/dl | 1 |  |  |
| LDL Cholesterol | LDL Cholesterol | mg/dl | 1 |  | fx |
| VLDL Cholesterol | VLDL Cholesterol | mg/dl | 1 |  | fx |
| LDL / HDL | LDL / HDL |  | 1 |  | fx |
| Total Cholesterol / HDL | Total Cholesterol / HDL |  | 1 |  | fx |
| TG / HDL | TG / HDL |  | 0 |  | fx |
| Total Lipid | Total Lipid | mg% | 1 |  |  |
| Serum Sodium | Serum Sodium | mmol/L | 1 |  |  |
| BUN | BUN | mg/dl | 1 |  | fx |
| BUN / Creatinine Ratio | BUN / Creatinine Ratio |  | 0 |  | fx |
| Urea / Creatinine Ratio | Urea / Creatinine Ratio |  | 0 |  | fx |
| Serum Potassium | Serum Potassium | mmol/L | 1 |  |  |
| iCalcium | iCalcium | mmol/l | 1 |  |  |
| Serum Calcium | Serum Calcium | mg/dl | 1 |  |  |
| Total Calcium | Total Calcium | mg/dl | 1 |  |  |
| Glucose Tolerance Test, GTT | Fasting | mg/dl | 1 |  |  |
| Glucose Tolerance Test, GTT | 1 Hour | mg/dl | 1 |  |  |
| Glucose Tolerance Test, GTT | 2 Hour | mg/dl | 1 |  |  |
| Glucose Tolerance Test, GTT | 3 Hour | mg/dl | 1 |  |  |
| Random Blood Sugar | Random Blood Sugar | mg/dl | 1 |  |  |
| Serum Chloride | Serum Chloride | mmol/l | 2 |  |  |
| Serum Amylase | Serum Amylase | IU/L | 1 |  |  |
| HbA1c (Glycosylated Hemoglobin) | HbA1c | % | 1 |  |  |
| HbA1c (Glycosylated Hemoglobin) | Estimated average glucose | mg/dL | 1 |  | fx |
| A/G Ratio | A/G Ratio |  | 1 |  | fx |
| Globulin | Globulin | g/dl | 1 |  | fx |
| Lipase | Lipase | U/I | 4 |  |  |
| Ferritin | Ferritin | ng/mL | 5 |  |  |
| Microalbumin Creatinine Ratio, Urine Random | Microalbuminuria | mg/L | 1 |  |  |
| Microalbumin Creatinine Ratio, Urine Random | Urinary creatinine | mg/dL | 1 |  |  |
| Microalbumin Creatinine Ratio, Urine Random | Urinary Albumin Creatinine Ratio (UACR) | mg/g | 1 |  | fx |
| CPK-MB | CPK-MB | ng/mL | 1 |  |  |
| Stool reducing substances | Stool reducing substances |  | 0 |  |  |
| 25 Hydroxy (OH) Vitamin D | 25 Hydroxy (OH) Vitamin D | ng/mL | 1 |  |  |
| Vitamin B12 | Vitamin B12 | pg/ml | 1 |  |  |
| Gamma Glutamyl Transferase, GGT | Gamma Glutamyl Transferase, GGT | IU/L | 1 |  |  |
| Serum IgE | Serum IgE | IU/mL | 1 |  |  |
| Serum IgG | Serum IgG | mg/mL | 1 |  |  |
| Serum IgM | Serum IgM | μg/mL | 1 |  |  |
| Serum IgA | Serum IgA | μg/mL | 1 |  |  |
| HSV-1/2 IgG | HSV-1/2 IgG | AU/mL | 1 |  |  |
| HSV-1/2 IgM | HSV-1/2 IgM | AU/mL | 1 |  |  |
| HSV-2 IgG | HSV-2 IgG | AU/mL | 1 |  |  |
| CMV IgG | CMV IgG | AU/mL | 1 |  |  |
| CMV IgM | CMV IgM | AU/mL | 1 |  |  |
| Rubella IgG | Rubella IgG | IU/mL | 1 |  |  |
| Rubella IgM | Rubella IgM | AU/mL | 1 |  |  |
| Anti TPO | Anti TPO | IU/mL | 1 |  |  |
| Thyroglobulin (TG) | Thyroglobulin (TG) | ng/mL | 1 |  |  |
| Thyroglobulin Antibody (TgAb) | Thyroglobulin Antibody (TgAb) | IU/mL | 1 |  |  |
| Toxo IgG | Toxo IgG | IU/mL | 1 |  |  |
| Toxo IgM | Toxo IgM | AU/mL | 1 |  |  |
| Estradiol | Estradiol | pg/mL | 0 |  |  |
| DHEA | DHEA | μg/dl | 0 |  |  |
| Troponin I | Troponin I | ng/mL | 1 |  |  |
| Creatine Kinase | Creatine Kinase | IU/L | 0 |  |  |
| CK-MB | CK-MB | ng/mL | 1 |  |  |
| D-Dimer | D-Dimer | μg FEU/mL | 1 |  |  |
| Calcitonin | Calcitonin | pg/mL | 1 |  |  |
| Indirect Coomb's Test | Indirect Coomb's Test |  | 0 | Negative / Positive |  |
| Direct Coomb's Test | Direct Coomb's Test |  | 0 | Negative / Positive |  |
| CA 125 | CA 125 | U/mL | 1 |  |  |
| CA 15-3 | CA 15-3 | U/mL | 1 |  |  |
| CA 19-9 | CA 19-9 | U/mL | 1 |  |  |
| CA 50 | CA 50 | U/mL | 1 |  |  |
| CA 242 | CA 242 | U/mL | 1 |  |  |
| CA 72-4 | CA 72-4 | U/mL | 1 |  |  |
| H-ALB | H-ALB | μg/mL | 1 |  |  |
| Anti cyclic-citrullinated-peptide | Anti cyclic-citrullinated-peptide | U/mL | 1 |  |  |
| Arterial Blood Gas | pH |  | 0 |  |  |
| Arterial Blood Gas | PCO2 | mmHg | 0 |  |  |
| Arterial Blood Gas | Bicarbonate (HCO3 | mEq/L | 0 |  |  |
| Arterial Blood Gas | Total CO2 Contents (TCO2) | mmol/L | 0 |  |  |
| Arterial Blood Gas | Standard Bicarbonate (SBC) | mEq/L | 0 |  |  |
| Arterial Blood Gas | Base Excess | mEq/L | 0 |  |  |
| Arterial Blood Gas | PO2 | mmHg | 0 |  |  |
| Arterial Blood Gas | Oxygen saturation capacity | % | 0 |  |  |
| Arterial Blood Gas | Base Excess - Extracellular fluid | mEq/L | 0 |  |  |
| Arterial Blood Gas | Hemoglobin | g/dl | 0 |  |  |
| Iron | Iron | μg/dl | 5 |  |  |
| Total Iron Binding Capacity (TIBC) | Total Iron Binding Capacity (TIBC) | μg/dl | 1 |  |  |
| Transferrin Saturation | Transferrin Saturation | % | 1 |  | fx |
| Non-HDL cholesterol | Non-HDL cholesterol |  | 0 |  | fx |
| UIBC | UIBC | μg/dl | 1 |  | fx |
| eGFR | eGFR | ml/min/1.73m^2 | 1 |  | fx |
| eGFR Category | eGFR Category |  | 0 |  | fx |
| C3 Complement | C3 Complement | mg/dL | 0 |  |  |
| High-Sensitivity C-Reactive Protein | High-Sensitivity C-Reactive Protein | mg/L | 0 |  |  |
| ANTI MULLERIAN HORMONE | ANTI MULLERIAN HORMONE | ng/mL | 0 |  |  |
| Ammonia | Ammonia | µmol/L | 1 |  |  |
| Magnesium | Magnesium | mg/dL | 1 |  |  |
| Glucose Tolerance Test, GTT (Pregnancy) | Fasting | mg/dL | 1 |  |  |
| Glucose Tolerance Test, GTT (Pregnancy) | 1 hour | mg/dL | 1 |  |  |
| Glucose Tolerance Test, GTT (Pregnancy) | 2 hour | mg/dL | 1 |  |  |
| Glucose Tolerance Test, GTT (Pregnancy) | 3 hour | mg/dL | 1 |  |  |
| SGOT/SGPT | SGOT/SGPT |  | 0 |  | fx |
| PH Inactive | PH |  | 0 |  |  |