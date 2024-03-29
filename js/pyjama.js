var py = (function () {
    var builtin = {};

    var $getid=(function(){
        // returns an unique id for an object
        var id=1;
        return function(){
            return id++;
        };
    })();

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
        if (B===object || C==B)
            return true;
        else if (!C.__class__ || !B.__class__ || !builtin.issubclass(C.__class__, type) || !builtin.issubclass(B.__class__, builtin.type)){
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

    // Has own property?
    function has(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }

    var breaker = {},
        ArrayProto          = Array.prototype,
        nativeForEach       = ArrayProto.forEach,
        nativeEvery         = ArrayProto.every,
        nativeSome          = ArrayProto.some,
        nativeIndexOf       = ArrayProto.indexOf,
        nativeFilter        = ArrayProto.filter
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

    // Return all the elements that pass a truth test.
    // Delegates to **ECMAScript 5**'s native `filter` if available.
    // Aliased as `select`.
    // filter([1, 2, 3, 4, 5, 6], function(num){ return num % 2 == 0; }); => [2,4,6]
    filter = function(obj, iterator, context) {
        var results = [];
        if (obj == null) return results;
        if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
        each(obj, function(value, index, list) {
            if (iterator.call(context, value, index, list)) results[results.length] = value;
        });
        return results;
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

    function mimic_type(obj, name){
        // given any JS object, adds the required properties so that object
        // behaves just like a type inheriting from object
        obj.__name__ = name;
        obj.__dict__ = obj;

        if (typeof(obj)==='function')
            obj.__call__ = obj;

        obj.__class__ = type;
        obj.__base__ = object;
        obj.__bases__ = [object];
        obj.__mro__ = [obj, object];

        obj.__$id__ = $getid();
    }

    function mimic_instance(obj, name, cls){
        obj.__name__ = name;
        obj.__dict__ = obj;

        if (typeof(obj)==='function')
            obj.__call__ = obj;

        obj.__class__ = cls;
        obj.__$id__ = $getid();
    }

    var $function = builtin.$function = (function () {
        // wraps the given code (function) and process calls like the python interpreter
        // code: function with the code
        // name: function name (will be stored in the __name__ attribute)
        // flags: indicates whether the function has (*args, **kwargs) in all variants (0, 1, 2, 3)
        // arg_names: array with the argument names as strings
        // defaults: array with the defaults for the len(defaults) last attributes (without *args and **kwargs)
        function $function(code, name, flags, arg_names, defaults) {
            // __new__
            function $function_instance() {
                // todo process arguments and include starargs and kwargs
//            var result = process_arguments(data, arguments);
                var result = arguments;
                return code.apply($function_instance, result);
            }

            // __init__
            mimic_instance($function_instance, name, $function);
            $function_instance.__code__ = code;

            return $function_instance;
        }

        mimic_type($function, '$function');

        $function.__get__ = (function () {
            // function __get__ needs to behave like an instance of $function
            function $function_instance(self, instance, C) {
                // bounded functions are implemented using descriptors
                // return a bound method passing the instance as the first argument implicitly
                if (instance) {
                    return $method(self, instance);
                }
                return self;
            }

            mimic_instance($function_instance, '__get__', $function);
            $function_instance.__code__ = $function_instance;

            return $function_instance;
        })();

        return $function;
    })();

    var $method = builtin.$method = function (func, instance) {
        function $method(){
            // put the instance argument as the first parameter of the given function
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

        var no_attribute={};
        function $find_attribute(target) {
            // returns the attribute from the type hierarchy of target, assuming that target is a type
            if (attrname in target.__dict__) {
                return target.__dict__[attrname];
            }

            // search all bases of target, possibly using the mro, but only if target is a type
            if (isinstance(target, type))
                for (var i=1; i<len(target.__dict__.__mro__);i++)
                    if (target.__mro__[i][attrname])
                        return target.__mro__[i][attrname];

            return no_attribute;
        }

        function check_descriptor(attribute){
            try {
                var _get = $getattribute(attribute, '__get__');

                // If binding to an object instance, a.x is transformed into the call:
                // type(a).__dict__['x'].__get__(a, type(a)).
                return _get(objectname, type(objectname));
            } catch (e) {
                // catch only attribute errors
                return attribute;
            }
        }

        function is_special_method(){
            // these methods are special
            return attrname === '__getattribute__'
                || attrname === '__get__'
                || attrname === '__new__' // __new__ is a special attribute because is a static method by default
                || attrname === '__init__'
                ;
        }

        function get_special_method(){
            // special attribute lookup works only on the object type
            var attr = $find_attribute(type(objectname));
            if (attr !== no_attribute) {
                if (attrname==='__new__'){
                    // __new__() is a static method (special-cased so you need not declare it as such)
                    // return the function not bounded, like a static method
                    return attr;
                } else
                    // objectname is an instance
                    return $function.__get__(attr, objectname, type(objectname));
            }

            throw 'AttributeError()';
        }

        // implements attribute search on objects
        // 1. If attrname is a special (i.e. Python-provided) attribute for objectname, return it.
        if (is_special_method())
            return get_special_method();

        // 2. Check objectname.__class__.__dict__ for attrname. If it exists and is a
        //   data-descriptor, return the descriptor result. Search all bases of objectname.__class__
        //   for the same case.
        var attribute=$find_attribute(objectname.__class__);
        if (attribute!==no_attribute && is_descriptor(attribute))
            return check_descriptor(attribute);

        // 3. Check objectname.__dict__ for attrname, and return if found. If objectname is a
        //   class, search its bases too. If it is a class and a descriptor exists in it or its bases, return the
        //   descriptor result.
        if ('__mro__' in objectname.__dict__)
        {
            // objectname is a class
            var attr=$find_attribute(objectname);
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

    function $create_object(cls, arguments) {
        var _new=getattr(cls, '__new__');
        // call the constructor with the class as the first argument
        var instance = _new.apply(cls, append(cls, arguments));

        // __init__ only gets called if __new__ returns an instance of the given class
        if (isinstance(instance, cls)){
            var _init=getattr(instance, '__init__');
            // initialize the instance passing the same arguments
            _init.apply(instance, arguments);
        }

        return instance;
    }

    // configure object properties
    {
        object.__name__ = 'object';
        object.__base__ = undefined; // object.__base__ returns nothing
        object.__bases__ = [];

        object.__$id__ = $getid();

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
                instance.__dict__ = instance;

                instance.__$id__ = $getid();

                return instance;
            },
            __call__: $function(function(self) {
                // when object is called returns a new instance with the given arguments
                return $create_object(object, arguments);
            }, '__call__',{}),
            __init__: $function(function(self){
                // x.__init__(...) initializes x; see x.__class__.__doc__ for signature
            }, '__init__', {}),
            __mro__: [object],

            __ne__: function(self){
                // x.__ne__(y) <==> x!=y

                // <slot wrapper '__ne__' of 'object' objects>
            },
            __setattr__: function(self, name, value){
                // x.__setattr__('name', value) <==> x.name = value

                // <slot wrapper '__setattr__' of 'object' objects>
            },
            __reduce_ex__: function(self){
                // helper for pickle

                // <method '__reduce_ex__' of 'object' objects>
            },
            __subclasshook__: $function(function(self){
                // Abstract classes can override this to customize issubclass().
                //
                // This is invoked early on by abc.ABCMeta.__subclasscheck__().
                // It should return True, False or NotImplemented.  If it returns
                // NotImplemented, the normal algorithm is used.  Otherwise, it
                // overrides the normal algorithm (and the outcome is cached).

                return NotImplemented;
            }, '__subclasshook__', {}),
            __reduce__: function(self){
                // helper for pickle

                // <method '__reduce__' of 'object' objects>
            },
            __str__: function(self){
                // x.__str__() <==> str(x)

                // <slot wrapper '__str__' of 'object' objects>
                return "<class '"+self.__name__+"'>";
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
            __getattribute__: $function(function(self, name){
                // attribute lookup in types is different from objects
                // when C.attribute, attribute is searched on C class hierarchy and returned without bounding the method

                // search all bases of target, note that all bases (including the class itself) are in the mro
                for (var i=0; i < len(self.__mro__); i++)
                    if (self.__mro__[i][name])
                        return self.__mro__[i][name];

                throw 'AttributeError()';
            }, '__getattribute__', {}),

            __new__: function(cls, name, bases, dict){
                // T.__new__(S, ...) -> a new object with type S, a subtype of T

                // result is an instance of cls
                var result = object.__new__(cls);

                // arguments below are setted here (__new__) because they are python provided
                // attributes for classes, but they could also be setted on __init__

                // add the required attributes so it can act as a class
                result.__name__ = name;

                result.__$id__ = $getid();

                var _bases=Array.apply(cls, bases);
                if (!contains(_bases, object)) _bases.push(object);

                result.__bases__ = _bases; // todo __bases__ should be a tuple
                result.__base__ = _bases[0];

                // result.__class__ is already set
                result.__mro__ = type.mro(result);

                result.__call__ = function(){
                    // a class is a callable object that when called creates a new instance of the given class
                    return $create_object(result, arguments);
                };

                copy_members(dict, result);
                // result.__dict__ = result; is already set

                return result;
            },
            // x.__init__(...) initializes x; see x.__class__.__doc__ for signature
            // use same method, note that both methods do nothing
            __init__: object.__init__,

            __call__: $function(function(name, bases, dict){
                // x.__call__(...) <==> x(...)

                if (bases==undefined && dict===undefined){
                    if (name.__class__)
                        return name.__class__;

                    // todo convert the JS object to a python object
                    //return typeof(name);
                } else {
                    // when a type is called it returns a new type
                    return $create_object(type, arguments);
                }
            }, '__call__', {}),
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

                function $merge(seqs) {

                    var result = [];

                    while (1) {

                        seqs = filter(seqs, function(seq){return seq.length>0});

                        if (seqs.length === 0) return result;

                        var head = null;

                        for (var i=0; i<seqs.length; i++) {
                            var head = seqs[i][0];

                            check_tail:
                                for (var j=0; j<seqs.length; j++) {
                                    var tail = seqs[j].slice(1);
                                    for (var k=0; k<tail.length; k++) {
                                        if (tail[k] === head) {
                                            head = null;
                                            break check_tail;
                                        }
                                    }
                                }

                            if (head !== null)
                                break;
                        }

                        if (head === null)
                            throw "Inconsistent hierarchy";

                        result.push(head);

                        for (var i=0; i<seqs.length; i++) {
                            if (seqs[i][0] === head) {
                                seqs[i].shift();
                            }
                        }
                    }

                    return result;
                }

                var seqs = [[self]];
                for (var i=0; i<self.__bases__.length; i++) {
                    seqs.push(self.__bases__[i].__mro__.slice(0));
                }
                seqs.push(self.__bases__.slice(0));

                return $merge(seqs);
            },
            __repr__: function(self){
                // x.__repr__() <==> repr(x)

                // <slot wrapper '__repr__' of 'type' objects>
            }
        };

        copy_members(__type_dict__, type);
        type.__dict__=type;
    }

    builtin.id = $function(function(p_object){
        // id(object) -> integer

        // Return the identity of an object. This is guaranteed to be unique among
        // simultaneously existing objects. (Hint: it's a number stored in the attribute
        // "__$id__" of any object.)
        // this attribute is specific for this implementation
        return p_object.__$id__;
    }, 'id', {});

    var getattr = builtin.getattr = $function(function getattr(target, name, default_value){
            // method for getting attributes from the target, exist and it's bounded
            var _getattribute=type.__getattribute__(type(target), '__getattribute__');

            // _getattribute is unbound
            try {
                return _getattribute(target, name);
            } catch(e) { }

            try {
                // if __getattr__ isn't defined this trows an AttributeError
                var _getattr=_getattribute(target, '__getattr__');
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

    var hasattr = builtin.hasattr =$function(function(target, name){
        // hasattr(object, name) -> bool
        // Return whether the object has an attribute with the given name.
        //  (This is done by calling getattr(object, name) and catching exceptions.)
        var none={};
        return getattr(target, name, none) !== none;
    }, 'hasattr', {});

    var setattr = builtin.setattr=$function(function(target, name, value){
        // 1. Check objectname.__class__.__dict__ for attrname. If it exists and is a
        // data-descriptor, use the descriptor to set the value. Search all bases of
        // objectname.__class__ for the same case.
        try {
            var attr=getattr(type(target), name);
            if (hasattr(attr, '__set__'))
            {
                getattr(attr, '__set__')(target, value);
                return;
            }
        } catch (e){}

        // 2. Insert something into objectname.__dict__ for key "attrname".
        target[name] = value;
    }, 'setattr', {});

    var delattr = builtin.delattr = $function(function(target, name){
        // delattr(object, name)
        // Delete a named attribute on an object; delattr(x, 'y') is equivalent to ``del x.y''.
        try {
            var attr=getattr(type(target), name);
            if (hasattr(attr, '__delete__'))
            {
                getattr(attr, '__delete__')(target);
                return;
            }
        } catch (e){}

        delete(target[name]);
    }, 'delattr', {});

    var number=builtin.number=(function(){
        var __dict__={
            __add__: function(self, other){ return self+other; },
            __sub__: function(self, other){ return self-other; },
            __mult__: function(self, other){ return self*other; },
            __div__: function(self, other){ return self/other; }
        };

        return type('number',[], __dict__);
    })();

    // prepare arrays to behave like python lists
    (function (){
        // Called to implement the built-in function len()
        Array.prototype.__len__ = function(){return this.length;};
    })();

    // prepare numbers to behave like python numbers
    (function (){
        // Number represents an instance of the class number
        Number.prototype.__class__ = number;
    })();

    // This type has a single value. There is a single object with this value
    // Numeric methods and rich comparison methods may return this value if they
    // do not implement the operation for the operands provided. (The interpreter will
    // then try the reflected operation, or some other fallback, depending on the operator.)
    // Its truth value is true.
    var NotImplemented = builtin.NotImplemented = object();

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

        return type('dict', [], dict);
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