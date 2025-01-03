const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name!'],
  },
  email: {
    type: String,
    required: [true, 'Please provide your email!'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email!'],
  },
  photo: String,
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please provide a  password!'],
    minlength: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password!'],
    validate: {
      // This custom validator only works on CREATE and SAVE! => For example: user.create(), user.save()
      validator: function (el) {
        return el === this.password;
      },
      message: 'Passwords are not the same!',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

/* IMPORTANT => the pre saved middlewares will not work for update/findByIdAndUpdate() etc */
// The encryption will happend between getting the data and savig it to the database
userSchema.pre('save', async function (next) {
  // We encrypt the password field only if it changed/created new, so if the user updating the
  // email for example, we do not want to encrypt the password again
  // Only run function if password was actually modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 10
  this.password = await bcrypt.hash(this.password, 10);

  // We delete the passwordConfirm field, because we no longer need this field, since we don't want to persist
  // it to the database - we needed it only for the validation that we implemented before
  this.passwordConfirm = undefined;
  // 1234 => $2a$10$NDtJtz9pL2WfKwA3ksIRRumjmey.EtIMXqDKhyKsyd1jI7phA4d46 => 1234
  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, function (next) {
  // this points to the current query
  this.find({ active: { $ne: false } });
  next();
});

// methods => Instance method is a method that available on all documents of a ceratin collection
userSchema.methods.correctPassword = async function (
  candidatedPassword,
  userPassword,
) {
  // candidatedPassword - from user in login, userPassword from DB that we encrypted
  return await bcrypt.compare(candidatedPassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  // So passwordChangedAt property exists, is meaning that the user changed his password
  if (this.passwordChangedAt) {
    // Because we get the changedTimestamp in miliseconds we convert it to seconds like JWTTimestamp
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      // We need to specify the base
      10,
    );

    // We compare the time the token was created with the time the password was changed.
    // console.log(JWTTimestamp, changedTimestamp);
    return JWTTimestamp < changedTimestamp; // 100 < 200
  }
  // False means that the password NOT changed
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // console.log({ resetToken }, this.passwordResetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
