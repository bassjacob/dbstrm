require('dotenv').config();

const path = require('path');
const request = require('request');
const dropbox = require('./dropbox.js')(process.env.DROPBOX_ACCESS_TOKEN);
const feedParser = require('./feedparser.js');
const { flatten, difference } = require('lodash');

function promiseQueue(promises, firstArg) {
  return promises.reduce((p, c) => p.then(c), Promise.resolve(firstArg));
}

function promiseParallelLimit(promises, limit=3, running=[]) {
  const [p, ...ps] = promises;
}

const config = {
  sources: [
    {
      url: 'http://brianposehnsnerdpoker.libsyn.com/rss',
      dirPath: '/media/audio/comedy/nerdpoker2',
    },
    {
      url: 'http://adventurezone.libsyn.com/rss',
      dirPath: '/media/audio/comedy/adventurezone',
    }
  ],
};

function dl(url, length) {
  let dld = 0;
  return new Promise((resolve, reject) => {
    const req = request({ method: 'get', uri: 'url', encoding: null }, (err, response) => {
      if (err) return reject(err);
      return resolve(response.body);
    });
    req.on('data', data => { process.stdout.write(`Download ${path.basename(url)}: ${Math.round(100 * dld/length)}%\r`) });
  });
}

function initArray(length) {
  const arr = [];
  for (let i = 0; i < length; i++) {
    arr.push(undefined);
  }

  return arr;
}

function ul(file, data) {
  console.log("")
  const x = session_id => {
    const chunkSize = 8 * 1024 * 1024;
    const fileSize = data.length;
    const numChunks = Math.ceil(fileSize / chunkSize, chunkSize);
    const d = initArray(numChunks);

    return d.map((unused, i) => {
      const offset = i * chunkSize;
      const contents = data.slice(offset, offset + chunkSize);
      return (offset) => {
        process.stdout.write(`${i} ${contents.length} Upload ${path.basename(file)}: ${Math.round(100 * i * chunkSize / data.length)}%\r`);
        return dropbox.client.filesUploadSessionAppendV2({ contents, cursor: { session_id, offset }}).then(() => offset + Buffer.byteLength(contents))
      };
    });
  };

  return dropbox.client.filesUploadSessionStart({ contents: '', close: false })
    .then(({session_id}) => {
      const d = x(session_id);
      return promiseQueue(d, 0)
        .then(() => dropbox.client.filesUploadSessionFinish({ contents: '', commit: { path: file, mode: 'overwrite', autorename: true }, cursor: {session_id, offset: Buffer.byteLength(data)}}))
    })
}

const getAlreadyDownloadedFiles = dirPath =>
  dropbox
    .listFolder(dirPath)
    .then(({entries}) => entries.map(x => x.name));

const parseFile = url =>
  feedParser(url)
    .then(items => items.map(x => ({ url: x["rss:enclosure"]["@"]["url"].replace(/\?.*$/, ''), length: x["rss:enclosure"]["@"]["length"] })));

const perform = ({url, dirPath}) => {
  return Promise
    .all([
      parseFile(url),
      getAlreadyDownloadedFiles(dirPath)
    ])
    .then(([urls, dropboxFiles]) => {
      const urlFiles = urls
        .reduce((p, {url, length}) => ({
          obj: Object.assign(p.obj, {[path.basename(url)]: {url, length}}),
          arr: p.arr.concat(path.basename(url))
        }), {arr: [], obj: {}});
      const missing = difference(urlFiles.arr, dropboxFiles).map(x => urlFiles.obj[x]);
      return missing.map(({url, length}) => {
        return () => dl(url, length).then(file => ul(`${dirPath}/${path.basename(url)}`, file))
      });
    });
};

Promise.all(config.sources.map(perform))
  .then(ps => promiseQueue(flatten(ps)))
  .then(console.log)
  .catch(console.log);