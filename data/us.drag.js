us.drag = {};

us.drag.init = function() {
	this.attachEvents('getInputs');
	this.attachEvents('postInputs');
};

us.drag.attachEvents = function(id) {
	var dom = document.getElementById(id);
	dom.addEventListener('dragstart', this.onDragStart.bind(this), false);
	dom.addEventListener('dragover', this.onDrag.bind(this), false);
	dom.addEventListener('dragenter', this.onDrag.bind(this), false);
	dom.addEventListener('drop', this.onDragDrop.bind(this), false);
	dom.addEventListener('dragend', this.onDragEnd.bind(this), false);
};

us.drag.onDragStart = function(e) {
	var dt = e.dataTransfer;
	dt.effectAllowed = 'move';
	dt.setData('url-shooter-param', ' ');
	
	us.drag.dragging = {
		item: e.target.parentElement
	};
	
	dt.setDragImage(us.drag.dragging.item, 3, 7);
};

us.drag.getPlaceHolder = function() {
	if (!us.drag.placeholder) {
		us.drag.placeholder = document.createElement('div');
		us.drag.placeholder.className = 'drag-placeholder';
	}
	return us.drag.placeholder;
};

us.drag.onDrag = function(e) {
	e.preventDefault();
	e.dataTransfer.dropEffect = 'move';

	if (e.target.getAttribute('data-dragitem') || e.target.parentElement.getAttribute('data-dragitem')) {
		var target = e.target.getAttribute('data-dragitem') ? e.target : e.target.parentElement;
		var parent = target.parentElement;
		var placeholder = us.drag.getPlaceHolder();
		
		if (!(placeholder.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_PRECEDING)) {
			target = target.nextSibling;
		}
		parent.insertBefore(placeholder, target);
		
		if (!us.drag.dragging.removed) {
			// Cannot remove element due to https://bugzilla.mozilla.org/show_bug.cgi?id=460801
			us.drag.dragging.item.style.display = 'none';
			us.drag.dragging.removed = true;
		}
	} else if (e.target !== us.drag.placeholder) {
		// The target is the list itself, check if we need to move the placeholder to the other list
		var placeholder = us.drag.getPlaceHolder();
		if (placeholder.parentElement !== e.target) {
			e.target.appendChild(placeholder);
		}
	}
};

us.drag.onDragDrop = function(e) {
	e.stopPropagation();
	
	var list = us.drag.placeholder.parentElement;
	list.insertBefore(us.drag.dragging.item, us.drag.placeholder);
	list.removeChild(us.drag.placeholder);
	
	up.checkLastLine('getInputs', true);
	up.checkLastLine('postInputs', true);
};

us.drag.onDragEnd = function(e) {
	us.drag.dragging.item.style.display = '';
	delete us.drag.dragging;
	
	if (us.drag.placeholder) {
		var parent = us.drag.placeholder.parentElement;
		if (parent) parent.removeChild(us.drag.placeholder);
	}
};
