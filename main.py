
class A:
    pass

class B(A):
    pass

A.foo=lambda self:4

b=B()

print(b.foo())