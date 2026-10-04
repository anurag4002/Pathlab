# Test calculation and reference-range audit

Audited all 210 tests in the existing database. Configured 22 standalone formulas and 8 calculated parameters (30 calculated values). The other tests require measured values, qualitative results or documents. The setup expands 11 existing multi-parameter tests and adds 44 qualitative dropdowns. It preserves existing ranges, charges and custom formulas.

Age and sex bands exist for 25 tests: 82 source bands, verified with 134 age/sex selections. Every test and individual parameter supports these bands in both Test Database and Normal Range Management. Tests without bands retain their existing default reference; new clinical intervals have not been invented. The report selects the matching band, including day/month/year ages, and saves that range with the result for PDF output. A missing band displays "No reference range configured for this age / sex" and does not apply the adult numeric limits. For example, the existing bilirubin bands cover 0–3 days and 12 months–100 years; the intervening ages need a lab-supplied range.

Formula inputs appear automatically when required, including unbilled dependencies. Calculated values update synchronously in the frontend while typing, with no calculation requests. The browser and backend share the same restricted formula runtime. The backend independently recomputes results only on draft save and submission. Missing inputs, division by zero, triglycerides ≥400 mg/dL for Friedewald LDL, and inappropriate age/sex for adult CKD-EPI are reported as calculation errors rather than producing numbers. eGFR category is a G1–G5 filtration category, not a diagnosis.

The Normal Ranges popup supports multiple Any/Male/Female bands with separate day/month/year boundaries and optional critical limits. The input grid uses fixed column widths and 38-pixel controls; measured and calculated values keep the same dimensions when flags change or inputs are cleared.

## Calculation definitions

