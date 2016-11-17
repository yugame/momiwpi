/**
 * Created by yushi on 2016/11/17.
 */
var express = require('express');
var router = express.Router();
var M_wechatSrv = null;
var M_logic = null;

router.f_regSrv = function (p_srv) {
    M_wechatSrv = p_srv;
    M_logic = M_wechatSrv.f_getLogic();
};

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

module.exports = router;