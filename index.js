var AFTER,
	BEFORE,
	COMMON_EVENTS,
	EventEmitter,
	FETCH,
	FIRE,
	FormData,
	NativeFetch,
	NativeFormData,
	NativeXMLHttp,
	OFF,
	ON,
	READY_STATE,
	UPLOAD_EVENTS,
	WINDOW,
	XHookFetchRequest,
	XHookFormData,
	XHookHttpRequest,
	XMLHTTP,
	base,
	convertHeaders,
	depricatedProp,
	document,
	fakeEvent,
	mergeObjects,
	msie,
	nullify,
	proxyEvents,
	slice,
	useragent,
	xhook,
	indexOf = [].indexOf;

WINDOW = null;

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
	WINDOW = self;
} else if (typeof global !== 'undefined') {
	WINDOW = global;
} else {
	WINDOW = window;
}

// for compression
document = WINDOW.document;

BEFORE = 'before';

AFTER = 'after';

READY_STATE = 'readyState';

ON = 'addEventListener';

OFF = 'removeEventListener';

FIRE = 'dispatchEvent';

XMLHTTP = 'XMLHttpRequest';

FETCH = 'fetch';

FormData = 'FormData';

UPLOAD_EVENTS = [ 'load', 'loadend', 'loadstart' ];

COMMON_EVENTS = [ 'progress', 'abort', 'error', 'timeout' ];

//parse IE version
useragent = typeof navigator !== 'undefined' && navigator['useragent'] ? navigator.userAgent : '';

msie = parseInt((/msie (\d+)/.exec(useragent.toLowerCase()) || [])[1]);

if (isNaN(msie)) {
	msie = parseInt((/trident\/.*; rv:(\d+)/.exec(useragent.toLowerCase()) || [])[1]);
}

// if required, add 'indexOf' method to Array
(base = Array.prototype).indexOf ||
	(base.indexOf = function(item) {
		var i, j, len, ref, x;
		ref = this;
		for (i = j = 0, len = ref.length; j < len; i = ++j) {
			x = ref[i];
			if (x === item) {
				return i;
			}
		}
		return -1;
	});

slice = function(o, n) {
	return Array.prototype.slice.call(o, n);
};

depricatedProp = function(p) {
	return p === 'returnValue' || p === 'totalSize' || p === 'position';
};

mergeObjects = function(src, dst) {
	var k, v;
	for (k in src) {
		v = src[k];
		if (depricatedProp(k)) {
			continue;
		}
		try {
			dst[k] = src[k];
		} catch (error) {}
	}
	return dst;
};

nullify = function(res) {
	if (res === void 0) {
		return null;
	}
	return res;
};

// proxy events from one emitter to another
proxyEvents = function(events, src, dst) {
	var event, j, len, p;
	p = function(event) {
		return function(e) {
			var clone, k, val;
			clone = {};
			//copies event, with dst emitter inplace of src
			for (k in e) {
				if (depricatedProp(k)) {
					continue;
				}
				val = e[k];
				clone[k] = val === src ? dst : val;
			}
			//emits out the dst
			return dst[FIRE](event, clone);
		};
	};
	//dont proxy manual events
	for (j = 0, len = events.length; j < len; j++) {
		event = events[j];
		if (dst._has(event)) {
			src[`on${event}`] = p(event);
		}
	}
};

//create fake event
fakeEvent = function(type) {
	var msieEventObject;
	if (document && document.createEventObject != null) {
		msieEventObject = document.createEventObject();
		msieEventObject.type = type;
		return msieEventObject;
	} else {
		try {
			// on some platforms like android 4.1.2 and safari on windows, it appears
			// that new Event is not allowed
			return new Event(type);
		} catch (error) {
			return { type };
		}
	}
};

