// Database configuration - Updated to use PIM database
module.exports = {
  database: {
    host: 'localhost',
    port: 5432,
    database: 'pim',  // Changed from nocodb_prd to pim
    user: 'devuser',
    password: 'VerifyTen102025',
  },
  server: {
    port: process.env.PORT || 8087,
  }
};
