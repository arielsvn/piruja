
class A:
    x=1

    def foo(self): return self.x

class B(A):
    pass

b=B()

A.xx=1

print(b.xx)