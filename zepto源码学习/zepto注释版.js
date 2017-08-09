//     Zepto.js
//     (c) 2010-2017 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.
//     
//     内容引用于：
//     Zepto 源码全剖析 地址：https://zhangxiang958.github.io/2017/02/16/Zepto%20%E6%BA%90%E7%A0%81%E5%85%A8%E5%89%96%E6%9E%90/
//     zepto对象思想与源码分析  地址:https://www.kancloud.cn/wangfupeng/zepto-design-srouce/173692
//     以及英文原文注释翻译

var Zepto = (function() {

  // 变量初始化
  var undefined, key, $, classList, emptyArray = [], concat = emptyArray.concat, filter = emptyArray.filter, slice = emptyArray.slice,
    document = window.document,
    elementDisplay = {}, classCache = {},
    cssNumber = { 'column-count': 1, 'columns': 1, 'font-weight': 1, 'line-height': 1,'opacity': 1, 'z-index': 1, 'zoom': 1 },

    // 检测正则
    // 取出html代码中第一个html标签（或注释），如取出 <p>123</p><h1>345</h1> 中的 <p>
    fragmentRE = /^\s*<(\w+|!)[^>]*>/,
    // 匹配非嵌套标签，如<div><p></p></div>就不会被匹配，注意?:用来关闭捕获
    // 可以匹配<br>, <br />, <h3></h3>
    singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
    
    // 匹配自闭合标签
    // 将 <p/>或<p />，替换为 <p></p>，将<p abc/>替换为<p>abc</p> 但 <input/> （在 tagExpanderRE 中定义）的不替换
    tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
    // body html
    rootNodeRE = /^(?:body|html)$/i,
    // 大写字母
    capitalRE = /([A-Z])/g,

    // special attributes that should be get/set via method calls
    // 应该通过方法调用来设置/获取的特殊属性
    methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],

    adjacencyOperators = [ 'after', 'prepend', 'before', 'append' ],
    table = document.createElement('table'),
    tableRow = document.createElement('tr'),
    // 指定特殊元素的 容器
    containers = {
      'tr': document.createElement('tbody'),
      'tbody': table, 'thead': table, 'tfoot': table,
      'td': tableRow, 'th': tableRow,
      '*': document.createElement('div')
    },
    // 匹配一个包括（字母、数组、下划线、-）的字符串
    simpleSelectorRE = /^[\w-]*$/,
    class2type = {},
    toString = class2type.toString,
    zepto = {},
    camelize, uniq,
    tempParent = document.createElement('div'),
    propMap = {
      'tabindex': 'tabIndex',
      'readonly': 'readOnly',
      'for': 'htmlFor',
      'class': 'className',
      'maxlength': 'maxLength',
      'cellspacing': 'cellSpacing',
      'cellpadding': 'cellPadding',
      'rowspan': 'rowSpan',
      'colspan': 'colSpan',
      'usemap': 'useMap',
      'frameborder': 'frameBorder',
      'contenteditable': 'contentEditable'
    },
    // 判断是否是arr
    isArray = Array.isArray ||
      function(object){ return object instanceof Array }

  // 判断 element 是否符合 selector 的要求
  zepto.matches = function(element, selector) {
    // 判断是否为dom元素节点，nodeType 属性 值为1;
    // 当值为2时，为属性节点。
    if (!selector || !element || element.nodeType !== 1) return false
//   <div id="foo">This is the element!</div>
//   <script type="text/javascript">
//     var el = document.getElementById("foo");
//     if (el.matches("div")) {
//       alert("Match!");
//     }
//   </script>
//   详细了解
//   https://developer.mozilla.org/zh-CN/docs/Web/API/Element/matches
    var matchesSelector = element.matches || element.webkitMatchesSelector ||
                          element.mozMatchesSelector || element.oMatchesSelector ||
                          element.matchesSelector
    if (matchesSelector) return matchesSelector.call(element, selector)
    // fall back to performing a selector:
    // 如果浏览器不支持 matchesSelector 
    // 如果有父节点，temp ＝ false.
    var match, parent = element.parentNode, temp = !parent
    // 如果没有父节点，则 将tempParent当作父节点 （tempParent 头部定义为div），然后将当前元素加入到这个div中
    if (temp) (parent = tempParent).appendChild(element)

    // ~按位取反运算符 
    // 使用按位取反运算符原因： indexOf 返回－1 表示没有匹配，返回 >= 0 表示匹配，
    // 而 boolean(0) = false ,
    // console.log(~-1); // 0
    // console.log(~0) // -1
    // console.log(~1) // -2
    // 这样如果没有找到该元素，都会返回 －1 经过 按位取反运算符 之后为 0
    // 当 match  = 0 即 false 表示没有匹配
    // 当 match  等于其它值，即 true ，表示成功匹配
    match = ~zepto.qsa(parent, selector).indexOf(element)
    // 如果没有 父节点，就执行 tempParent 移除当前元素，因为前面把当前元素加入到这个tempParent中
    temp && tempParent.removeChild(element)

    // 返回～zepto.qsa的结果
    return match
  }

  // 在代码中部，执行了
  // $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
  //   class2type[ "[object " + name + "]" ] = name.toLowerCase()
  // })
  // 用来给 class2type 对象赋值
  //
  //type 用来判断类型
  function type(obj) {
    return obj == null ? String(obj) :
      [toString.call(obj)] || "object"
  }

  // 判断是否是函数
  function isFunction(value) { return type(value) == "function" }

  // 判断是否是 window对象（注意，w为小写）指当前的浏览器窗口，window对象的window属性指向自身。
  // 即 window.window === window
  function isWindow(obj)     { return obj != null && obj == obj.window }
  
  // 判断是否是 document 对象
  // window.document.nodeType == 9 数字表示为9，常量表示为 DOCUMENT_NODE 
  function isDocument(obj)   { return obj != null && obj.nodeType == obj.DOCUMENT_NODE }

  // 判断是否是 object
  function isObject(obj)     { return type(obj) == "object" }

  // 判断是否是最基本的 object：Object.getPrototypeOf(obj) == Object.prototype
  // Object.getPrototypeOf() 方法返回指定对象的原型（即, 内部[[Prototype]]属性的值）
  // getPrototypeOf 和 prototype 的区别：
  // getPrototypeOf是个function，而 prototype 是个属性
  // eg: 
  // function MyConstructor() {}
  // var obj = new MyConstructor()
  // Object.getPrototypeOf(obj) === Object.prototype // false
  // var t = {c:"heihei"};
  // Object.getPrototypeOf(t) === Object.prototype // true
  function isPlainObject(obj) {
    return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype
  }
  // 判断是否是数组或者对象数组
  function likeArray(obj) {
    var length = !!obj && 'length' in obj && obj.length,
      type = $.type(obj)

    return 'function' != type && !isWindow(obj) && (
      'array' == type || length === 0 ||
        (typeof length == 'number' && length > 0 && (length - 1) in obj)
    )
  }

  // 筛选数组，踢出 null undefined 元素
  function compact(array) { return filter.call(array, function(item){ return item != null }) }
  // $.fn.concat 在下文中定义
  // $.fn = {
  //      ......
  //  concat: function(){
  //    var i, value, args = []
  //    for (i = 0; i < arguments.length; i++) {
  //      value = arguments[i]
  //      args[i] = zepto.isZ(value) ? value.toArray() : value
  //    }
  //    return concat.apply(zepto.isZ(this) ? this.toArray() : this, args)
  //  },
  //      ......
  // }
  // 
  // ???????
  function flatten(array) { return array.length > 0 ? $.fn.concat.apply([], array) : array }

  // 用于 css 的 camalCase 转换，例如 background-color 转换为 backgroundColor
  camelize = function(str){ return str.replace(/-+(.)?/g, function(match, chr){ return chr ? chr.toUpperCase() : '' }) }

  // 将 backgroundColor 转换为 background-color 格式
  function dasherize(str) {
    return str.replace(/::/g, '/')
           .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
           .replace(/([a-z\d])([A-Z])/g, '$1_$2')
           .replace(/_/g, '-')
           .toLowerCase()
  }

  // 数组去重  eg:[1,1,2,3,3] 替换为 [1,2,3]
  uniq = function(array){ return filter.call(array, function(item, idx){ return array.indexOf(item) == idx }) }

  // classCache 存储的数据是这样的：
  // {
  //   abc: /(^|\s)abc(\s|$)/,  // 能匹配 'abc' 或 ' abc ' 或 ' abc' 或 'abc '
  //   xyz: /(^|\s)abc(\s|$)/,
  //   ...
  // }
  function classRE(name) {
    return name in classCache ?
      classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
  }

  // 传入一个 css 的 name 和 value，判断这个 value 是否需要增加 'px'
  function maybeAddPx(name, value) {
    //dasherize(name) 将 backgroundColor 转换为 background-color 格式
    return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
  }

  // 获取一个元素的默认 display 样式值，可能的结果是：inline block inline-block table .... （none 转换为 block）
  function defaultDisplay(nodeName) {
    var element, display
    if (!elementDisplay[nodeName]) {
      // 如果 elementDisplay 对象中，没有存储 nodeName 的信息
      // 则新建一个 nodeName 元素，添加到 body 中
      element = document.createElement(nodeName)
      document.body.appendChild(element)
      // 获取它的默认的 display 样式信息
      // jQuery的CSS()方法，其底层运作就应用了getComputedStyle以及getPropertyValue方法
      // 具体了解：http://www.zhangxinxu.com/wordpress/2012/05/getcomputedstyle-js-getpropertyvalue-currentstyle/
      // getComputedStyle是一个可以获取当前元素所有最终使用的CSS属性值
      //  eg: var dom = document.getElementById("test"),
      //      style = window.getComputedStyle(dom , ":after");
      // getComputedStyle方法是只读的，只能获取样式，不能设置,两个参数,第二个参数“伪类”是必需的（如果不是伪类，设置为null
      // getPropertyValue方法可以获取CSS样式申明对象上的属性值（直接属性名称）
      display = getComputedStyle(element, '').getPropertyValue("display")
      // 接着马上移除元素
      element.parentNode.removeChild(element)
      // 如果是'none' 则换成 'block'
      display == "none" && (display = "block")

      // 存储
      elementDisplay[nodeName] = display
    }
    return elementDisplay[nodeName]
  }

  //返回一个元素的子元素，数组形式
  function children(element) {
    // 有些浏览器支持 elem.children 获取子元素，有些不支持
    return 'children' in element ?
      slice.call(element.children) :
      // 浏览器不支持 elem.children 只能通过 elem.childNodes 获取子元素，nodeType=1为dom元素节点
      // $.map 下文定义的
      $.map(element.childNodes, function(node){ if (node.nodeType == 1) return node })
  }

  // 构造函数 ，在 zepto.Z 中被使用
  function Z(dom, selector) {
    var i, len = dom ? dom.length : 0
    for (i = 0; i < len; i++) this[i] = dom[i]
    this.length = len
    this.selector = selector || ''
  }

  // `$.zepto.fragment` takes a html string and an optional tag name
  // to generate DOM nodes from the given html string.
  // The generated DOM nodes are returned as an array.
  // This function can be overridden in plugins for example to make
  // it compatible with browsers that don't support the DOM fully.
  // `$.zepto.fragment`需要一个html字符串和一个可选标记名来生成dom
  // 产生的dom返回一个数组形式
  // 该功能可以被插件覆盖
  // 没有覆盖所有浏览器
  //
  //  参数：
  // html: 待处理的html字符串
  // name: 通过 name 可在 containers 中查找容器节点，如果不传入，取得的容器默认为 div
  // properties: 节点属性对象
  zepto.fragment = function(html, name, properties) {
    var dom, nodes, container

    // A special case optimization for a single tag
    // singleTagRE 头部定义正则 匹配非嵌套标签
    // RegExp.$1 表示正则中的第一个括号匹配的内容，在此即 (\w+)对应的tag名称。
    // RegExp.$1 在模式匹配期间找到的，所存储的最近的1个部分。只读。全局对象RegExp会在每次成功匹配一个带括号的分组时，将匹配成功的结果存储起来。每当产生一个带括号的成功匹配时，$1…$9 属性的值就被修改。 可以在一个正则表达式模式中指定任意多个带括号的子匹配，但只能存储最新的九个。
    // 
    // 如果 html 是单标签，则直接用该标签创建元素
    if (singleTagRE.test(html)) dom = $(document.createElement(RegExp.$1))

    // 如果不是单标签
    if (!dom) {
      // replace() 方法用于在字符串中用一些字符替换另一些字符，或替换一个与正则表达式匹配的子串。
      // 
      // 如果有replace 方法 
      // 将 <p/>或<p />，替换为 <p></p>，将<p abc/>替换为<p>abc</p>
      if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")

      // 如果 name 未传入，则赋值为 html 的第一个标签
      // fragmentRE 头部定义正则 用于取出html代码中第一个html标签（或注释）
      if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
      // containers 头部定义
      // 指定特殊元素的 容器
      // containers = {
      //   'tr': document.createElement('tbody'),
      //   'tbody': table, 'thead': table, 'tfoot': table,
      //   'td': tableRow, 'th': tableRow,
      //   '*': document.createElement('div')
      // },
      if (!(name in containers)) name = '*'

      // 生成容器 及其 子元素
      container = containers[name]
      container.innerHTML = '' + html  // 转变为字符串的快捷方式
      // 遍历 container 的子元素（先转换为数组形式）
      // 返回赋值给dom的同时，将container中的每个子元素移除。
      dom = $.each(slice.call(container.childNodes), function(){
        container.removeChild(this)
      })
    }

    // isPlainObject 之前定义的方法 用于判断是否是最基本的 object
    if (isPlainObject(properties)) {
      // 先将dom转换为 zepto 对象
      nodes = $(dom)

      // methodAttributes 头部定义 methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset']
      // 满足 methodAttributes 的，通过调用Zepto的方法赋值，否则通过 nodes.attr(key, value) // 否则，通过属性复制
      $.each(properties, function(key, value) {
        if (methodAttributes.indexOf(key) > -1) nodes[key](value)
        else nodes.attr(key, value)
      })
    }

    // 最终返回的dom可能有两种形式
    // 第一，如果 html 是单标签，则dom被复制为一个zepto对象 dom = $(document.createElement(RegExp.$1))
    // 第二，如果 html 不是单标签，则dom被复制为一个DOM节点的数组
    return dom
  }

  // `$.zepto.Z` swaps out the prototype of the given `dom` array
  // of nodes with `$.fn` and thus supplying all the Zepto functions
  // to the array. This method can be overridden in plugins.
  // 返回的是函数 Z 的一个实例
  zepto.Z = function(dom, selector) {
    return new Z(dom, selector)
  }

  // `$.zepto.isZ` should return `true` if the given object is a Zepto
  // collection. This method can be overridden in plugins.
  // 判断 object 否是 zepto.Z 的实例
  zepto.isZ = function(object) {
    return object instanceof zepto.Z
  }

  // `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
  // takes a CSS selector and an optional context (and handles various
  // special cases).
  // This method can be overridden in plugins.
  zepto.init = function(selector, context) {
    var dom
    // If nothing given, return an empty Zepto collection
    // 未传参，返回空Zepto对象
    if (!selector) return zepto.Z()
    // Optimize for string selectors
    // selector是字符串
    else if (typeof selector == 'string') {
      // 字符串的情况，一般有两种：
      // 第一，一段 html 代码，旨在通过zepto生成dom对象
      // 第二，一段查询字符串，旨在通过zepto查找dom对象
      // 将查询结果存储到 dom 变量中
      // 有 context 则查找，没有context 则为生成dom


      //去前后空格
      selector = selector.trim()
      // If it's a html fragment, create nodes from it
      // Note: In both Chrome 21 and Firefox 15, DOM error 12
      // is thrown if the fragment doesn't begin with <
      if (selector[0] == '<' && fragmentRE.test(selector))
        // RegExp.$1取出来的就是第一个标签名称，即正则中 (\w+|!) 对应的内容
        
        //调用zepto.fragment生成dom
        dom = zepto.fragment(selector, RegExp.$1, context), selector = null // 及时清空 selector 不妨碍下面的判断
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      // 如果传递了上下文context，在上下文中查找元素
      else if (context !== undefined) return $(context).find(selector)
      // If it's a CSS selector, use it to select nodes.
      // 如果是css选择器，调用zepto.qsa进行查找
      else dom = zepto.qsa(document, selector)
    }
    // If a function is given, call it when the DOM is ready
    // 如果选择器是个 function ,则调用 ready()方法
    else if (isFunction(selector)) return $(document).ready(selector)
    // If a Zepto collection is given, just return it
    // 如果选择器本身就是 zepto 实例,则直接返回
    else if (zepto.isZ(selector)) return selector
    // 如果都不是
    else {
      // normalize array if an array of nodes is given
      // 如果给的是数组，则先筛选出数组中为 null和undefined的元素
      if (isArray(selector)) dom = compact(selector)
      // Wrap DOM nodes.
      // 如果是object，直接强制塞进一个数组
      else if (isObject(selector))
        dom = [selector], selector = null
      // If it's a html fragment, create nodes from it
      // 如果是代码片段，调用zepto.fragment生成dom
      else if (fragmentRE.test(selector))
        dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null // 及时清空 selector 不妨碍下面的判断
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      // 如果传递了上下文context，在上下文中查找元素
      else if (context !== undefined) return $(context).find(selector)
      // And last but no least, if it's a CSS selector, use it to select nodes.
      // 如果是css选择器，调用zepto.qsa进行查找
      else dom = zepto.qsa(document, selector)
    }
    // create a new Zepto collection from the nodes found
    // 最终通过 zepto.Z 创建了对象
    return zepto.Z(dom, selector)
  }

  // `$` will be the base `Zepto` object. When calling this
  // function just call `$.zepto.init, which makes the implementation
  // details of selecting nodes and creating Zepto collections
  // patchable in plugins.
  // $(a) 返回 zepto 实例
  $ = function(selector, context){
    return zepto.init(selector, context)
  }

  //内部方法：用户合并一个或多个对象到第一个对象
  //参数：  
  // target 目标对象  对象都合并到target里
  // source 合并对象
  // deep 是否执行深度合并
  function extend(target, source, deep) {
    for (key in source)
      if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
        // source[key] 是对象，而 target[key] 不是对象， 则 target[key] = {} 初始化一下，否则递归会出错的
        if (isPlainObject(source[key]) && !isPlainObject(target[key]))
          target[key] = {}

        // source[key] 是数组，而 target[key] 不是数组，则 target[key] = [] 初始化一下，否则递归会出错的
        if (isArray(source[key]) && !isArray(target[key]))
          target[key] = []
        // 执行递归
        extend(target[key], source[key], deep)
      }
      // 不满足以上条件，说明 source[key] 是一般的值类型，直接赋值给 target 就是了
      else if (source[key] !== undefined) target[key] = source[key]
  }

  // Copy all but undefined properties from one or more
  // objects to the `target` object.
  $.extend = function(target){
    var deep, args = slice.call(arguments, 1)

    //第一个参数为boolean值时，表示是否深度合并
    if (typeof target == 'boolean') {
      deep = target
      //target取第二个参数
      target = args.shift()
    }
    // 遍历后面的参数，都合并到target上
    args.forEach(function(arg){ extend(target, arg, deep) })
    return target
  }

  // `$.zepto.qsa` is Zepto's CSS selector implementation which
  // uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
  // This method can be overridden in plugins.
  // 
  // 
  // 通过选择器表达式查找DOM
  // 原理  判断下选择器的类型（id/class/标签/表达式）
  // 
  // 当浏览器不支持 el.matches 时，可以用 document.querySelectorAll 来实现 matchs
  // https://developer.mozilla.org/zh-CN/docs/Web/API/Element/matches
  // 
  // Zepto的css选择器，使用document.querySelectorAll 及优化处理一些特殊情况，可被插件覆盖
  zepto.qsa = function(element, selector){
    var found,
        maybeID = selector[0] == '#', //如果有 ＃ 就是id选择器
        maybeClass = !maybeID && selector[0] == '.', //不是id选择器&& 有 . ，是class选择器
       
        // 是如果是 id 或 class,则取符号后的名字,如果没有类和名字,则直接是selector
        // eg:selector = "#xixi"; selector.slice(1); 输出 "xixi" 
        nameOnly = maybeID || maybeClass ? selector.slice(1) : selector, // Ensure that a 1 char tag name still gets checked
        // simpleSelectorRE 用于匹配一个包括（字母、数组、下划线、-）的字符串， 是否是一个简单的字符串（可能是一个复杂的选择器，如 'div#div1 .item[link] .red'）
        isSimple = simpleSelectorRE.test(nameOnly)

    // 以下代码的基本思路是：
    // 1. 优先通过 ID 获取元素；
    // 2. 然后试图通过 className 和 tagName 获取元素
    // 3. 最后通过 querySelectorAll 来获取

    // 判断是否有getElementById方法 && 是个单选择 && 是个id选择器
    return (element.getElementById && isSimple && maybeID) ? // Safari DocumentFragment doesn't have getElementById
      // 如果找到元素，则返回 ［该元素］，否则返回 ［］。
      ( (found = element.getElementById(nameOnly)) ? [found] : [] ) :
      //如果不满足判断条件，element既不是dom元素节点，也不是整个文档（DOM 树的根节点）  #document，也不是 代表轻量级的 Document 对象，能够容纳文档的某个部分 #document 片段，那么就返回［］因为其他节点找不到元素
      (element.nodeType !== 1 && element.nodeType !== 9 && element.nodeType !== 11) ? [] :
      // 将获取的所有元素集合，都转换为数组       
      slice.call(
        // 条件判断  A ? (B ? C : D) : E
        // 判断是否单选择, 不是 id 选择器, 有 getElementByClassName 方法
        isSimple && !maybeID && element.getElementsByClassName ? // DocumentFragment doesn't have getElementsByClassName/TagName
          maybeClass ? element.getElementsByClassName(nameOnly) : // If it's simple, it could be a class
          element.getElementsByTagName(selector) : // Or a tag
          element.querySelectorAll(selector) // Or it's not simple, and we need to query all
      )
  }

  // 在元素集中过滤某些元素
  function filtered(nodes, selector) {
    // $.fn.filter 下文定义
    return selector == null ? $(nodes) : $(nodes).filter(selector)
  }

  // 父元素是否包含子元素 判断 parent 是否包含 node
  $.contains = document.documentElement.contains ?
   // 浏览器支持 contains 方法
    function(parent, node) {
      return parent !== node && parent.contains(node)
    } :
    // 不支持 contains 方法
    function(parent, node) {
      while (node && (node = node.parentNode))
        if (node === parent) return true
      return false
    }

  // 处理 arg为函数/值
  // 为函数，返回函数返回值
  // 为值，返回值
  function funcArg(context, arg, idx, payload) {
    return isFunction(arg) ? arg.call(context, idx, payload) : arg
  }

  // 设置属性
  function setAttribute(node, name, value) {
    // 如果值为空，就移除这个属性，不然就设置值
    value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
  }

  // access className property while respecting SVGAnimatedString
  // 对SVGAnimatedString的兼容
  function className(node, value){
    var klass = node.className || '',
        svg   = klass && klass.baseVal !== undefined

    if (value === undefined) return svg ? klass.baseVal : klass
    svg ? (klass.baseVal = value) : (node.className = value)
  }

  // "true"  => true
  // "false" => false
  // "null"  => null
  // "42"    => 42
  // "42.5"  => 42.5
  // "08"    => "08"
  // JSON    => parse if valid
  // String  => self
  // 
  // 序列化值  把自定义数据读出来时做应该的转换，将字符串变成相应的对象或者值
  function deserializeValue(value) {
    try {
      return value ?
        value == "true" ||
        ( value == "false" ? false :
          value == "null" ? null :
          +value + "" == value ? +value :
          /^[\[\{]/.test(value) ? $.parseJSON(value) :
          value )
        : value
    } catch(e) {
      return value
    }
  }

  // 将上文定义的函数，暴露给 $ 对象（其实 $ 是一个 function）
  $.type = type
  $.isFunction = isFunction
  $.isWindow = isWindow
  $.isArray = isArray
  $.isPlainObject = isPlainObject

  // 空对象
  $.isEmptyObject = function(obj) {
    var name
    for (name in obj) return false
    return true
  }

  //数字
  $.isNumeric = function(val) {
    var num = Number(val), type = typeof val
    return val != null && type != 'boolean' &&
      (type != 'string' || val.length) &&
      !isNaN(num) && isFinite(num) || false
  }

  // 获取在数组中的索引
  // 参数i 从第几个开始搜索
  $.inArray = function(elem, array, i){
    return emptyArray.indexOf.call(array, elem, i)
  }

  //将字符串转成驼峰格式
  $.camelCase = camelize

  //去字符串头尾空格
  $.trim = function(str) {
    return str == null ? "" : String.prototype.trim.call(str)
  }

  // plugin compatibility
  $.uuid = 0
  $.support = { }
  $.expr = { }
  $.noop = function() {}

  // 针对 elements（对象数组或数组），对每个元素都经过 callback 函数的过滤，并将过滤通过的元素，push到一个新数组中，返回新数组
  $.map = function(elements, callback){
    var value, values = [], i, key
    if (likeArray(elements))
      for (i = 0; i < elements.length; i++) {
        value = callback(elements[i], i)
        if (value != null) values.push(value)
      }
    else
      for (key in elements) {
        value = callback(elements[key], key)
        if (value != null) values.push(value)
      }
    return flatten(values)
  }

  // 遍历 elements 所有元素（数组、对象数组、对象），执行 callback 方法，最终还是返回 elements
  // === false) return elements 一旦有函数返回 false，即跳出循环，类似 break
  $.each = function(elements, callback){
    var i, key
    if (likeArray(elements)) {
      for (i = 0; i < elements.length; i++)
        if (callback.call(elements[i], i, elements[i]) === false) return elements
    } else {
      for (key in elements)
        if (callback.call(elements[key], key, elements[key]) === false) return elements
    }

    return elements
  }

  // 查找数组满足过滤函数的元素
  $.grep = function(elements, callback){
    // 上文定义：filter = emptyArray.filter
    return filter.call(elements, callback)
  }


  if (window.JSON) $.parseJSON = JSON.parse

  // Populate the class2type map
  // 填充class2type的值
  $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
    class2type[ "[object " + name + "]" ] = name.toLowerCase()
  })

  // Define methods that will be available on all
  // Zepto collections
  // 定义一些方法给 zepto 对象使用
  $.fn = {
    constructor: zepto.Z,
    length: 0,

    // Because a collection acts like an array
    // copy over these useful array functions
    // 因为一个 zepto 对象，本身就是一个数组，所以需要一些针对数组的方法
    forEach: emptyArray.forEach,
    reduce: emptyArray.reduce,
    push: emptyArray.push,
    sort: emptyArray.sort,
    splice: emptyArray.splice,
    indexOf: emptyArray.indexOf,
    // 合并多个数组
    concat: function(){
      var i, value, args = []
      for (i = 0; i < arguments.length; i++) {
        value = arguments[i] // value 是最后一个参数
        args[i] = zepto.isZ(value) ? value.toArray() : value
      }
      return concat.apply(zepto.isZ(this) ? this.toArray() : this, args)
    },

    // `map` and `slice` in the jQuery API work differently
    // from their array counterparts
    // 遍历对象/数组 在每个元素上执行回调，将回调的返回值放入一个新的Zepto返回
    map: function(fn){
      // $.map 返回的是一个数组
      // 再用 $ 封装返回
      return $($.map(this, function(el, i){ return fn.call(el, i, el) }))
    },
    // 对原生的 Array slice 包装(数组选取方法)
    slice: function(){
      // 直接数组的slice方法，并将结果用 $ 封装返回
      return $(slice.apply(this, arguments))
    },
    // 当DOM载入就绪时，绑定回调
    ready: function(callback){
      // don't use "interactive" on IE <= 10 (it can fired premature)
      // 
      // document.readyState：当document文档正在加载时,返回"loading"。当文档结束渲染但在加载内嵌资源时，返回"interactive"，并引发DOMContentLoaded事件。当文档加载完成时,返回"complete"，并引发load事件。
      // document.documentElement.doScroll：IE有个特有的方法doScroll可以检测DOM是否加载完成。 当页面未加载完成时，该方法会报错，直到doScroll不再报错时，就代表DOM加载完成了
      // 
      // 关于 setTimeout(fn ,0) 的作用 可以参考文章：http://www.cnblogs.com/silin6/p/4333999.html
      if (document.readyState === "complete" ||
          (document.readyState !== "loading" && !document.documentElement.doScroll))
        setTimeout(function(){ callback($) }, 0)
      else {
        // 监听移除事件
        var handler = function() {
          document.removeEventListener("DOMContentLoaded", handler, false)
          window.removeEventListener("load", handler, false)
          callback($)
        }
        document.addEventListener("DOMContentLoaded", handler, false)
        window.addEventListener("load", handler, false)
      }
      return this
    },

    // 取Zepto中指定索引的值
    // 获得整个数组或者是数组中的单个元素，未传参数，直接返回一整个数组，有参数，则试图返回单个元素（大于0，小于0 两种情况）
    get: function(idx){
      return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
    },
    // 将对象转化为数组
    // 原理是 伪数组转换成数组oa = {0:'a',length:1};Array.prototype.slice.call(oa); //["a"]
    toArray: function(){ return this.get() },
    //获取集合长度
    size: function(){
      return this.length
    },
    // 将元素从这个DOM树中移除
    remove: function(){
      return this.each(function(){
        if (this.parentNode != null)
          this.parentNode.removeChild(this)
      })
    },
    // 用来遍历zepto集合，直到callback函数返回false为止
    each: function(callback){
      // 原生 every 接收一个函数,如果返回 false 就停止循环,
      // every 与 map, some, forEach, filter 区别
      // every 就是每个都, filter 选出符合条件的, some 是只要有, forEach 是每一个都要做某事, map 是每个做完某事后排队 
      emptyArray.every.call(this, function(el, idx){
        return callback.call(el, idx, el) !== false
      })
      // 最后返回本身对象
      return this
    },
    // 过滤zepto对象,可以接受字符串或者函数
    // 在函数情况下，通过not函数过滤出selector函数返回值不为真的元素集合,再对这个集合过滤一下，得到selector函数为真的情况下的集合。
    // 字符串情况下，使用之前说明过的zepto.matches函数来判断。
    filter: function(selector){
      if (isFunction(selector)) return this.not(this.not(selector))
      return $(filter.call(this, function(element){
        return zepto.matches(element, selector)
      }))
    },
    // 在某个元素集合中添加元素
    // $('div') 可能只有三个 div 节点，那么 $('div').add('p') 再三个 div 节点的基础上，增加三个 p 节点
    add: function(selector,context){
      // uniq函数——数组去重，例如：用来将 [1,1,2,2,3,3] 替换为 [1,2,3]
      return $(uniq(this.concat($(selector,context))))
    },
    // 判断数组中的第一个元素是不是符合selector
    is: function(selector){
      return this.length > 0 && zepto.matches(this[0], selector)
    },
    //排除集合里满足条件的记录
    //selector是函数时对函数返回值取反，获取不匹配的元素并放在数组中。
    //字符串情况下，先获取符合该选取器的元素，之后用indexOf函数取反。
    //类数组与NodeList的情况下，前者返回一个数组，后者返回一个zepto集合，之后再用indexOf函数取反。
    not: function(selector){
      var nodes=[]
      // 如果是selector是function
      if (isFunction(selector) && selector.call !== undefined)
        this.each(function(idx){
          if (!selector.call(this,idx)) nodes.push(this)
        })
      else {
        var excludes = typeof selector == 'string' ? this.filter(selector) :
          (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
        this.forEach(function(el){
          //如果 excludes 不包含数组中的元素,则将这个不包含在内的元素加入到 nodes 中
          if (excludes.indexOf(el) < 0) nodes.push(el)
        })
      }
      //返回 nodes 
      return $(nodes)
    },
    // 判断当前对象集合的子元素是否有符合选择器的元素，或者是否包含指定的DOM节点，如果有，则返回新的对象集合
    has: function(selector){
      return this.filter(function(){
        return isObject(selector) ?
          $.contains(this, selector) :
          $(this).find(selector).size()
      })
    },
    // 取出指定index的元素
    eq: function(idx){
      return idx === -1 ? this.slice(idx) : this.slice(idx, + idx + 1)
    },
    // 取第一条$(元素）
    first: function(){
      var el = this[0]
      return el && !isObject(el) ? el : $(el)
    },
    // 取最后一条$(元素）
    last: function(){
      var el = this[this.length - 1]
      return el && !isObject(el) ? el : $(el)
    },
    // 用来在当前zepto集合里筛选出新的zepto集合。
    // 在selector是对象的情况下（指元素节点）先获取selector匹配的zepto集合，之后对这个集合进行filter操作，将每个元素和调用find函数的zepto集合进行匹配，只要这个集合中的元素能在调用find方法中的zepto集合中找到，则过滤成功，并过滤下一个。
    // selector是选择器时，通过map函数和zepto.qsa搜寻。
    find: function(selector){
      var result, $this = this
      if (!selector) result = $()
      // 如果selector是对象
      else if (typeof selector == 'object')
        result = $(selector).filter(function(){
          var node = this
          return emptyArray.some.call($this, function(parent){
            return $.contains(parent, node)
          })
        })
      // 如果只有一个元素，则使用 qsa 判断，结果经过 $ 封装后赋值给 result
      else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
      // 如果有多个元素，则使用 map 遍历所有元素，使用 qsa 针对每个元素判断，符合条件即返回（map将返回包含符合条件的元素的新数组，并 $ 封装，支持链式操作！！）
      else result = this.map(function(){ return zepto.qsa(this, selector) })
      return result
    },
    // 从元素本身开始，逐级向上级元素匹配，并返回最先匹配selector的元素
    closest: function(selector, context){
      var nodes = [], collection = typeof selector == 'object' && $(selector)
      this.each(function(_, node){
        // 使用了while循环来不断往祖先方向移动。
        while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))
          //当node 不是context,document的时候，取node.parentNode
          node = node !== context && !isDocument(node) && node.parentNode

        if (node && nodes.indexOf(node) < 0) nodes.push(node)
      })
      return $(nodes)
    },
    // 取得所有匹配的祖先元素 $('h1').parents() => [<div#container>, <body>, <html>]
    parents: function(selector){
      var ancestors = [], nodes = this
      // 取得所有祖先元素
      while (nodes.length > 0)
        nodes = $.map(nodes, function(node){
          // 不能是 document，结果中元素不能重复。否则不执行push
          if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0) {
            ancestors.push(node)
            return node
          }
        })
      // 筛选出符合selector的祖先元素
      return filtered(ancestors, selector)
    },
    // 用来返回由zepto元素的父元素组成的zepto集合
    parent: function(selector){
      // pluck方法，这个方法用来获取一个zepto集合中每个元素的某个属性值组成的zepto集合
      return filtered(uniq(this.pluck('parentNode')), selector)
    },
    // 获得每个匹配元素集合元素的直接子元素，可通过 selector 过滤
    children: function(selector){
      return filtered(this.map(function(){ return children(this) }), selector)
    },
    // 获得每个匹配元素集合元素的子元素，包括文字和注释节点
    contents: function() {
      // 对于frame，则获取它的contentDocument属性，contentDocument返回这个窗体的文档节点。
      return this.map(function() { return this.contentDocument || slice.call(this.childNodes) })
    },
    // 获取对象集合中所有元素的兄弟节点，可通过 selector 过滤
    siblings: function(selector){
      return filtered(this.map(function(i, el){
        //使用 el.parentNode, 过滤出 el.parentNode 的子元素, 但是不包括 this 中的元素
        return filter.call(children(el.parentNode), function(child){ return child!==el })
      }), selector)
    },
    // 移除所有子元素
    empty: function(){
      return this.each(function(){ this.innerHTML = '' })
    },
    // `pluck` is borrowed from Prototype.js
    // 返回集合中每个元素的某个属性
    pluck: function(property){
      return $.map(this, function(el){ return el[property] })
    },
    // 用来让元素显示（还原成“默认样式”）
    // show 方法是为了显示对象，而对象隐藏的方式有两种：内联样式 或 css样式
    // this.style.display 只能获取内联样式的值（获取属性值）
    // getComputedStyle(this, '').getPropertyValue("display") 可以获取内联、css样式的值（获取 renderTree 的值）
    show: function(){
      return this.each(function(){
        //针对内联样式， 如果 display 为 none ，则替换成 ''
        this.style.display == "none" && (this.style.display = '')
        // 针对css样式，如果是 none 则修改为默认的显示样式
        if (getComputedStyle(this, '').getPropertyValue("display") == "none")
          this.style.display = defaultDisplay(this.nodeName)
      })
    },
    // 替换
    replaceWith: function(newContent){
      // 先在前面插入，然后将当前对象移除
      return this.before(newContent).remove()
    },
    // 匹配的每条元素都被单个元素包裹
    wrap: function(structure){
      var func = isFunction(structure)
      //如果structure是字符串
      if (this[0] && !func)
        //直接转成DOM
        var dom   = $(structure).get(0),
            clone = dom.parentNode || this.length > 1 //如果DOM已存在(通过在文档中读parentNode判断)，或$集不止一条，需要克隆。避免DOM被移动位置

      return this.each(function(index){
        // 调用了 wrapAll
        $(this).wrapAll(
          func ? structure.call(this, index) :
            clone ? dom.cloneNode(true) : dom
        )
      })
    },
    // 用来将zepto集合中的元素包裹在一个html片段或者DOM元素中
    wrapAll: function(structure){
      if (this[0]) {
        // 先在集合中的第一个元素前插入structure生成的元素
        $(this[0]).before(structure = $(structure))
        var children
        // drill down to the inmost element
        // 遍历这个元素获取它的最内层DOM
        while ((children = structure.children()).length) structure = children.first()
        // 之后使用zepto原型中的append方法将zepto集合中的元素移动到刚刚获取的最里层元素中。
        $(structure).append(this)
      }
      return this
    },
    // 将zepto集合中的每个元素的后代节点包裹起来
    wrapInner: function(structure){
      var func = isFunction(structure)
      return this.each(function(index){
        // contents 获取zepto集合中某个元素的后代节点
        var self = $(this), contents = self.contents(),
            dom  = func ? structure.call(this, index) : structure
        // 如果后代节点存在则使用wrapAll方法将它包裹，否则直接插入structure
        contents.length ? contents.wrapAll(dom) : self.append(dom)
      })
    },
    // 移除包裹结构
    unwrap: function(){
      // 是遍历zepto集合中的父元素，将它们替换成它们的后代节点
      this.parent().each(function(){
        $(this).replaceWith($(this).children())
      })
      return this
    },
    // 将zepto集合中的元素克隆一份
    clone: function(){
      // Node.cloneNode()：Node将要被克隆的节点 ，该方法返回调用该方法的节点的一个副本.
      return this.map(function(){ return this.cloneNode(true) })
    },
    // 让集合元素不显示
    hide: function(){
      return this.css("display", "none")
    },
    // 切换显示和隐藏，参数setting为真时将zepto集合显示，反之隐藏。
    toggle: function(setting){
      return this.each(function(){
        var el = $(this)
        ;(setting === undefined ? el.css("display") == "none" : setting) ? el.show() : el.hide()
      })
    },
    // 获取集合中每个元素的上一个元素放回新的zepto集合 
    // previousElementSibling 返回当前元素在其父元素的子元素节点中的前一个元素节点,如果该元素已经是第一个元素节点,则返回null,该属性是只读的.
    prev: function(selector){ return $(this.pluck('previousElementSibling')).filter(selector || '*') },
    // 获取集合中每个元素的下一个元素放回新的zepto集合
    // nextElementSibling 返回当前元素在其父元素的子元素节点中的后一个元素节点,如果该元素已经是最后一个元素节点,则返回null,该属性是只读的.
    next: function(selector){ return $(this.pluck('nextElementSibling')).filter(selector || '*') },
    // 读写元素HTML内容 通过innerHTML读内容,append()写内容
    //  传参遍历执行写入
    //  未传参执行读
    html: function(html){
      // 0 in arguments判断是否有参数
      return 0 in arguments ?
        this.each(function(idx){
          var originHtml = this.innerHTML //记录原始的innerHTMl
          //如果参数html是字符串直接插入到记录中，
          //如果是函数，则将当前记录作为上下文，调用该函数，且传入该记录的索引和原始innerHTML作为参数
          $(this).empty().append( funcArg(this, html, idx, originHtml) )
        }) :
        (0 in this ? this[0].innerHTML : null)
    },
    // 读写元素文本内容,通过 textContent 读写文本, Node.textContent 属性表示一个节点及其后代的文本内容。
    //  传参遍历执行写入
    //  未传参执行读
    text: function(text){
      // 0 in arguments判断是否有参数
      return 0 in arguments ?
        this.each(function(idx){
          var newText = funcArg(this, text, idx, this.textContent)
          this.textContent = newText == null ? '' : ''+newText
        }) :
        (0 in this ? this.pluck('textContent').join("") : null)
    },
    // 元素的HTML属性读写
    // 仅有name，且为字符串时，表示读
    attr: function(name, value){
      var result
      return (typeof name == 'string' && !(1 in arguments)) ?
        (0 in this && this[0].nodeType == 1 && (result = this[0].getAttribute(name)) != null ? result : undefined) :
        this.each(function(idx){
          // 如果不是一个 元素 节点 则直接 return
          if (this.nodeType !== 1) return
          if (isObject(name)) for (key in name) setAttribute(this, key, name[key])
          else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
        })
    },
    // 移除属性
    removeAttr: function(name){
      return this.each(function(){ this.nodeType === 1 && name.split(' ').forEach(function(attribute){
        setAttribute(this, attribute)
      }, this)})
    },
    // 元素的DOM属性读写
    // 有value，遍历写入
    prop: function(name, value){
      //优先读取修正属性，DOM的两字母属性都是驼峰格式
      name = propMap[name] || name
      return (1 in arguments) ?
        this.each(function(idx){
          this[name] = funcArg(this, value, idx, this[name])
        }) :
        (this[0] && this[0][name])
    },
    // 删除属性
    removeProp: function(name){
      name = propMap[name] || name
      //  delete 操作符能删除对象的某个属性
      return this.each(function(){ delete this[name] })
    },
    // 用来获取和添加元素的“数据”，前面加上 'data-' 通过 attr 设置或者读取
    data: function(name, value){
      var attrName = 'data-' + name.replace(capitalRE, '-$1').toLowerCase()

      var data = (1 in arguments) ?
        this.attr(attrName, value) :
        this.attr(attrName)

      return data !== null ? deserializeValue(data) : undefined
    },
    // 用于设置和获取元素的value属性
    val: function(value){
      if (0 in arguments) {
        if (value == null) value = ""
        return this.each(function(idx){
          this.value = funcArg(this, value, idx, this.value)
        })
      } else {
        // 在查询的情况下，如果是select元素并且带有multiple属性，则将它被选中的option子元素筛选出来并通过pluck方法一并获取它们的value属性
        return this[0] && (this[0].multiple ?
           $(this[0]).find('option').filter(function(){ return this.selected }).pluck('value') :
           this[0].value)
      }
    },
    // 用来读写元素的位置与大小信息
    offset: function(coordinates){
      // 如果有 coordinates 参数，设置坐标值，并返回当前对象
      // 遍历每个元素，获取它的父元素的offset属性，之后将要设置的偏移位置减去父元素的偏移位置就能得到实际应该设置的left与top属性
      if (coordinates) return this.each(function(index){
        var $this = $(this),
            coords = funcArg(this, coordinates, index, $this.offset()),
            parentOffset = $this.offsetParent().offset(),
            props = {
              top:  coords.top  - parentOffset.top,
              left: coords.left - parentOffset.left
            }
        // position static时，设置 top、left是无效的
        if ($this.css('position') == 'static') props['position'] = 'relative'
        // 通过 css 赋值
        $this.css(props)
      })
      // 当前对象是空，则返回 null
      if (!this.length) return null
      // 如果元素尚未在DOM中则返回“{top:0,left:0}”
      // Document.documentElement 是一个会返回文档对象（document）的根元素的只读属性（如HTML文档的 <html> 元素）。
      if (document.documentElement !== this[0] && !$.contains(document.documentElement, this[0]))
        return {top: 0, left: 0}
      // Element.getBoundingClientRect()方法返回元素的大小及其相对于视口的位置。
      var obj = this[0].getBoundingClientRect()
      // window.pageXOffset 和 window.pageYOffset 可获取网页滚动的距离，
      return {
        left: obj.left + window.pageXOffset,
        top: obj.top + window.pageYOffset,
        width: Math.round(obj.width),
        height: Math.round(obj.height)
      }
    },
    // 设置、获取 css
    css: function(property, value){
      // 获取css
      if (arguments.length < 2) {
        // 获取第一个元素
        var element = this[0]
        if (typeof property == 'string') {
          // 如果第一个无元素，直接返回。否则继续
          if (!element) return
          // 先从elem内联样式获取（element.style），此时需要 camelize(property) 转换，如将 background-color 变为 backgroundColor，如果未找到，则从css样式获取 computedStyle.getPropertyValue(property) 
          return element.style[camelize(property)] || getComputedStyle(element, '').getPropertyValue(property)
        // 参数为数组
        } else if (isArray(property)) {
          if (!element) return
          var props = {}
          var computedStyle = getComputedStyle(element, '')
          $.each(property, function(_, prop){
            props[prop] = (element.style[camelize(prop)] || computedStyle.getPropertyValue(prop))
          })
          return props
        }
      }

      // 设置属性
      var css = ''
      if (type(property) == 'string') {
        // 如果value参数是 '' null undefined 则移除这个css样式
        if (!value && value !== 0)
          this.each(function(){ this.style.removeProperty(dasherize(property)) })
        else
          // maybeAddPx(property, value) 需要增加 px 的增加上
          css = dasherize(property) + ":" + maybeAddPx(property, value)
      // property 是对象的情况
      } else {
        for (key in property)
          if (!property[key] && property[key] !== 0)
            this.each(function(){ this.style.removeProperty(dasherize(key)) })
          else
            css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
      }

      return this.each(function(){ this.style.cssText += ';' + css })
    },
    // 获取一个元素的索引值
    index: function(element){
      //这里的$(element)[0]是为了将字符串转成node,因为this是个包含node的数组
      return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
    },
    // 是否含有指定的类样式
    hasClass: function(name){
      if (!name) return false
      //some ES5的新方法 有一个匹配，即返回true 
      return emptyArray.some.call(this, function(el){
        return this.test(className(el))
      }, classRE(name))
    },
    // 增加一个或多个类名
    addClass: function(name){
      if (!name) return this
      return this.each(function(idx){
        if (!('className' in this)) return
        classList = []
        var cls = className(this), newName = funcArg(this, name, idx, cls)
        newName.split(/\s+/g).forEach(function(klass){
          if (!$(this).hasClass(klass)) classList.push(klass)
        }, this)
        classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
      })
    },
    // 删除一个或多个类名
    removeClass: function(name){
      return this.each(function(idx){
        if (!('className' in this)) return
        if (name === undefined) return className(this, '')
        classList = className(this)
        funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass){ 
          //替换删除
          classList = classList.replace(classRE(klass), " ")
        })
        className(this, classList.trim())
      })
    },
    // 切换类的添加或移除
    // 如果 when === true 则单纯执行 addClass
    // 如果 when === false 则单纯执行 removeClass
    toggleClass: function(name, when){
      if (!name) return this
      return this.each(function(idx){
        var $this = $(this), names = funcArg(this, name, idx, className(this))
        names.split(/\s+/g).forEach(function(klass){
          (when === undefined ? !$this.hasClass(klass) : when) ?
            $this.addClass(klass) : $this.removeClass(klass)
        })
      })
    },
    // 读写元素 滚动条的垂直偏移
    scrollTop: function(value){
      if (!this.length) return
      var hasScrollTop = 'scrollTop' in this[0]
      // 读
      if (value === undefined) return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset
      // 写
      return this.each(hasScrollTop ?
        function(){ this.scrollTop = value } :
        function(){ this.scrollTo(this.scrollX, value) })
    },
    // 读写元素 滚动条的垂直偏移
    scrollLeft: function(value){
      if (!this.length) return
      var hasScrollLeft = 'scrollLeft' in this[0]
      if (value === undefined) return hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset
      return this.each(hasScrollLeft ?
        function(){ this.scrollLeft = value } :
        function(){ this.scrollTo(value, this.scrollY) })
    },
    // 返回集合中第一个元素的相对于定位元素的偏移
    position: function() {
      if (!this.length) return

      var elem = this[0],
        // Get *real* offsetParent
        // 找到第一个定位过的祖先元素
        // HTMLElement.offsetParent 是一个只读属性，返回一个指向最近的（closest，指包含层级上的最近）包含该元素的定位元素。
        offsetParent = this.offsetParent(),
        // Get correct offsets
        // 获取自身的offset
        offset       = this.offset(),
        // 获取父元素的坐标
        parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset()

      // Subtract element margins
      // note: when an element has margin: auto the offsetLeft and marginLeft
      // are the same in Safari causing offset.left to incorrectly be 0
      // 坐标减去外边框 margin 宽度
      offset.top  -= parseFloat( $(elem).css('margin-top') ) || 0
      offset.left -= parseFloat( $(elem).css('margin-left') ) || 0

      // Add offsetParent borders
      // 加上父元素的border
      parentOffset.top  += parseFloat( $(offsetParent[0]).css('border-top-width') ) || 0
      parentOffset.left += parseFloat( $(offsetParent[0]).css('border-left-width') ) || 0

      // Subtract the two offsets
      return {
        top:  offset.top  - parentOffset.top,
        left: offset.left - parentOffset.left
      }
    },
    // 返回第一个匹配元素用于定位的祖先元素
    offsetParent: function() {
      return this.map(function(){
        var parent = this.offsetParent || document.body
        // 如果找到的定位元素 position=‘static’则继续往上找，直到body/Html
        while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")
          parent = parent.offsetParent
        return parent
      })
    }
  }

  // for now
  // 给remove方法添加一个别名
  $.fn.detach = $.fn.remove

  // Generate the `width` and `height` functions
  // 在原型上添加width和height方法
  ;['width', 'height'].forEach(function(dimension){
    //将width,hegiht转成Width,Height，用于document获取
    var dimensionProperty =
      dimension.replace(/./, function(m){ return m[0].toUpperCase() })

    $.fn[dimension] = function(value){
      var offset, el = this[0]
      //读时，是window 用innerWidth,innerHeight获取
      if (value === undefined) return isWindow(el) ? el['inner' + dimensionProperty] :
        //是document，用scrollWidth,scrollHeight获取
        isDocument(el) ? el.documentElement['scroll' + dimensionProperty] :
        // 是元素 用offset
        (offset = this.offset()) && offset[dimension]

      // 写
      else return this.each(function(idx){
        el = $(this)
        el.css(dimension, funcArg(this, value, idx, el[dimension]()))
      })
    }
  })

  // 递归遍历一个节点及其子节点。每遍历一个node执行一次fun(node)。
  function traverseNode(node, fun) {
    fun(node)
    for (var i = 0, len = node.childNodes.length; i < len; i++)
      traverseNode(node.childNodes[i], fun)
  }

  // Generate the `after`, `prepend`, `before`, `append`,
  // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
  // 用来为原型生成after，prepend等八个与在不同位置插入元素相关的方法
  // adjacencyOperator ＝ ['after', 'prepend', 'before', 'append']；
  adjacencyOperators.forEach(function(operator, operatorIndex) {
    // 区分出这四个操作是“内部操作”还是“外部操作”，所谓“外部操作”指的是对发起这个操作的元素的相邻方向进行的操作，就是after与before，而“内部操作”指的是对发起操作的元素的子元素集合进行的操作，就是append与prepend
    // 选出内部操作
    var inside = operatorIndex % 2 //=> prepend, append

    $.fn[operator] = function(){
      // arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
      var argType, nodes = $.map(arguments, function(arg) {
            var arr = []
            argType = type(arg)
            // 参数是数组
            if (argType == "array") {
              arg.forEach(function(el) {
                if (el.nodeType !== undefined) return arr.push(el)
                else if ($.zepto.isZ(el)) return arr = arr.concat(el.get())
                arr = arr.concat(zepto.fragment(el))
              })
              return arr
            }
            //传参非 object、array、null，就直接调用zepto.fragment生成DOM
            return argType == "object" || arg == null ?
              arg : zepto.fragment(arg)
          }),
          // 如果$长度>1,需要克隆里面的元素
          parent, copyByClone = this.length > 1
      //为0，不需要操作，直接返回
      if (nodes.length < 1) return this

      return this.each(function(_, target){
        parent = inside ? target : target.parentNode

        // convert all methods to a "before" operation
        target = operatorIndex == 0 ? target.nextSibling : // after，target等于下一个兄弟元素，然后将DOM通过insertBefore插入到target前
                 operatorIndex == 1 ? target.firstChild : // prepend target为parent的第一个元素，然后将DOM通过insertBefore插入到target前
                 operatorIndex == 2 ? target : //before  直接将将DOM通过insertBefore插入到target前
                 null // 直接调用$(target).append
        
        //父元素是否在document中
        var parentInDocument = $.contains(document.documentElement, parent)

        //遍历待插入的元素
        nodes.forEach(function(node){
          if (copyByClone) node = node.cloneNode(true)
          //parent元素不存在，没法执行插入操作，直接删除，返回
          else if (!parent) return $(node).remove()
          //插入元素
          parent.insertBefore(node, target)

          // 如果插入的事script标签
          // 如果父元素在document里，修正script标签。原因是script标签通过innerHTML加入DOM不执行。需要在全局环境下执行它
          if (parentInDocument) traverseNode(node, function(el){
            if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' &&
               (!el.type || el.type === 'text/javascript') && !el.src){
              // Node.ownerDocument 只读属性会返回当前节点的顶层的 document 对象。
              var target = el.ownerDocument ? el.ownerDocument.defaultView : window
              target['eval'].call(target, el.innerHTML)
            }
          })
        })
      })
    }

    // after    => insertAfter
    // prepend  => prependTo
    // before   => insertBefore
    // append   => appendTo
    $.fn[inside ? operator+'To' : 'insert'+(operatorIndex ? 'Before' : 'After')] = function(html){
      $(html)[operator](this)
      return this
    }
  })

  // 将形成的原型对象$.fn为挂载在Z.prototype与zepto.Z.prototype上
  zepto.Z.prototype = Z.prototype = $.fn

  // Export internal API functions in the `$.zepto` namespace
  // 将两个方法挂载在zepto对象上
  zepto.uniq = uniq
  zepto.deserializeValue = deserializeValue

  // 把zepto挂载在$入口函数上
  $.zepto = zepto
  // 并返回$
  return $
})()

// If `$` is not yet defined, point it to `Zepto`
// 入口函数挂载在window对象上
window.Zepto = Zepto
window.$ === undefined && (window.$ = Zepto)
