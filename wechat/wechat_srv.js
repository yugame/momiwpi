/**
 * Created by yushi on 2016/8/3.
 */
var Fs = require('fs');
var Wechat = require('wechat');
var WechatAPI = require('wechat-api');

//在express的app上嫁接一个微信公众号提供服务
var WechatSrv = function(p_app, p_link, p_config) {
    this.m_admin = p_config.adminOpenID;
    this.m_api = new WechatAPI(p_config.appid, p_config.appsecret);
    this.m_api.getLatestToken(function (p_err, p_token) {
        console.log(p_token);
    });

    /*
    this.m_mid = new MID(_api, p_link);
    */

    var _Filt = {};
    var _route = '/' + p_config.myName;
    console.log(_route);

    var self = this;
    p_app.use(_route, Wechat(p_config, function (p_req, p_res, p_next) {
        var _user = p_req.weixin.FromUserName; //用户的OPENID
        var _msgType = p_req.weixin.MsgType;

        //排重 去除重复的消息
        var _createTime = p_req.weixin.CreateTime;
        var _tmp = _user + _createTime;
        if (_msgType === 'text') {
            _tmp = p_req.weixin.MsgId;
        }

        if(_Filt[_tmp]) {
            //res.reply(''); //重复的消息直接返回
            p_res.reply('filt');
            return;
        }
        _Filt[_tmp] = true;

        var _content = 'none';
        var _type = 'none';

        //将微信消息类型转换为系统消息类型
        // cmd 文字消息和菜单点击  image 发送图片  subscribe unsubscribe 订阅和退订
        if (_msgType === 'text') {
            _type = 'cmd';
            _content = p_req.weixin.Content;
        }
        else if (_msgType === 'image') {
            _type = _msgType;
            _content = p_req.weixin.PicUrl;
        }
        else if (_msgType === 'event') {
            var _eventKey = p_req.weixin.EventKey;
            if (_eventKey) {
                _content = _eventKey;
            }

            var _event = p_req.weixin.Event;
            if (_event === 'subscribe') {
                //订阅事件
                _type = _event;
                //获取用户信息
                self.m_api.getUser(_user, function (p_err, p_result) {
                    if (p_err) {
                        console.log(p_err);
                        return;
                    }
                    p_result.otherInfo = _eventKey;
                    //由关注引发的用户详细信息发送 可用于新用户注册 以及老用户信息更新
                    self.f_noticeRoute(_user, 'detail', p_result);
                });
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
            console.log(p_req.weixin);
            return;
        }

        self.f_toRoute(_user, _type, _content, p_res);
    }));
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
WechatSrv.prototype.f_toRoute = function (p_user, p_type, p_msg, p_res) {
    var _cmd = {
        user: p_user,
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

    if(_cmd.type === 'cmd'){
        if(_cmd.msg === 'normal'){
            p_res.reply(_cmd.user + ' normal');
        }
        else{
            p_res.reply(_cmd.msg);
        }
    }
    else{
        p_res.reply(_cmd.type);
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
