#
#class Meta(type):
#    def __getattribute__(*args):
#        print("Metaclass getattribute invoked:", args)
#        return type.__getattribute__(*args)
#
#    def __getattr__(self, item):
#        print('Metaclass getattr invoked: ', item)
#        return None
#        pass
#
#class B(object):
##    def __init__(self):
###        print('B init called')
##        pass
#    pass
#
#class C(B, metaclass=Meta):
#    def __len__(self):
#        return 10
#
#    def __getattribute__(*args):
#        print("Class getattribute invoked:", args)
#        return object.__getattribute__(*args)
#
#c=C()

##print('type.__getattribute__: %s' % type.__getattribute__)
##print('object.__getattribute__: %s' % object.__getattribute__)
#
#print('c.__getattribute__: %s' % c.__getattribute__)
##print('c.__new__: %s' % c.__new__)
##
#print('---')
#print('C.__getattribute__: %s' % C.__getattribute__)
#print(C.cxy)
##print('C.__new__: %s' % C.__new__)

#k=1
#def iterator():
#    global k
#    k1=k+1; k+=1
#    print('iter ', k1)
#    try:
#        x=1
#        #        raise Exception
#        yield 1
#        yield 2
#    finally:
#        print('finally called',k1)
#        yield 3
#
#it=(iterator())
#print(it)
#
#n=next(it)
#print(n)
#
#n=next(it)
#print(n)
#
#print('---')
#
#for i in iterator():
#    print(i)

#from piruja.Common import mutateMetaclass
#
#def bla(a,x,y): return a.x
#class Foo(metaclass=mutateMetaclass(0, lambda s: s.x)):
#    x=21
#    pass
#
#print(Foo())

from json.encoder import JSONEncoder

class Foo:
    def __init__(self, x=1, y=2):
        self.x=x
        self.y=y

class Encoder(JSONEncoder):
    def default(self, o):
        if isinstance(o, Foo):
            return {'x': o.x, 'y': o.y}
        else: return super().default(o)

instance=Foo([1,2,3])
encoder=Encoder()
code=encoder.encode(instance)

print(code)
