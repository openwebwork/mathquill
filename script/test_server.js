/* eslint-env node */
/* eslint-disable no-console */

const http = require('http');
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

// constants
const PORT = +process.env.PORT || 9292;
const HOST = process.env.HOST || '0.0.0.0';

let q = null;
const run_make_test = () => {
	if (q) return;
	q = [];
	console.log('[%s]\nnpm run devbuild', new Date().toISOString());
	const make_test = child_process.exec('npm run devbuild', { env: process.env });
	make_test.stdout.pipe(process.stdout, { end: false });
	make_test.stderr.pipe(process.stderr, { end: false });
	make_test.on('exit', (code) => {
		if (code) {
			console.error('Exit Code ' + code);
		} else {
			console.log(`\nMathQuill is now running on ${HOST}:${PORT}`);
			console.log(`Open http://${HOST}:${PORT}/test/demo.html\n`);
		}
		for (const qi of q) qi();
		q = null;
	});
};

const enqueueOrDo = (cb) => q ? q.push(cb) : cb();

// functions
const serveRequest = (req, res) => {
	const reqTime = new Date;
	enqueueOrDo(() => {
		const filepath = path.normalize(req.url).slice(1);
		fs.readFile(filepath, (err, data) => {
			if (err) {
				if (err.code === 'ENOENT' || err.code === 'EISDIR') {
					res.statusCode = 404;
					res.end('404 Not Found: /' + filepath + '\n');
				}
				else {
					console.log(err);
					res.statusCode = 500;
					res.end('500 Internal Server Error: ' + err.code + '\n');
				}
			}
			else {
				const ext = filepath.match(/\.[^.]+$/);
				if (ext) res.setHeader('Content-Type', 'text/' + ext[0].slice(1));
				res.end(data);
			}

			console.log('[%s] %s %s /%s - %s%sms',
				reqTime.toISOString(), res.statusCode, req.method, filepath,
				(data ? (data.length >> 10) + 'kb, ' : ''), Date.now() - reqTime);
		});
	});
};

const recursivelyWatch = (watchee, cb) => {
	fs.readdir(watchee, (err, files) => {
		const recurse = (file) => recursivelyWatch(path.join(watchee, file), cb);

		if (err) { // not a directory, just watch it
			fs.watch(watchee, cb);
		}
		else { // a directory, recurse, also watch for files being added or deleted
			files.forEach(recurse);
			fs.watch(watchee, () => {
				fs.readdir(watchee, (err, filesNew) => {
					if (err) return; // watchee may have been deleted
					// filesNew - files = new files or dirs to watch
					filesNew.filter((file) => files.indexOf(file) < 0).forEach(recurse);
					files = filesNew;
				});
				cb();
			});
		}
	});
};

// main
http.createServer(serveRequest).listen(PORT, HOST);
console.log(`listening on ${HOST}:${PORT}`);

run_make_test();

for (const filename of ['src', 'test', 'webpack.config.js', 'package.json']) {
	recursivelyWatch(filename, run_make_test);
};
