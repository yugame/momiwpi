/**
 * Created by yushi on 2016/11/29.
 */
var Log4js = require('log4js');
Log4js.configure({
    appenders: [
        { type: 'console' },
        {
            type: 'file',
            filename: './mlogs/normal.log',
            maxLogSize: 1024*1024,
            backups:10,
            category: 'normal'
        }
    ],
    replaceConsole: true
});

var logger = Log4js.getLogger('normal');
logger.setLevel('TRACE');

logger.f_overload = function(){

    console.trace = function(p_str){
        logger.trace(p_str);
    };

//log 和 info 都对应 l4 info 因为l4没log
    console.log = function(p_str){
        logger.info(p_str);
    };

    console.info = function(p_str){
        logger.info(p_str);
    };

    console.warn = function(p_str){
        logger.warn(p_str);
    };

    console.error = function(p_str){
        logger.error(p_str);
    };

};

module.exports = logger;