// Review candidates only. These values are never loaded into patient reports
// or written to the test master by the review generator.
// Age and context labels preserve the source's boundaries; do not infer
// menopause, pregnancy, Tanner stage, or fasting from age alone.
const mayo = (id) => `https://www.mayocliniclabs.com/test-catalog/overview/${id}`;
const iowa = 'https://www.healthcare.uiowa.edu/path_handbook/appendix/heme/pediatric_normals.html';
const urinalysis = 'https://www.healthcare.uiowa.edu/path_handbook/handbook/test2590.html';
const proposals = {};
function add(codes, unit, sourceUrl, notes, rows, kind = 'Numeric') {
  for (const code of codes.split(' ')) proposals[code] = { unit, sourceUrl, notes, kind,
    rows: rows.map(([sex, age, range, context = '']) => ({ sex, age, range, context })) };
}
add('ADA', 'U/L', 'https://ltd.aruplab.com/Tests/Pub/3002976',
  'Stored unit cumm is incompatible with enzyme activity. Confirm serum/plasma assay and correct the unit before adopting.', [['Any', 'Source does not split ages', '0 - 15']]);
add('AMH', 'ng/mL', mayo(608824), 'Confirm assay compatibility. Preserve exact source age boundaries; age labels are not automatically converted to report rules.', [
  ['Male', '<2y', '18 - 283'], ['Male', '2–12y', '8.9 - 109'], ['Male', '>12y', '<13'],
  ['Female', '<3y', '0.11 - 4.2'], ['Female', '3–6y', '0.21 - 4.9'], ['Female', '7–11y', '0.36 - 5.9'],
  ['Female', '12–14y', '0.49 - 6.9'], ['Female', '15–19y', '0.62 - 7.8'], ['Female', '20–24y', '1.2 - 12'],
  ['Female', '25–29y', '0.89 - 9.9'], ['Female', '30–34y', '0.58 - 8.1'], ['Female', '35–39y', '0.15 - 7.5'],
  ['Female', '40–44y', '0.03 - 5.5'], ['Female', '45–50y', '<2.6'], ['Female', '51–55y', '<0.88'], ['Female', '>55y', '<0.03']]);
for (const [code, unit] of [['ANTI_CARDIOLIPIN_IGG', 'GPL'], ['ANTI_CARDIOLIPIN_IGM', 'MPL']])
  add(code, unit, mayo(82976), 'These are assay-specific interpretive thresholds. No separate age/sex bands in this source.',
    [['Any', 'All ages', '<15.0', 'Negative'], ['Any', 'All ages', '15.0 - 39.9', 'Weak positive'], ['Any', 'All ages', '40.0 - 79.9', 'Positive'], ['Any', 'All ages', '>=80.0', 'Strong positive']], 'Interpretive thresholds');
for (const code of ['ANTI_PHOSPHOLIPID_IG', 'ANTI_PHOSPHOLIPID_IG_2'])
  add(code, code.endsWith('_2') ? 'MPL' : 'GPL', mayo(82976),
    'Only adopt the cardiolipin thresholds if this catalog entry is confirmed to measure cardiolipin. The name Anti Phospholipid alone does not identify the antigen.',
    [['Any', 'All ages if cardiolipin assay confirmed', '<15.0', 'Negative']], 'Assay identity required');
for (const [code, unit] of [['BETA_2_GLYCOPROTEIN_', 'SGU'], ['BETA_2_GLYCOPROTEIN__2', 'SMU']])
  add(code, unit, 'https://hematology.testcatalog.org/show/B2GMG', 'Mayo ELISA thresholds; confirm kit and calibration. Source applies to all ages.',
    [['Any', 'All ages', '<15.0', 'Negative'], ['Any', 'All ages', '15.0 - 39.9', 'Weak positive'], ['Any', 'All ages', '40.0 - 79.9', 'Positive'], ['Any', 'All ages', '>=80.0', 'Strong positive']], 'Interpretive thresholds');
