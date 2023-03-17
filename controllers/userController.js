const multer = require('multer');
const sharp = require('sharp');

const User = require(`./../models/userModel`);
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// Create multer storage to store user uploaded files
// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'public/img/users');
//   },
//   filename: (req, file, cb) => {
//     cb(
//       null,
//       `user-${req.user._id}-${Date.now()}.${file.mimetype.split('/')[1]}`
//     );
//   },
// });
// OR : use memoryStorage (if we want to resize img before save it)
const multerStorage = multer.memoryStorage();

// Check if uploaded file is image
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only image', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserPhoto = upload.single('photo');
exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user._id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  return next();
});

const filterObj = (obj, ...fields) => {
  const filteredObj = {};
  fields.forEach((field) => {
    if (obj[field]) filteredObj[field] = obj[field];
  });
  return filteredObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user._id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Throw Error if the user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password update. Please use /update-my-password.',
        400
      )
    );
  }

  // 2) Filter out unwanted fields
  // filter the body : avoid user input dangerous fields (ex: roles: 'admin')
  const filteredBody = filterObj(req.body, 'name', 'email');
  if (req.file) filteredBody.photo = req.file.filename;
  // 2) Update user document
  // can't use user.save() b/c it will then validate 2 missing fields: password & passwordConfirm
  // -> use findByIdAndUpdate
  // const updatedUser = await User.findByIdAndUpdate()
  const user = await User.findByIdAndUpdate(req.user._id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    user,
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.preventUpdatePassword = (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError("This route is not for updating user's password.", 400)
    );
  }

  next();
};

exports.getAllUsers = factory.getAll(User);
exports.getUser = factory.getOne(User);
exports.createUser = (req, res, next) => {
  res.status(500).json({
    status: 'fail',
    message: 'This route is not defined. Please use /signup instead.',
  });
};
// DO NOT update passwords with this!!! (b/c 'save' midd won't run -> password won't be encrypted)
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);
