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

    function bound_members(instance, classinfo) {
        function bound(name) {
            var method = classinfo[name];
            instance[name] = function () {
                return method.apply(instance, append(instance, arguments));
            };
        }

        for (var key in classinfo) {
            if (typeof(classinfo[key]) === 'function') {
                if (key != '__new__') {
                    // bound all members except the constructor
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
        child.__base__=parent;
        child.__bases__.push(parent);
    }

    function create(classinfo, args) {
        var instance = classinfo.__new__.apply(classinfo, append(classinfo, args));
        classinfo.__init__.apply(instance, append(instance, args));


        return instance;
    }

    builtin.object = (function () {
        function object() {
            return object.__call__.apply(object, arguments);
        }

        object.__name__ = 'object';
        object.__new__ = function (cls) {
            // Called to create a new instance of class cls. __new__() is a static method
            // don't need to declare it as such
            // when object is called returns a new instance

            // allocate memory for the object
            if (cls === object){
                // this will be the object instance
                // note that when called calls the __call__ method
                function result() {
                    if (!('__call__' in result))
                        throw 'object is not callable';

                    return result.__call__.apply(result, arguments);
                }

                result.__class__ = cls;
                result.__dict__ = cls.__dict__;

                // instance don't inherit, instead bound class members (copy and add self parameter)
                bound_members(result, cls);
                return result;
            } else {
                return cls.__new__.apply(cls, arguments);
            }
        };
        object.__init__ = function (self) { };
        object.__base__ = undefined; // object.__base__ returns nothing
        object.__bases__ = [];

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
            if (arguments.length == 1)
                return name.__class__;
            else {
                return type.__call__(name, bases, dict);
            }
        }

        type.__bases__=[];
        extend(type, builtin.object);

        type.__call__ = function(name, bases, dict){
            // when a type is called it returns a new type
            function Class() {
                var instance = create(Class);
                instance.__class__ = Class;
                bound_members(instance, Class);
                return instance;
            }

            // init the bases list, it will be populated with the extend method
            // and isn't going to be copied from the base class
            Class.__bases__ = [];
            Class.__class__ = type;

            extend(Class, builtin.object);

            copy_members(dict, Class);

            Class.__name__ = name;
            Class.__dict__ = dict;

            return Class
        };

        return type;
    })();

    builtin.object.__class__ = builtin.type;

    builtin.function_base=(function(){
        // all functions inherit from the class function in python, however
        // this class isn't in the builtins.
        function function_base() {
            // NOTE: __doc__, __globals__, __code__ not included
            return function_base.__call__.apply(function_base, arguments);
        }

        function_base.__bases__=[];
        extend(function_base, builtin.object);


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