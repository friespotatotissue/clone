/* eslint-disable */
if(typeof module !== "undefined") {
	module.exports = Client;
	io = require("socket.io-client");
	EventEmitter = require("events").EventEmitter;
} else {
	this.Client = Client;
}


function mixin(obj1, obj2) {
	for(var i in obj2) {
		if(obj2.hasOwnProperty(i)) {
			obj1[i] = obj2[i];
		}
	}
};


function Client(uri) {
	EventEmitter.call(this);
	this.uri = uri || (window.MPP && window.MPP.serverConfig ? window.MPP.serverConfig.getWebSocketURL() : window.location.origin);
	this.socket = undefined;
	this.serverTimeOffset = 0;
	this.user = undefined;
	this.participantId = undefined;
	this.channel = undefined;
	this.ppl = {};
	this.connectionTime = undefined;
	this.connectionAttempts = 0;
	this.desiredChannelId = undefined;
	this.desiredChannelSettings = undefined;
	this.pingInterval = undefined;
	this.canConnect = false;
	this.noteBuffer = [];
	this.noteBufferTime = 0;
	this.noteFlushInterval = undefined;

	this.bindEventListeners();

	this.emit("status", "(Offline mode)");
};

mixin(Client.prototype, EventEmitter.prototype);

Client.prototype.constructor = Client;

Client.prototype.isSupported = function() {
	return typeof io !== "undefined";
};

Client.prototype.isConnected = function() {
	return this.isSupported() && this.socket && this.socket.connected;
};

Client.prototype.isConnecting = function() {
	return this.isSupported() && this.socket && this.socket.connecting;
};

Client.prototype.start = function() {
	this.canConnect = true;
	this.connect();
};

Client.prototype.stop = function() {
	this.canConnect = false;
	if(this.socket) this.socket.disconnect();
};

Client.prototype.connect = function() {
	if(!this.canConnect || !this.isSupported() || this.isConnected() || this.isConnecting())
		return;
	this.emit("status", "Connecting...");
	
	this.socket = io(this.uri, {
		transports: ['websocket'],
		upgrade: false
	});

	var self = this;

	this.socket.on("connect", function() {
		self.connectionTime = Date.now();
		self.sendArray([{m: "hi"}]);
		self.pingInterval = setInterval(function() {
			self.sendArray([{m: "t", e: Date.now()}]);
		}, 20000);
		self.noteBuffer = [];
		self.noteBufferTime = 0;
		self.noteFlushInterval = setInterval(function() {
			if(self.noteBufferTime && self.noteBuffer.length > 0) {
				self.sendArray([{m: "n", t: self.noteBufferTime + self.serverTimeOffset, n: self.noteBuffer}]);
				self.noteBufferTime = 0;
				self.noteBuffer = [];
			}
		}, 200);

		self.emit("connect");
		self.emit("status", "Joining channel...");
	});

	this.socket.on("disconnect", function() {
		self.user = undefined;
		self.participantId = undefined;
		self.channel = undefined;
		self.setParticipants([]);
		clearInterval(self.pingInterval);
		clearInterval(self.noteFlushInterval);

		self.emit("disconnect");
		self.emit("status", "Offline mode");

		// reconnect handling is automatic in socket.io
	});

	this.socket.on("message", function(msg) {
		if(Array.isArray(msg)) {
			for(var i = 0; i < msg.length; i++) {
				self.emit(msg[i].m, msg[i]);
			}
		} else if(msg.m) {
			self.emit(msg.m, msg);
		}
	});

	this.socket.on("hi", function(msg) {
		self.emit("hi", msg);
	});

	this.socket.on("t", function(msg) {
		self.emit("t", msg);
	});

	this.socket.on("ch", function(msg) {
		self.emit("ch", msg);
	});

	this.socket.on("p", function(msg) {
		self.emit("p", msg);
	});

	this.socket.on("n", function(msg) {
		self.emit("n", msg);
	});

	this.socket.on("bye", function(msg) {
		self.emit("bye", msg);
	});
};

Client.prototype.bindEventListeners = function() {
	var self = this;
	this.on("hi", function(msg) {
		self.user = msg.u;
		self.receiveServerTime(msg.t, msg.e || undefined);
		if(self.desiredChannelId) {
			self.setChannel();
		}
	});
	this.on("t", function(msg) {
		self.receiveServerTime(msg.t, msg.e || undefined);
	});
	this.on("ch", function(msg) {
		self.desiredChannelId = msg.ch._id;
		self.channel = msg.ch;
		if(msg.p) self.participantId = msg.p;
		self.setParticipants(msg.ppl);
	});
	this.on("p", function(msg) {
		self.participantUpdate(msg);
		self.emit("participant update", self.findParticipantById(msg.id));
	});
	this.on("m", function(msg) {
		if(self.ppl.hasOwnProperty(msg.id)) {
			self.participantUpdate(msg);
		}
	});
	this.on("bye", function(msg) {
		self.removeParticipant(msg.p);
	});
};

