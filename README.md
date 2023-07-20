# Energy Monitor

This program does 2 things:

* collects data from:
    * Sagemcom (TS211) energy meter though its P1 port
    * Huawei inverter (models SUN2000*) via MODBUS over TCP
* sends the collected data to a local Jeedom

The setup included here targets a Raspberry Pi first generation and relies on NodeJS v18.9 or later.
It also assumes a Jeedom installed somewhere on the local network NAS, etc.).

The Raspberry Pi is normally located next to the Sagemcom energy meter and communicates via a RJ12 to USB cable (e.g. `https://www.amazon.fr/dp/B08GWZTNM3?psc=1&ref=ppx_yo2ov_dt_b_product_details`). The rbp is also connected to the local network in order to communicate with the Huawei inverter and with Jeedom.


# What information is being collected


### From the Sagemcom Energy Meter

* `em_pull_instant`: instant pull from network (code 1.7.0) (kW)
* `em_push_instant`: install push to the network (code 2.7.0) (kW)
* `em_pull_day`: total daily pull from network (code 1.8.1) (kWh)
* `em_push_day`: total daily push to the network (code 2.8.1) (kWh)
* `em_pull_night`: total nightly pull from network (code 1.8.2) (kWh)
* `em_push_night`: total nightly push to the network (code 2.8.2) (kWh)


### From the Huawei Inverter (SUN2000*)

See the `Huawei Solar Inverter Modbus Interface Definitions.pdf` document in this repository.

* `inv_instant_prod`: instant production (address 32080) (kW)
* `inv_daily_prod`: daily production (address 32114) (kWh)
* `inv_device_status`: device status (address 32089)
* `inv_state1`: state 1 (address 32000)
* `inv_state2`: state 2 (address 32002)
* `inv_state3`: state 3 (address 32003)
* `inv_alarm1`: alarm 1 (address 32008)
* `inv_alarm2`: alarm 2 (address 32009)
* `inv_alarm3`: alarm 3 (address 32010)


# Jeedom setup

TODO...


# Installation

Raspberry Pi installation

	Download the Raspberry Pi Imager from https://www.raspberrypi.com/software/
	From the Imager app, select "Choose OS"
	Select "Raspberry Pi OS (other)"
	Select "Raspberry Pi OS Lite (32 bit) / A port of Debian Bullseye with no desktop environment"
	Choose the storage then Write.
	

Once RBP has succesfully booted the rest is done on the device itself

	$ ssh admin@<your rbp IP address>


System update

	$ sudo apt update
	$ sudo apt upgrade

NodeJS installation

	$ wget https://unofficial-builds.nodejs.org/download/release/v18.9.1/node-v18.9.1-linux-armv6l.tar.gz
	$ tar zxf node-v18.9.1-linux-armv6l.tar.gz
	$ cd node-v18.9.1-linux-armv6l
	$ rm CHANGELOG.md LICENSE README.md
	$ cp -R * /usr/local
	$ cd ..
	$ rm -rf node-v18.9.1-linux-armv6l
	$ rm node-v18.9.1-linux-armv6l.tar.gz

Note: The Raspberry Pi first generation runs an ARM v6, which is not supported by the official NodeJS distributions anymore. Hence the download from `https://unofficial-builds.nodejs.org`


This app install

	$ wget https://github.com/lbrucher/energy-monitor/archive/refs/heads/main.zip
	$ sudo unzip -d /usr/local/src main.zip
	$ sudo mv /usr/local/src/energy-monitor-main /usr/local/src/energy-monitor
	$ sudo chown admin /usr/local/src/energy-monitor

App config

	$ cd /usr/local/src/energy-monitor
	$ npm --omit=dev install
	$ cp config-template.json config.json
	... edit config.json ... (see section below)

**At this point make sure Jeedom has been properly setup and all the info commands have been defined.**

Before setting up the app as system service we can test it locally first

	$ cd /usr/local/src/energy-monitor
	$ node main.js -?

	Test collecting data without sending them to Jeedom (-f 0)
	$ node main.js -l 0 -f 0 -i 2
	
	Test collecting data and sending it to Jeedom (every 5 secs, -f 5)
	$ node main.js -l 0 -f 5 -i 2
	

Setup app as system service

	$ sudo cp /usr/local/src/energy-monitor/energy-monitor.service /lib/systemd/system/energy-monitor.service
	$ sudo systemctl daemon-reload
	$ sudo systemctl enable energy-monitor.service
	$ sudo systemctl start energy-monitor.service


The app should now be running and will do so after each boot.

To check the logs:

	$ sudo journalctl -f -u energy-monitor.service




# App configuration

The `config.json` file located in the app directory is defined as follows:

```
"jeedom": {
   "url": "<how to reach Jeedom, e.g. http://192.168.1.100:9000>",
   "api_key": "<Jeedom virtual plugin API key, see below>",
   "command_ids": {
       <those are the info command IDs created in Jeedom>
	}
},
"sagemcom": {
    "usb_path": "<path to the USB port on the device, e.g. /dev/ttyUSB0",
    "usb_baud_rate": 115200
},
"huawei": {
    "dongle_ip": "<IP address of the inverter's dongle",
    "dongle_port": 502
}
```

The Jeedom virtual plugin API key can be found in Jeedom under `Settings/System/Configuration/API - "API Key: Virtual"`

