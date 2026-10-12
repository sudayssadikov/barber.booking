export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const fail = (status, message, code) => { throw new HttpError(status, message, code); };
export const ensure = (cond, status, message, code) => { if (!cond) fail(status, message, code); };
// Validatsiya xatosi (matn yoki null) boʻlsa — 400
export const valid = (err) => { if (err) fail(400, err, "invalid"); };
export const body = (req) => (req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {});
