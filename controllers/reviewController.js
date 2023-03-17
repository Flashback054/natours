const Review = require('../models/reviewModel');
const Booking = require('../models/bookingModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

const assignProperties = (obj1, obj2) => {
  Object.keys(obj2).forEach((key) => {
    obj1[key] = obj2[key];
  });
};

exports.setTourAndUserIds = (req, res, next) => {
  if (!req.body.tour) req.body.tour = req.params.tourId;
  if (!req.body.user) req.body.user = req.user._id;

  next();
};

exports.isBookedByUser = catchAsync(async (req, res, next) => {
  if (req.user.role === 'admin') return next();

  // User role is 'user'
  const booking = await Booking.findOne({
    user: req.body.user,
    tour: req.body.tour,
  });
  // User hasn't booked that tour
  if (!booking)
    return next(
      new AppError('You can only review on tours you have bought.', 401)
    );

  next();
});

exports.getAllReviews = factory.getAll(Review);
exports.createReview = factory.createOne(Review);
exports.getReview = factory.getOne(Review);
// exports.updateReview = factory.updateOne(Review);
exports.updateReview = catchAsync(async (req, res, next) => {
  const foundReview = await Review.findById(req.params.id);

  if (!foundReview) {
    return next(new AppError('No review found with that ID', 404));
  }

  if (req.user.role !== 'admin' && foundReview.user.id !== req.user.id) {
    return next(
      new AppError(
        'You cannot update review that is not created by yourself.',
        400
      )
    );
  }

  assignProperties(foundReview, req.body);
  const updatedReview = await foundReview.save();

  res.status(200).json({
    status: 'success',
    data: {
      data: updatedReview,
    },
  });
});
// exports.deleteReview = factory.deleteOne(Review);
exports.deleteReview = catchAsync(async (req, res, next) => {
  const foundReview = await Review.findById(req.params.id);

  if (!foundReview) {
    return next(new AppError('No review found with that ID', 404));
  }

  if (req.user.role !== 'admin' && foundReview.user.id !== req.user.id) {
    return next(
      new AppError(
        'You cannot delete review that is not created by yourself.',
        400
      )
    );
  }

  await foundReview.remove();

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
