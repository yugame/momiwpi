/**
 * Created by yushi on 2016/8/23.
 */

var M_schema = {
    openID: {type: String, unique: true},
    unionID: String,
    userInfo: {},
    createTime: Number,
    subscribeTime: Number,
    cancel: Boolean
};

var Account = function (p_dataEngine) {
    this.m_account = p_dataEngine.f_createModel('account', M_schema);
    this.m_uidToOpenID = {};
    this.m_openIDToUID = {};
    this.m_openIDToAccount = {};
};

Account.prototype.f_createAccount = function(p_params, p_callback) {
    var _account = new this.m_account({
        openID: p_params.openID,
        unionID: p_params.unionID,
        userInfo: p_params.userInfo,
        createTime: Date.now(),
        subscribeTime: 0,
        cancel: false
    });
    _account.save(p_callback);
};

//Account.prototype.f_checkSubscribe = function(p_openID,

Account.prototype.f_getUID = function(p_openID, p_callback){
    var _uid = this.m_openIDToUID[p_openID];
    if(_uid){
        p_callback(null, _uid);
        return;
    }
    var self = this;
    this.m_account.findOne({openID: p_openID}, function (p_err, p_account) {
        if (p_err) {
            console.log(p_err);
            p_callback('f_getUID db error');
        }
        else{
            if(!p_account){
                p_callback(null, null, p_openID);
            }
            else{
                self.m_openIDToUID[p_openID] = p_account.unionID;
                p_callback(null, p_account.unionID);
            }
        }
    });
};

Account.prototype.f_getAccount = function(p_openID, p_callback){
    var _account = this.m_openIDToAccount[p_openID];
    if(_account){
        p_callback(null, _account);
        return;
    }
    var self = this;
    this.m_account.findOne({openID: p_openID}, function (p_err, p_account) {
        if (p_err) {
            console.log(p_err);
            p_callback('f_getUID db error');
        }
        else{
            if(!p_account){
                p_callback(null, null);
            }
            else{
                self.m_openIDToAccount[p_openID] = p_account;
                p_callback(null, p_account);
            }
        }
    });
};

Account.prototype.f_getOpenID = function(p_uid, p_callback){
    var _openID = this.m_uidToOpenID[p_uid];
    if(_openID){
        p_callback(null, _openID);
        return;
    }
    var self = this;
    this.m_account.findOne({unionID: p_uid}, function (p_err, p_account) {
        if (p_err) {
            console.log(p_err);
            p_callback('f_getOpenID db error');
        }
        else{
            if(!p_account){
                p_callback(null, null);
            }
            else{
                self.m_uidToOpenID[p_uid] = p_account.openID;
                p_callback(null, p_account.openID);
            }
        }
    });
};

Account.prototype.f_getAccountByUid = function(p_uid, p_callback){
    var self = this;
    this.f_getOpenID(p_uid, function (p_err, p_openID){
        if(p_err){
            p_callback(p_err);
            return;
        }
        self.f_getAccount(p_openID, p_callback);
    });
};

module.exports = Account;