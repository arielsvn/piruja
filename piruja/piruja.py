from _ast import AST
import ast
from piruja.Common import templated_ast

class BaseScope:
    def __init__(self, parent=None, semi_after=None):
        self.vars = []
        self.parent = parent

        # in a statement, semi_after returns true if the statement should terminated with a semicolon ';'
        if semi_after == None:
            self.semi_after = parent.semi_after if parent else False
        else:
            self.semi_after = semi_after

    def define(self, name):
        # reports the existence of a new variable in the scope
        if name not in self.vars:
            self.vars += [name]

    def __contains__(self, item):
        return self.contains_local(item) or (self.parent and item in self.parent)

    def contains_local(self, name): return name in self.vars

    def root(self):
        if not self.parent:
            return self
        else:
            return self.parent.root()

    def __iter__(self): return iter(self.vars)

    def __getattr__(self, name):
        if self.parent:
            return getattr(self.parent, name)
        else:
            raise AttributeError

class PhantomScope(BaseScope):
    def __init__(self, parent, semi_after=None, **kwfields):
        super().__init__(parent, semi_after)

        self.extra_fields = dict(kwfields)

    def define(self, name): self.parent.define(name)

    def __iter__(self): return iter(self.parent)

    def __getattr__(self, name):
        if name in self.extra_fields:
            return self.extra_fields[name]
        else:
            return getattr(self.parent, name)

def compile(program):
    compiler = JCompiler()
    tree = ast.parse(program)

    class ProgramScope(BaseScope): name = 'main'

    return compiler.visit(tree, ProgramScope())

def concat(separator):
    def decorator(func):
        def wrapper(*args, **kwargs):
            return separator.join(item for item in func(*args, **kwargs))

        return wrapper

    return decorator

def check_semi_after(func):
    # decorator that checks if the statement must be followed by a semicolon
    # and adds it automatically if needed
    # it should be used only on the JCompiler.visit_* methods...
    def wrapper(self, node, scope):
        return func(self, node, scope) + (';' if scope.semi_after else '')

    return wrapper

def check_not(value):
    # raises an exception if the target method returns the specified value
    def decorator(func):
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            if result == value:
                raise Exception('function %s() returned %s!!!' %(func.__name__, value))
            return result
        return wrapper
    return decorator

class Compiler_Checks(type):
    def __new__(mcs, name, bases, dict):
        for key in dict:
            if key.startswith('visit_'):
                dict[key] = check_not(None)(dict[key])

        return type.__new__(mcs, name, bases, dict)

class JCompiler(metaclass = Compiler_Checks):
    builtins = ['type', 'function_base', 'iter', 'range', 'next', 'isinstance', 'print', '$op','getattr', 'hasattr', 'setattr']

    def import_builtins(self):
        namespace = 'py'
        return 'var %s;' % ', '.join(
            '%(var)s=%(namespace)s.%(var)s' % {'var': var, 'namespace': namespace} for var in self.builtins)

    def visit(self, node, scope):
        """Visit a node."""
        method = 'visit_' + node.__class__.__name__
        visitor = getattr(self, method, self.generic_visit)
        return visitor(node, scope)

    def generic_visit_list(self, value, scope, separator='\n'):
        def visit():
            for item in value:
                if isinstance(item, AST):
                    yield self.visit(item, scope)

        if separator:
            return separator.join(item for item in visit())
        else: return visit()

    @concat('\n')
    def generic_visit(self, node, scope):
        """Called if no explicit visitor function exists for a node."""
        for field, value in ast.iter_fields(node):
            if isinstance(value, list):
                yield self.generic_visit_list(value, scope)
            elif isinstance(value, AST):
                yield self.visit(value, scope)
            else:
                print("no visitor defined for %s" % node)
                # raise Exception()

    @staticmethod
    def indent(code, times=1):
        return '\n'.join('    '*times + line for line in code.splitlines())

    def code_block(self, stmt_list, scope):
        # adds brackets (and indent) a code block if more than one statement
        # also ensures that all statements are terminated with semicolons
        if len(stmt_list) > 1:
            return '{ \n%s \n}' % JCompiler.indent(self.visit_stmt_list(stmt_list, scope))
        else:
            return self.visit(stmt_list[0], scope)

    @concat('\n')
    def visit_stmt_list(self, stmt_list, scope):
        for item in stmt_list:
            # each statement must be terminated with a semicolon ';'
            yield self.visit(item, PhantomScope(scope, True))

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

        # todo function attributes can be smaller

        template =\
