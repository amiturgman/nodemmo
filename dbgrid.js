
module.exports = function(options) {

  options = options || {};
  options.world = options.world || {};
  options.gridUnit = options.gridUnit || {};

  var worldWidth = options.world.width || 100000;
  var worldHeight = options.world.height || 50000;
  var gridUnitWidth = options.gridUnit.width || 2500;
  var gridUnitHeight = options.gridUnit.height || 1000;

  var digitsX = ((Math.ceil(worldWidth / gridUnitWidth)) +'').length;
  var digitsY = ((Math.ceil(worldHeight / gridUnitHeight)) +'').length;

  function zeroPad(num, places) {
    var zero = places - num.toString().length + 1;
    return Array(+(zero > 0 && zero)).join("0") + num;
  }

  function formatKey(a,b) {
    return zeroPad(a, digitsX) + ',' + zeroPad(b, digitsY);
  }

  function getKeyX(x) {
    return Math.floor(x/gridUnitWidth);
  }

  function getKeyY(y) {
    return Math.floor(y/gridUnitHeight);
  }

  function getKey(x, y) {
    var keyX = getKeyX(x);
    var keyY = getKeyY(y);
    var gridKey = formatKey(keyX, keyY);
    return gridKey;
  }

  function getNeighbors(x, y) {
    var keyX = getKeyX(x);
    var keyY = getKeyY(y);

    var keys = [];

    if(keyX > 0 &&  keyY > 0)  keys.push(formatKey(keyX - 1, keyY - 1));
    if(             keyY > 0)  keys.push(formatKey(keyX,     keyY - 1));
    if(             keyY > 0)  keys.push(formatKey(keyX + 1, keyY - 1));

    if(keyX > 0             )  keys.push(formatKey(keyX - 1, keyY));
                               keys.push(formatKey(keyX,     keyY));
                               keys.push(formatKey(keyX + 1, keyY));

    if(keyX > 0             )  keys.push(formatKey(keyX - 1, keyY + 1));
                               keys.push(formatKey(keyX,     keyY + 1));
                               keys.push(formatKey(keyX + 1, keyY + 1));

    return keys;
  }

  return {
    getKey : getKey,
    getNeighbors: getNeighbors
  };
}