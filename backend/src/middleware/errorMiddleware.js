const { errorResponse } = require('../utils/response');
const { NODE_ENV } = require('../config/environment');

const MULTER_ERROR_MESSAGES = {
  LIMIT_FILE_SIZE: 'File is too large. Maximum allowed size exceeded.',
  LIMIT_FILE_COUNT: 'Too many files uploaded.',
  LIMIT_FIELD_COUNT: 'Too many form fields.',
  LIMIT_FIELD_KEY: 'Form field name is too long.',
  LIMIT_FIELD_VALUE: 'Form field value is too large.',
  LIMIT_PART_COUNT: 'Too many upload parts in the request.',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field in the upload.'
};

const errorHandler = (err, req, res, next) => {
  console.error('Unhandled Server Error: ', err);

  // Multer 2.x upload failures are client errors (400), never 500s.
  // err may be a MulterError (code like LIMIT_FILE_SIZE) or a fileFilter
  // rejection carrying statusCode 400.
  const isMulterError = err && (err.name === 'MulterError' || MULTER_ERROR_MESSAGES[err.code]);
  if (isMulterError) {
    return errorResponse(
      res,
      MULTER_ERROR_MESSAGES[err.code] || err.message || 'File upload failed.',
      400
    );
  }

  // NOTE: parentheses matter — `||` binds tighter than `?:`, so without them
  // this expression always evaluated to 500 and masked intended statuses.
  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode) || 500;
  const message = err.message || 'Internal Server Error';

  return errorResponse(
    res,
    message,
    statusCode,
    NODE_ENV === 'development' ? { stack: err.stack } : null
  );
};

module.exports = errorHandler;
