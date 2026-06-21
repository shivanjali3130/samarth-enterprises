// This file exists only for legacy compatibility.
// Vercel should invoke the nested function at server/api/index.js directly.
const app = require('../server/api/index');
module.exports = app;
