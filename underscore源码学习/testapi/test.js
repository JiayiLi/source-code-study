var func = function(greeting,haha){ console.log(haha);return greeting + ': ' + this.name };
func = _.bind(func, {name: 'moe'}, 'hi');
console.log(func("huhu"));



