require('colors');

module.exports = class Logger {
  constructor() {
    this.lengths = {
      separator: 50
    };
  }

  get #timestamp() {
    const date = new Date();

    return `[${date.toLocaleDateString('fr-FR').replaceAll('/', '-')} ${date.toLocaleTimeString('fr-FR')}]`.gray;
  }

  log(message) {
    console.log(`${this.#timestamp} ${message}`);

    return true;
  }

  error(error) {
    console.error(`${this.#timestamp} ${'[ERROR]'.red} ${error.message}`);

    if (error.stack) console.error(error.stack.gray);
  }
};