add('BETA_HCG', 'mIU/mL', mayo(80678), '1 IU/L = 1 mIU/mL. This negative pregnancy threshold is not a gestational reference interval. Confirm intact hCG versus free beta assay; do not apply it to pregnancy monitoring or tumor assays.', [['Female', 'Reproductive assessment', '<5', 'Negative pregnancy result']], 'Context required');
add('C3', 'mg/dL', mayo(8174), 'Confirm quantitative complement C3 assay; functional C3 is a different test with different units.', [['Any', 'Source does not split ages', '75 - 175']]);
add('CPK_TOTAL', 'IU/L', mayo(8336), 'Reference not established at <=3 months. Exercise and intramuscular injections can increase CK.', [['Male', '>3mo', '39 - 308'], ['Female', '>3mo', '26 - 192']]);
add('DHEA', 'ng/mL', mayo(81405), 'Confirm unconjugated DHEA versus DHEA-S first: existing unit microgram/dL can indicate DHEA-S. These DHEA values must not be used for DHEA-S. If unconjugated DHEA is confirmed, 1 ng/mL = 0.1 microgram/dL.', [
  ['Any', 'Premature', '<40'], ['Any', '0–1d', '<11'], ['Any', '2–6d', '<8.7'], ['Any', '7d–1mo', '<5.8'], ['Any', '>1–23mo', '<2.9'],
  ['Any', '2–5y', '<2.3'], ['Any', '6–10y', '<3.4'], ['Any', '11–14y', '<5.0'], ['Any', '15–18y', '<6.6'],
  ['Any', '19–30y', '<13'], ['Any', '31–40y', '<10'], ['Any', '41–50y', '<8.0'], ['Any', '51–60y', '<6.0'], ['Any', '>=61y', '<5.0']], 'Assay identity required');
add('ESTRADIOL', 'pg/mL', mayo(81816), 'Adult and Tanner-stage data are method dependent. Menopause cannot be inferred from age; pediatric Tanner bands require pubertal context.', [
  ['Male', 'Adult', '10 - 40'], ['Female', 'Adult', '15 - 350', 'Premenopausal; cycle dependent'], ['Female', 'Adult', '<10', 'Postmenopausal'],
  ['Male', 'Prepubertal >14d', 'Undetectable - 13', 'Tanner I'], ['Male', 'Puberty', 'Undetectable - 16', 'Tanner II'],
  ['Male', 'Puberty', 'Undetectable - 26', 'Tanner III'], ['Male', 'Puberty', 'Undetectable - 38', 'Tanner IV']], 'Context required');
add('FOLIC_ACID', 'ng/mL', mayo(9198), '1 microgram/L = 1 ng/mL. Confirm serum folate, not RBC folate.', [['Any', 'Source does not split ages', '>=4.0']]);
add('FSH', 'mIU/mL', mayo(602753), '1 IU/L = 1 mIU/mL. Female adult intervals require cycle/menopausal context; do not select them using age alone.', [
  ['Male', '<12mo', '<=3.3'], ['Male', '12mo–5y', '<=1.9'], ['Male', '>5–10y', '<=2.3'], ['Male', '>10–15y', '0.6 - 6.9'], ['Male', '>15–18y', '0.7 - 9.6'], ['Male', '>18y', '1.2 - 15.8'],
  ['Female', '<12mo', '1.2 - 12.5'], ['Female', '12mo–10y', '0.5 - 6.0'], ['Female', '>10–15y', '0.9 - 8.9'], ['Female', '>15–18y', '0.7 - 9.6'],
  ['Female', 'Adult', '2.9 - 14.6', 'Follicular'], ['Female', 'Adult', '4.7 - 23.2', 'Midcycle'], ['Female', 'Adult', '1.4 - 8.9', 'Luteal'], ['Female', 'Adult', '16.0 - 157.0', 'Postmenopausal']], 'Context required');
