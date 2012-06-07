var py;
py = (function () {
    var builtin = {};

    (function (){
        // prepare arrays to behave like python lists

        // Called to implement the built-in function len()
        Array.prototype.__len__ = function(){return this.length;};
    })();

    var len;
    len = builtin.len = function(seq){
        if (seq.__len__)
            return seq.__len__();

        throw 'object has no length'
    };

    var issubclass;
    issubclass = builtin.issubclass = function (C, B){
        // issubclass(C, B) -> bool

        // Return whether class C is a subclass (i.e., a derived class) of class B.
        // When using a tuple as the second argument issubclass(X, (A, B, ...)),
        // is a shortcut for issubclass(X, A) or issubclass(X, B) or ... (etc.).
        if (B===builtin.object || C==B)
            return true;
        else if (!builtin.issubclass(C.__class__, builtin.type) || !builtin.issubclass(B.__class__, builtin.type)){
            throw 'C and B must be types.'
        }
        else{
            for (var i=0; i<len(C.__bases__); i++){
                if (builtin.issubclass(C.__bases__[i], B))
                    return true;
            }
            return false;
        }
    };

    var isinstance;
    isinstance=builtin.isinstance = function (item, classinfo) {
        if (item.__class__)
            return issubclass(item.__class__, classinfo);
        else return false;
    };

    var iter;
    iter = builtin.iter = function(source, sentinel){
        // iter(iterable) -> iterator
        // iter(callable, sentinel) -> iterator

        // Get an iterator from an object.  In the first form, the argument must
        // supply its own iterator, or be a sequence.
        // In the second form, the callable is called until it returns the sentinel.

        return source.__iter__();
    };

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
            // TODO if the object doesn't contain the method then search it in the tree
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

    var type;
    type = builtin.type = (function () {
        // type(object) -> the object's type
        // type(name, bases, dict) -> a new type
        function type(name, bases, dict) {
            return type.__call__(name, bases, dict);
        }

        type.__bases__= [];
        type.__class__ = type;
        extend(type, builtin.object);

        type.__call__ = function(name, bases, dict){
            if (arguments.length == 1)
                return name.__class__;
            else {
                // when a type is called it returns a new type
                function Class() {
                    var instance = Class.__new__.apply(Class, append(Class, arguments));

                    instance.__class__ = Class;

                    // members bound to it's instance should be of type method,
                    // but that could depend on the implementation, because
                    // the type method isn't part of the python builtins
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
                var reversed = bases.reverse();
                for (var i=0; i<len(reversed);i++)
                    extend(Class, bases[i])

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

//                // get specific intepreter data about this function
//                var data=self.__$data__;
//                var length= data.parameter_count;
//                if (data.starargs) length+=1;
//                if (data.kwargs) length+=1;
//
//                if (length<len(arguments)) throw 'invalid parameters';
//
//                var result=new Array(length);
//                for (var i=0; i<data.parameter_count; i++)
//                    // skip the first argument because it's the function itself
//                    result[i]=arguments[i+1];

                return self.__code__.apply(this, args);
            },
            __init__: function(self, attributes, code) {
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

    builtin.method=(function(){
        // represents bound methods

        var dict={
            __call__: function(self){
                // TODO: process arguments here... (defaults, varargs, kwargs, etc...)
                // skip the first argument because it's the function itself
                var args=Array.apply(this, arguments).slice(1);


                return self.__code__.apply(this, args);
            },
            __init__: function(self, attributes, code) {
                // Note: __doc__, __dict__, __closure__, __annotations__ missing
            }
        };

        return builtin.type('method', [], dict);
    })();

    builtin.dict=(function(){
        // todo implement dict in JS, possibly using the compiler itself
        var dict={

        };

        return type('dict', [], dict);
    })();

    builtin.print = console.log;
    builtin.input=function(msg){ prompt(msg,''); };

    return builtin;
})();

var type=py.type, function_base=py.function_base, iter=py.iter, range=py.range, next=py.next, isinstance=py.isinstance, print=py.print;
var main=(function(){
    var main={};
    var A, B, C;
    A = (function(){
        var __dict__={};
        var foo;
        foo = (function(){
            function foo(self){

                print("foo from A")
            }

            var attributes={
                name: 'foo',
                module: 'main',
                defaults: [],
                globals: main,
                kwdefaults: {}
            }

            return function_base(attributes, foo);
        })();
        __dict__.foo = foo;
        return type('A', [], __dict__);
    })();
    B = (function(){
        var __dict__={};
        var foo, only_bb;
        foo = (function(){
            function foo(self){

                print("foo from B")
            }

            var attributes={
                name: 'foo',
                module: 'main',
                defaults: [],
                globals: main,
                kwdefaults: {}
            }

            return function_base(attributes, foo);
        })();
        only_bb = (function(){
            function only_bb(self){

                return 1;
            }

            var attributes={
                name: 'only_bb',
                module: 'main',
                defaults: [],
                globals: main,
                kwdefaults: {}
            }

            return function_base(attributes, only_bb);
        })();
        __dict__.foo = foo;
        __dict__.only_bb = only_bb;
        return type('B', [], __dict__);
    })();
    C = (function(){
        var __dict__={};
        var foo, bla;
        foo = (function() {
            function foo(self) {

                A.foo(self)
                B.foo(self)
                print("foo from C")
            }

            var attributes;
            attributes = {
                name:'foo',
                module:'main',
                defaults:[],
                globals:main,
                kwdefaults:{}
            };

            return function_base(attributes, foo);
        })();
        bla = (function(){
            function bla(self){

                print("bla from C")
            }

            var attributes={
                name: 'bla',
                module: 'main',
                defaults: [],
                globals: main,
                kwdefaults: {}
            }

            return function_base(attributes, bla);
        })();
        __dict__.foo = foo;
        __dict__.bla = bla;
        return type('C', [A, B], __dict__);
    })();
    main.A = A;
    main.B = B;
    main.C = C;
    return main;
})();