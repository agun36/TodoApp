function wantsJson(req) {
  if (req.query.format === 'json') return true;
  if (req.is('application/json')) return true;
  const accept = req.get('Accept') || '';
  if (accept.includes('application/json')) return true;
  return req.accepts(['html', 'json']) === 'json';
}

function jsonOk(res, data, status) {
  return res.status(status || 200).json({ success: true, ...data });
}

function jsonError(res, message, status) {
  return res.status(status || 400).json({ success: false, message });
}

module.exports = { wantsJson, jsonOk, jsonError };
