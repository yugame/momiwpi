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
    console.log(p_state);
    if(p_state.type === 'login'){
        console.log(p_state.value);
        p_res.redirect(p_state.value + '?sid=' + CreateSession(p_user));
    }
    else{
        p_res.render('interface', {title: 'Interface', user: p_user, state:p_state});
    }
}

function DoRpc(p_param, p_res) {
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
    else{
        p_res.json({err:'rpc wrong'});
    }
}

/* GET home page. */
router.get('/', function(p_req, p_res, p_next) {
    //res.render('interface', { title: 'Interface'});
    p_res.json({err:'not support'});
});

router.get('/rpc', function (p_req, p_res, p_next) {
    DoRpc(p_req.query, p_res);
});

router.get('/api', function (p_req, p_res, p_next) {
    var _state = p_req.query.state;
    if(!_state){
        p_res.json({err:'NO state'});
        return;
    }

    // state -> hash -> stateobj
    var _hash = M_stateToHash[_state];
    if(!_hash){
        try {
            var _stateObj = JSON.parse('{' + _state + '}');
            var _md5 = Crypto.createHash('md5')
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
            //console.log(p_result);
            //p_res.render('interface', {title: 'Interface', openid: _openid});
        });
    });
});

module.exports = router;
