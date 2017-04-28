// var class2type = {},
// toString = class2type.toString;
//   $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
//     class2type[ "[object " + name + "]" ] = name.toLowerCase()
//   })
// function isFunction(value) { console.log(type(value));
// 	return type(value) == "function" }
// function type(obj) {

// return obj == null ? String(obj) :
//   class2type[toString.call(obj)] || "object"
// }

// var t = [1,2,3]

// var c  = isFunction(t);
// console.log(c);


// function Z(dom, selector) {
// 	var i, len = dom ? dom.length : 0
// 	console.log(dom);
// 	for (i = 0; i < len; i++) this[i] = dom[i];
// 	this.length = len
// 	this.selector = selector || ''
// }

// var t = new Z ($('li'),);
// console.log(t.length);
// var hZ = function(dom, selector) {
// 	console.info(dom);
// 	console.info(selector);
//     return new Z(dom, selector)
// }
// var isZ = function(object) {
// 	console.log(object instanceof  hZ);
// return object instanceof  hZ
// }


// var t = [1,2,3,1,3];
// var c = function(t){
// 	return t.filter(function(value,idx){
// 		return t.indexOf(value) == idx;
// 	})
// }
// console.log(c(t));
// 
// 


var hei = {
	constructor:c,
	concat:function(){
		console.log("concat");
	}
}
var c = [];
c.prototype = hei;

console.log(c);


// console.log(window);

