function supplant(s, o) {
	return s.replace(/{([^{}]*)}/g, function (a, b) {
		var r = o[b];
		return r != null ? r : a;
	});
};

var up = {};
up.tabs = {};
up.tabId = null; //Id of the current tab

up.init = function() {
	if (window.addon) {
		addon.port.on('url', up.onUrl.bind(up));
		addon.port.on('close', up.onClose.bind(up));
		addon.port.on('i18n', up.setI18n.bind(up));
		addon.port.emit("ping");
	}
	document.addEventListener('DOMContentLoaded', function(){
		if (!window.addon) up.onUrl();
		up.drag.init();
	});
};

up.tpl = '<div data-dragitem="true" class="inputLine">' +
	'<div draggable="true" class="handle"></div>' +
	'<input value="{key}"/>' +
	'<input value="{value}"/>' +
	'<div class="delete" onclick="up.deleteLine(event)" title="{action.delete.tooltip}"></div>' +
'</div>';

up.setI18n = function(i18n) {
	console.log('received translations');
	up.tpl = supplant(up.tpl, i18n);
	document.getElementsByTagName('button')[0].title = i18n['action.submit.tooltip'];
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
	console.log('Tab closed. Was active: ' + (up.tabId === tabId));
	if (up.tabId === tabId) delete up.tabId;
	delete up.tabs[tabId];
};

up.onUrl = function(url, tabId) {
	url = up.normaliseUrl(url);
	
	console.log('receiving url for tab <' + tabId + '>: ' + url.base);
	if (tabId === up.tabId) {
		if (up.compareUrls(up.tabs[tabId].url, url)) {
			console.log('Url unchanged. no action');
			return;
		}
		up.tabs[tabId].url = url;
		console.log('Current tab Url changed. Refreshing UI.');
	} else {
		if (up.tabId) {
			console.log('Tab changed. Saving state.');
			up.tabs[up.tabId].state = up.readUrl();
		}
		up.tabId = tabId;
		var tabData = up.tabs[tabId] || {};
		up.tabs[tabId] = tabData;
		if (tabData.url && up.compareUrls(tabData.url, url)) {
			console.log('Previous tab with url unchanged. Displaying previous state');
			url = tabData.state;
		} else {
			console.log('New tab or changed url');
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
	
	dom.insertAdjacentHTML('beforeend', supplant(this.tpl, {key: '', value: ''}));
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
	var dom = document.getElementById(id);
	dom.innerHTML = '';
	if (string) {
		string = string.split('&');
		for (var param of string) {
			var equalPos = param.indexOf('=');
			if (~equalPos) param = [param.slice(0, equalPos), param.slice(equalPos + 1)];
			else param = [param, ''];
			param = param.map(decodeURIComponent);
			
			dom.insertAdjacentHTML('beforeend', supplant(this.tpl, {key: param[0], value: param[1]}));
		}
	}
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

up.drag = {};
up.drag.init = function() {
	this.attachEvents('getInputs');
	this.attachEvents('postInputs');
};
up.drag.attachEvents = function(id) {
	var dom = document.getElementById(id);
	dom.addEventListener('dragstart', this.onDragStart.bind(this), false);
	dom.addEventListener('dragover', this.onDrag.bind(this), false);
	dom.addEventListener('dragenter', this.onDrag.bind(this), false);
	dom.addEventListener('drop', this.onDragDrop.bind(this), false);
	dom.addEventListener('dragend', this.onDragEnd.bind(this), false);
};

up.drag.onDragStart = function(e) {
	var dt = e.dataTransfer;
	dt.effectAllowed = 'move';
	dt.setData('url-shooter-param', ' ');
	
	up.drag.dragging = {
		item: e.target.parentElement
	};
	
	dt.setDragImage(up.drag.dragging.item, 3, 7);
};

up.drag.getPlaceHolder = function() {
	if (!up.drag.placeholder) {
		up.drag.placeholder = document.createElement('div');
		up.drag.placeholder.className = 'drag-placeholder';
	}
	return up.drag.placeholder;
};

up.drag.onDrag = function(e) {
	e.preventDefault();
	e.dataTransfer.dropEffect = 'move';

	if (e.target.getAttribute('data-dragitem') || e.target.parentElement.getAttribute('data-dragitem')) {
		var target = e.target.getAttribute('data-dragitem') ? e.target : e.target.parentElement;
		var parent = target.parentElement;
		var placeholder = up.drag.getPlaceHolder();
		
		if (!(placeholder.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_PRECEDING)) {
			target = target.nextSibling;
		}
		parent.insertBefore(placeholder, target);
		
		if (!up.drag.dragging.removed) {
			// Cannot remove element due to https://bugzilla.mozilla.org/show_bug.cgi?id=460801
			up.drag.dragging.item.style.display = 'none';
			up.drag.dragging.removed = true;
		}
	} else if (e.target !== up.drag.placeholder) {
		// The target is the list itself, check if we need to move the placeholder to the other list
		var placeholder = up.drag.getPlaceHolder();
		if (placeholder.parentElement !== e.target) {
			e.target.appendChild(placeholder);
		}
	}
};

up.drag.onDragDrop = function(e) {
	e.stopPropagation();
	
	var list = up.drag.placeholder.parentElement;
	list.insertBefore(up.drag.dragging.item, up.drag.placeholder);
	list.removeChild(up.drag.placeholder);
	
	up.checkLastLine('getInputs', true);
	up.checkLastLine('postInputs', true);
};

up.drag.onDragEnd = function(e) {
	up.drag.dragging.item.style.display = '';
	delete up.drag.dragging;
	
	if (up.drag.placeholder) {
		var parent = up.drag.placeholder.parentElement;
		if (parent) parent.removeChild(up.drag.placeholder);
	}
};

up.init();
