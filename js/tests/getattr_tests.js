
module('get attributes');

test('$function gets bounded when descriptor is called', function() {
    function foo(self){return self}

    var target=py.$function(foo, 'foo', {});

    var method=target.__get__(1, {});

    equal(method(), 1);
});

test('$function is not bound when descriptor is called on class (A.foo)', function() {
    function foo(self){return self}

    var target=py.$function(foo, 'foo', {});

    var method=target.__get__(undefined, {});

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
