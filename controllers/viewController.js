const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getOverview = catchAsync(async (req, res, next) => {
  const tours = await Tour.find();

  res.status(200).render('overview', {
    title: 'All Tours',
    tours,
  });
});

exports.getTour = catchAsync(async (req, res, next) => {
  // 1) Get the data for the requested tour (including reviews and guides)
  const tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
    fields: 'review rating user',
  });

  if (!tour) {
    return next(new AppError('No tour found with that name.', 404));
  }

  // 1.1) Check if the user has already booked the tour
  const isBooked = !!(await Booking.findOne({
    tour: tour._id,
    user: req.user._id,
  }));

  // 2) Build template
  // 3) Render template
  res.status(200).render('tour', {
    title: `${tour.name} Tour`,
    tour,
    isBooked,
  });
});

exports.getLoginForm = (req, res, next) => {
  res.status(200).render('login', {
    title: 'Log into your account',
  });
};

exports.getSignupForm = (req, res, next) => {
  res.status(200).render('signup', {
    title: 'Sign up your new account',
  });
};

exports.getAccount = (req, res, next) => {
  res.status(200).render('account', {
    title: 'Your account',
  });
};

exports.getMyTours = catchAsync(async (req, res, next) => {
  // 1) Get all the bookings belong to that user
  const bookings = await Booking.find({ user: req.user._id });
  const tourIds = bookings.map((el) => el.tour._id);

  // 2) Get all the tours those bookings belong to
  const tours = await Tour.find({ _id: { $in: tourIds } });

  // 3) Render My Tours page
  res.status(200).render('overview', {
    title: 'My Tours',
    tours,
  });
});

exports.getEmailVerifiedPage = (req, res, next) => {
  res.status(200).render('confirmEmailSuccess', {
    title: 'Email Verified',
  });
};
