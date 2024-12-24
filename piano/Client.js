/* eslint-disable */
if(typeof module !== "undefined") {
	module.exports = Client;
	WebSocket = require("ws");
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


var Client = function(socket) {
	EventEmitter.call(this);
	this.socket = socket;
	this.serverTimeOffset = 0;
	this.participantId = null;
	this.channel = null;
	this.ppl = {};
	this.connectionTime = null;
	this.connectionAttempts = 0;
	this.desiredChannelId = null;
	this.desiredChannelSettings = null;
	this.pingInterval = undefined;
	this.canConnect = true;
	this.noteBuffer = [];
	this.noteBufferTime = 0;
	this.noteFlushInterval = undefined;

	this.bindEventListeners();
};

Client.prototype = new EventEmitter();

Client.prototype.bindEventListeners = function() {
	var self = this;

	this.socket.on("connect", function() {
		self.connectionTime = Date.now();
		self.emit("connect");
		if(self.desiredChannelId) {
			self.setChannel(self.desiredChannelId, self.desiredChannelSettings);
		}
	});

	this.socket.on("disconnect", function() {
		self.user = undefined;
		self.participantId = null;
		self.channel = null;
		self.setParticipants([]);
		clearInterval(self.pingInterval);
		clearInterval(self.noteFlushInterval);

		self.emit("disconnect");
	});

	this.socket.on("n", function(msg) {
		self.emit("n", msg);
	});

	this.socket.on("m", function(msg) {
		self.emit("m", msg);
	});

	this.socket.on("a", function(msg) {
		self.emit("a", msg);
	});

	this.socket.on("ch", function(msg) {
		self.channel = msg.ch;
		self.emit("ch", msg);
	});
};

Client.prototype.start = function() {
	this.socket.connect();
};

Client.prototype.stop = function() {
	this.socket.disconnect();
};

Client.prototype.setChannel = function(id, settings) {
	this.desiredChannelId = id;
	this.desiredChannelSettings = settings;
	if (this.isConnected()) {
		this.socket.emit("ch", {_id: id, set: settings});
	}
};

Client.prototype.sendArray = function(arr) {
	this.socket.emit("n", arr);
};

Client.prototype.isConnected = function() {
	return this.socket.connected;
};

Client.prototype.isConnecting = function() {
	return this.socket.connecting;
};

Client.prototype.isSupported = function() {
	return typeof WebSocket === "function";
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
