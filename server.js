const express = require('express');
const fs = require('fs');
const app = express();
const basePath = "/ri3d26";
const cors = require('cors');
// allow localhost:3001
app.use(cors({
    origin: '*'
}));

const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    path: basePath + '/socket.io',
    // allow for localhost during development
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const OBSWebSocket = require('obs-websocket-js').OBSWebSocket;
const OBSManager = require('./obs-server').OBSManager;

const reaction_camera = require('./reaction_camera');


// serve the public folder
app.use(basePath, express.static('public'));
// serve previews folder
app.use(basePath + '/previews', express.static('previews'));

app.get(basePath + '/livestream', (req, res) => {
    res.sendFile(__dirname + '/views/livestream.html');
});
app.get(basePath + '/stream', (req, res) => {
    res.sendFile(__dirname + '/views/stream.html');
});
app.get(basePath + '/scenes', (req, res) => {
    res.sendFile(__dirname + '/views/scenes.html');
});
app.get(basePath + '/manager', (req, res) => {
    res.sendFile(__dirname + '/views/manager.html');
});
app.get(basePath + '/documents', (req, res) => {
    res.sendFile(__dirname + '/views/documents.html');
});
app.get(basePath + '/bigtimer', (req, res) => {
    res.sendFile(__dirname + '/views/bigtimer.html');
});
app.get(basePath + '/schedule', (req, res) => {
    res.sendFile(__dirname + '/views/schedule.html');
});
app.get(basePath + '/home', (req, res) => {
    res.sendFile(__dirname + '/views/home.html');
});

app.get(basePath + '/document-search', (req, res) => {
    // query parameter "q" holds the search term
    let searchTerm = req.query.q || "";
    let matchingDocs = [];
    matchingDocs = globalConfig.documents.documents.filter(doc => 
        doc.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        doc.visibility !== 'hidden'
    );

    res.json({ results: matchingDocs });
});

app.get(basePath + '/document-view', (req, res) => {
    // query parameter "id" holds the document id
    let docId = req.query.id || "";
    let document = globalConfig.documents.documents.find(doc => doc.id === docId);
    if(document){
        res.redirect(document.source);
    }else{
        res.status(404).send("Document not found");
    }
});

const reaction_groups = {
    "camera": (key, value) => reaction_camera.handleReaction(key, value, globalConfig, obsManager)
}

// hold the primary data structure here
let globalConfig = {
    overlay: {
        requestedStage: null,
        currentStage: null
    },
    camera: {
        playTransition: 0,
        available: ["Livestream"],
        livePreview: {
            id: null,
            preview: "off"
        },
        configured: [],
        preview: "images",
        manager: null,
        activeSceneRequest: {},
        sceneRequest: {}
    },
    documents: {
        documents: []
    },
    schedule: {
        scheduleItems: {},
        activeScheduleItems: [],
        additionalScheduleNotes: ""
    },
    obs_state: {
        scenesToTarget: [ // set MANUALLY - mimiced in obs-connection.js
            "Passive",
            "Present",
            "BeRightBack",
            "TwoCamera",
            "StartingSoon"
        ],
        currentScene: null,
        cache: {},
        sourceCameraNames: { // keep track of which sources are mapped to which cameras
            "Passive": [
                "RI3D_MEDIA_1",
                "RI3D_WEB_1"
            ],
            "Present": [
                "RI3D_MEDIA_1",
                "RI3D_WEB_1"
            ],
            "BeRightBack": [
                "RI3D_MEDIA_1",
                "RI3D_WEB_1"
            ],
            "TwoCamera": [
                "RI3D_MEDIA_1",
                "RI3D_MEDIA_2",
                "RI3D_WEB_1",
                "RI3D_WEB_2"
            ],
            "StartingSoon": []
        }
    },
    scene_index_mapping: { // automatically filled on OBS connection

    },
    constants: {
        publicDocumentsLink: "https://drive.google.com/drive/u/0/folders/1N6PCUuDWNRrZHfQ6jIBQx7Wa8wZkaUfx",
        publicCalendarLink: "https://calendar.google.com/calendar/embed?src=c_6ad2a24c07de8545d32333b8289aa930a0f82c4e274e1b482afca4f8f9db0df7%40group.calendar.google.com&ctz=America%2FDetroit"
    }
};

let obsManager = new OBSManager(io);

async function readConfig(group) {
    // TRY to read the file, if it doesn't exist return the default structure
    if(!fs.existsSync(`data/${group}.json`)){
        // then return default structure
        const defaultStructure = await fs.promises.readFile(`data/default/${group}.json`, 'utf8');
        return JSON.parse(defaultStructure);
    }
    // otherwise read the file
    const data = await fs.promises.readFile(`data/${group}.json`, 'utf8');
    return JSON.parse(data);
}

const DO_NOT_WRITE= ["obs_state", "scene_index_mapping", "constants"];

async function writeConfig(config, group) {
    if(DO_NOT_WRITE.includes(group)) return;

    const data = JSON.stringify(config, null, 2);
    await fs.promises.writeFile(`data/${group}.json`, data, 'utf8');
}

async function init(){
    // go through each key of globalConfig and read the file
    for (const group of Object.keys(globalConfig)) {
        if(DO_NOT_WRITE.includes(group)) continue; // don't hit one that was marked to not write
        
        globalConfig[group] = await readConfig(group);
    }
}

io.on('connection', (socket) => {
    console.log('a page connected');

    socket.emit("entireConfig", globalConfig);

    socket.on('changeData', async (group, key, value) => {
        console.log(`Changing data: ${group} -> ${key} = ${value}`);
        if(globalConfig[group]){
            globalConfig[group][key] = value;
            await writeConfig(globalConfig[group], group);
            io.emit('dataUpdated', group, key, value);

            // check for reactions
            if(reaction_groups[group]){
                // no await needed here
                reaction_groups[group](key, value);
            }
        }
    });

    // handle to receive OBS data bits
    // this is NOT in response to anything, just as a "default"
    socket.on('obs-data', (group, key, value) => {
        console.log(`Received OBS data: ${group} -> ${key} = ${value}`);
        if(globalConfig[group]){
            globalConfig[group][key] = value;
            
            io.emit('dataUpdated', group, key, value);
        }
    });

});



// // refresher loop for grabbing the camera previews / data
// setInterval(async () => {
//     if(!obsManager) {
//         console.log("OBS Manager not connected, skipping preview fetch.");
//         return;
//     }

//     console.log(globalConfig);

//     if(globalConfig.camera.preview == "images"){
//         globalConfig.camera.available.forEach( async (cameraName) => {
//             try {
//                 const imageData = await obsManager.requestScreenshotForSource(cameraName, 'jpg');
//                 // then save to the previews
//                 const base64Data = imageData.split('base64,')[1];
//                 fs.writeFileSync(`previews/${cameraName}.jpg`, base64Data, 'base64');
//             }catch (error) {
//                 console.error(`Error fetching screenshot for camera ${cameraName}:`, error);
//             }
//         });
//     }
// }, 5000);

init();

http.listen(3000, async () => {
    await init();
    console.log('listening on *:3000');
});