| Test / parameter | Formula | Output unit |
| --- | --- | --- |
| A/G Ratio (A_G_RATIO) | ROUND([SERUM_ALBUMIN] / ([SERUM_PROTEIN] - [SERUM_ALBUMIN]), 2) |  |
| Absolute Eosinophil Count (AEC) | ROUND([TLC] * [DLC_EOSINOPHILS] / 100, 0) | cumm |
| BUN (BUN) | ROUND([SERUM_UREA] / 2.14, 2) | mg/dl |
| BUN / Creatinine Ratio (BUN_CREATININE_RATIO) | ROUND([BUN] / [SERUM_CREATININE], 2) |  |
| Differential Leukocyte Count (Absolute count) (DIFFERENTIAL_LEUKOCY_NEUTROPHILS) | ROUND([TLC] * [DLC_NEUTROPHILS] / 100000, 3) | x10^3/μL |
| Differential Leukocyte Count (Absolute count) (DIFFERENTIAL_LEUKOCY_LYMPHOCYTES) | ROUND([TLC] * [DLC_LYMPHOCYTE] / 100000, 3) | x10^3/μL |
| Differential Leukocyte Count (Absolute count) (DIFFERENTIAL_LEUKOCY_EOSINOPHILS) | ROUND([TLC] * [DLC_EOSINOPHILS] / 100000, 3) | x10^3/μL |
| Differential Leukocyte Count (Absolute count) (DIFFERENTIAL_LEUKOCY_MONOCYTES) | ROUND([TLC] * [DLC_MONOCYTES] / 100000, 3) | x10^3/μL |
| Differential Leukocyte Count (Absolute count) (DIFFERENTIAL_LEUKOCY_BASOPHILS) | ROUND([TLC] * [DLC_BASOPHILS] / 100000, 3) | x10^3/μL |
| Globulin (GLOBULIN) | ROUND([SERUM_PROTEIN] - [SERUM_ALBUMIN], 2) | g/dl |
| HbA1c (Glycosylated Hemoglobin) (HBA1C_GLYCOSYLATED_H_ESTIMATED_AVERAGE_GLUCOSE) | ROUND(28.7 * [HBA1C_GLYCOSYLATED_H_HBA1C] - 46.7, 2) | mg/dL |
| LDL / HDL (LDL_HDL) | ROUND([LDL_CHOLESTEROL] / [HDL_CHOLESTEROL], 2) |  |
| LDL Cholesterol (LDL_CHOLESTEROL) | ROUND(FRIEDEWALD_LDL([TOTAL_CHOLESTEROL], [HDL_CHOLESTEROL], [TRIGLYCERIDES]), 2) | mg/dl |
| Mean Cell Haemoglobin CON, MCHC (MCHC) | ROUND([HB] * 100 / [HCT], 1) | g/dl |
| Mean Cell Haemoglobin, MCH (MCH) | ROUND([HB] * 10 / [TOTAL_RBC_COUNT], 1) | Pg |
| Mean Corpuscular Volume, MCV (MCV) | ROUND([HCT] * 10 / [TOTAL_RBC_COUNT], 1) | fL |
| Microalbumin Creatinine Ratio, Urine Random (MICROALBUMIN_CREATIN_URINARY_ALBUMIN_CREATININE_RATIO_UACR) | ROUND([MICROALBUMIN_CREATIN_MICROALBUMINURIA] * 100 / [MICROALBUMIN_CREATIN_URINARY_CREATININE], 2) | mg/g |
| Neutrophil Lymphocyte Ratio (NLR) | ROUND([DLC_NEUTROPHILS] / [DLC_LYMPHOCYTE], 2) |  |
| Non-HDL cholesterol (NON_HDL_CHOLESTEROL) | ROUND([TOTAL_CHOLESTEROL] - [HDL_CHOLESTEROL], 2) | mg/dl |
| Prothrombin time, PT/INR (PT_INR_INR_VALUE) | ROUND(INR([PT_INR_PATIENT_VALUE], [PT_INR_CONTROL_PT], [PT_INR_ISI]), 2) | ratio |
| SGOT/SGPT (SGOT_SGPT) | ROUND([SGOT] / [SGPT], 2) |  |
| Serum Bilirubin (Indirect) (SERUM_BILIRUBIN_INDI) | ROUND([SERUM_BILIRUBIN_TOTA] - [SERUM_BILIRUBIN_DIRE], 2) | mg/dl |
| TG / HDL (TG_HDL) | ROUND([TRIGLYCERIDES] / [HDL_CHOLESTEROL], 2) |  |
| Total Cholesterol / HDL (TOTAL_CHOLESTEROL_HD) | ROUND([TOTAL_CHOLESTEROL] / [HDL_CHOLESTEROL], 2) |  |
| Transferrin Saturation (TRANSFERRIN_SATURATI) | ROUND([IRON] * 100 / [TOTAL_IRON_BINDING_C], 2) | % |
| UIBC (UIBC) | ROUND([TOTAL_IRON_BINDING_C] - [IRON], 2) | μg/dl |
| Urea / Creatinine Ratio (UREA_CREATININE_RATI) | ROUND([SERUM_UREA] / [SERUM_CREATININE], 2) |  |
| VLDL Cholesterol (VLDL_CHOLESTEROL) | ROUND([TRIGLYCERIDES] / 5, 2) | mg/dl |
| eGFR (EGFR) | ROUND(CKD_EPI_2021([SERUM_CREATININE]), 2) | ml/min/1.73m^2 |
| eGFR Category (EGFR_CATEGORY) | GFR_CATEGORY([EGFR]) |  |

## Formula references

