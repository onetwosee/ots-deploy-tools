var path = require('path');
var when = require('when');
var _ = require('underscore');
var gutil = require('gulp-util');
var yaml = require('js-yaml');

var Templates = function(args, utils) {
  this.args = args;
  this.utils = utils;
};

_.extend(Templates.prototype, {
  /**
   * Standard versioned deploy task
   *
   * If all options are true:
   *  1. Confirms if user wants to deploy (skipped by the --silent command arg)
   *  2. Creates remote deploy directory if it doesn't exist
   *  3. Rsync options.src to configured '<appLocation>/<version>' directory
   *  4. Remotely symlinks '<appLocation>/config.js' to '../config.js'
   *  5. Remote NPM install on the configured appLocation directory
   *  6. Remotely symlinks '<symlinkLocation>' to '<appLocation>/<version>'
   *  7. Remotely restarts upstart. Configued by upstartName.
   *
   * options:
   * {
   *   src: (string) Source directory relative to gulpfile to deploy. (Default: './')
   *                 ** Make sure this string ends with a TRAILING SLASH if you
   *                    just want to copy the contents of the directory! **
   *   npmInstall: (boolean) Do a remote NPM install after rsyncing (Default: true)
   *   restartUpstart: (boolean) Remotely restart the configed upstart to cap
   *                             off the deployment (Default: true)
   *   symlinkConfigFile: (boolean) Remotely symlink 'config.js' to '../config.js'
   *                                (default true)
   * }
   *
   * @param  {object} options See above.
   * @return {Promise}
   */
  deployApp: function(options) {
    var args = this.args;
    var utils = this.utils;

    options = options || {};
    _.defaults(options, {
      src: './',
      npmInstall: true,
      restartUpstart: true,
      symlinkConfigFile: true
    });

    var prevLocation = path.join(args.appLocation, 'prev');
    var uploadLocation = path.join(args.appLocation, 'cur');
    var symlinkLocation = args.symlinkLocation;

    this._logDeployInfo(args, options);
    return when()
      .then(function() {
        return utils.confirm('Are you sure you want to deploy the application to '+args.target+'?', false, args.silent);
      })
      .then(function() {
        if (options.restartUpstart) {
          return utils.stopRemoteUpstart(args.hostConnStr, args.upstartName);
        }
        return true;
      })
      .then(function() {
        /*
          Remove old previous folder
         */
        return utils.removeRemoteDirectory(args.hostConnStr, prevLocation);
      })
      .then(function() {
        /*
          Move current to prev
         */
        return utils.moveRemote(args.hostConnStr, uploadLocation, prevLocation).else(null);
      })
      .then(function() {
        /*
          Ensure upload (current) location exists
         */
        args.silent = true;
        return utils.ensureRemoteDirectory(args.hostConnStr, uploadLocation);
      })
      .then(function() {
        return utils.rsyncApp(options.src, args.hostConnStr, uploadLocation);
      })
      .then(function() {
        if (options.symlinkConfigFile) {
          var configFileSymlink = path.join(uploadLocation, 'config.js');
          return utils.remoteSymlink(args.hostConnStr, '../config.js', configFileSymlink);
        }
        return true;
      })
      .then(function() {
        if (options.npmInstall) {
          return utils.remoteNpmInstall(args.hostConnStr, uploadLocation);
        }
        return true;
      })
      .then(function() {
        return utils.remoteSymlink(args.hostConnStr, uploadLocation, symlinkLocation);
      })
      .then(function() {
        if (options.restartUpstart) {
          return utils.startRemoteUpstart(args.hostConnStr, args.upstartName);
        }
        return true;
      })
      .then(function() {
        gutil.log(gutil.colors.green('Deployment complete!'));
      }).catch(function(err) {
        err = err || "";
        var stack = err && err.stack || "";
        gutil.log(gutil.colors.red('Deployment failed'), err, stack);
        return when.reject(err);
      });
  },
  pullConfig: function() {
    var args = this.args;
    var utils = this.utils;

    var localConfig = './config.'+args.target+'.js';
    this._logDeployInfo(args);
    return when()
      .then(function() {
        return utils.pullFile(
          args.hostConnStr,
          path.join(args.appLocation, 'config.js'),
          localConfig
        )
      })
      .then(function() {
        gutil.log(gutil.colors.green('Config pull complete'));
      }).catch(function(err) {
        gutil.log(gutil.colors.red('Config pull failed.'));
        return when.reject(err);
      });
  },
  pushConfig: function() {
    var args = this.args;
    var utils = this.utils;
    var localConfig = './config.'+args.target+'.js';

    this._logDeployInfo(args);
    return when()
      .then(function() {
        return utils.confirm('Are you sure you want to push and overwrite the '+args.target+' config file?');
      })
      .then(function() {
        return utils.pushFile(
          localConfig,
          args.hostConnStr,
          path.join(args.appLocation, 'config.js')
        )
      })
      .then(function() {
        return utils.restartRemoteUpstart(args.hostConnStr, args.upstartName);
      })
      .then(function() {
        gutil.log(gutil.colors.green('Config push complete'));
      })
      .catch(function(err) {
        gutil.log(gutil.colors.red('Config push failed. Make sure '+localConfig+' exists'));
        return when.reject(err);
      });
  },
  _logDeployInfo: function(args, templateConfig) {
    gutil.log(gutil.colors.underline('Target') + ': ' + gutil.colors.cyan.bold(args.target));
    gutil.log(gutil.colors.underline('Arguments') + '\n' + yaml.safeDump(args, { skipInvalid: true, flowLevel: 2 }));
    if (templateConfig) {
      gutil.log(gutil.colors.underline('Template Config') + '\n' + yaml.safeDump(templateConfig, { skipInvalid: true, flowLevel: 2 }));
    }
  }
});

module.exports = Templates;