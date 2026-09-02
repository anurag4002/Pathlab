const Doctor = require('../models/Doctor');
const { successResponse, errorResponse } = require('../utils/response');
const Activity = require('../models/Activity');

const getDoctors = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const query = {};

    if (status) query.status = status;
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const doctors = await Doctor.find(query).sort({ name: 1 });
    return successResponse(res, 'Doctors list loaded successfully', doctors);
  } catch (error) {
    next(error);
  }
};

const getDoctorById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findById(id);
    if (!doctor) {
      return errorResponse(res, 'Doctor not found', 404);
    }
    return successResponse(res, 'Doctor loaded successfully', doctor);
  } catch (error) {
    next(error);
  }
};

const createDoctor = async (req, res, next) => {
  try {
    const { name, phone, clinicHospital, address, referralPercentage, status } = req.body;

    if (!name || !phone) {
      return errorResponse(res, 'Doctor name and phone are required', 400);
    }

    const doctor = await Doctor.create({
      name,
      phone,
      clinicHospital,
      address,
      referralPercentage: referralPercentage || 0,
      status: status || 'Active'
    });

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Create Doctor',
      module: 'Cases',
      description: `Added referral doctor ${doctor.name}.`
    });

    return successResponse(res, 'Doctor profile created successfully', doctor, 201);
  } catch (error) {
    next(error);
  }
};

const updateDoctor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, clinicHospital, address, referralPercentage, status } = req.body;

    const doctor = await Doctor.findById(id);
    if (!doctor) {
      return errorResponse(res, 'Doctor not found', 404);
    }

    if (name) doctor.name = name;
    if (phone) doctor.phone = phone;
    if (clinicHospital !== undefined) doctor.clinicHospital = clinicHospital;
    if (address !== undefined) doctor.address = address;
    if (referralPercentage !== undefined) doctor.referralPercentage = referralPercentage;
    if (status) doctor.status = status;

    await doctor.save();

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Update Doctor',
      module: 'Cases',
      description: `Updated doctor profile of ${doctor.name}.`
    });

    return successResponse(res, 'Doctor profile updated successfully', doctor);
  } catch (error) {
    next(error);
  }
};

const deleteDoctor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findByIdAndDelete(id);
    if (!doctor) {
      return errorResponse(res, 'Doctor not found', 404);
    }

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Delete Doctor',
      module: 'Cases',
      description: `Removed doctor profile of ${doctor.name}.`
    });

    return successResponse(res, 'Doctor profile deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor
};
