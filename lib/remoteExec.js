var exec = require('child_process').exec;
var gutil = require('gulp-util');
var when = require('when');
var escapeShell = require('./escapeShell');

var remoteExec = function(connStr, command, options) {
  options = options || {};
  var noLog = options.noLog || false;
  var noBail = options.noBail || false;
  // Allow command to be an array of strings
  if (Array.isArray(command)) {
    command = command.join('\n');
  }
  return when.promise(function(resolve, reject) {
    // Force e flag which causes the script to fail if any commands in the script fail
    if (!noBail) {
      command = 'set -e\n'+command;
    }
    var escapedCommand = escapeShell(command, true);
    var sshCmd = "ssh "+connStr+" bash -ic \"'\n"+escapedCommand+"\n'\"";
    exec(sshCmd, function (err, stdout, stderr) {
      if (err) {
        if (!noLog) {
          gutil.log(gutil.colors.red(err));
        }
        reject(err);
        return;
      }
      resolve({stdout: stdout, stderr: stderr});
    });
  })
};

module.exports = remoteExec;
