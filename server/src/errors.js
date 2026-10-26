'use strict';
class ApiError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}
const bad = (code, msg) => new ApiError(400, code, msg);
module.exports = { ApiError, bad };
