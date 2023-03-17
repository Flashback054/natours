const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const bookingRouter = require('./bookingRoutes');

const router = express.Router();

router.use('/:userId/bookings', bookingRouter);

// Public routes (no authentication needed)
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password/:token', authController.resetPassword);
router.get('/confirm-email/:token', authController.confirmEmail);
router.get('/access-token', authController.getNewAccessToken);

// All routes below need authentication
router.use(authController.protect);

router.get('/me', userController.getMe, userController.getUser);
router.patch('/update-my-password', authController.updateMyPassword);
router.patch(
  '/update-me',
  userController.uploadUserPhoto,
  userController.resizeUserPhoto,
  userController.updateMe
);
router.delete('/delete-me', userController.deleteMe);

// All routes below need user to be Admin
router.use(authController.restrictTo('admin'));

router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);
router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.preventUpdatePassword, userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
