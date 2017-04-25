var compiled = _.template("hello: <%= name %>");
var t = compiled({name: 'moe'});
console.log(t);





