/**
 * Created by yushi on 2016/10/19.
 */
var Moment = require('moment');
var Payment = require('wechat-pay').Payment;
var URL_RED = 'https://api.mch.weixin.qq.com/mmpaymkttransfers/sendredpack';
var URL_REDGROUP = 'https://api.mch.weixin.qq.com/mmpaymkttransfers/sendgroupredpack';
var ID_RED = 1000000000 ;

//增强payment模块 加入发送红包接口
Payment.prototype.f_sendRedPack = function (p_openID, p_red, callback) {
    var _params = {
        act_name: p_red.act_name, //! 活动名称
        amt_type: 'ALL_RAND',
        client_ip: '127.0.0.1', // todo 调用发红包接口的机器IP
        mch_billno: 0, //需要生成 mch_id+yyyymmdd+10位一天内不能重复的数字
        mch_id: this.mchId,
        nonce_str: this._generateNonceStr(),
        re_openid: p_openID, //! 接受红包的用户
        remark: p_red.remark, //! 备注信息
        send_name: p_red.send_name, //! 红包发送者名称
        total_amount: p_red.total_amount, //! 红包大小 单位分
        total_num: p_red.total_num, //! 红包发放总人数固定 1 个
        wishing: p_red.wishing, //! 红包祝福语
        wxappid: this.appId,
        sign: 0
    };

    var _serial = p_red.serial;
    if(_serial >= ID_RED){
        _serial %= ID_RED;
    }
    _serial += ID_RED;
    _params.mch_billno = _params.mch_id + Moment().format('YYYYMMDD') + _serial;

    var _url = URL_RED;
    if(_params.total_num > 1){
        _url = URL_REDGROUP;
        delete _params.client_ip;
    }
    else{
        delete _params.amt_type;
    }

    _params.sign = this._getSign(_params, 'MD5');
    var _xml = this.buildXml(_params);
    //console.log(_xml);
    var self = this;
    this._httpsRequest(_url, _xml, function(err, body){
        //console.log(body);
        if(err){
            return callback(err);
        }
        self.validate(body, callback);
    });
};

module.exports = Payment;