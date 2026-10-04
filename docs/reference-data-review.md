# Reference data review — all catalog tests

Generated 2026-10-04T10:50:23.859Z. **Review only: no new external reference values have been activated.**

210 tests audited; 84 missing reference texts have individual review dispositions; 66 tests have proposals or explicit configuration decisions, containing 236 candidate rows.

The existing test database remains the primary source. External values are candidates for assay, unit, specimen and clinical-context review. Some tests need narrative findings or local decision limits rather than a numeric normal range. A blank candidate is intentional when the test identity or laboratory SOP is required.

Age labels preserve source boundaries. Do not convert completed-year labels to continuous age bands, infer menopause/pregnancy/Tanner stage from age, or combine overlapping adult and pediatric values without reviewing the source. Critical limits remain those of the lab; none are invented here.

Open **Review reference data** on `/lab/normal-ranges` to compare each proposal with the database. The CSV contains all catalog tests. Use the existing range editor to enter lab-approved bands.

| Code | Test | Existing data | Proposal / decision | Source |
|---|---|---|---|---|
| VITAMIN_D3 | 25 Hydroxy (OH) Vitamin D | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| A_G_RATIO | A/G Ratio | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| ADA | ADA , SERUM | Reference text missing | Numeric | [Source](https://ltd.aruplab.com/Tests/Pub/3002976) |
| AMH | ANTI MULLERIAN HORMONE | Reference text missing | Numeric | [Source](https://www.mayocliniclabs.com/test-catalog/overview/608824) |
| AEC | Absolute Eosinophil Count | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| AFB | Acid - Fast Bacilli | Reference text missing | Retain existing data | Existing database / lab SOP |
| APTT | Activated partial thromboplastin time, APTT | Existing reference; age coverage needs lab validation | Retain existing data | Existing database / lab SOP |
| AFP | Alfa Fetoprotein, AFP | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| AMMONIA | Ammonia | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| ANTI_CARDIOLIPIN_IGG | Anti Cardiolipin IgG | Reference text missing | Interpretive thresholds | [Source](https://www.mayocliniclabs.com/test-catalog/overview/82976) |
| ANTI_CARDIOLIPIN_IGM | Anti Cardiolipin IgM | Reference text missing | Interpretive thresholds | [Source](https://www.mayocliniclabs.com/test-catalog/overview/82976) |
| ANTI_NUCLEAR_ANTIBOD | Anti Nuclear Antibody (ANA) by ELISA | Reference text missing | Retain existing data | Existing database / lab SOP |
| ANTI_PHOSPHOLIPID_IG | Anti Phospholipid IgG | Reference text missing | Assay identity required | [Source](https://www.mayocliniclabs.com/test-catalog/overview/82976) |
| ANTI_PHOSPHOLIPID_IG_2 | Anti Phospholipid IgM | Reference text missing | Assay identity required | [Source](https://www.mayocliniclabs.com/test-catalog/overview/82976) |
| ANTI_TPO | Anti TPO | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| CCP | Anti cyclic-citrullinated-peptide | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| ANTI_HAV | Anti-HAV | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| ANTI_HBC | Anti-HBc | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| ANTI_HBE | Anti-HBe | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| ANTI_HBS | Anti-HBs | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| ASO_TITER | Antistreptolysin O, ASO Titer | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| ABG | Arterial Blood Gas | Reference text missing | Multiple parameters | [Source](https://www.healthcare.uiowa.edu/path_handbook/appendix/heme/pediatric_normals.html) |
| BUN | BUN | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| BUN_CREATININE_RATIO | BUN / Creatinine Ratio | Reference text missing | Calculated ratio | Existing database / lab SOP |
| BETA_2_GLYCOPROTEIN_ | Beta 2 Glycoprotein 1, IgG | Reference text missing | Interpretive thresholds | [Source](https://hematology.testcatalog.org/show/B2GMG) |
| BETA_2_GLYCOPROTEIN__2 | Beta 2 Glycoprotein 1, IgM | Reference text missing | Interpretive thresholds | [Source](https://hematology.testcatalog.org/show/B2GMG) |
| BETA_HCG | Beta Human Chorionic Gonodotropin (HCG) | Reference text missing | Context required | [Source](https://www.mayocliniclabs.com/test-catalog/overview/80678) |
| BT | Bleeding Time | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| BLOOD_GROUP_RH | Blood Group & Rh. | Reference text missing | Lab definition required | Existing database / lab SOP |
| BLOOD_SUGAR_PP | Blood Sugar PP | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| CRP_QUALITATIVE | C-Reactive Protein, CRP (Qualitative) | Reference text missing | Retain existing data | Existing database / lab SOP |
| CRP_QUANTITATIVE | C-Reactive Protein, CRP (Quantitative) | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| C3 | C3 Complement | Reference text missing | Numeric | [Source](https://www.mayocliniclabs.com/test-catalog/overview/8174) |
| CA_125 | CA 125 | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| CA_15_3 | CA 15-3 | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| CA_19_9 | CA 19-9 | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| CA_242 | CA 242 | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| CA_50 | CA 50 | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| CA_72_4 | CA 72-4 | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| CK_MB | CK-MB | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| CMV_IGG | CMV IgG | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| CMV_IGM | CMV IgM | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| CPK_MB | CPK-MB | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| CALCITONIN | Calcitonin | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| CHIKUNGUNYA | Chikungunya | Reference text missing | Retain existing data | Existing database / lab SOP |
| CT | Clotting Time | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| CPK_TOTAL | Creatine Kinase | Reference text missing | Numeric | [Source](https://www.mayocliniclabs.com/test-catalog/overview/8336) |
| CULTURE_AND_SENSITIV | Culture and Sensitivity | Reference text missing | Narrative / specimen context | [Source](https://mhc.testcatalog.org/show/RTN) |
| D_DIMER | D-Dimer | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| DHEA | DHEA | Reference text missing | Assay identity required | [Source](https://www.mayocliniclabs.com/test-catalog/overview/81405) |
| DENGUE_CARD_METHOD | Dengue (Card Method) | Reference text missing | Retain existing data | Existing database / lab SOP |
| DENGUE_IGG | Dengue IgG | Reference text missing | Retain existing data | Existing database / lab SOP |
| DENGUE_IGG_IGM | Dengue IgG & IgM | Reference text missing | Retain existing data | Existing database / lab SOP |
| DENGUE_IGM | Dengue IgM | Reference text missing | Retain existing data | Existing database / lab SOP |
| DENGUE_NS1_ANTIGEN | Dengue NS1 Antigen | Reference text missing | Retain existing data | Existing database / lab SOP |
| DLC | Differential Leucocyte Count | Existing reference; age coverage needs lab validation | Retain existing data | Existing database / lab SOP |
| DIFFERENTIAL_LEUKOCY | Differential Leukocyte Count (Absolute count) | Existing reference; age coverage needs lab validation | Retain existing data | Existing database / lab SOP |
| DIRECT_COOMB_S_TEST | Direct Coomb's Test | Reference text missing | Retain existing data | Existing database / lab SOP |
| ESR_WINTROBE | Erythrocyte Sedimentation Rate (Wintrobe) | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| ESR_WESTERGREN | Erythrocyte sedimentation rate (Westergren) | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| ESTRADIOL | Estradiol | Reference text missing | Context required | [Source](https://www.mayocliniclabs.com/test-catalog/overview/81816) |
| FNAC_FINE_NEEDLE_ASP | FNAC (Fine Needle Aspiration) | Reference text missing | Lab definition required | Existing database / lab SOP |
| FASTING_BLOOD_SUGAR | Fasting Blood Sugar | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| FERRITIN | Ferritin | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| MF | Filarial Parasite (Card Test) | Reference text missing | Retain existing data | Existing database / lab SOP |
| FLUID_EXAMINATION | Fluid Examination | Reference text missing | Lab definition required | Existing database / lab SOP |
| FOLIC_ACID | Folic Acid | Reference text missing | Numeric | [Source](https://www.mayocliniclabs.com/test-catalog/overview/9198) |
| FSH | Follicle Stimulating Hormone, FSH | Reference text missing | Context required | [Source](https://www.mayocliniclabs.com/test-catalog/overview/602753) |
| FREE_PSA | Free PSA | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| FT4 | Free Thyroxine, FT4 | Existing age / sex bands | Age supplement | [Source](https://www.mayocliniclabs.com/test-catalog/overview/800463) |
| FT3 | Free Triiodothyronine l, FT3 | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| FUNGAL_SCRAPING_SMEA | Fungal scraping smear | Reference text missing | Qualitative / method review | [Source](https://www.mayocliniclabs.com/test-catalog/overview/84390) |
| GGT | Gamma Glutamyl Transferase, GGT | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| GLOBULIN | Globulin | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| GTT | Glucose Tolerance Test, GTT | Existing reference; age coverage needs lab validation | Retain existing data | Existing database / lab SOP |
| GLUCOSE_TOLERANCE_TE | Glucose Tolerance Test, GTT (Pregnancy) | Existing reference; age coverage needs lab validation | Retain existing data | Existing database / lab SOP |
| G6PD | Glucose-6-phosphate dehydrogenase | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| GRAM_S_STAIN | Gram's Stain | Reference text missing | Narrative / specimen context | [Source](https://sfmc.testcatalog.org/show/SOFT-GRAM) |
| H_ALB | H-ALB | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| HAV_IGM | HAV IgM | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| HBEAG | HBeAg | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| HBSAG | HBsAg | Reference text missing | Retain existing data | Existing database / lab SOP |
| HDL_CHOLESTEROL | HDL Cholesterol | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| HIV_CARD_TEST | HIV (Card Test) | Reference text missing | Retain existing data | Existing database / lab SOP |
| HSV_1_2_IGG | HSV-1/2 IgG | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| HSV_1_2_IGM | HSV-1/2 IgM | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| HSV_2_IGG | HSV-2 IgG | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| HBA1C_GLYCOSYLATED_H | HbA1c (Glycosylated Hemoglobin) | Existing reference; age coverage needs lab validation | Retain existing data | Existing database / lab SOP |
| HCT | Hematocrit Value, Hct | Existing age / sex bands | Pediatric supplement | [Source](https://www.healthcare.uiowa.edu/path_handbook/appendix/heme/pediatric_normals.html) |
| HB | Hemoglobin | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| HCV | Hepatitis C Virus, HCV | Reference text missing | Retain existing data | Existing database / lab SOP |
| HSCRP | High-Sensitivity C-Reactive Protein | Reference text missing | Numeric | [Source](https://www.mayocliniclabs.com/test-catalog/overview/606909) |
| IGA_URINE | IgA (Urine) | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| INDIRECT_COOMB_S_TES | Indirect Coomb's Test | Reference text missing | Retain existing data | Existing database / lab SOP |
| INSULIN_RANDOM | Insulin Random | Reference text missing | Sampling context required | [Source](https://www.mayocliniclabs.com/test-catalog/overview/800257) |
| IRON | Iron | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| LDL_HDL | LDL / HDL | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| LDL_CHOLESTEROL | LDL Cholesterol | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| LIPASE | Lipase | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| LUPUS_ANTICOAGULANT_ | Lupus Anticoagulant (DRVVT) | Reference text missing | Unit / assay review | [Source](https://www.mayocliniclabs.com/test-catalog/overview/602179) |
| LH | Luteinising Hormone, LH | Reference text missing | Context required | [Source](https://www.mayocliniclabs.com/test-catalog/overview/602752) |
| MAGNESIUM | Magnesium | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| MALARIA_ANTIGEN | Malaria Antigen | Reference text missing | Retain existing data | Existing database / lab SOP |
| MP_CARD_TEST | Malaria Parasite (Card Test) | Reference text missing | Retain existing data | Existing database / lab SOP |
| MP_MICROSCOPIC | Malaria Parasite (Microscopic) | Reference text missing | Retain existing data | Existing database / lab SOP |
| MANTOUX_TEST | Mantoux test | Reference text missing | Retain existing data | Existing database / lab SOP |
| MCHC | Mean Cell Haemoglobin CON, MCHC | Existing age / sex bands | Pediatric supplement | [Source](https://www.healthcare.uiowa.edu/path_handbook/appendix/heme/pediatric_normals.html) |
| MCH | Mean Cell Haemoglobin, MCH | Existing age / sex bands | Pediatric supplement | [Source](https://www.healthcare.uiowa.edu/path_handbook/appendix/heme/pediatric_normals.html) |
| MCV | Mean Corpuscular Volume, MCV | Existing age / sex bands | Pediatric supplement | [Source](https://www.healthcare.uiowa.edu/path_handbook/appendix/heme/pediatric_normals.html) |
| MPV | Mean Platelet Volume, MPV | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| MICROALBUMIN_CREATIN | Microalbumin Creatinine Ratio, Urine Random | Existing reference; age coverage needs lab validation | Retain existing data | Existing database / lab SOP |
| MYOGLOBIN | Myoglobin | Reference text missing | Numeric | [Source](https://www.mayocliniclabs.com/test-catalog/overview/621090) |
| NLR | Neutrophil Lymphocyte Ratio | Reference text missing | Calculated ratio | Existing database / lab SOP |
| NON_HDL_CHOLESTEROL | Non-HDL cholesterol | Reference text missing | Decision limits | [Source](https://www.mayocliniclabs.com/test-catalog/overview/616727) |
| OCCULT_BLOOD_STOOL | Occult Blood, Stool | Existing reference; age coverage needs lab validation | Retain existing data | Existing database / lab SOP |
| P_LCR | P-LCR | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| P_D_W | P.D.W. | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| PAP_SMEAR | PAP Smear | Reference text missing | Narrative | [Source](https://www.mayocliniclabs.com/test-catalog/overview/70338) |
| PH | PH Inactive | Reference text missing | Lab definition required | Existing database / lab SOP |
| PBS_GBP | Peripheral Blood Smear | Reference text missing | Lab definition required | Existing database / lab SOP |
| PLATELET_COUNT | Platelet Count | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| PROGESTERONE | Progesterone | Reference text missing | Context required | [Source](https://www.mayocliniclabs.com/test-catalog/overview/800241) |
| PRL | Prolactin | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| PT_INR | Prothrombin time, PT/INR | Existing reference; age coverage needs lab validation | Retain existing data | Existing database / lab SOP |
| R_D_W_CV | R.D.W. - CV | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| R_D_W_SD | R.D.W. - SD | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| RANDOM_BLOOD_SUGAR | Random Blood Sugar | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| RETICULOCYTE_COUNT | Reticulocyte Count | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| RA_QUALITATIVE | Rheumatoid Factor, RA (Qualitative) | Reference text missing | Retain existing data | Existing database / lab SOP |
| RA_QUANTITATIVE | Rheumatoid Factor, RA (Quantitative) | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| RUBELLA | Rubella | Existing reference; age coverage needs lab validation | Retain existing data | Existing database / lab SOP |
| RUBELLA_IGG | Rubella IgG | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| RUBELLA_IGM | Rubella IgM | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SGOT | SGOT (AST) | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SGOT_SGPT | SGOT/SGPT | Reference text missing | Calculated ratio | Existing database / lab SOP |
| SGPT | SGPT (ALT) | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SEMEN_EXAMINATION | Semen Examination | Existing reference; age coverage needs lab validation | Retain existing data | Existing database / lab SOP |
| SERUM_ALBUMIN | Serum Albumin | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_ALKALINE_PHOSP | Serum Alkaline Phosphatase | Existing age / sex bands | Age supplement | [Source](https://www.mayocliniclabs.com/test-catalog/overview/8340) |
| SERUM_AMYLASE | Serum Amylase | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_BILIRUBIN_DIRE | Serum Bilirubin (Direct) | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_BILIRUBIN_INDI | Serum Bilirubin (Indirect) | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_BILIRUBIN_TOTA | Serum Bilirubin (Total) | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_CALCIUM | Serum Calcium | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_CHLORIDE | Serum Chloride | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_CREATININE | Serum Creatinine | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_IGA | Serum IgA | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_IGE | Serum IgE | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_IGG | Serum IgG | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_IGM | Serum IgM | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_PHOSPHORUS | Serum Phosphorus | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_POTASSIUM | Serum Potassium | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_PROTEIN | Serum Protein | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_SODIUM | Serum Sodium | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| T3 | Serum Triiodothyronine, T3 | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| SERUM_UREA | Serum Urea | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| URIC_ACID | Serum Uric Acid | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| T4 | Serum thyroxine, T4 | Existing age / sex bands | Age supplement | [Source](https://www.mayocliniclabs.com/test-catalog/overview/36108) |
| SKIN_SMEAR_FOR_AFB | Skin smear for AFB | Reference text missing | Retain existing data | Existing database / lab SOP |
| SKIN_TEST_FOR_LEPROS | Skin test for Leprosy | Reference text missing | Test identity required | [Source](https://www.cdc.gov/leprosy/hcp/diagnosis-testing/index.html) |
| STOOL_ROUTINE_EXAMIN | Stool Routine Examination | Reference text missing | Lab definition required | Existing database / lab SOP |
| STOOL_REDUCING_SUBST | Stool reducing substances | Reference text missing | Qualitative | [Source](https://ltd.aruplab.com/Tests/Pub/3002514) |
| TG_HDL | TG / HDL | Reference text missing | Calculated ratio | Existing database / lab SOP |
| TESTOSTERONE_FREE | Testosterone Free | Reference text missing | Numeric | [Source](https://www.mayocliniclabs.com/test-catalog/overview/8508) |
| TESTOSTERONE_TOTAL | Testosterone Total | Reference text missing | Numeric | [Source](https://www.mayocliniclabs.com/test-catalog/overview/83686) |
| THYROGLOBULIN_TG | Thyroglobulin (TG) | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| THYROGLOBULIN_ANTIBO | Thyroglobulin Antibody (TgAb) | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| TSH | Thyroid-Stimulating Hormone, TSH | Existing age / sex bands | Age supplement | [Source](https://www.mayocliniclabs.com/test-catalog/overview/800096) |
| TOTAL_CALCIUM | Total Calcium | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| TOTAL_CHOLESTEROL | Total Cholesterol | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| TOTAL_CHOLESTEROL_HD | Total Cholesterol / HDL | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| TOTAL_IRON_BINDING_C | Total Iron Binding Capacity (TIBC) | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| TLC | Total Leukocyte Count | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| TOTAL_LIPID | Total Lipid | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| TOTAL_PSA | Total PSA | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| TOTAL_RBC_COUNT | Total RBC Count | Existing age / sex bands | Pediatric supplement | [Source](https://www.healthcare.uiowa.edu/path_handbook/appendix/heme/pediatric_normals.html) |
| TOXO_IGG | Toxo IgG | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| TOXO_IGM | Toxo IgM | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| TRANSFERRIN_SATURATI | Transferrin Saturation | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| TRIGLYCERIDES | Triglycerides | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| TROPONIN_I | Troponin I | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| TYPHIDOT_ANTIBODIES | Typhidot Antibodies | Reference text missing | Retain existing data | Existing database / lab SOP |
| UIBC | UIBC | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| UREA_CREATININE_RATI | Urea / Creatinine Ratio | Reference text missing | Calculated ratio | Existing database / lab SOP |
| URINE_CORTISOL | Urine Cortisol | Reference text missing | Numeric | [Source](https://www.mayocliniclabs.com/test-catalog/overview/8546) |
| UCT | Urine Cotinine | Reference text missing | Method / exposure context | [Source](https://www.mayocliniclabs.com/test-catalog/overview/82510) |
| UPT | Urine Pregnancy Test | Reference text missing | Retain existing data | Existing database / lab SOP |
| URINE_ROUTINE_EXAMIN | Urine Routine Examination | Existing reference; age coverage needs lab validation | Retain existing data | Existing database / lab SOP |
| URINE_SUGAR_FASTING | Urine Sugar Fasting | Reference text missing | Qualitative | [Source](https://www.healthcare.uiowa.edu/path_handbook/handbook/test2590.html) |
| URINE_SUGAR_PP | Urine Sugar PP | Reference text missing | Qualitative | [Source](https://www.healthcare.uiowa.edu/path_handbook/handbook/test2590.html) |
| URINE_SUGAR_RANDOM | Urine Sugar Random | Reference text missing | Qualitative | [Source](https://www.healthcare.uiowa.edu/path_handbook/handbook/test2590.html) |
| URINE_FOR_AFB_24_HOU | Urine for AFB 24 hours | Reference text missing | Retain existing data | Existing database / lab SOP |
| URINE_FOR_CHYLE | Urine for Chyle | Reference text missing | Lab definition required | Existing database / lab SOP |
| URINE_FOR_ELISA_PREG | Urine for ELISA (Pregnancy) | Reference text missing | Retain existing data | Existing database / lab SOP |
| URINE_FOR_FUNGAL | Urine for Fungal | Reference text missing | Qualitative / method review | [Source](https://www.mayocliniclabs.com/test-catalog/overview/84390) |
| URINE_FOR_KETONE | Urine for Ketone | Reference text missing | Qualitative | [Source](https://www.healthcare.uiowa.edu/path_handbook/handbook/test2590.html) |
| URINE_FOR_MICROALBUM | Urine for Microalbumin | Reference text missing | Unit / assay review | [Source](https://www.mayocliniclabs.com/test-catalog/overview/609731) |
| URINE_FOR_PROTEIN | Urine for Protein | Reference text missing | Qualitative / method review | [Source](https://www.healthcare.uiowa.edu/path_handbook/handbook/test2590.html) |
| URINE_FOR_CREATININE | Urine for creatinine | Reference text missing | Sampling context required | [Source](https://www.mayocliniclabs.com/test-catalog/overview/610603) |
| VDRL | VDRL | Reference text missing | Retain existing data | Existing database / lab SOP |
| VLDL_CHOLESTEROL | VLDL Cholesterol | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| VITAMIN_B12 | Vitamin B12 | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| WBC_COUNT | WBC Count | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| WEIL_FELIX_TEST_SERU | WEIL FELIX TEST, SERUM | Reference text missing | Retain existing data | Existing database / lab SOP |
| WIDAL_SLIDE_METHOD | Widal (Slide Method) | Reference text missing | Local baseline required | [Source](https://www.cdc.gov/yellow-book/hcp/travel-associated-infections-diseases/typhoid-and-paratyphoid-fever.html) |
| WIDAL_TUBE_METHOD | Widal (Tube Method) | Reference text missing | Local baseline required | [Source](https://www.cdc.gov/yellow-book/hcp/travel-associated-infections-diseases/typhoid-and-paratyphoid-fever.html) |
| WIDAL_TEST_SLIDE_MET | Widal Test (Slide Method) | Reference text missing | Local baseline required | [Source](https://www.cdc.gov/yellow-book/hcp/travel-associated-infections-diseases/typhoid-and-paratyphoid-fever.html) |
| EGFR | eGFR | Existing age / sex bands | Retain existing data | Existing database / lab SOP |
| EGFR_CATEGORY | eGFR Category | Reference text missing | Calculated category | [Source](https://kdigo.org/wp-content/uploads/2024/07/07232024-KDIGO-CKD.pdf) |
| ICALCIUM | iCalcium | Existing age / sex bands | Retain existing data | Existing database / lab SOP |

## Candidate values and review decisions

### ADA , SERUM (ADA)

Existing unit: cumm. Proposed unit: U/L.

Stored unit cumm is incompatible with enzyme activity. Confirm serum/plasma assay and correct the unit before adopting.

Source: [reference entry](https://ltd.aruplab.com/Tests/Pub/3002976).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Source does not split ages | — | 0 - 15 |

### ANTI MULLERIAN HORMONE (AMH)

Existing unit: ng/mL. Proposed unit: ng/mL.

Confirm assay compatibility. Preserve exact source age boundaries; age labels are not automatically converted to report rules.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/608824).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Male | <2y | — | 18 - 283 |
| Male | 2–12y | — | 8.9 - 109 |
| Male | >12y | — | <13 |
| Female | <3y | — | 0.11 - 4.2 |
| Female | 3–6y | — | 0.21 - 4.9 |
| Female | 7–11y | — | 0.36 - 5.9 |
| Female | 12–14y | — | 0.49 - 6.9 |
| Female | 15–19y | — | 0.62 - 7.8 |
| Female | 20–24y | — | 1.2 - 12 |
| Female | 25–29y | — | 0.89 - 9.9 |
| Female | 30–34y | — | 0.58 - 8.1 |
| Female | 35–39y | — | 0.15 - 7.5 |
| Female | 40–44y | — | 0.03 - 5.5 |
| Female | 45–50y | — | <2.6 |
| Female | 51–55y | — | <0.88 |
| Female | >55y | — | <0.03 |

### Anti Cardiolipin IgG (ANTI_CARDIOLIPIN_IGG)

Existing unit: GPL. Proposed unit: GPL.

These are assay-specific interpretive thresholds. No separate age/sex bands in this source.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/82976).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | All ages | Negative | <15.0 |
| Any | All ages | Weak positive | 15.0 - 39.9 |
| Any | All ages | Positive | 40.0 - 79.9 |
| Any | All ages | Strong positive | >=80.0 |

### Anti Cardiolipin IgM (ANTI_CARDIOLIPIN_IGM)

Existing unit: MPL. Proposed unit: MPL.

These are assay-specific interpretive thresholds. No separate age/sex bands in this source.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/82976).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | All ages | Negative | <15.0 |
| Any | All ages | Weak positive | 15.0 - 39.9 |
| Any | All ages | Positive | 40.0 - 79.9 |
| Any | All ages | Strong positive | >=80.0 |

### Anti Phospholipid IgG (ANTI_PHOSPHOLIPID_IG)

Existing unit: GPL U/mL. Proposed unit: GPL.

Only adopt the cardiolipin thresholds if this catalog entry is confirmed to measure cardiolipin. The name Anti Phospholipid alone does not identify the antigen.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/82976).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | All ages if cardiolipin assay confirmed | Negative | <15.0 |

### Anti Phospholipid IgM (ANTI_PHOSPHOLIPID_IG_2)

Existing unit: MPL U/mL. Proposed unit: MPL.

Only adopt the cardiolipin thresholds if this catalog entry is confirmed to measure cardiolipin. The name Anti Phospholipid alone does not identify the antigen.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/82976).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | All ages if cardiolipin assay confirmed | Negative | <15.0 |

### Arterial Blood Gas (ABG)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Arterial specimen only. Add distinct measured pH, pCO2 and pO2 parameters, with their units. Venous/capillary values cannot use these intervals; calculated bicarbonate depends on analyzer convention.

Source: [reference entry](https://www.healthcare.uiowa.edu/path_handbook/appendix/heme/pediatric_normals.html).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | 0–1mo | Arterial pH | 7.32 - 7.42 |
| Any | >1mo | Arterial pH | 7.35 - 7.45 |
| Any | 0–18y | Arterial pCO2 | 30 - 40 mmHg |
| Any | 0–1mo | Arterial pO2 | 60 - 80 mmHg |
| Any | >1mo | Arterial pO2 | 80 - 100 mmHg |

### BUN / Creatinine Ratio (BUN_CREATININE_RATIO)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

The configured formula calculates this ratio. The existing database does not supply a universal normal range; laboratory SOP and clinical context must define any decision limits. No numeric normal is invented.

### Beta 2 Glycoprotein 1, IgG (BETA_2_GLYCOPROTEIN_)

Existing unit: SGU. Proposed unit: SGU.

Mayo ELISA thresholds; confirm kit and calibration. Source applies to all ages.

Source: [reference entry](https://hematology.testcatalog.org/show/B2GMG).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | All ages | Negative | <15.0 |
| Any | All ages | Weak positive | 15.0 - 39.9 |
| Any | All ages | Positive | 40.0 - 79.9 |
| Any | All ages | Strong positive | >=80.0 |

### Beta 2 Glycoprotein 1, IgM (BETA_2_GLYCOPROTEIN__2)

Existing unit: SMU. Proposed unit: SMU.

Mayo ELISA thresholds; confirm kit and calibration. Source applies to all ages.

Source: [reference entry](https://hematology.testcatalog.org/show/B2GMG).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | All ages | Negative | <15.0 |
| Any | All ages | Weak positive | 15.0 - 39.9 |
| Any | All ages | Positive | 40.0 - 79.9 |
| Any | All ages | Strong positive | >=80.0 |

### Beta Human Chorionic Gonodotropin (HCG) (BETA_HCG)

Existing unit: mIU/mL. Proposed unit: mIU/mL.

1 IU/L = 1 mIU/mL. This negative pregnancy threshold is not a gestational reference interval. Confirm intact hCG versus free beta assay; do not apply it to pregnancy monitoring or tumor assays.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/80678).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Female | Reproductive assessment | Negative pregnancy result | <5 |

### Blood Group & Rh. (BLOOD_GROUP_RH)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

ABO and Rh typing are categorical identities. Offer A+, A-, B+, B-, AB+, AB-, O+, O- with Other/discrepancy; no group is a normal age/sex value.

### C3 Complement (C3)

Existing unit: mg/dL. Proposed unit: mg/dL.

Confirm quantitative complement C3 assay; functional C3 is a different test with different units.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/8174).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Source does not split ages | — | 75 - 175 |

### Creatine Kinase (CPK_TOTAL)

Existing unit: IU/L. Proposed unit: IU/L.

Reference not established at <=3 months. Exercise and intramuscular injections can increase CK.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/8336).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Male | >3mo | — | 39 - 308 |
| Female | >3mo | — | 26 - 192 |

### Culture and Sensitivity (CULTURE_AND_SENSITIV)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Routine aerobic culture example only. Specimen, organism identification and susceptibility determine the report; no universal numeric or sex/age range.

Source: [reference entry](https://mhc.testcatalog.org/show/RTN).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Specimen-specific | Routine aerobic culture example | No growth |

### DHEA (DHEA)

Existing unit: μg/dl. Proposed unit: ng/mL.

Confirm unconjugated DHEA versus DHEA-S first: existing unit microgram/dL can indicate DHEA-S. These DHEA values must not be used for DHEA-S. If unconjugated DHEA is confirmed, 1 ng/mL = 0.1 microgram/dL.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/81405).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Premature | — | <40 |
| Any | 0–1d | — | <11 |
| Any | 2–6d | — | <8.7 |
| Any | 7d–1mo | — | <5.8 |
| Any | >1–23mo | — | <2.9 |
| Any | 2–5y | — | <2.3 |
| Any | 6–10y | — | <3.4 |
| Any | 11–14y | — | <5.0 |
| Any | 15–18y | — | <6.6 |
| Any | 19–30y | — | <13 |
| Any | 31–40y | — | <10 |
| Any | 41–50y | — | <8.0 |
| Any | 51–60y | — | <6.0 |
| Any | >=61y | — | <5.0 |

### Estradiol (ESTRADIOL)

Existing unit: pg/mL. Proposed unit: pg/mL.

Adult and Tanner-stage data are method dependent. Menopause cannot be inferred from age; pediatric Tanner bands require pubertal context.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/81816).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Male | Adult | — | 10 - 40 |
| Female | Adult | Premenopausal; cycle dependent | 15 - 350 |
| Female | Adult | Postmenopausal | <10 |
| Male | Prepubertal >14d | Tanner I | Undetectable - 13 |
| Male | Puberty | Tanner II | Undetectable - 16 |
| Male | Puberty | Tanner III | Undetectable - 26 |
| Male | Puberty | Tanner IV | Undetectable - 38 |

### FNAC (Fine Needle Aspiration) (FNAC_FINE_NEEDLE_ASP)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Pathologist cytology narrative and specimen/site-specific diagnosis; a numeric age/sex range is not applicable.

### Fluid Examination (FLUID_EXAMINATION)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Specify CSF, pleural, ascitic, synovial or other fluid and measured parameters; reference limits cannot be shared across fluids.

### Folic Acid (FOLIC_ACID)

Existing unit: ng/mL. Proposed unit: ng/mL.

1 microgram/L = 1 ng/mL. Confirm serum folate, not RBC folate.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/9198).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Source does not split ages | — | >=4.0 |

### Follicle Stimulating Hormone, FSH (FSH)

Existing unit: mIU/mL. Proposed unit: mIU/mL.

1 IU/L = 1 mIU/mL. Female adult intervals require cycle/menopausal context; do not select them using age alone.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/602753).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Male | <12mo | — | <=3.3 |
| Male | 12mo–5y | — | <=1.9 |
| Male | >5–10y | — | <=2.3 |
| Male | >10–15y | — | 0.6 - 6.9 |
| Male | >15–18y | — | 0.7 - 9.6 |
| Male | >18y | — | 1.2 - 15.8 |
| Female | <12mo | — | 1.2 - 12.5 |
| Female | 12mo–10y | — | 0.5 - 6.0 |
| Female | >10–15y | — | 0.9 - 8.9 |
| Female | >15–18y | — | 0.7 - 9.6 |
| Female | Adult | Follicular | 2.9 - 14.6 |
| Female | Adult | Midcycle | 4.7 - 23.2 |
| Female | Adult | Luteal | 1.4 - 8.9 |
| Female | Adult | Postmenopausal | 16.0 - 157.0 |

### Free Thyroxine, FT4 (FT4)

Existing unit: pg/mL. Proposed unit: pg/mL.

Source ng/dL converted to catalog pg/mL by multiplying by 10. Confirm method and pregnancy context.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/800463).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | 0–5d | — | 9 - 25 |
| Any | 6d–2mo | — | 9 - 22 |
| Any | 3–11mo | — | 9 - 20 |
| Any | 1–5y | — | 10 - 18 |
| Any | 6–10y | — | 10 - 17 |
| Any | 11–19y | — | 10 - 16 |
| Any | >=20y | — | 9 - 17 |

### Fungal scraping smear (FUNGAL_SCRAPING_SMEA)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Fungal smear reference only. If the ordered test is culture, use a specimen-specific culture report instead.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/84390).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Source does not split ages | Fungal smear | Negative |

### Gram's Stain (GRAM_S_STAIN)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Specimen source matters: normal flora may be present. Retain organisms/cells and pathologist findings; do not auto-classify every stain as negative.

Source: [reference entry](https://sfmc.testcatalog.org/show/SOFT-GRAM).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Specimen-specific | Normally sterile site; see source | No WBCs / no organisms seen |

### Hematocrit Value, Hct (HCT)

Existing unit: %. Proposed unit: %.

Supplemental pediatric candidates. Reconcile source age boundaries and overlapping existing ranges before adopting; existing database values remain primary.

Source: [reference entry](https://www.healthcare.uiowa.edu/path_handbook/appendix/heme/pediatric_normals.html).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | 0–1mo | — | 42 - 65 |
| Any | 1–2mo | — | 33 - 55 |
| Any | 2–3mo | — | 28 - 41 |
| Any | 3–6mo | — | 29 - 41 |
| Any | 6–12mo | — | 31 - 41 |

### High-Sensitivity C-Reactive Protein (HSCRP)

Existing unit: mg/L. Proposed unit: mg/L.

Adult cardiovascular risk threshold, not a universal inflammation range. Source does not establish pediatric intervals.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/606909).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | >=18y | Cardiovascular risk | <2.0 |

### Insulin Random (INSULIN_RANDOM)

Existing unit: µU/mL. Proposed unit: microIU/mL.

Source requires an 8-hour fast. Its 2.6–24.9 range cannot govern this RANDOM test; retain a context warning until the lab specifies a random-sampling protocol.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/800257).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Source does not split ages | Fasting only; not applicable to random insulin | 2.6 - 24.9 |

### Lupus Anticoagulant (DRVVT) (LUPUS_ANTICOAGULANT_)

Existing unit: not configured. Proposed unit: ratio.

Source screen-ratio threshold is dimensionless; stored seconds is not compatible. A seconds-based screen requires kit-specific controls, confirm and mix testing. Pediatric reference not clearly established.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/602179).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Adults; pediatric validation required | DRVVT screen ratio only | <1.20 |

### Luteinising Hormone, LH (LH)

Existing unit: mIU/mL. Proposed unit: mIU/mL.

1 IU/L = 1 mIU/mL. Source does not establish ranges at <=4 weeks. Female adult intervals require cycle/menopausal context.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/602752).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Male | >1–12mo | — | <=0.4 |
| Male | >12mo–6y | — | <=1.3 |
| Male | >6–11y | — | <=1.4 |
| Male | >11–14y | — | 0.1 - 7.8 |
| Male | >14–18y | — | 1.3 - 9.8 |
| Male | >18y | — | 1.3 - 9.6 |
| Female | >1–12mo | — | <=0.4 |
| Female | >12mo–6y | — | <=0.5 |
| Female | >6–11y | — | <=3.1 |
| Female | >11–14y | — | <=11.9 |
| Female | >14–18y | — | 0.5 - 41.7 |
| Female | Adult | Follicular | 1.9 - 14.6 |
| Female | Adult | Midcycle | 12.2 - 118.0 |
| Female | Adult | Luteal | 0.7 - 12.9 |
| Female | Adult | Postmenopausal | 5.3 - 65.4 |

### Mean Cell Haemoglobin CON, MCHC (MCHC)

Existing unit: g/dl. Proposed unit: g/dL.

Supplemental pediatric candidates. Reconcile source age boundaries and overlapping existing ranges before adopting; existing database values remain primary.

Source: [reference entry](https://www.healthcare.uiowa.edu/path_handbook/appendix/heme/pediatric_normals.html).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | 0–6mo | — | 28 - 36 |
| Any | 6–12mo | — | 32 - 36 |

### Mean Cell Haemoglobin, MCH (MCH)

Existing unit: Pg. Proposed unit: pg.

Supplemental pediatric candidates. Reconcile source age boundaries and overlapping existing ranges before adopting; existing database values remain primary.

Source: [reference entry](https://www.healthcare.uiowa.edu/path_handbook/appendix/heme/pediatric_normals.html).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | 0–1mo | — | 31 - 37 |
| Any | 1–3mo | — | 27 - 36 |
| Any | 3–6mo | — | 25 - 35 |
| Any | 6–12mo | — | 23 - 31 |

### Mean Corpuscular Volume, MCV (MCV)

Existing unit: fL. Proposed unit: fL.

Supplemental pediatric candidates. Reconcile source age boundaries and overlapping existing ranges before adopting; existing database values remain primary.

Source: [reference entry](https://www.healthcare.uiowa.edu/path_handbook/appendix/heme/pediatric_normals.html).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | 0–1mo | — | 88 - 123 |
| Any | 1–3mo | — | 91 - 112 |
| Any | 3–6mo | — | 74 - 108 |
| Any | 6–12mo | — | 70 - 85 |

### Myoglobin (MYOGLOBIN)

Existing unit: ng/mL. Proposed unit: ng/mL.

1 microgram/L = 1 ng/mL. Confirm serum assay and laboratory validation.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/621090).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Male | Source does not split ages | — | 0 - 72 |
| Female | Source does not split ages | — | 0 - 58 |

### Neutrophil Lymphocyte Ratio (NLR)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

The configured formula calculates this ratio. The existing database does not supply a universal normal range; laboratory SOP and clinical context must define any decision limits. No numeric normal is invented.

### Non-HDL cholesterol (NON_HDL_CHOLESTEROL)

Existing unit: not configured. Proposed unit: mg/dL.

Desirable/acceptable clinical decision limits, not a statistical healthy-population interval. Lower treatment targets depend on cardiovascular risk.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/616727).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | 2–17y | Acceptable | <120 |
| Any | >=18y | Desirable | <130 |

### PAP Smear (PAP_SMEAR)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Bethesda cytology reporting and specimen adequacy required; neither a numeric interval nor a result to prefill.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/70338).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Female | Cervical cytology context | Satisfactory specimen | Negative for intraepithelial lesion or malignancy |

### PH Inactive (PH)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Catalog name is PH Inactive, with Active status in the snapshot. Confirm purpose/status before adding a range; do not assume blood or urine pH.

### Peripheral Blood Smear (PBS_GBP)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Morphology report; separate RBC, WBC, platelet and parasite findings. A universal numeric normal is not applicable.

### Progesterone (PROGESTERONE)

Existing unit: ng/mL. Proposed unit: ng/mL.

Source notes puberty-dependent adolescent concentrations and unestablished neonatal intervals. Female adult bands require reproductive context.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/800241).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Male | 4wk–<12mo | — | <=0.66 |
| Male | 12mo–9y | — | <=0.35 |
| Male | >=18y | — | <0.20 |
| Female | 4d–<12mo | — | <=1.3 |
| Female | 12mo–9y | — | <=0.35 |
| Female | >=18y | Follicular | <=0.89 |
| Female | >=18y | Ovulation | <=12 |
| Female | >=18y | Luteal | 1.8 - 24 |
| Female | >=18y | Postmenopausal | <=0.20 |
| Female | Pregnancy | First trimester | 11 - 44 |
| Female | Pregnancy | Second trimester | 25 - 83 |
| Female | Pregnancy | Third trimester | 58 - 214 |

### SGOT/SGPT (SGOT_SGPT)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

The configured formula calculates this ratio. The existing database does not supply a universal normal range; laboratory SOP and clinical context must define any decision limits. No numeric normal is invented.

### Serum Alkaline Phosphatase (SERUM_ALKALINE_PHOSP)

Existing unit: U/I. Proposed unit: U/L.

Age and sex-specific alkaline phosphatase candidates. Confirm method before replacing the current single interval.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/8340).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Male | 0–14d | — | 83 - 248 |
| Male | 15d–<1y | — | 122 - 469 |
| Male | 1–<10y | — | 142 - 335 |
| Male | 10–<13y | — | 129 - 417 |
| Male | 13–<15y | — | 116 - 468 |
| Male | 15–<17y | — | 82 - 331 |
| Male | 17–<19y | — | 55 - 149 |
| Male | >=19y | — | 40 - 129 |
| Female | 0–14d | — | 83 - 248 |
| Female | 15d–<1y | — | 122 - 469 |
| Female | 1–<10y | — | 142 - 335 |
| Female | 10–<13y | — | 129 - 417 |
| Female | 13–<15y | — | 57 - 254 |
| Female | 15–<17y | — | 50 - 117 |
| Female | >=17y | — | 35 - 104 |

### Serum thyroxine, T4 (T4)

Existing unit: ug/dL. Proposed unit: microgram/dL.

Total thyroxine candidates; binding-protein changes and pregnancy affect interpretation. Preserve current ranges until assay review.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/36108).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | 0–5d | — | 5 - 18.5 |
| Any | 6d–2mo | — | 5.4 - 17 |
| Any | 3–11mo | — | 5.7 - 16 |
| Any | 1–5y | — | 6 - 14.7 |
| Any | 6–10y | — | 6 - 13.8 |
| Any | 11–19y | — | 5.9 - 13.2 |
| Any | >=20y | — | 4.5 - 11.7 |

### Skin test for Leprosy (SKIN_TEST_FOR_LEPROS)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Clarify lepromin test versus diagnostic biopsy/stain. Do not invent a negative normal or diagnostic cutoff from this ambiguous name.

Source: [reference entry](https://www.cdc.gov/leprosy/hcp/diagnosis-testing/index.html).

### Stool Routine Examination (STOOL_ROUTINE_EXAMIN)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Create physical, microscopy and parasite fields using the lab SOP. Existing catalog has no parameter definitions; /HPF cannot be assigned to every finding.

### Stool reducing substances (STOOL_REDUCING_SUBST)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Qualitative colorimetry. Negative or trace is normal; 1+ through 4+ is abnormal. Not a numeric age/sex range.

Source: [reference entry](https://ltd.aruplab.com/Tests/Pub/3002514).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Source does not split ages | Normal | Negative or trace |

### TG / HDL (TG_HDL)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

The configured formula calculates this ratio. The existing database does not supply a universal normal range; laboratory SOP and clinical context must define any decision limits. No numeric normal is invented.

### Testosterone Free (TESTOSTERONE_FREE)

Existing unit: pg/mL. Proposed unit: pg/mL.

Source ng/dL converted to catalog pg/mL by multiplying by 10 (dimensional conversion only). Confirm equilibrium-dialysis method; these intervals must not be used for a direct analog assay. Adult bands below; pediatric bands require separate method review.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/8508).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Male | 20–<25y | — | 52.5 - 207 |
| Male | 25–<30y | — | 50.5 - 198 |
| Male | 30–<35y | — | 48.5 - 190 |
| Male | 35–<40y | — | 46.5 - 181 |
| Male | 40–<45y | — | 44.6 - 171 |
| Male | 45–<50y | — | 42.6 - 164 |
| Male | 50–<55y | — | 40.6 - 156 |
| Male | 55–<60y | — | 38.7 - 147 |
| Male | 60–<65y | — | 36.7 - 139 |
| Male | 65–<70y | — | 34.7 - 130 |
| Male | 70–<75y | — | 32.8 - 122 |
| Male | 75–<80y | — | 30.8 - 113 |
| Male | 80–<85y | — | 28.8 - 105 |
| Male | 85–<90y | — | 26.9 - 96.1 |
| Male | 90–<95y | — | 24.9 - 87.6 |
| Male | 95–100+y | — | 22.9 - 79.1 |
| Female | 20–<25y | — | <1.3 - 10.8 |
| Female | 25–<30y | — | <1.3 - 10.6 |
| Female | 30–<35y | — | <1.3 - 10.3 |
| Female | 35–<40y | — | <1.3 - 10 |
| Female | 40–<45y | — | <1.3 - 9.8 |
| Female | 45–<50y | — | <1.3 - 9.5 |
| Female | 50–<55y | — | <1.3 - 9.2 |
| Female | 55–<60y | — | <1.3 - 9 |
| Female | 60–<65y | — | <1.3 - 8.7 |
| Female | 65–<70y | — | <1.3 - 8.4 |
| Female | 70–<75y | — | <1.3 - 8.2 |
| Female | 75–<80y | — | <1.3 - 7.9 |
| Female | 80–<85y | — | <1.3 - 7.6 |
| Female | 85–<90y | — | <1.3 - 7.3 |
| Female | 90–<95y | — | <1.3 - 7.1 |
| Female | 95–100+y | — | <1.3 - 6.8 |

### Testosterone Total (TESTOSTERONE_TOTAL)

Existing unit: ng/dl. Proposed unit: ng/dL.

Morning serum LC-MS/MS candidates; confirm method. Source below-quantification lower bounds (<7) are preserved as text, not turned into zero. Tanner stage cannot be inferred from age.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/83686).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Male | 0–5mo | — | 75 - 400 |
| Male | 6mo–9y | — | <7 - 20 |
| Male | 10–11y | — | <7 - 130 |
| Male | 12–13y | — | <7 - 800 |
| Male | 14y | — | <7 - 1200 |
| Male | 15–16y | — | 100 - 1200 |
| Male | 17–18y | — | 300 - 1200 |
| Male | >=19y | — | 240 - 950 |
| Female | 0–5mo | — | 20 - 80 |
| Female | 6mo–9y | — | <7 - 20 |
| Female | 10–11y | — | <7 - 44 |
| Female | 12–16y | — | <7 - 75 |
| Female | 17–18y | — | 20 - 75 |
| Female | >=19y | — | 8 - 60 |

### Thyroid-Stimulating Hormone, TSH (TSH)

Existing unit: µIU/mL. Proposed unit: microIU/mL.

1 mIU/L = 1 microIU/mL. Method-specific pediatric/adult candidates; pregnancy requires separate validated interpretation.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/800096).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | 0–5d | — | 0.7 - 15.2 |
| Any | 6d–2mo | — | 0.7 - 11 |
| Any | 3–11mo | — | 0.7 - 8.4 |
| Any | 1–5y | — | 0.7 - 6 |
| Any | 6–10y | — | 0.6 - 4.8 |
| Any | 11–19y | — | 0.5 - 4.3 |
| Any | >=20y | — | 0.3 - 4.2 |

### Total RBC Count (TOTAL_RBC_COUNT)

Existing unit: million/cumm. Proposed unit: million/cumm.

Supplemental pediatric candidates. Reconcile source age boundaries and overlapping existing ranges before adopting; existing database values remain primary.

Source: [reference entry](https://www.healthcare.uiowa.edu/path_handbook/appendix/heme/pediatric_normals.html).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | 0–1mo | — | 3.90 - 5.90 |
| Any | 1–2mo | — | 3.10 - 5.30 |
| Any | 2–3mo | — | 2.70 - 4.50 |
| Any | 3–6mo | — | 3.10 - 5.10 |
| Any | 6–12mo | — | 3.90 - 5.50 |

### Urea / Creatinine Ratio (UREA_CREATININE_RATI)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

The configured formula calculates this ratio. The existing database does not supply a universal normal range; laboratory SOP and clinical context must define any decision limits. No numeric normal is invented.

### Urine Cortisol (URINE_CORTISOL)

Existing unit: μg/24 hrs. Proposed unit: microgram/24 h.

24-hour collection and LC-MS/MS method required. Source does not establish intervals at age 0–2 years.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/8546).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | 3–8y | — | 1.4 - 20 |
| Any | 9–12y | — | 2.6 - 37 |
| Any | 13–17y | — | 4.0 - 56 |
| Any | >=18y | — | 3.5 - 45 |

### Urine Cotinine (UCT)

Existing unit: not configured. Proposed unit: ng/mL.

Quantitative urine cotinine only. Source describes non-tobacco users without passive exposure; qualitative card cutoffs differ and require the kit insert.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/82510).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Exposure context required | Non-user; no passive exposure | <5.0 |

### Urine Sugar Fasting (URINE_SUGAR_FASTING)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Qualitative dipstick reference; quantitative glucose/ketones require their own assay limits. Source does not split age or sex.

Source: [reference entry](https://www.healthcare.uiowa.edu/path_handbook/handbook/test2590.html).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Source does not split ages | Dipstick | Negative |

### Urine Sugar PP (URINE_SUGAR_PP)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Qualitative dipstick reference; quantitative glucose/ketones require their own assay limits. Source does not split age or sex.

Source: [reference entry](https://www.healthcare.uiowa.edu/path_handbook/handbook/test2590.html).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Source does not split ages | Dipstick | Negative |

### Urine Sugar Random (URINE_SUGAR_RANDOM)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Qualitative dipstick reference; quantitative glucose/ketones require their own assay limits. Source does not split age or sex.

Source: [reference entry](https://www.healthcare.uiowa.edu/path_handbook/handbook/test2590.html).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Source does not split ages | Dipstick | Negative |

### Urine for Chyle (URINE_FOR_CHYLE)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Specify qualitative chyle/chylomicron method and lab-approved normal finding; no arbitrary numeric age/sex range.

### Urine for Fungal (URINE_FOR_FUNGAL)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Fungal smear reference only. If the ordered test is culture, use a specimen-specific culture report instead.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/84390).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Source does not split ages | Fungal smear | Negative |

### Urine for Ketone (URINE_FOR_KETONE)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Qualitative dipstick reference; quantitative glucose/ketones require their own assay limits. Source does not split age or sex.

Source: [reference entry](https://www.healthcare.uiowa.edu/path_handbook/handbook/test2590.html).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Source does not split ages | Dipstick | Negative |

### Urine for Microalbumin (URINE_FOR_MICROALBUM)

Existing unit: not configured. Proposed unit: mg/g creatinine.

These are urine albumin/creatinine ratio thresholds, not a raw albumin concentration. Confirm specimen, reporting units and whether a separate creatinine measurement is part of this test.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/609731).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Male | Source does not split ages | ACR only | <17 |
| Female | Source does not split ages | ACR only | <25 |

### Urine for Protein (URINE_FOR_PROTEIN)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Dipstick proposal only. Quantitative random protein and 24-hour excretion need distinct units and validated ranges.

Source: [reference entry](https://www.healthcare.uiowa.edu/path_handbook/handbook/test2590.html).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Source does not split ages | Dipstick | Negative |

### Urine for creatinine (URINE_FOR_CREATININE)

Existing unit: not configured. Proposed unit: mg/dL.

Random urine only; source has no pediatric range. Confirm this catalog entry is random, not 24-hour excretion.

Source: [reference entry](https://www.mayocliniclabs.com/test-catalog/overview/610603).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | >=18y | — | 16 - 326 |

### Widal (Slide Method) (WIDAL_SLIDE_METHOD)

Existing unit: not configured. Proposed unit: titre.

No universal age/sex normal titre is proposed. Define O/H/AH/BH and reagent/local baseline thresholds in the lab SOP; CDC describes Widal as unreliable for diagnosis.

Source: [reference entry](https://www.cdc.gov/yellow-book/hcp/travel-associated-infections-diseases/typhoid-and-paratyphoid-fever.html).

### Widal (Tube Method) (WIDAL_TUBE_METHOD)

Existing unit: not configured. Proposed unit: titre.

No universal age/sex normal titre is proposed. Define O/H/AH/BH and reagent/local baseline thresholds in the lab SOP; CDC describes Widal as unreliable for diagnosis.

Source: [reference entry](https://www.cdc.gov/yellow-book/hcp/travel-associated-infections-diseases/typhoid-and-paratyphoid-fever.html).

### Widal Test (Slide Method) (WIDAL_TEST_SLIDE_MET)

Existing unit: not configured. Proposed unit: titre.

No universal age/sex normal titre is proposed. Define O/H/AH/BH and reagent/local baseline thresholds in the lab SOP; CDC describes Widal as unreliable for diagnosis.

Source: [reference entry](https://www.cdc.gov/yellow-book/hcp/travel-associated-infections-diseases/typhoid-and-paratyphoid-fever.html).

### eGFR Category (EGFR_CATEGORY)

Existing unit: not configured. Proposed unit: qualitative / to be specified.

Calculated KDIGO G category describes kidney function; CKD diagnosis also needs chronicity and other markers. Existing calculation already returns G1–G5.

Source: [reference entry](https://kdigo.org/wp-content/uploads/2024/07/07232024-KDIGO-CKD.pdf).

| Sex | Age / scope | Context | Candidate |
|---|---|---|---|
| Any | Adults | mL/min/1.73m2 | G1 >=90; G2 60–89; G3a 45–59; G3b 30–44; G4 15–29; G5 <15 |
