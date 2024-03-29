
module('get attributes');

test('getattr returns default value when attribute is not found', function() {
    function foo(self){return self}

    var target=py.$function(foo, 'foo', {});

    var attr=py.getattr(target, 'xyz', 1);

    equal(attr, 1);
});

test('getattr throws AttributeError when attribute is not found', function() {
    function foo(self){return self}

    var target=py.$function(foo, 'foo', {});

    raises(function(){py.getattr(target, 'xyz');}, 'raises exception');
});

test('$function gets bounded when descriptor is called', function() {
    function foo(self){return self}

    var target=py.$function(foo, 'foo', {});

    var method=py.getattr(target, '__get__')(1, {});

    equal(method(), 1);
});

test('$function is not bound when descriptor is called on class (A.foo)', function() {
    function foo(self){return self}

    var target=py.$function(foo, 'foo', {});

    var method = py.getattr(target, '__get__')(undefined, {});

    equal(method(1), 1);
});

test('getattribute method lookup on object class', function() {
    var result = py.getattr(py.object, '__getattribute__');
    equal(result, py.object.__getattribute__);
});

test('creating object instance', function() {
    var object=py.object, len=py.len,
        instance = object.__new__(object);

    equal(instance.__class__, object);
});

test('getattribute over object instance', function() {
    var object=py.object, len=py.len,
        instance = object.__new__(object);

    var result = py.getattr(instance, '__getattribute__');

    equal(result.__code__, py.object.__getattribute__.__code__);
});

test('__init__ method lookup on object class', function() {
    var result = py.getattr(py.object, '__init__');
    equal(result, py.object.__init__);
});

test('__init__ method lookup over object instance', function() {
    var object=py.object, len=py.len,
        instance = object.__new__(object);

    var result = py.getattr(instance, '__init__');

    equal(result.__code__, py.object.__init__.__code__);
});

test('getattribute over object subclass', function() {
    var object=py.object;

    var B = object.__new__(object);
    B.__class__=py.type;
    B.__base__=object;
    B.__bases__=[object];
    B.__mro__=[B, object];

    var result = py.getattr(B, '__getattribute__');

    equal(result, py.object.__getattribute__);
});

test('hasattr on $function with __get__', function() {
    function foo(self){return self}

    var func=py.$function(foo, 'foo', {});

    ok(py.hasattr(func, '__get__'));
});

test('__getattribute__ method on $function is bounded', function() {
    function foo(self){return self}

    var target=py.$function(foo, 'foo', {});

    var attr = py.getattr(target, '__getattribute__');

    // call getattribute with one parameter, the first parameter is bounded
    var result=attr('__get__');

    // the expected result is the method $function.__get__
    equal(result.__code__, py.$function.__get__.__code__)
});

test('bounded method on instance', function() {
    var object=py.object;

    var instance = {
        __class__: object,
        foo: py.$function(function(self, x) {
            return x;
        },'foo',{})
    };
    instance.__dict__ = instance;

    var result = py.getattr(instance, 'foo');

    equal(result(1), 1);
    equal(result(2), 2);
});

test('user method over instance', function() {
    var type=py.type,
        object=py.object;

    var dict={
        foo: py.$function(function(self){return 1;}, 'foo', {})
    };
    var cls=type('Name', [object], dict);
    var instance=cls();

    var bound=py.getattr(instance, 'foo');
    equal(bound(), 1)
});

test('class attribute over instance lookup', function() {
    var type=py.type,
        object=py.object;

    var dict={
        foo: 1
    };
    var cls=type('Name', [object], dict);
    var instance=cls();

    var attr=py.getattr(instance, 'foo');
    equal(attr, 1)
});

test('class attribute over class lookup', function() {
    var type = py.type,
        object=py.object;

    var dict={
        foo: 1
    };
    var cls=type('Name', [object], dict);

    var attr=py.getattr(cls, 'foo');
    equal(attr, 1);
});

test('class attribute using __getattr__  method', function() {
    var type=py.type,
        object=py.object;

    var dict={
        __getattr__: py.$function(function(self, name){return 1;}, '__getattr__', {})
    };
    var cls=type('Name', [object], dict);
    var instance=cls();

    var attr=py.getattr(instance, 'foo');
    equal(attr, 1)
});

test('class function using __getattr__  method', function() {
    var type=py.type,
        object=py.object;

    var dict={
        __getattr__: py.$function(function(self, name){
            // return a new function that always return 1 when invoked
            return py.$function(function(){return 1;}, 'foo', {});
        }, '__getattr__', {})
    };
    var cls=type('Name', [object], dict);
    var instance=cls();

    var attr=py.getattr(instance, 'foo');
    equal(attr(), 1)
});

test('__getattr__ is not called when attribute is resolved with __getattribute__', function() {
    var type=py.type,
        object=py.object;

    var dict={
        foo:1,
        __getattr__: py.$function(function(self, name){return 2;}, '__getattr__', {})
    };
    var cls=type('Name', [object], dict);
    var instance=cls();

    var attr=py.getattr(instance, 'foo');
    equal(attr, 1);
    equal(py.getattr(instance, 'other'), 2, 'called with other attribute should work');
});

test('__call__ is not accessible from instance', function() {
    var type=py.type,
        object=py.object;

    var cls=type('Name', [object], {});
    var instance=cls();

    raises(function(){py.getattr(instance, '__call__');}, '__call__ is not accessible from instance')
});

test('__call__ is not accessible from object instance', function() {
    var type=py.type,
        object=py.object;

    var instance=object();

    raises(function(){py.getattr(instance, '__call__');}, '__call__ is not accessible from instance')
});

test('get __call__ method from object class', function() {
    var object=py.object;

    var call = py.getattr(object, '__call__');
    equal(call, object.__call__);
});

