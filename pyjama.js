var py=(function(){
    var builtin=function (){ };
    // add the window to the scope lookup process
    builtin.prototype=window;
    builtin.prototype.constructor=builtin;

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
            function Class(){
                var instance = create(Class);
                instance.__class__= Class;
                bound_members(instance, Class);
                return instance;
            }
            extend(Class, object);

            Class.__name__=name;

            copy_members(dict, Class);

            return Class
        }
    }
    builtin.prototype.type=type;

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

    function copy_members(from, to){
        for (var key in from)
            to[key] = from[key];
    }

    function extend(child, parent){
        copy_members(parent, child);
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

    var range=function(from, to){};
    var iter=range(1,2);
    var i;
    while (true){
        try{
            i=iter.__next__();
            // code
        }
        catch
        {
//            $34=2
            break;

        }
    }

    return new builtin();
})();
