var FeedParser = require('feedparser');
var request = require('request'); // for fetching the feed

module.exports = (feed) => new Promise((resolve, reject) => {
  const req = request(feed)
  const feedparser = new FeedParser([]);
  const items = [];

  req.on('error', reject);
  feedparser.on('error', reject);

  req.on('response', function (res) {
    var stream = this; // `this` is `req`, which is a stream

    if (res.statusCode !== 200) {
      this.emit('error', new Error('Bad status code'));
    } else {
      stream.pipe(feedparser);
    }
  });

  feedparser.on('readable', function () {
    let item;

    while (item = this.read()) {
      items.push(item);
    }
  });

  feedparser.on('finish', () => resolve(items))
});
