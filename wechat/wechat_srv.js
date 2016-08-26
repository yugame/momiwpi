/**
 * Created by yushi on 2016/8/3.
 */
var Fs = require('fs');
var Wechat = require('wechat');
var WechatAPI = require('wechat-api');
var DataEngine = require('../db/data_engine');
var Account = require('../db/account');

//在express的app上嫁接一个微信公众号提供服务
var WechatSrv = function(p_app, p_link, p_config) {
    if(p_config.logic){
        try {
            this.m_logic = require(G_path + p_config.logic);
        }
        catch(p_err){
            console.log('Load local logic fail ' + G_path + p_config.logic);
            //process.exit();
        }
    }
    if(!this.m_logic){
        this.m_logic = require('../config/sample_logic');
        console.log('use local sample logic. Find format at ./config/sample_logic');
    }
    this.m_data = new DataEngine(p_config.dbUrl);
    var self = this;
    this.m_data.f_connect(function (p_err) {
        if(p_err){
            console.log(p_err);
            process.exit();
        }
        self.m_account = new Account(self.m_data);
    })
    this.f_listen(p_app, p_link, p_config);
};

WechatSrv.prototype.f_listen = function(p_app, p_link, p_config){
    this.m_admin = p_config.adminOpenID;
    this.m_api = new WechatAPI(p_config.appid, p_config.appsecret);
    this.m_api.getLatestToken(function (p_err, p_token) {
        console.log(p_token);
    });

    /*
     this.m_mid = new MID(_api, p_link);
     */

    var _route = '/' + p_config.myName;
    console.log(_route);

    var self = this;
    p_app.use(_route, Wechat(p_config, function (p_req, p_res, p_next) {
        var _msg = p_req.weixin;
        var _openID = _msg.FromUserName; //用户的OPENID
        self.m_account.f_getUID(_openID, function (p_err, p_uid) {
            if(p_err){
                console.log(p_err);
                return;
            }
            if(!p_uid){
                self.m_api.getUser(_openID, function (p_err, p_result) {
                    if (p_err) {
                        console.log(p_err);
                        return;
                    }
                    //console.log(p_result);
                    var _uid = p_result.unionid;
                    if(!_uid){
                        _uid = 'none';
                    }
                    var _params = {openID:_openID, unionID:_uid, userInfo:p_result};
                    self.m_account.f_createAccount(_params, function (p_err, p_account) {
                        if(p_err){
                            console.log(p_err);
                            return;
                        }
                        self.f_msg(_openID, p_account.unionID, _msg, p_res);
                    })
                });
                return;
            }
            self.f_msg(_openID, p_uid, _msg, p_res);
        })
    }));
};

var M_filt = {};

WechatSrv.prototype.f_msg = function(p_openID, p_uid, p_msg, p_res){
    var _msgType = p_msg.MsgType;

    //排重 去除重复的消息
    var _tmp = p_openID + p_msg.CreateTime;
    if (_msgType === 'text') {
        _tmp = p_msg.MsgId;
    }

    if(M_filt[_tmp]) {
        //res.reply(''); //重复的消息直接返回
        p_res.reply('filt');
        return;
    }
    M_filt[_tmp] = true;

    var _content = 'none';
    var _type = 'none';

    //将微信消息类型转换为系统消息类型
    // cmd 文字消息和菜单点击  image 发送图片  subscribe unsubscribe 订阅和退订
    if (_msgType === 'text') {
        _type = 'cmd';
        _content = p_msg.Content;
    }
    else if (_msgType === 'image') {
        _type = _msgType;
        _content = p_msg.PicUrl;
    }
    else if (_msgType === 'event') {
        var _eventKey = p_msg.EventKey;
        if (_eventKey) {
            _content = _eventKey;
        }

        var _event = p_msg.Event;
        if (_event === 'subscribe') {
            //订阅事件
            _type = _event;
        }
        else if (_event === 'unsubscribe') {
            //退订事件
            _type = _event;
        }
        else if(_event === 'CLICK') {
            //菜单点击事件
            _type = 'cmd';
        }
        else if (_event === 'SCAN' || _event === 'VIEW' || _event === 'TEMPLATESENDJOBFINISH') {
            //扫描二维码事件 用户跳转页码事件 模板发送到位事件 暂不处理
        }
        else{
            console.log('no deal event ' + _event + ' ' + _eventKey);
        }
    }
    else{
        console.log('no deal msg ' + _msgType);
    }

    if(_type === 'none'){
        p_res.reply('no deal');
        console.log('no deal: \n');
        console.log(p_msg);
        return;
    }

    this.f_toRoute(p_openID, p_uid, _type, _content, p_res);
};

WechatSrv.prototype.f_updateMenu = function (p_func) {
    var self = this;

    Fs.readFile('./menu.json',function(p_err, p_data){
        if(p_err){
            p_func(p_err.toString());
            return;
        }
        console.log(p_data.toString());
        self.m_api.createMenu(p_data, function(p_err, p_result){
            if(p_err) {
                p_func(p_err.toString());
                return;
            }
            p_func(p_result.errmsg);
        });
    });
};

WechatSrv.prototype.f_isAdmin = function (p_user) {
    return p_user === this.m_admin;
};

//将消息送给路由
WechatSrv.prototype.f_toRoute = function (p_user, p_uid, p_type, p_msg, p_res) {
    var _cmd = {
        user: p_user,
        uid: p_uid,
        type: p_type,
        msg: p_msg
    };

    //对管理命令做出处理
    if(_cmd.type === 'cmd'){
        if(_cmd.msg === 'admin_menu'){
            if(this.f_isAdmin(p_user)){
                this.f_updateMenu(function (p_msg) {
                    p_res.reply(p_msg);
                    console.log(p_msg);
                });
                return;
            }
        }
    }
    try {
        this.m_logic.F_recv(_cmd, p_res);
    }
    catch(p_err){
        console.log(p_err);
    }

    //self.m_mid.f_sendMsg(_cmd, p_res);
};

//通知路由 肯定不需要回复
WechatSrv.prototype.f_noticeRoute = function (p_user, p_type, p_msg, p_res) {
    var _cmd = {
        user: p_user,
        type: p_type,
        msg: p_msg
    };
    console.log('notice ' + p_user + ' ' + p_type);
    //self.m_mid.f_notice(_tobot);
};

module.exports = WechatSrv;
