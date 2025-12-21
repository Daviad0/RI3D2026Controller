const SINGLE_MEDIA = "RI3D_MEDIA";
const OBSManager = require('./obs-server').OBSManager;


function setOBSmediaSource(obsManager, camera, target, targetSceneId, scene, isLocal=false){
    if(!obsManager) return;
    // check if type of obsManager is OBSManager (for code completion safety)
    if(!(obsManager instanceof OBSManager)) return;


    let x = camera.x;
    let y = camera.y;
    let width = camera.width;
    let height = camera.height;
    let url = camera.url;

    // target is the object name
    let requests = [
        {
            "requestType": "SetSceneItemTransform",
            "requestData": {
                "sceneName": scene,
                "sceneItemId": targetSceneId,
                "sceneItemTransform": {
                    "positionX": parseInt(x),
                    "positionY": parseInt(y),
                    "scaleX": parseFloat(width),
                    "scaleY": parseFloat(height)
                }
            }
        },
        {
            "requestType": "SetSceneItemEnabled",
            "requestData": {
                "sceneName": scene,
                "sceneItemId": targetSceneId,
                "sceneItemEnabled": true
            }
        },
        {
            "requestType": "SetInputSettings",
            "requestData": {
                "inputName": target,
                "inputSettings": {
                    "input": url,
                    "is_local_file": isLocal,
                }
            }
        }
    ];

    return requests;

    
}

function setOBSwebSource(obsManager, camera, target, targetSceneId, scene){
    if(!obsManager) return;
    // check if type of obsManager is OBSManager (for code completion safety)
    if(!(obsManager instanceof OBSManager)) return;

    let x = camera.x;
    let y = camera.y;
    let width = camera.width;
    let height = camera.height;
    let url = camera.url;

    // target is the object name
    let requests = [
        {
            "requestType": "SetSceneItemTransform",
            "requestData": {
                "sceneName": scene,
                "sceneItemId": targetSceneId,
                "sceneItemTransform": {
                    "positionX": parseInt(x),
                    "positionY": parseInt(y),
                }
            }
        },
        {
            "requestType": "SetSceneItemEnabled",
            "requestData": {
                "sceneName": scene,
                "sceneItemId": targetSceneId,
                "sceneItemEnabled": true
            }
        },
        {
            "requestType": "SetInputSettings",
            "requestData": {
                "inputName": target,
                "inputSettings": {
                    "url": url,
                    "width": parseInt(width),
                    "height": parseInt(height)
                }
            }
        }
    ];

    return requests;
}

function isValidCamera(camera){
    // need x, y, width, height, url
    if(!camera) return false;
    if(camera.x === undefined) return false;
    if(camera.y === undefined) return false;
    if(camera.width === undefined) return false;
    if(camera.height === undefined) return false;
    if(!camera.url) return false;

    return true;
}

function triggerPlayTransition(globalConfig, obsManager){
    if(!obsManager) return;
    if(!(obsManager instanceof OBSManager)) return;

    globalConfig.camera.playTransition += 1;
    obsManager.socketServer.emit("dataUpdated", "camera", "playTransition", globalConfig.camera.playTransition);
}

