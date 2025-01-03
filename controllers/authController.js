const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const sendEmail = require('./../utils/email');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    //  httpOnly: true => This will make it so that the cookie cannot accessed or modified in any way
    // by the browser to prevent CROSS-SITE-SCRIPTING-ATTACKS etc..
    httpOnly: true,
  };
  // secure = true => That the cookie will only be sent on an encrypted connection - HTTPS
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  // We remove the password from the output because that we select('+password') in login for checking password
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  // const newUser = await User.create(req.body)
  // Like this everyone can simply register as an admin role, so this is a serious security flaw

  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role,
  });

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');
  // const currect = await user.correctPassword(password, user.password);

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password!', 401));
  }

  // console.log(user);
  // uriel1234 === $2a$10$ZAPAAIWqv6vWOn2eAGq5c.w4MUrmJk8HQQ5cRtQRlUUEMv/YJYeuq

  // 3) If everything ok, send token to client
  createSendToken(user, 200, res);
});

//  OPTION A:
// We override the value of token in cookie from the token to loggedout because we cant delete the cookie
// since we using httpOnly: true, so we can't delete it, but we can manipulate it
// exports.logout = (req, res) => {
//   res.cookie('jwt', 'loggedout', {
//     // 10 seconds from now
//     expires: new Date(Date.now() + 10 * 1000),
//     // We do not need to set it as secure, because in this case there is no sensitive data
//     // that anyone can get a hold of
//     httpOnly: true, // Fot people cannot manipulate the cookie in the browser any way
//   });
//   res.status(200).json({ status: 'success' });
// };
//  OPTION B:
// We can use clearCookie instead to delete it
exports.logout = (req, res) => {
  res.clearCookie('jwt');
  res.status(200).json({ status: 'success' });
};

// So in CSR (restfull api approach) in every sensitive route the token will sent vie the headers and then we verify it
// but in SSR in every sensitive route the token will taken from the cookies and then we verify it
exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Baerer eyJhbGciOiJIUzI..
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! please log in to get access.', 401),
    );
  }
  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // console.log(decoded);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401,
      ),
    );
  }
  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401),
    );
  }
  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// Only for rendered pages, no errors
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) Verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET,
      );
      // console.log(decoded);

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }
      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }
      // THERE IS A LOGGED IN USER
      // We put the user variable in response locals, so our pug templates will get access to them
      // and inside of a template there will be a variable called user
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      // THERE IS NOT A LOGGED IN USER
      return next();
    }
  }
  // In case there is no cookie, then the next middleware will be called because there is no logged user
  next();
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          'You do not have permission to perforem this action.',
          403,
        ),
      );
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with that email address.', 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  // With this all of the validation/validators that we do in the model will be skipped
  // so that we can save the passwordResetToken in the dataBase
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 min)',
      message,
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500,
      ),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  // console.log(hashedToken);

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired!', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // We can't use findOneAndUpdate in the usual way because the validators will not work after
  // so we used findOne() and save() on the database and  this the validators will work
  await user.save();
  // 3) Update changePasswordAt property for ther user
  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate() => will NOT work as intended because the save middleware will not work
  // therefore there will be no encryption of the password in database and also the passwordConfirm
  // will enter the database and we don't need him there just the password

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});
