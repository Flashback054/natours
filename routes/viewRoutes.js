const express = require('express');
const viewController = require('../controllers/viewController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(viewController.alert);

router.get('/', authController.isLoggedIn, viewController.getOverview);
router.get('/tour/:slug', authController.isLoggedIn, viewController.getTour);
router.get('/login', authController.isLoggedIn, viewController.getLoginForm);
router.get('/signup', authController.isLoggedIn, viewController.getSignupForm);
router.get('/my-tours', authController.protect, viewController.getMyTours);

router.get('/me', authController.protect, viewController.getAccount);

router.get(
  '/check-your-email',
  authController.isLoggedIn,
  viewController.getCheckEmailPage
);
router.get('/email-verified', viewController.getEmailVerifiedPage);

module.exports = router;
