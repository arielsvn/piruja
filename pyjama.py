from _ast import AST
import ast
x=object
def compile(program):
    compiler=JCompiler()
    tree=ast.parse(program)

    class TopScope: name='main'
    return compiler.visit(tree, TopScope())

def concat(separator):
    def decorator(func):
        def wrapper(*args, **kwargs):
            return separator.join(item for item in func(*args, **kwargs))
        return wrapper
    return decorator

class JCompiler:
    def visit(self, node, scope):
        """Visit a node."""
        method = 'visit_' + node.__class__.__name__
        visitor = getattr(self, method, self.generic_visit)
        return visitor(node, scope)

    @concat('\n')
    def generic_visit_list(self, value, scope):
        for item in value:
            if isinstance(item, AST):
                yield self.visit(item, scope)

    @concat('\n')
    def generic_visit(self, node, scope):
        """Called if no explicit visitor function exists for a node."""
        for field, value in ast.iter_fields(node):
            if isinstance(value, list):
                yield self.generic_visit_list(value,scope)
            elif isinstance(value, AST):
                yield self.visit(value, scope)
            else:
                print("no visitor defined for %s" % node)
                # raise Exception()

    @staticmethod
    def indent(code):
        return '\n'.join('    '+ line for line in code.splitlines())

    def visit_FunctionDef(self, node, scope):
        # FunctionDef(identifier name, arguments args,
        #   stmt* body, expr* decorator_list, expr? returns)

        class FunctionScope:
            def register(self, name, code):
                return 'var %(name)s; %(name)s = %(code)s;' % {'name': name, 'code':code}

        name=str(node.name)
        body=self.generic_visit_list(node.body, FunctionScope())
        code='function(){%s}' % body
        return scope.register(name, code)

    def visit_ClassDef(self, node, scope):
        # ClassDef(identifier name, expr* bases, keyword* keywords, expr? starargs,
        #       expr? kwargs, stmt* body, expr *decorator_list)
        template=\
"""(function(){
    function __%(name)s(){
        var instance = create(__%(name)s);
        instance.__class__= __%(name)s;
        bound_members(instance, __%(name)s);
        return instance;
    }
    extend(__%(name)s, object);

    Class.__name__='%(name)s';

%(code)s

    return __%(name)s;
})()"""
        class ClassScope:
            def register(self, name, code):
                return 'var %(name)s; %(name)s = __%(class_name)s.%(name)s = %(code)s;' \
                    % {'name': name, 'class_name': node.name,'code':code}
        body = self.generic_visit_list(node.body, ClassScope())
        name = str(node.name)
        code=template % {'name': name, 'code': JCompiler.indent(body)}
        return scope.register(name, code)

    def visit_Module(self, node, scope):
        module=\
"""var %(name)s=(function(){
    var __%(name)s={
        __name__: '%(name)s'
    };

%(code)s

    return __%(name)s;
})();
"""
        class ModuleScope:
            closure = '__%s' % scope.name

            def register(self, name, code):
                return 'var %(name)s; %(name)s = __%(module_name)s.%(name)s = %(code)s;' \
                        % {'name': name, 'module_name': scope.name, 'code':code}

        visit = self.generic_visit_list(node.body, ModuleScope())
        return module % {'name': scope.name, 'code': JCompiler.indent(visit)}

    def visit_Return(self, node, scope):
        # Return(expr? value)
        if node.value:
            return 'return %s;' % self.visit(node.value, scope)
        else:
            return 'return;'

    def visit_Delete(self, node, scope):
        # Delete(expr* targets)
        return '\n'.join('delete %s;' % expr for expr in self.generic_visit_list(node.targets, scope))

    def visit_Assign(self, node, scope):
        # Assign(expr* targets, expr value)
        chain=' = '.join('%s = ')

    def visit_Num(self, node, scope):
        return str(node.n)

    def visit_Not(self, node, scope):
        return "!" + self.visit(node.expr, scope)

    def visit_BoolOp(self, node, scope):
        # BoolOp(boolop op, expr* values)
        # boolop = And | Or
        if isinstance(node.op,ast.And):
            return "py.__and(%s)" % ", ".join(self.visit(child,scope) for child in node.values)
        elif isinstance(node.op, ast.Or):
            return "py.__or(%s)" % ", ".join(self.visit(child,scope) for child in node.values)

    def visit_BinOp(self, node, scope):
        # BinOp(expr left, operator op, expr right)
        # operator = Add | Sub | Mult | Div | Mod | Pow | LShift
        #           | RShift | BitOr | BitXor | BitAnd | FloorDiv

        op='+' if isinstance(node.op,ast.Add) else \
        '-' if isinstance(node.op,ast.Sub) else \
        '*' if isinstance(node.op,ast.Mult) else \
        '/' if isinstance(node.op,ast.Div) else \
        '|' if isinstance(node.op, ast.Or) else None

        left=self.visit(node.left, scope)
        right=self.visit(node.right, scope)
        return '%(left)s %(operator)s %(right)s' % {'left': left, 'operator': op, 'right': right}

    def visit_Name(self, node, scope):
        # Name(identifier id, expr_context ctx)
        if node.id=='True':
            return 'true'
        elif node.id=='False':
            return 'false'
        else:
            return node.id

js=JCompiler()
code="""
def visit_Name(node, scope):
    return 1+1 and True

class A:
    def foo(x,y): return True
"""
program=compile(code)
print(program)