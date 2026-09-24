const seedData = {
  users: [
    {
      name: 'Dr. Ramesh Kumar',
      email: 'admin@purepathlab.com',
      phone: '9876543210',
      role: 'Admin',
      password: 'admin123',
      status: 'Active'
    },
    {
      name: 'Sunita Sharma',
      email: 'staff@purepathlab.com',
      phone: '9876543211',
      role: 'Employee',
      password: 'staff123',
      status: 'Active'
    },
    {
      name: 'Dr. Anil Mehta',
      email: 'doctor@purepathlab.com',
      phone: '9876543212',
      role: 'Doctor',
      password: 'doctor123',
      status: 'Active'
    }
  ],
  doctors: [
    {
      name: 'Dr. Vivek Sharma',
      phone: '9812345670',
      clinicHospital: 'City Health Clinic',
      address: 'Sector 15, Dwarka, New Delhi',
      referralPercentage: 15,
      status: 'Active'
    },
    {
      name: 'Dr. Preeti Ahluwalia',
      phone: '9812345671',
      clinicHospital: 'Metro Heart Institute',
      address: 'Connaught Place, New Delhi',
      referralPercentage: 20,
      status: 'Active'
    },
    {
      name: 'Dr. Sanjay Gupta',
      phone: '9812345672',
      clinicHospital: 'Max Hospital',
      address: 'Saket, New Delhi',
      referralPercentage: 10,
      status: 'Active'
    }
  ],
  agents: [
    {
      name: 'Ravi Kumar',
      phone: '9711223344',
      commissionPercentage: 5,
      status: 'Active'
    },
    {
      name: 'Vikram Singh',
      phone: '9711223345',
      commissionPercentage: 8,
      status: 'Active'
    }
  ],
  categories: [
    { name: 'Hematology', description: 'Study of blood cells and coagulation' },
    { name: 'Biochemistry', description: 'Chemical analysis of bodily fluids' },
    { name: 'Hormones', description: 'Endocrine and hormone profile tests' },
    { name: 'Kidney Function', description: 'Renal profile tests' },
    { name: 'Liver Function', description: 'Hepatic profile tests' },
    { name: 'Immunology', description: 'Serology and immune system tests' },
    { name: 'Lipid Profile', description: 'Cholesterol and triglyceride panels' },
    { name: 'Urine Analysis', description: 'Urine routine and microscopy' }
  ],
  tests: [
    // Hematology
    {
      name: 'Hemoglobin (Hb)',
      code: 'HB',
      categoryName: 'Hematology',
      sampleType: 'Blood (EDTA)',
      unit: 'g/dL',
      referenceRange: '12.0 - 16.0',
      maleReferenceRange: '13.5 - 17.5',
      femaleReferenceRange: '12.0 - 15.5',
      price: 150,
      description: 'Measures hemoglobin levels in blood',
      interpretation: 'Low hemoglobin indicates anemia. High hemoglobin could be due to dehydration or polycythemia.'
    },
    {
      name: 'Total Leukocyte Count (TLC)',
      code: 'TLC',
      categoryName: 'Hematology',
      sampleType: 'Blood (EDTA)',
      unit: '/cumm',
      referenceRange: '4000 - 11000',
      price: 150,
      description: 'Counts white blood cells',
      interpretation: 'Elevated levels (leukocytosis) suggest infection, inflammation, or leukemia.'
    },
    {
      name: 'Differential Leukocyte Count (DLC)',
      code: 'DLC',
      categoryName: 'Hematology',
      sampleType: 'Blood (EDTA)',
      unit: '%',
      referenceRange: 'Neutrophils: 40-70, Lymphocytes: 20-40',
      price: 150,
      description: 'Percentage of different types of white blood cells',
      interpretation: 'Assists in defining specific types of infections or allergy.'
    },
    {
      name: 'Erythrocyte Sedimentation Rate (ESR)',
      code: 'ESR',
      categoryName: 'Hematology',
      sampleType: 'Blood (Citrate)',
      unit: 'mm/hr',
      referenceRange: '0 - 20',
      maleReferenceRange: '0 - 15',
      femaleReferenceRange: '0 - 20',
      price: 120,
      description: 'Rate at which red blood cells sediment in one hour',
      interpretation: 'Higher rates indicate inflammation in the body.'
    },
    // Biochemistry
    {
      name: 'Blood Sugar (Random)',
      code: 'BS_R',
      categoryName: 'Biochemistry',
      sampleType: 'Blood (Fluoride)',
      unit: 'mg/dL',
      referenceRange: '70 - 140',
      price: 100,
      description: 'Measures blood glucose at any random time',
      interpretation: 'Elevated sugar indicates diabetes mellitus.'
    },
    {
      name: 'Serum Bilirubin Total',
      code: 'S_BIL_T',
      categoryName: 'Biochemistry',
      sampleType: 'Blood (Serum)',
      unit: 'mg/dL',
      referenceRange: '0.2 - 1.2',
      price: 150,
      description: 'Total bilirubin in blood',
      interpretation: 'Higher levels suggest jaundice or biliary blockage.'
    },
    // Kidney
    {
      name: 'Blood Urea',
      code: 'B_UREA',
      categoryName: 'Kidney Function',
      sampleType: 'Blood (Serum)',
      unit: 'mg/dL',
      referenceRange: '15 - 45',
      price: 120,
      description: 'Amount of urea nitrogen in blood',
      interpretation: 'Elevated levels suggest impaired renal clearance.'
    },
    {
      name: 'Serum Creatinine',
      code: 'S_CREAT',
      categoryName: 'Kidney Function',
      sampleType: 'Blood (Serum)',
      unit: 'mg/dL',
      referenceRange: '0.6 - 1.2',
      maleReferenceRange: '0.7 - 1.3',
      femaleReferenceRange: '0.6 - 1.1',
      price: 150,
      description: 'Waste product Creatinine levels in blood',
      interpretation: 'Key marker for kidney function filtration assessment.'
    },
    // Hormones
    {
      name: 'Thyroid Stimulating Hormone (TSH)',
      code: 'TSH',
      categoryName: 'Hormones',
      sampleType: 'Blood (Serum)',
      unit: 'uIU/mL',
      referenceRange: '0.4 - 4.5',
      price: 250,
      description: 'Hormone managing thyroid glands',
      interpretation: 'High levels indicate hypothyroidism. Low levels indicate hyperthyroidism.'
    },
    // Liver Function
    {
      name: 'SGOT (AST)',
      code: 'SGOT',
      categoryName: 'Liver Function',
      sampleType: 'Blood (Serum)',
      unit: 'U/L',
      referenceRange: '8 - 33',
      price: 180,
      description: 'Aspartate aminotransferase liver enzyme',
      interpretation: 'Elevated SGOT suggests liver cell injury, hepatitis or alcohol-related change.'
    },
    {
      name: 'SGPT (ALT)',
      code: 'SGPT',
      categoryName: 'Liver Function',
      sampleType: 'Blood (Serum)',
      unit: 'U/L',
      referenceRange: '4 - 36',
      price: 180,
      description: 'Alanine aminotransferase liver enzyme',
      interpretation: 'Elevated SGPT is a sensitive marker of liver injury.'
    },
    // Lipid Profile
    {
      name: 'Total Cholesterol',
      code: 'CHOL',
      categoryName: 'Lipid Profile',
      sampleType: 'Blood (Serum)',
      unit: 'mg/dL',
      referenceRange: '125 - 200',
      price: 200,
      description: 'Total blood cholesterol level',
      interpretation: 'Values above 200 mg/dL increase cardiovascular risk.'
    },
    {
      name: 'HDL Cholesterol',
      code: 'HDL',
      categoryName: 'Lipid Profile',
      sampleType: 'Blood (Serum)',
      unit: 'mg/dL',
      referenceRange: '40 - 80',
      price: 220,
      description: 'High-density lipoprotein (good cholesterol)',
      interpretation: 'Higher HDL is protective against heart disease.'
    },
    // Biochemistry
    {
      name: 'HbA1c (Glycated Hemoglobin)',
      code: 'HBA1C',
      categoryName: 'Biochemistry',
      sampleType: 'Blood (EDTA)',
      unit: '%',
      referenceRange: '4.0 - 5.6',
      price: 300,
      description: 'Three-month average blood sugar marker',
      interpretation: 'HbA1c above 6.5% indicates diabetes mellitus.'
    },
    // Urine
    {
      name: 'Urine Routine Examination',
      code: 'URINE',
      categoryName: 'Urine Analysis',
      sampleType: 'Urine (Spot)',
      unit: '',
      referenceRange: 'Normal limits',
      price: 150,
      description: 'Physical, chemical and microscopic urine analysis',
      interpretation: 'Protein or glucose in urine warrants further evaluation.'
    }
  ],
  packages: [
    {
      name: 'Thyroid Package',
      price: 450,
      gender: 'All',
      testCodes: ['TSH'],
      description: 'Standard thyroid assessment'
    },
    {
      name: 'Hemogram (CBC/ESR)',
      price: 350,
      gender: 'All',
      testCodes: ['HB', 'TLC', 'DLC', 'ESR'],
      description: 'Complete blood count and inflammatory index'
    },
    {
      name: 'Kidney Profile Basic',
      price: 200,
      gender: 'All',
      testCodes: ['B_UREA', 'S_CREAT'],
      description: 'Basic tests evaluating renal health status'
    },
    {
      name: 'Full Body Checkup Essential',
      price: 499,
      gender: 'All',
      testCodes: ['HB', 'BS_R', 'B_UREA', 'S_CREAT'],
      description: 'Essential yearly health screening bundle'
    }
  ],
  patients: [
    {
      name: 'Aarav Mehta',
      age: 29,
      gender: 'Male',
      phone: '9988776655',
      address: 'Flat 102, Shanti Kunj, Rohini, Delhi'
    },
    {
      name: 'Meera Deshmukh',
      age: 34,
      gender: 'Female',
      phone: '9988776656',
      address: 'Pocket C, Mayur Vihar, Delhi'
    },
    {
      name: 'Rohan Joshi',
      age: 56,
      gender: 'Male',
      phone: '9988776657',
      address: 'Wz-23, Uttam Nagar, Delhi'
    },
    {
      name: 'Priya Nair',
      age: 27,
      gender: 'Female',
      phone: '9811012233',
      uhid: 'UHID-1004',
      address: 'A-44, Laxmi Nagar, Delhi'
    },
    {
      name: 'Amit Verma',
      age: 41,
      gender: 'Male',
      phone: '9811044556',
      address: 'RZ-18, Palam Colony, Delhi'
    },
    {
      name: 'Sunita Iyer',
      age: 63,
      gender: 'Female',
      phone: '9899100112',
      uhid: 'UHID-1006',
      address: 'C-9, Safdarjung Enclave, Delhi'
    },
    {
      name: 'Rajesh Kumar',
      age: 48,
      gender: 'Male',
      phone: '9811077889',
      address: 'Plot 7, Mundka Industrial Area, Delhi'
    },
    {
      name: 'Kavita Singh',
      age: 35,
      gender: 'Female',
      phone: '9899133445',
      address: 'H.No. 212, Shahdara, Delhi'
    },
    {
      name: 'Mohammed Farhan',
      age: 31,
      gender: 'Male',
      phone: '9811166778',
      uhid: 'UHID-1009',
      address: 'Gali No. 4, Zakir Nagar, Delhi'
    },
    {
      name: 'Ananya Das',
      age: 24,
      gender: 'Female',
      phone: '9899177889',
      address: 'FD-4, Munirka, Delhi'
    },
    {
      name: 'Vikram Chauhan',
      age: 52,
      gender: 'Male',
      phone: '9811199001',
      address: 'Village Khera Kalan, Delhi'
    },
    {
      name: 'Pooja Bansal',
      age: 29,
      gender: 'Female',
      phone: '9899112233',
      uhid: 'UHID-1012',
      address: 'B-72, Vivek Vihar, Delhi'
    }
  ],
  expenses: [
    {
      category: 'Medical Supplies',
      amount: 4500,
      description: 'Purchased blood collection tubes (EDTA/Citrate) and syringes',
      paymentMethod: 'UPI'
    },
    {
      category: 'Office Rent',
      amount: 15000,
      description: 'Lab facility rent for August',
      paymentMethod: 'Card'
    },
    {
      category: 'Electricity Bill',
      amount: 3200,
      description: 'Power charges for cooling chambers and equipment',
      paymentMethod: 'Cash'
    }
  ],
  panels: [
    {
      name: 'CBC Panel',
      price: 399,
      testCodes: ['HB', 'TLC', 'DLC', 'ESR'],
      description: 'Complete blood count with ESR'
    },
    {
      name: 'Kidney Mini Panel',
      price: 249,
      testCodes: ['B_UREA', 'S_CREAT'],
      description: 'Urea + creatinine kidney screen'
    }
  ],
  interpretations: [
    {
      testCode: 'HB',
      resultCondition: 'Below 12.0 g/dL (adult)',
      interpretationText: 'Low hemoglobin suggests iron deficiency anemia. Recommend serum ferritin and peripheral smear.',
      normalAbnormalGuidance: 'Abnormal'
    },
    {
      testCode: 'TSH',
      resultCondition: 'Above 4.5 uIU/mL',
      interpretationText: 'Raised TSH with normal T3/T4 suggests subclinical hypothyroidism. Correlate clinically.',
      normalAbnormalGuidance: 'Abnormal'
    },
    {
      testCode: 'S_CREAT',
      resultCondition: 'Above 1.2 mg/dL',
      interpretationText: 'Elevated creatinine indicates reduced glomerular filtration. Review hydration, medication and repeat.',
      normalAbnormalGuidance: 'Abnormal'
    }
  ],
  tickets: [
    {
      subject: 'Sample collection delayed in Shahdara beats',
      message: 'Phlebo reached 40 minutes late for two home collections this morning. Please review roster.',
      status: 'Open'
    },
    {
      subject: 'Report header shows old phone number',
      message: 'Printed reports carried the old landline in the header. Fixed after updating the lab profile.',
      status: 'Closed'
    }
  ],
  browsers: [
    { code: 'FRONT-DESK-01', label: 'Front Desk PC', status: 'Active' },
    { code: 'LAB-PC-02', label: 'Lab Reporting Room PC', status: 'Active' }
  ]
};

module.exports = seedData;
