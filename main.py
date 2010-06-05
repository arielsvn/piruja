
class A:
    def __call__(self):
        print('foo')
    pass

a=A()
print(a)
a1=a.__dict__
print(a1)
