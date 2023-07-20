const modbus = require("modbus-stream");
const Config = require('./config');
const Log    = require('./log');
const Utils  = require('./utils');
const Jeedom = require('./jeedom');


const sleep_after_connect = 2000;   // in ms
let collection_frequency_msec = 30*1000;    // collection every 30 secs by default
let abort_collection = false;


function connect(ip, port) {
    return new Promise((resolve, reject) => {
        Log.debug(`[inverter] Connecting to ${ip}:${port}...`);
        modbus.tcp.connect(port, ip, { debug:null }, (err, conn) => {
            if (err){
                return reject(err);
            }
        
            Log.info("[inverter] Connected.");

            // Absolutely required to wait a little after connection and before starting to read registers!
            Utils.sleep(sleep_after_connect).then(() => {
                resolve(conn);
            });
        });
    });
}

function readRegister(conn, address, quantity) {
    return new Promise((resolve, reject) => {
        conn.readHoldingRegisters({address, quantity, extra:{ unitId:1 }}, (err,res) => {
            if (err){
                return reject(err);
            }
            else {
                resolve(Buffer.concat(res.response.data));
            }
        });
    });
}

function extractBits(value, num_bits) {
    const bits = new Array(num_bits)
    for(let i=0; i<num_bits; i++) {
        const bit = 1 << i;
        bits[num_bits-1-i] = (value & bit) === bit ? 1 : 0;
    }

    return bits;
}


async function run() {
    const conn = await connect(Config.huawei.dongle_ip, Config.huawei.dongle_port);
    
    while (!abort_collection) {
        const data = {};

        //console.log("Reading states...");
        data.device_status = (await readRegister(conn, 32089, 1)).readUInt16BE();
        data.state1        = (await readRegister(conn, 32000, 1)).readUInt16BE();
        data.state2        = (await readRegister(conn, 32002, 1)).readUInt16BE();
        data.state3        = (await readRegister(conn, 32003, 2)).readUInt32BE();

        //console.log("Reading alarms...");
        data.alarm1        = (await readRegister(conn, 32008, 1)).readUInt16BE();
        data.alarm2        = (await readRegister(conn, 32009, 1)).readUInt16BE();
        data.alarm3        = (await readRegister(conn, 32010, 1)).readUInt16BE();

        //console.log("Reading production data...");
        data.instant_prod = (await readRegister(conn, 32080, 2)).readInt32BE()/1000;
        data.daily_prod   = (await readRegister(conn, 32114, 2)).readUInt32BE()/100;
        //data.total_prod   = (await readRegister(conn, 32106, 2)).readUInt32BE()/100;


        Log.debug(`[inverter] Device Status: 0x${data.device_status.toString(16)}`);
        Log.debug(`[inverter] State1: ${data.state1}  [${extractBits(data.state1, 10).join('.')}]`);
        Log.debug(`[inverter] State2: ${data.state2}  [${extractBits(data.state2, 3).join('.')}]`);
        Log.debug(`[inverter] State3: ${data.state3}  [${extractBits(data.state3, 2).join('.')}]`);
        Log.debug(`[inverter] Alarm1: ${data.alarm1}  [${extractBits(data.alarm1, 16).join('.')}]`);
        Log.debug(`[inverter] Alarm2: ${data.alarm2}  [${extractBits(data.alarm2, 16).join('.')}]`);
        Log.debug(`[inverter] Alarm3: ${data.alarm3}  [${extractBits(data.alarm3, 14).join('.')}]`);

        Log.debug(`[inverter] Production instantanée: ${data.instant_prod} kWh`);
        Log.debug(`[inverter] Production totale depuis mise en service: ${data.total_prod} kWh`);
        Log.debug(`[inverter] Production du jour: ${data.daily_prod} kWh`);

        Jeedom.addInverterData(data);

        await Utils.sleep(collection_frequency_msec);
    }
}


exports.setCollectionFrequency = (secs) => {
    collection_frequency_msec = secs * 1000;
}

exports.start = async () => {
    Log.info("Starting Huawei inverter data collection");
    run();
}

exports.stop = async () => {
    Log.info("Stopping Huawei inverter data collection");
    abort_collection = true;
}
