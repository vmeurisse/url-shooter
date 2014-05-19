function supplant(s, o) {
	return s.replace(/{([^{}]*)}/g, function (a, b) {
		var r = o[b];
		return r != null ? r : a;
	});
};

var up = {};
up.init = function() {
	addon.port.on("url", up.onUrl.bind(up));
	addon.port.emit("ping");
};

up.tpl = '<div>' +
	'<input value="{key}"/>' +
	'<input value="{value}"/>' +
'</div>';

up.onUrl = function(url) {
	url = url || {};
	document.getElementById('urlInput').value = (url.base || '') + (url.hash ? '#' + url.hash : '');
	document.getElementById('referrerInput').value = (url.referrer || '');
	
	this.displayParams('getInputs', url.query);
	this.displayParams('postInputs', url.postData);
};

up.lastInputLine = {};
up.getLastInputLine = function(type) {
	if (this.lastInputLine[type]) return this.lastInputLine[type];
	
	var inputs = document.getElementById(type).getElementsByTagName('input');
	this.lastInputLine[type] = [inputs[inputs.length - 2], inputs[inputs.length - 1]];
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

up.onInput = function(type) {
	var inputs = up.getLastInputLine(type);
	if (inputs[0].value || inputs[1].value) {
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

up.open = function(newTab) {
	var url = document.getElementById('urlInput').value;
	var referrer = document.getElementById('referrerInput').value;
	addon.port.emit('load', {
		base: url,
		query: this.readParams('getInputs'),
		postData: this.readParams('postInputs'),
		newTab: newTab,
		referrer: referrer
	});
};
up.init();
