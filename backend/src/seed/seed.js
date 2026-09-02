const mongoose = require('mongoose');
const { MONGO_URI } = require('../config/environment');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Agent = require('../models/Agent');
const TestCategory = require('../models/TestCategory');
const Test = require('../models/Test');
const TestPackage = require('../models/TestPackage');
const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Activity = require('../models/Activity');
const seedData = require('./seedData');

const seedDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    // Clear DB collections
    await User.deleteMany();
    await Patient.deleteMany();
    await Doctor.deleteMany();
    await Agent.deleteMany();
    await TestCategory.deleteMany();
    await Test.deleteMany();
    await TestPackage.deleteMany();
    await Bill.deleteMany();
    await BillItem.deleteMany();
    await Transaction.deleteMany();
    await Expense.deleteMany();
    await Activity.deleteMany();
    console.log('Database collections cleared.');

    // Seed Users
    const users = await User.create(seedData.users);
    console.log(`Seeded ${users.length} users.`);
    const adminUser = users.find(u => u.role === 'Admin');

    // Seed Doctors
    const doctors = await Doctor.create(seedData.doctors);
    console.log(`Seeded ${doctors.length} doctors.`);

    // Seed Agents
    const agents = await Agent.create(seedData.agents);
    console.log(`Seeded ${agents.length} agents.`);

    // Seed Categories
    const categories = await TestCategory.create(seedData.categories);
    console.log(`Seeded ${categories.length} categories.`);

    // Seed Tests
    const testsToSeed = seedData.tests.map(test => {
      const category = categories.find(c => c.name === test.categoryName);
      return {
        name: test.name,
        code: test.code,
        category: category._id,
        sampleType: test.sampleType,
        unit: test.unit,
        referenceRange: test.referenceRange,
        maleReferenceRange: test.maleReferenceRange,
        femaleReferenceRange: test.femaleReferenceRange,
        price: test.price,
        description: test.description,
        interpretation: test.interpretation,
        status: 'Active'
      };
    });
    const tests = await Test.create(testsToSeed);
    console.log(`Seeded ${tests.length} tests.`);

    // Seed Packages
    const packagesToSeed = seedData.packages.map(pkg => {
      const pkgTests = tests.filter(t => pkg.testCodes.includes(t.code)).map(t => t._id);
      return {
        name: pkg.name,
        price: pkg.price,
        gender: pkg.gender,
        includedTests: pkgTests,
        description: pkg.description,
        status: 'Active'
      };
    });
    const packages = await TestPackage.create(packagesToSeed);
    console.log(`Seeded ${packages.length} packages.`);

    // Seed Patients
    const patientsData = seedData.patients.map((p, idx) => ({
      ...p,
      registrationNumber: `PPL-20260824-0000${idx + 1}`,
      referringDoctor: doctors[idx % doctors.length]._id
    }));
    const patients = await Patient.create(patientsData);
    console.log(`Seeded ${patients.length} patients.`);

    // Seed Expenses
    await Expense.create(seedData.expenses);
    console.log('Seeded operational expenses.');

    // Seed Bills and Transactions (To populate dashboard metrics)
    const bill1Items = [
      { itemType: 'Test', itemId: tests[0]._id, name: tests[0].name, price: tests[0].price },
      { itemType: 'Test', itemId: tests[1]._id, name: tests[1].name, price: tests[1].price }
    ];

    const bill1 = new Bill({
      billNumber: 'INV-20260824-00001',
      patient: patients[0]._id,
      referringDoctor: doctors[0]._id,
      agent: agents[0]._id,
      discount: 50,
      totalAmount: 250, // (150 + 150) - 50 discount
      paidAmount: 250,
      dueAmount: 0,
      paymentMethod: 'UPI',
      paymentStatus: 'Paid',
      createdBy: adminUser._id
    });
    await bill1.save();

    const items1 = await BillItem.create(bill1Items.map(item => ({ ...item, billId: bill1._id })));
    bill1.items = items1.map(i => i._id);
    await bill1.save();

    await Transaction.create({
      patient: patients[0]._id,
      bill: bill1._id,
      amount: 250,
      paymentMethod: 'UPI',
      type: 'Income',
      receivedBy: adminUser._id
    });

    // Bill 2 (Partial Payment Invoice)
    const bill2Items = [
      { itemType: 'TestPackage', itemId: packages[1]._id, name: packages[1].name, price: packages[1].price }
    ];

    const bill2 = new Bill({
      billNumber: 'INV-20260824-00002',
      patient: patients[1]._id,
      referringDoctor: doctors[1]._id,
      agent: agents[1]._id,
      discount: 0,
      totalAmount: 350,
      paidAmount: 150,
      dueAmount: 200,
      paymentMethod: 'Cash',
      paymentStatus: 'Partial',
      createdBy: adminUser._id
    });
    await bill2.save();

    const items2 = await BillItem.create(bill2Items.map(item => ({ ...item, billId: bill2._id })));
    bill2.items = items2.map(i => i._id);
    await bill2.save();

    await Transaction.create({
      patient: patients[1]._id,
      bill: bill2._id,
      amount: 150,
      paymentMethod: 'Cash',
      type: 'Income',
      receivedBy: adminUser._id
    });

    // Seed Activity Log
    await Activity.create({
      user: adminUser._id,
      action: 'Database Seeding',
      module: 'System',
      description: 'System initial database populated with demo credentials and tests.'
    });

    console.log('Seeding process completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding Process Error:', error);
    process.exit(1);
  }
};

seedDB();
