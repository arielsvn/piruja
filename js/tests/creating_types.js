
module('creating things');

test('class is created with correct attributes', function() {
    var type=py.type,
        object=py.object;

    var target=type('Name', [object], {});

    equal(target.__class__, type);
    equal(target.__base__, object);
    deepEqual(target.__bases__, [object]);
    deepEqual(target.__mro__, [target, object]);

    ok(py.isinstance(target, type));
    ok(py.issubclass(target, object));
});

test('instance is created with correct attributes', function() {
    var type=py.type,
        object=py.object;

    var cls=type('Name', [object], {});
    var instance=cls();

    equal(instance.__class__, cls);

    ok(py.isinstance(instance, cls));
    ok(py.issubclass(instance, object));
});

test('subclass created with correct attributes', function() {
    var type=py.type,
        object=py.object;

    var name=type('Name', [object], {}),
        target=type('Subclass', [name], {});

    equal(target.__class__, type, '__class__');
    equal(target.__base__, name, '__base__');
    deepEqual(target.__bases__, [name, object], '__bases__');
    deepEqual(target.__mro__, [target, name, object], '__mro__');

    ok(py.isinstance(target, type), 'isinstance(target, type)');
    ok(py.issubclass(target, name), 'issubclass(target, name)');
    ok(py.issubclass(target, object), 'issubclass(target, object)');
});

test('various classes mro (1)', function() {
    var type=py.type,
        object=py.object,
        O = object,
        F = type('F', [O], {}),
        E = type('E', [O], {}),
        D = type('D', [O], {}),
        C = type('C', [D, F], {}),
        B = type('B', [D, E], {}),
        A = type('A', [B, C], {});

    deepEqual(F.__mro__, [F,O]);
    deepEqual(E.__mro__, [E,O]);
    deepEqual(D.__mro__, [D,O]);
    deepEqual(C.__mro__, [C,D,F,O] );
    deepEqual(B.__mro__, [B,D,E,O]);
    deepEqual(A.__mro__, [A,B,C,D,E,F,O]);
});

test('various classes mro (2)', function() {
    var type=py.type,
        object=py.object,
        O = object,
        F = type('F', [O], {}),
        E = type('E', [O], {}),
        D = type('D', [O], {}),
        C = type('C', [D, F], {}),
        B = type('B', [E, D], {}),
        A = type('A', [B, C], {});

    deepEqual(F.__mro__, [F,O]);
    deepEqual(E.__mro__, [E,O]);
    deepEqual(D.__mro__, [D,O]);
    deepEqual(C.__mro__, [C,D,F,O]);
    deepEqual(B.__mro__, [B,E,D,O]);
    deepEqual(A.__mro__, [A,B,E,C,D,F,O]);
});