add('LH', 'mIU/mL', mayo(602752), '1 IU/L = 1 mIU/mL. Source does not establish ranges at <=4 weeks. Female adult intervals require cycle/menopausal context.', [
  ['Male', '>1–12mo', '<=0.4'], ['Male', '>12mo–6y', '<=1.3'], ['Male', '>6–11y', '<=1.4'], ['Male', '>11–14y', '0.1 - 7.8'], ['Male', '>14–18y', '1.3 - 9.8'], ['Male', '>18y', '1.3 - 9.6'],
  ['Female', '>1–12mo', '<=0.4'], ['Female', '>12mo–6y', '<=0.5'], ['Female', '>6–11y', '<=3.1'], ['Female', '>11–14y', '<=11.9'], ['Female', '>14–18y', '0.5 - 41.7'],
  ['Female', 'Adult', '1.9 - 14.6', 'Follicular'], ['Female', 'Adult', '12.2 - 118.0', 'Midcycle'], ['Female', 'Adult', '0.7 - 12.9', 'Luteal'], ['Female', 'Adult', '5.3 - 65.4', 'Postmenopausal']], 'Context required');
add('PROGESTERONE', 'ng/mL', mayo(800241), 'Source notes puberty-dependent adolescent concentrations and unestablished neonatal intervals. Female adult bands require reproductive context.', [
  ['Male', '4wk–<12mo', '<=0.66'], ['Male', '12mo–9y', '<=0.35'], ['Male', '>=18y', '<0.20'],
  ['Female', '4d–<12mo', '<=1.3'], ['Female', '12mo–9y', '<=0.35'],
  ['Female', '>=18y', '<=0.89', 'Follicular'], ['Female', '>=18y', '<=12', 'Ovulation'], ['Female', '>=18y', '1.8 - 24', 'Luteal'], ['Female', '>=18y', '<=0.20', 'Postmenopausal'],
  ['Female', 'Pregnancy', '11 - 44', 'First trimester'], ['Female', 'Pregnancy', '25 - 83', 'Second trimester'], ['Female', 'Pregnancy', '58 - 214', 'Third trimester']], 'Context required');
add('HSCRP', 'mg/L', mayo(606909), 'Adult cardiovascular risk threshold, not a universal inflammation range. Source does not establish pediatric intervals.', [['Any', '>=18y', '<2.0', 'Cardiovascular risk']]);
add('INSULIN_RANDOM', 'microIU/mL', mayo(800257), 'Source requires an 8-hour fast. Its 2.6–24.9 range cannot govern this RANDOM test; retain a context warning until the lab specifies a random-sampling protocol.', [['Any', 'Source does not split ages', '2.6 - 24.9', 'Fasting only; not applicable to random insulin']], 'Sampling context required');
add('LUPUS_ANTICOAGULANT_', 'ratio', mayo(602179), 'Source screen-ratio threshold is dimensionless; stored seconds is not compatible. A seconds-based screen requires kit-specific controls, confirm and mix testing. Pediatric reference not clearly established.', [['Any', 'Adults; pediatric validation required', '<1.20', 'DRVVT screen ratio only']], 'Unit / assay review');
add('MYOGLOBIN', 'ng/mL', mayo(621090), '1 microgram/L = 1 ng/mL. Confirm serum assay and laboratory validation.', [['Male', 'Source does not split ages', '0 - 72'], ['Female', 'Source does not split ages', '0 - 58']]);
add('NON_HDL_CHOLESTEROL', 'mg/dL', mayo(616727), 'Desirable/acceptable clinical decision limits, not a statistical healthy-population interval. Lower treatment targets depend on cardiovascular risk.', [['Any', '2–17y', '<120', 'Acceptable'], ['Any', '>=18y', '<130', 'Desirable']], 'Decision limits');
add('TESTOSTERONE_TOTAL', 'ng/dL', mayo(83686), 'Morning serum LC-MS/MS candidates; confirm method. Source below-quantification lower bounds (<7) are preserved as text, not turned into zero. Tanner stage cannot be inferred from age.', [
  ['Male', '0–5mo', '75 - 400'], ['Male', '6mo–9y', '<7 - 20'], ['Male', '10–11y', '<7 - 130'], ['Male', '12–13y', '<7 - 800'], ['Male', '14y', '<7 - 1200'], ['Male', '15–16y', '100 - 1200'], ['Male', '17–18y', '300 - 1200'], ['Male', '>=19y', '240 - 950'],
  ['Female', '0–5mo', '20 - 80'], ['Female', '6mo–9y', '<7 - 20'], ['Female', '10–11y', '<7 - 44'], ['Female', '12–16y', '<7 - 75'], ['Female', '17–18y', '20 - 75'], ['Female', '>=19y', '8 - 60']]);
