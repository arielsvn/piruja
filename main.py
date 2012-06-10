
class descriptor:
    def __init__(self, func):
        self.func = func

    def __get__(self, instance, owner):
        print(instance)
        print(owner)
        return 5
#        return self.func(owner)

class A:
    @descriptor
    def foo(self):
        print('foo from A')

#    @descriptor
    def __getattribute__(self, item):
        print('getattribute called')

#        def res(x):
#            print('res called (from get attribute) ' + str(x))
#
#        return res

        return super().__getattribute__(item)

    def __getattr__(self, item):
        print('get attribute')

        def res(x): print('res called ' + str(x))

        return res

a=A()
#a.block='block in __dict__'
print(A.__getattribute__)
#print(a.block)

