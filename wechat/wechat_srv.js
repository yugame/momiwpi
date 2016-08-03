/**
 * Created by yushi on 2016/8/3.
 */

var Wechat = require('wechat');
var WechatAPI = require('wechat-api');
var Express = require('express');

//在express的app上佳节一个微信公众号提供服务
var WechatSrv = function(p_app, p_link, p_config) {

    var _Api = new WechatAPI(p_config.appid, p_config.appsecret);
    /*
    this.m_mid = new MID(_api, p_link);

    _api.getLatestToken(function (p_err, p_token) {
        ShowLog(p_token);
    });
    */

    var _Filt = {};
    var _route = '/' + p_config.myName;
    console.log(_route);

    var self = this;
    //p_app.use(Express.query());
    p_app.use(_route, Wechat(p_config, function (req, res, next) {
        console.log(req.weixin);

        var _user = req.weixin.FromUserName; //用户的OPENID
        var _msgType = req.weixin.MsgType;

        //排重 去除重复的消息
        var _createTime = req.weixin.CreateTime;
        var _tmp = _user + _createTime;
        if (_msgType === 'text') {
            _tmp = req.weixin.MsgId;
        }

        if(_Filt[_tmp]) {
            //res.reply(''); //重复的消息直接返回
            res.reply('filt');
            return;
        }
        _Filt[_tmp] = true;

        var _content = 'none';
        var _type = 'cmd';

        //将微信消息类型转换为系统消息类型
        // cmd 文字消息和菜单点击  image 发送图片  subscribe unsubscribe 订阅和退订
        if (_msgType === 'text') {
            _content = req.weixin.Content;
        }
        else if (_msgType === 'image') {
            _type = _msgType;
            _content = req.weixin.PicUrl;
        }
        else if (_msgType === 'event') {
            var _eventKey = req.weixin.EventKey;
            if (_eventKey) {
                _content = _eventKey;
            }

            var _event = req.weixin.Event;
            if (_event === 'subscribe') {
                //订阅事件
                _type = _event;
                //获取用户信息
                _Api.getUser(_user, function (p_err, p_result) {
                    if (p_err) {
                        console.log(p_err);
                    }
                    else {
                        p_result.otherInfo = _eventKey;
                        var _tobot = {
                            "user": _user,
                            "type": "detail",
                            "msg": p_result
                        };
                        console.log(_tobot);
                        //self.m_mid.f_notice(_tobot);
                    }
                });
            }
            else if (_event === 'unsubscribe') {
                //退订事件
                _type = _event;
            }
            else if (_event === 'SCAN' || _event === 'VIEW' || _event === 'TEMPLATESENDJOBFINISH') {
                //扫描二维码事件 用户跳转页码事件 模板发送到位事件 暂不处理
                res.reply('');
                return;
            }
            else{
                console.log('no deal event ' + _event + ' ' + _eventKey);
            }
        }
        else{
            console.log('no deal msg ' + _msgType);
        }

        var _tobot = {
            "user": _user,
            "type": _type,
            "msg": _content
        };
        if (_content == 'none') {
            console.log('send content is none');
        }
        console.log(_tobot);
        res.reply('');
        //self.m_mid.f_sendMsg(_tobot, res);
    }));
};

module.exports = WechatSrv;
