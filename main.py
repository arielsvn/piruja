
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

for i in range_iter(5):
    print(i)