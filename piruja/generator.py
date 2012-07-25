import ast
from piruja.Common import templated_ast, mutateMetaclass
from piruja.piruja import compile

__author__ = 'Ariel'

class Node:
    def __init__(self, content, after=None):
        self.after = after
        self.content = content

class Machine:
    def __init__(self, start, *nodes):
        if start not in nodes: raise Exception

        self.start=start
        self.ends=[node for node in nodes if not node.after]
        self.nodes=nodes

def is_generator_function(functionDef):
    """
    returns true if the given ast.FunctionDef is a generator function: contains
    et less one yield and not any returns
    """
    class Checker(ast.NodeVisitor):
        def check(self): return self.generic_visit(functionDef)

        def visit_Yield(self, node):
            self.contains_yield = True

        def visit_Return(self, node):
            self.contains_return = True

        def visit_FunctionDef(self, node): pass
        def visit_ClassDef(self, node):pass

    check=Checker().check()
    return check.contains_yield and not check.contains_return

class MachineTranslator:
    """ Takes a generator function definition (containing yields) and return the equivalent machine """

    def visit(self, node):
        if not isinstance(node, ast.FunctionDef) or not is_generator_function(node): raise Exception


    def visit_Block(self, codeBlock):
        def splitList(array, filter):
            """
            splits the given array in a collection of arrays where each one of them
            ends with an element that match the filter (except maybe the last one)
            """
            indexes=[i for i,node in enumerate(array) if filter(node)]
            if not indexes or indexes[len(indexes)-1] != len(array)-1:
                # the last position must be the len of the array
                indexes.append(len(array)-1)

            result = []
            prev = 0
            while prev < len(array)-1:
                next = indexes[len(result)]
                result.append(array[prev:next])
                prev = next

            return result

        blocks=splitList(codeBlock, lambda node: isinstance(node, ast.Yield))
        nodes=[Node(block) for block in blocks]
        for i, node in enumerate(nodes):
            if i<len(nodes)-1:
                # the next item of each node is the next on the list, except for the last one
                node.after=nodes[i+1]

        return Machine(nodes[0], *nodes)

def py_transform(name, args, machine):
    """
    transform a generator function into a state machine

    def generator(args):
        yield x

    << into >>

    def generator(args):
        class iterator:
            def __init__(self): self.state = 0
            def __iter__(self): return iterator()
            def __next__(self):
                # iterator body
                if self.state==0:
                    return x

       return iterator()
    """
    # FunctionDef(identifier name, arguments args, stmt* body, expr* decorator_list, expr? returns)
    # ClassDef(identifier name, expr* bases, keyword* keywords, expr? starargs, expr? kwargs, stmt* body, expr *decorator_list)

    # 	arguments = (arg* args, identifier? vararg, expr? varargannotation, arg* kwonlyargs, identifier? kwarg,
    #                expr? kwargannotation, expr* defaults, expr* kw_defaults)

    #    arg = (identifier arg, expr? annotation)

    if isinstance(machine, ast.AST):
        return py_transform(name,args, MachineTranslator())
    else:
        body = ast.If()

        template=\
        """
        def generator():
            class iterator:
                def __init__(self): self.state = 0
                def __iter__(self): return iterator()
                def __next__(self): import body

           return iterator()
        """

        func = templated_ast(template, body=body, generator=name)
        func.args=args
        return func

if __name__=='__main__':
    code="def foo(): yield 1"
    tree=ast.parse(code)
