var Redis = require('ioredis');

var redisConfig= require('./config.json');

var redis, pub, handler;
var redisReady = false;
var channel = 'locationChanged';

function init(cb) {

  var self = this;
  redis = new Redis(redisConfig);
  pub = redis.duplicate();

  redis.on('connect', function(){
    console.log('redis connected');
  });

  redis.on('ready', function(){
    console.log('redis is ready');
    redisReady = true;
    registerHandlers();
    self.redis = redis;
    return cb();
  });

  redis.on('error', function(err){
    console.error('redis error:', err);
    redisReady = false;
  });

  redis.on('close', function(){
    console.info('redis closed');
    redisReady = false;
  });

  redis.on('reconnecting', function(){
    console.info('redis is reconnecting');
    redisReady = false;
  });

  // register handlers
  function registerHandlers() {

    redis.subscribe(channel, function (err, count) {
      // Now we are subscribed to the 'locationChanged' channel
      if (err)
        return console.error('error subscribing to channel', channel, err);
    });

    redis.on('message', function (channel, message) {
      // Receive messages from channel 'locationChanged'
      if (handler)
        handler(message);
    });
  }
}

module.exports = {
  // init component
  init:  init,
  // publish a location change event to all servers
  publish : function(message, cb){
    //console.log('publishing', message);
    pub.publish(channel, message);
  },
  // subscribe to a location change event
  subscribe: function(cb) {
    console.log('subscribing handler');
    handler = cb;
  }
}
