var exec = require('child_process').exec;
var gutil = require('gulp-util');
var when = require('when');
var inquirer = require('inquirer');
var runSequence = require('run-sequence');
var rsync = require('./lib/rsync');

module.exports = {
  /**
   * Ask yes/no question to user.
   *
   * @param  {string} message Message to display
   * @param  {boolean} def    Default choice (false if not specified)
   * @return {Promise}        Resolves if user answers Yes. Rejects if its a No.
   */
  confirm: function(message, def) {
    return when.promise(function(resolve, reject) {
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
    return when.promise(function(resolve, reject) {
      gutil.log('Restarting '+upstartName+'...');
      exec("ssh "+connStr+" 'stop "+upstartName+" && start "+upstartName+"'", function (err, stdout, stderr) {
        if (err) {
          gutil.log(gutil.colors.red(err));
          reject();
          return;
        }
        gutil.log('Restarted.');
        resolve();
      });
    })
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
}