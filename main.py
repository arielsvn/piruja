
def foo():
    yield 1
    yield 2
    yield None
    yield 3
    yield StopIteration
    yield 4
    if True:
        raise StopIteration()
    yield 4

for i in foo():
    print(i)