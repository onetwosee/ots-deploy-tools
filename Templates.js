var path = require('path');
var when = require('when');
var _ = require('underscore');
var gutil = require('gulp-util');

var Templates = function(args, utils) {
  this.args = args;
  this.utils = utils;
};

_.extend(Templates.prototype, {
  deployApp: function() {
    var args = this.args;
    var utils = this.utils;

    var uploadLocation = path.join(args.appLocation, args.version);
    var symlinkLocation = args.symlinkLocation;

    gutil.log(args.target+' deploy config: \n', args, uploadLocation);
    return when()
      .then(function() {
        return utils.confirm('Are you sure you want to deploy the application to '+args.target+'?', false, args.silent);
      })
      .then(function() {
        args.silent = true;
        return utils.ensureRemoteDirectory(args.hostConnStr, uploadLocation);
      })
      .then(function() {
        return utils.rsyncApp('./', args.hostConnStr, uploadLocation)
      })
      .then(function() {
        var configFileSymlink = path.join(uploadLocation, 'config.js');
        return utils.remoteSymlink(args.hostConnStr, '../config.js', configFileSymlink);
      })
      .then(function() {
        return utils.restartRemoteUpstart(args.hostConnStr, args.upstartName);
      })
      .then(function() {
        return utils.remoteSymlink(args.hostConnStr, uploadLocation, symlinkLocation);
      })
      .then(function() {
        gutil.log('Deployment complete');
      }).catch(function(err) {
        gutil.log('Deployment failed', err, err.stack);
      });
  },
  pullConfig: function() {
    var args = this.args;
    var utils = this.utils;

    var localConfig = './config.'+args.target+'.js';
    return when()
      .then(function() {
        return utils.pullFile(
          args.hostConnStr,
          path.join(args.appLocation, 'config.js'),
          localConfig
        )
      })
      .then(function() {
        gutil.log('Config pull complete');
      }).catch(function() {
        gutil.log('Config pull failed.');
      });
  },
  pushConfig: function() {
    var args = this.args;
    var utils = this.utils;
    var localConfig = './config.'+args.target+'.js';

    gutil.log(args.target+' deploy config: \n', args);
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
        gutil.log('Config push complete');
      })
      .catch(function() {
        gutil.log('Config push failed. Make sure '+localConfig+' exists');
      });
  }
});

module.exports = Templates;