"""%(name)s = $function(function(%(arguments)s){
        %(vars)s
%(code)s
}, '%(name)s', {%(attributes)s});"""

        arguments = [str(arg.arg) for arg in node.args.args]
        if node.args.vararg:
            arguments += [node.args.vararg]
        if node.args.kwarg:
            arguments += [node.args.kwarg]

        class FunctionScope(BaseScope):
            def __init__(self, parent=None):
                super().__init__(parent)
                self.arguments = arguments
                self.name = str(node.name)

            def contains_local(self, name):
                return name in self.arguments or super().contains_local(name)

        name = str(node.name)
        function_scope = FunctionScope(scope)

        body = self.generic_visit_list(node.body, function_scope)
        # at the top of the function all local vars are declared
        vars = JCompiler.scope_vars_declaration(function_scope)

        @concat(', ')
        def attributes():
#            yield 'name: \'%s\'' % name
#            yield 'module: \'%s\'' % scope.root().name
#            yield 'globals: %s' % scope.root().name
            if node.args.defaults:
                yield 'defaults: [%s]' % ', '.join(self.visit(expr, BaseScope(scope, False)) for expr in node.args.defaults)
            # yield 'kwdefaults: {}'
#            if node.args.args:
#                yield 'arg_names: [%s]' % ', '.join('\'%s\'' % str(arg.arg) for arg in node.args.args)
            if node.args.vararg:
                yield 'starargs: %s' % 'true'
            if node.args.kwarg:
                yield 'kwargs: %s' % 'true'

        scope.define(name)
        return template % {'name': name, 'code': JCompiler.indent(body, 2),
                           'arguments': ', '.join(arguments),
                           'vars': vars,
                           'attributes': JCompiler.indent(attributes(),2)}

    def visit_ClassDef(self, node, scope):
        # ClassDef(identifier name, expr* bases, keyword* keywords, expr? starargs,
        #       expr? kwargs, stmt* body, expr *decorator_list)
        dict_name = '__$dict__'
        template =\
"""%(name)s = (function(){
    var %(dict_name)s={};
    %(vars)s
%(code)s
%(fields)s
    return type('%(name)s', [%(bases)s], %(dict_name)s);
})();"""

        # 1. It first evaluates the inheritance list
        bases = ', '.join(
            self.visit(base, BaseScope(scope, False)) for base in node.bases) # the bases use the parent scope

        # 2. The class’s suite is then executed in a new execution frame
        name = str(node.name)
        class_scope = BaseScope(scope, semi_after=True)
        body = self.generic_visit_list(node.body, class_scope)
        # at the top of the function all local vars are declared
        vars = JCompiler.scope_vars_declaration(class_scope)
        # and then at the bottom those vars are assigned to the current __dict__
        fields = JCompiler.scope_vars_assignment(class_scope, dict_name)

        # define the current class as a var in the parent scope
        scope.define(name)
        return template % {'name': name, 'code': JCompiler.indent(body),
                           'vars': vars, 'fields': JCompiler.indent(fields),
                           'bases': bases, 'dict_name': dict_name}

    def visit_Module(self, node, scope):
        # Module(stmt* body)
        module =\
