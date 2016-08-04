/**
 * Created by yushi on 2016/8/4.
 */
var express = require('express');
var router = express.Router();
var OAuth = require('wechat-oauth');
var M_auth = new OAuth(G_config.srv.appid, G_config.srv.appsecret);

function GetAuthUrl(p_state) {
    //return M_auth.getAuthorizeURL('http://test.momiw.com/interface/_api', p_state, 'snsapi_base');
    return M_auth.getAuthorizeURL('http://test.momiw.com/interface/_api', p_state, 'snsapi_userinfo');
}

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('interface', { title: 'Interface', openid: 'some' });
});

router.get('/api', function (p_req, p_res, p_next) {
    p_res.redirect(GetAuthUrl(p_req.query.state));
});

router.get('/_api', function (p_req, p_res, p_next) {
    var _code = p_req.query.code;
    if(!_code){
        return p_res.json({err:'NO code'});
    }

    M_auth.getAccessToken(_code, function (p_err, p_result) {
        if(p_err){
            p_res.json({err: p_err});
            return;
        }
        //var accessToken = result.data.access_token;
        var _openid = p_result.data.openid;

        p_res.render('interface', {title: 'Interface', openid: _openid});
    });
});

module.exports = router;
