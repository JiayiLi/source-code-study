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
  // 当然，Backbone自身也用了，所以这个Events的实现是放在前面的。
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
  // 用于在监听器和监听器之间共享的私有全局变量。
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

      // 递归 循环 所有的 key,也就是所有的事件 event，即最后成为 标准形式的迭代
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
    this._events = eventsApi(onApi, this._events || {}, name, callback, {
      context: context,
      ctx: this,
      listening: _listening
    });

    // ?????
    // 如果  object 正在监听某某对象的话???? 如果是通过listenTo 监听调用的。
    // listening用于监听对象。
    if (_listening) {
      // 定义变量 listener，赋值 this._listeners ；
      var listeners = this._listeners || (this._listeners = {});
      // 将上文定义的私有全局变量_listening 赋值给 listeners[_listening.id];
      listeners[_listening.id] = _listening;
      // Allow the listening to use a counter, instead of tracking
      // callbacks for library interop
      //
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

    // 定义变量 listeningTo 存放监听的对象的信息，相当于例子1种的b，赋值为 this._listeningTo 或者 {}
    // this._listeningTo存放当前对象的所有的监听对象事件,按照键值对存储
    var listeningTo = this._listeningTo || (this._listeningTo = {});

    // 正在监听的对象的id，例子1中的A的listening正在监听 listeningTo[id]。
    var listening = _listening = listeningTo[id];

    // This object is not listening to any other events on `obj` yet.
    // Setup the necessary references to track the listening callbacks.
    // 如果当前 object 还没有监听 obj 上的任何其他事件，则 设置必要的参数，来跟踪监听回调。
    if (!listening) {
      // 生成 例子中的B 的id: _listenId
      this._listenId || (this._listenId = _.uniqueId('l'));
      // 生成 listening 和 _listening 还有 listeningTo[id]
      listening = _listening = listeningTo[id] = new Listening(this, obj);
    }

    // Bind callbacks on obj.
    // 在obj 上绑定回调
    //
    // tryCatchOn：一个try-catch保护on函数，以防止污染全局`_listening`变量。
    // 在obj 上绑定回调绑定函数，如果不对就报错
    var error = tryCatchOn(obj, name, callback, this);
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
      // todo
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
  // 如果没有任何参数，off相当于把对应的_events对象整体清空，删除所有事件的所有绑定回调；
  // 如果有name参数但是没有具体指定哪个callback的时候，则把这个name(事件)对应的回调队列全部清空；
  // 如果还有进一步详细的callback和context，那么这个时候移除回调函数非常严格，必须要求上下文和原来函数完全一致；
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
    clone: function() {
      return new this.constructor(this.models, {
        model: this.model,
        comparator: this.comparator
      });
    },

    // Define how to uniquely identify models in the collection.
    modelId: function(attrs) {
      return attrs[this.model.prototype.idAttribute || 'id'];
    },

    // Get an iterator of all models in this collection.
    values: function() {
      return new CollectionIterator(this, ITERATOR_VALUES);
    },

    // Get an iterator of all model IDs in this collection.
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
    _addReference: function(model, options) {
      this._byId[model.cid] = model;
      var id = this.modelId(model.attributes);
      if (id != null) this._byId[id] = model;
      model.on('all', this._onModelEvent, this);
    },

    // Internal method to sever a model's ties to a collection.
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
  /* global Symbol */
  var $$iterator = typeof Symbol === 'function' && Symbol.iterator;
  if ($$iterator) {
    Collection.prototype[$$iterator] = Collection.prototype.values;
  }

  // CollectionIterator
  // ------------------

  // A CollectionIterator implements JavaScript's Iterator protocol, allowing the
  // use of `for of` loops in modern browsers and interoperation between
  // Backbone.Collection and other JavaScript functions and third-party libraries
  // which can operate on Iterables.
  var CollectionIterator = function(collection, kind) {
    this._collection = collection;
    this._kind = kind;
    this._index = 0;
  };

  // This "enum" defines the three possible kinds of values which can be emitted
  // by a CollectionIterator that correspond to the values(), keys() and entries()
  // methods on Collection, respectively.
  var ITERATOR_VALUES = 1;
  var ITERATOR_KEYS = 2;
  var ITERATOR_KEYSVALUES = 3;

  // All Iterators should themselves be Iterable.
  if ($$iterator) {
    CollectionIterator.prototype[$$iterator] = function() {
      return this;
    };
  }

  CollectionIterator.prototype.next = function() {
    if (this._collection) {

      // Only continue iterating if the iterated collection is long enough.
      if (this._index < this._collection.length) {
        var model = this._collection.at(this._index);
        this._index++;

        // Construct a value depending on what kind of values should be iterated.
        var value;
        if (this._kind === ITERATOR_VALUES) {
          value = model;
        } else {
          var id = this._collection.modelId(model.attributes);
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
    // 设置或创建视图中的元素
    this._ensureElement();
    // 调用自定义的初始化方法
    this.initialize.apply(this, arguments);
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be set as properties.
  // 要设置为属性的视图选项列表。
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
    delegateEvents: function(events) {
      events || (events = _.result(this, 'events'));
      if (!events) return this;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[method];
        if (!method) continue;
        var match = key.match(delegateEventSplitter);
        this.delegate(match[1], match[2], _.bind(method, this));
      }
      return this;
    },

    // Add a single event listener to the view's element (or a child element
    // using `selector`). This only works for delegate-able events: not `focus`,
    // `blur`, and not `change`, `submit`, and `reset` in Internet Explorer.
    delegate: function(eventName, selector, listener) {
      this.$el.on(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Clears all callbacks previously bound to the view by `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    undelegateEvents: function() {
      if (this.$el) this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // A finer-grained `undelegateEvents` for removing a single delegated event.
    // `selector` and `listener` are both optional.
    undelegate: function(eventName, selector, listener) {
      this.$el.off(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Produces a DOM element to be assigned to your view. Exposed for
    // subclasses using an alternative DOM manipulation API.
    _createElement: function(tagName) {
      return document.createElement(tagName);
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    _ensureElement: function() {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, 'attributes'));
        if (this.id) attrs.id = _.result(this, 'id');
        if (this.className) attrs['class'] = _.result(this, 'className');
        this.setElement(this._createElement(_.result(this, 'tagName')));
        this._setAttributes(attrs);
      } else {
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
  //
  // collection.filter(function(model) { return model.get('age') > 10 });
  // collection.each(this.addView);
  //
  // `Function#apply` can be slow so we use the method's arg count, if we know it.
  var addMethod = function(base, length, method, attribute) {
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
  var cb = function(iteratee, instance) {
    if (_.isFunction(iteratee)) return iteratee;
    if (_.isObject(iteratee) && !instance._isModel(iteratee)) return modelMatcher(iteratee);
    if (_.isString(iteratee)) return function(model) { return model.get(iteratee); };
    return iteratee;
  };
  var modelMatcher = function(attrs) {
    var matcher = _.matches(attrs);
    return function(model) {
      return matcher(model.attributes);
    };
  };

  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of Backbone Collections is actually implemented
  // right here:
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
  var modelMethods = {keys: 1, values: 1, pairs: 1, invert: 1, pick: 0,
      omit: 0, chain: 1, isEmpty: 1};

  // Mix in each Underscore method as a proxy to `Collection#models`.

  _.each([
    [Collection, collectionMethods, 'models'],
    [Model, modelMethods, 'attributes']
  ], function(config) {
    var Base = config[0],
        methods = config[1],
        attribute = config[2];

    Base.mixin = function(obj) {
      var mappings = _.reduce(_.functions(obj), function(memo, name) {
        memo[name] = 0;
        return memo;
      }, {});
      addUnderscoreMethods(Base, obj, mappings, attribute);
    };

    addUnderscoreMethods(Base, _, methods, attribute);
  });

  // Backbone.sync
  // -------------

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
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
  Backbone.sync = function(method, model, options) {
    var type = methodMap[method];

    // Default options, unless specified.
    _.defaults(options || (options = {}), {
      emulateHTTP: Backbone.emulateHTTP,
      emulateJSON: Backbone.emulateJSON
    });

    // Default JSON-request options.
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    if (!options.url) {
      params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    if (options.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
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
    if (params.type !== 'GET' && !options.emulateJSON) {
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
    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
  };

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch': 'PATCH',
    'delete': 'DELETE',
    'read': 'GET'
  };

  // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
  // Override this if you'd like to use a different library.
  Backbone.ajax = function() {
    return Backbone.$.ajax.apply(Backbone.$, arguments);
  };

  // Backbone.Router
  // ---------------

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    this.preinitialize.apply(this, arguments);
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  var optionalParam = /\((.*?)\)/g;
  var namedParam    = /(\(\?)?:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

  // Set up all inheritable **Backbone.Router** properties and methods.
  _.extend(Router.prototype, Events, {

    // preinitialize is an empty function by default. You can override it with a function
    // or object.  preinitialize will run before any instantiation logic is run in the Router.
    preinitialize: function(){},

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    //
    route: function(route, name, callback) {
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (_.isFunction(name)) {
        callback = name;
        name = '';
      }
      if (!callback) callback = this[name];
      var router = this;
      Backbone.history.route(route, function(fragment) {
        var args = router._extractParameters(route, fragment);
        if (router.execute(callback, args, name) !== false) {
          router.trigger.apply(router, ['route:' + name].concat(args));
          router.trigger('route', name, args);
          Backbone.history.trigger('route', router, name, args);
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
    navigate: function(fragment, options) {
      Backbone.history.navigate(fragment, options);
      return this;
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    _bindRoutes: function() {
      if (!this.routes) return;
      this.routes = _.result(this, 'routes');
      var route, routes = _.keys(this.routes);
      while ((route = routes.pop()) != null) {
        this.route(route, this.routes[route]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    _routeToRegExp: function(route) {
      route = route.replace(escapeRegExp, '\\$&')
                   .replace(optionalParam, '(?:$1)?')
                   .replace(namedParam, function(match, optional) {
                     return optional ? match : '([^/?]+)';
                   })
                   .replace(splatParam, '([^?]*?)');
      return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted decoded parameters. Empty or unmatched parameters will be
    // treated as `null` to normalize cross-browser behavior.
    _extractParameters: function(route, fragment) {
      var params = route.exec(fragment).slice(1);
      return _.map(params, function(param, i) {
        // Don't decode the search params.
        if (i === params.length - 1) return param || null;
        return param ? decodeURIComponent(param) : null;
      });
    }

  });

  // Backbone.History
  // ----------------

  // Handles cross-browser history management, based on either
  // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
  // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
  // and URL fragments. If the browser supports neither (old IE, natch),
  // falls back to polling.
  var History = Backbone.History = function() {
    this.handlers = [];
    this.checkUrl = _.bind(this.checkUrl, this);

    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  };

  // Cached regex for stripping a leading hash/slash and trailing space.
  var routeStripper = /^[#\/]|\s+$/g;

  // Cached regex for stripping leading and trailing slashes.
  var rootStripper = /^\/+|\/+$/g;

  // Cached regex for stripping urls of hash.
  var pathStripper = /#.*$/;

  // Has the history handling already been started?
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    interval: 50,

    // Are we at the app root?
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
    decodeFragment: function(fragment) {
      return decodeURI(fragment.replace(/%25/g, '%2525'));
    },

    // In IE6, the hash fragment and search params are incorrect if the
    // fragment contains `?`.
    getSearch: function() {
      var match = this.location.href.replace(/#.*/, '').match(/\?.+/);
      return match ? match[0] : '';
    },

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    getHash: function(window) {
      var match = (window || this).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the pathname and search params, without the root.
    getPath: function() {
      var path = this.decodeFragment(
        this.location.pathname + this.getSearch()
      ).slice(this.root.length - 1);
      return path.charAt(0) === '/' ? path.slice(1) : path;
    },

    // Get the cross-browser normalized URL fragment from the path or hash.
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
    start: function(options) {
      if (History.started) throw new Error('Backbone.history has already been started');
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      this.options          = _.extend({root: '/'}, this.options, options);
      this.root             = this.options.root;
      this._wantsHashChange = this.options.hashChange !== false;
      this._hasHashChange   = 'onhashchange' in window && (document.documentMode === void 0 || document.documentMode > 7);
      this._useHashChange   = this._wantsHashChange && this._hasHashChange;
      this._wantsPushState  = !!this.options.pushState;
      this._hasPushState    = !!(this.history && this.history.pushState);
      this._usePushState    = this._wantsPushState && this._hasPushState;
      this.fragment         = this.getFragment();

      // Normalize root to always include a leading and trailing slash.
      this.root = ('/' + this.root + '/').replace(rootStripper, '/');

      // Transition from hashChange to pushState or vice versa if both are
      // requested.
      if (this._wantsHashChange && this._wantsPushState) {

        // If we've started off with a route from a `pushState`-enabled
        // browser, but we're currently in a browser that doesn't support it...
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
      if (!this._hasHashChange && this._wantsHashChange && !this._usePushState) {
        this.iframe = document.createElement('iframe');
        this.iframe.src = 'javascript:0';
        this.iframe.style.display = 'none';
        this.iframe.tabIndex = -1;
        var body = document.body;
        // Using `appendChild` will throw on IE < 9 if the document is not ready.
        var iWindow = body.insertBefore(this.iframe, body.firstChild).contentWindow;
        iWindow.document.open();
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
        addEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        addEventListener('hashchange', this.checkUrl, false);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      if (!this.options.silent) return this.loadUrl();
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
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
    route: function(route, callback) {
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    checkUrl: function(e) {
      var current = this.getFragment();

      // If the user pressed the back button, the iframe's hash will have
      // changed and we should use that for comparison.
      if (current === this.fragment && this.iframe) {
        current = this.getHash(this.iframe.contentWindow);
      }

      if (current === this.fragment) return false;
      if (this.iframe) this.navigate(current);
      this.loadUrl();
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    loadUrl: function(fragment) {
      // If the root doesn't match, no routes can match either.
      if (!this.matchRoot()) return false;
      fragment = this.fragment = this.getFragment(fragment);
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
    navigate: function(fragment, options) {
      if (!History.started) return false;
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
      fragment = fragment.replace(pathStripper, '');

      // Decode for matching.
      var decodedFragment = this.decodeFragment(fragment);

      if (this.fragment === decodedFragment) return;
      this.fragment = decodedFragment;

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._usePushState) {
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
          if (!options.replace) {
            iWindow.document.open();
            iWindow.document.close();
          }

          this._updateHash(iWindow.location, fragment, options.replace);
        }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    _updateHash: function(location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        location.hash = '#' + fragment;
      }
    }

  });

  // Create the default Backbone.history.
  Backbone.history = new History;

  // Helpers
  // -------

  // Helper function to correctly set up the prototype chain for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function and add the prototype properties.
    child.prototype = _.create(parent.prototype, protoProps);
    child.prototype.constructor = child;

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Set up inheritance for the model, collection, router, view and history.
  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

  // Throw an error when a URL is needed, and none is supplied.
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // Wrap an optional error callback with a fallback error event.
  var wrapError = function(model, options) {
    var error = options.error;
    options.error = function(resp) {
      if (error) error.call(options.context, model, resp, options);
      model.trigger('error', model, resp, options);
    };
  };

  return Backbone;
});
