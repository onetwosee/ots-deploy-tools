# ots-deploy-tools
Gulp deployment utilities and task templates for OneTwoSee applications

## Sample Files

### deploy-config.js
```javascript
module.exports = {
  staging: {
    appLocation: '/usr/local/ots/vi-redirector',
    symlinkLocation: '/var/www/vi-redirector',
    hostConnStr: 'root@staging-1',
    upstartName: 'ots-vi-redirector'
  }
}
```

### gulpfile.js
```javascript
var gulp = require('gulp');
var gutil = require('gulp-util');
var when = require('when');
var path = require('path');

var stagingDeployTools = require('ots-deploy-tools')(
  require('./deploy-config.js'),
  'staging',
  require('./package.json'),
  require('yargs').argv
);

/**
 * deploy-staging
 *
 * Deploys the entire application root to the staging server, excluding
 * the server environment.json file and a few unimportant files.
 */
gulp.task('deploy-staging', function() {
  return stagingDeployTools.templates.deployApp();
});

/**
 * push-staging-config
 *
 * Deploys the server environment file located at
 * ./server/environment.staging.json to the right place on
 * on the staging server and restarts the server.
 */
gulp.task('push-staging-config', function() {
  return stagingDeployTools.templates.pushConfig();
});

/**
 * pull-staging-config
 *
 * Pulls the current server environment.json file that is in use
 * by the staging server and saves it to:
 *   ./server/environment.staging.json
 */
gulp.task('pull-staging-config', function() {
  return stagingDeployTools.templates.pullConfig();
});
```
