import ast

def mutateMetaclass(number, function):
    """ if a class is called with the given number of arguments, then return the function result instead of the instance """
    class CallMutate(type):
        def __call__(self, *args, **kwargs):
            if len(args)+len(kwargs)==number:
                return function(self, *args, **kwargs)
            else:
                return super().__call__(*args, **kwargs)

    return CallMutate

def templated_ast(code, **kwnodes):
    class Transformer(ast.NodeTransformer):
        def check(self, node, name):
            # Name(identifier id, expr_context ctx)
            if name in kwnodes:
                return kwnodes[name]
            else:
                return node

        def visit_Name(self, node):
            return self.check(node, node.id)

        def visit_Import(self, node):
            return self.check(node, node.names[0].name)

    tree = ast.parse(code)
    members = Transformer().visit(tree).body
    if len(members) == 1:
        return members[0]
    else:
        return members