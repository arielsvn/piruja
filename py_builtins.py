
class Exception:
    pass

class StopIteration(Exception):
    pass

class range_iter:
    def __init__(self, start, stop = None, step = 1):
        if not stop:
            self.start=1
            self.stop=start
        else:
            self.start = start
            self.stop = stop

        self.step = step

    def __iter__(self):
        parent=self
        class Iter:
            def __init__(self):
                self.current=parent.start - parent.step

            def __iter__(self): return Iter()

            def __next__(self):
                self.current += parent.step

                if self.current >= parent.stop:
                    raise StopIteration

                return self.current

        return Iter()

def min(*args):
    result=args[0]
    for i in args:
        if i<result:
            result = i
    return result


def write_dict(target=object):
    base_attrs=[key for base in target.__bases__ for key in dir(base)]
    attrs=[key for key in dir(target) if key not in target.__dict__ and key not in base_attrs]
    if attrs:
        print('// Python provided attributes')
        for name in attrs:
            print('%s.%s = undefined;' % (target.__name__, name))

    def write_attribute(method):
        if hasattr(method, '__call__'):
            print('    %s: function(self){' % i)
            print("        // %s" % '\n        // '.join(method.__doc__.splitlines()))
            print()
            print('        // %s' % method)
            print('    },')
        else:
            if method.__doc__:
                print("    // %s" % '\n    // '.join(method.__doc__.splitlines()))

            if isinstance(method, str):
                print('    %s: \'%s\',' % (i, method))
            else:
                print('    %s: undefined,' % i)

    print('var __dict__ = {')

    # write attributes
    for i in target.__dict__:
        method=target.__dict__[i]
        if not hasattr(method,'__call__'):
            write_attribute(method)
    print()
    # write methods
    for i in target.__dict__:
        method=target.__dict__[i]
        if hasattr(method,'__call__'):
            write_attribute(method)

    print('};')