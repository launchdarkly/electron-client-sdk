const version = process.env.npm_package_version;

module.exports = {
  automock: false,
  resetModules: true,
  testMatch: ['/**/*-integrationtest.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  globals: {
    VERSION: version,
  },
};
