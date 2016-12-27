/**
 * Created by yushi on 2016/6/16.
 */

//v0.0.2 2016/12/27
var Promise = require("bluebird");

var M_schema = {
    key: {type:String, unique:true},
    value: {}
};

var MKey = function (p_db) {
    this.m_keyModel = p_db.f_createModel('key', M_schema);
    this.m_keyMap = {}; //KEY对应的存储数据
    this.m_kv = {}; //系统直接使用的KEY VALUE容器
};

MKey.prototype.f_LoadAll = function(){
    var _pm = Promise.pending();
    var self = this;
    this.m_keyModel.find({},function(p_err, p_result){
        if(p_err){
            console.log(p_err);
        }
        else {
            if(p_result) {
                var _count = p_result.length;
                for(var i = 0; i < _count; ++i) {
                    var _pair = p_result[i];
                    var _key = _pair.key;
                    self.m_kv[_key] = _pair.value;
                    self.m_keyMap[_key] = _pair;
                }
                console.log('MKey LoadAll ' + _count);
                _pm.resolve();
            }
            else{
                _pm.reject('Load All no result');
            }
        }
    });
    return _pm.promise;
};

MKey.prototype.f_get = function(p_key){
    if(this.m_kv[p_key] === undefined){
        this.m_kv[p_key] = null;
    }
    return this.m_kv[p_key];
};

MKey.prototype.f_set = function(p_key, p_value){
    var self = this;

    this.m_kv[p_key] = p_value;
    if(this.m_keyMap[p_key] === undefined){
        this.m_keyModel.findOne({key: p_key}, function(p_err, p_pair){
            if(p_err){
                console.log(p_err);
                return;
            }
            if(!p_pair){
                //没找到则创建这个KEY
                var _pair = new self.m_keyModel({key:p_key, value:p_value});
                _pair.save(function(p_err, p_result){
                    if(p_err){
                        console.log(p_err);
                        return;
                    }
                    console.info('save new key ' + p_key);
                });
                self.m_keyMap[p_key] = _pair;
                console.info('create new key ' + p_key);
            }
            else {
                self.m_keyMap[p_key] = p_pair;
                self.m_keyMap[p_key].value = p_value;
                self.m_keyMap[p_key].save();
            }
        });
    }
    else {
        this.m_keyMap[p_key].value = p_value;
        this.m_keyMap[p_key].save();
    }
};

MKey.prototype.f_del = function(p_key){
    if(this.m_keyMap[p_key]){
        this.m_keyMap[p_key].remove();
        delete this.m_keyMap[p_key];
    }
    else{
        this.m_keyModel.remove({key: p_key}, function(p_err) {
            console.log(arguments);
            if (p_err) {
                console.log(p_err);
                return;
            }
        });
    }
    delete this.m_kv[p_key];
};

var m_single = null;

MKey.F_init = function (p_db) {
    var _pm = Promise.pending();
    m_single = new MKey(p_db);
    m_single.f_LoadAll()
        .then(function () {
            _pm.resolve(m_single);
        })
        .catch(function (p_err) {
            _pm.reject(p_err);
        });
    return _pm.promise;
};

MKey.F_set = function (p_key, p_value) {
    if(m_single){
        m_single.f_set(p_key, p_value);
    }
};

MKey.F_get = function (p_key) {
    if(m_single){
        return m_single.f_get(p_key);
    }
    return null;
};

module.exports = MKey;