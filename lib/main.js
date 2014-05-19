var buttons = require('sdk/ui/button/action');
var tabs = require("sdk/tabs");
var windows = require("sdk/windows").browserWindows;

var sidebars = new Map();

function attachTab(tabs, tab, port) {
	tab.on('ready', function() {
		if (tab === tabs.activeTab) {
			port.emit('url', getUrl(), tab.id);
		}
	});
	tab.on('load', function() {
		if (tab === tabs.activeTab) {
			port.emit('url', getUrl(), tab.id);
		}
	});
	tab.on('pageshow', function(tab, fromBfCache) {
		if (fromBfCache && tab === tabs.activeTab) {
			port.emit('url', getUrl(), tab.id);
		}
	});
};

var sidebar = require("sdk/ui/sidebar").Sidebar({
	id: 'url-params-sidebar',
	title: 'URL Params',
	url: require("sdk/self").data.url("sidebar.html"),
	onAttach: function (worker) {
		var port = worker.port;
		var window = windows.activeWindow;
		var tabs = window.tabs;
		
		sidebars.set(window, {});
		
		port.on("ping", function() {
			port.emit('url', getUrl(), tabs.activeTab.id);
		});
		
		port.on("load", function(url) {
			loadUrl(url);
		});
		
		for (let tab of tabs) {
			attachTab(tabs, tab, port);
		}
		tabs.on('activate', function(tab) {
			port.emit('url', getUrl(), tab.id);
		});
		tabs.on('open', function(tab) {
			port.emit('url', getUrl(), tab.id);
			attachTab(tabs, tab, port);
		});
		tabs.on('close', function(tab) {
			port.emit('close', tab.id);
		});
	},
	onDetach: function() {
		sidebars.delete(windows.activeWindow);
	}
});

var button = buttons.ActionButton({
	id: "url-params-sidebar",
	label: "URL Params",
	icon: {
		"16": "./icon-16.png",
		"32": "./icon-32.png",
		"64": "./icon-64.png"
	},
	onClick: function() {
		if (!sidebars.has(windows.activeWindow)) {
			sidebar.show();
		} else {
			sidebar.hide();
		}
	}
});

function getUrl() {
	var { Cc, Ci } = require('chrome');
	
	var windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
	var browserWindow = windowMediator.getMostRecentWindow("navigator:browser");
	var tabBrowser = browserWindow.getBrowser();
	var sessionHistory = tabBrowser.selectedBrowser.webNavigation.sessionHistory;
	
	if (sessionHistory.index === -1) {
		return null;
	}
	
	var entry = sessionHistory.getEntryAtIndex(sessionHistory.index, 0);
	entry = entry.QueryInterface(Ci.nsISHEntry);
	var base = entry.URI.spec;
	var query, hash;
	var hashStart = base.indexOf('#');
	if (~hashStart) {
		hash = base.slice(hashStart + 1);
		base = base.slice(0, hashStart);
	}
	var queryStart = base.indexOf('?');
	if (~queryStart) {
		query = base.slice(queryStart + 1);
		base = base.slice(0, queryStart);
	}
	
	var postData;
	if (entry.postData) {
		entry.postData.QueryInterface(Ci.nsISeekableStream).seek(0, 0);
		
		//create an input stream for reading the post data from
		var inputStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
		inputStream.init(entry.postData);
		
		postData = inputStream.read(0xFFFFFFFF);
		var postDataStart = postData.indexOf('\r\n\r\n');
		if (~postDataStart) {
			postData = postData.slice(postDataStart + 4);
		} else {
			postData = null;
		}
		
	}
	
	return {
		base: base,
		query: query,
		hash: hash,
		referrer: entry.referrerURI ? entry.referrerURI.QueryInterface(Ci.nsIURI).spec : null,
		postData: postData
	};
};

/**
 * @param {Object} options
 * @param {string} options.base
 * @param {string} [options.hash]
 * @param {string} [options.query]
 * @param {string} [options.postData]
 * @param {boolean} [options.newTab]
 * @param {string} [options.referrer]
 */
function loadUrl(options) {
	console.log('loading URL:');
	var { Cc, Ci } = require('chrome');
	
	var uri = Cc["@mozilla.org/network/standard-url;1"].createInstance(Ci.nsIStandardURL);
	uri = uri.QueryInterface(Ci.nsIURL);
	uri.spec  = options.base + (options.hash ? '#' + options.hash : '');
	uri.query = options.query || '';
	
	var postDataStream = null;
	if (options.postData) {
		console.log('  - with post data');
		var postDataHeaders = "Content-Type: application/x-www-form-urlencoded\r\nContent-Length: " + options.postData.length + "\r\n\r\n";
		postDataStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
		postDataStream.setData(postDataHeaders + options.postData, -1);
	}
	
	var referringUri = null;
	if (options.referrer) {
		console.log('  - with a referrer');
		referringUri = Cc["@mozilla.org/network/simple-uri;1"].createInstance(Ci.nsIURI);
		try {
			referringUri.spec = options.referrer;
		} catch (e) {
			console.error('invalid referrer <' + options.referrer + '>');
		}
	}
	
	var windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
	var browserWindow = windowMediator.getMostRecentWindow("navigator:browser");
	var tabBrowser = browserWindow.getBrowser();
	
	if (options.newTab) {
		console.log('  - in a new tab');
		tabBrowser.selectedTab = tabBrowser.addTab();
	}
        
	var webNavigation = tabBrowser.selectedBrowser.webNavigation;
	webNavigation.loadURI(uri.spec, webNavigation.LOAD_FLAGS_BYPASS_CACHE | webNavigation.LOAD_FLAGS_IS_LINK, referringUri, postDataStream, null);
	console.log('loading URL [done]');
};
