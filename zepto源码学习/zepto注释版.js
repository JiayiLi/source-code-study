//     Zepto.js
//     (c) 2010-2017 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

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
    console.log(element);
    console.log(selector);
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
      class2type[toString.call(obj)] || "object"
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

  $.type = type
  $.isFunction = isFunction
  $.isWindow = isWindow
  $.isArray = isArray
  $.isPlainObject = isPlainObject

  $.isEmptyObject = function(obj) {
    var name
    for (name in obj) return false
    return true
  }

  $.isNumeric = function(val) {
    var num = Number(val), type = typeof val
    return val != null && type != 'boolean' &&
      (type != 'string' || val.length) &&
      !isNaN(num) && isFinite(num) || false
  }

  $.inArray = function(elem, array, i){
    return emptyArray.indexOf.call(array, elem, i)
  }

  $.camelCase = camelize
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

  $.grep = function(elements, callback){
    return filter.call(elements, callback)
  }

  if (window.JSON) $.parseJSON = JSON.parse

  // Populate the class2type map
  $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
    class2type[ "[object " + name + "]" ] = name.toLowerCase()
  })

  // Define methods that will be available on all
  // Zepto collections
  $.fn = {
    constructor: zepto.Z,
    length: 0,

    // Because a collection acts like an array
    // copy over these useful array functions.
    forEach: emptyArray.forEach,
    reduce: emptyArray.reduce,
    push: emptyArray.push,
    sort: emptyArray.sort,
    splice: emptyArray.splice,
    indexOf: emptyArray.indexOf,
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
    map: function(fn){
      return $($.map(this, function(el, i){ return fn.call(el, i, el) }))
    },
    slice: function(){
      return $(slice.apply(this, arguments))
    },

    ready: function(callback){
      // don't use "interactive" on IE <= 10 (it can fired premature)
      if (document.readyState === "complete" ||
          (document.readyState !== "loading" && !document.documentElement.doScroll))
        setTimeout(function(){ callback($) }, 0)
      else {
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
    // 获得整个数组或者是数组中的单个元素，未传参数，直接返回一整个数组，有参数，则试图返回单个元素（大于0，小于0 两种情况）
    get: function(idx){
      return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
    },

    toArray: function(){ return this.get() },
    size: function(){
      return this.length
    },
    remove: function(){
      return this.each(function(){
        if (this.parentNode != null)
          this.parentNode.removeChild(this)
      })
    },
    each: function(callback){
      emptyArray.every.call(this, function(el, idx){
        return callback.call(el, idx, el) !== false
      })
      return this
    },
    filter: function(selector){
      if (isFunction(selector)) return this.not(this.not(selector))
      return $(filter.call(this, function(element){
        return zepto.matches(element, selector)
      }))
    },
    add: function(selector,context){
      return $(uniq(this.concat($(selector,context))))
    },
    is: function(selector){
      return this.length > 0 && zepto.matches(this[0], selector)
    },
    not: function(selector){
      var nodes=[]
      if (isFunction(selector) && selector.call !== undefined)
        this.each(function(idx){
          if (!selector.call(this,idx)) nodes.push(this)
        })
      else {
        var excludes = typeof selector == 'string' ? this.filter(selector) :
          (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
        this.forEach(function(el){
          if (excludes.indexOf(el) < 0) nodes.push(el)
        })
      }
      return $(nodes)
    },
    has: function(selector){
      return this.filter(function(){
        return isObject(selector) ?
          $.contains(this, selector) :
          $(this).find(selector).size()
      })
    },
    eq: function(idx){
      return idx === -1 ? this.slice(idx) : this.slice(idx, + idx + 1)
    },
    first: function(){
      var el = this[0]
      return el && !isObject(el) ? el : $(el)
    },
    last: function(){
      var el = this[this.length - 1]
      return el && !isObject(el) ? el : $(el)
    },
    find: function(selector){
      var result, $this = this
      if (!selector) result = $()
      else if (typeof selector == 'object')
        result = $(selector).filter(function(){
          var node = this
          return emptyArray.some.call($this, function(parent){
            return $.contains(parent, node)
          })
        })
      else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
      else result = this.map(function(){ return zepto.qsa(this, selector) })
      return result
    },
    closest: function(selector, context){
      var nodes = [], collection = typeof selector == 'object' && $(selector)
      this.each(function(_, node){
        while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))
          node = node !== context && !isDocument(node) && node.parentNode
        if (node && nodes.indexOf(node) < 0) nodes.push(node)
      })
      return $(nodes)
    },
    parents: function(selector){
      var ancestors = [], nodes = this
      while (nodes.length > 0)
        nodes = $.map(nodes, function(node){
          if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0) {
            ancestors.push(node)
            return node
          }
        })
      return filtered(ancestors, selector)
    },
    parent: function(selector){
      return filtered(uniq(this.pluck('parentNode')), selector)
    },
    children: function(selector){
      return filtered(this.map(function(){ return children(this) }), selector)
    },
    contents: function() {
      return this.map(function() { return this.contentDocument || slice.call(this.childNodes) })
    },
    siblings: function(selector){
      return filtered(this.map(function(i, el){
        return filter.call(children(el.parentNode), function(child){ return child!==el })
      }), selector)
    },
    empty: function(){
      return this.each(function(){ this.innerHTML = '' })
    },
    // `pluck` is borrowed from Prototype.js
    pluck: function(property){
      return $.map(this, function(el){ return el[property] })
    },
    show: function(){
      return this.each(function(){
        this.style.display == "none" && (this.style.display = '')
        if (getComputedStyle(this, '').getPropertyValue("display") == "none")
          this.style.display = defaultDisplay(this.nodeName)
      })
    },
    replaceWith: function(newContent){
      return this.before(newContent).remove()
    },
    wrap: function(structure){
      var func = isFunction(structure)
      if (this[0] && !func)
        var dom   = $(structure).get(0),
            clone = dom.parentNode || this.length > 1

      return this.each(function(index){
        $(this).wrapAll(
          func ? structure.call(this, index) :
            clone ? dom.cloneNode(true) : dom
        )
      })
    },
    wrapAll: function(structure){
      if (this[0]) {
        $(this[0]).before(structure = $(structure))
        var children
        // drill down to the inmost element
        while ((children = structure.children()).length) structure = children.first()
        $(structure).append(this)
      }
      return this
    },
    wrapInner: function(structure){
      var func = isFunction(structure)
      return this.each(function(index){
        var self = $(this), contents = self.contents(),
            dom  = func ? structure.call(this, index) : structure
        contents.length ? contents.wrapAll(dom) : self.append(dom)
      })
    },
    unwrap: function(){
      this.parent().each(function(){
        $(this).replaceWith($(this).children())
      })
      return this
    },
    clone: function(){
      return this.map(function(){ return this.cloneNode(true) })
    },
    hide: function(){
      return this.css("display", "none")
    },
    toggle: function(setting){
      return this.each(function(){
        var el = $(this)
        ;(setting === undefined ? el.css("display") == "none" : setting) ? el.show() : el.hide()
      })
    },
    prev: function(selector){ return $(this.pluck('previousElementSibling')).filter(selector || '*') },
    next: function(selector){ return $(this.pluck('nextElementSibling')).filter(selector || '*') },
    html: function(html){
      return 0 in arguments ?
        this.each(function(idx){
          var originHtml = this.innerHTML
          $(this).empty().append( funcArg(this, html, idx, originHtml) )
        }) :
        (0 in this ? this[0].innerHTML : null)
    },
    text: function(text){
      return 0 in arguments ?
        this.each(function(idx){
          var newText = funcArg(this, text, idx, this.textContent)
          this.textContent = newText == null ? '' : ''+newText
        }) :
        (0 in this ? this.pluck('textContent').join("") : null)
    },
    attr: function(name, value){
      var result
      return (typeof name == 'string' && !(1 in arguments)) ?
        (0 in this && this[0].nodeType == 1 && (result = this[0].getAttribute(name)) != null ? result : undefined) :
        this.each(function(idx){
          if (this.nodeType !== 1) return
          if (isObject(name)) for (key in name) setAttribute(this, key, name[key])
          else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
        })
    },
    removeAttr: function(name){
      return this.each(function(){ this.nodeType === 1 && name.split(' ').forEach(function(attribute){
        setAttribute(this, attribute)
      }, this)})
    },
    prop: function(name, value){
      name = propMap[name] || name
      return (1 in arguments) ?
        this.each(function(idx){
          this[name] = funcArg(this, value, idx, this[name])
        }) :
        (this[0] && this[0][name])
    },
    removeProp: function(name){
      name = propMap[name] || name
      return this.each(function(){ delete this[name] })
    },
    data: function(name, value){
      var attrName = 'data-' + name.replace(capitalRE, '-$1').toLowerCase()

      var data = (1 in arguments) ?
        this.attr(attrName, value) :
        this.attr(attrName)

      return data !== null ? deserializeValue(data) : undefined
    },
    val: function(value){
      if (0 in arguments) {
        if (value == null) value = ""
        return this.each(function(idx){
          this.value = funcArg(this, value, idx, this.value)
        })
      } else {
        return this[0] && (this[0].multiple ?
           $(this[0]).find('option').filter(function(){ return this.selected }).pluck('value') :
           this[0].value)
      }
    },
    offset: function(coordinates){
      if (coordinates) return this.each(function(index){
        var $this = $(this),
            coords = funcArg(this, coordinates, index, $this.offset()),
            parentOffset = $this.offsetParent().offset(),
            props = {
              top:  coords.top  - parentOffset.top,
              left: coords.left - parentOffset.left
            }

        if ($this.css('position') == 'static') props['position'] = 'relative'
        $this.css(props)
      })
      if (!this.length) return null
      if (document.documentElement !== this[0] && !$.contains(document.documentElement, this[0]))
        return {top: 0, left: 0}
      var obj = this[0].getBoundingClientRect()
      return {
        left: obj.left + window.pageXOffset,
        top: obj.top + window.pageYOffset,
        width: Math.round(obj.width),
        height: Math.round(obj.height)
      }
    },
    css: function(property, value){
      if (arguments.length < 2) {
        var element = this[0]
        if (typeof property == 'string') {
          if (!element) return
          return element.style[camelize(property)] || getComputedStyle(element, '').getPropertyValue(property)
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

      var css = ''
      if (type(property) == 'string') {
        if (!value && value !== 0)
          this.each(function(){ this.style.removeProperty(dasherize(property)) })
        else
          css = dasherize(property) + ":" + maybeAddPx(property, value)
      } else {
        for (key in property)
          if (!property[key] && property[key] !== 0)
            this.each(function(){ this.style.removeProperty(dasherize(key)) })
          else
            css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
      }

      return this.each(function(){ this.style.cssText += ';' + css })
    },
    index: function(element){
      return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
    },
    hasClass: function(name){
      if (!name) return false
      return emptyArray.some.call(this, function(el){
        return this.test(className(el))
      }, classRE(name))
    },
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
    removeClass: function(name){
      return this.each(function(idx){
        if (!('className' in this)) return
        if (name === undefined) return className(this, '')
        classList = className(this)
        funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass){
          classList = classList.replace(classRE(klass), " ")
        })
        className(this, classList.trim())
      })
    },
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
    scrollTop: function(value){
      if (!this.length) return
      var hasScrollTop = 'scrollTop' in this[0]
      if (value === undefined) return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset
      return this.each(hasScrollTop ?
        function(){ this.scrollTop = value } :
        function(){ this.scrollTo(this.scrollX, value) })
    },
    scrollLeft: function(value){
      if (!this.length) return
      var hasScrollLeft = 'scrollLeft' in this[0]
      if (value === undefined) return hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset
      return this.each(hasScrollLeft ?
        function(){ this.scrollLeft = value } :
        function(){ this.scrollTo(value, this.scrollY) })
    },
    position: function() {
      if (!this.length) return

      var elem = this[0],
        // Get *real* offsetParent
        offsetParent = this.offsetParent(),
        // Get correct offsets
        offset       = this.offset(),
        parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset()

      // Subtract element margins
      // note: when an element has margin: auto the offsetLeft and marginLeft
      // are the same in Safari causing offset.left to incorrectly be 0
      offset.top  -= parseFloat( $(elem).css('margin-top') ) || 0
      offset.left -= parseFloat( $(elem).css('margin-left') ) || 0

      // Add offsetParent borders
      parentOffset.top  += parseFloat( $(offsetParent[0]).css('border-top-width') ) || 0
      parentOffset.left += parseFloat( $(offsetParent[0]).css('border-left-width') ) || 0

      // Subtract the two offsets
      return {
        top:  offset.top  - parentOffset.top,
        left: offset.left - parentOffset.left
      }
    },
    offsetParent: function() {
      return this.map(function(){
        var parent = this.offsetParent || document.body
        while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")
          parent = parent.offsetParent
        return parent
      })
    }
  }

  // for now
  $.fn.detach = $.fn.remove

  // Generate the `width` and `height` functions
  ;['width', 'height'].forEach(function(dimension){
    var dimensionProperty =
      dimension.replace(/./, function(m){ return m[0].toUpperCase() })

    $.fn[dimension] = function(value){
      var offset, el = this[0]
      if (value === undefined) return isWindow(el) ? el['inner' + dimensionProperty] :
        isDocument(el) ? el.documentElement['scroll' + dimensionProperty] :
        (offset = this.offset()) && offset[dimension]
      else return this.each(function(idx){
        el = $(this)
        el.css(dimension, funcArg(this, value, idx, el[dimension]()))
      })
    }
  })

  function traverseNode(node, fun) {
    fun(node)
    for (var i = 0, len = node.childNodes.length; i < len; i++)
      traverseNode(node.childNodes[i], fun)
  }

  // Generate the `after`, `prepend`, `before`, `append`,
  // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
  adjacencyOperators.forEach(function(operator, operatorIndex) {
    var inside = operatorIndex % 2 //=> prepend, append

    $.fn[operator] = function(){
      // arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
      var argType, nodes = $.map(arguments, function(arg) {
            var arr = []
            argType = type(arg)
            if (argType == "array") {
              arg.forEach(function(el) {
                if (el.nodeType !== undefined) return arr.push(el)
                else if ($.zepto.isZ(el)) return arr = arr.concat(el.get())
                arr = arr.concat(zepto.fragment(el))
              })
              return arr
            }
            return argType == "object" || arg == null ?
              arg : zepto.fragment(arg)
          }),
          parent, copyByClone = this.length > 1
      if (nodes.length < 1) return this

      return this.each(function(_, target){
        parent = inside ? target : target.parentNode

        // convert all methods to a "before" operation
        target = operatorIndex == 0 ? target.nextSibling :
                 operatorIndex == 1 ? target.firstChild :
                 operatorIndex == 2 ? target :
                 null

        var parentInDocument = $.contains(document.documentElement, parent)

        nodes.forEach(function(node){
          if (copyByClone) node = node.cloneNode(true)
          else if (!parent) return $(node).remove()

          parent.insertBefore(node, target)
          if (parentInDocument) traverseNode(node, function(el){
            if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' &&
               (!el.type || el.type === 'text/javascript') && !el.src){
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

  zepto.Z.prototype = Z.prototype = $.fn

  // Export internal API functions in the `$.zepto` namespace
  zepto.uniq = uniq
  zepto.deserializeValue = deserializeValue
  $.zepto = zepto

  return $
})()

// If `$` is not yet defined, point it to `Zepto`
window.Zepto = Zepto
window.$ === undefined && (window.$ = Zepto)
