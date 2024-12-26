const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');

const app = express();

// We define a template engine
app.set('view engine', 'pug');
// path.join => create a path joining the directory name/views, and this way
// we node worry about slashes or not, because we don't know whether a path that we receive from
// somewhere already has a slash or not, so with path.join node automatically create a correct path

// console.log(path.join('/foo','bar')); => /foo/bar

app.set('views', path.join(__dirname, 'views')); // in our case =>  C:\Coding\node\views

// 1) GLOBAL MIDDLEWARES
// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

// Set security HTTP headers
// app.use(helmet());
// We change the same origin policy of the browser to cross origin policy for mapbox
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));

// Development logging
if (process.env.NODE_ENV === 'development') {
  // console.log(process.env.NODE_ENV);
  app.use(morgan('dev'));
}

// Limit requests form same API. Good for prevent DOS/BRUTE FORCE ATTACKS
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'To many requests from this IP, please try again in an hour!',
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
// Since the form sends the data to the server through URL encoded, We need to parse the data
// that coming back from URL encoded form
// extended: true => it allow us to pass more complex data (in this case is not necessary)
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
// Parses incoming cookies from the request header and makes them available in the req.cookies object
// So if we don't use cookie parser we won't be able to get access to jwt in req.cookies.jwt from the
// protected/isLoggedIn midlleware
app.use(cookieParser());

// Data sanitization against NoSQL query injection in req.body, req.params, req.query
app.use(mongoSanitize());

// Datasanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  }),
);

// app.use(hpp());

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  // console.log(x);
  // console.log(req.headers);
  next();
});

// 3) ROUTES
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);

// all => for all the http methods, url's, routes
app.all('*', (req, res, next) => {
  // const err = new Error(`Can't find ${req.originalUrl} on this server!`);
  // err.status = 'fail';
  // err.statusCode = 404;
  // next(err);

  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
