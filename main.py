
class Meta(type):
    def __getattribute__(*args):
        print("Metaclass getattribute invoked:", args)
        return type.__getattribute__(*args)

    def __getattr__(self, item):
        print('Metaclass getattr invoked: ', item)
        return None
        pass

class B(object):
#    def __init__(self):
##        print('B init called')
#        pass
    pass

class C(B, metaclass=Meta):
    def __len__(self):
        return 10

    def __getattribute__(*args):
        print("Class getattribute invoked:", args)
        return object.__getattribute__(*args)

c=C()

#print('type.__getattribute__: %s' % type.__getattribute__)
#print('object.__getattribute__: %s' % object.__getattribute__)

print('c.__getattribute__: %s' % c.__getattribute__)
#print('c.__new__: %s' % c.__new__)
#
print('---')
print('C.__getattribute__: %s' % C.__getattribute__)
print(C.cxy)
#print('C.__new__: %s' % C.__new__)
