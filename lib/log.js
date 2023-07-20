
exports.LOG_DEBUG = 0;
exports.LOG_INFO  = 1;
exports.LOG_ERROR = 2;

exports.log_level = exports.LOG_INFO;

exports.log = (level, msg) => {
    if (level >= exports.log_level){
        console.log(`${new Date().toLocaleString()}  ${msg}`);
    }
}

exports.debug = (msg) => { exports.log(exports.LOG_DEBUG, msg) };
exports.info  = (msg) => { exports.log(exports.LOG_INFO, msg) };
exports.error = (msg) => { exports.log(exports.LOG_ERROR, msg) };
