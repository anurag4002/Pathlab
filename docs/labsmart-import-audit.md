# User-provided Labsmart import

Applied: 210 tests; 307 fields; 26 multi-parameter tests; 203 age/sex rows; 16 text references; 79 interpretations.

30 existing formulas retained. Test IDs and existing parameter codes are retained, including INR control inputs. Source files contain no formula expressions. Known fees are imported; null fees keep the existing price.

86 source interpretation records are preserved. 79 contain text; Random Blood Sugar, Transferrin Saturation, UIBC, eGFR, eGFR Category, SGOT/SGPT, Hepatitis C Virus, HCV have empty source text and do not create blank advice rows.

All original source files are saved in backend/data/labsmart. Exact day boundaries, numeric limits, display text and original units remain available in sourceRange. The source uses 365 days per year. Whole-year boundaries are displayed in years; other boundaries retain days.

Report, patient and bill records are not modified. Source references left blank remain blank; external review proposals are not substituted.

## 145 field references left blank by the source

| Test | Field | Source ID |
|---|---|---|
| Blood Group & Rh. | ABO | 5714557 |
| Blood Group & Rh. | Rh (ANTI -D) | 5714558 |
| Malaria Parasite (Card Test) | Plasmodium falciparum "Pf" | 5714562 |
| Malaria Parasite (Card Test) | Plasmodium vivax "Pv" | 5714563 |
| Malaria Parasite (Microscopic) | Malaria Parasite (Microscopic) | 5714564 |
| Filarial Parasite (Card Test) | Filarial Parasite (Card Test) | 5714565 |
| Prothrombin time, PT/INR | Control Value | 5714575 |
| Prothrombin time, PT/INR | ISI (International sensitivity index) | 5714576 |
| Activated partial thromboplastin time, APTT | Control Value | 5714579 |
| Neutrophil Lymphocyte Ratio | Neutrophil Lymphocyte Ratio | 5714585 |
| Lupus Anticoagulant (DRVVT) | Patient Value | 5714586 |
| Lupus Anticoagulant (DRVVT) | Control Value | 5714587 |
| Lupus Anticoagulant (DRVVT) | Screen Ratio | 5714588 |
| Lupus Anticoagulant (DRVVT) | DRVVT Screening | 5714589 |
| TG / HDL | TG / HDL | 5714611 |
| BUN / Creatinine Ratio | BUN / Creatinine Ratio | 5714615 |
| Urea / Creatinine Ratio | Urea / Creatinine Ratio | 5714616 |
| Stool reducing substances | Stool reducing substances | 5714638 |
| Estradiol | Estradiol | 5714658 |
| DHEA | DHEA | 5714659 |
| Creatine Kinase | Creatine Kinase | 5714661 |
| Indirect Coomb's Test | Indirect Coomb's Test | 5714665 |
| Direct Coomb's Test | Direct Coomb's Test | 5714666 |
| Arterial Blood Gas | pH | 5714675 |
| Arterial Blood Gas | PCO2 | 5714676 |
| Arterial Blood Gas | Bicarbonate (HCO3 | 5714677 |
| Arterial Blood Gas | Total CO2 Contents (TCO2) | 5714678 |
| Arterial Blood Gas | Standard Bicarbonate (SBC) | 5714679 |
| Arterial Blood Gas | Base Excess | 5714680 |
| Arterial Blood Gas | PO2 | 5714681 |
| Arterial Blood Gas | Oxygen saturation capacity | 5714682 |
| Arterial Blood Gas | Base Excess - Extracellular fluid | 5714683 |
| Arterial Blood Gas | Hemoglobin | 5714684 |
| Non-HDL cholesterol | Non-HDL cholesterol | 5714688 |
| eGFR Category | eGFR Category | 5714691 |
| C3 Complement | C3 Complement | 5714692 |
| High-Sensitivity C-Reactive Protein | High-Sensitivity C-Reactive Protein | 5714693 |
| ANTI MULLERIAN HORMONE | ANTI MULLERIAN HORMONE | 5714694 |
| SGOT/SGPT | SGOT/SGPT | 5714701 |
| Widal Test (Slide Method) | Salmonella Typhi 'O' | 5714704 |
| Widal Test (Slide Method) | Salmonella Typhi 'H' | 5714705 |
| Widal Test (Slide Method) | Salmonella Typhi 'AH' | 5714706 |
| Widal Test (Slide Method) | Salmonella Typhi 'BH' | 5714707 |
| Malaria Antigen | IgG | 5714708 |
| Malaria Antigen | IgM | 5714709 |
| HIV (Card Test) | HIV - 1 | 5714710 |
| HIV (Card Test) | HIV - 2 | 5714711 |
| Hepatitis C Virus, HCV | Hepatitis C Virus, HCV | 5714712 |
| VDRL | VDRL | 5714713 |
| HBsAg | HBsAg | 5714714 |
| Typhidot Antibodies | IgG | 5714716 |
| Typhidot Antibodies | IgM | 5714717 |
| Chikungunya | Chikungunya | 5714720 |
| Rheumatoid Factor, RA (Qualitative) | Rheumatoid Factor, RA (Qualitative) | 5714723 |
| C-Reactive Protein, CRP (Qualitative) | C-Reactive Protein, CRP (Qualitative) | 5714725 |
| Dengue NS1 Antigen | Dengue NS1 Antigen | 5714726 |
| Dengue (Card Method) | NS1 Antigen | 5714727 |
| Dengue (Card Method) | IgM | 5714728 |
| Dengue (Card Method) | IgG | 5714729 |
| Beta Human Chorionic Gonodotropin (HCG) | Beta Human Chorionic Gonodotropin (HCG) | 5714730 |
| Anti Nuclear Antibody (ANA) by ELISA | Anti Nuclear Antibody (ANA) by ELISA | 5714740 |
| Insulin Random | Insulin Random | 5714741 |
| Testosterone Free | Testosterone Free | 5714742 |
| Testosterone Total | Testosterone Total | 5714743 |
| Progesterone | Progesterone | 5714744 |
| Myoglobin | Myoglobin | 5714745 |
| Beta 2 Glycoprotein 1, IgG | Beta 2 Glycoprotein 1, IgG | 5714746 |
| Beta 2 Glycoprotein 1, IgM | Beta 2 Glycoprotein 1, IgM | 5714747 |
| Anti Phospholipid IgG | Anti Phospholipid IgG | 5714748 |
| Anti Phospholipid IgM | Anti Phospholipid IgM | 5714749 |
| Anti Cardiolipin IgG | Anti Cardiolipin IgG | 5714750 |
| Anti Cardiolipin IgM | Anti Cardiolipin IgM | 5714751 |
| WEIL FELIX TEST, SERUM | Proteus Antigen OX 19 | 5714752 |
| WEIL FELIX TEST, SERUM | Proteus Antigen OX 2 | 5714753 |
| WEIL FELIX TEST, SERUM | Proteus Antigen OX K | 5714754 |
| Dengue IgG | Dengue IgG | 5714755 |
| Dengue IgM | Dengue IgM | 5714756 |
| Dengue IgG & IgM | IgG | 5714757 |
| Dengue IgG & IgM | IgM | 5714758 |
| Urine for creatinine | Urine for creatinine | 5714759 |
| Urine for ELISA (Pregnancy) | Urine for ELISA (Pregnency) | 5714760 |
| Urine for Fungal | Urine for Fungal | 5714761 |
| Urine for Ketone | Urine for Ketone | 5714762 |
| Urine for Microalbumin | Urine for Microalbumin | 5714763 |
| Urine for Protein | Urine for Protein | 5714764 |
| Urine Pregnancy Test | Urine Pregnancy Test | 5714765 |
| Urine for AFB 24 hours | Urine for AFB 24 hours | 5714766 |
| Urine for Chyle | Urine for Chyle | 5714767 |
| Semen Examination | Colour | 5714769 |
| Semen Examination | Ph | 5714770 |
| Semen Examination | Collection At | 5714771 |
| Semen Examination | Liquefaction Time | 5714772 |
| Semen Examination | Semen Fructose | 5714773 |
| Semen Examination | Rapid Progressive | 5714775 |
| Semen Examination | Sluggish Progressive | 5714776 |
| Semen Examination | Non Progressive | 5714777 |
| Semen Examination | Immotile | 5714778 |
| Semen Examination | Abnormal Forms | 5714779 |
| Semen Examination | Epithelial Cells | 5714780 |
| Semen Examination | R.B.C. | 5714781 |
| Semen Examination | Pus cell | 5714782 |
| Urine Sugar Fasting | Urine Sugar Fasting | 5714783 |
| Stool Routine Examination | Colour | 5714784 |
| Stool Routine Examination | Consistency | 5714785 |
| Stool Routine Examination | Mucus | 5714786 |
| Stool Routine Examination | Blood | 5714787 |
| Stool Routine Examination | Occult Blood | 5714788 |
| Stool Routine Examination | Parasites | 5714789 |
| Stool Routine Examination | Undigested Food Particles | 5714790 |
| Stool Routine Examination | OVA | 5714791 |
| Stool Routine Examination | Cysts | 5714792 |
| Stool Routine Examination | Pus Cells | 5714793 |
| Stool Routine Examination | Red Blood Cells | 5714794 |
| Stool Routine Examination | Macrophages | 5714795 |
| Urine Sugar PP | Urine Sugar PP | 5714796 |
| Urine Sugar Random | Urine Sugar Random | 5714797 |
| Urine Routine Examination | Quantity | 5714798 |
| Urine Routine Examination | Crystals | 5714811 |
| Fluid Examination | Sample Type | 5714817 |
| Fluid Examination | Coagulum | 5714818 |
| Fluid Examination | Volume | 5714819 |
| Fluid Examination | Appearance | 5714820 |
| Fluid Examination | Colour | 5714821 |
| Fluid Examination | pH (Reaction) | 5714822 |
| Fluid Examination | Protein | 5714823 |
| Fluid Examination | Glucose | 5714824 |
| Fluid Examination | Total Leukocyte Count | 5714825 |
| Fluid Examination | Neutrophils | 5714826 |
| Fluid Examination | Lymphocyte | 5714827 |
| Fluid Examination | RBCs | 5714828 |
| Fluid Examination | Others | 5714829 |
| Urine Cotinine | Urine Cotinine | 5714830 |
| Urine Cortisol | Urine Cortisol | 5714831 |
| Skin test for Leprosy | Skin test for Leprosy | 5714834 |
| Gram's Stain | Sample Type | 5714835 |
| Gram's Stain | Result | 5714836 |
| Acid - Fast Bacilli | Sample Type | 5714837 |
| Acid - Fast Bacilli | Result | 5714838 |
| Skin smear for AFB | Skin smear for AFB | 5714839 |
| Fungal scraping smear | Fungal scraping smear | 5714840 |
| Luteinising Hormone, LH | Luteinising Hormone, LH | 5714849 |
| Follicle Stimulating Hormone, FSH | Follicle Stimulating Hormone, FSH | 5714850 |
| Folic Acid | Folic Acid | 5714851 |
| ADA , SERUM | ADA , SERUM | 7344361 |
| PH Inactive | PH | 9355994 |