# nodemmo
Massively Multiplayer Online Game for young developers using node.js and Redis

![MMO visualization](https://github.com/amiturgman/nodemmo/raw/master/img/simulation.png "MMO visualization")

This code is a sample for creating a scalable MMO game for young developers. The idea is that there's no use of any MMO framework so that it is not a barrier for new developers.
We keep it simple by using only nodejs & Redis.
Redis is our state server which keeps the state of all the players in the game. Our servers are stateless, so it doesn't really matters to which servers the users are connected.
We'll use Redis pub/sub feature to also sync all the servers with all the users' location change updates.

We have one big world, which we split to areas/buckets/views using the [spatial-mapping](https://github.com/amiturgman/spatial-mapping) node module. Each area is mapped to a specific Id in the world
so that we can just use a hash to keep which users are in a specific area. We can also use this key to save this data in a simple database, like Azure Table for example, which cost less than any spatial-capable solution out there.

Currently, the client side is a simulation of how the world is look like from a 30 miles above.
We can see the players spread in the world, and also our "view"- the red border around us.
The "view" is the area that is visible to us as players. The blue border around the red one, is an area for which we still get updates, although it is not visible to us.
This is for the client logic to know that a player is coming to our direction, or a player is leaving our visible area.

Find more about this in my [blog post](http://todo-add-url.com).

# install & setup

First, you'll need to install [Redis](http://redis.io/download) locally on your machine, or use Redis as a service ([here](http://azure.microsoft.com/en-us/services/cache/) for example).

Then, enlist the code and run:
```
  git clone https://github.com/amiturgman/nodemmo.git
  cd nodemmo/src
  npm install
  node app.js
```

# test
Open your favorite browser, and browse to `http://localhost:3001`

In the username textbox, type a username and hit the `Start` button.
This will trigger a random location-update event beeing sent to the server every second, and propagate to all users connected to one of the servers.
Only users that we're in their visible area- will get the event, and will see us in their view (+extra) area.

In order to see how this is working, there's also a hook which allows you to trigger location-change events by triggering an http request:

![triggers http location change event](https://github.com/amiturgman/nodemmo/raw/master/img/http-location.png "triggers http location change event")

Press `pause` to stop the location change events, and look at the last location change event that was sent to the server by switching to the node console.
Trigger a similar http `POST` request to `http://localhost:3001/location`, by replacing the `x` and `y` coordinates with nearby coordinates.
Once triggering the request, you should see the new user located around you in the view. Try playing with the coordinates, and move the users further to the view + extra borders (red and blue).
You will notice that once you move out of the view, you will not get any location updates anymore.



# License
[MIT](blob/master/LICENSE)
