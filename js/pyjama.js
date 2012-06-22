var py = (function () {
    var builtin = {};

    var len = builtin.len = function(seq){
        // hasattr and getattr can't be called here, because infinite recursion
        if ( seq.__len__)
        {
            return seq.__len__();
        }
        else if (seq.length!==undefined) {
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

    function copy_members(from, to) {
        for (var key in from)
            to[key] = from[key];
    }

    function object() {
        return object.__call__.apply(object, arguments);
    }
    builtin.object=object;

    // type(object) -> the object's type
    // type(name, bases, dict) -> a new type
    function type(name, bases, dict) {
        return type.__call__(name, bases, dict);
    }
    builtin.type=type;

    var $function = builtin.$function = (function () {
        function $function(code, name, data) {
            // __new__
            function $function_instance() {
                // todo proccess arguments and include starargs and kwargs
//            var result = process_arguments(data, arguments);
                var result = arguments;
                return code.apply($function_instance, result);
            }

            // __init__
            $function_instance.__name__ = name;
            $function_instance.__dict__ = $function_instance;
            $function_instance.__call__ = $function_instance;

            $function_instance.__class__ = $function;

            $function_instance.__code__ = code;

            return $function_instance;
        }

        $function.__name__ = '$function';
        $function.__dict__ = $function;
        $function.__call__ = $function;

        $function.__class__ = type;
        $function.__base__ = object;
        $function.__bases__ = [object];
        $function.__mro__ = [$function, object];

        $function.__getattribute__ = $getattribute;

        $function.__get__ = (function () {
            // function __get__ needs to behave like an instance of $function
            function $function_instance(self, instance, C) {
                // bounded functions are implemented using descriptors
                // return a bound method passing the instance as the first argument implicitly
                if (instance) {
                    return $method(self, instance, C);
                }
                return self;
            }

            $function_instance.__name__ = '__get__';
            $function_instance.__dict__ = $function_instance;
            $function_instance.__call__ = $function_instance;

            $function_instance.__class__ = $function;

            $function_instance.__code__ = $function_instance;

            return $function_instance;
        })();

        return $function;
    })();

    var $method = builtin.$method=function(func, instance, C){
        function $method(){
            var args=append(instance, arguments);
            return func.apply(instance, args);
        }

        $method.__name__= func.__name__;
        $method.__dict__ = $method;
        $method.__call__ = $method;

        $method.__code__ = func.__code__;

        $method.__class__ = type;
        $method.__base__=object;
        $method.__bases__ = [object];
        $method.__mro__=[$method, object];

        // Special read-only attributes
        $method.__self__ = instance; // the class instance object
        $method.__func__ = func; // the function object
        $method.__doc__ = func.__doc__; // __doc__ is the method’s documentation (same as __func__.__doc__);
        $method.__module__= func.__module__; // __module__ is the name of the module the method was defined in

        return $method;
    };

    var $getattribute = $function(function (objectname, attrname){
        // flag used to signal no attribute
        var no_attribute={};

        function find_attribute(target) {
            // returns the attribute from the type hierachy of target, assuming that target is a type
            if (attrname in target.__dict__) {
                return target.__dict__[attrname];
            }
            // search all bases of target, possibly using the mro
            for (var i=1; i<len(target.__dict__.__mro__);i++)
                if (target.__mro__[i][attrname])
                    return target.__mro__[i][attrname];

            return no_attribute;
        }

        function is_descriptor(attribute) {
            // base class when searching a function instance
            if (attribute.__class__ === $function)
                return true;

            try {
                var _get=$getattribute(attribute, '__get__');
                return true;
            } catch (e) {
                // catch only attribute errors
                return false;
            }
        }

        function check_descriptor(attribute){
            try {
                var _get = $getattribute(attribute, '__get__');

                // If binding to an object instance, a.x is transformed into the call:
                // type(a).__dict__['x'].__get__(a, type(a)).
                if (!isinstance(objectname, type))
                    return _get(objectname, type(objectname));
                else
                    return _get(undefined, type(objectname))

            } catch (e) {
                // catch only attribute errors
                return attribute;
            }
        }

        // implements attribute search on objects
        // 1. If attrname is a special (i.e. Python-provided) attribute for objectname, return it.


        // 2. Check objectname.__class__.__dict__ for attrname. If it exists and is a
        //   data-descriptor, return the descriptor result. Search all bases of objectname.__class__
        //   for the same case.
        var attribute=find_attribute(objectname.__class__);
        if (attribute!==no_attribute && is_descriptor(attribute))
            return check_descriptor(attribute);

        // 3. Check objectname.__dict__ for attrname, and return if found. If objectname is a
        //   class, search its bases too. If it is a class and a descriptor exists in it or its bases, return the
        //   descriptor result.
        if ('__mro__' in objectname.__dict__)
        {
            // objectname is a class
            var attr=find_attribute(objectname);
            return check_descriptor(attr);
        } else {
            if (attrname in objectname.__dict__)
                return check_descriptor(objectname.__dict__[attrname]);
        }

        // 4. Check objectname.__class__.__dict__ for attrname. If it exists and is a non-data
        //   descriptor, return the descriptor result. If it exists, and is not a descriptor, just return it. If it
        //   exists and is a data descriptor, we shouldn't be here because we would have returned at
        //   point 2. Search all bases of objectname.__class__ for same case.
        if (attribute!==no_attribute)
            return attribute;

        // 5. Raise AttributeError
        throw 'AttributeError()';
    },'__getattribute__',{});
    // at this point $getattribute.__getattribute__ is undefined (assigned to $getattribute), fix it!!
    // this should be the only case where this happens as $getattribute holds the python method resolution order
    $getattribute.__getattribute__ = $getattribute;
    $function.__getattribute__ = $getattribute;

    // configure object properties
    {
        object.__name__ = 'object';
        object.__base__ = undefined; // object.__base__ returns nothing
        object.__bases__ = [];

        var __object_dict__ = {
            // the object's class
            __class__: type,
            // str(string[, encoding[, errors]]) -> str
            //
            // Create a new string object from the given encoded string.
            // encoding defaults to the current default string encoding.
            // errors can be 'strict', 'replace' or 'ignore' and defaults to 'strict'.
            __doc__: 'The most base type',

            __getattribute__: $getattribute,

            __new__: function(cls){
                // T.__new__(S, ...) -> a new object with type S, a subtype of T

                // Called to create a new instance of class cls. __new__() is a static method
                // don't need to declare it as such

                // this will be the object instance
                // note that when called calls the __call__ method
                function instance() {
                    if (!hasattr(instance, '__call__'))
                        throw 'object is not callable';

                    // call method should be bound to the instance
                    return getattr(instance, '__call__').apply(instance, arguments);
                }

                instance.__class__ = cls;
                instance.__dict__ = {};

                return instance;
            },
            __call__: function() {
                // when object is called returns a new instance
                var instance= object.__new__.apply(object, append(object, arguments));
                getattr(instance,'__init__').apply(instance, arguments);
                return instance;
            },
            __init__: $function(function(self){
                // x.__init__(...) initializes x; see x.__class__.__doc__ for signature
            }, '__init__', {}),
            __mro__: [object],

            __ne__: function(self){
                // x.__ne__(y) <==> x!=y

                // <slot wrapper '__ne__' of 'object' objects>
            },
            __setattr__: function(self){
                // x.__setattr__('name', value) <==> x.name = value

                // <slot wrapper '__setattr__' of 'object' objects>
            },
            __reduce_ex__: function(self){
                // helper for pickle

                // <method '__reduce_ex__' of 'object' objects>
            },
            __subclasshook__: function(self){
                // Abstract classes can override this to customize issubclass().
                //
                // This is invoked early on by abc.ABCMeta.__subclasscheck__().
                // It should return True, False or NotImplemented.  If it returns
                // NotImplemented, the normal algorithm is used.  Otherwise, it
                // overrides the normal algorithm (and the outcome is cached).

                // <method '__subclasshook__' of 'object' objects>
            },
            __reduce__: function(self){
                // helper for pickle

                // <method '__reduce__' of 'object' objects>
            },
            __str__: function(self){
                // x.__str__() <==> str(x)

                // <slot wrapper '__str__' of 'object' objects>
            },
            __format__: function(self){
                // default object formatter

                // <method '__format__' of 'object' objects>
            },
            __delattr__: function(self){
                // x.__delattr__('name') <==> del x.name

                // <slot wrapper '__delattr__' of 'object' objects>
            },
            __le__: function(self){
                // x.__le__(y) <==> x<=y

                // <slot wrapper '__le__' of 'object' objects>
            },
            __repr__: function(self){
                // x.__repr__() <==> repr(x)

                // <slot wrapper '__repr__' of 'object' objects>
            },
            __gt__: function(self){
                // x.__gt__(y) <==> x>y

                // <slot wrapper '__gt__' of 'object' objects>
            },
            __hash__: function(self){
                // x.__hash__() <==> hash(x)

                // <slot wrapper '__hash__' of 'object' objects>
            },
            __lt__: function(self){
                // x.__lt__(y) <==> x<y

                // <slot wrapper '__lt__' of 'object' objects>
            },
            __eq__: function(self){
                // x.__eq__(y) <==> x==y

                // <slot wrapper '__eq__' of 'object' objects>
            },
            __sizeof__: function(self){
                // __sizeof__() -> size of object in memory, in bytes

                // <method '__sizeof__' of 'object' objects>
            },
            __ge__: function(self){
                // x.__ge__(y) <==> x>=y

                // <slot wrapper '__ge__' of 'object' objects>
            }
        };

        copy_members(__object_dict__, object);

        // dictionary wrapper using the object itself
        object.__dict__ = object;
    }

    // configure type properties
    {
        function extend(child, parent) {
            // add the parent to the bases list
            child.__base__=parent;
            child.__bases__.push(parent);
        }

        var __type_dict__ = {
            __base__: object,
            __bases__: [object],
            __class__: type,
            __module__: builtin,
            __name__: 'type',
            __doc__: 'type of all types',
            __mro__: [type, object],
            __dict__: undefined,
            __weakrefoffset__: undefined,
            __abstractmethods__: undefined,
            __instancecheck__: undefined,
            __dictoffset__: undefined,
            __itemsize__: undefined,
            __subclasscheck__: undefined,
            __basicsize__: undefined,
            __flags__: undefined,

            // x.__getattribute__('name') <==> x.name
            // this method is here to prevent cyclic calls when: getattr(type, '__getattribute__')
            __getattribute__: object.__getattribute__,

            __new__: function(cls){
                // T.__new__(S, ...) -> a new object with type S, a subtype of T

                // <built-in method __new__ of type object at 0x1E1B7E20>
            },

            __init__: $function(function(self){
                // x.__init__(...) initializes x; see x.__class__.__doc__ for signature

                // <slot wrapper '__init__' of 'type' objects>
            },'__init__',{}),
            __call__: function(name, bases, dict){
                // x.__call__(...) <==> x(...)

                if (bases==undefined && dict===undefined){
                    if (name.__class__)
                        return name.__class__;

                    // todo convert the JS object to a python object
                    //return typeof(name);
                }
                else {
                    // when a type is called it returns a new type
                    function Class() {
                        // create the instance
                        var instance = getattr(Class, '__new__').apply(Class, append(Class, arguments));

                        instance.__class__ = Class;

                        // members bound to it's instance should be of type method,
                        // but that could depend on the implementation, because
                        // the type method isn't part of the python builtins
                        // bound_members(instance, Class, no_instance_members);

                        getattr(instance, '__init__').apply(instance, arguments);
                        return instance;
                    }

                    // init the bases list, it will be populated with the extend method
                    // and isn't going to be copied from the base class
                    Class.__bases__ = [];
                    Class.__class__ = type;

                    extend(Class, builtin.object);

                    Class.__new__ = function(cls){
                        return object.__new__(Class);
                    };

                    // TODO: Change this to add the methods like the new-style class (diamond form)
                    for (var i=0; i<len(bases); i++)
                        extend(Class, bases[i])

                    copy_members(dict, Class);
                    Class.__dict__ = Class;

                    Class.__name__ = name;

                    return Class
                }
            },
            __setattr__: function(self){
                // x.__setattr__('name', value) <==> x.name = value

                // <slot wrapper '__setattr__' of 'type' objects>
            },
            __subclasses__: function(self){
                // __subclasses__() -> list of immediate subclasses

                // <method '__subclasses__' of 'type' objects>
            },
            __prepare__: function(self){
                // __prepare__() -> dict
                // used to create the namespace for the class statement

                // <method '__prepare__' of 'type' objects>
            },
            __delattr__: function(self){
                // x.__delattr__('name') <==> del x.name

                // <slot wrapper '__delattr__' of 'type' objects>
            },
            mro: function(self){
                // mro() -> list
                // return a type's method resolution order

                // <method 'mro' of 'type' objects>
            },
            __repr__: function(self){
                // x.__repr__() <==> repr(x)

                // <slot wrapper '__repr__' of 'type' objects>
            }
        };

        copy_members(__type_dict__, type);
        type.__dict__=type;
    }

    var getattr = builtin.getattr = $function(function getattr(target, name, default_value){
            // method for getting attributes from the target, exist and it's bounded
            var _getattribute=$getattribute(target, '__getattribute__');

            try {
                return _getattribute(name);
            } catch(e) { }

            try {
                // if __getattr__ isn't defined this trows an AttributeError
                var _getattr=_getattribute('__getattr__');
                // if the method is defined, then return it's value
                return _getattr(name);
            } catch(e) { }

            // if a default value is provided
            if (len(arguments)==3){
                return default_value;
            }

            // in other case raise an AttributeError
            throw 'attribute was not found: ' + name;
            throw AttributeError();
        }, 'getattr',{});

    var hasattr = builtin.hasattr = function(target, name){
        // hasattr(object, name) -> bool
        // Return whether the object has an attribute with the given name.
        //  (This is done by calling getattr(object, name) and catching exceptions.)
        var none={};

        return getattr(target, name, none) !== none;
    };

    var setattr = builtin.setattr=function(target, name, value){
        // todo implement builtins.setattr
        throw 'not implemented';
    };

    var delattr = builtin.delattr = function(target, name){
        // delattr(object, name)
        // Delete a named attribute on an object; delattr(x, 'y') is equivalent to ``del x.y''.
        throw 'not implemented'
    };

//    var number=builtin.number=(function(){
//        var __dict__={
//            __add__: function(self, other){ return self+other; },
//            __sub__: function(self, other){ return self-other; },
//            __mult__: function(self, other){ return self*other; },
//            __div__: function(self, other){ return self/other; }
//        };
//
//        return type('number',[], __dict__);
//    })();

    // prepare arrays to behave like python lists
    (function (){
        // Called to implement the built-in function len()
        Array.prototype.__len__ = function(){return this.length;};
    })();

    // prepare numbers to behave like python numbers
    (function (){
        // Number represents an instance of the class number
//        Number.prototype.__class__ = number;
    })();

    // This type has a single value. There is a single object with this value
    // Numeric methods and rich comparison methods may return this value if they
    // do not implement the operation for the operands provided. (The interpreter will
    // then try the reflected operation, or some other fallback, depending on the operator.)
    // Its truth value is true.
    //var NotImplemented = builtin.NotImplemented = object();

    function process_arguments(data, args) {
        // parses an array of arguments into other array of arguments that should be passed to the function with the given data
        var func_args = len(data.arg_names), // number of arguments in the original function
            call_args = len(args) - 2, // number of arguments in the call stmt
            kwargs = args[len(args) - 1];

        var result = new Array(func_args); // arguments that will be passed to the target function
        for (var i = 0; i < func_args; i++) {
            // skip the first argument because it's the function itself
            var arg_name = data.arg_names[i];
            if (i < call_args) {
                result[i] = args[i + 1];
                if (arg_name in kwargs)
                    throw 'parameter specified more than once';
            }
            else {
                if (kwargs[arg_name])
                    result[i] = kwargs[arg_name];
                else if (i >= func_args - len(self.__defaults__)) {
                    // no value was specified for the given parameter, use the default one
                    result[i] = self.__defaults__[i - (func_args - len(self.__defaults__))];
                }
                else throw 'missing parameter ' + arg_name;
            }
        }

        if (func_args < call_args) {
            // more parameters than needed, add them to the star args
            if (!data.starargs)
                throw 'too many parameters';
            var star_length = call_args - func_args;
            if ('$arg' in kwargs)
                star_length += len(kwargs.$arg);
            // this shoould be a tuple, i think...
            var start_args = new Array(star_length);
            for (i = 0; i < call_args - func_args; i++)
                start_args[i] = args[func_args + 1 + i];
            if (kwargs.$arg) {
                for (i = call_args - func_args; i < star_length; i++)
                    start_args[i] = kwargs.$arg[call_args - func_args - i];
            }
            result.push(start_args);
        }

        // check for duplicated values and add new items
        if (data.kwarg) {
            // check for extra keys in the dictionary
            // this should be a Python dict
            // and the original dict should be cloned
            result.push(data.kwarg);
        }

        return result;
    }

    builtin.dict=(function(){
        // todo implement dict in JS, possibly using the compiler itself
        var dict={

        };

//        return type('dict', [], dict);
    })();

    builtin.print = function(x) { console.log(getattr(x, '__str__')()); };
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

    return builtin;
})();