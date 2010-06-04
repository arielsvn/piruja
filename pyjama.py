from _ast import AST
import ast
x=object

class BaseScope:
    def __init__(self, parent=None):
        self.vars=[]
        self.parent=parent

    def define(self, name):
        # reports the existence of a new variable in the scope
        if name not in self.vars:
            self.vars+=[name]

    def __contains__(self, item):
        return self.contains_local(item) or (self.parent and item in self.parent)

    def contains_local(self, name): return name in self.vars

    def root_scope(self):
        if not self.parent:
            return self
        else:
            return self.parent.root_scope()

    def __iter__(self): return self.vars.__iter__()

def compile(program):
    compiler=JCompiler()
    tree=ast.parse(program)

    class ProgramScope(BaseScope): name='main'

    return compiler.visit(tree,  ProgramScope())

def concat(separator):
    def decorator(func):
        def wrapper(*args, **kwargs):
            return separator.join(item for item in func(*args, **kwargs))
        return wrapper
    return decorator

class JCompiler:
    builtins=['type']

    def import_builtins(self):
        namespace='py'
        return 'var %s;' % ', '.join('%(var)s=%(namespace)s.%(var)s' % {'var': var, 'namespace': namespace} for var in self.builtins)

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
    def indent(code): return '\n'.join('    '+ line for line in code.splitlines())

    @staticmethod
    def scope_vars_declaration(scope):
        # returns the variable declaration line with all the scope locals
        return 'var %s;' % ', '.join(var for var in scope.vars) if scope.vars else ''

    @staticmethod
    def scope_vars_assignment(scope, module_name):
        return '\n'.join('%(module)s.%(var)s = %(var)s;' % {'module': module_name, 'var': var}
            for var in scope.vars) if scope.vars else ''

    def visit_FunctionDef(self, node, scope):
        # FunctionDef(identifier name, arguments args,
        #   stmt* body, expr* decorator_list, expr? returns)

        # arguments = (arg* args, identifier? vararg, expr? varargannotation, arg* kwonlyargs,
        #           identifier? kwarg, expr? kwargannotation, expr* defaults, expr* kw_defaults)

        # arg = (identifier arg, expr? annotation)

        template=\
"""%(name)s = (function(){
    function %(name)s(%(arguments)s){
        %(vars)s
        %(code)s
    };

})();"""

        arguments = [str(arg.arg) for arg in node.args.args]

        class FunctionScope(BaseScope):
            def __init__(self, parent=None):
                super().__init__(parent)
                self.arguments = arguments
                self.name = str(node.name)

            def contains_local(self, name):
                return name in self.arguments or super().contains_local(name)

        name=str(node.name)
        function_scope = FunctionScope(scope)
        body=self.generic_visit_list(node.body, function_scope)
        vars= JCompiler.scope_vars_declaration(function_scope)
        scope.define(name)
        return template % {'name': name, 'code': JCompiler.indent(body),
                           'arguments': ', '.join(arguments),
                           'vars': vars}

    def visit_ClassDef(self, node, scope):
        # ClassDef(identifier name, expr* bases, keyword* keywords, expr? starargs,
        #       expr? kwargs, stmt* body, expr *decorator_list)
        template=\
"""%(name)s = (function(){
    var __dict__={};
    %(vars)s
%(code)s
%(fields)s
    return type('%(name)s', [%(bases)s], __dict__);
})();"""

        class_scope=BaseScope(scope)
        # 1. It first evaluates the inheritance list
        bases=', '.join(self.visit(base, scope) for base in node.bases) # the bases use the parent scope
        # 2. The class’s suite is then executed in a new execution frame
        body = self.generic_visit_list(node.body, class_scope)
        name = str(node.name)
        vars=JCompiler.scope_vars_declaration(class_scope)
        fields=JCompiler.scope_vars_assignment(class_scope, '__dict__')

        scope.define(name)
        return template % {'name': name, 'code': JCompiler.indent(body),
                           'vars': vars, 'fields': JCompiler.indent(fields),
                           'bases': bases}

    def visit_Module(self, node, scope):
        module=\
"""%(builtins)s
var %(name)s=(function(){
    var %(name)s={};
    %(vars)s
%(code)s
%(fields)s
    return %(name)s;
})();"""

        class ModuleScope(BaseScope):
            name=scope.name

        module_scope = ModuleScope()
        visit = self.generic_visit_list(node.body, module_scope)
        # all variables are declared at the start of the block, including functions
        # note that only local variables are declared
        vars= JCompiler.scope_vars_declaration(module_scope)
        # assign fields to the module
        fields = JCompiler.scope_vars_assignment(module_scope, module_scope.name)
        return module % {'name': scope.name, 'code': JCompiler.indent(visit),
                         'vars': vars, 'fields':JCompiler.indent(fields),
                         'builtins': self.import_builtins()}

    def visit_Return(self, node, scope):
        # Return(expr? value)
        if node.value:
            return 'return %s;' % self.visit(node.value, scope)
        else:
            return 'return;'

    def visit_Delete(self, node, scope):
        # Delete(expr* targets)
        return '\n'.join('%s = undefined;' % self.visit(expr,scope) for expr in node.targets)

    def visit_Assign(self, node, scope):
        # Assign(expr* targets, expr value)
        return ' = '.join(self.visit(expr, scope) for expr in node.targets) + ' = ' + self.visit(node.value, scope) + ';'

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
        # expr_context = Load | Store | Del | AugLoad | AugStore | Param
        name=str(node.id)

        if name=='True':
            return 'true'
        elif name=='False':
            return 'false'
        else:
            if isinstance(node.ctx, ast.Store): scope.define(name)

            return name

js=JCompiler()
code="""
class A:
    x=1
    def __call__(self, x):
        console.log(x)
"""
program=compile(code)
print(program)

