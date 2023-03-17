const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  tour: {
    type: mongoose.Schema.ObjectId,
    ref: 'Tour',
    required: [true, 'A booking must belong to a Tour!'],
  },
  tourStartDate: {
    type: Date,
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'A booking must belong to an User!'],
  },
  // price is created in case in the future, that tour price is changed
  price: {
    type: Number,
    required: [true, 'A booking must have a price'],
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  // paid: in case the admin want to create a new Tour which will accept real cash payment -> manage paid state
  paid: {
    type: Boolean,
    default: true,
  },
});

bookingSchema.index({ tour: 1, user: 1 }, { unique: true });

// QUERY middleware
bookingSchema.pre(/^find/, function (next) {
  this.populate('user').populate({
    path: 'tour',
    select: 'name',
  });

  next();
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
