"use strict";

var http = require('http'),
	fs = require('fs'),
	url = require("url"),
	path = require("path"),
	util = require('util'),
	ProxyCast = require('../proxycast.js');

var proxycast = new ProxyCast();
var portNumber = 8090;

http.createServer(function (req, res) {

	var reqUrl = url.parse(req.url, true);
	var uri = reqUrl.pathname, filename = path.join(process.cwd(), uri);

	var contentTypesByExtension = {
		'.html': "text/html",
		'.css':  "text/css",
		'.mp4':  "video/mp4",
		'.mkv':  "video/mkv",
		'.vtt':	 "text/plain; charset=utf-8",
		'.js':   "text/javascript"
	};

	var reqIp = req.headers['x-forwarded-for'] || 
		 req.connection.remoteAddress || 
		 req.socket.remoteAddress ||
		 req.connection.socket.remoteAddress;
	console.log("connecting from " + reqIp + ", requesting " + uri);
	if(uri.lastIndexOf("/proxycast/", 0) === 0) { // starts with
		proxycast.handleRequest(req, res);
	} else {
		fs.stat(filename, function(err, stat) {
			if(err) {
				res.writeHead(404, {"Content-Type": "text/plain"});
				res.write("404 Not Found\n");
				res.end();
				return;
			}
			var total = stat.size;
			if (req.headers['range']) {
				var range = req.headers.range;
				var parts = range.replace(/bytes=/, "").split("-");
				var partialstart = parts[0];
				var partialend = parts[1];

				var start = parseInt(partialstart, 10);
				var end = partialend ? parseInt(partialend, 10) : total-1;
				var chunksize = (end-start)+1;
				//console.log('RANGE: ' + start + ' - ' + end + ' = ' + chunksize);

				var file = fs.createReadStream(filename, {start: start, end: end});
				res.writeHead(206, {
					'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
					'Accept-Ranges': 'bytes', 'Content-Length': chunksize,
					'Content-Type': contentTypesByExtension[path.extname(filename)],
					'Access-Control-Allow-Origin': '*' 
				});
				file.pipe(res);
			} else {
				//console.log('ALL: ' + total);
				res.writeHead(200, {
					'Content-Length': total,
					'Content-Type': contentTypesByExtension[path.extname(filename)],
					'Access-Control-Allow-Origin': '*' 
				});
				fs.createReadStream(filename).pipe(res);
				}
		} );
	}

}).listen(portNumber);
console.log('Server running on port %d', portNumber);

