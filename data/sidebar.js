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
	dom.insertAdjacentHTML('beforeend', supplant(this.tpl, {key: '', value: ''}));
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
