const mongoose = require('mongoose');
const slugify = require('slugify');

// create a schema
const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      require: [true, 'A tour must have a name'],
      minlength: [10, 'A tour name must at least have 10 letters'],
      maxlength: [50, 'A tour name must at most have 50 letters'],
      unique: true,
      trim: true,
      validate: {
        validator: function (value) {
          const regEx = /[a-zA-Z][a-zA-Z ]+[a-zA-Z]$/;
          return regEx.test(value);
        },
        message: 'A tour name must contain only letters and spaces.',
      },
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be more than or equal to 1.0'],
      max: [5, 'Rating must be less than or equal to 5.0'],
      // setter: called each time the field is set with value
      set: (value) => Math.round(value * 10) / 10,
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      require: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (inputVal) {
          // 'this' only points to NEW document created (not working on UPDATE)
          return inputVal <= this.price;
        },
        message:
          'Discount price ({VALUE}) must be less than or equal to original price',
      },
    },
    summary: {
      type: String,
      trim: true,
      require: [true, 'A tour must have a description'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have cover image'],
    },
    images: [String],
    createAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [
      {
        date: {
          type: Date,
        },
        participants: {
          type: Number,
          default: 0,
        },
        soldOut: {
          type: Boolean,
          default: false,
        },
      },
    ],
    secretTour: {
      type: Boolean,
      default: false,
      select: false,
    },
    startLocation: {
      // GeoJSON
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

///////////// IMPORTANT: Indexes //////
// Single index
// tourSchema.index({ price: 1 });
// Compound index
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 }, { unique: true });
tourSchema.index({ startLocation: '2dsphere' });

// Virtual Properties
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7;
});
////////// IMPORTANT: Virtual Populate //////////
// foreignField: the field in Review that ref to 'Tour'
// localField: the field in 'Tour' that Review used to ref ('_id')
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

///////// MONGODB MIDDLEWARE ////////////////

// 1)DOCUMENT MIDDLEWARE : manipulate the currently processed DOC
// the below middleware run before the .SAVE() and .CREATE()
// NOT WORKING with .INSERTMANY(),...

// IN .pre() : we have access to next() func, we can access to currently processed doc by 'this' keyword
tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// EMBEDING the Guide User into Tour
// tourSchema.pre('save', async function (next) {
//   const guidePromises = this.guides.map(async (id) => await User.findById(id));
//   this.guides = await Promise.all(guidePromises);

//   next();
// });

// // In .post() : we have access to 'doc'(doc which has finished being processed) and 'next'
// 'this' keyword point to the doc BEFORE SAVE
// tourSchema.post('save', function (doc, next) {
//   console.log(this);
//   next();
// });

// 2) QUERY MIDDLEWARE
// 'this' point to the Query Obj
tourSchema.pre(/^find/, function (next) {
  this.find({ secretTour: { $ne: true } });
  // this.startQueryTime = Date.now();
  next();
});

tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v',
  });
  next();
});

// tourSchema.post(/^find/, function (docs, next) {
//   console.log(`Query took ${Date.now() - this.startQueryTime} ms`);
//   next();
// });

// 3) AGGREGATION MIDDLEWARE
// tourSchema.pre('aggregate', function (next) {
//   // this.pipeline() : return PIPELINE array of current Aggregate Obj
//   this.pipeline().unshift({
//     $match: { secretTour: { $ne: true } },
//   });
//   next();
// });

// create a MODEL
const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
