const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review  can not be empty!'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour.'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user.'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

reviewSchema.index({ tour: 1, user: 1 }, { unique: true });
// If we were use single filed index for the user and tour separately,
// each user can create 1 review and each tour can  get 1 review (in the collection of review)
// reviewSchema.index({  user: 1 }, { unique: true });
// reviewSchema.index({ tour: 1 }, { unique: true });

// QUERY MIDDLEWARE
reviewSchema.pre(/^find/, function (next) {
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

// Static method
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  console.log(tourId);
  // this => point to the current Model, and we nee to call aggregate always on the model directly
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
  console.log(stats);

  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
    // Incase that there are no reviews anymore in stats array, so we're going back to the default
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};
// DOCUMENT MIDDLEWARE

// We shouldn't use pre, because at pre save the current review is not really in the collection just yet.
// therefore when we then do the $match, it shouldn't be able to then appear in the output
reviewSchema.post('save', function () {
  // Review.calcAverageRatings(this.tour); => Like this, at this point, the review variable is not yet defined
  // this => current document, constructor => the model who created that document
  this.constructor.calcAverageRatings(this.tour);
  // this - current review, tour - the tourId that we're gonna pass to calcAverageRatings
  // next(); => the post middleware does not get access to next(), so we cannot call it
});

// QUERY MIDDLEWARE

// findByIdAndUpdate
// findByIdAndDelete

// We cannot do this middleware with post, because at this point in time, we have no longer access to the query
// because the query has already executed
reviewSchema.pre(/^findOneAnd/, async function (next) {
  // this => current query
  this.review = await this.findOne();
  console.log(this.review);
  next();
});

// This middleware run after the query has executed, so it can have access to the DOCS that were returned
reviewSchema.post(/^findOneAnd/, async function () {
  // await this.findOne(); does NOT work here, query has already executed
  await this.review.constructor.calcAverageRatings(this.review.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
