var rsync = require('rsyncwrapper').rsync;
var gutil = require('gulp-util');
var when = require('when');

module.exports = function(config) {
  return when.promise(function(resolve, reject) {
    rsync(config, function(err, stdout, stderr, cmd) {
      if (err) {
        gutil.log(gutil.colors.red(stderr));
        reject();
        return;
      }
      resolve();
    });
  })
};