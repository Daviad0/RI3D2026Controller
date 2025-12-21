const { io } = require('socket.io-client');
const OBSWebSocket = require('obs-websocket-js').OBSWebSocket;

const connectToHost = "https://ccr.students.mtu.edu";
const connectToPath = "/ri3d26/socket.io/";

const obsInstance = new OBSWebSocket();
const obsState = {
    connected: false,
    scenesToTarget: [
        "Passive",
        "Present",
        "BeRightBack",
        "TwoCamera",
        "StartingSoon"
    ],
    sceneIndexMapping: {},
    currentScene: null,
    cache: {
        // in the format of sceneName~sourceName: {props}
        // for item settings so we don't bother resetting over and over
    }
};

async function connectOBS(){
    try {
        await obsInstance.connect("ws://127.0.0.1:4455");
        obsState.connected = true;
        console.log("Connected to OBS WebSocket server");

        defaultOBSdataPieces();
    } catch (error) {
        console.error("Failed to connect to OBS WebSocket server:", error);
    }
}

async function refreshCacheFromOBS(){
    // take everything from the current scene and store it in the cache
    // just go into the local mapping for the current scene
    let sceneName = obsState.currentScene;
    let sceneMapping = obsState.sceneIndexMapping[sceneName];
    if(!sceneMapping) return;

    let sceneObjects = Object.keys(sceneMapping);
    // now we want to get the input settings for each one
    for(const sourceName of sceneObjects){
        const sourceSettings = await obsInstance.call('GetInputSettings', {
            inputName: sourceName
        });
        obsState.cache[`${sceneName}~${sourceName}`] = sourceSettings;
    }

    console.log("OBS cache refreshed for scene:", sceneName);
    socket.emit("obs-data", "obs_state", "cache", obsState.cache);
    
}

async function defaultOBSdataPieces(){
    // first, get all of the scenes...
    // already manually done

    // next, do the scene_index_mapping population
    for(const sceneName of obsState.scenesToTarget){
        // we both want to send it back to the server, and also store it locally
        let localMapping = {};
        // get full scene item list
        const response = await obsInstance.call('GetSceneItemList', {
            sceneName: sceneName
        });

        response.sceneItems.forEach(item => {
            if(item.sourceName.startsWith("RI3D_")){
                localMapping[item.sourceName] = item.sceneItemId;
            }
        });

        obsState.sceneIndexMapping[sceneName] = localMapping;
        // send to server using obs-data

        socket.emit("obs-data", "scene_index_mapping", sceneName, localMapping);
    }

    // then the event listener for the scene changed
    obsInstance.on("CurrentProgramSceneChanged", async (data) => {
        console.log("OBS Current Scene Changed:", data);
        obsState.currentScene = data.sceneName;
        socket.emit("obs-data", "obs_state", "currentScene", data.sceneName);
        refreshCacheFromOBS();
    })

    // also just get the current scene once connected
    let currentSceneResponse = await obsInstance.call('GetCurrentProgramScene');
    obsState.currentScene = currentSceneResponse.sceneName;
    socket.emit("obs-data", "obs_state", "currentScene", obsState.currentScene);

    refreshCacheFromOBS();
}

function stripRequestsThatMatchCache(requests){
    let sceneName = obsState.currentScene;
    let finalRequests = [];
    for(const req of requests){
        let includeInRequest = true;
        if(req.requestType == "SetInputSettings") {
            let inputName = req.requestData.inputName;
            let cacheKey = `${sceneName}~${inputName}`;
            let cachedSettings = obsState.cache[cacheKey];
            if(cachedSettings){
                let settingsToSet = req.requestData.inputSettings;
                // compare each key in settingsToSet to cachedSettings.inputSettings
                let allMatch = true;
                for(const key of Object.keys(settingsToSet)){
                    if(cachedSettings.inputSettings[key] !== settingsToSet[key]){
                        allMatch = false;
                        cachedSettings.inputSettings[key] = settingsToSet[key]; // update cache
                    }
                }
                if(allMatch){
                    includeInRequest = false;
                }
            }
        }
        if(includeInRequest){
            finalRequests.push(req);
        }
    }

    return finalRequests;
}

const socket = io(connectToHost, {
    path: connectToPath
});

socket.on('connect', () => {
    console.log('Connected to server via socket.io');
    connectOBS();
});

socket.on('error', (error) => {
    console.error('Socket.io error:', error);
});

socket.on("obs-requests", async (reqId, data) => {
    // reqId is just a UUID to keep track for responses
    console.log("Received OBS requests:", data);
    if(!obsState.connected) return;
    let requests = stripRequestsThatMatchCache(data);
    console.log("Filtered OBS requests:", requests);
    try {
        const response = await obsInstance.callBatch(requests);
        console.log("OBS requests response:", response);
        socket.emit("obs-responses", reqId, response);
    } catch (error) {
        console.error("Error processing OBS requests:", error);
        socket.emit("obs-responses", reqId, {error: error.message});
    }
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
});


console.log(`Socket.io client connecting to ${connectToHost} with path ${connectToPath}`);