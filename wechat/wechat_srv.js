/**
 * Created by yushi on 2016/8/3.
 */
var Fs = require('fs');
var Wechat = require('wechat');
var WechatAPI = require('wechat-api');
var DataEngine = require('../db/data_engine');
var Account = require('../db/account');
var QrCode = require('../db/qrcode');
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

    this.m_menu = './menu.json';
    if(p_config.workDir){
        this.m_menu = p_config.workDir + 'menu.json';
    }

    this.m_data = new DataEngine(p_config.dbUrl);
    var self = this;
    this.m_data.f_connect(function (p_err) {
        if(p_err){
            console.log(p_err);
            process.exit();
        }
        self.m_account = new Account(self.m_data);
        self.m_qrCode = new QrCode(self.m_data);
    })
    this.f_listen(p_app, p_link, p_config);
};

WechatSrv.prototype.f_regLogic = function (p_logic) {
    this.m_logic = p_logic;
    p_logic.f_setMaster(this);
};

WechatSrv.prototype.f_getLogic = function () {
    return this.m_logic;
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
        else if(_event === 'SCAN'){
            _type = 'scan';
            console.log(p_msg);
        }
        else if (_event === 'VIEW' || _event === 'TEMPLATESENDJOBFINISH') {
            //扫描二维码事件 用户跳转页码事件 模板发送到位事件 暂不处理
            _type = 'other';
        }
        else{
            console.log('no deal event ' + _event + ' ' + _eventKey);
        }
    }
    else{
        console.log('no deal msg ' + _msgType);
    }

    if(_type === 'none'){
        p_res.reply('');
        console.log('no deal: \n');
        console.log(p_msg);
        return;
    }
    this.f_toRoute(_openID, _uid, _type, _content, p_res);
};

WechatSrv.prototype.f_updateMenu = function (p_func) {
    var self = this;

    Fs.readFile(this.m_menu, function(p_err, p_data){
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
WechatSrv.prototype.f_toRoute = function (p_openID, p_uid, p_type, p_msg, p_res) {
    var _cmd = {
        openID: p_openID,
        uid: p_uid,
        type: p_type,
        msg: p_msg
    };

    //对管理命令做出处理
    if(_cmd.type === 'cmd'){
        if(_cmd.msg === 'admin_menu'){
            console.log(p_openID);
            if(this.f_isAdmin(p_openID)){
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

//发送模板消息
WechatSrv.prototype.f_workNotice = function(p_uid, p_tid, p_data){
    var self = this;
    this.m_account.f_getOpenID(p_uid, function (p_err, p_openID) {
        if(p_err){
            console.log(p_err);
            return;
        }
        if(!p_openID){
            console.log('f_workNotice can not find uid with ' + p_uid);
            return;
        }
        self.m_api.sendTemplate(p_openID, p_tid, '', p_data, function(p_err){
            if(p_err){
                console.log(p_err);
            }
        });
    });
};

//生成二维码
WechatSrv.prototype.f_createQRCode = function (p_str, p_cb) {
    var self = this;
    console.log(p_str);
    this.m_qrCode.f_getUrl(p_str, function (p_err, p_url) {
        if(p_err){
            console.log(p_err);
            p_cb('f_getUrl fail');
            return;
        }
        if(p_url){
            p_cb(null, p_url);
            return;
        }
        self.m_api.createLimitQRCode(p_str, function(p_err, p_result) {
        //self.m_api.createTmpQRCode(p_str, 604800, function(p_err, p_result) { //临时二维码不支持字符串 //todo
            if (p_err) {
                console.log(p_err);
                p_cb('create qrcode api fail');
                return;
            }
            var _url = self.m_api.showQRCodeURL(p_result.ticket);
            self.m_qrCode.f_create(p_str, _url, p_result.expire_seconds, function (p_err, p_code) {
                if (p_err) {
                    console.log(p_err);
                    p_cb('create qrcode db fail');
                    return;
                }
                p_cb(null, p_code.url);
            });
        });
    });
};

//遍历用户 p_tag
WechatSrv.prototype.f_enumUser = function (p_cb, p_tag, p_next) {
    var self = this;

    var _f_result = function (p_err, p_result) {
        if(p_err){
            console.log(p_err);
            return;
        }
        var _count = p_result.count;
        for(var i = 0; i < _count; ++i){
            var _openid = p_result.data.openid[i];
            self.m_account.f_getUID(_openid, function (p_err, p_uid, p_openID) {
                if(p_err){
                    console.log(p_err);
                    return;
                }
                if(p_uid) {
                    p_cb(p_uid);
                }
                else {
                    console.log('not found uid with ' + p_openID);
                }
            });
            //p_cb(_openid);
        }
        var _next = p_result.next_openid;
        if(_next) {
            self.f_enumUser(p_cb, p_tag, _next);
        }
    };

    if(p_tag){
        //todo 按tag遍历
    }
    else {
        if(p_next) {
            this.m_api.getFollowers(p_next, _f_result);
        }
        else{
            this.m_api.getFollowers(_f_result);
        }
    }
};

//查找标签ID
WechatSrv.prototype.f_findTag = function (p_name, p_cb) {
    this.m_api.getTags(function (p_err, p_result) {
        if(p_err){
            console.log(p_err);
            p_cb('getTags fail');
            return;
        }
        var _count = p_result.tags.length;
        for(var i = 0; i < _count; ++i){
            var _tag = p_result.tags[i];
            if(_tag.name === p_name){
                p_cb(null, _tag.id);
                return;
            }
        }
        p_cb('no found tagid with ' + p_name);
    });
};

WechatSrv.prototype.f_tagUser = function (p_uid, p_tagName) {
    var self = this;
    this.f_findTag(p_tagName, function (p_err, p_tagID) {
        if(p_err){
            console.log(p_err);
            return;
        }
        self.m_account.f_getOpenID(p_uid, function (p_err, p_openID) {
            if(p_err){
                console.log(p_err);
                return;
            }
            self.m_api.membersBatchtagging(p_tagID, [p_openID], function (p_err, p_result) {
                if(p_err){
                    console.log(p_err);
                    return;
                }
                if(p_result.errcode) {
                    console.log(p_result);
                }
            });
        });
    });
};

WechatSrv.prototype.f_unTagUser = function (p_uid, p_tagName) {
    var self = this;
    this.f_findTag(p_tagName, function (p_err, p_tagID) {
        if(p_err){
            console.log(p_err);
            return;
        }
        self.m_account.f_getOpenID(p_uid, function (p_err, p_openID) {
            if(p_err){
                console.log(p_err);
                return;
            }
            self.m_api.membersBatchuntagging(p_tagID, [p_openID], function (p_err, p_result) {
                if(p_err){
                    console.log(p_err);
                    return;
                }
                if(p_result.errcode) {
                    console.log(p_result);
                }
            });
        });
    });
};

//获取jssdk所需要的config
WechatSrv.prototype.f_getJsConfig = function (p_url, p_apiList, p_cb, p_debug) {
    if(!p_debug){
        p_debug = false;
    }
    var _param = {
        debug: p_debug,
        jsApiList:p_apiList,
        url: p_url
    };
    /*
    this.m_api.getLatestTicket(function (p_err, p_ticket) {
        console.log(p_ticket);
    });
    */
    this.m_api.getJsConfig(_param, function (p_err, p_config) {
        if(p_err){
            console.log(p_err);
            p_cb('f_getJsConfig fail');
            return;
        }
        p_cb(null, p_config);
    });

};

WechatSrv.prototype.f_getSessionUser = function () {
    console.log('not apply');
    return null;
};

module.exports = WechatSrv;
