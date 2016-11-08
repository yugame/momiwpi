/**
 * Created by yushi on 2016/10/19.
 */
var Moment = require('moment');
var xml2js = require('xml2js');
var Payment = require('wechat-pay').Payment;
var URL_RED = 'https://api.mch.weixin.qq.com/mmpaymkttransfers/sendredpack';
var URL_REDGROUP = 'https://api.mch.weixin.qq.com/mmpaymkttransfers/sendgroupredpack';
var URL_PAY = 'https://api.mch.weixin.qq.com/mmpaymkttransfers/promotion/transfers';
var ID_RED = 1000000000 ;

//增强payment模块 加入发送红包接口
Payment.prototype.f_sendRedPack = function (p_openID, p_red, p_cb) {
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
    var _mch_billno = _params.mch_id + Moment().format('YYYYMMDD') + _serial;
    _params.mch_billno = _mch_billno;

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
        console.log(body );
        if(err){
            return p_cb(err);
        }
        self.validate(body, p_cb);
    });
};

//增强payment模块 加入支付接口
Payment.prototype.f_sendPay = function (p_openID, p_pay, p_cb) {
    var _params = {
        mch_appid:this.appId,
        mchid: this.mchId,
        nonce_str: this._generateNonceStr(),
        sign: 0,
        partner_trade_no: p_pay.serial, //需要生成 mch_id+yyyymmdd+10位一天内不能重复的数字
        openid: p_openID, //! 接受红包的用户
        check_name: "NO_CHECK",
        amount: p_pay.amount, //! 红包大小 单位分
        desc: p_pay.desc,
        spbill_create_ip: '127.0.0.1' // todo 调用发红包接口的机器IP
    };
/*
    var _serial = p_pay.serial;
    if(_serial >= ID_RED){
        _serial %= ID_RED;
    }
    _serial += ID_RED;
    var _no = _params.mchid + Moment().format('YYYYMMDD') + _serial;
    _params.partner_trade_no = _no;
*/
    _params.sign = this._getSign(_params, 'MD5');
    var _xml = this.buildXml(_params);
    //console.log(_xml);
    var self = this;
    this._httpsRequest(URL_PAY, _xml, function(err, body){
        console.log(body );
        if(err){
            return p_cb(err);
        }
        self.validate(body, p_cb, true);
    });
};

var RETURN_CODES = {
    SUCCESS: 'SUCCESS',
    FAIL: 'FAIL'
};

//重载验证
Payment.prototype.validate = function (xml, callback, p_noSign) {
    var self = this;
    xml2js.parseString(xml, {
        trim: true,
        explicitArray: false
    }, function (err, json) {
        var error = null,
            data;
        if (err) {
            error = new Error();
            err.name = 'XMLParseError';
            return callback(err, xml);
        }

        data = json ? json.xml : {};

        if (data.return_code == RETURN_CODES.FAIL) {
            error = new Error(data.return_msg);
            error.name = 'ProtocolError';
        }
        else if (data.result_code == RETURN_CODES.FAIL) {
            error = new Error(data.err_code);
            error.name = 'BusinessError';
        }
        else if ((data.appid && self.appId !== data.appid) || (data.mch_appid && self.appId !== data.mch_appid)) {
            error = new Error();
            error.name = 'InvalidAppId';
        }
        else if ((data.mch_id && self.mchId !== data.mch_id) || (data.mchid && self.mchId !== data.mchid)) {
            error = new Error();
            error.name = 'InvalidMchId';
        }
        else if (self.subMchId && self.subMchId !== data.sub_mch_id) {
            error = new Error();
            error.name = 'InvalidSubMchId';
        }
        else if (!p_noSign && self._getSign(data) !== data.sign) {
            error = new Error();
            error.name = 'InvalidSignature';
        }

        callback(error, data);
    });
};

module.exports = Payment;