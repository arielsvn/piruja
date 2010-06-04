from _ast import AST
import ast
x=object

class BaseScope:
    closure = '__dict__'

    def lookup(self, name):
        return self.closure + '.' + name

def compile(program):
    compiler=JCompiler()
    tree=ast.parse(program)

    class TopScope(BaseScope):
        name='main'
    return compiler.visit(tree, TopScope())

def concat(separator):
    def decorator(func):
        def wrapper(*args, **kwargs):
            return separator.join(item for item in func(*args, **kwargs))
        return wrapper
    return decorator

class JCompiler:
    builtinFunc={
        'closure': 'py.__closure', # creates a local scope
        'type': 'py.type',
    }

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

        # arguments = (arg* args, identifier? vararg, expr? varargannotation, arg* kwonlyargs,
        #           identifier? kwarg, expr? kwargannotation, expr* defaults, expr* kw_defaults)

        # arg = (identifier arg, expr? annotation)

        template=\
"""%(parent_closure)s.%(name)s = function(%(arguments)s){
    var %(closure)s = %(closure_func)%(%(parent_closure)s);
%(code)s
};"""
        arguments = [str(arg.arg) for arg in node.args.args]
        class FunctionScope(BaseScope):
            def lookup(self, name):
                if name in arguments:
                    return name
                else:
                    return BaseScope.lookup(self,name)

        name=str(node.name)
        function_scope = FunctionScope()
        body=self.generic_visit_list(node.body, function_scope)
        return template % {'closure': function_scope.closure,'parent_closure': scope.closure,
                           'name': name, 'code': JCompiler.indent(body),
                           'arguments': ', '.join(arguments),
                           'closure_func': JCompiler.builtinFunc['closure']}

    def visit_ClassDef(self, node, scope):
        # ClassDef(identifier name, expr* bases, keyword* keywords, expr? starargs,
        #       expr? kwargs, stmt* body, expr *decorator_list)
        template=\
"""%(parent_closure)s.%(name)s = (function(){
    var %(closure)s = %(closure_func)s(%(parent_closure)s);
%(code)s
    return %(type_func)s('%(name)s', [], %(closure)s);
})();"""
        class ClassScope(BaseScope):
            pass

        class_scope=ClassScope()
        body = self.generic_visit_list(node.body, class_scope)
        name = str(node.name)
        return template % {'name': name, 'code': JCompiler.indent(body),
                           'closure': class_scope.closure, 'parent_closure': scope.closure,
                           'closure_func': JCompiler.builtinFunc['closure'],
                           'type_func': JCompiler.builtinFunc['type'],}

    def visit_Module(self, node, scope):
        module=\
"""var %(name)s=(function(){
    var %(closure)s = %(closure_func)s(%(parent_closure)s);
%(code)s
    return %(closure)s;
})();"""

        class ModuleScope(BaseScope):
            pass

        module_scope = ModuleScope()
        visit = self.generic_visit_list(node.body, module_scope)
        return module % {'name': scope.name, 'code': JCompiler.indent(visit),
                         'closure': module_scope.closure, 'parent_closure': 'py',
                         'closure_func': JCompiler.builtinFunc['closure']}

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
        return ' = '.join(self.visit(expr, scope) for expr in node.targets) + ' = ' + self.visit(node.value, scope)

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

    def visit_Call(self, node, scope):
        # Call(expr func, expr* args, keyword* keywords, expr? starargs, expr? kwargs)
        template='%(func)s(%(args)s);'
        return template % {'func': self.visit(node.func, scope),
                           'args': self.generic_visit_list(node.args, scope)}

    def visit_Str(self, node, scope):
        # Str(string s)
        return "\"%s\"" % node.s

    def visit_Attribute(self, node, scope):
        # Attribute(expr value, identifier attr, expr_context ctx)
        return '%(value)s.%(identifier)s' % { 'value':self.visit(node.value, scope), 'identifier': str(node.attr)}

    def visit_Name(self, node, scope):
        # Name(identifier id, expr_context ctx)
        if node.id=='True':
            return 'true'
        elif node.id=='False':
            return 'false'
        else:
            return scope.lookup(str(node.id))

js=JCompiler()
code="""
class B(A):
    pass

console.log('loaded')
"""
program=compile(code)
print(program)

