var fs = require('fs');

module.exports = function readYamlSync() {
  var content;
  try {
    content = fs.readFileSync('./.deploy.yml', 'utf8');
  }
  catch (e) {
    try {
      content = fs.readFileSync('./.deploy.yaml', 'utf8');
    }
    catch (e) {
      throw new Error('Could not find .deploy.yml');
    }
  }
  return content;
};
