var exec = require('child_process').exec;
var gutil = require('gulp-util');
var when = require('when');

var remoteExec = function(connStr, command) {
  return when.promise(function(resolve, reject) {
    exec("ssh "+connStr+" '"+command+"'", function (err, stdout, stderr) {
      if (err) {
        gutil.log(gutil.colors.red(err));
        reject(err);
        return;
      }
      resolve();
    });
  })
};

module.exports = remoteExec;