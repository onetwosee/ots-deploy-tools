var gutil = require('gulp-util');
var when = require('when');
var inquirer = require('inquirer');
var _ = require('underscore');
var runSequence = require('run-sequence');
var rsync = require('./lib/rsync');
var remoteExec = require('./lib/remoteExec');

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
   * Restarts a remote upstart
   *
   * @param  {string} connStr     Remote SH connection string of host/user
   * @param  {string} upstartName Name of upstart to restart on remote host
   * @return {Promise}
   */
  restartRemoteUpstart: function(connStr, upstartName) {
    gutil.log('Restarting '+upstartName+'...');
    return remoteExec(connStr, "stop "+upstartName+" && start "+upstartName)
      .then(function() {
        gutil.log('Restarted.');
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
    gutil.log('Creating directory (if not already there): ' + directory + '...');
    return remoteExec(connStr, 'mkdir -p '+directory)
      .then(function() {
        gutil.log('Done.');
      });
  },
  remoteSymlink: function(connStr, src, dst) {
    gutil.log('Symlinking ' + src + ' to ' + dst);
    return remoteExec(connStr, 'rm -f '+dst+' && ln -sf '+src+' '+dst)
      .then(function() {
        gutil.log('Done.');
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
        "config.js",
        "config.*.js",
        "deploy-config.js"
      ]
    }).then(function() {
      gutil.log('Rsync complete.');
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
    gutil.log('Pushing staging config...');
    return rsync({
      ssh: true,
      src: srcPath,
      dest: destConnStr+':'+destPath,
      args: ['--verbose']
    }).then(function() {
      gutil.log('Push complete.');
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
    gutil.log('Pulling staging config...');
    return rsync({
      ssh: true,
      src: srcConnStr+':'+srcPath,
      dest: destPath,
      args: ['--verbose']
    }).then(function() {
      gutil.log('Pull complete to ' + destPath);
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