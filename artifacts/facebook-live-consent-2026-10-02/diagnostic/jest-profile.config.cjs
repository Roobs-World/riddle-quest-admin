const rootDir = '/home/craig-beswetherick/Documents/riddle-quest/packages/portal';
module.exports = {...require(rootDir + '/jest.config.cjs'), rootDir, roots: [__dirname], testMatch: ['**/profile-diagnostic.test.ts']};
