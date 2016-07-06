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

OTSDeployTools.yaml = function(gulp) {
  var variableRegex = /\${([0-9A-Z_.-]+)}/ig;
  try {
    // Parse the project's package.json because we might use it
    var packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

    // Get YAML content and inject environment variables

    var yamlContent = readYamlSync()
      .replace(variableRegex, function(match, varName) {
        varName = varName.toUpperCase();
        var splitVar = varName.split('.');
        if (splitVar[0] === 'ENV' && process.env[splitVar[1]]) {
          return process.env[splitVar[1]];
        }
        else if (varName === 'TARGET') {
          // We'll handle TARGET later, because we don't know the target yet
          return match;
        }
        throw new Error('Unknown variable "' + varName + '"');
      });

    // We'll peek at the yaml file first to get defaultTarget info
    var defaultTarget = pathval.get(yaml.safeLoad(yamlContent), 'deploy.defaultTarget') || 'default';
    var target = argv.deployTarget || argv.target || defaultTarget;

    // Lets replace any remaining TARGET variables now that we know the real target
    yamlContent = yamlContent
      .replace(variableRegex, function(match, varName) {
        varName = varName.toUpperCase();
        if (varName === 'TARGET') {
          return target;
        }
        throw new Error('Unknown variable "' + varName + '"');
      });

    // Now for the real YAML parse
    var deployYaml = yaml.safeLoad(yamlContent);
    var targetConfig = pathval.get(deployYaml, 'deploy.' + target);

    if (!targetConfig) {
      throw new Error('Environment config does not exist for \'' + target + '\'');
    }

    // Get the template config. Allow target configs to extend the global template config.
    var templateConfig = _.extend({}, pathval.get(deployYaml, 'deploy.config'), targetConfig.config);

    // Create a special 'multi-target' object that only holds the selected target
    var targetConfigForOTSDT = {};
    targetConfigForOTSDT[target] = targetConfig;

    // Create deploy tools instance
    var deployTools = new OTSDeployTools(targetConfigForOTSDT, target, packageJson, argv)

    // Define the gulp tasks
    gulp.task('deploy', function() {
      return deployTools.templates.deployApp(templateConfig);
    });

    gulp.task('push-config', function() {
      return deployTools.templates.pushConfig();
    });

    gulp.task('pull-config', function() {
      return deployTools.templates.pullConfig();
    });
  }
  catch (e) {
    gutil.log('ots-deploy-tools.yaml(): ', e);
  }

}

module.exports = OTSDeployTools;