var up = {};
var us = {};
up.i18n = {};
up.tabs = {};
up.tabId = null; //Id of the current tab

up.init = function() {
	if (window.addon) {
		addon.port.on('url', up.onUrl.bind(up));
		addon.port.on('close', up.onClose.bind(up));
		addon.port.on('i18n', up.setI18n.bind(up));
	}
	document.addEventListener('DOMContentLoaded', function(){
		if (!window.addon) up.onUrl();
		us.drag.init();
	});
};

up.getLine = function(key, value) {
	// Can't use a template here due to addons.mozilla.org restrictions on innerHTML usage
	var line = document.createElement('div');
	line.className = 'inputLine';
	line.setAttribute('data-dragitem', 'true');

	var handle = document.createElement('div');
	handle.className = 'handle';
	handle.draggable = true;
	line.appendChild(handle);

	var inputKey = document.createElement('input');
	inputKey.value = key;
	line.appendChild(inputKey);

	var inputValue = document.createElement('input');
	inputValue.value = value;
	line.appendChild(inputValue);

	var del = document.createElement('div');
	del.className = 'delete';
	del.onclick=up.deleteLine;
	del.title = up.i18n['action.delete.title'];
	line.appendChild(del);

	return line;
};

up.setI18n = function(i18n) {
	up.i18n = i18n;
};

up.compareUrls = function(u1, u2) {
	for (var key in u1) {
		if (u1[key] !== u2[key]) return false;
	}
	return true;
};

up.normaliseUrl = function(url) {
	url = url || {};
	url.base = (url.base || '') + (url.hash ? '#' + url.hash : '');
	delete url.hash;
	
	url.query = url.query || '';
	url.postData = url.postData || '';
	url.referrer = url.referrer || '';
	
	return url;
};

up.onClose = function(tabId) {
	if (up.tabId === tabId) {
		// closes tab is the active one. Clean reference
		delete up.tabId;
	}
	delete up.tabs[tabId];
};

up.onUrl = function(url, tabId) {
	url = up.normaliseUrl(url);
	
	if (tabId === up.tabId) {
		if (up.compareUrls(up.tabs[tabId].url, url)) {
			// Url unchanged. no action
			return;
		}
		// Current tab Url changed
		up.tabs[tabId].url = url;
	} else {
		if (up.tabId) {
			// Tab changed. Saving state
			up.tabs[up.tabId].state = up.readUrl();
		}
		up.tabId = tabId;
		var tabData = up.tabs[tabId] || {};
		up.tabs[tabId] = tabData;
		if (tabData.url && up.compareUrls(tabData.url, url)) {
			// Previous tab with url unchanged. Displaying previous state
			url = tabData.state;
		} else {
			//New tab or changed url
			tabData.url = url;
		}
		
	}
	
	up.prefill(url);
};

up.prefill = function(url) {
	document.getElementById('urlInput').value = url.base;
	document.getElementById('referrerInput').value = url.referrer;
	
	this.displayParams('getInputs', url.query);
	this.displayParams('postInputs', url.postData);
};

up.lastInputLine = {};
up.getLastInputLine = function(type) {
	if (this.lastInputLine[type] !== undefined) return this.lastInputLine[type];
	
	var inputs = document.getElementById(type).getElementsByTagName('input');
	if (inputs.length >= 2) {
		this.lastInputLine[type] = [inputs[inputs.length - 2], inputs[inputs.length - 1]];
	} else {
		this.lastInputLine[type] = null;
	}
	return this.lastInputLine[type];
};

up.previousInputLine = {};
up.getPreviousInputLine = function(type) {
	if (this.previousInputLine[type] !== undefined) return this.previousInputLine[type];
	
	var inputs = document.getElementById(type).getElementsByTagName('input');
	if (inputs.length >= 4) {
		this.previousInputLine[type] = [inputs[inputs.length - 4], inputs[inputs.length - 3]];
	} else {
		this.previousInputLine[type] = null;
	}
	return this.previousInputLine[type];
};

/**
 * Add/remove last line if needed
 */
