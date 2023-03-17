const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review cannot be empty.'],
    },
    rating: {
      type: Number,
      require: [true, 'A review must have a rating'],
      min: [1.0, 'A rating must be at least 1.0'],
      max: [5.0, 'A rating must be at most 5.0'],
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      require: [true, 'Review must belong to a tour.'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      require: [true, 'Review must belong to a user.'],
    },
  },
  {
    toJSON: { virtual: true },
    toObject: { virtual: true },
  }
);

// Each combination of (tour, user) must be unique
// -> one user can only post 1 review to that specific tour
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

// QUERY MIDDLEWARE
reviewSchema.pre(/^find/, function (next) {
  // IN THIS CASE: turn off tour populating b/c on tourSchema, when we virtual populate its 'reviews',
  // each review will then populate the 'tour' => decrease performance
  // this.populate({
  //   path: 'tour',
  //   select: 'name',
  // }).populate({
  //   path: 'user',
  //   select: 'name photo',
  // });

  this.populate({
    path: 'user',
    select: 'name photo',
  });

  next();
});

// Static Schmea method to calc avg rating
// use static on Tour Model instead of methods on Document:
// b/c we access Tour.aggregate
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

//// Calculate Rating stats when rating changed (created, updated or deleted)
reviewSchema.post('save', async function (doc, next) {
  // this.constructor: points to the Model that create 'this'
  // have to use this b/c Review Model is not yet defined at this point, so can't use Review.calc....
  await this.constructor.calcAverageRatings(this.tour);
  next();
});

// Calc rating stats for findByIdAndUpdate, findByIdAndDelete,...
// METHOD 1:
reviewSchema.post(/^findOneAnd/, async function (review, next) {
  await review.constructor.calcAverageRatings(review.tour);
  next();
});
// METHOD 2:
// reviewSchema.pre(/^findOneAnd/, async function (next) {
//   this.review = await this.findOne();
//   next();
// });
// reviewSchema.post(/^findOneAnd/, async function () {
//   await this.review.constructor.calcAverageRatings(this.review.tour);
// });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