- [Red cell indices — Clinical Methods](https://www.ncbi.nlm.nih.gov/books/NBK260/)
- [CKD-EPI 2021 and adult eGFR — NIDDK](https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/glomerular-filtration-rate-equations/adults)
- [Lipid measurements and Friedewald limits — EAS/EFLM consensus](https://pmc.ncbi.nlm.nih.gov/articles/PMC4929379/)
- [HbA1c and estimated average glucose — NGSP](https://ngsp.org/MF2009.asp)
- [Urine albumin-creatinine ratio — NIDDK](https://www.niddk.nih.gov/-/media/Files/Health-Information/Health-Professionals/Kidney-Disease/UACRQuickReferenceSheet.pdf)

Reference intervals come exclusively from the existing lab database. No new age intervals were invented.

## All catalog tests

| Code | Test | Handling | Existing age/sex bands |
| --- | --- | --- | --- |
| VITAMIN_D3 | 25 Hydroxy (OH) Vitamin D | Measured / entered / document | 0 |
| A_G_RATIO | A/G Ratio | Calculated / includes calculated parameters | 0 |
| ADA | ADA , SERUM | Measured / entered / document | 0 |
| AMH | ANTI MULLERIAN HORMONE | Measured / entered / document | 0 |
| AEC | Absolute Eosinophil Count | Calculated / includes calculated parameters | 0 |
| AFB | Acid - Fast Bacilli | Measured / entered / document | 0 |
| APTT | Activated partial thromboplastin time, APTT | Measured / entered / document | 0 |
| AFP | Alfa Fetoprotein, AFP | Measured / entered / document | 0 |
| AMMONIA | Ammonia | Measured / entered / document | 0 |
| ANTI_CARDIOLIPIN_IGG | Anti Cardiolipin IgG | Measured / entered / document | 0 |
| ANTI_CARDIOLIPIN_IGM | Anti Cardiolipin IgM | Measured / entered / document | 0 |
| ANTI_NUCLEAR_ANTIBOD | Anti Nuclear Antibody (ANA) by ELISA | Measured / entered / document | 0 |
| ANTI_PHOSPHOLIPID_IG | Anti Phospholipid IgG | Measured / entered / document | 0 |
| ANTI_PHOSPHOLIPID_IG_2 | Anti Phospholipid IgM | Measured / entered / document | 0 |
| ANTI_TPO | Anti TPO | Measured / entered / document | 0 |
| CCP | Anti cyclic-citrullinated-peptide | Measured / entered / document | 0 |
| ANTI_HAV | Anti-HAV | Measured / entered / document | 0 |
| ANTI_HBC | Anti-HBc | Measured / entered / document | 0 |
| ANTI_HBE | Anti-HBe | Measured / entered / document | 0 |
| ANTI_HBS | Anti-HBs | Measured / entered / document | 0 |
| ASO_TITER | Antistreptolysin O, ASO Titer | Measured / entered / document | 2 |
| ABG | Arterial Blood Gas | Measured / entered / document | 0 |
| BUN | BUN | Calculated / includes calculated parameters | 0 |
| BUN_CREATININE_RATIO | BUN / Creatinine Ratio | Calculated / includes calculated parameters | 0 |
| BETA_2_GLYCOPROTEIN_ | Beta 2 Glycoprotein 1, IgG | Measured / entered / document | 0 |
| BETA_2_GLYCOPROTEIN__2 | Beta 2 Glycoprotein 1, IgM | Measured / entered / document | 0 |
| BETA_HCG | Beta Human Chorionic Gonodotropin (HCG) | Measured / entered / document | 0 |
| BT | Bleeding Time | Measured / entered / document | 0 |
| BLOOD_GROUP_RH | Blood Group & Rh. | Measured / entered / document | 0 |
| BLOOD_SUGAR_PP | Blood Sugar PP | Measured / entered / document | 0 |
| CRP_QUALITATIVE | C-Reactive Protein, CRP (Qualitative) | Measured / entered / document | 0 |
| CRP_QUANTITATIVE | C-Reactive Protein, CRP (Quantitative) | Measured / entered / document | 0 |
| C3 | C3 Complement | Measured / entered / document | 0 |
| CA_125 | CA 125 | Measured / entered / document | 0 |
| CA_15_3 | CA 15-3 | Measured / entered / document | 0 |
| CA_19_9 | CA 19-9 | Measured / entered / document | 0 |
| CA_242 | CA 242 | Measured / entered / document | 0 |
| CA_50 | CA 50 | Measured / entered / document | 0 |
| CA_72_4 | CA 72-4 | Measured / entered / document | 0 |
| CK_MB | CK-MB | Measured / entered / document | 0 |
| CMV_IGG | CMV IgG | Measured / entered / document | 0 |
| CMV_IGM | CMV IgM | Measured / entered / document | 0 |
| CPK_MB | CPK-MB | Measured / entered / document | 0 |
| CALCITONIN | Calcitonin | Measured / entered / document | 0 |
| CHIKUNGUNYA | Chikungunya | Measured / entered / document | 0 |
| CT | Clotting Time | Measured / entered / document | 0 |
| CPK_TOTAL | Creatine Kinase | Measured / entered / document | 0 |
| CULTURE_AND_SENSITIV | Culture and Sensitivity | Measured / entered / document | 0 |
| D_DIMER | D-Dimer | Measured / entered / document | 0 |
| DHEA | DHEA | Measured / entered / document | 0 |
| DENGUE_CARD_METHOD | Dengue (Card Method) | Measured / entered / document | 0 |
| DENGUE_IGG | Dengue IgG | Measured / entered / document | 0 |
| DENGUE_IGG_IGM | Dengue IgG & IgM | Measured / entered / document | 0 |
| DENGUE_IGM | Dengue IgM | Measured / entered / document | 0 |
| DENGUE_NS1_ANTIGEN | Dengue NS1 Antigen | Measured / entered / document | 0 |
| DLC | Differential Leucocyte Count | Measured / entered / document | 0 |
| DIFFERENTIAL_LEUKOCY | Differential Leukocyte Count (Absolute count) | Calculated / includes calculated parameters | 0 |
| DIRECT_COOMB_S_TEST | Direct Coomb's Test | Measured / entered / document | 0 |
| ESR_WINTROBE | Erythrocyte Sedimentation Rate (Wintrobe) | Measured / entered / document | 2 |
| ESR_WESTERGREN | Erythrocyte sedimentation rate (Westergren) | Measured / entered / document | 0 |
| ESTRADIOL | Estradiol | Measured / entered / document | 0 |
| FNAC_FINE_NEEDLE_ASP | FNAC (Fine Needle Aspiration) | Measured / entered / document | 0 |
| FASTING_BLOOD_SUGAR | Fasting Blood Sugar | Measured / entered / document | 4 |
| FERRITIN | Ferritin | Measured / entered / document | 5 |
| MF | Filarial Parasite (Card Test) | Measured / entered / document | 0 |
| FLUID_EXAMINATION | Fluid Examination | Measured / entered / document | 0 |
| FOLIC_ACID | Folic Acid | Measured / entered / document | 0 |
| FSH | Follicle Stimulating Hormone, FSH | Measured / entered / document | 0 |
| FREE_PSA | Free PSA | Measured / entered / document | 2 |
| FT4 | Free Thyroxine, FT4 | Measured / entered / document | 0 |
| FT3 | Free Triiodothyronine l, FT3 | Measured / entered / document | 0 |
| FUNGAL_SCRAPING_SMEA | Fungal scraping smear | Measured / entered / document | 0 |
| GGT | Gamma Glutamyl Transferase, GGT | Measured / entered / document | 0 |
| GLOBULIN | Globulin | Calculated / includes calculated parameters | 0 |
| GTT | Glucose Tolerance Test, GTT | Measured / entered / document | 0 |
| GLUCOSE_TOLERANCE_TE | Glucose Tolerance Test, GTT (Pregnancy) | Measured / entered / document | 0 |
| G6PD | Glucose-6-phosphate dehydrogenase | Measured / entered / document | 0 |
| GRAM_S_STAIN | Gram's Stain | Measured / entered / document | 0 |
| H_ALB | H-ALB | Measured / entered / document | 0 |
| HAV_IGM | HAV IgM | Measured / entered / document | 0 |
| HBEAG | HBeAg | Measured / entered / document | 0 |
| HBSAG | HBsAg | Measured / entered / document | 0 |
| HDL_CHOLESTEROL | HDL Cholesterol | Measured / entered / document | 0 |
| HIV_CARD_TEST | HIV (Card Test) | Measured / entered / document | 0 |
| HSV_1_2_IGG | HSV-1/2 IgG | Measured / entered / document | 0 |
| HSV_1_2_IGM | HSV-1/2 IgM | Measured / entered / document | 0 |
| HSV_2_IGG | HSV-2 IgG | Measured / entered / document | 0 |
| HBA1C_GLYCOSYLATED_H | HbA1c (Glycosylated Hemoglobin) | Calculated / includes calculated parameters | 0 |
| HCT | Hematocrit Value, Hct | Measured / entered / document | 2 |
| HB | Hemoglobin | Measured / entered / document | 4 |
| HCV | Hepatitis C Virus, HCV | Measured / entered / document | 0 |
| HSCRP | High-Sensitivity C-Reactive Protein | Measured / entered / document | 0 |
| IGA_URINE | IgA (Urine) | Measured / entered / document | 0 |
| INDIRECT_COOMB_S_TES | Indirect Coomb's Test | Measured / entered / document | 0 |
| INSULIN_RANDOM | Insulin Random | Measured / entered / document | 0 |
| IRON | Iron | Measured / entered / document | 5 |
| LDL_HDL | LDL / HDL | Calculated / includes calculated parameters | 0 |
| LDL_CHOLESTEROL | LDL Cholesterol | Calculated / includes calculated parameters | 0 |
| LIPASE | Lipase | Measured / entered / document | 4 |
| LUPUS_ANTICOAGULANT_ | Lupus Anticoagulant (DRVVT) | Measured / entered / document | 0 |
| LH | Luteinising Hormone, LH | Measured / entered / document | 0 |
| MAGNESIUM | Magnesium | Measured / entered / document | 0 |
| MALARIA_ANTIGEN | Malaria Antigen | Measured / entered / document | 0 |
| MP_CARD_TEST | Malaria Parasite (Card Test) | Measured / entered / document | 0 |
| MP_MICROSCOPIC | Malaria Parasite (Microscopic) | Measured / entered / document | 0 |
| MANTOUX_TEST | Mantoux test | Measured / entered / document | 0 |
| MCHC | Mean Cell Haemoglobin CON, MCHC | Calculated / includes calculated parameters | 0 |
| MCH | Mean Cell Haemoglobin, MCH | Calculated / includes calculated parameters | 0 |
| MCV | Mean Corpuscular Volume, MCV | Calculated / includes calculated parameters | 0 |
| MPV | Mean Platelet Volume, MPV | Measured / entered / document | 0 |
| MICROALBUMIN_CREATIN | Microalbumin Creatinine Ratio, Urine Random | Calculated / includes calculated parameters | 0 |
| MYOGLOBIN | Myoglobin | Measured / entered / document | 0 |
| NLR | Neutrophil Lymphocyte Ratio | Calculated / includes calculated parameters | 0 |
| NON_HDL_CHOLESTEROL | Non-HDL cholesterol | Calculated / includes calculated parameters | 0 |
| OCCULT_BLOOD_STOOL | Occult Blood, Stool | Measured / entered / document | 0 |
| P_LCR | P-LCR | Measured / entered / document | 0 |
| P_D_W | P.D.W. | Measured / entered / document | 0 |
| PAP_SMEAR | PAP Smear | Measured / entered / document | 0 |
| PH | PH Inactive | Measured / entered / document | 0 |
| PBS_GBP | Peripheral Blood Smear | Measured / entered / document | 0 |
| PLATELET_COUNT | Platelet Count | Measured / entered / document | 0 |
| PROGESTERONE | Progesterone | Measured / entered / document | 0 |
| PRL | Prolactin | Measured / entered / document | 2 |
| PT_INR | Prothrombin time, PT/INR | Calculated / includes calculated parameters | 0 |
| R_D_W_CV | R.D.W. - CV | Measured / entered / document | 0 |
| R_D_W_SD | R.D.W. - SD | Measured / entered / document | 0 |
| RANDOM_BLOOD_SUGAR | Random Blood Sugar | Measured / entered / document | 0 |
| RETICULOCYTE_COUNT | Reticulocyte Count | Measured / entered / document | 2 |
| RA_QUALITATIVE | Rheumatoid Factor, RA (Qualitative) | Measured / entered / document | 0 |
| RA_QUANTITATIVE | Rheumatoid Factor, RA (Quantitative) | Measured / entered / document | 0 |
| RUBELLA | Rubella | Measured / entered / document | 0 |
| RUBELLA_IGG | Rubella IgG | Measured / entered / document | 0 |
| RUBELLA_IGM | Rubella IgM | Measured / entered / document | 0 |
| SGOT | SGOT (AST) | Measured / entered / document | 2 |
| SGOT_SGPT | SGOT/SGPT | Calculated / includes calculated parameters | 0 |
| SGPT | SGPT (ALT) | Measured / entered / document | 2 |
| SEMEN_EXAMINATION | Semen Examination | Measured / entered / document | 0 |
| SERUM_ALBUMIN | Serum Albumin | Measured / entered / document | 5 |
| SERUM_ALKALINE_PHOSP | Serum Alkaline Phosphatase | Measured / entered / document | 0 |
| SERUM_AMYLASE | Serum Amylase | Measured / entered / document | 0 |
| SERUM_BILIRUBIN_DIRE | Serum Bilirubin (Direct) | Measured / entered / document | 0 |
| SERUM_BILIRUBIN_INDI | Serum Bilirubin (Indirect) | Calculated / includes calculated parameters | 0 |
| SERUM_BILIRUBIN_TOTA | Serum Bilirubin (Total) | Measured / entered / document | 2 |
| SERUM_CALCIUM | Serum Calcium | Measured / entered / document | 0 |
| SERUM_CHLORIDE | Serum Chloride | Measured / entered / document | 2 |
| SERUM_CREATININE | Serum Creatinine | Measured / entered / document | 2 |
| SERUM_IGA | Serum IgA | Measured / entered / document | 0 |
| SERUM_IGE | Serum IgE | Measured / entered / document | 0 |
| SERUM_IGG | Serum IgG | Measured / entered / document | 0 |
| SERUM_IGM | Serum IgM | Measured / entered / document | 0 |
| SERUM_PHOSPHORUS | Serum Phosphorus | Measured / entered / document | 2 |
| SERUM_POTASSIUM | Serum Potassium | Measured / entered / document | 0 |
| SERUM_PROTEIN | Serum Protein | Measured / entered / document | 4 |
| SERUM_SODIUM | Serum Sodium | Measured / entered / document | 0 |
| T3 | Serum Triiodothyronine, T3 | Measured / entered / document | 0 |
| SERUM_UREA | Serum Urea | Measured / entered / document | 7 |
| URIC_ACID | Serum Uric Acid | Measured / entered / document | 2 |
| T4 | Serum thyroxine, T4 | Measured / entered / document | 0 |
| SKIN_SMEAR_FOR_AFB | Skin smear for AFB | Measured / entered / document | 0 |
| SKIN_TEST_FOR_LEPROS | Skin test for Leprosy | Measured / entered / document | 0 |
| STOOL_ROUTINE_EXAMIN | Stool Routine Examination | Measured / entered / document | 0 |
| STOOL_REDUCING_SUBST | Stool reducing substances | Measured / entered / document | 0 |
| TG_HDL | TG / HDL | Calculated / includes calculated parameters | 0 |
| TESTOSTERONE_FREE | Testosterone Free | Measured / entered / document | 0 |
| TESTOSTERONE_TOTAL | Testosterone Total | Measured / entered / document | 0 |
| THYROGLOBULIN_TG | Thyroglobulin (TG) | Measured / entered / document | 0 |
| THYROGLOBULIN_ANTIBO | Thyroglobulin Antibody (TgAb) | Measured / entered / document | 0 |
| TSH | Thyroid-Stimulating Hormone, TSH | Measured / entered / document | 0 |
| TOTAL_CALCIUM | Total Calcium | Measured / entered / document | 0 |
| TOTAL_CHOLESTEROL | Total Cholesterol | Measured / entered / document | 0 |
| TOTAL_CHOLESTEROL_HD | Total Cholesterol / HDL | Calculated / includes calculated parameters | 0 |
| TOTAL_IRON_BINDING_C | Total Iron Binding Capacity (TIBC) | Measured / entered / document | 0 |
| TLC | Total Leukocyte Count | Measured / entered / document | 4 |
| TOTAL_LIPID | Total Lipid | Measured / entered / document | 0 |
| TOTAL_PSA | Total PSA | Measured / entered / document | 2 |
| TOTAL_RBC_COUNT | Total RBC Count | Measured / entered / document | 2 |
| TOXO_IGG | Toxo IgG | Measured / entered / document | 0 |
| TOXO_IGM | Toxo IgM | Measured / entered / document | 0 |
| TRANSFERRIN_SATURATI | Transferrin Saturation | Calculated / includes calculated parameters | 0 |
| TRIGLYCERIDES | Triglycerides | Measured / entered / document | 0 |
| TROPONIN_I | Troponin I | Measured / entered / document | 0 |
| TYPHIDOT_ANTIBODIES | Typhidot Antibodies | Measured / entered / document | 0 |
| UIBC | UIBC | Calculated / includes calculated parameters | 0 |
| UREA_CREATININE_RATI | Urea / Creatinine Ratio | Calculated / includes calculated parameters | 0 |
| URINE_CORTISOL | Urine Cortisol | Measured / entered / document | 0 |
| UCT | Urine Cotinine | Measured / entered / document | 0 |
| UPT | Urine Pregnancy Test | Measured / entered / document | 0 |
| URINE_ROUTINE_EXAMIN | Urine Routine Examination | Measured / entered / document | 0 |
| URINE_SUGAR_FASTING | Urine Sugar Fasting | Measured / entered / document | 0 |
| URINE_SUGAR_PP | Urine Sugar PP | Measured / entered / document | 0 |
| URINE_SUGAR_RANDOM | Urine Sugar Random | Measured / entered / document | 0 |
| URINE_FOR_AFB_24_HOU | Urine for AFB 24 hours | Measured / entered / document | 0 |
| URINE_FOR_CHYLE | Urine for Chyle | Measured / entered / document | 0 |
| URINE_FOR_ELISA_PREG | Urine for ELISA (Pregnancy) | Measured / entered / document | 0 |
| URINE_FOR_FUNGAL | Urine for Fungal | Measured / entered / document | 0 |
| URINE_FOR_KETONE | Urine for Ketone | Measured / entered / document | 0 |
| URINE_FOR_MICROALBUM | Urine for Microalbumin | Measured / entered / document | 0 |
| URINE_FOR_PROTEIN | Urine for Protein | Measured / entered / document | 0 |
| URINE_FOR_CREATININE | Urine for creatinine | Measured / entered / document | 0 |
| VDRL | VDRL | Measured / entered / document | 0 |
| VLDL_CHOLESTEROL | VLDL Cholesterol | Calculated / includes calculated parameters | 0 |
| VITAMIN_B12 | Vitamin B12 | Measured / entered / document | 0 |
| WBC_COUNT | WBC Count | Measured / entered / document | 10 |
| WEIL_FELIX_TEST_SERU | WEIL FELIX TEST, SERUM | Measured / entered / document | 0 |
| WIDAL_SLIDE_METHOD | Widal (Slide Method) | Measured / entered / document | 0 |
| WIDAL_TUBE_METHOD | Widal (Tube Method) | Measured / entered / document | 0 |
| WIDAL_TEST_SLIDE_MET | Widal Test (Slide Method) | Measured / entered / document | 0 |
| EGFR | eGFR | Calculated / includes calculated parameters | 0 |
| EGFR_CATEGORY | eGFR Category | Calculated / includes calculated parameters | 0 |
| ICALCIUM | iCalcium | Measured / entered / document | 0 |
