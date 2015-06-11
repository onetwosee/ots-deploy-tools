var Utils = require('./Utils.js');
var Templates = require('./Templates.js');

var OTSDeployTools = function(deployConfig, target, packageJson, argv) {
  if (!(this instanceof OTSDeployTools)) {
    return new OTSDeployTools(deployConfig, target, packageJson, argv);
  }

  /*
    Check that config exists
   */
  if (!deployConfig || !deployConfig[target]) {
    throw new Error('OTSDeployTools: Deploy config for target "' + target + '" does not exist.');
  }
  var targetConfig = deployConfig[target];

  /*
    Setup arguments
   */
  var versionSuffix = argv.versionSuffix || '';
  var args = {
    silent: argv.silent || false,
    debug: argv.debug || false,
    versionSuffix: versionSuffix,
    version: packageJson.version + versionSuffix,

    target: target,

    /*
      Deploy config
     */
    appLocation: targetConfig.appLocation,
    symlinkLocation: targetConfig.symlinkLocation,
    hostConnStr: targetConfig.hostConnStr,
    upstartName: targetConfig.upstartName
  };

  this.utils = new Utils(args);
  this.templates = new Templates(args, this.utils);
};


module.exports = OTSDeployTools;