const freeMale = [[5.25,20.7],[5.05,19.8],[4.85,19],[4.65,18.1],[4.46,17.1],[4.26,16.4],[4.06,15.6],[3.87,14.7],[3.67,13.9],[3.47,13],[3.28,12.2],[3.08,11.3],[2.88,10.5],[2.69,9.61],[2.49,8.76],[2.29,7.91]];
const freeFemale = [1.08,1.06,1.03,1,.98,.95,.92,.90,.87,.84,.82,.79,.76,.73,.71,.68];
add('TESTOSTERONE_FREE', 'pg/mL', mayo(8508), 'Source ng/dL converted to catalog pg/mL by multiplying by 10 (dimensional conversion only). Confirm equilibrium-dialysis method; these intervals must not be used for a direct analog assay. Adult bands below; pediatric bands require separate method review.',
  [...freeMale.map(([low, high], i) => ['Male', i===15?'95–100+y':`${20+i*5}–<${25+i*5}y`, `${Number((low*10).toFixed(2))} - ${Number((high*10).toFixed(2))}`]),
    ...freeFemale.map((high,i) => ['Female', i===15?'95–100+y':`${20+i*5}–<${25+i*5}y`, `<1.3 - ${Number((high*10).toFixed(2))}`])]);
add('URINE_CORTISOL', 'microgram/24 h', mayo(8546), '24-hour collection and LC-MS/MS method required. Source does not establish intervals at age 0–2 years.', [['Any', '3–8y', '1.4 - 20'], ['Any', '9–12y', '2.6 - 37'], ['Any', '13–17y', '4.0 - 56'], ['Any', '>=18y', '3.5 - 45']]);
add('UCT', 'ng/mL', mayo(82510), 'Quantitative urine cotinine only. Source describes non-tobacco users without passive exposure; qualitative card cutoffs differ and require the kit insert.', [['Any', 'Exposure context required', '<5.0', 'Non-user; no passive exposure']], 'Method / exposure context');
add('URINE_FOR_CREATININE', 'mg/dL', mayo(610603), 'Random urine only; source has no pediatric range. Confirm this catalog entry is random, not 24-hour excretion.', [['Any', '>=18y', '16 - 326']], 'Sampling context required');
add('URINE_FOR_MICROALBUM', 'mg/g creatinine', mayo(609731), 'These are urine albumin/creatinine ratio thresholds, not a raw albumin concentration. Confirm specimen, reporting units and whether a separate creatinine measurement is part of this test.', [['Male', 'Source does not split ages', '<17', 'ACR only'], ['Female', 'Source does not split ages', '<25', 'ACR only']], 'Unit / assay review');
add('URINE_FOR_PROTEIN', '', urinalysis, 'Dipstick proposal only. Quantitative random protein and 24-hour excretion need distinct units and validated ranges.', [['Any', 'Source does not split ages', 'Negative', 'Dipstick']], 'Qualitative / method review');
add('URINE_SUGAR_FASTING URINE_SUGAR_PP URINE_SUGAR_RANDOM URINE_FOR_KETONE', '', urinalysis, 'Qualitative dipstick reference; quantitative glucose/ketones require their own assay limits. Source does not split age or sex.', [['Any', 'Source does not split ages', 'Negative', 'Dipstick']], 'Qualitative');
add('FUNGAL_SCRAPING_SMEA URINE_FOR_FUNGAL', '', mayo(84390), 'Fungal smear reference only. If the ordered test is culture, use a specimen-specific culture report instead.', [['Any', 'Source does not split ages', 'Negative', 'Fungal smear']], 'Qualitative / method review');
add('STOOL_REDUCING_SUBST', '', 'https://ltd.aruplab.com/Tests/Pub/3002514', 'Qualitative colorimetry. Negative or trace is normal; 1+ through 4+ is abnormal. Not a numeric age/sex range.', [['Any', 'Source does not split ages', 'Negative or trace', 'Normal']], 'Qualitative');
add('GRAM_S_STAIN', '', 'https://sfmc.testcatalog.org/show/SOFT-GRAM', 'Specimen source matters: normal flora may be present. Retain organisms/cells and pathologist findings; do not auto-classify every stain as negative.', [['Any', 'Specimen-specific', 'No WBCs / no organisms seen', 'Normally sterile site; see source']], 'Narrative / specimen context');
add('CULTURE_AND_SENSITIV', '', 'https://mhc.testcatalog.org/show/RTN', 'Routine aerobic culture example only. Specimen, organism identification and susceptibility determine the report; no universal numeric or sex/age range.', [['Any', 'Specimen-specific', 'No growth', 'Routine aerobic culture example']], 'Narrative / specimen context');
add('PAP_SMEAR', '', mayo(70338), 'Bethesda cytology reporting and specimen adequacy required; neither a numeric interval nor a result to prefill.', [['Female', 'Cervical cytology context', 'Negative for intraepithelial lesion or malignancy', 'Satisfactory specimen']], 'Narrative');
add('ABG', '', iowa, 'Arterial specimen only. Add distinct measured pH, pCO2 and pO2 parameters, with their units. Venous/capillary values cannot use these intervals; calculated bicarbonate depends on analyzer convention.', [['Any', '0–1mo', '7.32 - 7.42', 'Arterial pH'], ['Any', '>1mo', '7.35 - 7.45', 'Arterial pH'], ['Any', '0–18y', '30 - 40 mmHg', 'Arterial pCO2'], ['Any', '0–1mo', '60 - 80 mmHg', 'Arterial pO2'], ['Any', '>1mo', '80 - 100 mmHg', 'Arterial pO2']], 'Multiple parameters');
const niddk = 'https://kdigo.org/wp-content/uploads/2024/07/07232024-KDIGO-CKD.pdf';
add('EGFR_CATEGORY', '', niddk, 'Calculated KDIGO G category describes kidney function; CKD diagnosis also needs chronicity and other markers. Existing calculation already returns G1–G5.', [['Any', 'Adults', 'G1 >=90; G2 60–89; G3a 45–59; G3b 30–44; G4 15–29; G5 <15', 'mL/min/1.73m2']], 'Calculated category');
const widal = 'https://www.cdc.gov/yellow-book/hcp/travel-associated-infections-diseases/typhoid-and-paratyphoid-fever.html';
add('WIDAL_SLIDE_METHOD WIDAL_TUBE_METHOD WIDAL_TEST_SLIDE_MET', 'titre', widal, 'No universal age/sex normal titre is proposed. Define O/H/AH/BH and reagent/local baseline thresholds in the lab SOP; CDC describes Widal as unreliable for diagnosis.', [], 'Local baseline required');
add('SKIN_TEST_FOR_LEPROS', '', 'https://www.cdc.gov/leprosy/hcp/diagnosis-testing/index.html', 'Clarify lepromin test versus diagnostic biopsy/stain. Do not invent a negative normal or diagnostic cutoff from this ambiguous name.', [], 'Test identity required');
for (const code of ['BUN_CREATININE_RATIO', 'UREA_CREATININE_RATI', 'NLR', 'TG_HDL', 'SGOT_SGPT'])
  proposals[code] = { unit: '', sourceUrl: '', kind: 'Calculated ratio', notes: 'The configured formula calculates this ratio. The existing database does not supply a universal normal range; laboratory SOP and clinical context must define any decision limits. No numeric normal is invented.', rows: [] };
