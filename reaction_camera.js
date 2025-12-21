const SINGLE_MEDIA = "RI3D_MEDIA";
const OBSManager = require('./obs-server').OBSManager;


async function setOBSmediaSource(obsManager, camera, target, targetSceneId, scene){
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
                    "width": parseInt(width),
                }
            }
        },
        {
            "requestType": "SetInputSettings",
            "requestData": {
                "inputName": target,
                "inputSettings": {
                    "input": url,
                    "is_local_file": false,
                }
            }
        }
    ];

    let responses = await obsManager.obs.callBatch(requests);
    console.log("Set OBS media source responses:", responses);
}

async function handleReaction(key, value, globalConfig, obsManager){
    if(!obsManager) return;

    // if the key is livePreview, then react to the change by setting the preview source in OBS
    if(key === "livePreview"){
        // get the id and preview option
        let id = globalConfig.camera.livePreview.id;
        let previewOption = globalConfig.camera.livePreview.preview;

        if(!id || previewOption === "off") return; // just don't react TODO:

        let camera = globalConfig.camera.configured.find(cam => cam.id === id);
        if(!camera) return; // camera not found

        let currentScene = globalConfig.obs_state.currentScene;
        if(!currentScene) return; // no current scene
        
        // and then get the scene index mapping for the current scene
        let sceneMapping = globalConfig.scene_index_mapping[currentScene];
        if(!sceneMapping) return; // no mapping for current scene

        let targetSceneId = sceneMapping[`${SINGLE_MEDIA}`];
        if(!targetSceneId) return; // no target scene id for single media

        // TODO: make general based on the media source type
        await setOBSmediaSource(obsManager, camera, SINGLE_MEDIA, targetSceneId, currentScene);
    }else if(key === "configured"){
        // then we will adjust the live preview if the currently selected camera is removed
        let id = globalConfig.camera.livePreview.id;
        let previewOption = globalConfig.camera.livePreview.preview;
        
        if(!id || previewOption === "off") return; // just don't react TODO:
        let camera = globalConfig.camera.configured.find(cam => cam.id === id);
        if(!camera) {
            // then the currently selected camera is gone, so turn off live preview
            globalConfig.camera.livePreview.id = null;
        }

        let currentScene = globalConfig.obs_state.currentScene;
        if(!currentScene) return; // no current scene

        let sceneMapping = globalConfig.scene_index_mapping[currentScene];
        if(!sceneMapping) return; // no mapping for current scene

        let targetSceneId = sceneMapping[`${SINGLE_MEDIA}`];
        if(!targetSceneId) return; // no target scene id for single media

        await setOBSmediaSource(obsManager, camera, SINGLE_MEDIA, targetSceneId, currentScene);
    }
}

module.exports = {
    handleReaction
};