//tiny event emitter
EventEmitter = function(nodeStyle) {
	var emitter, events, listeners;
	//private
	events = {};
	listeners = function(event) {
		return events[event] || [];
	};
	//public
	emitter = {};
	emitter[ON] = function(event, callback, i) {
		events[event] = listeners(event);
		if (events[event].indexOf(callback) >= 0) {
			return;
		}
		i = i === undefined ? events[event].length : i;
		events[event].splice(i, 0, callback);
	};
	emitter[OFF] = function(event, callback) {
		var i;
		//remove all
		if (event === undefined) {
			events = {};
			return;
		}
		//remove all of type event
		if (callback === undefined) {
			events[event] = [];
		}
		//remove particular handler
		i = listeners(event).indexOf(callback);
		if (i === -1) {
			return;
		}
		listeners(event).splice(i, 1);
	};
	emitter[FIRE] = function() {
		var args, event, i, j, legacylistener, len, listener, ref;
		args = slice(arguments);
		event = args.shift();
		if (!nodeStyle) {
			args[0] = mergeObjects(args[0], fakeEvent(event));
		}
		legacylistener = emitter[`on${event}`];
		if (legacylistener) {
			legacylistener.apply(emitter, args);
		}
		ref = listeners(event).concat(listeners('*'));
		for (i = j = 0, len = ref.length; j < len; i = ++j) {
			listener = ref[i];
			listener.apply(emitter, args);
		}
	};
	emitter._has = function(event) {
		return !!(events[event] || emitter[`on${event}`]);
	};
	//add extra aliases
	if (nodeStyle) {
		emitter.listeners = function(event) {
			return slice(listeners(event));
		};
		emitter.on = emitter[ON];
		emitter.off = emitter[OFF];
		emitter.fire = emitter[FIRE];
		emitter.once = function(e, fn) {
			var fire;
			fire = function() {
				emitter.off(e, fire);
				return fn.apply(null, arguments);
			};
			return emitter.on(e, fire);
		};
		emitter.destroy = function() {
			return (events = {});
		};
	}
	return emitter;
};

//use event emitter to store hooks
xhook = EventEmitter(true);

xhook.EventEmitter = EventEmitter;

xhook[BEFORE] = function(handler, i) {
	if (handler.length < 1 || handler.length > 2) {
		throw 'invalid hook';
	}
	return xhook[ON](BEFORE, handler, i);
};

xhook[AFTER] = function(handler, i) {
	if (handler.length < 2 || handler.length > 3) {
		throw 'invalid hook';
	}
	return xhook[ON](AFTER, handler, i);
};

xhook.enable = function() {
	WINDOW[XMLHTTP] = XHookHttpRequest;
	if (typeof XHookFetchRequest === 'function') {
		WINDOW[FETCH] = XHookFetchRequest;
	}
	if (NativeFormData) {
		WINDOW[FormData] = XHookFormData;
	}
};

xhook.disable = function() {
	WINDOW[XMLHTTP] = xhook[XMLHTTP];
	WINDOW[FETCH] = xhook[FETCH];
	if (NativeFormData) {
		WINDOW[FormData] = NativeFormData;
	}
};

//helper
convertHeaders = xhook.headers = function(h, dest = {}) {
	var header, headers, j, k, len, name, ref, v, value;
	switch (typeof h) {
		case 'object':
			headers = [];
			for (k in h) {
				v = h[k];
				name = k.toLowerCase();
				headers.push(`${name}:\t${v}`);
			}
			return headers.join('\n') + '\n';
		case 'string':
			headers = h.split('\n');
			for (j = 0, len = headers.length; j < len; j++) {
				header = headers[j];
				if (/([^:]+):\s*(.+)/.test(header)) {
					name = (ref = RegExp.$1) != null ? ref.toLowerCase() : void 0;
					value = RegExp.$2;
					if (dest[name] == null) {
						dest[name] = value;
					}
				}
			}
			return dest;
	}
};

//patch FormData
// we can do this safely because all XHR
// is hooked, so we can ensure the real FormData
// object is used on send
NativeFormData = WINDOW[FormData];

XHookFormData = function(form) {
	var entries;
	this.fd = form ? new NativeFormData(form) : new NativeFormData();
	this.form = form;
	entries = [];
	Object.defineProperty(this, 'entries', {
		get: function() {
			var fentries;
			//extract form entries
			fentries = !form
				? []
				: slice(form.querySelectorAll('input,select'))
						.filter(function(e) {
							var ref;
							return ((ref = e.type) !== 'checkbox' && ref !== 'radio') || e.checked;
						})
						.map(function(e) {
							return [ e.name, e.type === 'file' ? e.files : e.value ];
						});
			//combine with js entries
			return fentries.concat(entries);
		}
	});
	this.append = () => {
		var args;
		args = slice(arguments);
		entries.push(args);
		return this.fd.append.apply(this.fd, args);
	};
};

if (NativeFormData) {
	//expose native formdata as xhook.FormData incase its needed
	xhook[FormData] = NativeFormData;
	WINDOW[FormData] = XHookFormData;
}

