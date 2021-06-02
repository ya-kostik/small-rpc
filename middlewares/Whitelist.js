const isFunction = require('lodash/isFunction');
const isBoolean = require('lodash/isBoolean');
const isObject = require('lodash/isObject');
const set = require('lodash/set');

/**
 * Whitelist middleware for the small-rpc
 * Create instance with whitelist array/map/object
 * @class Whitelist
 * @prop {Object} tree — whitelist tree
 * @param {(Array|Map|Object)} list — array of paths. Map of (key: path, value: boolen or function with boolean result). Object of (key: path, value: boolen or function with boolean result)
 */
class Whitelist {
  constructor(list) {
    this.tree = {};
    this.parseList(list, false);
  }

  /**
   * reset tree field
   * @param {Boolean} [isReset=true] reset or not
   */
  resetTree(isReset = true) {
    this.tree = isReset ? {} : this.tree;
  }

  /**
   * parse new lits
   * @param {(Array|Map|Object)} list — array of paths. Map of (key: path, value: boolen or function with boolean result). Object of (key: path, value: boolen or function with boolean result)
   * @param  {Boolean} [force=true] reset old tree or not
   */
  parseList(list, force = true) {
    this.resetTree(force);
    if (Array.isArray(list)) return this.parseArrayList(list);
    if (list instanceof Map) return this.parseMapList(list);
    if (isObject(list)) return this.parseObjectList(list);
  }

  /**
   * parse new list from map
   * @param {Map} list — map of (key: path, value: boolen or function with boolean result)
   */
  parseMapList(list) {
    for (const [key, value] of list) {
      set(this.tree, key, value);
    }
  }

  /**
   * parse new list from object
   * @param {Object} list — object of (key: path, value: boolen or function with boolean result)
   */
  parseObjectList(list) {
    for (const [key, value] of Object.entries(list)) {
      set(this.tree, key, value);
    }
  }

  /**
   * parse new list
   * @param {Array} list — array of paths
   */
  parseArrayList(list) {
    for (const key of list) {
      set(this.tree, key, true);
    }
  }

  /**
   * run one node of whitelist tree
   * @param  {Mixed} node     current node of tree
   * @param  {Mixed} payload  rpc request payload
   * @param  {Object} action  action of rpc
   * @param  {RPC} rpc        instance
   * @return {(Boolean|undefined)} boolean result or undefined, if node has childs
   */
  runNode(node, payload, action, rpc) {
    if (!node) return false;
    if (isFunction(node)) return !!node(payload, action, rpc);
    if (isFunction(node.call)) return !!node.call(payload, action, rpc);
    if (!isObject(node)) return true;
  }

  /**
   * get result of middleware
   * @param  {Mixed} payload  rpc request payload
   * @param  {Object} action  action of rpc
   * @param  {RPC} rpc        instance
   * @return {Boolean}        stop or not
   */
  getResult(payload, action, rpc) {
    const path = rpc.makePathFromAction(action, true, true);
    // all section

    let node;
    for (const step of path) {
      if (!node) {
        node = this.tree[step];
      } else if (Object.prototype.hasOwnProperty.call(node, step)) {
        node = node[step];
      } else {
        return false;
      }

      if (node === undefined) return false;
      const result = this.runNode(node, payload, action, rpc);
      if (isBoolean(result)) return result;
    }
    // for safe
    return false;
  }

  /**
   * call of middleware
   * you can override this method if you want throw errors with stop
   * @param  {Mixed} payload  rpc request payload
   * @param  {Object} action  action of rpc
   * @param  {RPC} rpc        instance
   * @return {Boolean}        stop or not
   */
  call(payload, action, rpc) {
    return this.getResult(payload, action, rpc);
  }
}

module.exports = Whitelist;
