# Node Pi Alarm

## Node-Pi-Alarm 

## A Node.js based Security/Fire Alarm and Environmental Monitoring Suite

  This program aims to use a Raspberry Pi (B+ or 2) into a complete and consistent home alarm, monitoring and automation system. It 
  is written in javascript for Node.js has an https web interface using ReST and sockets to communicate between client and server. 
  It's features include burglar alarm, fire alarm, environmental alerts (CO, gas leak, air quality), https interface, mongodb local 
  user authentication, sockets, webcams, and real-time monitoring. 

## Current status is that the security alarm functionality is complete, environmental systems are still in progress, specifically:

    Web interface, https, sockets, authentication, sends notifications, reads digital (PIR, reed, glass break, mechanical fire/temp., etc) sensors,
      receives pictures from external webcams (via ftp using vsftpd), uses onboard camera, displays a real-time 'floorplan' image 
      showing active zones. 

    Still to do is :
        Wire the MQ-7(CO), MQ-135(smoke & air quality) and MQ-2(Propane/Gas Leak) sensors to their appropriate heating
          circuits and ADC and write interface module. (Fairly trivial but delayed due to Intl shipping of the sensors)
        Wire, install and test door striker code (for keyless entry). Goes: Pi 2 -> logic level shifter -> relay -> door striker
        add GPRS/GSM module for backup connection for SMS alerts
        Document hardware configuration/wiring for this page. (schematics for: Battery, power supply, ADC, sensors, level shifters, relays, etc.) 
        Document software prerequisites and installation, including: Mongodb, Node.js, openssh, vsftpd, Node modules, etc.


## Abbreviated Install Instructions

    Install and configure Raspbian
    Install Mongodb, insructions here - http://c-mobberley.com/wordpress/2013/10.14/raspberry-pi-mongodb-installation-the-working-guide/
    Install Node.js, instructions here - http://revryl.com/2014/01/04/nodejs-raspberry-pi/
    Install vsftpd (sudo apt-get install vsftpd, then edit conf file)
    create ftpcam user with home dir in ./public/pictures/{camera name}
    configure any external webcams to connect to your Pi via ftp using the ftpcam user
    install Node-Pi-Alarm (copy files to /opt/Node-Pi-Alarm...)
    configure permissions 
    configure openssh as CA and generate cert/key for web server, install to ./cert (I have provided a 'test' key, but it's ONLY for testing!!!)
    npm install necessary global modules (-g) node-gyp, nodemon, mongodb
    npm install necessary modules to Node-Pi-Alarm... (jade, https, cookie-parser, pi-gpio, onoff, mongoose, passport,
    passport-local, passport-local-mongoose, socket.io, express, express.io, crypto)
    configure Node-Pi-Alarm by editing app.js and providing credentials for Nodemailer and paths to SSL key/cert.
    plan out your sensors for zones and entries. (each 'zone' or entry has it's own IO pin. All sensors on the same
      zone should be wired in parallel so that any one sensor tripping will light up that zone.)
    edit ./config/secret.js
    configure number of zones and entry circuits and their GPIO pins on server by editing app.js.
    configure 'zones' display by editing ./public/js/index.js html canvas code to create your own zone floor plan images!
    install nodemon so that it'll restart itself when you change it...
    se up and configure iptables for additional security 

## Contributing

  Please report any bugs to info@boffinry.org

## Acknowledgements 

  To Michael Herman for his excellent article - http://mherman.org/blog/2013/11/11/user-authentication-with-passport-dot-js 
    which helped TREMENDOUSLY getting local authenticaton up and running! 

  To Marco Schwartz as this project uses a MODIFIED version of his 'pi-arest' module. It has been edited to move the root 'REST' directory 
    from '/' to '/rest/' (so that the entire service can be secured with middleware in one route...). It has also had the GPIO read/write access REMOVED for security reasons.
    If you are developing a Node.js app which requires REST, check out his full node module 'pi-arest'!
     
  Icons downloaded from clipartpanda.com


    
         




    
