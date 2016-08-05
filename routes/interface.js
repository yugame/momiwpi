/**
 * Created by yushi on 2016/8/4.
 */
var express = require('express');
var router = express.Router();
var M_md5 = require('crypto').createHash('md5');
var OAuth = require('wechat-oauth');
var M_auth = new OAuth(G_config.srv.appid, G_config.srv.appsecret);

//state 对应的 hash
var M_stateToHash = {};
//hash 对应的已解析的 state
var M_hashToObj = {};

//获取微信授权url地址
function GetAuthUrl(p_state) {
    //return M_auth.getAuthorizeURL('http://test.momiw.com/interface/_api', p_state, 'snsapi_base');
    return M_auth.getAuthorizeURL('http://test.momiw.com/interface/_api', p_state, 'snsapi_userinfo');
}

//p_state {type:'test', value:11} 执行相关命令
function DoApi(p_user, p_state, p_res) {
    console.log(p_state);
    p_res.render('interface', {title: 'Interface', user: p_user, state:p_state});
}

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('interface', { title: 'Interface'});
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
        var _stateObj = JSON.parse('{' + _state + '}');
        _hash = M_md5.update(_state).digest('hex');
        M_stateToHash[_state] = _hash;
        M_hashToObj[_hash] = _stateObj;
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

    var _stateObj = M_hashToObj[_state];
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
