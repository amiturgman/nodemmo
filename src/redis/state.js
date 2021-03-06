
// Redis API documentation can be found here: http://redis.io/commands

var spatialMapper = require('spatial-mapping')();
var Redis = require('ioredis');

var redisConfig= require('./config.json');
var redis = new Redis(redisConfig);
var USERS = 'users';

module.exports = function() {

  var api = {

    // initialize module
    init : function(cb){
      return cb();
    },

    // count number of users in our state server
    count: function(cb) {
      return redis.hlen(USERS, cb);
    },

    // gets a specific user
    getUser: function(id, cb) {
      return redis.hgetall(id, function(err, user){
        if (err) return cb(err);
        if (!user.id) return cb();
        user.x = parseInt(user.x);
        user.y = parseInt(user.y);
        return cb(null, user);
      });
    },

    // sets a user location in the state server
    setUserLocation: function(options, cb) {
      return this.getUser(options.id, function(err, user){
        if (err) {
          console.error('error getting user', options.id, err);
          return cb(new Error('error getting user: ' + err.message));
        }

        // starts a transaction
        var tx = redis.multi();

        if (user) {
          // remove user from his previous area
          tx.hdel(user.gridKey, options.id)
        }
        else {
          // add user to users' collection
          tx.hset(USERS, options.id, 1);
          user = {
            id: options.id
          };
        }

        // gets current grid key
        var gridKey = spatialMapper.getKey(options.x, options.y);

        // within a transaction scope-
        return tx
          // add user to the new grid area
          .hset(gridKey, options.id, 1)
          // set user's new area and coordinates
          .hmset(options.id, {
            id: options.id,
            gridKey: gridKey,
            x: options.x,
            y: options.y
          })
          // execute transaction
          .exec(function (err, results) {
            if (err) {
              console.error('error setting location for user', err, results);
              return cb(err);
            }

            // update current user instance with updated data
            user.gridKey = gridKey;
            user.x = options.x;
            user.y = options.y;

            return cb(null, user);
          });
      });
    },

    // resets users collection
    resetCollection: function(cb) {
      return redis.flushall(function(err, result){
        if (err) return cb(err);
        console.log('redis flushall completed', result);
        return cb();
      });
    },
    // gets users in a specific view
    getUsers: getUsers
  };

// x,y,width,height
  function getUsers(options, cb) {

    // get users from neighbours grids
    var gridKeys = spatialMapper.getViewGrids(options.x, options.y);
    //console.log('looking for grid keys', gridKeys);

    var pipeline = redis.pipeline();
    for(var i=0; i<gridKeys.length; i++) {
      pipeline.hkeys(gridKeys[i]);
    }

    return pipeline.exec(function (err, results) {
      if (err) return cb(err);

      pipeline = redis.pipeline();
      results.forEach(function(result){
        if(result[0]) return cb(result[0]);
        result[1].forEach(function(id){
          pipeline.hgetall(id);
        });
      });

      return pipeline.exec(function (err, results) {
        if (err) return cb(err);

        var users = [];

        results.forEach(function(result){
          if(result[0]) return cb(result[0]);
          var user = result[1];
          var user_x = parseInt(user.x);
          var user_y = parseInt(user.y);

          if(isInView({x: user_x, y: user_y}, options)) {
            user.x = user_x;
            user.y = user_y;
            users.push(user);
          }
        });

        return cb(null, users);
      });
    });

    // check if the user is in the client view space
    function isInView(user, client) {
      return  Math.abs(client.x - user.x) <= options.width &&
        Math.abs(client.y - user.y) <= options.height;
    }
  }

  return api;
}

