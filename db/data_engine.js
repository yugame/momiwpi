/**
 * Created by yushi on 2016/8/23.
 */
var Mon = require('mongoose');

var MData = function(p_url){
    this.m_url = p_url;
};

MData.prototype.f_connect = function (p_func) {
    this.m_conn = Mon.createConnection(this.m_url);

    this.m_conn.on('error', function (p_err) {
        console.log(p_err.stack);
        p_func('connect mongodb fail!');
        //throw new Error('connect mongodb fail!');
    });

    this.m_conn.once('open', function (callback) {
        console.log("mongodb open");
    });

    this.m_conn.on('connected', function () {
        console.log("mongodb connected");
        p_func();
    });

    this.m_conn.on('close', function () {
        console.log("mongodb close");
    });
};

MData.prototype.f_createModel = function (p_name, p_schema) {
    var _schema = Mon.Schema(p_schema);
    return this.m_conn.model(p_name, _schema);
};

module.exports = MData;