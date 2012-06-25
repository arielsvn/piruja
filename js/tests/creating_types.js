
module('creating types');

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