for (const [code, notes] of [
  ['BLOOD_GROUP_RH', 'ABO and Rh typing are categorical identities. Offer A+, A-, B+, B-, AB+, AB-, O+, O- with Other/discrepancy; no group is a normal age/sex value.'],
  ['FNAC_FINE_NEEDLE_ASP', 'Pathologist cytology narrative and specimen/site-specific diagnosis; a numeric age/sex range is not applicable.'],
  ['PBS_GBP', 'Morphology report; separate RBC, WBC, platelet and parasite findings. A universal numeric normal is not applicable.'],
  ['FLUID_EXAMINATION', 'Specify CSF, pleural, ascitic, synovial or other fluid and measured parameters; reference limits cannot be shared across fluids.'],
  ['STOOL_ROUTINE_EXAMIN', 'Create physical, microscopy and parasite fields using the lab SOP. Existing catalog has no parameter definitions; /HPF cannot be assigned to every finding.'],
  ['URINE_FOR_CHYLE', 'Specify qualitative chyle/chylomicron method and lab-approved normal finding; no arbitrary numeric age/sex range.'],
  ['PH', 'Catalog name is PH Inactive, with Active status in the snapshot. Confirm purpose/status before adding a range; do not assume blood or urine pH.']])
  proposals[code] = { unit: '', sourceUrl: '', kind: 'Lab definition required', notes, rows: [] };

