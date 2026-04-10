module.exports = class Logger {
  log(message) {
    console.log(message);

    return true;
  }

  error(error) {
    console.error(error.message);

    if (error.stack) console.error(error.stack);
  }
};
