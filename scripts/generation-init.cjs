const fs = require('node:fs');
const crypto = require('node:crypto');
const directory = '/home/node/.n8n/generation';
try {
  fs.mkdirSync(directory, { mode: 0o700 });
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}
const status = fs.lstatSync(directory);
if (!status.isDirectory() || status.uid !== process.getuid() || status.mode & 0o077) throw new Error('Private generation directory required.');
const path = directory + '/access-token';
try {
  fs.writeFileSync(path, crypto.randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}
const file = fs.lstatSync(path);
if (!file.isFile() || file.uid !== process.getuid() || file.mode & 0o077 || !/^[a-f0-9]{64}$/.test(fs.readFileSync(path, 'utf8'))) throw new Error('Private generation credential required.');
console.log('Private generation storage ready. Existing data preserved.');