// Supplemental pediatric proposals for currently configured tests. Kept
// separate from existing ranges, including conflicting existing adult bands.
for (const [code, unit, rows] of [
  ['MCV','fL', [['0–1mo','88 - 123'], ['1–3mo','91 - 112'], ['3–6mo','74 - 108'], ['6–12mo','70 - 85']]],
  ['MCH','pg', [['0–1mo','31 - 37'], ['1–3mo','27 - 36'], ['3–6mo','25 - 35'], ['6–12mo','23 - 31']]],
  ['MCHC','g/dL', [['0–6mo','28 - 36'], ['6–12mo','32 - 36']]],
  ['TOTAL_RBC_COUNT','million/cumm', [['0–1mo','3.90 - 5.90'], ['1–2mo','3.10 - 5.30'], ['2–3mo','2.70 - 4.50'], ['3–6mo','3.10 - 5.10'], ['6–12mo','3.90 - 5.50']]],
  ['HCT','%', [['0–1mo','42 - 65'], ['1–2mo','33 - 55'], ['2–3mo','28 - 41'], ['3–6mo','29 - 41'], ['6–12mo','31 - 41']]]])
  add(code,unit,iowa,'Supplemental pediatric candidates. Reconcile source age boundaries and overlapping existing ranges before adopting; existing database values remain primary.',rows.map(([age,range])=>['Any',age,range]),'Pediatric supplement');
const thyroidAges = ['0–5d','6d–2mo','3–11mo','1–5y','6–10y','11–19y','>=20y'];
add('TSH','microIU/mL',mayo(800096),'1 mIU/L = 1 microIU/mL. Method-specific pediatric/adult candidates; pregnancy requires separate validated interpretation.',[[.7,15.2],[.7,11],[.7,8.4],[.7,6],[.6,4.8],[.5,4.3],[.3,4.2]].map(([l,h],i)=>['Any',thyroidAges[i],`${l} - ${h}`]),'Age supplement');
add('FT4','pg/mL',mayo(800463),'Source ng/dL converted to catalog pg/mL by multiplying by 10. Confirm method and pregnancy context.',[[.9,2.5],[.9,2.2],[.9,2],[1,1.8],[1,1.7],[1,1.6],[.9,1.7]].map(([l,h],i)=>['Any',thyroidAges[i],`${l*10} - ${h*10}`]),'Age supplement');
add('T4','microgram/dL',mayo(36108),'Total thyroxine candidates; binding-protein changes and pregnancy affect interpretation. Preserve current ranges until assay review.',[[5,18.5],[5.4,17],[5.7,16],[6,14.7],[6,13.8],[5.9,13.2],[4.5,11.7]].map(([l,h],i)=>['Any',thyroidAges[i],`${l} - ${h}`]),'Age supplement');
add('SERUM_ALKALINE_PHOSP','U/L',mayo(8340),'Age and sex-specific alkaline phosphatase candidates. Confirm method before replacing the current single interval.',[
  ['Male','0–14d','83 - 248'],['Male','15d–<1y','122 - 469'],['Male','1–<10y','142 - 335'],['Male','10–<13y','129 - 417'],['Male','13–<15y','116 - 468'],['Male','15–<17y','82 - 331'],['Male','17–<19y','55 - 149'],['Male','>=19y','40 - 129'],
  ['Female','0–14d','83 - 248'],['Female','15d–<1y','122 - 469'],['Female','1–<10y','142 - 335'],['Female','10–<13y','129 - 417'],['Female','13–<15y','57 - 254'],['Female','15–<17y','50 - 117'],['Female','>=17y','35 - 104']], 'Age supplement');

module.exports = proposals;