//patch XHR
NativeXMLHttp = WINDOW[XMLHTTP];

xhook[XMLHTTP] = NativeXMLHttp;

XHookHttpRequest = WINDOW[XMLHTTP] = function() {
	var ABORTED,
		currentState,
		emitFinal,
		emitReadyState,
		event,
		facade,
		hasError,
		hasErrorHandler,
		j,
		len,
		readBody,
		readHead,
		ref,
		request,
		response,
		setReadyState,
		status,
		transiting,
		writeBody,
		writeHead,
		xhr;
	ABORTED = -1;
	xhr = new xhook[XMLHTTP]();
	//==========================
	// Extra state
	request = {};
	status = null;
	hasError = void 0;
	transiting = void 0;
	response = void 0;
	//==========================
	// Private API

	//read results from real xhr into response
	readHead = function() {
		var key, name, ref, val;
		// Accessing attributes on an aborted xhr object will
		// throw an 'c00c023f error' in IE9 and lower, don't touch it.
		response.status = status || xhr.status;
		if (!(status === ABORTED && msie < 10)) {
			response.statusText = xhr.statusText;
		}
		if (status !== ABORTED) {
			ref = convertHeaders(xhr.getAllResponseHeaders());
			for (key in ref) {
				val = ref[key];
				if (!response.headers[key]) {
					name = key.toLowerCase();
					response.headers[name] = val;
				}
			}
		}
	};
	readBody = function() {
		if (!xhr.responseType || xhr.responseType === 'text') {
			response.text = xhr.responseText;
			response.data = xhr.responseText;
			try {
				response.xml = xhr.responseXML;
			} catch (error) {}
			// unable to set responseXML due to response type, we attempt to assign responseXML
			// when the type is text even though it's against the spec due to several libraries
			// and browser vendors who allow this behavior. causing these requests to fail when
			// xhook is installed on a page.
		} else if (xhr.responseType === 'document') {
			response.xml = xhr.responseXML;
			response.data = xhr.responseXML;
		} else {
			response.data = xhr.response;
		}
		//new in some browsers
		if ('responseURL' in xhr) {
			response.finalUrl = xhr.responseURL;
		}
	};
	//write response into facade xhr
	writeHead = function() {
		facade.status = response.status;
		facade.statusText = response.statusText;
	};
	writeBody = function() {
		if ('text' in response) {
			facade.responseText = response.text;
		}
		if ('xml' in response) {
			facade.responseXML = response.xml;
		}
		if ('data' in response) {
			facade.response = response.data;
		}
		if ('finalUrl' in response) {
			facade.responseURL = response.finalUrl;
		}
	};
	//ensure ready state 0 through 4 is handled
	emitReadyState = function(n) {
		while (n > currentState && currentState < 4) {
			facade[READY_STATE] = ++currentState;
			// make fake events for libraries that actually check the type on
			// the event object
			if (currentState === 1) {
				facade[FIRE]('loadstart', {});
			}
			if (currentState === 2) {
				writeHead();
			}
			if (currentState === 4) {
				writeHead();
				writeBody();
			}
			facade[FIRE]('readystatechange', {});
			//delay final events incase of error
			if (currentState === 4) {
				if (request.async === false) {
					emitFinal();
				} else {
					setTimeout(emitFinal, 0);
				}
			}
		}
	};
	emitFinal = function() {
		if (!hasError) {
			facade[FIRE]('load', {});
		}
		facade[FIRE]('loadend', {});
		if (hasError) {
			facade[READY_STATE] = 0;
		}
	};
	//control facade ready state
	currentState = 0;
	setReadyState = function(n) {
		var hooks, process;
		//emit events until readyState reaches 4
		if (n !== 4) {
			emitReadyState(n);
			return;
		}
		//before emitting 4, run all 'after' hooks in sequence
		hooks = xhook.listeners(AFTER);
		process = function() {
			var hook;
			if (!hooks.length) {
				return emitReadyState(4);
			}
			hook = hooks.shift();
			if (hook.length === 2) {
				hook(request, response);
				return process();
			} else if (hook.length === 3 && request.async) {
				return hook(request, response, process);
			} else {
				return process();
			}
		};
		process();
	};
	//==========================
	// Facade XHR
	facade = request.xhr = EventEmitter();
	//==========================

	// Handle the underlying ready state
	xhr.onreadystatechange = function(event) {
		try {
			//pull status and headers
			if (xhr[READY_STATE] === 2) {
				readHead();
			}
		} catch (error) {}
		//pull response data
		if (xhr[READY_STATE] === 4) {
			transiting = false;
			readHead();
			readBody();
		}
		setReadyState(xhr[READY_STATE]);
	};
	//mark this xhr as errored
	hasErrorHandler = function() {
		hasError = true;
	};
	facade[ON]('error', hasErrorHandler);
	facade[ON]('timeout', hasErrorHandler);
	facade[ON]('abort', hasErrorHandler);
	// progress means we're current downloading...
	facade[ON]('progress', function() {
		//progress events are followed by readystatechange for some reason...
		if (currentState < 3) {
			setReadyState(3);
		} else {
			facade[FIRE]('readystatechange', {}); //TODO fake an XHR event
		}
	});
	// initialise 'withCredentials' on facade xhr in browsers with it
	// or if explicitly told to do so
	if ('withCredentials' in xhr || xhook.addWithCredentials) {
		facade.withCredentials = false;
	}
	facade.status = 0;
	ref = COMMON_EVENTS.concat(UPLOAD_EVENTS);
	// initialise all possible event handlers
	for (j = 0, len = ref.length; j < len; j++) {
		event = ref[j];
		facade[`on${event}`] = null;
	}
	facade.open = function(method, url, async, user, pass) {
		// Initailize empty XHR facade
		currentState = 0;
		hasError = false;
		transiting = false;
		request.headers = {};
		request.headerNames = {};
		request.status = 0;
		response = {};
		response.headers = {};
		request.method = method;
		request.url = url;
		request.async = async !== false;
		request.user = user;
		request.pass = pass;
		// openned facade xhr (not real xhr)
		setReadyState(1);
	};
	facade.send = function(body) {
		var hooks, k, l, len1, modk, process, ref1, send;
		ref1 = [ 'type', 'timeout', 'withCredentials' ];
		//read xhr settings before hooking
		for (l = 0, len1 = ref1.length; l < len1; l++) {
			k = ref1[l];
			modk = k === 'type' ? 'responseType' : k;
			if (modk in facade) {
				request[k] = facade[modk];
			}
		}
		request.body = body;
		send = function() {
			var header, len2, m, ref2, ref3, value;
			//proxy all events from real xhr to facade
			proxyEvents(COMMON_EVENTS, xhr, facade);
			if (facade.upload) {
				proxyEvents(COMMON_EVENTS.concat(UPLOAD_EVENTS), xhr.upload, facade.upload);
			}
			//prepare request all at once
			transiting = true;
			//perform open
			xhr.open(request.method, request.url, request.async, request.user, request.pass);
			ref2 = [ 'type', 'timeout', 'withCredentials' ];
			//write xhr settings
			for (m = 0, len2 = ref2.length; m < len2; m++) {
				k = ref2[m];
				modk = k === 'type' ? 'responseType' : k;
				if (k in request) {
					xhr[modk] = request[k];
				}
			}
			ref3 = request.headers;
			//insert headers
			for (header in ref3) {
				value = ref3[header];
				if (header) {
					xhr.setRequestHeader(header, value);
				}
			}
			//extract real formdata
			if (request.body instanceof XHookFormData) {
				request.body = request.body.fd;
			}
			//real send!
			xhr.send(request.body);
		};
		hooks = xhook.listeners(BEFORE);
		//process hooks sequentially
		process = function() {
			var done, hook;
			if (!hooks.length) {
				return send();
			}
			//go to next hook OR optionally provide response
			done = function(userResponse) {
				//break chain - provide dummy response (readyState 4)
				if (
					typeof userResponse === 'object' &&
					(typeof userResponse.status === 'number' || typeof response.status === 'number')
				) {
					mergeObjects(userResponse, response);
					if (indexOf.call(userResponse, 'data') < 0) {
						userResponse.data = userResponse.response || userResponse.text;
					}
					setReadyState(4);
					return;
				}
				//continue processing until no hooks left
				process();
			};
			//specifically provide headers (readyState 2)
			done.head = function(userResponse) {
				mergeObjects(userResponse, response);
				return setReadyState(2);
			};
			//specifically provide partial text (responseText  readyState 3)
			done.progress = function(userResponse) {
				mergeObjects(userResponse, response);
				return setReadyState(3);
			};
			hook = hooks.shift();
			//async or sync?
			if (hook.length === 1) {
				return done(hook(request));
			} else if (hook.length === 2 && request.async) {
				//async handlers must use an async xhr
				return hook(request, done);
			} else {
				//skip async hook on sync requests
				return done();
			}
		};
		//kick off
		process();
	};
	facade.abort = function() {
		status = ABORTED;
		if (transiting) {
			xhr.abort(); //this will emit an 'abort' for us
		} else {
			facade[FIRE]('abort', {});
		}
	};
	facade.setRequestHeader = function(header, value) {
		var lName, name;
		//the first header set is used for all future case-alternatives of 'name'
		lName = header != null ? header.toLowerCase() : void 0;
		name = request.headerNames[lName] = request.headerNames[lName] || header;
		//append header to any previous values
		if (request.headers[name]) {
			value = request.headers[name] + ', ' + value;
		}
		request.headers[name] = value;
	};
	facade.getResponseHeader = function(header) {
		var name;
		name = header != null ? header.toLowerCase() : void 0;
		return nullify(response.headers[name]);
	};
	facade.getAllResponseHeaders = function() {
		return nullify(convertHeaders(response.headers));
	};
	//proxy call only when supported
	if (xhr.overrideMimeType) {
		facade.overrideMimeType = function() {
			return xhr.overrideMimeType.apply(xhr, arguments);
		};
	}
	//create emitter when supported
	if (xhr.upload) {
		facade.upload = request.upload = EventEmitter();
	}
	facade.UNSENT = 0;
	facade.OPENED = 1;
	facade.HEADERS_RECEIVED = 2;
	facade.LOADING = 3;
	facade.DONE = 4;
	// fill in default values for an empty XHR object according to the spec
	facade.response = '';
	facade.responseText = '';
	facade.responseXML = null;
	facade.readyState = 0;
	facade.statusText = '';
	return facade;
};

