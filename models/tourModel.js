const mongoose = require('mongoose');
const slugify = require('slugify');
// const User = require('./userModel');
// const validator = require('validator');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name.'],
      unique: true,
      trim: true,
      maxlength: [
        40,
        'A tour name must have less or equal then 40 characters.',
      ],
      minlength: [
        10,
        'A tour name must have more or equal then 10 characters.',
      ],
      // validate: [validator.isAlpha, 'Tour name must only contain characters.'],
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration.'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size.'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty.'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult.',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10, // 4.666666, 46.6666, 47, 4.7
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price.'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // This only point to current doc on NEW document creation and not UPDATING document
          return val < this.price; // 200 < 250
        },
        message: 'Discount price ({VALUE}) should be below the regular price.',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a description.'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image.'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
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
    guides: [{ type: mongoose.Schema.ObjectId, ref: 'User' }],
  },
  {
    // Each time that the data outputted as JSON/OBJECT, we want viruals to be true
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// We create index on MongoDB on the price's field
// tourSchema.index({ price: 1 });
tourSchema.index({ price: 1, ratingsAverage: -1 }); // Compound index
tourSchema.index({ slug: 1 }); // Single field index

// In order todo geospatial queries, we need to first attribute an index to the field where the geospatial data
// that we're searching for is stored, so we need to add an index to startLocation
// 2dsphere => data that describe real points on earth (for mongoDB)
tourSchema.index({ startLocation: '2dsphere' });

// Virtual property
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7;
});

// Virtual populate - in this case we populate the reviews in tour and connect the tour with  the corresponding review
tourSchema.virtual('reviews', {
  ref: 'Review',
  // We connect the id inside field "tour" in Review Model, therefore the name foreignField
  foreignField: 'tour',
  // We connect the id here in this model, therefore the name localField
  localField: '_id',
});

// DOCUMENT MIDDLEWARE: runs before .save() and .create()
tourSchema.pre('save', function (next) {
  // console.log(this);
  // Slug => string that we can put in the URL, usually based on some string like the name etc..
  this.slug = slugify(this.name, { lower: true });
  next();
});

// The embedding approach of the users(guide, lead guide) document in tours document
// tourSchema.pre('save', async function (next) {
//   // guides array - array that full of promises
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id));
//   // We override that array of IDs with array of user documents
//   this.guides = await Promise.all(guidesPromises);

//   next();
// });

// tourSchema.pre('save', function (next) {
//   console.log('Will save document...');
//   next();
// });

// tourSchema.post('save', function (doc, next) {
//   console.log(doc);
//   next();
// });

// QUERY MIDDLEWARE
tourSchema.pre(/^find/, function (next) {
  // tourSchema.pre('find', function (next) {

  // We hide the secretTour from our queries
  // Since the other tours not set to false and they are not have this attribute, we use $ne
  this.find({ secretTour: { $ne: true } });

  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function (next) {
  // this => always refers to the current query
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });

  next();
});

tourSchema.post(/^find/, function (docs, next) {
  console.log(`Query took ${Date.now() - this.start} milliseconds!`);
  next();
});

// AGGREGATION MIDDLEWARE
// aggregation middleware allow us to add hooks before/after an aggrigation happens

// Since in an aggregation the secretTour still being used in get Tour Stats
// we want to exclude the secretTours that are true from get Tour Stats also like getAllTours,
// so filtered out the secretTours from our aggregation middleware in get Tour Stats

// tourSchema.pre('aggregate', function (next) {
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });

//   console.log(this.pipeline());
//   next();
// });

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
