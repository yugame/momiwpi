/**
 * Created by yushi on 2016/8/23.
 */

var M_schema = {
    openID: {type: String, unique: true},
    unionID: String,
    userInfo: {},
    firstTime: Number
};

var Account = function (p_dataEngine) {
    this.m_account = p_dataEngine.f_createModel('account', M_schema);
};

Account.prototype.f_createAccount = function(p_params, p_callback) {
    var _account = new this.m_account({
        openID: p_params.openID,
        unionID: p_params.unionID,
        userInfo: p_params.userInfo,
        create_time: Date.now()
    });
    _account.save(p_callback);
};

Account.prototype.f_getUID = function(p_openID, p_callback){
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
                p_callback(null, p_account.unionID);
            }
        }
    });
};

module.exports = Account;