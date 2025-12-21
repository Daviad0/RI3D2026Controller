const OBSWebSocket = require('obs-websocket-js').OBSWebSocket;

class OBSManager {
    constructor(obsUrl, password) {
        this.obsUrl = obsUrl;
        this.password = password;
        this.obs = new OBSWebSocket();
    }

    async connect() {
        try {
            await this.obs.connect(this.obsUrl, this.password);
            console.log(`Connected to OBS at ${this.obsUrl}`);
            return true;
        } catch (error) {
            console.error(`Failed to connect to OBS at ${this.obsUrl}:`, error);
            return false;
        }
    }

    async disconnect() {
        try {
            await this.obs.disconnect();
            console.log(`Disconnected from OBS at ${this.obsUrl}`);
        } catch (error) {
            console.error(`Failed to disconnect from OBS at ${this.obsUrl}:`, error);
        }
    }

    async sendBatchRequests(requests){
        try {
            const response = await this.obs.callBatch(requests);
            return response;
        }
        catch (error) {
            console.error('Error sending batch requests to OBS:', error);
            throw error;
        }
    }

    async setupImportantListeners(globalConfig){
        this.obs.on('CurrentSceneChanged', async (data) => {
            console.log("OBS Current Scene Changed:", data);
            globalConfig.obs_state.currentScene = data.sceneName;
        });

        // then just get the current scene once connected
        const currentSceneResponse = await this.obs.call('GetCurrentProgramScene');
        globalConfig.obs_state.currentScene = currentSceneResponse.sceneName;
    }

    // throws all scene index mapping into the scene_index_mapping global config
    // where the scene is the key
    async reportSceneIndexMapping(globalConfig){
        // go through each scene under obs_state.scenesToTarget
        for(const sceneName of globalConfig.obs_state.scenesToTarget){
            try {
                const response = await this.obs.call('GetSceneItemList', {
                    sceneName: sceneName
                });

                let localMapping = {};
                // ONLY handle items beginning in RI3D_
                response.sceneItems.forEach(item => {
                    if(item.sourceName.startsWith("RI3D_")){
                        localMapping[item.sourceName] = item.sceneItemId;
                    }
                });

                globalConfig.scene_index_mapping[sceneName] = localMapping;
            }
            catch (error) {
                console.error(`Error getting scene item list for scene ${sceneName}:`, error);
            }
        }

    }

    async requestScreenshotForSource(sourceName, imageFormat='png'){
        try {
            const response = await this.obs.call('GetSourceScreenshot', {
                sourceName: sourceName,
                imageWidth: 320,
                imageFormat: imageFormat
            });

            return response.imageData;
        }  catch (error) {
            console.error('Error requesting screenshot from OBS:', error);
        }
    }
}

exports.OBSManager = OBSManager;