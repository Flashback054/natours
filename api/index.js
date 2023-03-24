const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Catch SYNC Exception (like using unknown variable,...)
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! Shutting down server...');
  console.log(err.name, ': ', err.message);
  console.log('Stack: ', err.stack);
  process.exit(1);
});

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then((con) => {
    console.log('Connect to DB successfully.');
  });

const app = require('../app');

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server started! Listening on port ${PORT}`);
});

// Catch ASYNC Rejection (like failed DB connection,...)
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLE REJECTION! Shutting down server...');
  console.log(err.name, ': ', err.message);
  console.log('Stack:', err.stack);
  // Give server time to complete req currently being processed
  server.close(() => {
    // process.exit(0) : success, (1) : error
    process.exit(1);
  });
});