async function handleReaction(key, value, globalConfig, obsManager){
    if(!obsManager) return;

    // if the key is livePreview, then react to the change by setting the preview source in OBS
    if(key === "livePreview"){
        // get the id and preview option
        let id = globalConfig.camera.livePreview.id;
        let previewOption = globalConfig.camera.livePreview.preview;

        if(!id || previewOption === "off" || previewOption == null) return; // just don't react TODO:

        let camera = globalConfig.camera.configured.find(cam => cam.id === id);
        if(!camera) return; // camera not found
        if(!isValidCamera(camera)) return; // invalid camera

        let currentScene = globalConfig.obs_state.currentScene;
        if(!currentScene) return; // no current scene
        
        // and then get the scene index mapping for the current scene
        let sceneMapping = globalConfig.scene_index_mapping[currentScene];
        if(!sceneMapping) return; // no mapping for current scene

        if(camera.type == "web"){
            let targetSceneId = sceneMapping[`RI3D_WEB_1`];
            if(!targetSceneId) return; // no target scene id for single media

            let requests = setOBSwebSource(obsManager, camera, 'RI3D_WEB_1', targetSceneId, currentScene);
            await obsManager.sendBatchRequests(requests);
        }else{
            let targetSceneId = sceneMapping[`RI3D_MEDIA_1`];
            if(!targetSceneId) return; // no target scene id for single media

            let requests = setOBSmediaSource(obsManager, camera, 'RI3D_MEDIA_1', targetSceneId, currentScene, camera.type == "file");
            await obsManager.sendBatchRequests(requests);
        }

    }else if(key === "configured"){
        // then we will adjust the live preview if the currently selected camera is removed
        let id = globalConfig.camera.livePreview.id;
        let previewOption = globalConfig.camera.livePreview.preview;

        // OR allow if the 
        
        if(!id || previewOption === "off" || previewOption == null) return; // just don't react TODO:
        let camera = globalConfig.camera.configured.find(cam => cam.id === id);
        if(!camera) {
            // then the currently selected camera is gone, so turn off live preview
            globalConfig.camera.livePreview.id = null;
            return;
        }
        if(!isValidCamera(camera)) return; // invalid camera

        let currentScene = globalConfig.obs_state.currentScene;
        if(!currentScene) return; // no current scene

        let sceneMapping = globalConfig.scene_index_mapping[currentScene];
        if(!sceneMapping) return; // no mapping for current scene
{}
        if(!id || previewOption === "off"){
            // something else
        }else{
            if(camera.type == "web"){
                let targetSceneId = sceneMapping[`RI3D_WEB_1`];
                if(!targetSceneId) return; // no target scene id for single media

                let requests = setOBSwebSource(obsManager, camera, 'RI3D_WEB_1', targetSceneId, currentScene);
                await obsManager.sendBatchRequests(requests);
            }else{
                let targetSceneId = sceneMapping[`RI3D_MEDIA_1`];
                if(!targetSceneId) return; // no target scene id for single media

                let requests = setOBSmediaSource(obsManager, camera, 'RI3D_MEDIA_1', targetSceneId, currentScene, camera.type == "file");
                await obsManager.sendBatchRequests(requests);
            }
        }
    }else if(key === "sceneRequest"){
        // couple of things we need to do
        // 1. verify that this IS a request
        // 2. get the current scene and determine if it's a camera OR scene transition
        // 3. map the requested camera(s) to the correct sources in OBS based on the requested

        // this really just depends per scene... might just have a cameras[] inside of the sceneRequest
        let request = globalConfig.camera.sceneRequest;;
        if(!request || !request.scene || !request.cameras) return; // invalid request

        let targetScene = request.scene;
        let cameras = request.cameras; // array of camera IDs

        let currentScene = globalConfig.obs_state.currentScene;
        if(!currentScene) return; // no current scene

        // first determine if we need a scene transition
        let allRequests = [];
        if(currentScene !== targetScene){
            // then we need to do a scene transition first
            allRequests.push({
                "requestType": "SetCurrentProgramScene",
                "requestData": {
                    "sceneName": targetScene
                }
            });
        }else{
            // no scene transition needed
            triggerPlayTransition(globalConfig, obsManager);
        }
        allRequests.push({
            "requestType": "Sleep",
            "requestData": {
                "sleepMillis": 1000
            }
        });

        let sourceCameraNames = Array.from(globalConfig.obs_state.sourceCameraNames[targetScene] || []); // copy
        if(!sourceCameraNames) return; // no source camera names for target scene

        // only handle the first TWO cameras
        for(let i = 0; i < Math.min(cameras.length, 2); i++){
            let cameraId = cameras[i];
            let camera = globalConfig.camera.configured.find(cam => cam.id === cameraId);
            if(!camera) continue; // camera not found
            if(!isValidCamera(camera)) continue; // invalid camera

            // then determine if RI3D_MEDIA_# or RI3D_WEB_#
            let sourceNamePrefix = camera.type == "web" ? "RI3D_WEB_" : "RI3D_MEDIA_";
            let sourceName = sourceNamePrefix + (i + 1).toString();

            if(!sourceCameraNames.includes(sourceName)) continue; // source name not in the list for the target scene
            // then remove it from the sourceCameraNames list
            sourceCameraNames.splice(sourceCameraNames.indexOf(sourceName), 1);

            let sceneMapping = globalConfig.scene_index_mapping[targetScene];
            if(!sceneMapping) continue; // no mapping for target scene

            let targetSceneId = sceneMapping[sourceName];
            if(!targetSceneId) continue; // no target scene id for this source name

            if(camera.type == "web"){
                let requests = setOBSwebSource(obsManager, camera, sourceName, targetSceneId, targetScene);
                allRequests = allRequests.concat(requests);
            }else{
                let isLocal = camera.type == "file";
                let requests = setOBSmediaSource(obsManager, camera, sourceName, targetSceneId, targetScene, isLocal);
                allRequests = allRequests.concat(requests);
            }
        }
        
        // now disable all of the other sources
        for(const sourceName of sourceCameraNames){
            let sceneMapping = globalConfig.scene_index_mapping[targetScene];
            if(!sceneMapping) continue; // no mapping for target scene

            let targetSceneId = sceneMapping[sourceName];
            if(!targetSceneId) continue; // no target scene id for this source name

            let disableRequest = {
                "requestType": "SetSceneItemEnabled",
                "requestData": {
                    "sceneName": targetScene,
                    "sceneItemId": targetSceneId,
                    "sceneItemEnabled": false
                }
            };

            allRequests.push(disableRequest);
        }

        await obsManager.sendBatchRequests(allRequests);
        globalConfig.camera.activeSceneRequest = request;
        obsManager.socketServer.emit("dataUpdated", "camera", "activeSceneRequest", globalConfig.camera.activeSceneRequest);
        globalConfig.camera.sceneRequest = {}
    }
}

module.exports = {
    handleReaction
};