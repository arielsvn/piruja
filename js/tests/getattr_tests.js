
module('get attributes');

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
    var result = py.object.__getattribute__(py.object, '__getattribute__');
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

    var result = py.object.__getattribute__(instance, '__getattribute__');

    equal(result.__code__, py.object.__getattribute__.__code__);
});

test('__init__ method lookup on object class', function() {
    var result = py.object.__getattribute__(py.object, '__init__');
    equal(result, py.object.__init__);
});

test('__init__ method lookup over object instance', function() {
    var object=py.object, len=py.len,
        instance = object.__new__(object);

    var result = py.object.__getattribute__(instance, '__init__');

    equal(result.__code__, py.object.__init__.__code__);
});

test('getattribute over object subclass', function() {
    var object=py.object;

    var B = object.__new__(object);
    B.__class__=py.type;
    B.__base__=object;
    B.__bases__=[object];
    B.__mro__=[B, object];

    var result = py.object.__getattribute__(B, '__getattribute__');

    equal(result.__code__, py.object.__getattribute__.__code__);
});

test('hasattr on $function with __get__', function() {
    function foo(self){return self}

    var func=py.$function(foo, 'foo', {});

    ok(py.hasattr(func, '__get__'));
});

test('__getattribute__ method on $function is bounded', function() {
    function foo(self){return self}

    var target=py.$function(foo, 'foo', {});

    var attr = py.object.__getattribute__(target, '__getattribute__');

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

    var result = py.object.__getattribute__(instance, 'foo');

    equal(result(1), 1);
});

