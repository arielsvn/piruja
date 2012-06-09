
class A:
    def foo(self):
        console.log('foo from A')

class B:
    def foo(self):
        console.log('foo from B')

class C(A,B):
    def foo(self):
        A.foo(self)
        B.foo(self)
        console.log('foo from C')


def bla(**kwargs):
    print(kwargs)
    del kwargs['bla']
    print(kwargs)


d={'foo':1, 'bla':2}
bla(**d)
print('original ',d)

