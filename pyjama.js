var py;
py = (function () {
    var builtin = {};

    function isinstance(item, classinfo) {
        return item.__class__ === classinfo;
    }

    builtin.staticmethod = function (func) {
        function wrapper() {
            return func.apply(this, Array.apply(this, arguments).slice(1));
        }

        return wrapper();
    };

    // Has own property?
    function has(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }

    var
        breaker = {},
        ArrayProto = Array.prototype,
        nativeForEach = ArrayProto.forEach,
        nativeEvery = ArrayProto.every,
        nativeSome = ArrayProto.some,
        nativeIndexOf = ArrayProto.indexOf
        ;

    // The cornerstone, an `each` implementation, aka `forEach`.
    // Handles objects with the built-in `forEach`, arrays, and raw objects.
    // Delegates to **ECMAScript 5**'s native `forEach` if available.
    function each(obj, iterator, context) {
        if (obj == null) return;
        if (nativeForEach && obj.forEach === nativeForEach) {
            obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
            for (var i = 0, l = obj.length; i < l; i++) {
                if (i in obj && iterator.call(context, obj[i], i, obj) === breaker) return;
            }
        } else {
            for (var key in obj) {
                if (has(obj, key)) {
                    if (iterator.call(context, obj[key], key, obj) === breaker) return;
                }
            }
        }
    }

    // Determine whether all of the elements match a truth test.
    // Delegates to **ECMAScript 5**'s native `every` if available.
    // Aliased as `all`.
    function every(obj, iterator, context) {
        var result = true;
        if (obj == null) return result;
        if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
        each(obj, function (value, index, list) {
            if (!(result = result && iterator.call(context, value, index, list))) return breaker;
        });
        return result;
    }

    // Determine if at least one element in the object matches a truth test.
    // Delegates to **ECMAScript 5**'s native `some` if available.
    // Aliased as `any`.
    function any(obj, iterator, context) {
        iterator || (iterator = _.identity);
        var result = false;
        if (obj == null) return result;
        if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
        each(obj, function (value, index, list) {
            if (result || (result = iterator.call(context, value, index, list))) return breaker;
        });
        return !!result;
    }

    // Determine if a given value is included in the array or object using `===`.
    // Aliased as `contains`.
    function contains(obj, target) {
        var found = false;
        if (obj == null) return found;
        if (nativeIndexOf && obj.indexOf === nativeIndexOf)
            return obj.indexOf(target) != -1;
        found = any(obj, function (value) {
            return value === target;
        });
        return found;
    }

    function append(item, array) {
        var length=1;
        if (array) length=array.length+1;
        // adds the item on the first position of the array
        var result = new Array(length);
        result[0] = item;
        for (var i = 1; i < result.length; i++)
            result[i] = array[i - 1];
        return result;
    }

    function bound_members(instance, classinfo, except) {
        function bound(name) {
            var method = classinfo[name];
            instance[name] = function () {
                return method.apply(instance, append(instance, arguments));
            };
        }

        for (var key in classinfo) {
            if (except && !(contains(except, key))) {
                if (typeof(classinfo[key]) === 'function') {
                    // bound all members except the constructor
                    bound(key);
                }
                else {
                    instance[key] = classinfo[key];
                }
            }
        }
    }

    function copy_members(from, to) {
        for (var key in from)
            to[key] = from[key];
    }

    var no_instance_members = ['__new__', '__base__', '__bases__', '__name__', '__class__', "__dict__"];

    function extend(child, parent) {
        for (var key in parent)
            if (!contains(no_instance_members, key))
                child[key] = parent[key];

        if (!(child.__bases__))
            child.__bases__=[];

        // add the parent to the bases list
        child.__base__=parent;
        child.__bases__.push(parent);
    }

    builtin.object = (function () {
        function object() {
            return object.__call__.apply(object, arguments);
        }

        object.__name__ = 'object';
        object.__base__ = undefined; // object.__base__ returns nothing
        object.__bases__ = [];

        object.__new__ = function (cls) {
            // Called to create a new instance of class cls. __new__() is a static method
            // don't need to declare it as such
            // when object is called returns a new instance

            if (cls.__dict__ && '__new__' in cls.__dict__){
                // the class doesn't define a new method
                return cls.__new__.apply(cls, arguments);
            }
            // allocate memory for the object
            else {
                // this will be the object instance
                // note that when called calls the __call__ method
                function instance() {
                    if (!('__call__' in instance))
                        throw 'object is not callable';

                    // call method should be bound to the instance
                    return instance.__call__.apply(instance, arguments);
                }

                instance.__class__ = cls;
                instance.__dict__ = {};

                // instance don't inherit, instead bound class members (copy and add self parameter)
                bound_members(instance, cls, no_instance_members);

                // cls.__dict__ contains the members declared inside the class
                if (cls.__dict__)
                    bound_members(instance, cls.__dict__);

                return instance;
            }
        };
        object.__init__ = function (self) { };

        object.__setattr__ = function (self, name, value) {
            throw new AttributeError(object, name);
        };
        object.__getattr__ = function (self, name) {
            return self[name];
        };
        object.__delattr__ = function (self, name) {
            self[name] = undefined
        };

        object.__call__ = function(){
            // when object is called returns a new instance
            var instance= object.__new__.apply(object, append(object, arguments));
            instance.__init__.apply(instance, arguments);
            return instance;
        };

        return object;
    })();

    builtin.type = (function () {
        // type(object) -> the object's type
        // type(name, bases, dict) -> a new type
        function type(name, bases, dict) {
            return type.__call__(name, bases, dict);
        }

        type.__bases__= [];
        extend(type, builtin.object);

        type.__call__ = function(name, bases, dict){
            if (arguments.length == 1)
                return name.__class__;
            else {
                // when a type is called it returns a new type
                function Class() {
                    var instance = Class.__new__.apply(Class, append(Class, arguments));

                    instance.__class__ = Class;
                    bound_members(instance, Class, no_instance_members);

                    instance.__init__.apply(instance, arguments);
                    return instance;
                }

                // init the bases list, it will be populated with the extend method
                // and isn't going to be copied from the base class
                Class.__bases__ = [];
                Class.__class__ = type;

                extend(Class, builtin.object);

                Class.__new__=function(cls){
                    return builtin.object.__new__(Class);
                };

                // TODO: Change this to add the methods like the new-style class (diamond form)
                for (var base in bases.reverse())
                    extend(Class, base)

                Class.__dict__ = dict;
                copy_members(dict, Class);

                Class.__name__ = name;

                return Class
            }
        };

        return type;
    })();

    builtin.object.__class__ = builtin.type;

    builtin.function_base=(function(){
        // all functions inherit from the class function in python, however
        // this class isn't in the builtins.

        var dict={
            __call__: function(self){
                // TODO: process arguments here... (defaults, varargs, kwargs, etc...)
                var args=Array.apply(this, arguments).slice(1);

                return self.__code__.apply(this, args);
            },
            __init__: function(self, attributes, code){
                // Note: __doc__, __dict__, __closure__, __annotations__ missing
                self.__name__ = attributes.name;
                self.__module__ = attributes.module;
                self.__defaults__ = attributes.defaults;
                self.__globals__ = attributes.globals;
                self.__kwdefaults__ = attributes.kwdefaults;
                self.__code__ = code;
            }
        };

        return builtin.type('function', [], dict);
    })();

    return builtin;
})();

var type=py.type, function_base=py.function_base;
var main=(function(){
    var main={};
    var A;
    A = (function(){
        var __dict__={};
        var __call__;
        __call__ = (function(){
            function __call__(self, x){

                console.log(x);
            }

            return function_base(__call__);
        })();
        __dict__.__call__ = __call__;
        return type('A', [], __dict__);
    })();
    main.A = A;
    return main;
})();