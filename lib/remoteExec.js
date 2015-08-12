var exec = require('child_process').exec;
var gutil = require('gulp-util');
var when = require('when');

var remoteExec = function(connStr, command, noLog) {
  return when.promise(function(resolve, reject) {
    exec("ssh "+connStr+" '"+command+"'", function (err, stdout, stderr) {
      if (err) {
        if (!noLog) {
          gutil.log(gutil.colors.red(err));
        }
        reject(err);
        return;
      }
      resolve();
    });
  })
};

module.exports = remoteExec;