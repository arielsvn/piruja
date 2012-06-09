var py = (function () {
    var builtin = {};

    (function (){
        // prepare arrays to behave like python lists

        // Called to implement the built-in function len()
        Array.prototype.__len__ = function(){return this.length;};
    })();

    var len = builtin.len = function(seq){
        if (seq.__len__)
            return seq.__len__();
        else if (seq.length){
            // function argument length
            return seq.length;
        }

        throw 'object has no length'
    };

    var bool = builtin.bool = function(x){
        // Convert a value to a Boolean, using the standard truth testing procedure.
        // If x is false or omitted, this returns False; otherwise it returns True.
        if (x===undefined || x === false) {
            return false;
        }
        else if ('__bool__' in x)
            return x.__bool__();
        else if ('__len__' in x)
        {
            // When __bool is not defined, __len__() is called, if it is defined (see below)
            // and True is returned when the length is not zero
            return x.__len__() !== 0;
        }
        else {
            // If a class defines neither __len__() nor __bool__(), all its instances are considered true.

            // delegate to JS truth value testing...
            if (x)
                return true;
            else
                return false;
        }
    };

    var issubclass = builtin.issubclass = function (C, B){
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
                if (issubclass(C.__bases__[i], B))
                    return true;
            }
            return false;
        }
    };

    var isinstance=builtin.isinstance = function (item, classinfo) {
        if (item.__class__)
            return issubclass(item.__class__, classinfo);
        else return false;
    };

    var iter = builtin.iter = function(source, sentinel){
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


    var object = builtin.object = (function () {
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

    var type = builtin.type = (function () {
        // type(object) -> the object's type
        // type(name, bases, dict) -> a new type
        function type(name, bases, dict) {
            return type.__call__(name, bases, dict);
        }

        type.__bases__= [];
        type.__class__ = type;
        extend(type, builtin.object);

        type.__call__ = function(name, bases, dict){
            if (bases==undefined && dict===undefined){
                if (name.__class__)
                    return name.__class__;

                // todo convert the JS object to a python object
                return typeof(name);
            }
            else {
                // when a type is called it returns a new type
                function Class() {
                    // create the instance
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

                Class.__new__ = function(cls){
                    return builtin.object.__new__(Class);
                };

                // TODO: Change this to add the methods like the new-style class (diamond form)
                var reversed = bases.reverse();
                for (var i=0; i<len(reversed); i++)
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

    // This type has a single value. There is a single object with this value
    // Numeric methods and rich comparison methods may return this value if they
    // do not implement the operation for the operands provided. (The interpreter will
    // then try the reflected operation, or some other fallback, depending on the operator.)
    // Its truth value is true.
    var NotImplemented;
    NotImplemented = builtin.NotImplemented = object();

    var function_base;

    function_base = builtin.function_base=(function(){
        // all functions inherit from the class function in python, however
        // this class isn't in the builtins.

        var dict={
            __call__: function(self){
                // TODO: process arguments here... (defaults, varargs, kwargs, etc...)

                // get specific interpreter data about this function
                var data=self.__$data__,
                    func_args = len(data.arg_names), // number of arguments in the original function
                    call_args=len(arguments)-2, // number of arguments in the call stmt
                    kwargs = arguments[len(arguments)-1];

                var result=new Array(func_args); // arguments that will be passed to the target function
                for (var i=0; i<func_args; i++)
                {
                    // skip the first argument because it's the function itself
                    var arg_name=data.arg_names[i];
                    if (i<call_args)
                    {
                        result[i]=arguments[i+1];

                        if (arg_name in kwargs)
                            throw 'parameter specified more than once';
                    }
                    else {
                        if (kwargs[arg_name])
                            result[i] = kwargs[arg_name];
                        else if (i >= func_args - len(self.__defaults__)){
                            // no value was specified for the given parameter, use the default one
                            result[i]=self.__defaults__[i - (func_args - len(self.__defaults__))];
                        }
                        else throw 'missing parameter ' + arg_name;
                    }
                }

                if (func_args<call_args) {
                    // more parameters than needed, add them to the star args
                    if (!data.starargs)
                        throw 'too many parameters';

                    var star_length=call_args - func_args;
                    if ('$arg' in kwargs)
                        star_length += len(kwargs.$arg);

                    // this shoould be a tuple, i think...
                    var start_args=new Array(star_length);
                    for (i=0; i< call_args - func_args; i++)
                        start_args[i]=arguments[func_args + 1 + i];
                    if (kwargs.$arg){
                        for (i=call_args-func_args; i< star_length; i++)
                            start_args[i]=kwargs.$arg[call_args-func_args-i];
                    }
                    result.push(start_args);
                }

                // check for duplicated values and add new items
                if (data.kwarg){
                    // check for extra keys in the dictionary
                    // this should be a Python dict
                    // and the original dict should be cloned
                    result.push(data.kwarg);
                }

                return self.__code__.apply(this, result);
            },
            __init__: function(self, attributes, code) {
                // Note: __doc__, __dict__, __closure__, __annotations__ missing
                self.__name__ = attributes.name;
                self.__module__ = attributes.module;
                self.__defaults__ = attributes.defaults;
                self.__globals__ = attributes.globals;
                self.__kwdefaults__ = attributes.kwdefaults;
                self.__code__ = code;
                self.__$data__ = attributes.__$data__;
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

    // all operation must be defined because the interpreter must test
    // if the target types contains the special method
    // this shouldn't be used by any python program as this is part of the interpreter implementation
    // todo implement operations
    var $op = builtin.$op={
        // bool operations, use arguments
        and: function(){
            var result=true;
            for (var i=0; i<arguments.length; i++)
            {
                result = result && bool(arguments[i]);
                if (!result) return false;
            }
            return true;
        },
        or: function(){
            var result=false;
            for (var i=0; i<arguments.length; i++)
            {
                result = result || bool(arguments[i]);
                if (result) return true;
            }
            return false;
        },

        // unary operations
        // Invert | Not | UAdd | USub
        invert: function(x){

        },
        not: function(x){

        },
        uadd: function(x){

        },
        usub: function(x){

        },

        // binary operations
        // Add | Sub | Mult | Div | Mod | Pow | LShift | RShift | BitOr | BitXor | BitAnd | FloorDiv
        add : function(x, y) {
            var result;
            if (hasattr(x, '__add__'))
            {
                result = getattr(x, '__add__')(y);
                if (result!==NotImplemented)
                    return result;
            }

            if (type(x) !== type(y) && hasattr(y, '__radd__'))
            {
                result=getattr(y, '__radd__')(x);
                if (result!==NotImplemented)
                    return result;
            }

            if (type(x)=='number' && type(y)==='number'){
                return x+y;
            }

            // check JS types and add them too

            throw 'TypeError: unsupported operand type(s) for +: object and object';
        },
        sub : function(x,y){
            var result;
            if (hasattr(x, '__sub__'))
            {
                result = getattr(x, '__sub__')(y);
                if (result!==NotImplemented) return result;
            }

            if (type(x) !== type(y) && hasattr(y, '__rsub__'))
            {
                result=getattr(y, '__rsub__')(x);
                if (result!==NotImplemented) return result;
            }

            // check JS types and sub them too

            throw 'TypeError: unsupported operand type(s) for -: object and object';
        },
        mult : function(x,y){

        },
        div : function(x,y){

        },
        mod : function(x,y){

        },
        pow : function(x,y){

        },
        lshift : function(x,y){

        },
        rshift : function(x,y){

        },
        bitor : function(x,y){

        },
        bitxor : function(x,y){

        },
        bitand : function(x,y){

        },
        floordiv: function(x,y){

        },

        // augmented operations
        iadd : function(target,value){

        },
        isub : function(target,value){

        },
        imult : function(target,value){

        },
        idiv : function(target,value){

        },
        imod : function(target,value){

        },
        ipow : function(target,value){

        },
        ilshift : function(target,value){

        },
        irshift : function(target,value){

        },
        ibitor : function(target,value){

        },
        ibitxor : function(target,value){

        },
        ibitand : function(target,value){

        },
        ifloordiv: function(target,value){

        },

        // comparison operators
        eq: function(x,y){
            // x == y

        },
        noteq: function(x,y){
            // x != y
        },
        lt: function(x,y){
            // x < y
        },
        lte: function(x,y){
            // x <= y
        },
        gt: function(x,y){
            // x > y
        },
        gte: function(x,y){
            // x >= y
        },
        is: function(x,y){
            // x is y
        },
        isnot: function(x,y){
            // x not is y

        },
        into: function(x,y){
            // x in y
            // operator 'in', changed because 'in' is a JS reserved word

        },
        notin: function(x,y){
            // x not in y

        }

    };

    var getattr = builtin.getattr = (function(){
        function getattr(target, name, default_value){
            // todo implement builtins.getattr

            // The default behavior for attribute access is to get, set, or delete the attribute from an object’s dictionary
            // a.x has a lookup chain starting with a.__dict__['x'], then type(a).__dict__['x'], and continuing
            // through the base classes of type(a) excluding metaclasses.

            function bound(attribute){
                if (issubclass(target, type)){
                    // if the target is a type, then return the method
                    return attribute;
                }
                else if (isinstance(attribute, function_base) || typeof(attribute) === 'function'){
                    // if the target is a function return a new function with the target as the first argument
                    function bounded(){
                        return attribute.apply(target, append(target, arguments));
                    }
                    return bounded
                }

                return attribute;
            }

            // a.__dict__[name]
            if (name in target){
                return bound(target.__dict__[name]);
            }
            else if (name in type(target)){
                return bound(type(target).__dict__[name]);
            }
            else{
                // search on the base classes
                // todo search for an attribute on the class hierarchy

                // if the attribute isn't found return the default value if given
                if (len(arguments)==3)
                    return default_value;

                throw 'missing attribute'
                throw AttributeError();
            }
        }

        return getattr;
    })();

    var hasattr = builtin.hasattr = function(target, name){
        // hasattr(object, name) -> bool
        // Return whether the object has an attribute with the given name.
        //  (This is done by calling getattr(object, name) and catching exceptions.)
        try{
            return getattr(target, name) !== undefined;
        } catch (e){
            return false;
        }
    };

    var setattr = builtin.setattr=function(target, name, value){
        // todo implement builtins.setattr
    };

    var delattr = builtin.delattr = function(target, name){
        // delattr(object, name)
        // Delete a named attribute on an object; delattr(x, 'y') is equivalent to ``del x.y''.

    };

    return builtin;
})();