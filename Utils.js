var gutil = require('gulp-util');
var when = require('when');
var inquirer = require('inquirer');
var _ = require('underscore');
var runSequence = require('run-sequence');
var rsync = require('./lib/rsync');
var remoteExec = require('./lib/remoteExec');
var escapeShell = require('./lib/escapeShell');

function subLog(message) {
  gutil.log('... '+message);
}

function logDone() {
  subLog(gutil.colors.green('Done'));
}

var Utils = function(args) {
  this.args = args;
}

_.extend(Utils.prototype, {
  /**
   * Ask yes/no question to user.
   *
   * Side effects:
   *  - if 'silent' command line param is enabled, the prompt will be skipped and the promised resolved.
   *
   * @param  {string} message       Message to display
   * @param  {boolean} def          Default choice if user enters nothing (false if not specified)
   * @param  {boolean} silent       If true, skip user input and just resolve the promise.
   * @return {Promise}              Resolves if user answers Yes. Rejects if its a No.
   */
  confirm: function(message, def, silent) {
    var args = this.args;
    return when.promise(function(resolve, reject) {
      if (silent || args.silent) {
        gutil.log("Skipping prompt: " + message);
        resolve();
        return;
      }
      inquirer.prompt([{
        type: 'confirm',
        name: 'answer',
        message: message,
        default: (def === void 0) ? false : def,
      }], function(answers) {
        if (answers.answer) {
          resolve();
        }
        else {
          reject();
        }
      })
    });
  },
  /**
   * Stops a remote upstart
   *
   * @param  {string} connStr     Remote SH connection string of host/user
   * @param  {string} upstartName Name of upstart to restart on remote host
   * @return {Promise}
   */
  stopRemoteUpstart: function(connStr, upstartName) {
    gutil.log('Stopping ' + gutil.colors.cyan(upstartName) + '...');
    var unknownJob = false;
    return remoteExec(connStr, "stop "+escapeShell(upstartName), { noLog: true })
      .catch(function(err) {
        if (/Unknown Instance/i.test(err)) {
          // Ignore Unknown instance error
          return when.resolve();
        }
        else if (/Unknown job/i.test(err)) {
          // Ignore unknown job error but give the user a warning
          unknownJob = true;
          return when.resolve();
        }
        else {
          subLog(gutil.colors.red(err));
          return when.reject(err);
        }
      })
      .then(function() {
        if (unknownJob) {
          subLog(gutil.colors.yellow('Warning: Upstart script "' + upstartName + '" does not exist. Could not stop. Moving on anyway...'));
        }
        else {
          logDone();
        }
      });
  },
  /**
   * Start a remote upstart
   *
   * @param  {string} connStr     Remote SH connection string of host/user
   * @param  {string} upstartName Name of upstart to restart on remote host
   * @return {Promise}
   */
  startRemoteUpstart: function(connStr, upstartName) {
    gutil.log('Starting '+gutil.colors.cyan(upstartName)+'...');
    var unknownJob = false;
    return remoteExec(connStr, "start "+escapeShell(upstartName), { noLog: true })
      .catch(function(err) {
        if (/Unknown job/i.test(err)) {
          // Ignore unknown job error but give the user a warning
          unknownJob = true;
          return when.resolve();
        }
        else {
          subLog(gutil.colors.red(err));
          return when.reject(err);
        }
      })
      .then(function() {
        if (unknownJob) {
          subLog(gutil.colors.yellow('Warning: Upstart script "' + upstartName + '" does not exist. Could not start. Moving on anyway...'));
        }
        else {
          logDone();
        }
      });
  },
  /**
   * Restarts a remote upstart
   *
   * @param  {string} connStr     Remote SH connection string of host/user
   * @param  {string} upstartName Name of upstart to restart on remote host
   * @return {Promise}
   */
  restartRemoteUpstart: function(connStr, upstartName) {
    gutil.log('Restarting '+gutil.colors.cyan(upstartName)+'...');
    return remoteExec(connStr, [
      "stop "+escapeShell(upstartName),
      "start "+escapeShell(upstartName)
    ], { noBail: true })
      .then(function() {
        logDone();
      });
  },
  /**
   * Creates a directory structure on the remote host if it doesn't already exist
   *
   * Does a 'mkdir -p'
   *
   * @param  {string} connStr     Remote SSH connection string of host/user
   * @param  {string} directory   Absolute directory
   * @return {Promise}
   */
  removeRemoteDirectory: function(connStr, directory) {
    gutil.log('Removing directory (if not already there): ' + gutil.colors.magenta(directory) + '...');
    return remoteExec(connStr, 'rm -fr '+escapeShell(directory))
      .then(function() {
        logDone();
      });
  },
  /**
   * Creates a directory structure on the remote host if it doesn't already exist
   *
   * Does a 'mkdir -p'
   *
   * @param  {string} connStr     Remote SSH connection string of host/user
   * @param  {string} directory   Absolute directory
   * @return {Promise}
   */
  moveRemote: function(connStr, src, dst) {
    gutil.log('Moving ' + gutil.colors.magenta(src) + ' to ' + gutil.colors.magenta(dst) + '...');
    return remoteExec(connStr, 'mv ' +escapeShell(src) + ' ' + escapeShell(dst), { noLog: true })
      .then(function() {
        logDone();
      });
  },
  /**
   * Creates a directory structure on the remote host if it doesn't already exist
   *
   * Does a 'mkdir -p'
   *
   * @param  {string} connStr     Remote SSH connection string of host/user
   * @param  {string} directory   Absolute directory
   * @return {Promise}
   */
  ensureRemoteDirectory: function(connStr, directory) {
    gutil.log('Creating directory (if not already there): ' + gutil.colors.magenta(directory) + '...');
    return remoteExec(connStr, 'mkdir -p '+escapeShell(directory))
      .then(function() {
        logDone();
      });
  },
  remoteSymlink: function(connStr, src, dst) {
    gutil.log('Symlinking ' + gutil.colors.magenta(src) + ' to ' + gutil.colors.magenta(dst) + ' ...');
    return remoteExec(connStr, [
      'rm -f '+escapeShell(dst),
      'ln -sf '+escapeShell(src)+' '+escapeShell(dst)
    ])
      .then(function() {
        logDone();
      });
  },
  remoteNpmInstall: function(connStr, directory) {
    gutil.log('NPM Installing at ' + gutil.colors.magenta(directory) + '...');
    return remoteExec(connStr, [
      'cd ' + escapeShell(directory),
      'if [ -f .nvmrc ] && ( hash nvm 2>/dev/null ); then',
      '  nvm install',
      '  echo "### NVM INSTALL INVOKED ###"',
      'fi',
      'echo "### NODE VERSION: $(node --version) ###"',
      'echo "### NPM VERSION: $(npm --version) ###"',
      'npm install --production'
    ])
      .then(function(result) {
        var nodeMatches = result.stdout.match(/### NODE VERSION: (.*) ###/);
        var npmMatches = result.stdout.match(/### NPM VERSION: (.*) ###/);
        var nvmMatches = result.stdout.match(/### NVM INSTALL INVOKED ###/);

        if (nvmMatches) {
          subLog('NVM Install Invoked');
        }
        if (nodeMatches) {
          subLog('Node Version: '+nodeMatches[1]);
        }
        if (npmMatches) {
          subLog('NPM Version: '+npmMatches[1]);
        }

        logDone();
      });
  },
  /**
   * Do standard rsync from local srcPath to remote destPath.
   *
   * @param  {string} srcPath     Local source path
   * @param  {string} destConnStr Remote SSH connection string of host/user
   * @param  {string} destPath    Remote destination path
   * @return {Promise}
   */
  rsyncApp: function(srcPath, destConnStr, destPath) {
    gutil.log('Rsyncing...');
    return rsync({
      ssh: true,
      src: srcPath,
      dest: destConnStr+':'+destPath,
      recursive: true,
      delete: true,
      args: ['--verbose'],
      exclude: [
        ".git*",
        "node_modules/",
        ".DS_Store",
        "README.md",
        "environment.json",
        "environment.*.json",
        "/config.js",
        "config.*.js",
        "deploy-config.js"
      ]
    }).then(function() {
      logDone();
    });
  },
  /**
   * Pushes a file from a local path to a remote path
   *
   * @param  {string} srcPath     Local source path
   * @param  {string} destConnStr Remote SSH connection string of host/user
   * @param  {string} destPath    Remote destination path
   * @return {Promise}
   */
  pushFile: function(srcPath, destConnStr, destPath) {
    gutil.log('Pushing config...');
    return rsync({
      ssh: true,
      src: srcPath,
      dest: destConnStr+':'+destPath,
      args: ['--verbose']
    }).then(function() {
      logDone();
    });
  },
  /**
   * Pulls a file from a remote path to a local path
   *
   * @param  {string} srcConnStr Remote SSH connection string of host/user
   * @param  {string} srcPath    Remote source path
   * @param  {string} destPath   Local destination path
   * @return {Promise}
   */
  pullFile: function(srcConnStr, srcPath, destPath) {
    gutil.log('Pulling config to ' + gutil.colors.magenta(destPath) + '...');
    return rsync({
      ssh: true,
      src: srcConnStr+':'+srcPath,
      dest: destPath,
      args: ['--verbose']
    }).then(function() {
      logDone();
    });
  },
  streamToPromise: function(stream) {
    return when.promise(function(resolve, reject){
      stream.on('end', function() {
        resolve();
      });
    });
  },
  /**
   * Call runSequence wrapped in a promise.
   *
   * Call this just like runSequence() but do not include the callback parameter.
   *
   * @return {Promise}
   */
  runSequencePromise: function(task1, task2, task3 /* ... */) {
    var args = Array.prototype.slice.call(arguments);
    return when.promise(function(resolve, reject) {
      // Push the runSequence callback (must be last argument)
      args.push(function(err, result) {
        if (err) {
          reject(err);
        }
        else {
          resolve(result);
        }
      });
      // Call it
      runSequence.apply(global, args);
    });
  }
});

module.exports = Utils;
