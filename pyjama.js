var py;
py = (function () {
    var builtin = {};

    function instance_method(name) {
        return name !== '__init__' && name !== '__new__';
    }

    function isinstance(item, classinfo) {
        return item.__class__ === classinfo;
    }

    function create(classinfo) {
        var instance = classinfo.__new__(classinfo);
        classinfo.__init__(instance);
        return instance;
    }

    builtin.staticmethod = function (func) {
        function wrapper() {
            return func.apply(this, Array.apply(this, arguments).slice(1));
        }

        return wrapper();
    };

    function bound_members(instance, classinfo) {
        function append(item, array) {
            // adds the item on the first position of the array
            var result = new Array(array.length + 1);
            result[0] = item;
            for (var i = 1; i < result.length; i++)
                result[i] = array[i - 1];
            return result;
        }

        function bound(name) {
            var method = classinfo[name];
            instance[name] = function () {
                return method.apply(instance, append(instance, arguments));
            };
        }

        for (key in classinfo) {
            if (typeof(classinfo[key]) === 'function') {
                if (instance_method(key)) {
                    bound(key);
                }
            }
            else {
                instance[key] = classinfo[key];
            }
        }
    }

    function copy_members(from, to) {
        for (var key in from)
            to[key] = from[key];
    }

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

    function extend(child, parent) {
        var no_instance_members = ["__bases__", "__dict__", "__name__", "__class__"];

        for (var key in parent)
            if (!contains(no_instance_members, key))
                child[key] = parent[key];

        // add the parent to the bases list
        child.__bases__.push(parent);
    }

    builtin.type = (function () {
        function type(name, bases, dict) {
            if (arguments.length == 1)
                return name.__class__;
            else {
                function Class() {
                    var instance = create(Class);
                    instance.__class__ = Class;
                    bound_members(instance, Class);
                    return instance;
                }

                // init the bases list, it will be populated with the extend method
                // and isn't going to be copied from the base class
                Class.__bases__ = [];

                extend(Class, builtin.object);
                copy_members(dict, Class);

                Class.__name__ = name;
                Class.__dict__ = dict;

                return Class
            }
        }

        return type;
    })();

    builtin.object = (function () {
        function object() {
            var instance = create(object);
            instance.__class__ = object;
            bound_members(instance, object);
            return instance;
        }

        object.__name__ = 'object';
        object.__new__ = function (cls) {
            function result() {
                if (!('__call__' in result))
                    throw 'object is not callable';

                return result.__call__.apply(result, arguments);
            }

            return result;
        };
        object.__init__ = function (self) { };
        object.__base__ = undefined; // object.__base__ returns nothing
        object.__bases__ = [];
        object.__class__ = builtin.type;

        object.__setattr__ = function (self, name, value) {
            throw new AttributeError(object, name);
        };
        object.__getattr__ = function (self, name) {
            return self[name];
        };
        object.__delattr__ = function (self, name) {
            self[name] = undefined
        };

        return object;
    })();

    builtin.type.__bases__ = [builtin.object];
    builtin.type.__base__ = builtin.object;

    builtin.function_base=(function(){
        // all functions inherit from the class function in python, however
        // this class isn't in the builtins.
        function function_base() {
            // NOTE: __doc__, __globals__, __code__ not included
            return function_base.__call__.apply(function_base, arguments);
        }



        return function_base;
    })();

    return builtin;
})();

var main = (function () {
    var main = {};
    var A;
    A = (function () {
        var __dict__ = {};
        var x;
        x = 1;
        __dict__.x = x;
        return py.type('A', [], __dict__);
    })();
    main.A = A;
    return main;
})();