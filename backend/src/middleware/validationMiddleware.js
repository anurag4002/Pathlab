const { errorResponse } = require('../utils/response');

const validate = (validatorFunc) => {
  return (req, res, next) => {
    const { errors, isValid } = validatorFunc(req.body);
    if (!isValid) {
      return errorResponse(res, 'Validation failed', 400, errors);
    }
    next();
  };
};

module.exports = validate;
