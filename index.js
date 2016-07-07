var Utils = require('./Utils.js');
var Templates = require('./Templates.js');
var fs = require('fs');
var yaml = require('js-yaml');
var gutil = require('gulp-util');
var pathval = require('pathval');
var _ = require('underscore');
var readYamlSync = require('./lib/readYamlSync');


var argv = require('yargs').argv;


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

var variableRegex = /\${([0-9A-Z_.-]+)}/ig;
function resolveVariables(string, target) {
  return string
    .replace(variableRegex, function(match, varName) {
      varName = varName.toUpperCase();
      var splitVar = varName.split('.');
      if (splitVar[0] === 'ENV' && process.env[splitVar[1]]) {
        return process.env[splitVar[1]];
      }
      else if (target && varName === 'TARGET') {
        return target;
      }
      throw new Error('Unknown variable "' + varName + '"');
    });
}

OTSDeployTools.yaml = function(gulp) {
  try {
    // Parse the project's package.json because we might use it
    var packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

    // Get YAML content and parse it
    var deployYaml = yaml.safeLoad(readYamlSync());
    var defaultTarget = resolveVariables(pathval.get(deployYaml, 'deploy.defaultTarget') || 'default');
    var target = argv.deployTarget || argv.target || defaultTarget;

    var targetConfig = pathval.get(deployYaml, 'deploy.' + target);

    if (!targetConfig) {
      throw new Error('Environment config does not exist for \'' + target + '\'');
    }

    // Get the template config. Allow target configs to extend the global template config.
    var templateConfig = _.extend({}, pathval.get(deployYaml, 'deploy.config'), targetConfig.config);

    function getDeployTools() {
      function variableMapper(value) {
        if (typeof value === 'string') {
          return resolveVariables(value, target);
        }
        else if (typeof value === 'object') {
          return _.mapObject(value, variableMapper);
        }
        return value;
      }
      // Resolve variables
      targetConfig = _.mapObject(targetConfig, variableMapper);
      templateConfig = _.mapObject(templateConfig, variableMapper);

      // Create a special 'multi-target' object that only holds the selected target
      var targetConfigForOTSDT = {};
      targetConfigForOTSDT[target] = targetConfig;

      // Create deploy tools instance
      return new OTSDeployTools(targetConfigForOTSDT, target, packageJson, argv)
    }

    // Define the gulp tasks
    gulp.task('deploy', function() {
      return getDeployTools().templates.deployApp(templateConfig);
    });

    gulp.task('push-config', function() {
      var deployTools = new OTSDeployTools(targetConfigForOTSDT, target, packageJson, argv)
      return getDeployTools().templates.pushConfig();
    });

    gulp.task('pull-config', function() {
      var deployTools = new OTSDeployTools(targetConfigForOTSDT, target, packageJson, argv)
      return getDeployTools().templates.pullConfig();
    });
  }
  catch (e) {
    gutil.log('ots-deploy-tools.yaml(): ', e);
  }

}

module.exports = OTSDeployTools;