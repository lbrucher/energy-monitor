const fs       = require('fs/promises');
const Path     = require('path');
const Config   = require('./lib/config');
const Log      = require('./lib/log');
const Sagemcom = require('./lib/sagemcom');
const Huawei   = require('./lib/huawei');
const Jeedom   = require('./lib/jeedom');
const Utils    = require('./lib/utils');


const collectors = {
    energy_meter: { enabled:false, module:Sagemcom },
    inverter:     { enabled:false, module:Huawei }
};

const default_collectors = 'em,inv';
const config_filename = 'config.json';

let abort_requested = false;


// Cmd line args:
// -?|h
// -f <secs>
// -l <log_level>
// -c <what to collect>
// -i <secs>
function parseCommandLineArgs() {
    const args = {};
    let arg_name = null;

    for(let i=0; i<process.argv.length; i++) {
        if (process.argv[i][0] === '-') {
            arg_name = process.argv[i].substring(1);
            args[arg_name] = null;
        }
        else if (arg_name != null){
            args[arg_name] = process.argv[i];
        }
    }

    if (args.h !== undefined || args['?'] !== undefined) {
        console.log("Usage: node monitor.js [-h|?] [-f <secs>] [-l <level>] [-c <what to collect>] [-i <secs>]");
        console.log();
        console.log("    -f: how often collected data is sent to Jeedom. Set to 0 to avoid sending data to Jeedom. (default: 60 seconds)");
        console.log("    -l: set log level. Levels are: 0-debug, 1-info, 2-error");
        console.log(`    -c: specify what to collect, as a comma delimited list of values. Valid values: em (energy meter), inv (inverter). Default: ${default_collectors}`);
        console.log("    -i: how often do we collect data from the inverter. Default: 30 secs");
        console.log();
        process.exit(0);
    }

    if (args.l != null) {
        Log.log_level = parseInt(args.l);
        Log.info(`Setting log level to ${Log.log_level}`);
    }

    if (args.f != null) {
        const secs = parseInt(args.f);
        Jeedom.setSendFrequency(secs);
        Log.info(`Setting jeedom data send frequency to ${secs} secs`);
    }

    if (args.i != null) {
        const secs = parseInt(args.i);
        Huawei.setCollectionFrequency(secs);
        Log.info(`Setting inverter data collection frequency to ${secs} secs`);
    }

    const collector_list = (args.c || default_collectors).split(',').map(v => v.trim().toLowerCase());
    collector_list.forEach(v => {
        if (v === 'em'){
            collectors.energy_meter.enabled = true;
        }
        else if (v === 'inv'){
            collectors.inverter.enabled = true;
        }
    });
    
    const collector_names = Object.keys(collectors).filter(c => collectors[c].enabled);
    Jeedom.enableCollectors(collector_names);
    Log.info(`Collecting the following kind of data: ${collector_list.join(', ')}`);
}


async function parseConfig() {
    let file_data, config;

    try {
        file_data = await fs.readFile(Path.join(__dirname,config_filename));
    }
    catch(e) {
        Log.error(`ERROR reading config file or file (${config_filename}) does not exist?`);
        process.exit(-2);
    }

    try {
        config = JSON.parse(file_data.toString());

        Config.jeedom   = config.jeedom;
        Config.sagemcom = config.sagemcom;
        Config.huawei   = config.huawei;
    }
    catch(e) {
        Log.error("Config data is not valid JSON: ", e);
        process.exit(-3);
    }        
}

async function main() {
    parseCommandLineArgs();
    await parseConfig();

    Log.info('Initializing...');
    await Jeedom.start();
    for(const c of Object.values(collectors)){
        if (c.enabled){
            await c.module.start();
        }
    }

    while(!abort_requested){
        await Utils.sleep(1);
    }

    // cleanup
    for(const c of Object.values(collectors)){
        if (c.enabled){
            await c.module.stop();
        }
    }
    await Jeedom.stop();
}



main().then(() => {
    Log.info("Done.");
    process.exit(0);
}).catch(err => {
    Log.error(err.stack);
    process.exit(-1);
});
