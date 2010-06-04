
class A:
    x=1

    def foo(self): return self.x

class B(A):
    pass

x=1
def foo():
    x=123
foo()
print(x)