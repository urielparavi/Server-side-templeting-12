const express = require('express');
const viewsController = require('../controllers/viewsController');
const authController = require('../controllers/authController');

const router = express.Router();

// app.use(authController.isLoggedIn);

// In other routes we used to use router.route() because we specified the route itself and then
// we used get, post, patch etc.. Here we using only get
router.get('/', authController.isLoggedIn, viewsController.getOverview);
router.get('/tour/:slug', authController.isLoggedIn, viewsController.getTour);
router.get('/login', viewsController.getLoginForm);
router.get('/signup', authController.isLoggedIn, viewsController.getSignUpForm);
// We we pass the user through the protect route, so we will see the corresponding UI like the isLoggedIn route
// and we won't have to pass it on to everyone.
router.get('/me', authController.protect, viewsController.getAccount);

router.post(
  '/submit-user-data',
  authController.protect,
  viewsController.updateUserData,
);

module.exports = router;
