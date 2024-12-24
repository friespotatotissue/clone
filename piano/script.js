// ... existing code ...
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
// ... existing code ...
