/**
 * Created by yushi on 2016/8/4.
 */
var express = require('express');
var router = express.Router();
var Crypto = require('crypto');
var OAuth = require('wechat-oauth');
var M_auth = new OAuth(G_config.srv.appid, G_config.srv.appsecret);

var M_stateToHash = {}; //state 对应的 hash
var M_hashToStateObj = {}; //hash 对应的已解析的 stateobj
var M_login = {}; //sid 对应的 用户
var M_logic = null;
var M_wechatSrv = null;

//获取微信授权url地址
function GetAuthUrl(p_state) {
    //return M_auth.getAuthorizeURL(G_config.srv.authUrl, p_state, 'snsapi_base');
    return M_auth.getAuthorizeURL(G_config.srv.authUrl, p_state, 'snsapi_userinfo');
}

//创建用户session
function CreateSession (p_user) {
    var _sid = Date.now() + '_' + Math.floor(Math.random()*10000000);
    M_login[_sid] = p_user;
    return _sid;
};

//p_state {type:'test', value:11} 执行相关命令
function DoApi(p_user, p_state, p_res) {
    //console.log(p_state);
    var _connect = '?';
    if(p_state.value.indexOf('?') > 0){
        _connect = '&';
    }
    if(p_state.type === 'login'){
        p_res.redirect(p_state.value + _connect + 'sid=' + CreateSession(p_user));
    }
    else if(p_state.type === 'logindirect'){
        p_res.redirect(p_state.value + _connect + 'uid=' + p_user.unionid);
    }
    else{
        p_res.json({err:'state type wrong ' + p_state.type});
    }
}

function DoRpc(p_param, p_res) {
    //todo 安全验证
    //console.log(p_param);
    if(p_param.cmd === 'verify'){
        var _sid = p_param.value;
        if(_sid){
            var _user = M_login[_sid];
            if(_user){
                delete M_login[_sid];
                p_res.json({result:_user});
                return;
            }
        }
        p_res.json({err:'fail'});
    }
    else if(p_param.cmd === 'logic'){
        if(M_logic){
            M_logic.f_rpc(p_param.value, p_res);
        }
        else{
            console.log('DoRpc no logic');
        }
    }
    else if(p_param.cmd === 'qrcode'){
        if(!p_param.value){
            p_res.json({err:'qrcode need value'});
            return;
        }
        if(!M_wechatSrv){
            console.log('qrcode no wechat srv');
            return;
        }
        M_wechatSrv.f_createQRCode(p_param.value, function (p_err, p_url) {
            if(p_err){
                p_res.json({err:p_err});
                return;
            }
            p_res.json({url:p_url});
        });
    }
    else{
        p_res.json({err:'rpc wrong'});
    }
}

router.f_regSrv = function (p_srv) {
    M_wechatSrv = p_srv;
    M_logic = M_wechatSrv.f_getLogic();
    M_wechatSrv.f_getSessionUser = function (p_sid) {
        if(p_sid){
            var _user = M_login[p_sid];
            if(_user){
                delete M_login[p_sid];
                return _user;
            }
        }
        return null;
    }
};

/* GET home page. */
router.get('/', function(p_req, p_res, p_next) {
    p_res.json({err:'not support'});
});

function GetClientIp(p_req) {
    return p_req.headers['x-forwarded-for'] ||
        p_req.connection.remoteAddress ||
        p_req.socket.remoteAddress ||
        p_req.connection.socket.remoteAddress;
}

function CheckRpcIP(p_ip) {
    return G_config.rpcAllows[p_ip];
}

router.get('/rpc', function (p_req, p_res, p_next) {
    var _ip = GetClientIp(p_req);
    //console.log('rpc by ' + _ip);
    if(CheckRpcIP(_ip)){
        DoRpc(p_req.query, p_res);
    }
    else{
        p_res.json({err:'invaild ' + _ip});
    }
});

router.get('/api', function (p_req, p_res, p_next) {
    var _state = p_req.query.state;
    if(!_state){
        p_res.json({err:'NO state'});
        return;
    }
    //console.log(_state);
    // state -> hash -> stateobj
    var _hash = M_stateToHash[_state];
    if(!_hash){
        try {
            //var _stateObj = JSON.parse('{' + _state + '}');
            var _stateObj = JSON.parse(_state);
            var _md5 = Crypto.createHash('md5');
            _hash = _md5.update(_state).digest('hex');

            M_stateToHash[_state] = _hash;
            M_hashToStateObj[_hash] = _stateObj;
        }
        catch(p_err){
            console.log(p_err);
            p_res.json('STATE WRONG: ' + _state);
            return;
        }
    }
    p_res.redirect(GetAuthUrl(_hash));
});

router.get('/_api', function (p_req, p_res, p_next) {
    var _code = p_req.query.code;
    if(!_code){
        p_res.json({err:'NO code'});
        return;
    }

    var _state = p_req.query.state;
    if(!_state){
        p_res.json({err:'NO state'});
        return;
    }

    var _stateObj = M_hashToStateObj[_state];
    if(!_stateObj){
        p_res.json({err:'state error'});
        return;
    }

    M_auth.getAccessToken(_code, function (p_err, p_result) {
        if(p_err){
            p_res.json({err: p_err});
            return;
        }
        //var accessToken = result.data.access_token;
        var _openid = p_result.data.openid;
        M_auth.getUser(_openid, function (p_err, p_result) {
            if(p_err){
                p_res.json({err: p_err});
                return;
            }
            DoApi(p_result, _stateObj, p_res);
        });
    });
});

module.exports = router;
