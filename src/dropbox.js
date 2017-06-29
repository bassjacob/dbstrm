var Dropbox = require('dropbox');

module.exports = (accessToken) => {
  const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });

  return {
    client: dbx,
    listFolder: (path='') => dbx.filesListFolder({ path }),
  };
};
