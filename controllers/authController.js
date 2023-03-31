const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const util = require('util');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/userModel');
const Email = require('../utils/email');

const unselectFieldsInOutput = [
  'password',
  'passwordChangedAt',
  'passwordResetToken',
  'passwordResetExpires',
  'loginAttempts',
  'lockExpires',
  'active',
];

const createAndSendEmailConfirm = async (user, req, next) => {
  try {
    const token = user.createEmailConfirmToken();
    await user.save({ validateBeforeSave: false });

    const url = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/confirm-email/${token}`;
    await new Email(user, url).sendEmailConfirm();
  } catch (err) {
    user.emailConfirmToken = undefined;
    user.emailConfirmExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'Error during sending email confirm. Please try again later',
        401
      )
    );
  }
};

const signToken = (id, secret, expires) => {
  return jwt.sign({ id }, secret, {
    expiresIn: expires,
  });
};

const createJWTAndRefreshToken = (user, req) => {
  const jwtToken = signToken(
    user._id,
    process.env.JWT_SECRET,
    process.env.JWT_EXPIRES_IN
  );
  const refreshToken = signToken(
    user._id,
    process.env.REFRESH_SECRET,
    process.env.REFRESH_EXPIRES_IN
  );

  const jwtCookieOptions = {
    expires: new Date(
      // valid for 15 minutes
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 60 * 1000
    ),
    httpOnly: true,
  };
  const refreshTokenOptions = {
    expires: new Date(
      // valid for 1 day
      Date.now() + process.env.REFRESH_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    jwtCookieOptions.secure = true;
    refreshTokenOptions.secure = true;
  }

  return { jwtToken, refreshToken, jwtCookieOptions, refreshTokenOptions };
};

const createSendToken = (user, statusCode, req, res, sendUser = false) => {
  const tokens = createJWTAndRefreshToken(user, req);

  res.cookie('jwt', tokens.jwtToken, tokens.jwtCookieOptions);
  res.cookie('refresh', tokens.refreshToken, tokens.refreshTokenOptions);

  // send user in response or not
  let data;
  if (sendUser) {
    data = user;
    unselectFieldsInOutput.forEach((field) => {
      data[field] = undefined;
    });
  } else data = undefined;

  res.status(statusCode).json({
    status: 'success',
    token: tokens.jwtToken,
    data,
  });
};

const createTokenAndRedirect = (user, statusCode, req, res, url) => {
  const tokens = createJWTAndRefreshToken(user, req);

  res.cookie('jwt', tokens.jwtToken, tokens.jwtCookieOptions);
  res.cookie('refresh', tokens.refreshToken, tokens.refreshTokenOptions);

  res.status(statusCode).redirect(url);
};

exports.getNewAccessToken = catchAsync(async (req, res, next) => {
  const { refresh: refreshToken } = req.cookies;

  if (!refreshToken) {
    return next(
      new AppError('Refresh token malformed. Please log in again.', 401)
    );
  }

  let decoded;
  try {
    decoded = await util.promisify(jwt.verify)(
      refreshToken,
      process.env.REFRESH_SECRET
    );
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError)
      return next(
        new AppError('Refresh token expired. Please log in again.', 401)
      );

    return next(
      new AppError('Refresh token malformed. Please log in again.', 401)
    );
  }

  const jwtCookieOptions = {
    expires: new Date(
      // valid for 15 minutes
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 60 * 1000
    ),
    httpOnly: true,
  };
  if (req.secure || req.headers['x-forwarded-proto'] === 'https')
    jwtCookieOptions.secure = true;

  const newJWT = signToken(
    decoded.id,
    process.env.JWT_SECRET,
    process.env.JWT_EXPIRES_IN
  );

  res.cookie('jwt', newJWT, jwtCookieOptions);
  // OriginalURL: the url browser is on before the user hit '/api/v1/users/access-token' to refresh token
  // was saved as cookie before on req
  const originalUrl = req.cookies.originalUrl || '/';
  res.clearCookie('originalUrl', {
    expires: new Date(Date.now()),
    httpOnly: true,
  });
  res.redirect(originalUrl);
});

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    // avoid user sign up as an admin => only take info that we need
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  await createAndSendEmailConfirm(newUser, req, next);

  // Create email cookie => page '/check-your-email' can read current email to render
  const emailCookieOptions = {
    expires: new Date(Date.now() + 10 * 60 * 1000),
    httpOnly: true,
  };
  if (req.secure || req.headers['x-forwarded-proto'] === 'https')
    emailCookieOptions.secure = true;
  res.cookie('email', req.body.email, emailCookieOptions);

  res.status(200).json({
    status: 'success',
    data: {
      user: newUser,
    },
  });
});

exports.confirmEmail = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const query = User.findOne({
    emailConfirmToken: hashedToken,
    emailConfirmExpires: { $gt: Date.now() },
  });
  // include inactive: b/c current user account is inactive -> will be skipped by query middleware
  query.includesInactive = true;

  const user = await query;

  if (!user)
    return next(
      new AppError(
        'Email confirm token not correct or expired. Please try again.',
        401
      )
    );

  user.active = true;
  user.emailConfirmToken = undefined;
  user.emailConfirmExpires = undefined;
  await user.save({ validateBeforeSave: false });

  createTokenAndRedirect(
    user,
    200,
    req,
    res,
    `${req.protocol}://${req.get('host')}/email-verified`
  );
});

