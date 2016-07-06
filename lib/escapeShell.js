
// http://stackoverflow.com/a/7685469
function escapeShell(cmd, noWrap) {
  var escaped = cmd.replace(/(["'\\])/g,'\\$1');
  if (noWrap) {
    return escaped;
  }
  return '"'+escaped+'"';
};

module.exports = escapeShell;
