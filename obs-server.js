const OBSWebSocket = require('obs-websocket-js').OBSWebSocket;

class OBSManager {
    constructor(socketServer) {
        this.socketServer = socketServer;
        this.unresolvedRequests = {};

        socketServer.on("obs-responses", (reqId, response) => {
            this.resolveRequest(reqId, response);
        });
    }

    generateUUID() {
        // generate an 8 character random alphanumeric string
        return 'xxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async resolveRequest(reqId, response){
        let requestEntry = this.unresolvedRequests[reqId];
        if(requestEntry){
            // call the callback if exists
            if(requestEntry.callback){
                requestEntry.callback(response);
            }
            // remove from unresolved
            delete this.unresolvedRequests[reqId];
        }
    }

    async sendBatchRequests(requests, callback=null){
        let reqId = this.generateUUID();
        this.unresolvedRequests[reqId] = {
            requests: requests,
            timestamp: Date.now(),
            callback: callback
        }
        this.socketServer.emit("obs-requests", reqId, requests);
    }

    // async setupImportantListeners(globalConfig){
    //     this.obs.on('CurrentSceneChanged', async (data) => {
    //         console.log("OBS Current Scene Changed:", data);
    //         globalConfig.obs_state.currentScene = data.sceneName;
    //     });

    //     // then just get the current scene once connected
    //     const currentSceneResponse = await this.obs.call('GetCurrentProgramScene');
    //     globalConfig.obs_state.currentScene = currentSceneResponse.sceneName;
    // }

    // // throws all scene index mapping into the scene_index_mapping global config
    // // where the scene is the key
    // async reportSceneIndexMapping(globalConfig){
    //     // go through each scene under obs_state.scenesToTarget
    //     for(const sceneName of globalConfig.obs_state.scenesToTarget){
    //         try {
    //             const response = await this.obs.call('GetSceneItemList', {
    //                 sceneName: sceneName
    //             });

    //             let localMapping = {};
    //             // ONLY handle items beginning in RI3D_
    //             response.sceneItems.forEach(item => {
    //                 if(item.sourceName.startsWith("RI3D_")){
    //                     localMapping[item.sourceName] = item.sceneItemId;
    //                 }
    //             });

    //             globalConfig.scene_index_mapping[sceneName] = localMapping;
    //         }
    //         catch (error) {
    //             console.error(`Error getting scene item list for scene ${sceneName}:`, error);
    //         }
    //     }

    // }

    // async requestScreenshotForSource(sourceName, imageFormat='png'){
    //     try {
    //         const response = await this.obs.call('GetSourceScreenshot', {
    //             sourceName: sourceName,
    //             imageWidth: 320,
    //             imageFormat: imageFormat
    //         });

    //         return response.imageData;
    //     }  catch (error) {
    //         console.error('Error requesting screenshot from OBS:', error);
    //     }
    // }
}

exports.OBSManager = OBSManager;