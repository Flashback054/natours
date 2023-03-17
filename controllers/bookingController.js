const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1) Get currently booked tour
  const tour = await Tour.findById(req.query.tour);
  const { startDate } = req.query;

  const startDateIndex = tour.startDates.findIndex(
    (el) => el.date.toISOString() === startDate
  );

  if (tour.startDates[startDateIndex].soldOut) {
    return next(
      new AppError('This tour on this date is sold out. Please try again.', 400)
    );
  }

  // 2) Create checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    success_url: `${req.protocol}://${req.get('host')}/?tour=${tour._id}&user=${
      req.user._id
    }&price=${tour.price}&startDate=${startDate}`,
    cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`,
    customer_email: req.user.email,
    client_reference_id: req.params.tourId,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: tour.price * 100, //convert to cents
          product_data: {
            name: `${tour.name} Tour`,
            description: tour.summary,
            images: [`https://www.natours.dev/img/tours/${tour.imageCover}`],
          },
        },
        quantity: 1,
      },
    ],
  });

  // 3) Create session as response
  res.status(200).json({
    status: 'success',
    session,
  });
});

exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  // TEMPORARY method: this way of implementing is INSECURE : everyone can create booking without paying if they know this route
  const { tour, user, price, startDate } = req.query;
  if (!tour || !user || !price) return next();

  await Booking.create({ tour, tourStartDate: startDate, user, price });
  const bookedTour = await Tour.findById(tour);
  const startDateIndex = bookedTour.startDates.findIndex(
    (el) => el.date.toISOString() === startDate
  );
  bookedTour.startDates[startDateIndex].participants += 1;
  if (
    bookedTour.startDates[startDateIndex].participants >=
    bookedTour.maxGroupSize
  )
    bookedTour.startDates[startDateIndex].soldOut = true;

  await bookedTour.save();

  res.redirect(req.originalUrl.split('?')[0]);
});

exports.setTourAndUserIds = (req, res, next) => {
  if (!req.body.tour) req.body.tour = req.params.tourId;
  if (!req.body.user) req.body.user = req.params.userId;

  next();
};

exports.getAllBookings = factory.getAll(Booking);
exports.getBooking = factory.getOne(Booking);
exports.createBooking = factory.createOne(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
