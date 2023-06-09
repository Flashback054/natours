const express = require('express');
const path = require('path');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');
const compression = require('compression');
const cors = require('cors');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const bookingController = require('./controllers/bookingController');

const app = express();

// Trust proxies
app.enable('trust proxy');

// Set up Pug engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 1) GLOBAL MIDDLEWARE
// Implement CORS
app.use(cors());
// Implement CORS on all OPTIONS request
// Browser send OPTIONS req on preflight phase (before non-simple req like PUT,PATCH,DELETE,...)
// -> inorder to verify that the non-simple req is safe to perform
// -> we must set CORS on response
app.options('*', cors());

app.use(express.static(path.join(__dirname, 'public')));

//////// IMPORTANT : helmet should be used in every Express app
// Security HTTP headers
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: {
      allowOrigins: ['*'],
    },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ['*'],
        scriptSrc: ["* data: 'unsafe-eval' 'unsafe-inline' blob:"],
      },
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many request from this IP. Please try again in one hour.',
});
app.use('/api', limiter);

//////// IMPORTANT ////////
// Data sanitization against NoSQL query injection
// ex: req.body contains : { name: { $gt: "" } , password: <someCorrectPasswordOfSb> }
// -> name: { $gt: ""} match everything --> dangerous, Sanitize by delete all "$" & "." in input
app.use(mongoSanitize());

// Data sanitization against XSS
// replace malicious HTML code : ex : <div id='error-code'></div> -> &lt;div id='error-code'&gt;...
app.use(xss());

// compress all the response text (ex: JSON or HTML)
app.use(compression());

// Parse body as raw buffer b/c Stripe webhook api need body as raw instead of JSON
app.post(
  '/webhook-checkout',
  express.raw({ type: 'application/json' }),
  bookingController.webhookCheckout
);

// Body parser, limit body payload, server static files, parse cookies
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Since in this app, sessions are only used for sending
// temporary data along with res.redirect
// -> don't have to save sessions in some DB (like Redis)
app.use(
  cookieSession({
    name: 'session',
    secret: process.env.SESSION_SECRET,

    // Cookie Options
    maxAge: 1 * 60 * 60 * 1000, // 1 hour
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  })
);

// Prevent params pollution
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
  })
);

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 2) ROUTES
// Views routes
app.use('/', viewRouter);
// API routes
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

// Fallback Middleware (if route not defined)
app.all('*', (req, res, next) => {
  const err = new AppError(
    `Can't find ${req.originalUrl} on this server!`,
    404
  );
  ////////// IMPORTANT : if call next(err) => skip all remaining midd and come straight to Error handling midd (the one with 4 param: (err,req,res,next));
  next(err);
});

// GLOBAL ERROR HANDLING MIDDLEWARE
app.use(globalErrorHandler);

module.exports = app;
