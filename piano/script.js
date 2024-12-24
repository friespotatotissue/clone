// ... existing code ...
$(function() {
	// Initialize the piano
	var piano = $("#piano");
	if (!piano.length) {
		console.error("Piano element not found!");
		return;
	}

	// Force a redraw of the piano
	piano.hide().show(0);
	
	// Initialize the client
	if (!window.gClient) {
		window.gClient = new Client();
		window.gClient.start();
	}

	// Set up room info
	$("#room > .info").text("--");
	gClient.on("ch", function(msg) {
		var channel = msg.ch;
		var info = $("#room > .info");
		info.text(channel._id);
		if(channel.settings.lobby) info.addClass("lobby");
		else info.removeClass("lobby");
		if(!channel.settings.chat) info.addClass("no-chat");
		else info.removeClass("no-chat");
		if(channel.settings.crownsolo) info.addClass("crownsolo");
		else info.removeClass("crownsolo");
		if(!channel.settings.visible) info.addClass("not-visible");
		else info.removeClass("not-visible");
	});
});
// ... existing code ...
