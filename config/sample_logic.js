/**
 * Created by yushi on 2016/8/25.
 */

var Logic = function (p_master) {
    //可以调用上层接口比如 f_push
    this.m_master = p_master;
};

Logic.prototype.f_recv = function (p_cmd, p_res) {
    if(p_cmd.type === 'cmd'){
        if(p_cmd.msg === 'normal'){
            p_res.reply(p_cmd.user + ' ' +  p_cmd.uid + ' normal');
        }
        else{
            p_res.reply(p_cmd.msg);
        }
    }
    else{
        p_res.reply(p_cmd.type);
    }
};

module.exports = Logic;