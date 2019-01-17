/**
 * check, is name correct?
 * @param  {String} name your name
 * @return {RPC}         this
 */
function checkName(name) {
  if (typeof name !== 'string') {
    throw new TypeError('name is not a string');
  }
  if (!name.length) {
    throw new TypeError('name is empty');
  }
  return this;
}

/**
 * check, is module name correct?
 * @param  {String} name lib.module name
 * @return {Array}       name splited by dot
 */
function checkModuleName(name) {
  const split = name.split('.');
  if (split.length !== 2) {
    if (split.length !== 1) {
      throw new TypeError('invalid name of module, it should be string with two dot notated values');
    }
    split.unshift('main');
  }
  return split;
}

/**
 * create doted path from action params
 * @param {Object} action
 * @param {Boolean} [isArray=false] path will be an array, not a string
 * @param {Boolean} [addMethod=false] add method or event into a path
 * @return {String|Array}
 */
function makePathFromAction(action, isArray = false, addMethod = false) {
  if (isArray) {
    let path = [];
    if (action.lib) path[0] = action.lib + '';
    else path[0] = 'main';
    path[1] = action.module + '';
    if (addMethod) {
      if (action.method) path[2] = action.method + '';
      else if (action.event) path[2] = action.event + '';
    }
    return path;
  }
  let path = '';
  if (action.lib) path += action.lib + '.';
  path += action.module;
  if (addMethod) {
    if (action.method) path += '.' + action.method;
    else if (action.event) path += '.' + action.event;
  }
  return path;
}

module.exports = function(Class) {
  Class.prototype.checkName = checkName;
  Class.prototype.checkModuleName = checkModuleName;
  Class.prototype.makePathFromAction = makePathFromAction;
  return Class;
};
