//     Backbone.js 1.3.3

//     (c) 2010-2017 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(factory) {

  // Establish the root object, `window` (`self`) in the browser, or `global` on the server.
  // We use `self` instead of `window` for `WebWorker` support.
  // 定义全局对象 root 变量，在浏览器环境下为 window，在 服务器 环境下为 global, self 指向window
  var root = (typeof self == 'object' && self.self === self && self) ||
            (typeof global == 'object' && global.global === global && global);

  // Set up Backbone appropriately for the environment. Start with AMD.
  // 支持AMD规范
  // 使用define函数定义Backbone模块, 依赖`underscore`, `jquery`, `exports`三个模块.
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'jquery', 'exports'], function(_, $, exports) {
      // Export global even in AMD case in case this script is loaded with
      // others that may still expect a global Backbone.
      root.Backbone = factory(root, exports, _, $);
    });

  // Next for Node.js or CommonJS. jQuery may not be needed as a module.
  // 支持 commonJs 规范(NodeJS使用的规范, 主要用于服务器端, 所以jQuery非必须).
  // CommonJS规范中, exports是用于导出模块的对象.
  } else if (typeof exports !== 'undefined') {
    var _ = require('underscore'), $;
    try { $ = require('jquery'); } catch (e) {}
    factory(root, exports, _, $);

  // Finally, as a browser global.
  // 以上两种情况都没有，则以最简单的执行函数方式，将函数的返回值作为全局对象Backbone
  } else {
    root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
  }

})(function(root, Backbone, _, $) {

  // Initial Setup
  // 一些初始化操作
  // -------------

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  // 缓存 Backbone 变量，用于防止命名冲突; 与之后的`noConflict`函数结合使用.
  var previousBackbone = root.Backbone;

  // Create a local reference to a common array method we'll want to use later.
  // 缓存数组的 slice 方法
  var slice = Array.prototype.slice;

  // Current version of the library. Keep in sync with `package.json`.
  // 版本号
  Backbone.VERSION = '1.3.3';

  // For Backbone's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
  // the `$` variable.
  // 定义第三方库为统一的变量"Backbone.$", 用于在视图(View), 事件处理和与服务器数据同步(sync)时调用库中的方法
  // 支持的库包括jQuery, Zepto等, 它们语法相同, 但Zepto更适用移动开发, 它主要针对Webkit内核浏览器
  // 也可以通过自定义一个与jQuery语法相似的自定义库, 供Backbone使用(有时我们可能需要一个比jQuery, Zepto更轻巧的自定义版本)
  Backbone.$ = $;

  // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
  // to its previous owner. Returns a reference to this Backbone object.
  // 防止冲突变量的解决方案。如过全局变量已经存在 Backbone ，那么使用此函数更换类库变量名，例子：
  // var test = Backbone.noConflict();
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    return this;
  };

  // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
  // will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
  // set a `X-Http-Method-Override` header.
  // 对于不支持REST方式的浏览器, 可以设置Backbone.emulateHTTP = true
  // 与服务器请求将以POST方式发送, 并在数据中加入_method参数标识操作名称, 同时也将发送X-HTTP-Method-Override头信息
  Backbone.emulateHTTP = false;

  // Turn on `emulateJSON` to support legacy servers that can't deal with direct
  // `application/json` requests ... this will encode the body as
  // `application/x-www-form-urlencoded` instead and will send the model in a
  // form param named `model`.
  // 对于不支持application/json编码的浏览器, 可以设置Backbone.emulateJSON = true;
  // 将请求类型设置为application/x-www-form-urlencoded, 并将数据放置在_model参数中实现兼容
  Backbone.emulateJSON = false;

  // Backbone.Events
  // ---------------
  // Backbone 事件部分

  // A module that can be mixed in to *any object* in order to provide it with
  // a custom event channel. You may bind a callback to an event with `on` or
  // remove with `off`; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  //
  // Backbone的 Events 实际上就是一个观察者模式(发布订阅模式)的实现，并且巧妙的是，还可以作为mixin混入到自己写的object中，
  // mixin例子：
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  // 另外需要注意的是，由于之后需要进行对象整合，所以这里的Events对象可以理解为会被变成被调用的对象上下文。
  //
  // 初始化Events为一个空对象,js中的对象是按引用传递的。
  var Events = Backbone.Events = {};

  // Regular expression used to split event strings.
  // eventSplitter指定处理多个事件时, 事件名称的解析规则，
  // 匹配一次或多次(至少一次)空白字符，包括空格、制表符、换页符和换行符
  var eventSplitter = /\s+/;

  // A private global variable to share between listeners and listenees.
  // 用于在监听者和被监听者之间共享的私有全局变量。
  var _listening;

  // Iterates over the standard `event, callback` (as well as the fancy multiple
  // space-separated events `"change blur", callback` and jQuery-style event
  // maps `{event: callback}`).
  // eventsApi 起到分流的作用。迭代不同的`event，callback`绑定形式：标准形式：`event, callback` ；多个空格分隔的事件形式：`"change blur", callback` 和 jQuery风格的事件地图： `{event: callback}`。
  // 1.普通绑定：
  // model.on("change", on_change_callback);
  // 2.传入一个名称，回调函数的对象
  // model.on({
  //     "change": on_change_callback,
  //     "remove": on_remove_callback
  // });
  // 3.使用空格分割的多个事件名称绑定到同一个回调函数上
  // model.on("change remove", common_callback);
  //
  // 参数：
  // iteratee 实际真正要调用的函数，做绑定iteratee = onApi , onceMap; 做解绑 iteratee = offApi; 做触发 iteratee = triggerApi
  // events 事件，有很多情况中传入的是this._events
  // name 自己起的名字或者之前起的名字，代表了一个事件
  // callback 回调函数，触发事件时触发
  // opts 参数，在 iteratee 函数的内部有自己的作用
  var eventsApi = function(iteratee, events, name, callback, opts) {
    var i = 0, names;
    // 当 name 是 object 的时候，即为 jQuery风格的事件地图： `{event: callback}`。
    if (name && typeof name === 'object') {
      // Handle event maps.
      // 如果有回调事件，并且 opts 有 'context'即回调函数上下文，并且没有被赋值，则将当前的 回调函数 赋值给 opts.context
      if (callback !== void 0 && 'context' in opts && opts.context === void 0) opts.context = callback;

      // 递归循环 所有的 key,也就是所有的事件 event，即最后成为 标准形式的迭代
      for (names = _.keys(name); i < names.length ; i++) {
        events = eventsApi(iteratee, events, names[i], name[names[i]], opts);
      }

    // 当 name 是多个空格分隔的事件形式：`"change blur", callback`
    } else if (name && eventSplitter.test(name)) {
      // Handle space-separated event names by delegating them individually.
      // 通过单独委托来处理空格分隔的事件绑定形式
      for (names = name.split(eventSplitter); i < names.length; i++) {
        events = iteratee(events, names[i], callback, opts);
      }

    // 当name 是标准形式 `event, callback`
    } else {
      // Finally, standard events.
      events = iteratee(events, name, callback, opts);
    }

    // 最后返回 events
    return events;
  };

  // Bind an event to a `callback` function. Passing `"all"` will bind
  // the callback to all events fired.
  // 绑定事件。将一个事件绑定到 `callback` 函数上。事件触发时执行回调函数`callback`。
  // 典型调用方式是`object.on('name', callback, context)`.
  // `name`是监听的事件名, `callback`是事件触发时的回调函数, `context`是回调函数上下文，即回调函数中的This(未指定时就默认为当前`object`).
  // 如果传递参数 `"all"，任何事件的发生都会触发该回调函数。回调函数的第一个参数会传递该事件的名称。举个例子，将一个对象的所有事件代理到另一对象：
  // 例子：
  // proxy.on("all", function(eventName) {
  //   object.trigger(eventName);
  // });
  Events.on = function(name, callback, context) {
    // this._events 保存所有监听事件
    // 调用 onApi 用来绑定事件
    // eventsApi函数参数(iteratee, events, name, callback, opts)
    // 参数中 如果还没有this._events，那么就初始化为空对象。
    // 
    // opts中参数：
    // callback 事件的回调函数
    // context 回调函数的上下文对象（即当调用on时，为context参数，当调用view.listenTo(....)时，为调用的对象如：view。）
    // ctx 为context ，当context不存在时，为被监听的对象，如：model.on(…)或view.on(model,…)中的model
    // listening 其实就是view._listeningTo中的某个属性值，可以看成: listening == view._listeningTo[‘l1’]
    this._events = eventsApi(onApi, this._events || {}, name, callback, {
      context: context,
      ctx: this,
      listening: _listening
    });

    // 处理通过 listenTo 方法调用 on 绑定的情况
    // 在下方定义的 Events.listenTo 中会调用 on 方法来绑定事件，当你调用listenTo方法的时候（如下一行的例子1）这个时候就会产生有 _listening 的情况。
    // 例子1:A.listenTo(B, “b”, callback);
    // _listening：在下方 Events.listenTo 方法中，被赋值为正在监听的对象的id，例子1中的 B 的 id。赋值语句如下：
    // var listening = _listening = listeningTo[id];
    // 结合下方的 listenTo 方法来理解这个变量
    if (_listening) {
      // 定义变量监听者 listener，赋值 this._listeners；如果还没有this._listeners，初始化为空对象。
      var listeners = this._listeners || (this._listeners = {});
      // 将上文定义的私有全局变量_listening 赋值给 listeners[_listening.id]; 即 监听者监听的对象id。
      listeners[_listening.id] = _listening;
      // Allow the listening to use a counter, instead of tracking
      // callbacks for library interop
      // todo
      // 允许 listening 使用计数器，而不是跟踪库互操作性回调
      _listening.interop = false;
    }

    // 返回 this
    return this;
  };

  // Inversion-of-control versions of `on`. Tell *this* object to listen to
  // an event in another object... keeping track of what it's listening to
  // for easier unbinding later.
  // todo------------
  //
  // “on”的控制反转版本。
  // 让 object 监听 另一个（other）对象上的一个特定事件。跟踪它正在监听的内容，以便以后解除绑定。
  // 比如，B对象上面发生b事件的时候，通知A调用回调函数。
  // 例子1:A.listenTo(B, “b”, callback);
  // 当然，实际上这个用on来写也是可行的
  // B.on(“b”, callback, A);
  //
  // 这个函数的作用就是构建_listeningTo的一个过程。
  // _listeningTo:当前对象所监听的对象。对象里面是一个或多个以被监听对象的_listenId为名字的对象。每一个对象结构如下：
  // {
  //     count: 5, // 监听了几个事件
  //     id: 13, // 监听方的id
  //     listeningTo: Object, // 自身相关的一些信息
  //     obj: child, // 被监听的对象
  //     objId: "12" // 被监听对象id
  // }
  //
  // 参数：`obj`是当前`object`想要监听的`obj`对象, `name`是监听的事件名, `callback`是监听事件触发时的回调函数.
  Events.listenTo = function(obj, name, callback) {
    // 如果没有 obj ，则直接返回 this
    if (!obj) return this;

    // 定义被监听对象的索引值 id 为当前 obj._listenId 如果没有 obj._listenId，则通过_.uniqueId('l') 生成唯一 id 赋值
    // _.uniqueId:为需要的客户端模型或DOM元素生成一个全局唯一的id,这个id以l开头.
    var id = obj._listenId || (obj._listenId = _.uniqueId('l'));

    // 定义变量 listeningTo 存放监听的对象的信息，相当于例子1种的b，赋值为 this._listeningTo ，如果还没有this._listeningTo，则定义为空对象。
    // this._listeningTo存放当前对象的所有的监听对象事件,按照键值对存储
    var listeningTo = this._listeningTo || (this._listeningTo = {});

    // 正在监听的对象的id，例子1中的 B 的 id。
    var listening = _listening = listeningTo[id];

    // This object is not listening to any other events on `obj` yet.
    // Setup the necessary references to track the listening callbacks.
    // 如果当前 object 还没有监听 obj 上的任何其他事件，则 设置必要的参数，来跟踪监听回调。
    if (!listening) {
      // 生成 例子中的B 的id: _listenId
      this._listenId || (this._listenId = _.uniqueId('l'));
      // 通过 new 一个 Listening 新实例，生成 listening 和 _listening 还有 listeningTo[id]
      // 
      // 实例 Listening 下方定义：
      // var Listening = function(listener, obj) {
      //   this.id = listener._listenId; //监听方的id
      //   this.listener = listener; // 监听方
      //   this.obj = obj; // 被监听的对象
      //   this.interop = true;
      //   this.count = 0;   //监听了几个事件
      //   this._events = void 0; // 监听事件的回调函数序列
      // };
      listening = _listening = listeningTo[id] = new Listening(this, obj);
    }

    // 生成了一些必要的信息之后，开始真正绑定事件

    // Bind callbacks on obj.
    // 在obj 上绑定回调
    //
    // tryCatchOn：在方定义函数，一个try-catch保护on函数，以防止污染全局`_listening`变量。
    // 在obj 上绑定回调绑定函数，如果不对就报错
    // 
    // var tryCatchOn = function(obj, name, callback, context) {
    //   try {
    //     obj.on(name, callback, context);
    //   } catch (e) {
    //     return e;
    //   }
    // };
    var error = tryCatchOn(obj, name, callback, this);
    // 绑定好事件之后，重新将 _listening 置为 void 0，void 0 相当于 undefined，用 void 0 而不是 undefined 原因是 undefined 可以被重写。
    _listening = void 0;

    // 如果有错误 就报错
    if (error) throw error;

    // 没有错误
    // If the target obj is not Backbone.Events, track events manually.
    // 如果目标 obj 不是 Backbone.Events，则手动追踪。
    //
    // todo
    if (listening.interop) listening.on(name, callback);

    return this;
  };

  // The reducing API that adds a callback to the `events` object.
  // 此函数用于 往this._events即某一个事件的回调函数队列里面push进相应的事件，在 eventsApi 函数中作为 iteratee 参数调用。
  // 参数：
  // events 事件，有很多情况中传入的是this._events,某一个事件绑定的所有回调函数队列
  // name 自己起的名字或者之前起的名字，代表了一个事件
  // callback 回调函数，触发事件时触发
  var onApi = function(events, name, callback, options) {
    // 如果有回调
    if (callback) {

      // 如果针对要绑定的事件，已经建立有回调函数数列，就直接用，没有就初始化为空数组
      var handlers = events[name] || (events[name] = []);
      // 针对这个回调事件 ，生成相应信息
      var context = options.context, ctx = options.ctx, listening = options.listening;

      // 如果正在监听某个对象，listening.count++
      if (listening) listening.count++;

      // 将有关这个回调的信息push进队列
      handlers.push({callback: callback, context: context, ctx: context || ctx, listening: listening});
    }
    return events;
  };

  // An try-catch guarded #on function, to prevent poisoning the global
  // `_listening` variable.
  // 一个try-catch保护#on函数，以防止污染全局`_listening`变量。
  var tryCatchOn = function(obj, name, callback, context) {
    try {
      obj.on(name, callback, context);
    } catch (e) {
      return e;
    }
  };

  // Remove one or many callbacks. If `context` is null, removes all
  // callbacks with that function. If `callback` is null, removes all
  // callbacks for the event. If `name` is null, removes all bound
  // callbacks for all events.
  // 此函数作用于删除一个或多个回调。
  // 根据参数的不同，分为一下几种情况：
  // 1、如果没有任何参数，off相当于把对应的_events对象整体清空，删除所有事件的所有绑定回调；
  // 2、如果有name参数但是没有具体指定哪个callback的时候，则把这个name(事件)对应的回调队列全部清空；
  // 3、如果还有进一步详细的callback和context，那么这个时候移除回调函数非常严格，必须要求上下文和原来函数完全一致；
  Events.off = function(name, callback, context) {
    // 当前`object`不存在`_events`(即没有绑定过事件)直接返回
    if (!this._events) return this;
    // 调用 eventsApi 传入 offApi 作为 iteratee 解绑相应事件
    this._events = eventsApi(offApi, this._events, name, callback, {
      context: context,
      listeners: this._listeners
    });

    return this;
  };

  // Tell this object to stop listening to either specific events ... or
  // to every object it's currently listening to.
  // 解除 当前 object 监听的 其他对象上制定事件，或者说是所有当前监听的事件
  // 如果 传入被监听对象 obj 就是解除特定对象上的事件，没有就是解除所有事件
  // Tip::
  // _listeningTo:当前对象所监听的对象。对象里面是一个或多个以被监听对象的_listenId为名字的对象。每一个对象结构如下：
  // {
  //     count: 5, // 监听了几个事件
  //     id: 13, // 监听方的id
  //     listeningTo: Object, // 自身相关的一些信息
  //     obj: child, // 被监听的对象
  //     objId: "12" // 被监听对象id
  // }
  Events.stopListening = function(obj, name, callback) {
    // 找到 正在监听的对象
    var listeningTo = this._listeningTo;

    // 获取当前已监听对象. 为空时直接返回.
    if (!listeningTo) return this;

    // 获取所有需要解除的事件id，如果有指定obj 则 obj 上监听的事件，否则就是获取所有正在监听的事件id集合
    var ids = obj ? [obj._listenId] : _.keys(listeningTo);
    // 循环遍历解除
    for (var i = 0; i < ids.length; i++) {
      // 找到正在监听这个事件的 object,也就是监听方，将监听事件从监听方Object解除
      var listening = listeningTo[ids[i]];

      // If listening doesn't exist, this object is not currently
      // listening to obj. Break out early.
      // 如果没有监听方，就跳出循环
      if (!listening) break;

      //listening.obj 获得被监听对象，接触事件绑定。
      listening.obj.off(name, callback, this);

      // todo  ????
      // 如果 设置了 手动追踪，则手动解绑
      if (listening.interop) listening.off(name, callback);
    }

    // 如果当前监听列表已经为空，则 将 this._listeningTo 设为 void 0，也就是undefined
    if (_.isEmpty(listeningTo)) this._listeningTo = void 0;

    return this;
  };

  // The reducing API that removes a callback from the `events` object.
  // 真正用于解绑事件的函数。
  // 此函数用于 往this._events里面删除相应的事件，在 eventsApi 函数中作为 iteratee 参数调用。
  var offApi = function(events, name, callback, options) {
    // 如果没有传入要删除的事件就直接返回
    if (!events) return;

    // 获得上下文，和监听方
    var context = options.context, listeners = options.listeners;
    var i = 0, names;

    // Delete all event listeners and "drop" events.
    // 如果没有name，没有上下文，没有回调函数，则删除所有监听方，同时删除事件
    if (!name && !context && !callback) {
      for (names = _.keys(listeners); i < names.length; i++) {
        listeners[names[i]].cleanup();
      }
      return;
    }

    // 获取要删除的事件名称，如果没有名称，就获取所有事件
    names = name ? [name] : _.keys(events);
    for (; i < names.length; i++) {
      // 获取事件名称
      name = names[i];
      // 获取保存此事件的数组对象，比如要删除click
      var handlers = events[name];

      // Bail out if there are no events stored.
      // 保存此事件的数组对象为空时就跳出循环
      if (!handlers) break;

      // Find any remaining events.
      // remaining 用于保存其他剩下的事件。即非click事件。
      var remaining = [];
      for (var j = 0; j < handlers.length; j++) {
        var handler = handlers[j];
        //这里要严格对上下文进行判断,上下文不等不能删除，算是其他事件，push到remaining中
        if (
          callback && callback !== handler.callback &&
            callback !== handler.callback._callback ||
              context && context !== handler.context
        ) {
          remaining.push(handler);
        } else {
          // 剩下的就是要删除的事件
          // 获得监听方，然后解除对于事件的监听
          var listening = handler.listening;
          if (listening) listening.off(name, callback);
        }
      }

      // Replace events if there are any remaining.  Otherwise, clean up.
      // 如果有其余的事件，也就是非目标删除事件，就重新添加到events，负责就直接全部删除
      if (remaining.length) {
        events[name] = remaining;
      } else {
        delete events[name];
      }
    }

    return events;
  };

  // Bind an event to only be triggered a single time. After the first time
  // the callback is invoked, its listener will be removed. If multiple events
  // are passed in using the space-separated syntax, the handler will fire
  // once for each event, not once for a combination of all events.
  // 绑定事件只能触发一次。在第一次调用回调之后，它的监听器将被删除。如果使用空格分隔的语法传递多个事件，则处理程序将针对每个事件触发一次，而不是一次所有事件的组合。
  Events.once = function(name, callback, context) {
    // Map the event into a `{event: once}` object.
    // 循环每个事件把它添加到{event: once}对象中
    // 调用onceMap处理事件， _.bind(this.off, this)将作为onceMap最后一个参数传入offer
    var events = eventsApi(onceMap, {}, name, callback, _.bind(this.off, this));

    // ????
    // 如果名字是字符串并且上下文为空，则回调函数置为空，
    // 在onceMap中,在事件被调用一次之后会解除上下文，也就是 context 为空，这个时候表示已经调用过一次了，将callback置为undefined
    if (typeof name === 'string' && context == null) callback = void 0;

    // 调用的是on方法 绑定事件
    return this.on(events, callback, context);
  };

  // Inversion-of-control versions of `once`.
  // once的反转控制版本
  Events.listenToOnce = function(obj, name, callback) {
    // Map the event into a `{event: once}` object.
    // 循环每个事件把它添加到{event: once}对象中
    // 调用onceMap处理事件，_.bind(this.stopListening, this, obj)将作为onceMap最后一个参数传入offer
    // underscore:_.bind(function, object, *arguments) 绑定函数 function 到对象 object 上, 也就是无论何时调用函数, 函数里的 this 都指向这个 object.任意可选参数 arguments 可以传递给函数 function .
    // underscore:_.bind 例子：
    // var func = function(greeting){ return greeting + ': ' + this.name };
    // func = _.bind(func, {name: 'moe'}, 'hi');
    // func();
    // => 'hi: moe'
    var events = eventsApi(onceMap, {}, name, callback, _.bind(this.stopListening, this, obj));
    // 调用listenTo方法
    return this.listenTo(obj, events);
  };

  // Reduces the event callbacks into a map of `{event: onceWrapper}`.
  // `offer` unbinds the `onceWrapper` after it has been called.
  // 将事件回调减少为“{event：onceWrapper}”的映射。“offer”在被调用后解除了“onceWrapper”的绑定。
  // iteratee(events, name, callback, opts);
  var onceMap = function(map, name, callback, offer) {
    // 如果有callback,表示还没有调用过
    if (callback) {
      // underscore:_.once(function) 创建一个只能调用一次的函数。重复调用改进的方法也没有效果，只会返回第一次执行时的结果。作为初始化函数使用时非常有用, 不用再设一个boolean值来检查是否已经初始化完成.
      var once = map[name] = _.once(function() {
        // name,once 会作为_.bind(function, object, *arguments)中function的参数
        // 执行this.off或者this.stopListening，解除绑定
        offer(name, once);
        // 调用回调函数
        callback.apply(this, arguments);
      });
      //????
      once._callback = callback;
    }
    return map;
  };

  // Trigger one or many events, firing all bound callbacks. Callbacks are
  // passed the same arguments as `trigger` is, apart from the event name
  // (unless you're listening on `"all"`, which will cause your callback to
  // receive the true name of the event as the first argument).
  // trigger一个或者多个事件，并触发所有的回调函数
  Events.trigger = function(name) {
    // 每个Events对象内部有一个_events对象，保存某一个事件的回调函数队列。
    // 如果没有监听事件，则直接返回
    if (!this._events) return this;

    // 参数长度
    var length = Math.max(0, arguments.length - 1);
    // 新建一个数组
    var args = Array(length);
    // 在数组args中保存传递进来的除了第一个之外的其余参数,提取出来的参数最终回传递给下方定义的函数 triggerApi
    for (var i = 0; i < length; i++) args[i] = arguments[i + 1];

    // 调用triggerApi
    eventsApi(triggerApi, this._events, name, void 0, args);
    return this;
  };

  // Handles triggering the appropriate event callbacks.
  // 处理触发适当的事件回调。
  var triggerApi = function(objEvents, name, callback, args) {
    if (objEvents) {
      var events = objEvents[name];
      //处理对all事件进行监听的情况，假设A对象监听了B对象的all事件，那么所有的B对象的事件都会被触发,并且会把事件名作为第一个函数参数
      var allEvents = objEvents.all;
      if (events && allEvents) allEvents = allEvents.slice();

      // 如果不是所有事件
      if (events) triggerEvents(events, args);
      // 如果是所有事件
      if (allEvents) triggerEvents(allEvents, [name].concat(args));
    }
    return objEvents;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  // 对事件进行触发,优先进行call调用，call调用比apply调用效率更高，所以优先进行call调用
  // 之所以用`switch`是因为大多数的回调函数需要的参数都在三个以内(包含三个).如果是小于三个的参数，就用call，否则用apply
  // 这里的events参数，实际上是回调函数列
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      // 因为call调用的时候是需要将参数展开的，而apply调用的时候传入一个数组即可
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
    }
  };

  // A listening class that tracks and cleans up memory bindings
  // when all callbacks have been offed.
  // 实例,保存当前对象所监听的对象
  var Listening = function(listener, obj) {
    this.id = listener._listenId; //监听方的id
    this.listener = listener; // 监听方
    this.obj = obj; // 被监听的对象
    this.interop = true;
    this.count = 0;   //监听了几个事件
    this._events = void 0; // 监听事件的回调函数序列
  };

  // Listening的实例可以有 on 方法绑定事件
  Listening.prototype.on = Events.on;

  // Offs a callback (or several).
  // Uses an optimized counter if the listenee uses Backbone.Events.
  // Otherwise, falls back to manual tracking to support events
  // library interop.
  // Listening的实例涌来解除正在监听的一个或多个回调。
  Listening.prototype.off = function(name, callback) {
    var cleanup;
    // 初始化this.interop都为true
    // ??????
    if (this.interop) {
      // _events对象，用于保存当前对象监听的事件。
      this._events = eventsApi(offApi, this._events, name, callback, {
        context: void 0,
        listeners: void 0
      });
      // ????
      // this._events中有回调函数，cleanup 为false
      // this._events中没有回调函数，cleanup 为true
      cleanup = !this._events;
    } else {
      this.count--;
      // 当有正在监听的事件时，cleanup 为false
      // 当没有正在监听的事件时，cleanup 为true
      cleanup = this.count === 0;
    }
    // 当没有回调或者正在监听的事件时，解除监听方和事件序列的绑定关系。
    if (cleanup) this.cleanup();
  };

  // Cleans up memory bindings between the listener and the listenee.
  // 清理监听方和事件列表之间的内存绑定。
  Listening.prototype.cleanup = function() {
    delete this.listener._listeningTo[this.obj._listenId];
    if (!this.interop) delete this.obj._listeners[this.id];
  };

  // Aliases for backwards compatibility.
  // 等价函数命名
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Allow the `Backbone` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  // 将Events的特性全部extend到Backbone, 即Backbone也可以做Backbone.on/Backbone.trigger这样的操作.
  // underscore:_.extend(destination, *sources) 复制source对象中的所有属性覆盖到destination对象上，并且返回 destination 对象. 复制是按顺序的, 所以后面的对象属性会把前面的对象属性覆盖掉(如果有重复).
  _.extend(Backbone, Events);


  // 至此,Events部分结束,接下来是Model部分
  // Backbone.Model  模型Model绑定键值数据和自定义事件；
  // --------------
  // 每当一个模型建立，一个 cid 便会被自动创建
  // 实际上，Model 函数内的语句顺序也是很重要的，这个不能随便打乱顺序(初始化过程)


  // Backbone **Models** are the basic data object in the framework --
  // frequently representing a row in a table in a database on your server.
  // A discrete chunk of data and a bunch of useful, related methods for
  // performing computations and transformations on that data.
  // Backbone**Models**是框架中的基本数据对象 - 通常表示服务器上数据库中的表中的一行。 一组离散的数据和一系列有用的相关方法，用于对该数据执行计算和转换。

  // Create a new model with the specified attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  // 创建具有指定属性的新model。 客户端ID（`cid`）自动生成并分配给您。
  var Model = Backbone.Model = function(attributes, options) {
    // attrs存储参数attributes，如果为空，初始化为空对象
    var attrs = attributes || {};
    // 如果没有options，初始化为空对象
    options || (options = {});

    // 后面定义的提前初始化函数。默认为空函数。
    this.preinitialize.apply(this, arguments);

    // Model的唯一的id，这和自己传入的id并不一样，虽然我们也要保证id是唯一的
    this.cid = _.uniqueId(this.cidPrefix);

    // model 模型元数据都存储在`attributes`变量中.
    this.attributes = {};
    // 如果指定`collection`则保存, model在构造url时可能会用到此参数.
    if (options.collection) this.collection = options.collection;

    //如果之后new的时候传入的是JSON,我们必须在options选项中声明parse为true
    if (options.parse) attrs = this.parse(attrs, options) || {};

    // underscore _.result(object, property)方法:如果对象 object 中的属性 property 是函数, 则调用它, 否则, 返回它。
    // 返回当前Model的默认属性值集合
    var defaults = _.result(this, 'defaults');

    // underscore _.defaults(object, *defaults)方法:用defaults对象填充object中的undefined属性。 并且返回这个object。一旦这个属性被填充，再使用defaults方法将不会有任何效果。
    // underscore _.extend(destination, *sources)方法:复制source对象中的所有属性覆盖到destination对象上，并且返回 destination 对象. 复制是按顺序的, 所以后面的对象属性会把前面的对象属性覆盖掉(如果有重复).

    // 合并 默认属性 和 传进来的参数属性 到一个空数组，将未被设置的属性默认为默认值。
    attrs = _.defaults(_.extend({}, defaults, attrs), defaults);
    // 调用后面定义的`set`方法设置数据到`this.attributes`中.
    this.set(attrs, options);
    // 存储历史变化记录，用于保存上一次`set`之后改变的数据字段.
    this.changed = {};
    // 调用initialize初始化方法。这个initialize也是空的，给初始化之后调用
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  // 使用extend方法为Model原型定义一系列属性和方法。
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    // 存储当前值和上一个值不同的属性的哈希值。
    // 用于保存上一次`set`之后改变的数据的key集合, 在new一个对象时此变量值会被改成{}.
    changed: null,

    // The value returned during the last failed validation.
    // 如果数据字段的格式不合法, 此变量不为空. 可通过此变量判断数据有效性.
    validationError: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    // JSON`id`属性的默认名称为“”id“`。 MongoDB和CouchDB用户可能希望将其设置为“_id”。
    idAttribute: 'id',

    // The prefix is used to create the client id which is used to identify models locally.
    // You may want to override this if you're experiencing name clashes with model ids.
    // 该前缀用于创建用于在本地识别模型的客户端标识。如果你遇到名称与模型ID的冲突，可能需要重写该名称。
    cidPrefix: 'c',

    // preinitialize is an empty function by default. You can override it with a function
    // or object.  preinitialize will run before any instantiation logic is run in the Model.
    // preinitialize默认为空函数。您可以使用函数或对象覆盖它。在模型中运行任何实例逻辑之前，preinitialize将运行。
    preinitialize: function(){},

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    // 默认情况下，Initialize是一个空的函数。用自己的初始化逻辑覆盖它。
    initialize: function(){},

    // Return a copy of the model's `attributes` object.
    // 返回模型的“attributes”对象的副本。(JSON对象格式)
    toJSON: function(options) {
      // underscore _.clone(object)方法:创建 一个浅复制（浅拷贝）的克隆object。任何嵌套的对象或数组都通过引用拷贝，不会复制。
      return _.clone(this.attributes);
    },

    // Proxy `Backbone.sync` by default -- but override this if you need
    // custom syncing sem/antics for *this* particular model.
    // 默认情况下，代理`Backbone.sync`，但是如果需要* this *特定模型的自定义同步语义，则重写此代码。
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Get the value of an attribute.
    // 根据attr属性名, 获取模型中的数据值
    get: function(attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    // 根据attr属性名, 获取模型中的数据值, 数据值包含的HTML特殊字符将被转换为HTML实体, 包含 & < > " ' \
    escape: function(attr) {
      // underscore _.escape(string)方法:转义HTML字符串，替换&, <, >, ", ', 和 /字符。
      return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    // 检查模型中是否存在某个属性。
    // 当该属性的值被转换为Boolean类型后值为false, 则认为不存在。如果值为false, null, undefined, 0, NaN, 或空字符串时, 均会被转换为false。
    has: function(attr) {
      return this.get(attr) != null;
    },

    // Special-cased proxy to underscore's `_.matches` method.
    // 特殊情况下代理 underscore's `_.matches` 方法
    matches: function(attrs) {
      // underscore _.iteratee(value, [context], [argCount]) 方法:一个重要的内部函数用来生成可应用到集合中每个元素的回调， 返回想要的结果 - 无论是等式，任意回调，属性匹配，或属性访问。
      return !!_.iteratee(attrs, this)(this.attributes);
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    // 在 new model 的时候被调用 this.set(attrs, options);
    // 在对象上设置模型属性的哈希，触发“”change“`。 这是模型的核心原始操作，更新数据并通知任何需要了解状态变化的人。
    set: function(key, val, options) {
      // 如果没有传入key，则直接返回
      if (key == null) return this;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      // 处理 key,value 和 {key:value} 两种形式的参数
      var attrs;
      // 如果key是一个对象, 则认定为使用对象形式设置, 第二个参数将被视为options参数
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      // 如果是"key", value两个参数进行单独设置，将数据放到attrs对象中方便统一处理
      } else {
        (attrs = {})[key] = val;
      }
      // options配置项必须是一个对象, 如果没有设置options则默认值为一个空对象
      options || (options = {});

      // Run validation.
      // 对当前数据进行验证, 如果验证未通过则停止执行
      if (!this._validate(attrs, options)) return false;

      // Extract attributes and options.
      // 其它属性和选项
      //
      // 这个变量标志着是删除而不是重新赋值,为下文直接调用set方法进行unset提供了方便
      var unset      = options.unset;
      // 是否静默改变,如果不是静默改变就可以触发change函数
      var silent     = options.silent;
      // 方便触发事件的时候使用
      var changes    = [];

      // 适用于嵌套更改操作
      var changing   = this._changing;
      // 将 this._changing 赋值给changing，然后再重新定义为 true
      this._changing = true;
      // 初次 set 时 changing 为 undefined 而 this.changing 为 true


      //适用于嵌套更改操作
      // 初次set时会进入此判断
      // 如果是初次 set，将当前的 attributes 保存到 this._previousAttributes，同时将 this.changed 置为 {}，用来后续判断哪些属性发生了变化。
      if (!changing) {
        // 历史版本变量，也就是这次set之前这个model中有哪些键值对
        this._previousAttributes = _.clone(this.attributes);
        // 存储历史变化记录，用于保存上一次`set`之后改变的数据字段.
        this.changed = {};
      }

      // 当前模型中的数据对象
      var current = this.attributes;

      //changed用来存历史版本,因此backbone支持一个变量历史版本(但并不是时光机，而仅仅是一个历史版本)
      var changed = this.changed;
      //_previousAttributes存放着是历史版本变量，也就是这次set之前这个model中有哪些键值对
      var prev    = this._previousAttributes;

      // For each `set` attribute, update or delete the current value.
      // 对于每个 set 属性，更新或者删除当前值
      // 遍历需要设置的数据对象
      for (var attr in attrs) {
        // attr存储当前属性名称, val存储当前属性的值
        val = attrs[attr];

        // underscore _.isEqual(object, other)方法:执行两个对象之间的优化深度比较，确定他们是否应被视为相等。
        // 如果当前值和要设置的值不相等，则属于要变化的属性，push到changes中
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        // 如果上一次的值和要设置的值不相等，则在历史版本中保存一下
        if (!_.isEqual(prev[attr], val)) {
          changed[attr] = val;
        // 如果上一次的值和要设置的值相等，则从历史版本中删除
        } else {
          delete changed[attr];
        }

        // 判断了到底是删除还是更新
        // 判断 options 中是否有 {unset: true} 的设置，若有，则把 this.attributes 中 attrs 里指定的所有 key 都删除，不然属于更新，将该属性赋值为新值
        unset ? delete current[attr] : current[attr] = val;
      }

      // Update the `id`.
      // 更新 id。如果在set的时候传入了新的id,那么这个时候就可以更改id了
      if (this.idAttribute in attrs) this.id = this.get(this.idAttribute);

      // Trigger all relevant attribute changes.
      // 判断 options 中是否有 {silent: true} 的设置，若没有，则分别触发 changes 数组中的一个 key 对应的 change 事件，对每一个属性的更改都触发相应的事件,事件名采用 change:AttrName 格式,同时 this._pending = options（后续步骤使用）
      if (!silent) {
        // 如果有要change的属性，this._pending 赋值为options
        if (changes.length) this._pending = options;
        // 循环触发事件
        for (var i = 0; i < changes.length; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      // 判断 changing 状态位是否为 true，若是则返回 this, 这一步主要是考虑到上面 !silent 判断中触发的 change 事件会再次导致 set 方法的调用，但是在后续的 set 调用中，由于 this.changing 已经设为 true， changing = this.changing 也为 true， 所以后续 set 方法走到这一步就会结束。
      if (changing) return this;

      // ??????
      // 判断 options.silent 是否为 true，若不是则将 this.pending 置为 false，同时触发 change 事件，并不断循环，直到 this.pending 为 false 为止
      //
      // _pending:https://github.com/jashkenas/backbone/issues/2846
      //
      // 如果有更改事件的监听器更新多个属性，则不会调用所有set的函数。while循环处理1个监听器调用多次的边缘情况，而不是多个监听器，每个调用set一次。例子：
      // model.on('change:a', function() {
      //   model.set({b: true});
      //   model.set({b: true});
      // });
      if (!silent) {
        while (this._pending) {
          options = this._pending;
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      // 将 this.changing 和 this.pending 设为 false，返回 this，结束
      this._pending = false;
      this._changing = false;
      return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    // 从模型中删除一个属性，触发“change”事件。unset 设置为 true,为删除操作。
    unset: function(attr, options) {
      return this.set(attr, void 0, _.extend({}, options, {unset: true}));
    },

    // Clear all attributes on the model, firing `"change"`.
    // 清除所有模型上的所有属性，触发"change"事件，unset 设置为 true,为删除操作。
    clear: function(options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0;
      return this.set(attrs, _.extend({}, options, {unset: true}));
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    // 确定最近的一次 “change” 事件 触发了 model 变化。
    //
    // underscore _.isEmpty(object)方法:如果object 不包含任何值(没有可枚举的属性)，返回true。 对于字符串和类数组（array-like）对象，如果length属性为0，那么_.isEmpty检查返回true。
    // _.isEmpty([1, 2, 3]);
    // => false
    // _.isEmpty({});
    // => true
    hasChanged: function(attr) {
      if (attr == null) return !_.isEmpty(this.changed);
      // underscore _.has(object, key) 方法:对象是否包含给定的键吗？等同于object.hasOwnProperty(key)，但是使用hasOwnProperty 函数的一个安全引用，以防意外覆盖。
      // _.has({a: 1, b: 2, c: 3}, "b");
      // => true
      return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    // 返回一个对象包含所有变化了的属性，如果没有对属性发生变化则返回false。
    // 主要用于确定那部分视图需要更新 并且（或者）那些属性需要持久化到服务器。取消设置的属性会被设置为undefined。
    // 你还可以将属性对象传递给模型，以确定是否将会有改变。
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
      var old = this._changing ? this._previousAttributes : this.attributes;
      var changed = {};
      var hasChanged;
      for (var attr in diff) {
        var val = diff[attr];
        if (_.isEqual(old[attr], val)) continue;
        changed[attr] = val;
        hasChanged = true;
      }
      return hasChanged ? changed : false;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    // 获得被记录的最新的一次"change"事件被触发时某个属性的旧值。
    previous: function(attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    // 获得 model 中所有属性 在“change” 事件被触发时的旧值
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    // Fetch the model from the server, merging the response with the model's
    // local attributes. Any changed attributes will trigger a "change" event.
    // 从服务端抓取 model，将响应的属性与模型的本地属性合并。
    // 任何变化都会触发 “change” 事件
    fetch: function(options) {
      options = _.extend({parse: true}, options);
      var model = this;
      // 在options中可以指定获取数据成功后的自定义回调函数
      var success = options.success;
      // 当获取数据成功后填充数据并调用自定义成功回调函数
      options.success = function(resp) {
        // 通过parse方法将服务器返回的数据进行转换
        var serverAttrs = options.parse ? model.parse(resp, options) : resp;
        // 通过set方法将转换后的数据填充到模型中, 因此可能会触发change事件(当数据发生变化时)
        // 如果填充数据时验证失败, 则不会调用自定义success回调函数
        if (!model.set(serverAttrs, options)) return false;
        // 调用自定义的success回调函数
        if (success) success.call(options.context, model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      // 请求发生错误时通过wrapError处理error事件
      wrapError(this, options);
      // 调用sync方法从服务器获取数据
      return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    // 保存模型中的数据到服务器。设置属性的 哈希指，并将模型同步到服务器，如果服务器返回不同的属性哈希，则模型的状态将再次设置。
    save: function(key, val, options) {
      // Handle both `"key", value` and `{key: value}` -style arguments.
      // 处理 key,value 和 {key:value} 两种形式的参数
      //
      // attrs存储需要保存到服务器的数据对象
      var attrs;
      if (key == null || typeof key === 'object') {
        // 如果key是一个对象, 则认为是通过对象方式设置
        // 此时第二个参数被认为是options
        attrs = key;
        options = val;
      } else {
        // 如果是通过key: value形式设置单个属性, 则直接设置attrs
        (attrs = {})[key] = val;
      }

      options = _.extend({validate: true, parse: true}, options);

      // 如果在options中设置了wait选项, 则被改变的数据将会被提前验证, 且服务器没有响应新数据(或响应失败)时, 本地数据会被还原为修改前的状态
      // 如果没有设置wait选项, 则无论服务器是否设置成功, 本地数据均会被修改为最新状态
      var wait = options.wait;

      // If we're not waiting and attributes exist, save acts as
      // `set(attr).save(null, opts)` with validation. Otherwise, check if
      // the model will be valid when the attributes, if any, are set.
      // 未设置 wait 选项，将修改过最新的数据保存到模型中, 便于在sync方法中获取模型数据保存到服务器
      if (attrs && !wait) {
        // 如果set失败，则返回false
        if (!this.set(attrs, options)) return false;
      // 设置了 wait 选项，对需要保存的数据提前进行验证
      } else if (!this._validate(attrs, options)) {
        return false;
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      // 成功的服务器端保存后，客户端（可选）会更新服务器端状态。
      var model = this;
      var success = options.success;
      var attributes = this.attributes;
      // 服务器响应成功后执行success
      options.success = function(resp) {
        // Ensure attributes are restored during synchronous saves.
        // 确保在同步保存期间还原属性。
        model.attributes = attributes;
        var serverAttrs = options.parse ? model.parse(resp, options) : resp;
        // 如果使用了wait参数, 则优先将修改后的数据状态直接设置到模型
        if (wait) serverAttrs = _.extend({}, attrs, serverAttrs);
        // 将最新的数据状态设置到模型中
        // 如果调用set方法时验证失败, 则不会调用自定义的success回调函数
        if (serverAttrs && !model.set(serverAttrs, options)) return false;
        // 调用响应成功后自定义的success回调函数
        if (success) success.call(options.context, model, resp, options);
        // 触发sync事件
        model.trigger('sync', model, resp, options);
      };
      // 请求发生错误时通过wrapError处理error事件
      wrapError(this, options);

      // Set temporary attributes if `{wait: true}` to properly find new ids.
      // 如果`{wait：true}`正确找到新的id，则设置临时属性。
      if (attrs && wait) this.attributes = _.extend({}, attributes, attrs);
      // 将模型中的数据保存到服务器
      // 如果当前模型是一个新建的模型(没有id), 则使用create方法(新增), 否则认为是update方法(修改)
      var method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
      if (method === 'patch' && !options.attrs) options.attrs = attrs;
      var xhr = this.sync(method, this, options);

      // Restore attributes.
      // 还原属性。
      // 此时保存的请求还没有得到响应, 因此如果响应失败, 模型中将保持修改前的状态, 如果服务器响应成功, 则会在success中设置模型中的数据为最新状态
      this.attributes = attributes;

      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    // 如果服务器已经持久化，则在服务器上销毁此模型。如果有模型，则可以从Collection集合中删除该模型。 如果设置了“wait：true”，请等待服务器成功响应再删除。
    //
    // 如果模型是在客户端新建的, 则直接从客户端删除
    // 如果模型数据同时存在服务器, 则同时会删除服务器端的数据
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;
      var wait = options.wait;

      var destroy = function() {
        model.stopListening();
        // 删除数据成功调用, 触发destroy事件, 如果模型存在于Collection集合中, 集合将监听destroy事件并在触发时从集合中移除该模型
        model.trigger('destroy', model, model.collection, options);
      };

      options.success = function(resp) {
        if (wait) destroy();
        if (success) success.call(options.context, model, resp, options);
        // 如果该模型不是一个客户端新建的模型, 触发sync事件
        if (!model.isNew()) model.trigger('sync', model, resp, options);
      };

      var xhr = false;
      // 如果该模型是一个客户端新建的模型,
      if (this.isNew()) {
        // underscore _.defer(function, *arguments) 延迟调用function直到当前调用栈清空为止，类似使用延时为0的setTimeout方法。
        _.defer(options.success);
      } else {
        // 请求发生错误时通过wrapError处理error事件
        wrapError(this, options);
        // 通过sync方法发送删除数据的请求
        xhr = this.sync('delete', this, options);
      }

      // 如果没有在options对象中配置wait项, 则会先删除本地数据, 再发送请求删除服务器数据
      // 此时无论服务器删除是否成功, 本地模型数据已被删除
      if (!wait) destroy();
      return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using Backbone's restful methods, override this to change the endpoint
    // that will be called.
    //backbone Model的url构造函数，我们可以指定一个urlRoot作为根路径，另外也可以继承来自collection的url
    // 当然我们还可以覆盖这个url函数的写法(不推荐)
    // 获取模型在服务器接口中对应的url, 在调用save, fetch, destroy等与服务器交互的方法时, 将使用该方法获取url
    // 如果在模型中定义了urlRoot, 服务器接口应为[urlRoot/id]形式
    // 如果模型所属的Collection集合定义了url方法或属性, 则使用集合中的url形式: [collection.url/id]
    // 在访问服务器url时会在url后面追加上模型的id, 便于服务器标识一条记录, 因此模型中的id需要与服务器记录对应
    // 如果无法获取模型或集合的url, 将调用urlError方法抛出一个异常
    url: function() {
      // underscore _.result(object, property)方法:如果对象 object 中的属性 property 是函数, 则调用它, 否则, 返回它。
      //
      // 定义服务器对应的url路径
      var base =
        _.result(this, 'urlRoot') ||
        _.result(this.collection, 'url') ||
        urlError();
      // 如果当前模型是客户端新建的模型, 则不存在id属性, 服务器url直接使用base
      if (this.isNew()) return base;
      // 如果当前模型具有id属性, 可能是调用了save或destroy方法, 将在base后面追加模型的id
      // 下面将判断base最后一个字符是否是"/", 生成的url格式为[base/id]
      var id = this.get(this.idAttribute);
      return base.replace(/[^\/]$/, '$&/') + encodeURIComponent(id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    // **parse** 将响应转换为模型的“set”属性的哈希值。 默认的实现只是传递响应。
    parse: function(resp, options) {
      return resp;
    },

    // Create a new model with identical attributes to this one.
    // 创建一个具有相同属性的新模型。
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    // 判断是否是新model。如果从未保存到服务器，而且缺少ID，则模型是新的。
    isNew: function() {
      return !this.has(this.idAttribute);
    },

    // Check if the model is currently in a valid state.
    // 判断是否通过验证，在使用validate验证的时候可以调用
    isValid: function(options) {
      return this._validate({}, _.extend({}, options, {validate: true}));
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
    // 数据验证方法, 在调用set, save, add等数据更新方法时, 被自动执行
    // 验证失败会触发模型对象的"error"事件, 如果在options中指定了error处理函数, 则只会执行options.error函数
    //
    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true;
      // 获取对象中所有的属性值
      attrs = _.extend({}, this.attributes, attrs);
      // 放入validate方法中进行验证。validate方法包含2个参数, 分别为模型中的数据集合与配置对象, 如果验证通过则不返回任何数据(默认为undefined), 验证失败则返回带有错误信息数据
      var error = this.validationError = this.validate(attrs, options) || null;
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
      return false;
    }

  });


  // 至此,Model部分结束,接下来是Collection部分
  // Backbone.Collection 集合Colection是模型的有序或无序集合，带有丰富的可枚举API；
  // -------------------
  // If models tend to represent a single row of data, a Backbone Collection is
  // more analogous to a table full of data ... or a small slice or page of that
  // table, or a collection of rows that belong together for a particular reason
  // -- all of the messages in this particular folder, all of the documents
  // belonging to this particular author, and so on. Collections maintain
  // indexes of their models, both in order, and for lookup by `id`.
  // 如果 model 更倾向于表示单行数据，那么 Backbone Collection 更类似于完整数据的表，或者表数据的一小片或者一页表格，或者因为一些原因而聚集在一起的多条行数据。Collections 维护其模型的索引，无论是按顺序的还是通过“id”进行查找。

  // Create a new **Collection**, perhaps to contain a specific type of `model`.
  // If a `comparator` is specified, the Collection will maintain
  // its models in sort order, as they're added and removed.
  // 创建一个新的 **Collection**，可能包含了某一种特定的类型的 model。如果指定了“comparator”，则Collection将按照排序顺序维护其模型，当它们被添加和删除。
  var Collection = Backbone.Collection = function(models, options) {
    // 配置对象
    options || (options = {});
    // 提前初始化
    this.preinitialize.apply(this, arguments);
    // 在配置参数中设置集合的模型类作为当前的模型
    // 实际上我们在创建集合类的时候大多数都会定义一个model, 而不是在初始化的时候从options中指定model
    if (options.model) this.model = options.model
    // options中指定一个comparator作为排序器;集合中的数据将按照comparator方法中的排序算法进行排序(在add方法中会自动调用)
    if (options.comparator !== void 0) this.comparator = options.comparator;
    // 实例化时重置集合的内部状态(第一次调用时可理解为定义状态)
    this._reset();
    // 初始化
    this.initialize.apply(this, arguments);
    // 如果指定了models数据, 则调用reset方法将数据添加到集合中
    // 首次调用时设置了silent参数, 因此不会触发"reset"事件
    if (models) this.reset(models, _.extend({silent: true}, options));
  };

  // Default options for `Collection#set`.
  // 设置`Collection#set`默认配置
  var setOptions = {add: true, remove: true, merge: true};
  var addOptions = {add: true, remove: false};

  // Splices `insert` into `array` at index `at`.
  // 拼接数组
  var splice = function(array, insert, at) {
    // 确定at值
    at = Math.min(Math.max(at, 0), array.length);
    var tail = Array(array.length - at);
    var length = insert.length;
    var i;
    for (i = 0; i < tail.length; i++) tail[i] = array[i + at];
    for (i = 0; i < length; i++) array[i + at] = insert[i];
    for (i = 0; i < tail.length; i++) array[i + length + at] = tail[i];
  };

  // Define the Collection's inheritable methods.
  // 通过extend方法定义集合类原型方法
  _.extend(Collection.prototype, Events, {

    // The default model for a collection is just a **Backbone.Model**.
    // This should be overridden in most cases.
    // 定义集合的模型类, 模型类必须是一个Backbone.Model。
    // 大多数情况下会被重写。
    model: Model,


    // preinitialize is an empty function by default. You can override it with a function
    // or object.  preinitialize will run before any instantiation logic is run in the Collection.
    // preinitialize默认为空函数。你可以用函数或者对象重写它。preinitialize将在Collection中运行任何实例逻辑之前，先运行。
    preinitialize: function(){},

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    // initialize 默认也是空函数。你可以用你自己的初始化函数覆盖它。
    initialize: function(){},

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    // 返回一个数组, 包含了集合中每个模型的属性。
    toJSON: function(options) {
        // 通过Undersocre的map方法将集合中每一个模型的toJSON结果组成一个数组, 并返回
        return this.map(function(model) { return model.toJSON(options); });
    },

    // Proxy `Backbone.sync` by default.
    // 默认代理`Backbone.sync`
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Add a model, or list of models to the set. `models` may be Backbone
    // Models or raw JavaScript objects to be converted to Models, or any
    // combination of the two.
    // 向集合中添加一个或多个模型对象
    // 这个模型可以是backbone模型，也可以是用来生成backbone模型的js键值对象或者两者的任意组合。
    add: function(models, options) {
      return this.set(models, _.extend({merge: false}, options, addOptions));
    },

    // Remove a model, or a list of models from the set.
    // 从集合中删除一个或多个模型对象
    // ????
    remove: function(models, options) {
      options = _.extend({}, options);
      // underscore _.isArray(object)方法: 如果object是一个数组，返回true。
      var singular = !_.isArray(models);
      // models不是数组，就套个壳转换为数组;
      // 是数组，就调用slice()返回一个新的数组。
      models = singular ? [models] : models.slice();

      var removed = this._removeModels(models, options);
      if (!options.silent && removed.length) {
        options.changes = {added: [], merged: [], removed: removed};
        this.trigger('update', this, options);
      }
      return singular ? removed[0] : removed;
    },

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    // 通过“set”更新集合，添加新的模型，删除不再存在的模型，并根据需要合并集合中已存在的模型。 类似于** Model＃set **，用于更新集合所包含的数据的核心操作。
    /*
       set可能有如下几个调用场景：
       1. 重置模式，这个时候不在models里的model都会被清除掉。对应上文的：var setOptions = {add: true, remove: true, merge: true};
       2. 添加模式，这个时候models里的内容会做添加用，如果有重复的(Cid来判断)，会覆盖。对应上文的：var addOptions = {add: true, remove: false};
       我们还是理一理里面做了哪些事情：

       * 先规范化models和options两个参数
       * 遍历models：
         * 如果是重置模式，那么遇到重复的就直接覆盖掉，并且也添加到set队列，遇到新的就先添加到set队列。之后还要删除掉models里没有而原来collection里面有的
         * 如果是添加模式，那么遇到重复的，就先添加到set队列，遇到新的也是添加到set队列
       * 之后进行整理，整合到collection中
    */

    // ?????
    set: function(models, options) {
      // 如果没有传入要操作的 models ,则直接返回
      if (models == null) return;

      options = _.extend({}, setOptions, options);
      if (options.parse && !this._isModel(models)) {
        models = this.parse(models, options) || [];
      }
      //判断models是不是一个数组,如果不是数组先转化成数组方便以后处理
      var singular = !_.isArray(models);
      models = singular ? [models] : models.slice();

      //如果at为null,经过这几个条件的处理at仍然为null
      var at = options.at;
      //强制转化为数字
      if (at != null) at = +at;
      if (at > this.length) at = this.length;
      if (at < 0) at += this.length + 1;


      //set里面存放的是新的Collection的models
      var set = [];
      //toAdd存储将要增加的model
      var toAdd = [];
      //toMerge存储将要合并的model
      var toMerge = [];
      //toRemove存储将要移除的model
      var toRemove = [];
      //modelMap在删除变量的时候会被用到
      var modelMap = {};

      var add = options.add;
      var merge = options.merge;
      var remove = options.remove;

      var sort = false;
      // 是否可以排序。如果有排序器，并且at是null并且配置中options.sort 不是false，那么就是可以排序
      var sortable = this.comparator && at == null && options.sort !== false;
      // 按照什么属性排序
      var sortAttr = _.isString(this.comparator) ? this.comparator : null;

      // Turn bare objects into model references, and prevent invalid models
      // from being added.
      // 将空对象转换为模型引用，并防止添加无效模型。
      var model, i;
      for (i = 0; i < models.length; i++) {
        model = models[i];

        // If a duplicate is found, prevent it from being added and
        // optionally merge it into the existing model.
        // 如果发现重复，则阻止它被添加，并且可选地将其合并到现有模型中。
        // 判断是否重复
        // 这个判断是否重复是根据model的cid来判断的,而cid是model在初始化的时候系统调用underscore的方法建立的随机数,并不是用户建立的
        var existing = this.get(model);
        // 如果重复
        if (existing) {
          //如果有相同cid的model,但是model的内容却变化了
          if (merge && model !== existing) {
            //取出传入的model的属性
            var attrs = this._isModel(model) ? model.attributes : model;
            //进行JSON解析
            if (options.parse) attrs = existing.parse(attrs, options);
            //重新给model赋值
            existing.set(attrs, options);

            toMerge.push(existing);
            //排序标志属性是否有变化
            if (sortable && !sort) sort = existing.hasChanged(sortAttr);
          }
          //将存在的model放入set和modelMap
          if (!modelMap[existing.cid]) {
            modelMap[existing.cid] = true;
            set.push(existing);
          }
          //规范化models[i]
          models[i] = existing;

        // If this is a new, valid model, push it to the `toAdd` list.
        // 如果 是 有效的新model,把它push 进`toAdd`数组
        } else if (add) {
          model = models[i] = this._prepareModel(model, options);
          if (model) {
            toAdd.push(model);
            this._addReference(model, options);
            modelMap[model.cid] = true;
            set.push(model);
          }
        }
      }

      // Remove stale models.
      // 删除陈旧的模型。
      if (remove) {
        for (i = 0; i < this.length; i++) {
          model = this.models[i];
          if (!modelMap[model.cid]) toRemove.push(model);
        }
        if (toRemove.length) this._removeModels(toRemove, options);
      }

      // See if sorting is needed, update `length` and splice in new models.
      // 查看是否需要排序，更新“长度”和新模型中的拼接。如果是作为重置使用，肯定是要将没有在第一个参数中出现的删除的，如果仅仅是增加，那么就不需要删除
      var orderChanged = false;
      var replace = !sortable && add && remove;
      if (set.length && replace) {
        orderChanged = this.length !== set.length || _.some(this.models, function(m, index) {
          return m !== set[index];
        });
        this.models.length = 0;
        splice(this.models, set, 0);
        this.length = this.models.length;
      } else if (toAdd.length) {
        if (sortable) sort = true;
        splice(this.models, toAdd, at == null ? this.length : at);
        this.length = this.models.length;
      }

      // Silently sort the collection if appropriate.
      if (sort) this.sort({silent: true});

      // Unless silenced, it's time to fire all appropriate add/sort/update events.
      if (!options.silent) {
        for (i = 0; i < toAdd.length; i++) {
          if (at != null) options.index = at + i;
          model = toAdd[i];
          model.trigger('add', model, this, options);
        }
        if (sort || orderChanged) this.trigger('sort', this, options);
        if (toAdd.length || toRemove.length || toMerge.length) {
          options.changes = {
            added: toAdd,
            removed: toRemove,
            merged: toMerge
          };
          this.trigger('update', this, options);
        }
      }

      // Return the added (or merged) model (or models).
      return singular ? models[0] : models;
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    // 传入一组模型，重置collection。适用于批量操作和优化。
    reset: function(models, options) {
      options = options ? _.clone(options) : {};
      for (var i = 0; i < this.models.length; i++) {
        // _removeReference：移除模块与集合的关系
        this._removeReference(this.models[i], options);
      }
      options.previousModels = this.models;
      // 重置所有状态
      this._reset();
      // 从新添加model
      models = this.add(models, _.extend({silent: true}, options));
      if (!options.silent) this.trigger('reset', this, options);
      return models;
    },

    // Add a model to the end of the collection.
    // 添加一个 model 到 collection 集合的最后。
    push: function(model, options) {
      return this.add(model, _.extend({at: this.length}, options));
    },

    // Remove a model from the end of the collection.
    // 从collection末尾删除一个 model .
    pop: function(options) {
      // 找到最后一个模块
      var model = this.at(this.length - 1);
      // 删除模块
      return this.remove(model, options);
    },

    // Add a model to the beginning of the collection.
    // 在 collection 开头添加一个 model
    unshift: function(model, options) {
      return this.add(model, _.extend({at: 0}, options));
    },

    // Remove a model from the beginning of the collection.
    // 从collection 开头删除一个 model
    shift: function(options) {
      // 找到第一个 model
      var model = this.at(0);
      // 删除第一个model
      return this.remove(model, options);
    },

    // Slice out a sub-array of models from the collection.
    slice: function() {
      return slice.apply(this.models, arguments);
    },

    // Get a model from the set by id, cid, model object with id or cid
    // properties, or an attributes object that is transformed through modelId.
    // 得到model。通过id、cid 或者带有id or cid属性的model对象、或者 通过modelId转化的属性对象。
    get: function(obj) {
      if (obj == null) return void 0;
      return this._byId[obj] ||
        this._byId[this.modelId(this._isModel(obj) ? obj.attributes : obj)] ||
        obj.cid && this._byId[obj.cid];
    },

    // Returns `true` if the model is in the collection.
    // 判断collection是否存在某个 model 
    has: function(obj) {
      return this.get(obj) != null;
    },

    // Get the model at the given index.
    // 通过 index 获得对应的 model
    at: function(index) {
      // 如果 index 是负数，就是倒数
      if (index < 0) index += this.length;
      return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    // 返回 和目标属性匹配的 models 。对于“filter”的简单情况很有用。
    where: function(attrs, first) {
      return this[first ? 'find' : 'filter'](attrs);
    },

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    // 返回 目标属性匹配的第一个 model。 对于“find”的简单情况很有用。
    findWhere: function(attrs) {
      return this.where(attrs, true);
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    // 强制collection排序。在正常情况下，您不需要调用它，因为在添加每个项目时，该集合将自己排序。
    sort: function(options) {
      var comparator = this.comparator;
      // 调用sort方法必须指定了comparator属性(排序算法方法), 否则将抛出一个错误
      if (!comparator) throw new Error('Cannot sort a set without a comparator');
      options || (options = {});

      var length = comparator.length;
      if (_.isFunction(comparator)) comparator = _.bind(comparator, this);

      // Run sort based on type of `comparator`.
      if (length === 1 || _.isString(comparator)) {
        this.models = this.sortBy(comparator);
      } else {
        this.models.sort(comparator);
      }
      if (!options.silent) this.trigger('sort', this, options);
      return this;
    },

    // Pluck an attribute from each model in the collection.
    // 将collection中所有模型的attr属性值存放到一个数组并返回
    pluck: function(attr) {
      return this.map(attr + '');
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    // 从服务器获取集合的初始化数据.
    // 获取collection的默认模型集合，在收集后重置该模型。 如果“reset：true”被传递，响应数据将通过`reset`方法而不是`set`传递。
    fetch: function(options) {
      // 复制options对象, 因为options对象在后面会被修改用于临时存储数据
      options = _.extend({parse: true}, options);
      // 自定义回调函数, 数据请求成功后并添加完成后, 会调用自定义success函数
      var success = options.success;
      // collection记录当前集合对象, 用于在success回调函数中使用
      var collection = this;
      // 当从服务器请求数据成功时执行options.success, 该函数中将解析并添加数据
      options.success = function(resp) {
        var method = options.reset ? 'reset' : 'set';
        collection[method](resp, options);
        // 如果设置了自定义成功回调, 则执行
        if (success) success.call(options.context, collection, resp, options);
        collection.trigger('sync', collection, resp, options);
      };
      // 当服务器返回状态错误时, 通过wrapError方法处理错误事件
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    // 向集合中添加并创建一个模型, 同时将该模型保存到服务器
    // 如果是通过数据对象来创建模型, 需要在集合中声明model属性对应的模型类
    // 如果在options中声明了wait属性, 则会在服务器创建成功后再将模型添加到集合, 否则先将模型添加到集合, 再保存到服务器(无论保存是否成功)
    create: function(model, options) {
      options = options ? _.clone(options) : {};
      var wait = options.wait;
      // 通过_prepareModel获取模型类的实例
      model = this._prepareModel(model, options);
      // 模型创建失败
      if (!model) return false;
      // 如果没有声明wait属性, 则通过add方法将模型添加到集合中
      if (!wait) this.add(model, options);
      var collection = this;
      // success存储保存到服务器成功之后的自定义回调函数(通过options.success声明)
      var success = options.success;
      // 监听模型数据保存成功后的回调函数
      options.success = function(m, resp, callbackOpts) {
        // 如果声明了wait属性, 则在只有在服务器保存成功后才会将模型添加到集合中
        if (wait) collection.add(m, callbackOpts);
        // 如果声明了自定义成功回调, 则执行自定义函数
        if (success) success.call(callbackOpts.context, m, resp, callbackOpts);
      };
      // 调用模型的save方法, 将模型数据保存到服务器
      model.save(null, options);
      return model;
    },

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    // 数据解析方法, 用于将服务器数据解析为模型和集合可用的结构化数据
    // 默认将返回resp本身, 这需要与服务器定义Backbone支持的数据格式, 如果需要自定义数据格式, 可以重载parse方法
    parse: function(resp, options) {
      return resp;
    },

    // Create a new collection with an identical list of models as this one.
    // 创建一个与此相同的models列表的新集合。
    clone: function() {
      return new this.constructor(this.models, {
        model: this.model,
        comparator: this.comparator
      });
    },

    // Define how to uniquely identify models in the collection.
    // 定义如何在集合中惟一地标识模型。
    modelId: function(attrs) {
      return attrs[this.model.prototype.idAttribute || 'id'];
    },

    // Get an iterator of all models in this collection.
    // 获取此集合中所有模型的迭代器。
    values: function() {
      return new CollectionIterator(this, ITERATOR_VALUES);
    },

    // Get an iterator of all model IDs in this collection.
    // 在这个集合中获取所有模型id的迭代器。
    keys: function() {
      return new CollectionIterator(this, ITERATOR_KEYS);
    },

    // Get an iterator of all [ID, model] tuples in this collection.
    entries: function() {
      return new CollectionIterator(this, ITERATOR_KEYSVALUES);
    },

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    // 删除所有集合元素并重置集合中的数据状态
    _reset: function() {
      // 删除集合元素
      this.length = 0;
      this.models = [];
      // 重置集合状态
      this._byId  = {};
    },

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    // 将模型添加到集合中之前的一些准备工作
    // 包括将数据实例化为一个模型对象, 和将集合引用到模型的collection属性
    _prepareModel: function(attrs, options) {
      if (this._isModel(attrs)) {
        if (!attrs.collection) attrs.collection = this;
        return attrs;
      }
      options = options ? _.clone(options) : {};
      options.collection = this;
      var model = new this.model(attrs, options);
      if (!model.validationError) return model;
      this.trigger('invalid', this, model.validationError, options);
      return false;
    },

    // Internal method called by both remove and set.
    // 解绑某个模型与集合的关系, 包括对集合的引用和事件监听
    // 一般在调用remove方法删除模型或调用reset方法重置状态时自动调用
    _removeModels: function(models, options) {
      var removed = [];
      // 遍历需要移除的模型列表
      for (var i = 0; i < models.length; i++) {
        // 获取模型
        var model = this.get(models[i]);
        // 没有获取到模型，则继续下一次循环
        if (!model) continue;

        // indexOf是Underscore对象中的方法, 这里通过indexOf方法获取模型在集合中首次出现的位置
        var index = this.indexOf(model);
        // 从集合列表中移除该模型
        this.models.splice(index, 1);
        // 重置当前集合的length属性(记录集合中模型的数量)
        this.length--;

        // Remove references before triggering 'remove' event to prevent an
        // infinite loop. #3693
        // 从_byId列表中移除模型的id引用
        delete this._byId[model.cid];
        var id = this.modelId(model.attributes);
        if (id != null) delete this._byId[id];

        // 如果没有设置silent属性, 则触发模型的remove事件
        if (!options.silent) {
          // 将当前模型在集合中的位置添加到options对象并传递给remove监听事件, 以便在事件函数中可以使用
          options.index = index;
          model.trigger('remove', model, this, options);
        }

        removed.push(model);
        // 解除模型与集合的关系, 包括集合中对模型的引用和事件监听
        this._removeReference(model, options);
      }
      return removed;
    },

    // Method for checking whether an object should be considered a model for
    // the purposes of adding to the collection.
    // 判断是否是 Model 实例
    _isModel: function(model) {
      return model instanceof Model;
    },

    // Internal method to create a model's ties to a collection.
    // 内部方法用于创建模型与集合的联系。
    _addReference: function(model, options) {
      this._byId[model.cid] = model;
      var id = this.modelId(model.attributes);
      if (id != null) this._byId[id] = model;
      model.on('all', this._onModelEvent, this);
    },

    // Internal method to sever a model's ties to a collection.
    // 内部方法用于切断模型与集合的联系。
    _removeReference: function(model, options) {
      delete this._byId[model.cid];
      var id = this.modelId(model.attributes);
      if (id != null) delete this._byId[id];
      if (this === model.collection) delete model.collection;
      model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    // 在向集合中添加模型时被自动调用
    // 用于监听集合中模型的事件, 当模型在触发事件(add, remove, destroy, change事件)时集合进行相关处理
    _onModelEvent: function(event, model, collection, options) {
      if (model) {
        // 添加和移除模型的事件, 必须确保模型所属的集合为当前集合对象
        if ((event === 'add' || event === 'remove') && collection !== this) return;
        // 模型触发销毁事件时, 从集合中移除
        if (event === 'destroy') this.remove(model, options);
        // 当模型的id被修改时, 集合修改_byId中存储对模型的引用, 保持与模型id的同步, 便于使用get()方法获取模型对象
        if (event === 'change') {
          // 获取模型在改变之前的id, 并根据此id从集合的_byId列表中移除
          var prevId = this.modelId(model.previousAttributes());
          var id = this.modelId(model.attributes);
          if (prevId !== id) {
            if (prevId != null) delete this._byId[prevId];
            // 以模型新的id作为key, 在_byId列表中存放对模型的引用
            if (id != null) this._byId[id] = model;
          }
        }
      }
      // 在集合中触发模型对应的事件, 无论模型触发任何事件, 集合都会触发对应的事件
      // (例如当模型被添加到集合中时, 会触发模型的"add"事件, 同时也会在此方法中触发集合的"add"事件)
      // 这对于监听并处理集合中模型状态的变化非常有效
      // 在监听的集合事件中, 触发对应事件的模型会被作为参数传递给集合的监听函数
      this.trigger.apply(this, arguments);
    }

  });

  // Defining an @@iterator method implements JavaScript's Iterable protocol.
  // In modern ES2015 browsers, this value is found at Symbol.iterator.
  // 
  // 定义 $$iterator 方法实现JavaScript 迭代协议。在现代ES2015浏览器中，该值位于Symbol.iterator中。
  /* global Symbol */
  // 知识点补充：
    // JavaScript 迭代协议: es6中新加的。
    // 该迭代协议允许JavaScript对象来定义自己的迭代行为。一些内置类型具有默认迭代行为，例如Array或者Map，而其他类型（例如Object）不是。
    // 为了可以迭代，一个对象必须实现 $$iterator 方法，这意味着对象（或其原型链中的一个对象）必须具有一个可通过属性访问的 $$iterator ，即Symbol.iterator：
    // 属性[Symbol.iterator] 值是：一个零参数函数返回一个符合迭代器协议的对象。
    // 无论何时 一个对象需要被迭代，都会调用它的 $$iterator 方法，无参数传入，并且返回的迭代器可以用来获取要迭代的值。
    // 具体可以了解：https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
  var $$iterator = typeof Symbol === 'function' && Symbol.iterator;
  if ($$iterator) {
    Collection.prototype[$$iterator] = Collection.prototype.values;
  }

  // CollectionIterator Collection迭代器
  // ------------------

  // A CollectionIterator implements JavaScript's Iterator protocol, allowing the
  // use of `for of` loops in modern browsers and interoperation between
  // Backbone.Collection and other JavaScript functions and third-party libraries
  // which can operate on Iterables.
  // Collection迭代器 实现JavaScript的迭代器协议，允许在现代浏览器中使用`for of｀循环，并支持Backbone.Collection和其它 可以操作迭代的 JavaScript 函数以及第三方库进行互操作。

  var CollectionIterator = function(collection, kind) {
    // 获得集合
    this._collection = collection;

    // 迭代的方法 ????
    this._kind = kind;
    this._index = 0;
  };

  // This "enum" defines the three possible kinds of values which can be emitted
  // by a CollectionIterator that correspond to the values(), keys() and entries()
  // methods on Collection, respectively.
  // ?????
  // 这个“enum”定义了可以由CollectionIterator发出的三种可能的值，它们分别对应于Collection中的values()、keys()和entries()方法。
  var ITERATOR_VALUES = 1;
  var ITERATOR_KEYS = 2;
  var ITERATOR_KEYSVALUES = 3;

  // All Iterators should themselves be Iterable.
  // 所有迭代器本身应可迭代。
  if ($$iterator) {
    CollectionIterator.prototype[$$iterator] = function() {
      return this;
    };
  }

  CollectionIterator.prototype.next = function() {
    if (this._collection) {

      // Only continue iterating if the iterated collection is long enough.
      // 如果迭代集合足够长，则只能继续迭代。
      if (this._index < this._collection.length) {
        var model = this._collection.at(this._index);
        this._index++;

        // Construct a value depending on what kind of values should be iterated.
        // 根据应该迭代哪些类型的值构造一个值。
        var value;
        // 如果迭代方法是 values();
        if (this._kind === ITERATOR_VALUES) {
          value = model;
        } else {
          var id = this._collection.modelId(model.attributes);
          // 如果迭代方法是 keys();
          if (this._kind === ITERATOR_KEYS) {
            value = id;
          } else { // ITERATOR_KEYSVALUES
            value = [id, model];
          }
        }
        return {value: value, done: false};
      }

      // Once exhausted, remove the reference to the collection so future
      // calls to the next method always return done.
      // 一旦耗尽，删除对集合的引用，所以将来调用下一个方法总是返回完成。
      this._collection = void 0;
    }

    return {value: void 0, done: true};
  };

  // Backbone.View  视图相关
  // -------------

  // Backbone Views are almost more convention than they are actual code. A View
  // is simply a JavaScript object that represents a logical chunk of UI in the
  // DOM. This might be a single item, an entire list, a sidebar or panel, or
  // even the surrounding frame which wraps your whole app. Defining a chunk of
  // UI as a **View** allows you to define your DOM events declaratively, without
  // having to worry about render order ... and makes it easy for the view to
  // react to specific changes in the state of your models.
  // 视图只是一个JavaScript对象，它表示DOM中的一个逻辑块UI。

  // Creating a Backbone.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  // 
  // 视图类用于创建与数据低耦合的界面控制对象, 通过将视图的渲染方法绑定到数据模型的change事件, 当数据发生变化时会通知视图进行渲染
  // 视图对象中的el用于存储当前视图所需要操作的DOM最父层元素, 这主要是为了提高元素的查找和操作效率, 其优点包括:
  // - 查找或操作元素时, 将操作的范围限定在el元素内, 不需要再整个文档树中搜索
  // - 在为元素绑定事件时, 可以方便地将事件绑定到el元素(默认也会绑定到el元素)或者是其子元素
  // - 在设计模式中, 将一个视图相关的元素, 事件, 和逻辑限定在该视图的范围中, 降低视图与视图间的耦合(至少在逻辑上是这样)
  var View = Backbone.View = function(options) {
    // 为每一个视图对象创建一个唯一标识, 前缀为"view"
    this.cid = _.uniqueId('view');
    // 提前初始化
    this.preinitialize.apply(this, arguments);
    // underscore _.pick(object, *keys)方法：返回一个object副本，只过滤出keys(有效的键组成的数组)参数指定的属性值。或者接受一个判断函数，指定挑选哪个key。
    _.extend(this, _.pick(options, viewOptions));
    // 初始化dom元素和jQuery元素工作,设置或创建视图中的元素
    this._ensureElement();
    // 调用自定义的初始化方法
    this.initialize.apply(this, arguments);
  };

  // Cached regex to split keys for `delegate`.
  // 定义用于解析events参数中事件名称和元素的正则
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be set as properties.
  // 要设置为属性的视图选项列表。
  // 记录一些列属性名, 在构造视图对象时, 如果传递的配置项中包含这些名称, 则将属性复制到对象本身
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

  // Set up all inheritable **Backbone.View** properties and methods.
  // 设置所有可继承的** Backbone.View **属性和方法。
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"div"`.
    // 视图元素的默认`tagName`是``div'`。
    tagName: 'div',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be preferred to global lookups where possible.
    // 用于元素查找的jQuery委托，作用于当前视图中的DOM元素。如果可能，这应该优先于全局查找。
    $: function(selector) {
      return this.$el.find(selector);
    },

    // preinitialize is an empty function by default. You can override it with a function
    // or object.  preinitialize will run before any instantiation logic is run in the View
    // 默认空函数。可重写。
    preinitialize: function(){},

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    // 默认空函数。可重写。
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    // ** render **是您的视图应该覆盖的核心函数，以便使用适当的HTML填充其元素（`this.el`）。这个惯例是** render **总是返回`this`。
    render: function() {
      return this;
    },

    // Remove this view by taking the element out of the DOM, and removing any
    // applicable Backbone.Events listeners.
    //移除这个View。
    //通过将元素从DOM中移除，并删除任何适用的Backbone.Events侦听器来删除此视图。
    remove: function() {
      this._removeElement();
      this.stopListening();
      return this;
    },

    // Remove this view's element from the document and all event listeners
    // attached to it. Exposed for subclasses using an alternative DOM
    // manipulation API.
    // 从文档和附加到其上的所有事件监听器中删除此视图的元素。使用替代的DOM操作API暴露给子类。用jQuery的API进行remove,从DOM树中移除这个节点
    _removeElement: function() {
      this.$el.remove();
    },

    // Change the view's element (`this.el` property) and re-delegate the
    // view's events on the new element.
    // 更改视图的元素（`this.el`属性）并重新委派新元素上的视图事件。
    setElement: function(element) {
      this.undelegateEvents();
      this._setElement(element);
      this.delegateEvents();
      return this;
    },

    // Creates the `this.el` and `this.$el` references for this view using the
    // given `el`. `el` can be a CSS selector or an HTML string, a jQuery
    // context or an element. Subclasses can override this to utilize an
    // alternative DOM manipulation API and are only required to set the
    // `this.el` property.
    // 
    /*
      this.$el代表jQuery节点
      this.el代表DOM节点
    */
    _setElement: function(el) {
      this.$el = el instanceof Backbone.$ ? el : Backbone.$(el);
      this.el = this.$el[0];
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save',
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    // 为视图元素绑定事件
    // events参数配置了需要绑定事件的集合, 格式如('事件名称 元素选择表达式' : '事件方法名称/或事件函数'):
    // {
    //     'click #title': 'edit',
    //     'click .save': 'save'
    //     'click span': function() {}
    // }
    // 该方法在视图对象初始化时会被自动调用, 并将对象中的events属性作为events参数(事件集合)
    delegateEvents: function(events) {
      // 如果没有手动传递events参数, 则从视图对象获取events属性作为事件集合
      events || (events = _.result(this, 'events'));
      if (!events) return this;
      // 取消当前已经绑定过的events事件
      this.undelegateEvents();
      // 遍历需要绑定的事件列表
      for (var key in events) {
        // 获取需要绑定的方法(允许是方法名称或函数)
        var method = events[key];
        // 如果是方法名称, 则从对象中获取该函数对象, 因此该方法名称必须是视图对象中已定义的方法
        if (!_.isFunction(method)) method = this[method];
        // 如果是无效的方法，则继续下一轮循环
        if (!method) continue;

        // 解析事件表达式(key), 从表达式中解析出事件的名字和需要操作的元素
        // 例如 'click #title'将被解析为 'click' 和 '#title' 两部分, 均存放在match数组中
        var match = key.match(delegateEventSplitter);
        this.delegate(match[1], match[2], _.bind(method, this));
      }
      return this;
    },

    // Add a single event listener to the view's element (or a child element
    // using `selector`). This only works for delegate-able events: not `focus`,
    // `blur`, and not `change`, `submit`, and `reset` in Internet Explorer.
    // 将单个事件侦听器添加到视图的元素（或使用`selector`的子元素）。 这只适用于可委托的事件：在Internet Explorer中`focus`，`blur`，`change`，`submit`和`reset`是不适用的。
    delegate: function(eventName, selector, listener) {
      this.$el.on(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Clears all callbacks previously bound to the view by `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    // 清除以前由“delegateEvents”绑定到视图的所有回调。 你通常不需要使用它，但如果您有多个Backbone视图连接到同一DOM元素，则可能会用。
    undelegateEvents: function() {
      if (this.$el) this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // A finer-grained `undelegateEvents` for removing a single delegated event.
    // `selector` and `listener` are both optional.
    // 调用jQuery的off函数对事件进行解绑
    undelegate: function(eventName, selector, listener) {
      this.$el.off(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Produces a DOM element to be assigned to your view. Exposed for
    // subclasses using an alternative DOM manipulation API.
    // 创建一个dom元素并且返回
    _createElement: function(tagName) {
      return document.createElement(tagName);
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    // 确保View具有要渲染的DOM元素。 如果`this.el`是一个字符串，传递通过`$（）`，取第一个匹配元素，然后重新分配给'el'。 否则，从“id”，“className”和“tagName”属性创建一个元素。
    _ensureElement: function() {
      // 如果没有设置el属性, 则创建默认元素
      if (!this.el) {
        // 从对象获取attributes属性, 作为新创建元素的默认属性列表
        var attrs = _.extend({}, _.result(this, 'attributes'));
        // 设置新元素的id
        if (this.id) attrs.id = _.result(this, 'id');
        // 设置新元素的class
        if (this.className) attrs['class'] = _.result(this, 'className');
        this.setElement(this._createElement(_.result(this, 'tagName')));
        this._setAttributes(attrs);
      } else {
        // 如果设置了el属性, 则直接调用setElement方法将el元素设置为视图的标准元素
        this.setElement(_.result(this, 'el'));
      }
    },

    // Set attributes from a hash on this view's element.  Exposed for
    // subclasses using an alternative DOM manipulation API.
    _setAttributes: function(attributes) {
      this.$el.attr(attributes);
    }

  });

  // Proxy Backbone class methods to Underscore functions, wrapping the model's
  // `attributes` object or collection's `models` array behind the scenes.
  // 代理Backbone类方法到Underscore函数，将模型的“attributes”对象或集合的“models”数组包装在幕后。
  // 
  // 这个函数和下面的函数的作用是将underscore中的方法加入到具体的对象(实际上是类)中,后文中只有两次调用addUnderscoreMethods方法：一次是给model添加方法，一次是给collection添加方法
  // 
  // 例子
  // collection.filter(function(model) { return model.get('age') > 10 });
  // collection.each(this.addView);
  //
  // `Function#apply` can be slow so we use the method's arg count, if we know it.
  // 
  // apply 运行速度比call 慢，所以优先 选用 call，具体原因看 https://jiayili.gitbooks.io/fe-study-easier/content/javascript%E5%9F%BA%E7%A1%80/wei-shi-yao-call-bi-apply-kuai-ff1f.html
  var addMethod = function(base, length, method, attribute) {
    //underscore中的一个比较好的设计是，在不同的方法中，如果参数个数相同，那么每一个参数代表的意义都是相同的
    //所以这里我们仅仅根据参数个数进行区分即可
    switch (length) {
      case 1: return function() {
        return base[method](this[attribute]);
      };
      case 2: return function(value) {
        return base[method](this[attribute], value);
      };
      case 3: return function(iteratee, context) {
        return base[method](this[attribute], cb(iteratee, this), context);
      };
      case 4: return function(iteratee, defaultVal, context) {
        return base[method](this[attribute], cb(iteratee, this), defaultVal, context);
      };
      default: return function() {
        var args = slice.call(arguments);
        args.unshift(this[attribute]);
        return base[method].apply(base, args);
      };
    }
  };

  var addUnderscoreMethods = function(Class, base, methods, attribute) {
    _.each(methods, function(length, method) {
      if (base[method]) Class.prototype[method] = addMethod(base, length, method, attribute);
    });
  };

  // Support `collection.sortBy('attr')` and `collection.findWhere({id: 1})`.
  // 支持`collection.sortBy('attr')` 或者 `collection.findWhere({id: 1})` 这种调用方式.这个函数的作用是，由于underscore的迭代器要求都是函数，这里我们这样写处理掉了不是函数的情况.
  var cb = function(iteratee, instance) {
    // 如果是函数
    if (_.isFunction(iteratee)) return iteratee;
    // 如果是对象
    if (_.isObject(iteratee) && !instance._isModel(iteratee)) return modelMatcher(iteratee);
    // 如果是字符串
    if (_.isString(iteratee)) return function(model) { return model.get(iteratee); };
    return iteratee;
  };

  var modelMatcher = function(attrs) {
    // underscore _.matches(attrs) 返回一个断言函数，这个函数会给你一个断言 可以用来辨别 给定的对象是否匹配指定键/值属性的列表。
    var matcher = _.matches(attrs);
    return function(model) {
      return matcher(model.attributes);
    };
  };

  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of Backbone Collections is actually implemented
  // right here:
  // 我们要在Collection上实现的Underscore方法。 Backbone Collections的核心用途的90％实际上在这里实现：
  // 混入了众多underscore方法
  var collectionMethods = {forEach: 3, each: 3, map: 3, collect: 3, reduce: 0,
      foldl: 0, inject: 0, reduceRight: 0, foldr: 0, find: 3, detect: 3, filter: 3,
      select: 3, reject: 3, every: 3, all: 3, some: 3, any: 3, include: 3, includes: 3,
      contains: 3, invoke: 0, max: 3, min: 3, toArray: 1, size: 1, first: 3,
      head: 3, take: 3, initial: 3, rest: 3, tail: 3, drop: 3, last: 3,
      without: 0, difference: 0, indexOf: 3, shuffle: 1, lastIndexOf: 3,
      isEmpty: 1, chain: 1, sample: 3, partition: 3, groupBy: 3, countBy: 3,
      sortBy: 3, indexBy: 3, findIndex: 3, findLastIndex: 3};


  // Underscore methods that we want to implement on the Model, mapped to the
  // number of arguments they take.
  // 我们要在Model上实现的Underscore方法，映射到它们所参数的数量。
  var modelMethods = {keys: 1, values: 1, pairs: 1, invert: 1, pick: 0,
      omit: 0, chain: 1, isEmpty: 1};

  // Mix in each Underscore method as a proxy to `Collection#models`.
  // underscore _.each(list, iteratee, [context]) Alias: forEach  遍历list中的所有元素，按顺序用遍历输出每个元素。如果传递了context参数，则把iteratee绑定到context对象上。每次调用iteratee都会传递三个参数：(element, index, list)。如果list是个JavaScript对象，iteratee的参数是 (value, key, list))。返回list以方便链式调用。
  _.each([
    [Collection, collectionMethods, 'models'],
    [Model, modelMethods, 'attributes']
  ], function(config) {
    var Base = config[0],
        methods = config[1],
        attribute = config[2];

    Base.mixin = function(obj) {
      // underscore _.reduce :(list, iteratee, [memo], [context]) Aliases: inject, foldl 别名为 inject 和 foldl, reduce方法把list中元素归结为一个单独的数值。Memo是reduce函数的初始值，reduce的每一步都需要由iteratee返回。这个迭代传递4个参数：memo,value 和 迭代的index（或者 key）和最后一个引用的整个 list。如果没有memo传递给reduce的初始调用，iteratee不会被列表中的第一个元素调用。第一个元素将取代 传递给列表中下一个元素调用iteratee的memo参数。
      // 例子：var sum = _.reduce([1, 2, 3], function(memo, num){ return memo + num; }, 0);
      // => 6
      var mappings = _.reduce(_.functions(obj), function(memo, name) {
        memo[name] = 0;
        return memo;
      }, {});
      addUnderscoreMethods(Base, obj, mappings, attribute);
    };

    addUnderscoreMethods(Base, _, methods, attribute);
  });

  // Backbone.sync   同步服务器需要的函数
  // -------------

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
  // 
  // 覆盖此功能以更改Backbone将models持续到服务器的方式。你需要传递 request 的类型以及有问题的 model。默认情况下，一个 RESTful Ajax 请求会调用 model 的 url() 方法。一些可能的使用场景：
  // 1、使用 setTimeout 将快速更新 批量导入到单个请求中。
  // 2、发送 XML 形式的 model
  // 3、通过WebSockets而不是Ajax来持久化模型。
  // 
  //
  // * Use `setTimeout` to batch rapid-fire updates into a single request.
  // * Send up the models as XML instead of JSON.
  // * Persist models via WebSockets instead of Ajax.
  //
  // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
  // as `POST`, with a `_method` parameter containing the true HTTP method,
  // as well as all requests with the body as `application/x-www-form-urlencoded`
  // instead of `application/json` with the model in a param named `model`.
  // Useful when interfacing with server-side languages like **PHP** that make
  // it difficult to read the body of `PUT` requests.
  // 
  // emulateHTTP:如果你想在不支持Backbone的默认REST/ HTTP方式的Web服务器上工作，您可以选择开启Backbone.emulateHTTP。 设置该选项将通过 POST 方法伪造 PUT，PATCH和 DELETE 请求 用真实的方法设定X-HTTP-Method-Override头信息。
  // 
  // emulateJSON:如果你想在不支持发送 application/json 编码请求的Web服务器上工作，设置Backbone.emulateJSON = true;将导致JSON根据模型参数进行序列化， 并通过application/x-www-form-urlencoded MIME类型来发送一个伪造HTML表单请求
  Backbone.sync = function(method, model, options) {
    // 根据CRUD方法名定义与服务器交互的方法(POST, GET, PUT, DELETE)
    var type = methodMap[method];

    // Default options, unless specified.
    // 如果未被定义，就是用默认options
    _.defaults(options || (options = {}), {
      emulateHTTP: Backbone.emulateHTTP,
      emulateJSON: Backbone.emulateJSON
    });

    // Default JSON-request options.
    // 默认JSON-request选项
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    // 确保我们有一个 可以请求的 URL
    if (!options.url) {
      // 获取请求地址失败时会调用urlError方法抛出一个错误
      params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    // 确保我们有一个 合适的请求数据
    // 如果调用create和update方法, 且没有在options中定义请求数据, 将序列化模型中的数据对象传递给服务器
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      // 定义请求的Content-Type头, 默认为application/json
      params.contentType = 'application/json';
      // 序列化模型中的数据, 并作为请求数据传递给服务器
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    // 对于较老的服务器，通过将请求编码成html格式来模拟JSON。
    if (options.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    // 如果不支持Backbone的默认REST/ HTTP方式,那么统一用post来实现
    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
      params.type = 'POST';
      if (options.emulateJSON) params.data._method = type;
      var beforeSend = options.beforeSend;
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type);
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // Don't process data on a non-GET request.
    // 在非get请求上,将不对数据进行转换, 因为传递的数据可能是一个JSON映射
    if (params.type !== 'GET' && !options.emulateJSON) {
      // 通过设置processData为false来关闭数据转换
      // processData参数是$.ajax方法中的配置参数, 详细信息可参考jQuery或Zepto相关文档
      params.processData = false;
    }

    // Pass along `textStatus` and `errorThrown` from jQuery.
    var error = options.error;
    options.error = function(xhr, textStatus, errorThrown) {
      options.textStatus = textStatus;
      options.errorThrown = errorThrown;
      if (error) error.call(options.context, xhr, textStatus, errorThrown);
    };

    // Make the request, allowing the user to override any Ajax options.
    // 发出请求，允许用户覆盖任何Ajax选项。
    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
  };

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  // 从CRUD映射到HTTP，用于默认的`Backbone.sync` 的实现。
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch': 'PATCH',
    'delete': 'DELETE',
    'read': 'GET'
  };

  // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
  // Override this if you'd like to use a different library.
  // 将“Backbone.ajax”的默认实现设置代理到“$”。
  //如果您想使用其他库，请覆盖此方法。
  Backbone.ajax = function() {
    return Backbone.$.ajax.apply(Backbone.$, arguments);
  };

  // Backbone.Router Backbone的路由部分,这部分被认为是backbone的MVC结构中的被弱化的controller
  // ---------------
  // 
  // 我们在使用的时候，通常会赋值一个这样的routes:
  // routes:{
  //         "article/:id":"getArticleById",
  //         "article":"getlist"
  // },

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  // 在创建Router实例时, 通过options.routes来设置某个路由规则对应的监听方法
  // options.routes中的路由规则按照 {规则名称: 方法名称}进行组织, 每一个路由规则所对应的方法, 都必须是在Router实例中的已经声明的方法
  // options.routes定义的路由规则按照先后顺序进行匹配, 如果当前URL能被多个规则匹配, 则只会执行第一个匹配的事件方法
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    // 提前初始化
    this.preinitialize.apply(this, arguments);
    // 如果在options中设置了routes对象(路由规则), 则赋给当前实例的routes属性
    // routes属性记录了路由规则与事件方法的绑定关系, 当URL与某一个规则匹配时, 会自动调用关联的事件方法
    if (options.routes) this.routes = options.routes;
    // 解析和绑定路由规则
    this._bindRoutes();
    // 调用自定义的初始化方法
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  // 定义用于将字符串形式的路由规则, 转换为可执行的正则表达式规则时的查找条件
  // 
  var optionalParam = /\((.*?)\)/g;

  // 匹配一个URL片段中(以/"斜线"为分隔)的动态路由规则
  // 如: (topic/:id) 匹配 (topic/1228), 监听事件function(id) { // id为1228 }
  var namedParam    = /(\(\?)?:\w+/g;

  // 匹配整个URL片段中的动态路由规则
  // 如: (topic*id) 匹配 (url#/topic1228), 监听事件function(id) { // id为1228 }
  var splatParam    = /\*\w+/g;

  // 匹配URL片段中的特殊字符, 并在字符前加上转义符, 防止特殊字符在被转换为正则表达式后变成元字符
  // 如: (abc)^[,.] 将被转换为 \(abc\)\^\[\,\.\]
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

  // Set up all inheritable **Backbone.Router** properties and methods.
  // 向Router类的原型对象中扩展属性和方法
  _.extend(Router.prototype, Events, {

    // preinitialize is an empty function by default. You can override it with a function
    // or object.  preinitialize will run before any instantiation logic is run in the Router.
    // 默认为空函数，可以重写，在路由器中运行任何实例化逻辑之前，preinitialize将先运行。
    preinitialize: function(){},

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    // 自定义初始化方法, 在路由器Router实例化后被自动调用
    initialize: function(){},


    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    //
    // 将一个路由规则绑定给一个监听事件, 当URL片段匹配该规则时, 会自动调用触发该事件。例如：
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    route: function(route, name, callback) {
      // 检查route规则名称是否为一个字符串(当手动调用route方法创建路由规则时, 允许传递一个正则表达式或字符串作为规则)
      // 在构造Router实例时传入options.routes中的规则, 都应该是一个字符串(因为在_bindRoutes方法中将routes配置中的key作为路由规则)
      // 如果传入的是字符串类型的路由规则, 通过_routeToRegExp方法将其转换为一个正则表达式, 用于匹配URL片段
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      // 如果name是个函数，那么它就是回调，name置为空
      if (_.isFunction(name)) {
        callback = name;
        name = '';
      }

      // 如果还是没有callback(事件方法), 则根据name从当前Router实例中获取与name同名的方法
      // 这是因为在手动调用route方法时可能不会传递callback方法, 但必须传递name事件名称, 并在Router实例中已经定义了该方法
      if (!callback) callback = this[name];
      
      // 将当前 this 赋值给 router
      var router = this;

      // 调用history实例的route方法, 该方法会将转换后的正则表达式规则, 和监听事件方法绑定到history.handlers列表中, 以便history进行路由和控制
      // 当history实例匹配到对应的路由规则而调用该事件时, 会将URL片段作为字符串(即fragment参数)传递给该事件方法
      // 这里并没有直接将监听事件传递给history的route方法, 而是使用bind方法封装了另一个函数, 该函数的执行上下文为当前Router对象
      Backbone.history.route(route, function(fragment) {
        // 调用_extractParameters方法获取匹配到的规则中的参数
        var args = router._extractParameters(route, fragment);
        if (router.execute(callback, args, name) !== false) {
          // 触发route:name事件, name为调用route时传递的事件名称
          // 如果对当前Router实例使用on方法绑定了route:name事件, 则会收到该事件的触发通知
          router.trigger.apply(router, ['route:' + name].concat(args));
          router.trigger('route', name, args);
          // 触发history实例中绑定的route事件, 当路由器匹配到任何规则时, 均会触发该事件
          Backbone.history.trigger('route', router, name, args);
          /**
             * 事件绑定如:
             * var router = new MyRouter();
             * router.on('route:routename', function(param) {
             *     // 绑定到Router实例中某个规则的事件, 当匹配到该规则时触发
             * });
             * Backbone.history.on('route', function(router, name, args) {
             *     // 绑定到history实例中的事件, 当匹配到任何规则时触发
             * });
             * Backbone.history.start();
          **/

        }
      });
      return this;
    },

    // Execute a route handler with the provided parameters.  This is an
    // excellent place to do pre-route setup or post-route cleanup.
    execute: function(callback, args, name) {
      if (callback) callback.apply(this, args);
    },

    // Simple proxy to `Backbone.history` to save a fragment into the history.
    // 通过调用history.navigate方法, 手动设置跳转到URL
    navigate: function(fragment, options) {
      // 代理到history实例的navigate方法
      Backbone.history.navigate(fragment, options);
      return this;
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    // 解析当前实例定义的路由(this.routes)规则, 并调用route方法将每一个规则绑定到对应的方法
    _bindRoutes: function() {
      // 如果在创建对象时没有设置routes规则, 则不进行解析和绑定
      if (!this.routes) return;
      // underscore _.result(object, property) 如果对象 object 中的属性 property 是函数, 则调用它, 否则, 返回它。
      this.routes = _.result(this, 'routes');
      // underscore _.keys(object) 获取object对象所有的属性名称。
      var route, routes = _.keys(this.routes);
      while ((route = routes.pop()) != null) {
        this.route(route, this.routes[route]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    // 将字符串形式的路由规则转换为正则表达式对象
    // (在route方法中检查到字符串类型的路由规则后, 会自动调用该方法进行转换)
    _routeToRegExp: function(route) {
      // 为字符串中特殊字符添加转义符, 防止特殊字符在被转换为正则表达式后变成元字符(这些特殊字符包括-[\]{}()+?.,\\^$|#\s)
      // 将字符串中以/"斜线"为分隔的动态路由规则转换为([^\/]+), 在正则中表示以/"斜线"开头的多个字符
      // 将字符串中的*"星号"动态路由规则转换为(.*?), 在正则中表示0或多个任意字符(这里使用了非贪婪模式, 因此你可以使用例如这样的组合路由规则: *list/:id, 将匹配 orderlist/123 , 同时会将"order"和"123"作为参数传递给事件方法 )
      // 请注意namedParam和splatParam替换后的正则表达式都是用()括号将匹配的内容包含起来, 这是为了方便取出匹配的内容作为参数传递给事件方法
      // 请注意namedParam和splatParam匹配的字符串 :str, *str中的str字符串是无意义的, 它们会在下面替换后被忽略, 但一般写作和监听事件方法的参数同名, 以便进行标识
      route = route.replace(escapeRegExp, '\\$&') //这个匹配的目的是将正则表达式字符进行转义
                   .replace(optionalParam, '(?:$1)?')
                   .replace(namedParam, function(match, optional) {
                     return optional ? match : '([^/?]+)';
                   })
                   .replace(splatParam, '([^?]*?)');
      // 将转换后的字符串创建为正则表达式对象并返回
      // 这个正则表达式将根据route字符串中的规则, 用于匹配URL片段
      return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted decoded parameters. Empty or unmatched parameters will be
    // treated as `null` to normalize cross-browser behavior.
    // 
    // 传入一个路由规则(正则表达式)和URL片段(字符串)进行匹配, 并返回从匹配的字符串中获取参数
    /**
     * 例如路由规则为 'teams/:type/:id', 对应的正则表达式会被转换为/^teams/([^/]+)/([^/]+)$/ , (对路由规则转换为正则表达式的过程可参考_routeToRegExp方法)
     * URL片段为 'teams/35/1228'
     * 则通过exec执行后的结果为 ["teams/35/1228", "35", "1228"]
     * 数组中的一个元素是URL片段字符串本身, 从第二个开始则依次为路由规则表达式中的参数
     */
    _extractParameters: function(route, fragment) {
      var params = route.exec(fragment).slice(1);
      return _.map(params, function(param, i) {
        // Don't decode the search params.
        if (i === params.length - 1) return param || null;
        return param ? decodeURIComponent(param) : null;
      });
    }

  });

  // Backbone.History 路由器管理
  // ----------------
  // 
  // Backbone的history是通过绑定hashchange事件的监听来监听网页url的变化(通过popstate和onhashchange事件进行监听, 对于不支持事件的浏览器通过setInterval心跳监控),从而调用相关函数
  // 另外，在不支持hashchange事件的浏览器中,采用轮询的方式
  // 
  // History一般不会被直接调用, 在第一次实例化Router对象时, 将自动创建一个History的单例(通过Backbone.history访问)

  // Handles cross-browser history management, based on either
  // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
  // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
  // and URL fragments. If the browser supports neither (old IE, natch),
  // falls back to polling.
  var History = Backbone.History = function() {

    // handlers属性记录了当前所有路由对象中已经设置的规则和监听列表
    // 形式如: [{route: route, callback: callback}], route记录了正则表达式规则, callback记录了匹配规则时的监听事件
    // 当history对象监听到URL发生变化时, 会自动与handlers中定义的规则进行匹配, 并调用监听事件
    this.handlers = [];

    // 将checkUrl方法的上下文对象绑定到history对象, 因为checkUrl方法被作为popstate和onhashchange事件或setInterval的回调函数, 在执行回调时, 上下文对象会被改变
    // checkUrl方法用于在监听到URL发生变化时检查并调用loadUrl方法
    // 
    // underscore _.bind(function, object, *arguments) 绑定函数 function 到对象 object 上, 也就是无论何时调用函数, 函数里的 this 都指向这个 object. 任意可选参数 arguments 可以传递给函数 function , 可以填充函数所需要的参数, 这也被称为 partial application。对于没有结合上下文的partial application绑定，请使用partial。 
    // 
    this.checkUrl = _.bind(this.checkUrl, this);

    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  };

  // Cached regex for stripping a leading hash/slash and trailing space.
  // 修正作用，去除结尾的#或/以及多余的空白符(包括\n,\r,\f,\t,\v)
  var routeStripper = /^[#\/]|\s+$/g;

  // Cached regex for stripping leading and trailing slashes.
  // 匹配开头的一个或多个`/`以及结尾的一个或者多个`/`
  var rootStripper = /^\/+|\/+$/g;

  // Cached regex for stripping urls of hash.
  var pathStripper = /#.*$/;

  // Has the history handling already been started?
  // 记录当前history单例对象是否已经被初始化过(调用start方法)
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  // 向History类的原型对象中添加方法, 这些方法可以通过History的实例调用(即Backbone.history对象)
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    // 当用户使用低版本的IE浏览器(不支持onhashchange事件)时, 通过心跳监听路由状态的变化
    // interval属性设置心跳频率(毫秒), 该频率如果太低可能会导致延迟, 如果太高可能会消耗CPU资源(需要考虑用户使用低端浏览器时的设备配置)
    interval: 50,

    // Are we at the app root?
    // 如果处于根节点那么this.location.pathname获取到的应该是`/`
    // 另外这里用到了getSearch来获取?后面的内容,如果能获取到自然说明并不是在根节点
    atRoot: function() {
      var path = this.location.pathname.replace(/[^\/]$/, '$&/');
      return path === this.root && !this.getSearch();
    },

    // Does the pathname match the root?
    matchRoot: function() {
      var path = this.decodeFragment(this.location.pathname);
      var rootPath = path.slice(0, this.root.length - 1) + '/';
      return rootPath === this.root;
    },

    // Unicode characters in `location.pathname` are percent encoded so they're
    // decoded for comparison. `%25` should not be decoded since it may be part
    // of an encoded parameter.
    // %被编码后恰好是%25,这里十分巧妙的解决了防止fragment两次编码的问题
    decodeFragment: function(fragment) {
      return decodeURI(fragment.replace(/%25/g, '%2525'));
    },

    // In IE6, the hash fragment and search params are incorrect if the
    // fragment contains `?`.
    // 取得?以及其后面的内容
    getSearch: function() {
      var match = this.location.href.replace(/#.*/, '').match(/\?.+/);
      return match ? match[0] : '';
    },

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    // 获取location中Hash字符串(锚点#后的片段)
    getHash: function(window) {
      var match = (window || this).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the pathname and search params, without the root.
    // 返回除了哈希以外的所有内容
    getPath: function() {
      var path = this.decodeFragment(
        this.location.pathname + this.getSearch()
      ).slice(this.root.length - 1);
      return path.charAt(0) === '/' ? path.slice(1) : path;
    },

    // Get the cross-browser normalized URL fragment from the path or hash.
    // 从路径或哈希中获取跨浏览器的规范化URL片段。
    getFragment: function(fragment) {
      if (fragment == null) {
        if (this._usePushState || !this._wantsHashChange) {
          fragment = this.getPath();
        } else {
          fragment = this.getHash();
        }
      }
      return fragment.replace(routeStripper, '');
    },

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    // 初始化History实例, 该方法只会被调用一次, 应该在创建并初始化Router对象之后被自动调用
    // 该方法作为整个路由的调度器, 它将针对不同浏览器监听URL片段的变化, 负责验证并通知到监听函数
    start: function(options) {
      // 如果history对象已经被初始化过, 则抛出错误
      if (History.started) throw new Error('Backbone.history has already been started');
      // 设置history对象的初始化状态
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      // 设置配置项, 使用调用start方法时传递的options配置项覆盖默认配置
      // root属性设置URL导航中的路由根目录
      // 如果使用pushState方式进行路由, 则root目录之后的地址会根据不同的路由产生不同的地址(这可能会定位到不同的页面, 因此需要确保服务器支持)
      // 如果使用Hash锚点的方式进行路由, 则root表示URL后锚点(#)的位置
      this.options          = _.extend({root: '/'}, this.options, options);


      /**
             * history针对不同浏览器特性, 实现了3种方式的监听:
             * - 对于支持HTML5中popstate事件的浏览器, 通过popstate事件进行监听
             * - 对于不支持popstate的浏览器, 使用onhashchange事件进行监听(通过改变hash(锚点)设置的URL在被载入时会触发onhashchange事件)
             * - 对于不支持popstate和onhashchange事件的浏览器, 通过保持心跳监听
             *
             * 关于HTML5中popstate事件的相关方法:
             * - pushState可以将指定的URL添加一个新的history实体到浏览器历史里
             * - replaceState方法可以将当前的history实体替换为指定的URL
             * 使用pushState和replaceState方法时仅替换当前URL, 而并不会真正转到这个URL(当使用后退或前进按钮时, 也不会跳转到该URL)
             * (这两个方法可以解决在AJAX单页应用中浏览器前进, 后退操作的问题)
             * 当使用pushState或replaceState方法替换的URL, 在被载入时会触发onpopstate事件
             * 浏览器支持情况:
             * Chrome 5, Firefox 4.0, IE 10, Opera 11.5, Safari 5.0
             *
             * 注意:
             * - history.start方法默认使用Hash方式进行导航
             * - 如果需要启用pushState方式进行导航, 需要在调用start方法时, 手动传入配置options.pushState
             *   (设置前请确保浏览器支持pushState特性, 否则将默认转换为Hash方式)
             * - 当使用pushState方式进行导航时, URL可能会从options.root指定的根目录后发生变化, 这可能会导航到不同页面, 因此请确保服务器已经支持pushState方式的导航
      */

      this.root             = this.options.root;

      // _wantsHashChange属性记录是否希望使用hash(锚点)的方式来记录和导航路由器
      // 除非在options配置项中手动设置hashChange为false, 否则默认将使用hash锚点的方式
      // (如果手动设置了options.pushState为true, 且浏览器支持pushState特性, 则会使用pushState方式)
      this._wantsHashChange = this.options.hashChange !== false;
      //documentMode 属性返回浏览器渲染文档的模式,仅仅IE支持,这里要求>7或者是未定义,也就是说对IE7以下是不支持的
      this._hasHashChange   = 'onhashchange' in window && (document.documentMode === void 0 || document.documentMode > 7);
      this._useHashChange   = this._wantsHashChange && this._hasHashChange;
      // _wantsPushState属性记录是否希望使用pushState方式来记录和导航路由器
      // pushState是HTML5中为window.history添加的新特性, 如果没有手动声明options.pushState为true, 则默认将使用hash方式
      this._wantsPushState  = !!this.options.pushState;
      // _hasPushState属性记录浏览器是否支持pushState特性
      // 如果在options中设置了pushState(即希望使用pushState方式), 则检查浏览器是否支持该特性
      this._hasPushState    = !!(this.history && this.history.pushState);
      //显式声明了pushState为true并且拥有这个能力,才会使用
      this._usePushState    = this._wantsPushState && this._hasPushState;
      // 获取当前URL中的路由字符串
      this.fragment         = this.getFragment();

      // Normalize root to always include a leading and trailing slash.
      this.root = ('/' + this.root + '/').replace(rootStripper, '/');

      // Transition from hashChange to pushState or vice versa if both are
      // requested.
      if (this._wantsHashChange && this._wantsPushState) {

        // If we've started off with a route from a `pushState`-enabled
        // browser, but we're currently in a browser that doesn't support it...
        // 如果我们显式声明了pushState为true但是却在一个并不支持的浏览器,那么这个时候直接先替换location
        if (!this._hasPushState && !this.atRoot()) {
          var rootPath = this.root.slice(0, -1) || '/';
          this.location.replace(rootPath + '#' + this.getPath());
          // Return immediately as browser will do redirect to new url
          return true;

        // Or if we've started out with a hash-based route, but we're currently
        // in a browser where it could be `pushState`-based instead...
        } else if (this._hasPushState && this.atRoot()) {
          this.navigate(this.getHash(), {replace: true});
        }

      }

      // Proxy an iframe to handle location events if the browser doesn't
      // support the `hashchange` event, HTML5 history, or the user wants
      // `hashChange` but not `pushState`.
      // 在IE中,无论iframe是一开始静态写在html中的还是后来用js动态创建的,都可以被写入浏览器的历史记录
      if (!this._hasHashChange && this._wantsHashChange && !this._usePushState) {
        // 如果用户使用低版本的IE浏览器, 不支持popstate和onhashchange事件
        // 向DOM中插入一个隐藏的iframe, 并通过改变和心跳监听该iframe的URL实现路由
        this.iframe = document.createElement('iframe');
        this.iframe.src = 'javascript:0';
        this.iframe.style.display = 'none';
        this.iframe.tabIndex = -1;
        var body = document.body;
        // Using `appendChild` will throw on IE < 9 if the document is not ready.
        var iWindow = body.insertBefore(this.iframe, body.firstChild).contentWindow;
        //document.open():打开一个新文档，即打开一个流，并擦除当前文档的内容。
        iWindow.document.open();
        //close()方法可关闭一个由open()方法打开的输出流，并显示选定的数据。
        iWindow.document.close();
        iWindow.location.hash = '#' + this.fragment;
      }

      // Add a cross-platform `addEventListener` shim for older browsers.
      var addEventListener = window.addEventListener || function(eventName, listener) {
        return attachEvent('on' + eventName, listener);
      };

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._usePushState) {
        //当前活动历史项(history entry)改变会触发popstate事件，这个时候显然不用在监听hashchange事件了
        addEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        //onhashchange 事件在当前 URL 的锚部分(以 '#' 号为开始) 发生改变时触发,IE8以上支持,其他浏览器支持较好
        addEventListener('hashchange', this.checkUrl, false);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }
      // 一般调用start方法时会自动调用loadUrl, 匹配当前URL片段对应的路由规则, 调用该规则的方法
      // 如果设置了silent属性为true, 则loadUrl方法不会被调用
      // 这种情况一般出现在调用了stop方法重置history对象状态后, 再次调用start方法启动(实际上此时并非为页面初始化, 因此会设置silent属性)
      if (!this.options.silent) return this.loadUrl();
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    // 停止history对路由的监控, 并将状态恢复为未监听状态
    // 调用stop方法之后, 可重新调用start方法开始监听, stop方法一般用户在调用start方法之后, 需要重新设置start方法的参数, 或用于单元测试
    stop: function() {
      // Add a cross-platform `removeEventListener` shim for older browsers.
      var removeEventListener = window.removeEventListener || function(eventName, listener) {
        return detachEvent('on' + eventName, listener);
      };

      // Remove window listeners.
      if (this._usePushState) {
        removeEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        removeEventListener('hashchange', this.checkUrl, false);
      }

      // Clean up the iframe if necessary.
      // 如果必要的话移除 iframe 元素
      if (this.iframe) {
        document.body.removeChild(this.iframe);
        this.iframe = null;
      }

      // Some environments will throw when clearing an undefined interval.
      if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
      History.started = false;
    },

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    // 向handlers中绑定一个路由规则(参数route, 类型为正则表达式)与事件(参数callback)的映射关系(该方法由Router的实例自动调用)
    route: function(route, callback) {
      // 将route和callback插入到handlers列表的第一个位置
      // 这是为了确保最后调用route时传入的规则被优先进行匹配
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    // 检查当前的URL相对上一次的状态是否发生了变化
    // 如果发生变化, 则记录新的URL状态, 并调用loadUrl方法触发新URL与匹配路由规则的方法
    // 该方法在onpopstate和onhashchange事件被触发后自动调用, 或者在低版本的IE浏览器中由setInterval心跳定时调用
    checkUrl: function(e) {
      // 获取当前的URL片段
      var current = this.getFragment();

      // If the user pressed the back button, the iframe's hash will have
      // changed and we should use that for comparison.
      // 对低版本的IE浏览器, 将从iframe中获取最新的URL片段并赋给current变量
      if (current === this.fragment && this.iframe) {
        current = this.getHash(this.iframe.contentWindow);
      }
      // 如果当前URL与上一次的状态没有发生任何变化, 则停止执行
      if (current === this.fragment) return false;
      // 执行到这里, URL已经发生改变, 调用navigate方法将URL设置为当前URL
      // 这里在自动调用navigate方法时, 并没有传递options参数, 因此不会触发navigate方法中的loadUrl方法
      if (this.iframe) this.navigate(current);
      // 调用loadUrl方法, 检查匹配的规则, 并执行规则绑定的方法
      // 如果调用this.loadUrl方法没有成功, 则试图在调用loadUrl方法时, 将重新获取的当前Hash传递给该方法
      this.loadUrl();
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    // 根据当前URL, 与handler路由列表中的规则进行匹配
    // 如果URL符合某一个规则, 则执行这个规则所对应的方法, 函数将返回true
    // 如果没有找到合适的规则, 将返回false
    // loadUrl方法一般在页面初始化时调用start方法会被自动调用(除非设置了silent参数为true)
    // - 或当用户改变URL后, 由checkUrl监听到URL发生变化时被调用
    // - 或当调用navigate方法手动导航到某个URL时被调用
    loadUrl: function(fragment) {
      // If the root doesn't match, no routes can match either.
      if (!this.matchRoot()) return false;
      // 获取当前URL片段
      fragment = this.fragment = this.getFragment(fragment);

      // underscore _.some(list, [predicate], [context]) 别名： any 如果list中有任何一个元素通过 predicate 的真值检测就返回true。一旦找到了符合条件的元素, 就直接中断对list的遍历. （注：如果存在原生的some方法，就使用原生的some。）
      return _.some(this.handlers, function(handler) {
        if (handler.route.test(fragment)) {
          handler.callback(fragment);
          return true;
        }
      });
    },

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    // 导航到指定的URL
    // 如果在options中设置了trigger, 将触发导航的URL与对应路由规则的事件
    // 如果在options中设置了replace, 将使用需要导航的URL替换当前的URL在history中的位置
    navigate: function(fragment, options) {
      // 如果没有调用start方法, 或已经调用stop方法, 则无法导航
      if (!History.started) return false;
      // 如果options参数不是一个对象, 而是true值, 则默认trigger配置项为true(即触发导航的URL与对应路由规则的事件)
      if (!options || options === true) options = {trigger: !!options};

      // Normalize the fragment.
      fragment = this.getFragment(fragment || '');

      // Don't include a trailing slash on the root.
      var rootPath = this.root;
      if (fragment === '' || fragment.charAt(0) === '?') {
        rootPath = rootPath.slice(0, -1) || '/';
      }
      var url = rootPath + fragment;

      // Strip the fragment of the query and hash for matching.
      /*
        去除#及以后的内容，注意这里的fragment并不是this.fragment，这里只是为了方便下文判断用，所以用了这么一个变量
        另外这里有两个非常值得注意的地方
          1.如果是在_usePushState情况下调用，那么这个时候哈希值实际上是不用的，所以这一步骤是没错的
          2.如果是在使用哈希值的情况下进行调用，fragment这个时候实际上已经是转换好的哈希值了，所以这一步骤并不会改变
          它什么，也不会把它变没。
      */ 
      fragment = fragment.replace(pathStripper, '');

      // Decode for matching.
      var decodedFragment = this.decodeFragment(fragment);

      // 如果没有变化，则不进行下文操作
      if (this.fragment === decodedFragment) return;
      this.fragment = decodedFragment;

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._usePushState) {
        //调用浏览器提供的history接口，可以压入或更新一条历史记录
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
      } else if (this._wantsHashChange) {
        this._updateHash(this.location, fragment, options.replace);
        if (this.iframe && fragment !== this.getHash(this.iframe.contentWindow)) {
          var iWindow = this.iframe.contentWindow;

          // Opening and closing the iframe tricks IE7 and earlier to push a
          // history entry on hash-tag change.  When replace is true, we don't
          // want this.
          // 在IE7及以下的情况通过这种方式写入历史记录
          // 如果使用了replace参数替换当前URL, 则直接将iframe替换为新的文档
          // 调用document.open打开一个新的文档, 以擦除当前文档中的内容(这里调用close方法是为了关闭文档的状态)
          // open和close方法之间没有使用write或writeln方法输出内容, 因此这是一个空文档
          if (!options.replace) {
            iWindow.document.open();
            iWindow.document.close();
          }
          // 调用_updateHash方法更新iframe中的URL
          this._updateHash(iWindow.location, fragment, options.replace);
        }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else {
        // 如果在调用start方法时, 手动设置hashChange参数为true, 不希望使用pushState和hash方式导航
        // 则直接将页面跳转到新的URL
        return this.location.assign(url);
      }
      // 如果在options配置项中设置了trigger属性, 则调用loadUrl方法查找路由规则, 并执行规则对应的事件
      // 在URL发生变化时, 通过checkUrl方法监听到的状态, 会在checkUrl方法中自动调用loadUrl方法
      // 在手动调用navigate方法时, 如果需要触发路由事件, 则需要传递trigger参数
      if (options.trigger) return this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    // 更新或设置当前URL中的Has串, _updateHash方法在使用hash方式导航时被自动调用(navigate方法中)
    // location是需要更新hash的window.location对象
    // fragment是需要更新的hash串
    // 如果需要将新的hash替换到当前URL, 可以设置replace为true
    _updateHash: function(location, fragment, replace) {
      // 如果设置了replace为true, 则使用location.replace方法替换当前的URL
      // 使用replace方法替换URL后, 新的URL将占有原有URL在history历史中的位置
      if (replace) {
        // 将当前URL与hash组合为一个完整的URL并替换
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        // 没有使用替换方式, 直接设置location.hash为新的hash串
        location.hash = '#' + fragment;
      }
    }

  });

  // Create the default Backbone.history.
  Backbone.history = new History;

  // Helpers 定义一些供Backbone内部使用的帮助函数
  // -------

  // Helper function to correctly set up the prototype chain for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  /*
    这个extend是一个help函数,却是一个我们用的非常多的函数,这个函数其实其中有很多的学问在里面,也是backbone重中之重的函数
    这个函数并没有直接将属性assign到parent上面(this),是因为这样会产生一个显著的问题:污染原型
    所以实际上backbone的做法是新建了一个子对象,这个子对象承担着所有内容.
    而backbone的这种设计也注定了其和ES6的class并不能很好的共存
  */
  var extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent constructor.
    // 这个constructor可以自己写，也可以继承原型的构造，这是典型的ES6的class的套路
    // 如果在protoProps中指定了"constructor"属性, 则"constructor"属性被作为子类的构造函数
    // 如果没有指定构造子类构造函数, 则默认调用父类的构造函数
    if (protoProps && _.has(protoProps, 'constructor')) {
      // 使用"constructor"属性指定的子类构造函数
      child = protoProps.constructor;
    } else {
      // 使用父类的构造函数
      child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    // 将父类中的静态属性复制为子类静态属性
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function and add the prototype properties.
    // 将父类原型链设置到子类的原型对象中, 子类以此继承父类原型链中的所有属性
    child.prototype = _.create(parent.prototype, protoProps);
    child.prototype.constructor = child;

    // Set a convenience property in case the parent's prototype is needed
    // later.
    // 提供一个访问父类原型的方式
    // 如果子类设置了constructor属性, 则子类构造函数为constructor指定的函数
    // 如果需要在子类构造函数中调用父类构造函数, 则需要在子类构造函数中手动调用父类的构造函数
    // 此处将子类的__super__属性指向父类的构造函数, 方便在子类中调用: 子类.__super__.constructor.call(this);
    child.__super__ = parent.prototype;

    // 返回子类
    return child;
  };

  // Set up inheritance for the model, collection, router, view and history.
  // 所有的上述定义类都用到了这个helper 函数
  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

  // Throw an error when a URL is needed, and none is supplied.
  // 未指定url错误，如果使用了和服务器交互的方法并且model或者collection都没有获取到url的时候会产生这个错误
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // Wrap an optional error callback with a fallback error event.
  // 包装错误的函数,非常典型的设计模式中的装饰者模式,这里增加了一个触发
  var wrapError = function(model, options) {
    var error = options.error;
    options.error = function(resp) {
      if (error) error.call(options.context, model, resp, options);
      model.trigger('error', model, resp, options);
    };
  };

  return Backbone;
});
