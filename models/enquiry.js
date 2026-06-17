const mongoose = require('mongoose');

const EnquirySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Links to the sender
  name: String,
  phone: String,
  email: String,
  service: String,
  message: String,
  status: { type: String, default: 'Pending' }, // Helpful for CRM
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Enquiry', EnquirySchema);