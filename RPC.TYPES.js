module.exports = {
  service: Object.freeze({
    CALL: '@@service/rpc/CALL',
    SUB: '@@service/rpc/SUB',
    UNSUB: '@@service/rpc/UNSUB'
  }),
  client: Object.freeze({
    RETURN: '@@client/rpc/RETURN',
    ERROR: '@@client/rpc/ERROR',
    EVENT: '@@client/rpc/EVENT',
    SUBSCRIBED: '@@client/rpc/SUBSCRIBED',
    UNSUBSCRIBED: '@@client/rpc/UNSUBSCRIBED'
  })
};