Client.prototype.send = function(raw) {
	if(this.isConnected()) this.socket.emit("message", raw);
};

Client.prototype.sendArray = function(arr) {
	this.send(arr);
};

Client.prototype.setChannel = function(id, set) {
	this.desiredChannelId = id || this.desiredChannelId || "lobby";
	this.desiredChannelSettings = set || this.desiredChannelSettings || undefined;
	this.sendArray([{m: "ch", _id: this.desiredChannelId, set: this.desiredChannelSettings}]);
};

Client.prototype.offlineChannelSettings = {
	lobby: true,
	visible: false,
	chat: false,
	crownsolo: false,
	color:"#ecfaed"
};

Client.prototype.getChannelSetting = function(key) {
	if(!this.isConnected() || !this.channel || !this.channel.settings) {
		return this.offlineChannelSettings[key];
	} 
	return this.channel.settings[key];
};

Client.prototype.offlineParticipant = {
	_id: "",
	name: "",
	color: "#777"
};

Client.prototype.getOwnParticipant = function() {
	return this.findParticipantById(this.participantId);
};

Client.prototype.setParticipants = function(ppl) {
	// remove participants who left
	for(var id in this.ppl) {
		if(!this.ppl.hasOwnProperty(id)) continue;
		var found = false;
		for(var j = 0; j < ppl.length; j++) {
			if(ppl[j].id === id) {
				found = true;
				break;
			}
		}
		if(!found) {
			this.removeParticipant(id);
		}
	}
	// update all
	for(var i = 0; i < ppl.length; i++) {
		this.participantUpdate(ppl[i]);
	}
};

Client.prototype.countParticipants = function() {
	var count = 0;
	for(var i in this.ppl) {
		if(this.ppl.hasOwnProperty(i)) ++count;
	}
	return count;
};

Client.prototype.participantUpdate = function(update) {
	var part = this.ppl[update.id] || null;
	if(part === null) {
		part = update;
		this.ppl[part.id] = part;
		this.emit("participant added", part);
		this.emit("count", this.countParticipants());
	} else {
		if(update.x) part.x = update.x;
		if(update.y) part.y = update.y;
		if(update.color) part.color = update.color;
		if(update.name) part.name = update.name;
	}
};

Client.prototype.removeParticipant = function(id) {
	if(this.ppl.hasOwnProperty(id)) {
		var part = this.ppl[id];
		delete this.ppl[id];
		this.emit("participant removed", part);
		this.emit("count", this.countParticipants());
	}
};

Client.prototype.findParticipantById = function(id) {
	return this.ppl[id] || this.offlineParticipant;
};

Client.prototype.isOwner = function() {
	return this.channel && this.channel.crown && this.channel.crown.participantId === this.participantId;
};

Client.prototype.preventsPlaying = function() {
	return this.isConnected() && !this.isOwner() && this.getChannelSetting("crownsolo") === true;
};

Client.prototype.receiveServerTime = function(time, echo) {
	var self = this;
	var now = Date.now();
	var target = time - now;
	//console.log("Target serverTimeOffset: " + target);
	var duration = 1000;
	var step = 0;
	var steps = 50;
	var step_ms = duration / steps;
	var difference = target - this.serverTimeOffset;
	var inc = difference / steps;
	var iv;
	iv = setInterval(function() {
		self.serverTimeOffset += inc;
		if(++step >= steps) {
			clearInterval(iv);
			//console.log("serverTimeOffset reached: " + self.serverTimeOffset);
			self.serverTimeOffset=target;
		}
	}, step_ms);
	// smoothen

	//this.serverTimeOffset = time - now;			// mostly time zone offset ... also the lags so todo smoothen this
								// not smooth:
	//if(echo) this.serverTimeOffset += echo - now;	// mostly round trip time offset
};

Client.prototype.startNote = function(note, vel) {
	if(this.isConnected()) {
		var vel = typeof vel === "undefined" ? undefined : +vel.toFixed(3);
		if(!this.noteBufferTime) {
			this.noteBufferTime = Date.now();
			this.noteBuffer.push({n: note, v: vel});
		} else {
			this.noteBuffer.push({d: Date.now() - this.noteBufferTime, n: note, v: vel});
		}
	}
};

Client.prototype.stopNote = function(note) {
	if(this.isConnected()) {
		if(!this.noteBufferTime) {
			this.noteBufferTime = Date.now();
			this.noteBuffer.push({n: note, s: 1});
		} else {
			this.noteBuffer.push({d: Date.now() - this.noteBufferTime, n: note, s: 1});
		}
	}
};
