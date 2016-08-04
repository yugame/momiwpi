/**
 * Created by yushi on 2015/12/4.
 */
//生成菜单的工具 注意需要主服务停机状态时运行
var WechatAPI = require('wechat-api');
var Config = require('../mconfig');

var api = new WechatAPI(Config.srv.appid, Config.srv.appsecret);
var menu = {
    "button":[
        {
            "name":"测试",
            "sub_button":[
                {
                    "type":"click",
                    "name":"普通",
                    "key":"normal"
                },
                {
                    "type":"click",
                    "name":"特殊",
                    "key":"special"
                }
            ]
        },
        {
            "name":"关于",
            "sub_button":[
                {
                    "type":"click",
                    "name":"帮助",
                    "key":"help"
                },
                {
                    "type":"view",
                    "name":"官网",
                    "url":"http://momiw.com/"
                }
            ]
        },
        {
            "type":"view",
            "name":"充值",
            "url":"http://pay.momiw.com/"
        }
    ]
}

api.createMenu(menu, function(p_err, p_result){
    if(p_err) {
        console.log(p_err);
        return;
    }
    console.log(p_result);
});