"""%(builtins)s
var %(name)s=(function(){
    var %(name)s={};
    %(vars)s
%(code)s
%(fields)s
    return %(name)s;
})();"""

        class ModuleScope(BaseScope):
            def __init__(self):
                super().__init__(semi_after=True)
                self.name = scope.name

        module_scope = ModuleScope()
        visit = self.generic_visit_list(node.body, module_scope)
        # all variables are declared at the start of the block, including functions
        # note that only local variables are declared
        vars = JCompiler.scope_vars_declaration(module_scope)
        # assign fields to the module
        fields = JCompiler.scope_vars_assignment(module_scope, module_scope.name)
        return module % {'name': scope.name, 'code': JCompiler.indent(visit),
                         'vars': vars, 'fields': JCompiler.indent(fields),
                         'builtins': self.import_builtins()}

    def visit_Return(self, node, scope):
        # Return(expr? value)
        if node.value:
            return 'return %s;' % self.visit(node.value, PhantomScope(scope, False))
        else:
            return 'return;'

    def visit_Delete(self, node, scope):
        # Delete(expr* targets)
        return '\n'.join('%s = undefined;' % self.visit(expr, PhantomScope(scope, False)) for expr in node.targets)

    def visit_Assign(self, node, scope):
        # Assign(expr* targets, expr value)
        def set_item(target, value):
            # returns the assignment code for a single item
            if isinstance(target, ast.Attribute):
                # Attribute(expr value, identifier attr, expr_context ctx)
                return 'setattr(%(target)s, \'%(name)s\', %(value)s);' \
                            % {'target': self.visit(target.value, PhantomScope(scope,False)),
                               'name': target.attr,
                               'value': value}
            else:
                # just bind the name
                return '%(target)s = %(value)s;' % {'target': self.visit(target, PhantomScope(scope,False)),
                                                   'value':  value}

        value=self.visit(node.value, PhantomScope(scope, False))
        if len(node.targets)==1:
            return set_item(node.targets[0], value)
        else:
            value_var_name='$t'

            non_attributes=[expr for expr in node.targets if not isinstance(expr, ast.Attribute)]
            chain = ' = '.join(self.visit(expr, PhantomScope(scope, False)) for expr in non_attributes)\
            + ' = ' + value + ';'

            attributes=[expr for expr in node.targets if isinstance(expr, ast.Attribute)]
            attribute_chain = '\n'.join(set_item(expr, value_var_name) for expr in attributes)

            return ('var $t;\n$t = ' if attributes else '') + chain + '\n' + attribute_chain

    def visit_AugAssign(self, node, scope):
        # AugAssign(expr target, operator op, expr value)

        op = 'iadd' if isinstance(node.op, ast.Add) else\
            'isub' if isinstance(node.op, ast.Sub) else\
            'imult' if isinstance(node.op, ast.Mult) else\
            'idiv' if isinstance(node.op, ast.Div) else\
            'imod' if isinstance(node.op, ast.Mod) else\
            'ipow' if isinstance(node.op, ast.Pow) else\
            'ilshift' if isinstance(node.op, ast.LShift) else\
            'irshift' if isinstance(node.op, ast.RShift) else\
            'ibitor' if isinstance(node.op, ast.BitOr) else\
            'ibitxor' if isinstance(node.op, ast.BitXor) else\
            'ibitand' if isinstance(node.op, ast.BitAnd) else\
            'ifloordiv' if isinstance(node.op, ast.FloorDiv) else\
            None

        target = self.visit(node.target, PhantomScope(scope, False))
        value = self.visit(node.value, PhantomScope(scope, False))
        return '%(target)s = $op.%(operator)s(%(target)s, %(value)s)' % {'target': target, 'operator': op, 'value': value}

    def visit_If(self, node, scope):
        # If(expr test, stmt* body, stmt* orelse)
        template =\
"""if (bool(%(test)s)) {
%(body)s
} %(extra)s"""

        def orelse():
            if not node.orelse:
                return ''

            if len(node.orelse)==1:
                stmt = node.orelse[0]
                return 'else %s' % self.visit(stmt, PhantomScope(scope, True))
            else:
                return 'else {\n%s \n}' % JCompiler.indent(self.visit_stmt_list(node.orelse, PhantomScope(scope, True)))

        return template % {'test': self.visit(node.test, PhantomScope(scope, False)),
                           'body': JCompiler.indent(self.visit_stmt_list(node.body, PhantomScope(scope, True))),
                           'extra': orelse()}

    def visit_While(self, node, scope):
        # While(expr test, stmt* body, stmt* orelse)
        if not node.orelse:
            template = \
"""while (bool(%(test)s)) {
%(body)s
}"""
            return template % {'test': self.visit(node.test, PhantomScope(scope, False)),
                               'body': JCompiler.indent(self.visit_stmt_list(node.body, PhantomScope(scope, True)))}
        else:
            # rewrite the expression
            code = """
            while True:
                if test:
                    import body
                else:
                    import orelse
                    break
            """
            transformed = templated_ast(code,
                test=node.test,
                body=node.body,
                orelse=node.orelse
            )
            return self.visit(transformed, scope)

    def visit_For(self, node, scope):
        # For(expr target, expr iter, stmt* body, stmt* orelse)
        # the for statement is rewritten as follows
        code =\