//patch Fetch
if (typeof WINDOW[FETCH] === 'function') {
	NativeFetch = WINDOW[FETCH];
	xhook[FETCH] = NativeFetch;
	XHookFetchRequest = WINDOW[FETCH] = function(
		url,
		options = {
			headers: {}
		}
	) {
		var afterHooks, beforeHooks, request;
		options.url = url;
		request = null;
		beforeHooks = xhook.listeners(BEFORE);
		afterHooks = xhook.listeners(AFTER);
		return new Promise(function(resolve, reject) {
			var done, getRequest, processAfter, processBefore, send;
			getRequest = function() {
				if (options.body instanceof XHookFormData) {
					options.body = options.body.fd;
				}
				if (options.headers) {
					options.headers = new Headers(options.headers);
				}
				if (!request) {
					request = new Request(options.url, options);
				}
				return mergeObjects(options, request);
			};
			processAfter = function(response) {
				var hook;
				if (!afterHooks.length) {
					return resolve(response);
				}
				hook = afterHooks.shift();
				if (hook.length === 2) {
					hook(getRequest(), response);
					return processAfter(response);
				} else if (hook.length === 3) {
					return hook(getRequest(), response, processAfter);
				} else {
					return processAfter(response);
				}
			};
			done = function(userResponse) {
				var response;
				if (userResponse !== void 0) {
					response = new Response(userResponse.body || userResponse.text, userResponse);
					resolve(response);
					processAfter(response);
					return;
				}
				//continue processing until no hooks left
				processBefore();
			};
			processBefore = function() {
				var hook;
				if (!beforeHooks.length) {
					send();
					return;
				}
				hook = beforeHooks.shift();
				if (hook.length === 1) {
					return done(hook(options));
				} else if (hook.length === 2) {
					return hook(getRequest(), done);
				}
			};
			send = function() {
				return NativeFetch(getRequest())
					.then(function(response) {
						return processAfter(response);
					})
					.catch(function(err) {
						processAfter(err);
						return reject(err);
					});
			};
			processBefore();
		});
	};
}

XHookHttpRequest.UNSENT = 0;

XHookHttpRequest.OPENED = 1;

XHookHttpRequest.HEADERS_RECEIVED = 2;

XHookHttpRequest.LOADING = 3;

XHookHttpRequest.DONE = 4;

if (typeof define === 'function' && define.amd) {
	define('xhook', [], function() {
		return xhook;
	});
} else if (typeof module === 'object' && module.exports) {
	module.exports = { xhook };
} else if (WINDOW) {
	WINDOW.xhook = xhook;
}