exports.login = catchAsync(async (req, res, next) => {
  // 1) Check if email and password exist
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new AppError('Please provide email and password.', 400));
  }

  // 2) Check if user & password correct
  const query = User.findOne({ email }).select(
    '+password +lockExpires +loginAttempts +emailConfirmToken +emailConfirmExpires +active'
  );
  query.includesInactive = true;
  const user = await query;

  // User has delete their account || User hasn't verified their email address
  if (!user.active) {
    await createAndSendEmailConfirm(user, req, next);
    return next(
      new AppError(
        'Your account is not active. An email verification was sent to your email. Please check your email and verify your email address.'
      )
    );
  }

  if (user && user.isLocked) {
    return next(
      new AppError(
        'User failed to log in to many times. Please try again later.',
        429
      )
    );
  }

  if (!user || !(await user.isCorrectPassword(password, user.password))) {
    if (user) await user.incrementLoginAttempts();
    return next(new AppError('Email or password not correct.', 401));
  }

  // 3) Generate token
  await user.resetLoginAttempts();
  createSendToken(user, 200, req, res);
});

exports.logout = (req, res, next) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now()),
    httpOnly: true,
  });
  res.cookie('refresh', 'loggedout', {
    expires: new Date(Date.now()),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there (By tradition, token included in req.headers as: "Authorization":"Bearer <token>")
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // No access token found
  if (!token) {
    res.cookie('originalUrl', req.originalUrl, {
      expires: new Date(Date.now() + 10 * 60 * 1000),
      httpOnly: true,
    });
    res.redirect('/api/v1/users/access-token');
    return;
  }

  // 2) Verificate token
  // jwt.verify will throw Error if not succeed => catchAsync will catch
  let decoded;
  try {
    decoded = await util.promisify(jwt.verify)(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.cookie('originalUrl', req.originalUrl, {
        expires: new Date(Date.now() + 10 * 60 * 1000),
        httpOnly: true,
      });
      res.redirect('/api/v1/users/access-token');
      return;
    }

    return next(new AppError('JWT token malformed. Please log in again.', 401));
  }

  // 3) Check if user still exists
  const query = User.findById(decoded.id).select(
    '+password +passwordChangedAt +active'
  );
  query.includesInactive = true;
  const currentUser = await query;

  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does not exists anymore.',
        404
      )
    );
  }

  // 3.1) If the user is not active (deleted or haven't verify email)
  if (!currentUser.active) {
    return next(
      new AppError(
        'The user account is not active anymore. Please log in again, check your email and confirm your email address.',
        404
      )
    );
  }

  // 4) Check if the user has changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        'The user has recently changed the password. Please log in again.',
        401
      )
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// Only used for view, no errors
exports.isLoggedIn = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there (By tradition, token included in req.headers as: "Authorization":"Bearer <token>")
  if (req.cookies.jwt) {
    try {
      const token = req.cookies.jwt;

      // 2) Verificate token
      // jwt.verify will throw Error if not succeed => catchAsync will catch
      const decoded = await util.promisify(jwt.verify)(
        token,
        process.env.JWT_SECRET
      );

      // 3) Check if user still exists
      const currentUser = await User.findById(decoded.id).select(
        '+password +passwordChangedAt'
      );
      if (!currentUser) {
        return next();
      }
      // 4) Check if the user has changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      // res.locals: locals var for pug templates
      req.user = currentUser;
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }

  if (req.cookies.refresh) {
    res.cookie('originalUrl', req.originalUrl, {
      expires: new Date(Date.now() + 10 * 60 * 1000),
      httpOnly: true,
    });
    res.redirect('/api/v1/users/access-token');
    return;
  }

  return next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles || !roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action.', 403)
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get the POSTed email
  const { email } = req.body;
  if (!email) return next(new AppError('Please provide an email.', 400));
  const user = await User.findOne({ email });
  if (!user)
    return next(new AppError('There is no user with provided email.', 404));

  // 2) Generate random reset token
  const resetToken = user.createPasswordResetToken();
  // In user.createPasswordToken, this.passwordResetToken and passwordResetExpires has been set but not updated to the DB yet
  // => user.save() : turn off validation first
  await user.save({ validateBeforeSave: false });

  // 3) Send reset token to user's email

  // use try-catch: in case there is an error, we MUST DELETE passwordResetToken & passwordResetExpires -> only global err handling middleware won't do
  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/reset-password/${resetToken}`;

    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email.',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'An error occured during sending the email. Please try again later.',
        500
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If the token has not expired, and there is a user -> reset password
  if (!user) {
    return next(new AppError('Invalid or expired token.', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // save(): auto run Validator
  await user.save();
  // 3) Update changedPasswordAt property
  // implemented in UserSchema middleware

  // 4) Log the user in, send JWT
  createSendToken(user, 200, req, res);
});

exports.updateMyPassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user._id).select('+password');

  // 2) Check if POSTed password is correct`
  if (
    !req.body.passwordCurrent ||
    !(await user.isCorrectPassword(req.body.passwordCurrent, user.password))
  ) {
    return next(new AppError('Please provide correct current password.', 400));
  }

  // 3) If so, update password
  const { password, passwordConfirm } = req.body;
  user.password = password;
  user.passwordConfirm = passwordConfirm;
  await user.save();

  // 4) Log user in, send JWT
  createSendToken(user, 200, req, res);
});
