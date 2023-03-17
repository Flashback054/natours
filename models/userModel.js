const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name.'],
  },
  email: {
    type: String,
    required: [true, 'Please provide your email.'],
    unique: true,
    lowercase: true,
    validate: {
      validator: function (value) {
        return validator.isEmail(value);
      },
      message: 'Please provide a valid email.',
    },
  },
  photo: {
    type: String,
    default: 'default.jpg',
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please provide your password.'],
    minlength: [8, 'Password must have at least 8 characters.'],
    // hide password from output
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // ONLY WORK ON .create() || .save() !!!
      validator: function (inputValue) {
        return inputValue === this.password;
      },
      message: 'Passwords are not the same.',
    },
  },
  passwordChangedAt: {
    type: Date,
    select: false,
  },
  passwordResetToken: {
    type: String,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
  },
  emailConfirmToken: {
    type: String,
    // select: false,
  },
  emailConfirmExpires: {
    type: Date,
    // select: false,
  },
  loginAttempts: {
    type: Number,
    default: 0,
    select: false,
  },
  lockExpires: {
    type: Date,
    select: false,
  },
  active: {
    type: Boolean,
    default: false,
    select: false,
  },
});

////////// MIDDLEWARE ///////

// Decrypt password
userSchema.pre('save', async function (next) {
  // only run this function if Password is modified
  if (!this.isModified('password')) return next();

  // 12 : how CPU intensive to hash password
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;

  next();
});
// Update passwordChangedAt
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  // A little hack: minus 1 seconds : b/c this save process might finish after JWT being created -> error
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, function (next) {
  if (!this.includesInactive) this.find({ active: { $ne: false } });
  next();
});

////////// METHODS //////////
userSchema.methods.isCorrectPassword = async function (candidatePwd, userPwd) {
  return await bcrypt.compare(candidatePwd, userPwd);
};

// Check if the password is changed after the token was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  // Password has been changed after user being created
  if (this.passwordChangedAt) {
    const passwordChangeTime = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < passwordChangeTime;
  }

  // False: token was issued before password change time
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  // create a random Reset Token string in Hex format
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Encrypt reset token and set Expires date to 10 minutes after created
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

userSchema.methods.createEmailConfirmToken = function () {
  // create a random Email Confirm string in Hex format
  const confirmToken = crypto.randomBytes(32).toString('hex');

  // Encrypt Email Confirm and set Expires date to 10 days after created
  this.emailConfirmToken = crypto
    .createHash('sha256')
    .update(confirmToken)
    .digest('hex');
  this.emailConfirmExpires = Date.now() + 10 * 24 * 60 * 60 * 1000;

  return confirmToken;
};

userSchema.methods.incrementLoginAttempts = async function () {
  // check if the lock has expire
  if (this.lockExpires && this.lockExpires < Date.now()) {
    this.loginAttempts = 0;
    this.lockExpires = undefined;
  }

  this.loginAttempts += 1;
  if (this.loginAttempts >= process.env.MAX_LOGIN_ATTEMPTS) {
    this.lockExpires = Date.now() + 1 * 60 * 1000;
  }

  await this.save({ validateBeforeSave: false });
};
userSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockExpires = undefined;
  await this.save({ validateBeforeSave: false });
};

///////// VIRTUAL ///////
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockExpires && this.lockExpires >= Date.now());
});

///////////////////////////
const User = mongoose.model('User', userSchema);

module.exports = User;
