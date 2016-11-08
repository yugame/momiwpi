/**
 * Created by yushi on 2016/8/3.
 */
var Fs = require('fs');
var Wechat = require('wechat');
var WechatAPI = require('wechat-api');
var DataEngine = require('../db/data_engine');
var Account = require('../db/account');
var Payment = require('./payment');

//在express的app上嫁接一个微信公众号提供服务
var WechatSrv = function(p_app, p_link, p_config) {

    this.m_logic = null;
//支付配置
    if(p_config.pay) {
        var _config = {
            partnerKey: p_config.partnerKey,
            appId: p_config.appid,
            mchId: p_config.mchId,
            notifyUrl: p_config.notifyUrl,
            pfx: Fs.readFileSync(p_config.cert)
        };

        this.m_payment = new Payment(_config);
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

WechatSrv.prototype.f_regLogic = function (p_logic) {
    this.m_logic = p_logic;
    p_logic.f_setMaster(this);
};

WechatSrv.prototype.f_listen = function(p_app, p_link, p_config){
    this.m_admin = p_config.adminOpenID;
    this.m_api = new WechatAPI(p_config.appid, p_config.appsecret);
    this.m_api.getLatestToken(function (p_err, p_token) {
        console.log(p_token);
    });

    var _route = '/' + p_config.myName;
    console.log(_route);

    var self = this;
    p_app.use(_route, Wechat(p_config, function (p_req, p_res, p_next) {
        var _msg = p_req.weixin;
        var _openID = _msg.FromUserName; //用户的OPENID

        self.m_account.f_getAccount(_openID, function (p_err, p_account) {
            if(p_err){
                console.log(p_err);
                return;
            }
            if(!p_account){
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
                    self.m_account.f_createAccount(_params, function (p_err, p_new) {
                        if(p_err){
                            console.log(p_err);
                            return;
                        }
                        self.f_msg(p_new, _msg, p_res);
                    })
                });
                return;
            }
            self.f_msg(p_account, _msg, p_res);
        })
    }));
};

var M_filt = {};

WechatSrv.prototype.f_msg = function(p_account, p_msg, p_res){
    var _msgType = p_msg.MsgType;
    var _uid = p_account.unionID;
    var _openID = p_account.openID;

    //排重 去除重复的消息
    var _tmp = _openID + p_msg.CreateTime;
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
            if(!p_account.subscribeTime){
                _type = 'subscribe0';
                p_account.subscribeTime = Date.now();
                p_account.save();
            }
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
    this.f_toRoute(_openID, _uid, _type, _content, p_res);
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
            console.log(p_user);
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
        if(this.m_logic) {
            this.m_logic.f_recv(_cmd, p_res);
        }
        else{
            console.log('wechat srv no reg logic');
        }
    }
    catch(p_err){
        console.log(p_err);
    }
};

//处理微信返回的信息
WechatSrv.prototype.f_srvBack = function(p_openID, p_text, p_err, p_result){
    if (p_err) {
        console.log('srv: ' + p_openID + ' ' + p_err + ' errcode: ' + p_err.code);
        console.log(p_text);
        //45047发太多了  45015用户沉默了
        if(p_err.code == 45047 || p_err.code == 45015){
            //转为推送模板消息
            //this.f_workNotice(p_openID, p_text);
        }
    }
};

//主动推消息给用户 p_uid 是联合unionid 需要转为 openID 使用
WechatSrv.prototype.f_push = function (p_uid, p_msg) {
    var self = this;
    this.m_account.f_getOpenID(p_uid, function (p_err, p_openID) {
        if(p_err){
            console.log(p_err);
            return;
        }
        if(!p_openID){
            console.log('f_push can not find uid with ' + p_uid);
            console.log(p_msg);
            return;
        }
        self.m_api.sendText(p_openID, p_msg, self.f_srvBack.bind(self, p_openID, p_msg));
    });
};

WechatSrv.prototype.f_title = function (p_uid) {

};

//发送红包接口
/*
红包格式
 act_name       活动名称 （不显示给用户）
 remark         备注信息 （不显示给用户）
 send_name      红包发送者名称
 total_amount   红包大小 单位分
 total_num      接收人数 大于1人则为裂变红包 裂变目前只能全随机
 wishing        红包祝福语 小于128字符
 serial         红包序号 内部管理用
 */
WechatSrv.prototype.f_redPack = function (p_uid, p_red, p_cb) {
    var self = this;
    this.m_account.f_getOpenID(p_uid, function (p_err, p_openID) {
        if(p_err){
            console.log(p_err);
            p_cb('f_redPack sys wrong');
            return;
        }

        var _err = null;
        if(!p_openID){
            _err = 'f_redPack can not find uid with ' + p_uid;
        }
        else if(!self.m_payment){
            _err = 'f_redPack with no payment';
        }
        if(_err){
            console.log(_err);
            p_cb(_err);
            return;
        }

        self.m_payment.f_sendRedPack(p_openID, p_red, function (p_err, p_result) {
            if(p_err){
                console.log(p_err);
            }
            p_cb(p_err, p_result);
        });
    });
};

//企业支付接口
/*
 格式
 amount   红包大小 单位分
 desc     描述
 serial   支付序号 内部管理用
 */
WechatSrv.prototype.f_pay = function (p_uid, p_pay, p_cb) {
    var self = this;
    this.m_account.f_getOpenID(p_uid, function (p_err, p_openID) {
        if(p_err){
            console.log(p_err);
            p_cb('f_pay sys wrong');
            return;
        }

        var _err = null;
        if(!p_openID){
            _err = 'f_pay can not find uid with ' + p_uid;
        }
        else if(!self.m_payment){
            _err = 'f_pay with no payment';
        }
        if(_err){
            console.log(_err);
            p_cb(_err);
            return;
        }

        self.m_payment.f_sendPay(p_openID, p_pay, function (p_err, p_result) {
            if(p_err){
                console.log(p_err);
            }
            p_cb(p_err, p_result);
        });
    });
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
