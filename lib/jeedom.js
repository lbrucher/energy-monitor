const http   = require('http');
const Config = require('./config');
const Log    = require('./log');
const Utils  = require('./utils');


let jeedom_send_frequency_msecs = 60*1000;    // how often (in milliseconds) do we send data to Jeedom
const all_collectors = ['energy_meter', 'inverter'];
let data_to_collect = all_collectors;


let abort_processing = false;
let collected_data = {};
let last_collected_data = null;


function sendValueToJeedom(cmd_id, value) {
    const url = `${Config.jeedom.url}/core/api/jeeApi.php?plugin=virtual&type=event&apikey=${Config.jeedom.api_key}&id=${cmd_id}&value=${encodeURIComponent(value)}`;

    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            const { statusCode } = res;
            if (statusCode !== 200) {
                res.resume();
                reject(new Error(`Request Failed. Status Code: ${statusCode}`));
            }
            else {
                res.setEncoding('utf8');
                res.on('data', () => {});
                res.on('end', () => {
                    resolve();
                });
            }
        }).on('error', (e) => {
            reject(new Error(`Error sending request: ${e.toString()}`));
        });
    });
}


async function sendCollectedData(data) {
    Log.info(`[jeedom] sending collected data: ${JSON.stringify(data)}`);

    let promises = [];

    if (data.energy_meter != null){
        promises = promises.concat([
            sendValueToJeedom(Config.jeedom.command_ids.em_pull_instant, data.energy_meter.pull_instant),
            sendValueToJeedom(Config.jeedom.command_ids.em_push_instant, data.energy_meter.push_instant),
            sendValueToJeedom(Config.jeedom.command_ids.em_pull_day,     data.energy_meter.pull_day),
            sendValueToJeedom(Config.jeedom.command_ids.em_pull_night,   data.energy_meter.pull_night),
            sendValueToJeedom(Config.jeedom.command_ids.em_push_day,     data.energy_meter.push_day),
            sendValueToJeedom(Config.jeedom.command_ids.em_push_night,   data.energy_meter.push_night)
        ]);
    }

    if (data.inverter != null) {
        promises = promises.concat([
            sendValueToJeedom(Config.jeedom.command_ids.inv_instant_prod,  data.inverter.instant_prod),
            sendValueToJeedom(Config.jeedom.command_ids.inv_daily_prod,    data.inverter.daily_prod),
            sendValueToJeedom(Config.jeedom.command_ids.inv_device_status, data.inverter.device_status),
            sendValueToJeedom(Config.jeedom.command_ids.inv_state1,        data.inverter.state1),
            sendValueToJeedom(Config.jeedom.command_ids.inv_state2,        data.inverter.state2),
            sendValueToJeedom(Config.jeedom.command_ids.inv_state3,        data.inverter.state3),
            sendValueToJeedom(Config.jeedom.command_ids.inv_alarm1,        data.inverter.alarm1),
            sendValueToJeedom(Config.jeedom.command_ids.inv_alarm2,        data.inverter.alarm2),
            sendValueToJeedom(Config.jeedom.command_ids.inv_alarm3,        data.inverter.alarm3)
        ]);
    }

    if (promises.length > 0){
        try {
            await Promise.all(promises);
            Log.debug('[jeedom] data sent ok');
        }
        catch(e) {
            Log.error(`[jeedom] ERROR sending data: ${e}`);
        }
    }
}


async function processCollectedData() {
    while(!abort_processing) {
        while(last_collected_data == null) {
            Log.debug('[jeedom] No collected data to process, waiting a bit...');
            await Utils.sleep(1000);
        }

        // take the last collected data and send it to Jeedom
        // send async, do not block
        sendCollectedData(last_collected_data);

        last_collected_data = null;

        Log.debug('[jeedom] Waiting to process next collected data...');
        await Utils.sleep(jeedom_send_frequency_msecs);
    }
}


function handleNewCollectedData() {
    if (data_to_collect.length === 0 || jeedom_send_frequency_msecs <= 0){
        return;
    }

    const got_it_all = data_to_collect.every(item => !!collected_data[item]);
    if (got_it_all) {
        // only keep the data we actually wish to collect
        last_collected_data = {};
        data_to_collect.forEach(item => { last_collected_data[item] = collected_data[item] });

        collected_data = {};
        Log.debug('[jeedom] added most recent collected data');
    }
}


exports.setSendFrequency = (secs) => {
    jeedom_send_frequency_msecs = secs * 1000;    
}


exports.enableCollectors = (names) => {
    data_to_collect = names.filter(name => all_collectors.includes(name));
}


exports.addElectricMeterData = (data) => {
    collected_data.energy_meter = data;
    handleNewCollectedData();
}


exports.addInverterData = (data) => {
    collected_data.inverter = data;
    handleNewCollectedData();
}


exports.start = async () => {
    abort_processing = false;
    if (jeedom_send_frequency_msecs > 0){
        processCollectedData();
    }
}


exports.stop = async () => {
    abort_processing = true;
}
