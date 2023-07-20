const { SerialPort }     = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline')
const Config             = require('./config');
const Log                = require('./log');
const Jeedom             = require('./jeedom');


let usb = null;
let current_frame = null;


function extractKWh(s) {
    // (000661.701*kWh)
    const data = s.match(/^\((.*)\*kWh\)$/);
    if (data == null){
        return null;
    }
    return parseFloat(data[1]);
}


function extractKW(s) {
    // (00.135*kW)
    const data = s.match(/^\((.*)\*kW\)$/);
    if (data == null){
        return null;
    }
    return parseFloat(data[1]);
}


function handleFrame(buf) {
    let line = buf.toString();
    line = line.substring(0, line.length-1);    // remove trailing \n

    // Skip empty line
    if (line === '') {
        return;
    }

    // Beginning of frame detected?
    const is_start = line.match(/^\/FLU5\\/);
    if (is_start){
        // Already handling a frame?
        if (current_frame != null) {
            Log.error("!!! Detected the beginning of a new frame while handling a previous frame...");
        }

        current_frame = { time:Date.now() };
        return;
    }

    // At this point we should have a proper frame object
    if (current_frame == null){
        return;
    }

    // End of frame detected?
    const is_end = line.match(/^\!/);
    if (is_end) {
        // collected_frames.push(current_frame);
        // current_frame.handling = false;
        // Log.debug(`1- Collected frame (${collected_frames.length} collected frames so far)`);
        Jeedom.addElectricMeterData(current_frame);
        current_frame = null;
        return;
    }

    // Handle frame data
    // 1-0:1.8.1(000661.701*kWh)
    const data = line.match(/^(\d+\-\d+)\:(\d+\.\d+\.\d+)(.*)$/);
    if (data != null) {
        if (data[1] === '1-0') {
            if (data[2] === '1.8.1') {
                current_frame.pull_day = extractKWh(data[3]);
            }
            else if (data[2] === '1.8.2') {
                current_frame.pull_night = extractKWh(data[3]);
            }
            else if (data[2] === '2.8.1') {
                current_frame.push_day = extractKWh(data[3]);
            }
            else if (data[2] === '2.8.2') {
                current_frame.push_night = extractKWh(data[3]);
            }
            else if (data[2] === '1.7.0') {
                current_frame.pull_instant = extractKW(data[3]);
            }
            else if (data[2] === '2.7.0') {
                current_frame.push_instant = extractKW(data[3]);
            }
        }
    }
    else {
            Log.error("!!! Could not parse frame line: [%s]", line);
    }
}


exports.start = async () => {
    if (usb != null){
        return;
    }

    Log.info("Starting Sagemcom electric meter data collection");
    usb = new SerialPort({ path:Config.sagemcom.usb_path, baudRate:Config.sagemcom.usb_baud_rate });
    const parser = new ReadlineParser();
    usb.pipe(parser);
    parser.on('data', handleFrame);
}

exports.stop = () => {
    Log.info("Stopping Sagemcom electric meter data collection");
    return new Promise((resolve, reject) => {
        if (usb == null){
            return resolve();
        }

        usb.close(() => {
            resolve();
        });
    });
}


/*
/FLU5\253769484_A

0-0:96.1.4(50217)
0-0:96.1.1(3153414733313035323030383737)
0-0:1.0.0(230629102248S)
1-0:1.8.1(000661.701*kWh)
1-0:1.8.2(000776.784*kWh)
1-0:2.8.1(000990.699*kWh)
1-0:2.8.2(000423.681*kWh)
0-0:96.14.0(0001)
1-0:1.4.0(00.000*kW)
1-0:1.6.0(230622200000S)(06.235*kW)
0-0:98.1.0(2)(1-0:1.6.0)(1-0:1.6.0)(230501000000S)(230423203000S)(06.985*kW)(230601000000S)(230524193000S)(06.748*kW)
1-0:1.7.0(00.000*kW)
1-0:2.7.0(00.135*kW)
1-0:21.7.0(00.000*kW)
1-0:41.7.0(00.000*kW)
1-0:61.7.0(00.438*kW)
1-0:22.7.0(00.440*kW)
1-0:42.7.0(00.132*kW)
1-0:62.7.0(00.000*kW)
1-0:32.7.0(236.9*V)
1-0:52.7.0(240.8*V)
1-0:72.7.0(239.9*V)
1-0:31.7.0(002.09*A)
1-0:51.7.0(000.91*A)
1-0:71.7.0(002.03*A)
0-0:96.3.10(1)
0-0:17.0.0(999.9*kW)
1-0:31.4.0(999*A)
0-0:96.13.0()
!7559
*/
