function instance_method(name){
    return name!=='__init__' && name !== '__new__';
}

function isinstance(item, classinfo) {
    return item.__class__ === classinfo;
}

function create(classinfo){
    var instance = classinfo.__new__(classinfo);
    classinfo.__init__(instance);
    return instance;
}

function staticmethod(func){
    function wrapper(){
        return func.apply(this, Array.apply(this, arguments).slice(1));
    }
    return wrapper();
}

function type(name, bases, dict){
    if (arguments.length == 1)
        return name.__class__;
    else{
        // function Class
        throw '';
    }
}

function bound_members(instance, classinfo){
    function append(item, array){
        // adds the item on the first position of the array
        var result=new Array(array.length+1);
        result[0]=item;
        for(var i=1;i<result.length;i++)
            result[i]=array[i-1];
        return result;
    }

    function bound(name){
        var method=classinfo[name];
        instance[name]=function(){return method.apply(instance, append(instance, arguments)); };
    }

    for (key in classinfo) {
        if (typeof(classinfo[key])==='function') {
            if (instance_method(key)){
                bound(key);
            }
        }
        else{
            instance[key] = classinfo[key];
        }
    }
}

function extend(child, parent){
    for (var key in parent){
        child[key]=parent[key];
    }
}

var object=(function(){
    function Class(){
        var instance = create(Class);
        instance.__class__= Class;
        bound_members(instance, Class);
        return instance;
    }
    Class.__name__='object';
    Class.__new__ = function(cls){ return new function(){}; };
    Class.__init__ = function(self){};

    Class.__setattr__ = function(self, name, value){throw new AttributeError(Class, name);};
    Class.__getattr__ = function (self, name){ return self[name]; };
    Class.__delattr__ = function(self, name){self[name]=undefined};

    return Class;
})();

var Class=(function(){
    function Class(){
        var instance = create(Class);
        instance.__class__= Class;
        bound_members(instance, Class);
        return instance;
    }
    extend(Class, object);

    Class.__name__='Class';

    var __closure__ = {};

    __closure__.__new__ = function (cls) { return new function () { };};
    __closure__.__init__ = function(self) { self.y=13; };

    __closure__.bla = function (self){return 1;};
    __closure__.__call__ = function(self){console.log('called');};

    __closure__.cl=5;

    return type('Class', [], __closure__);
})();

var ModuleX=(function(){
    var module={
        __name__: 'ModuleX'
    };

    var foo = module.foo = function(){};

    return module;
})();

a=new Class();
