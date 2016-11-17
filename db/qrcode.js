/**
 * Created by yushi on 2016/11/17.
 */
var M_schema = {
    scene: {type: String, unique: true},
    url: String,
    createTime: Number,
    expireTime: Number
};

var QrCode = function (p_dataEngine) {
    this.m_qrCode = p_dataEngine.f_createModel('qrcode', M_schema);
    this.m_sceneToQrCode = {};
};

QrCode.prototype.f_verify = function (p_code) {
    if(p_code.expireTime === 0){
        return true;
    }
    if(Date.now() >= p_code.expireTime ){
        p_code.remove();
        return false;
    }
    return true;
};

QrCode.prototype.f_create = function (p_scene, p_url, p_expire, p_cb) {
    var _now =  Date.now();
    var _expire = 0;
    if(p_expire){
        _expire = _now + p_expire*1000;
    }
    var _account = new this.m_qrCode({
        scene: p_scene,
        url: p_url,
        createTime: _now,
        expireTime: _expire
    });
    _account.save(p_cb);
};


QrCode.prototype.f_get = function(p_scene, p_cb){
    var _code = this.m_sceneToQrCode[p_scene];
    if(_code){
        if(this.f_verify(_code)) {
            p_cb(null, _code);
        }
        else{
            delete this.m_sceneToQrCode[p_scene];
            p_cb(null, null);
        }
        return;
    }
    var self = this;
    this.m_qrCode.findOne({scene: p_scene}, function (p_err, p_code) {
        if (p_err) {
            console.log(p_err);
            p_cb('f_getQrCode db error');
            return;
        }
        if(!p_code){
            p_cb(null, null);
            return;
        }
        if(!this.f_verify(p_code)) {
            p_cb(null, null);
            return
        }
        
        self.m_sceneToQrCode[p_scene] = p_code;
        p_cb(null, p_code);
    });
};

QrCode.prototype.f_getUrl = function(p_scene, p_cb) {
    this.f_get(p_scene, function (p_err, p_code) {
        if(p_err){
            p_cb(p_err);
            return;
        }
        if(!p_code){
            p_cb(null, null);
            return;
        }
        p_cb(null, p_code.url);
    });
};

module.exports = QrCode;