up.checkLastLine = function(type, noCache) {
	if (noCache) {
		delete this.previousInputLine[type];
		delete this.lastInputLine[type];
	}
	var inputs = up.getLastInputLine(type);
	if (!inputs || inputs[0].value || inputs[1].value) {
		up.insertLastLine(type);
	} else {
		while (1) {
			inputs = up.getPreviousInputLine(type);
			if (!inputs || inputs[0].value || inputs[1].value) break;
			up.deleteLastLine(type);
		}
	}
};

up.insertLastLine = function(type, dom) {
	if (!dom) dom = document.getElementById(type);
	
	dom.appendChild(this.getLine('', ''));
	delete this.previousInputLine[type];
	delete this.lastInputLine[type];
};

up.deleteLastLine = function(type, dom) {
	if (!dom) dom = document.getElementById(type);
	
	var inputs = this.getLastInputLine(type);
	var focused = document.activeElement;
	if (focused === inputs[0]) focused = 0;
	else if (focused === inputs[1]) focused = 1;
	else focused = null;
	
	dom.removeChild(dom.lastElementChild);
	this.lastInputLine[type] = this.previousInputLine[type];
	delete this.previousInputLine[type];
	
	if (focused === 0 || focused === 1) {
		inputs = this.getLastInputLine(type);
		inputs[focused].focus();
	}
};

up.displayParams = function(id, string) {
	var frag = document.createDocumentFragment();
	if (string) {
		string = string.split('&');
		for (var param of string) {
			var equalPos = param.indexOf('=');
			if (~equalPos) param = [param.slice(0, equalPos), param.slice(equalPos + 1)];
			else param = [param, ''];
			param = param.map(decodeURIComponent);
			
			frag.appendChild(up.getLine(param[0], param[1]));
		}
	}
	var dom = document.getElementById(id);
	dom.textContent = '';
	dom.appendChild(frag);
	up.insertLastLine(id, dom);
};

up.readParams = function(id) {
	var query = [];
	var inputs = document.getElementById(id).getElementsByTagName('input');
	for (var i = 0; i < inputs.length - 1; i += 2) {
		var key = encodeURIComponent(inputs[i].value);
		var value = encodeURIComponent(inputs[i + 1].value);
		if (key || value) {
			query.push(key + '=' + value);
		}
	}
	return query.join('&');
};

up.readUrl = function() {
	var url = document.getElementById('urlInput').value;
	var referrer = document.getElementById('referrerInput').value;
	return {
		base: url,
		query: this.readParams('getInputs'),
		postData: this.readParams('postInputs'),
		referrer: referrer
	};
};

up.keypress = function(e) {
	if (e.ctrlKey && e.keyCode === 13) {
		up.submit(e);
	}
}
up.submit = function(e) {
	e.preventDefault();
	var url = up.readUrl();
	url.newTab = !!(e.ctrlKey || e.metaKey);
	addon.port.emit('load', url);
};

up.refresh = function() {
	up.prefill(up.tabs[up.tabId].url);
};

up.switchInputs = function(postToGet, getToPost) {
	var getList = document.getElementById('getInputs');
	var postList = document.getElementById('postInputs');
	var postInputs;
	var getInputs;
	if (postToGet) {
		postInputs = document.createDocumentFragment();
		[].slice.apply(postList.children).forEach(function(child) {
			postInputs.appendChild(child);
		});
	}
	if (getToPost) {
		getInputs = document.createDocumentFragment();
		[].slice.apply(getList.children).forEach(function(child) {
			getInputs.appendChild(child);
		});
	}
	if (postToGet) {
		getList.insertBefore(postInputs, getList.lastElementChild);
	}
	if (getToPost) {
		postList.insertBefore(getInputs, postList.lastElementChild);
	}
	
	up.checkLastLine('getInputs', true);
	up.checkLastLine('postInputs', true);
};

up.deleteLine = function(e) {
	// Avoid accidental clicks. The button should be visible for a minimum time
	if (window.getComputedStyle(e.target).opacity > 0.5) {
		var line = e.target.parentElement;
		var list = line.parentElement;
		
		line.parentElement.removeChild(line);
		up.checkLastLine(list.id, true);
	}
};

up.init();
