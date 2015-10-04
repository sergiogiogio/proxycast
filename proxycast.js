"use strict";

var 	Client = require('castv2').Client,
	EventEmitter = require("events").EventEmitter,
	CBuffer = require("CBuffer"),
	mdns = require('multicast-dns'),
	url = require('url'),
	cookie = require('cookie'),
	debug = require('debug')('ProxyCast');


// session
var sSessionId = 1;
var Session = function() {
	this.sessionId = sSessionId++;
	this.requestId = 1;
	this.seqNo = 1;
	this.castClient = null;
	this.replyBuffer = new CBuffer(100);
	this.replyBufferEvent = new EventEmitter();
	this.senderId = 'client-' + Math.floor(Math.random() * 10e5);
	this.receiverId = 'receiver-0';
	this.castClientConnected = false;
}

// Proxy Api

var ProxyCast = function() {
	this.sessions = {};
}
ProxyCast.prototype.handleRequest = function(request, response) {
        var self = this;
        var body = '';
        request.on('data', function (data) {
                body += data;
                if (body.length > 1e6) // Too much POST data, kill the connection!
                    request.connection.destroy();
        });
        request.on('end', function () {
                self.handleApi(body, request, response);
        });
}
ProxyCast.prototype.handleApi = function(body, request, response) {
	var self = this;
	var session;
        var requestUrl = url.parse(request.url, true);
        var uri = requestUrl.pathname;
	var cookies;
	var seqNo;
	var mdnsBrowser;
	var jBody;

	if(request.headers.cookie) {	
		cookies = cookie.parse(request.headers.cookie);
		debug("handleApi: session = %s, data = %j", cookies.sessionId, body);
		session = self.sessions[cookies.sessionId];
	}
	if( session === undefined ) {
		session = new Session();
		self.sessions[session.sessionId] = session;
		debug("handleApi: new session = %s", session.sessionId);
	}

	if(uri === "/proxycast/discover" && request.method === "POST") {
		mdnsBrowser = new mdns();
		mdnsBrowser.on('response', function (data) {
			var i;
			debug("mdns response: %j", data);
			if(data.answers && data.answers[0] && data.answers[0].name === "_googlecast._tcp.local" && data.answers[0].type === "PTR") {
			debug("iterate additionals...");
				for(i = 0 ; i < data.additionals.length ; ++i)
				{
					if(data.additionals[i].type === "A") {
						debug("Device found and added (mdns): %j", data);
						session.replyBuffer.push({ seqNo: session.seqNo++, senderId: "proxycast", receiverId: "*", namespace: "/proxycast/discover", payload: { name: data.additionals[i].name, ip: data.additionals[i].data } });
						session.replyBufferEvent.emit('message');
					}
				}
			}
		});
		debug("start discovering devices...");
		mdnsBrowser.query({
			questions:[{
			name: '_googlecast._tcp.local',
			type: 'PTR'
			}]
		});
		//stop after timeout
		setTimeout(function() {
			debug("Stopped browsing devices");
			mdnsBrowser.destroy();
			session.replyBuffer.push({ seqNo: session.seqNo++, senderId: "proxycast", receiverId: "*", namespace: "/proxycast/discover", payload: null });
			session.replyBufferEvent.emit('message');
		}, 5000);
		response.writeHead(200, {
			"Content-Type": "application/json; charset=utf-8",
			"Set-Cookie": cookie.serialize('sessionId', session.sessionId) 
		});
		response.write(JSON.stringify({ status:"OK" }));
		response.end();


	} else if(uri === "/proxycast/connect" && request.method === "POST") {
		var jBody = JSON.parse(body);
		// cleanup potential existing Client
		if(session.heartbeatTimer) clearTimeout(session.castClient.heartbeatTimer);
		if(session.castClient) session.castClient.close();
		// create new Client
		session.castClient = new Client();
		session.castClient.on('connect', function() { session.castClientConnected = true; });
		session.castClient.on('close', function() { session.castClientConnected = false; });
		session.castClient.on('error', function(err) {
			response.writeHead(200, {
				"Content-Type": "application/json; charset=utf-8",
				"Set-Cookie": cookie.serialize('sessionId', session.sessionId) 
			});
			response.write(JSON.stringify({ status:"ERROR", code:"GENERIC", message:err.message }));
			response.end();
		});
		debug("connecting to %s", jBody.address);
		session.castClient.connect(jBody.address, function() {
			session.castClient.on('message', function(senderId, receiverId, namespace, data) {
				if(namespace != 'urn:x-cast:com.google.cast.tp.heartbeat') {
					debug("queue message received: %j, pushing to session %s", data, session.sessionId);
					session.replyBuffer.push({ seqNo: session.seqNo++, senderId: senderId, receiverId: receiverId, namespace: namespace, payload: JSON.parse(data) });
					session.replyBufferEvent.emit('message');
				}
			});
			session.castClient.send(session.senderId, session.receiverId, 'urn:x-cast:com.google.cast.tp.connection', JSON.stringify( { type: 'CONNECT' } ));
			session.heartbeatTimer = setInterval(function() {
				session.castClient.send(session.senderId, session.receiverId, 'urn:x-cast:com.google.cast.tp.heartbeat', JSON.stringify( { type: 'PING' }) );
			}, 5000);
			response.writeHead(200, {
				"Content-Type": "application/json; charset=utf-8",
				"Set-Cookie": cookie.serialize('sessionId', session.sessionId) 
			});
			response.write(JSON.stringify({ status:"OK" }));
			response.end();
		});

	} else if(uri === "/proxycast/message" && request.method === "GET") {
		seqNo = requestUrl.query.seq || 0;
		debug("/proxycast/message: request seqNo = %d (original: %j), size = %d, length = %d", seqNo, requestUrl.query.seq, session.replyBuffer.size, session.replyBuffer.length);
		while(session.replyBuffer.size > 0 && session.replyBuffer.first().seqNo <= seqNo ) {
			debug("/proxycast/message: discarding message: %j", session.replyBuffer.first());
			session.replyBuffer.shift();
		}
		if( session.replyBuffer.size > 0 ) {
			debug("/proxycast/message: delivering message: %j", session.replyBuffer.first());
			response.writeHead(200, {
				"Content-Type": "application/json; charset=utf-8",
				"Set-Cookie": cookie.serialize('sessionId', session.sessionId) 
			});
			response.write( JSON.stringify( session.replyBuffer.first() ) );
			response.end();
		} else {
			debug("session %s: no message found, looping", session.sessionId);
			var loopFun = function() { self.handleApi(body, request, response); };
			var removeLoopFun = function() { session.replyBufferEvent.removeListener('message', loopFun); };
			session.replyBufferEvent.once('message', loopFun);
			request.on('close', removeLoopFun);
			request.on('end', removeLoopFun);
		}

	} else if(uri === "/proxycast/nextRequestId" && request.method === "POST") {
		response.writeHead(200, {
			"Content-Type": "application/json; charset=utf-8",
			"Set-Cookie": cookie.serialize('sessionId', session.sessionId) 
		});
		response.write(JSON.stringify({ status: "OK", requestId: session.requestId++ }));
		response.end();
	} else if(uri === "/proxycast/send" && request.method === "POST") {
		var jBody = JSON.parse(body);
		if (jBody.payload.requestId === null) {
			jBody.payload.requestId = session.requestId++;
		}
		response.writeHead(200, {
			"Content-Type": "application/json; charset=utf-8",
			"Set-Cookie": cookie.serialize('sessionId', session.sessionId) 
		});
		if(session.castClientConnected) {
			session.castClient.send(session.senderId, jBody.receiverId, jBody.namespace, JSON.stringify( jBody.payload ) );
			response.write(JSON.stringify({ status: "OK", requestId: jBody.payload.requestId }));
		} else {
			response.write(JSON.stringify({ status: "ERROR", code: "DISCONNECTED" }));
		}
		response.end();
	} else {
		response.writeHead(404, {
			"Content-Type": "application/json; charset=utf-8",
			"Set-Cookie": cookie.serialize('sessionId', session.sessionId) 
		});
		response.end();
	}
}



module.exports = ProxyCast
