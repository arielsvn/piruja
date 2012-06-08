
class A:
    pass

def bla(**kwargs):
    print(kwargs)
    del kwargs['bla']
    print(kwargs)


d={'foo':1, 'bla':2}
bla(**d)
print('original ',d)