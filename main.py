
class descriptor:
    def __init__(self, func):

        self.func = func

    def __get__(self, instance, owner):
        print(instance)
        print(owner)
        return 5
#        return self.func(owner)


class A:
    def __init__(self):
        print('A inits called')

    @descriptor
    def foo(self):
        print('foo from A')



#    @descriptor
#    def __getattribute__(self, item):
#        print('getattribute called')
#        return super().__getattribute__(item)

    def __getattr__(self, item):
        print('get attribute')

        def getattribute(self, item):
            print('inner getattribute called')
            return super().__getattribute__(item)

        if item is '__getattribute__':
            return getattribute

        def res(x): print('res called ' + str(x))

        return res

class B:
    def __init__(self):
        print('B init called')

    def __get__(self, instance, owner):
        print('descriptor at B')
        print('instance: %s' % instance)
        print('owner: %s' % owner)
        return instance

class C(B,A):
    bla=B()

    def helper(self, instance, owner):
        print('descriptor at C')
        return instance

    bla.__get__= helper

a=C()
#a.block='block in __dict__'
print(C.bla)
#print(a.block)

def write_dict(target=object):
    base_attrs=[key for base in target.__bases__ for key in dir(base)]
    attrs=[key for key in dir(target) if key not in target.__dict__ and key not in base_attrs]
    if attrs:
        print('// Python provided attributes')
        for name in attrs:
            print('%s.%s = undefined;' % (target.__name__, name))

    def write_attribute(method):
        if hasattr(method, '__call__'):
            print('    %s: function(self){' % i)
            print("        // %s" % '\n        // '.join(method.__doc__.splitlines()))
            print()
            print('        // %s' % method)
            print('    },')
        else:
            if method.__doc__:
                print("    // %s" % '\n    // '.join(method.__doc__.splitlines()))

            if isinstance(method, str):
                print('    %s: \'%s\',' % (i, method))
            else:
                print('    %s: undefined,' % i)

    print('var __dict__ = {')

    # write attributes
    for i in target.__dict__:
        method=target.__dict__[i]
        if not hasattr(method,'__call__'):
            write_attribute(method)
    print()
    # write methods
    for i in target.__dict__:
        method=target.__dict__[i]
        if hasattr(method,'__call__'):
            write_attribute(method)

    print('};')