"""temp_store = iter(iterable)
while True:
    try:
        target=next(temp_load)
        import body
    except StopIteration:
        import orelse
        break
"""
        temp_iterable = JCompiler.inc_temp_var(getattr(scope, 'temp_iterable', '$i'))
        for_scope = PhantomScope(scope, True, temp_iterable=temp_iterable)
        template = templated_ast(code,
            temp_store=ast.Name(id=temp_iterable, ctx=ast.Store()),
            temp_load=ast.Name(id=temp_iterable, ctx=ast.Load()),
            iterable=node.iter,
            target=node.target,
            body=node.body,
            orelse=node.orelse
        )
        return self.generic_visit_list(template, for_scope)

    @staticmethod
    def inc_temp_var(var_name):
        # returns another unique variable name following a pattern from var_name
        # change this if you want to optimize variable names for nested blocks of the same type
        return var_name + '_'

    def visit_TryExcept(self, node, scope):
        # TryExcept(stmt* body, excepthandler* handlers, stmt* orelse)
        # excepthandler = ExceptHandler(expr? type, identifier? name, stmt* body)

        # Call(expr func, expr* args, keyword* keywords, expr? starargs, expr? kwargs)

        # TODO: Else clause missing

        catch_variable_name = JCompiler.inc_temp_var(getattr(scope, 'catch_variable_name', '$e'))
        catch_scope = PhantomScope(scope, True, catch_variable_name=catch_variable_name)

        def map_handler(handlers):
            # maps a catch block into the corresponding if

            # catch <Exception> <e>: <body>
            # into -->
            # if (isinstance(e$, <Exception>)): e=e$; <body>
            if not handlers: return ast.Pass

            first = handlers[0]
            code = ''
            code += 'if isinstance(temp, exception): ' if first.type else ''
            code += 'var = temp; ' if first.name else ''
            code += 'import body; '
            code += '\nelse: import orelse; ' if len(handlers) > 1 else ''

            return templated_ast(code,
                temp=ast.Name(id=catch_variable_name, ctx=ast.Load()),
                exception=first.type,
                var=ast.Name(id=first.name, ctx=ast.Store()),
                body=first.body,
                orelse=map_handler(handlers[1:])
            )

        condition = map_handler(node.handlers)
        result = 'try { \n%(body)s \n}' % {
            'body': JCompiler.indent(self.visit_stmt_list(node.body, PhantomScope(scope, True)))}
        if node.handlers:
            result += ' catch (%(catch_variable_name)s) { \n%(catch)s \n}'\
            % {'catch': JCompiler.indent(self.visit(condition, catch_scope)),
               'catch_variable_name': catch_variable_name}
        return result

    def visit_TryFinally(self, node, scope):
        # TryFinally(stmt* body, stmt* finalbody)
        if len(node.body) == 1 and isinstance(node.body[0], ast.TryExcept):
            return '%(try)s finally { \n%(body)s \n}'\
            % {'try': self.visit(node.body[0], PhantomScope(scope, False)),
               'body': JCompiler.indent(self.visit_stmt_list(node.finalbody, scope))}
        else:
            template = 'try { \n%(body)s \n} finally { \n%(finalbody)s \n}'
            return template % {'body': JCompiler.indent(self.visit_stmt_list(node.body, scope)),
                               'finalbody': JCompiler.indent(self.visit_stmt_list(node.finalbody, scope))}

    def visit_Raise(self, node, scope):
        # Raise(expr? exc, expr? cause)
        if node.exc:
            return 'throw %s();' % self.visit(node.exc, PhantomScope(scope, False))
        else:
            # raise re-raises the last exception that was active in the current scope
            # If no exception is active in the current scope, a TypeError exception is raised
            # indicating that this is an error
            last_exception_name = getattr(scope, 'catch_variable_name', 'TypeError')
            return 'throw %s;' % last_exception_name

    @check_semi_after
    def visit_Num(self, node, scope):
        return str(node.n)

    def visit_Break(self, node, scope):
        return 'break;'

    def visit_Continue(self, node, scope):
        return 'continue;'

    @check_semi_after
    def visit_BoolOp(self, node, scope):
        # BoolOp(boolop op, expr* values)
        # boolop = And | Or
        if isinstance(node.op, ast.And):
            return "$op.and(%s)" % ", ".join(self.visit(child, PhantomScope(scope, False)) for child in node.values)
        elif isinstance(node.op, ast.Or):
            return "$op.or(%s)" % ", ".join(self.visit(child, PhantomScope(scope, False)) for child in node.values)

    def visit_BinOp(self, node, scope):
        # BinOp(expr left, operator op, expr right)
        # operator = Add | Sub | Mult | Div | Mod | Pow | LShift
        #           | RShift | BitOr | BitXor | BitAnd | FloorDiv

        op = 'add' if isinstance(node.op, ast.Add) else\
            'sub' if isinstance(node.op, ast.Sub) else\
            'mult' if isinstance(node.op, ast.Mult) else\
            'div' if isinstance(node.op, ast.Div) else\
            'mod' if isinstance(node.op, ast.Mod) else\
            'pow' if isinstance(node.op, ast.Pow) else\
            'lshift' if isinstance(node.op, ast.LShift) else\
            'rshift' if isinstance(node.op, ast.RShift) else\
            'bitor' if isinstance(node.op, ast.BitOr) else\
            'bitxor' if isinstance(node.op, ast.BitXor) else\
            'bitand' if isinstance(node.op, ast.BitAnd) else\
            'floordiv' if isinstance(node.op, ast.FloorDiv) else\
            None

        left = self.visit(node.left, PhantomScope(scope, False))
        right = self.visit(node.right, PhantomScope(scope, False))
        return '$op.%(operator)s(%(left)s, %(right)s)' % {'left': left, 'operator': op, 'right': right}

    @check_semi_after
    def visit_UnaryOp(self, node, scope):
        # UnaryOp(unaryop op, expr operand)
        # unaryop = Invert | Not | UAdd | USub

        op = 'not' if isinstance(node.op, ast.Not) else\
            'invert' if isinstance(node.op, ast.Invert) else\
            'uadd' if isinstance(node.op, ast.UAdd) else\
            'usub' if isinstance(node.op, ast.USub) else\
            None

        return '$op.%(op)s(%(operand)s)' % {'op':op , 'operand': self.visit(node.operand, PhantomScope(scope, False))}

    def visit_Lambda(self, node, scope):
        # Lambda(arguments args, expr body)
        arguments = [str(arg.arg) for arg in node.args.args]
        if node.args.vararg:
            arguments += [node.args.vararg]
        if node.args.kwarg:
            arguments += [node.args.kwarg]

        return 'function(%(args)s) { return %(body)s; }' % {'args':', '.join(arguments),
                                                    'body': self.visit(node.body, PhantomScope(scope, False)).replace('\n','')}

    def visit_Compare(self, node, scope):
        # Compare(expr left, cmpop* ops, expr* comparators)

        # cmpop = Eq | NotEq | Lt | LtE | Gt | GtE | Is | IsNot | In | NotIn

        def operand(op):
            return 'eq' if isinstance(op,ast.Eq) else\
                    'noteq' if isinstance(op,ast.NotEq) else\
                    'lt' if isinstance(op,ast.Lt) else\
                    'lte' if isinstance(op,ast.LtE) else\
                    'gt' if isinstance(op,ast.Gt) else\
                    'gte' if isinstance(op,ast.GtE) else\
                    'is' if isinstance(op,ast.Is) else\
                    'isnot' if isinstance(op,ast.IsNot) else\
                    'into' if isinstance(op,ast.In) else\
                    'notin' if isinstance(op,ast.NotIn) else\
                    None

        if len(node.ops)==1:
            return '$op.%(operator)s(%(left)s, %(right)s)' \
                    % {'left': (self.visit(node.left, PhantomScope(scope, False))),
                       'operator': operand(node.ops[0]),
                       'right': (self.visit(node.comparators[0], PhantomScope(scope, False)))}
        else:
            # todo when compare, temp variables are only usefull if the operands are evaluable
            result='var $t1=%(var1)s, $t2 = %(var2)s;' % {'var1': self.visit(node.left, PhantomScope(scope,False)),
                                                         'var2': self.visit(node.comparators[0], PhantomScope(scope, False))}
            result+='if ($op.%(operator)s($t1, $t2)) return true;' % {'operator': operand(node.ops[0])}

            for i in range(1, len(node.ops)):
                result+='$t1 = $t2; $t2 = %s;' % self.visit(node.comparators[i], PhantomScope(scope, False))
                result+='if ($op.%(operator)s($t1, $t2)) return true;' % {'operator': operand(node.ops[i])}

            result+='return false;'
            return "(function(){ %s })()" % result

    @check_semi_after
    def visit_Call(self, node, scope):
        # Call(expr func, expr* args, keyword* keywords, expr? starargs, expr? kwargs)
        # keyword = (identifier arg, expr value)
        template = '%(func)s(%(args)s{%(kwargs)s})'
        args = self.generic_visit_list(node.args, PhantomScope(scope, False), ', ')
        if args: args+=', '

        @concat(', ')
        def keys():
            for key in node.keywords:
                yield '%(key)s: %(value)s' % {'key': key.arg, 'value': self.visit(key.value, PhantomScope(scope, False))}
            if node.starargs:
                yield '$arg: %s' % self.visit(node.starargs, PhantomScope(scope, False))
            if node.kwargs:
                yield '$kwarg: %s' % self.visit(node.kwargs, PhantomScope(scope, False))

        return template % {'func': self.visit(node.func, PhantomScope(scope, False)),
                           'args': args, 'kwargs': keys()}

    @check_semi_after
    def visit_Str(self, node, scope):
        # Str(string s)
        return "\"%s\"" % node.s

    @check_semi_after
    def visit_Attribute(self, node, scope):
        # Attribute(expr value, identifier attr, expr_context ctx)
        # expr_context = Load | Store | Del | AugLoad | AugStore | Param
        if isinstance(node.ctx,ast.Load):
            return 'getattr(%(value)s,\'%(identifier)s\')' % {'value': self.visit(node.value, PhantomScope(scope, False)),
                                                          'identifier': str(node.attr)}
        elif isinstance(node.ctx,ast.Store) or isinstance(node.ctx, ast.AugStore):
            return '%(value)s.%(identifier)s' % {'value': self.visit(node.value, PhantomScope(scope, False)),
                                                          'identifier': str(node.attr)}

    def visit_Subscript(self, node, scope):
        # Subscript(expr value, slice slice, expr_context ctx)
        #slice = Slice(expr? lower, expr? upper, expr? step) | ExtSlice(slice* dims) | Index(expr value)

        # todo implement slices

        if isinstance(node.ctx, ast.Load):
            return '%(target)s.__getitem__(%(index)s)' % {'target': self.visit(node.value, PhantomScope(scope, False)),
                                                        'index': self.visit(node.slice, PhantomScope(scope, False))}

    def visit_Slice(self, node, scope):
        # Slice(expr? lower, expr? upper, expr? step)
        # slice([start,] stop[, step])

        @concat(', ')
        def args():
            if node.lower: yield self.visit(node.lower, PhantomScope(scope, False))
            if node.upper: yield self.visit(node.upper, PhantomScope(scope, False))
            if node.step: yield self.visit(node.step, PhantomScope(scope, False))

        return 'slice(%s)' % args()

    def visit_ExtSlice(self, node, scope):
        # ExtSlice(slice* dims)
        return ', '.join(self.visit(sli, PhantomScope(scope, False)) for sli in node.dims)

    def visit_Index(self, node, scope):
        # Index(expr value)
        return self.visit(node.value, PhantomScope(scope, False))

    @check_semi_after
    def visit_Name(self, node, scope):
        # Name(identifier id, expr_context ctx)
        # expr_context = Load | Store | Del | AugLoad | AugStore | Param
        name = str(node.id)

        if name == 'True':
            return 'true'
        elif name == 'False':
            return 'false'
        elif name == 'None':
            return 'undefined'
        elif name == 'this':
            # this keyword has a particular interpretation in JS, so change it...
            return '$this'
        else:
            if isinstance(node.ctx, ast.Store): scope.define(name)

            return name

js = JCompiler()

code = """
#def foo():
yield 1
return 1
"""

program = compile(code)
print(program)

