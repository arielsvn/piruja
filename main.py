from _ast import AST
import ast

class JCompiler:

    def compile(self, program):
        tree=ast.parse(program)
        return self.visit(tree)

    def visit(self, node):
        """Visit a node."""
        method = 'visit_' + node.__class__.__name__
        visitor = getattr(self, method, self.generic_visit)
        return visitor(node)

    def generic_visit(self, node):
        """Called if no explicit visitor function exists for a node."""
        def visit():
            for field, value in ast.iter_fields(node):
                if isinstance(value, list):
                    for item in value:
                        if isinstance(item, AST):
                            yield self.visit(item)
                elif isinstance(value, AST):
                    yield self.visit(value)
                else:
                    print("no visitor defined for %s" % node)
                    # raise Exception()

        return "\n".join(visit())

    def visit_Num(self, node):
        return str(node.n)

    def visit_BoolOp(self, node):
        # BoolOp(boolop op, expr* values)
        # boolop = And | Or
        op='&' if isinstance(node.op,ast.And) else \
           '|' if isinstance(node.op, ast.Or) else None

        return op.join(self.visit(child) for child in node.values)

    def visit_BinOp(self, node):
        # BinOp(expr left, operator op, expr right)
        # operator = Add | Sub | Mult | Div | Mod | Pow | LShift
        #           | RShift | BitOr | BitXor | BitAnd | FloorDiv

        op='+' if isinstance(node.op,ast.Add) else \
        '-' if isinstance(node.op,ast.Sub) else \
        '*' if isinstance(node.op,ast.Mult) else \
        '/' if isinstance(node.op,ast.Div) else \
        '|' if isinstance(node.op, ast.Or) else None

        return op.join(self.visit(child) for child in node.values)


js=JCompiler()
program=js.compile('1 and 1')
print(program)