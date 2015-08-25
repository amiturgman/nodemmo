
process.on('uncaughtException', function (err) {
  console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
  console.error(err.stack)
  process.exit(1)
});

var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var port = process.env.PORT || 3001;

var redispubsub = require('./redis/pubsub');
var redisState = require('./redis/state');

var state, usersCount;

var config = {
  // dimension of the world
  world: {
    width: 30000,
    height: 10000
  },
  // visible portion of the world
  view: {
    width: 6000,
    height: 2000,

    // extra is the space beyond the view of which
    // the user still wants to get location updates
    // of users moving around him. this can be
    // used by the client to know when users moved
    // outside of the visible view so that they
    // will be removed from the view.
    extraX: 1000,
    extraY: 333
  }
};

app.use(function(req, res, next) {
  res.setHeader('cache-control','no-cache');
  return next();
});

app.use(bodyParser.json());

// update location of a user.
// sample payload: {"id":"username4", "x":16000, "y":2000}
// this is a hook so that users will be able to test location change events
// by posting an event manually
app.post('/location', function(req, res){
  return updateUserLocationChange(req.body, function(err, result){
    if(err)
      return res.end(err.message);
    return res.json(result);
  });
});

// reset the users collection
app.get('/reset', function(req, res){
  state.resetCollection(function(err, result){
    if(err) {
      console.error('error reset collection', err);
      res.writeHead(500);
      return res.end('error reset collection: ' + err.message);
    }

    res.end('collection reset successfully');
  });
});

// server static files
app.use(express.static(path.join(__dirname, 'static')));

// initialize pub/sub service
redispubsub.init(function(err){
  if (err) return console.error('error initializing redis', err);

  // subscribe handler for users location update events
  redispubsub.subscribe(function(message){
    emitUserLocationChanged(JSON.parse(message));
  });

  // get state server
  state = redisState(redispubsub.redis);

  // initialize state server
  state.init(function(err){
    if (err) return console.error('error initializing db', err);
    console.log('db initialized successfully');

    state.count(function(err, count){
      if(err) return console.error('error getting count', err);

      usersCount = count;
      console.log('users count:', count);

      // initialize websocket service
      initSockets();

      // start listening on incoming requests
      http.listen(port, function(err){
        if (err) return console.error(process.pid, 'error listening on port', port, err);
        console.log(process.pid, 'listening on port', port);
      });
    });
  });
});

// location update handler
function emitUserLocationChanged(user) {
  if (!io) return;

  // iterate all clients and send event only to those
  // that this user is in their view
  for (var sid in io.engine.clients) {
    var clientData = io.engine.clients[sid]._userData;
    if (isInView(user, clientData)) {
      io.to(sid).emit('locationChanged', user);
    }
  }

  // check if the user is in the client view (+extra) space
  function isInView(user, client) {
    return  Math.abs(client.x - user.x) <= config.view.width / 2 + config.view.extraX &&
      Math.abs(client.y - user.y) <= config.view.height / 2 + config.view.extraY;
  }

  /*
  // replace the above implementation if you wish to send
  // the event to all clients, regardless of where
  // they are in the world
  console.log('emitting user location changed');
  io.emit('locationChanged', user);
  */

}

function initSockets() {
  io.on('connection', function(socket){
    console.log('a user connected');

    // locate user's client so that we can piggyback some data on top of it
    var client = io.engine.clients[socket.id];
    client._userData = {};

    // authenticate user and save his id on the client data
    socket.on('auth', function(data){
      if(!data.userId)
        return console.warn('userId was not provided');
      client._userData.userId = data.userId;
    });

    // location update event from a client.
    // this will update the client's location in the state server
    // and notify the rest of the servers with the new location so
    // that they can update the relevant clients
    socket.on('location', function(options){
      if(!client._userData.userId) return console.warn('user is not authenticated');

      options.id = client._userData.userId;
      client._userData.x = options.x;
      client._userData.y = options.y;

      // update user's location in the state server
      // and publish location change events to all servers
      return updateUserLocationChange(options, function(err, result) {
        if (err) return console.warn('error updating user location');

        // if user also wants to get users around him after updating
        // his location, we'll fetch the users around him and send
        // the result to him
        if (options.getAroundMe) {
          socket.emit('aroundUser', result);
        }
      });
    });

    socket.on('disconnect', function(){
      console.log('user disconnected');
    });

    // when a client initially connected- send world configuration
    // so that it can draw the world in the right proportions on the screen
    socket.emit('config', config);
  });
}

// updates a user location in the state server and emit event to relevant clients
function updateUserLocationChange(options, cb) {

  // sets area to fetch users (view + extra space from both sides)
  options.width = config.view.width + config.view.extraX * 2;
  options.height = config.view.height + config.view.extraY * 2;

  return state.setUserLocation(options,
    function(err, user){
      if(err)
        return cb(err);

      // update all servers with the user's new location
      // this could also be done in parallel to updating the state server.
      var data = {id: options.id, x: options.x, y: options.y};
      redispubsub.publish(JSON.stringify(data));

      console.log('user', user);
      var result = {me: user};

      // if user also wants to get users around him after updating
      // his location, we'll fetch the users around him and send
      // the result to him
      if (options.getAroundMe) {
        return state.getUsers(options,
          function(err, users){
            if(err)
              return console.warn('error getting users around me:' + err.message);
            result.users = users;
            return cb(null, result);
          });
      }

      return cb(null, result);
    }
  );
}