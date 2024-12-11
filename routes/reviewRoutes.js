const express = require('express');
const reviewController = require('./../controllers/reviewController');
const authController = require('./../controllers/authController');

// mergeParams => by default each router only have access to their specific routes, so In order to get access to the tourId parameter,we preserve the req.params values (tourId) from the parent router
const router = express.Router({ mergeParams: true });

// GET/POST => api/v1/tours/tourId/reviews
// GET/POST => api/v1/reviews

router.use(authController.protect);

router
  .route('/')
  .get(reviewController.getAllReviews)
  .post(
    authController.restrictTo('user'),
    reviewController.setTourUserIds,
    reviewController.createReview,
  );

router
  .route('/:id')
  .get(reviewController.getReview)
  .patch(
    authController.restrictTo('user', 'admin'),
    reviewController.updateReview,
  )
  .delete(
    authController.restrictTo('user', 'admin'),
    reviewController.deleteReview,
  );

module.exports = router;
