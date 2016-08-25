/**
 * Created by yushi on 2016/8/25.
 */

var Logic = {};

Logic.F_recv = function (p_cmd, p_res) {
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