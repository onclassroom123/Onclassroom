async function connect() {
    if (!localStream) {
        console.warn('WARN: local media NOT READY');
        return;
    }

    if (socket) {
        const data = await sendRequest('getRouterRtpCapabilities', { roomId: roomId });
        console.log('getRouterRtpCapabilities:', data);
        await loadDevice(data);
    } else {
        console.log("Error in joining")
    }

}
async function publish() {
    // --- get transport info ---
    console.log('--- createProducerTransport --');
    const params = await sendRequest('createProducerTransport', {});
    console.log('transport params:', params);
    let publishProducerTransport = device.createSendTransport(params);
    console.log('createSendTransport:', publishProducerTransport);

    // --- join & start publish --
    publishProducerTransport.on('connect', async({ dtlsParameters }, callback, errback) => {
        console.log('--trasnport connect');
        sendRequest('connectProducerTransport', { dtlsParameters: dtlsParameters })
            .then(callback)
            .catch(errback);
    });

    publishProducerTransport.on('produce', async({ kind, rtpParameters }, callback, errback) => {
        console.log('--trasnport produce');
        try {
            const { id } = await sendRequest('produce', {
                transportId: publishProducerTransport.id,
                kind,
                rtpParameters,
            });
            callback({ id });
            console.log('--produce requested, then subscribe ---', kind);
            subscribe();
        } catch (err) {
            errback(err);
        }
    });
    publishProducerTransport.on('producedata', async(parameters, callback, errback) => {
        console.log('--trasnport producedata');
        try {
            const { id } = await sendRequest('producedata', {
                transportId: publishProducerTransport.id,
                sctpStreamParameters: parameters.sctpStreamParameters,
                label: parameters.label,
                protocol: parameters.protocol,
            });
            callback({ id })

            console.log('--produce data requested, then subscribe ---', parameters.label);
            subscribe();
        } catch (err) {
            errback(err);
        }
    });

    publishProducerTransport.on('connectionstatechange', (state) => {
        switch (state) {
            case 'connecting':
                console.log('publishing...');
                break;

            case 'connected':
                console.log('published');
                break;

            case 'failed':
                console.log('failed');
                publishProducerTransport.close();
                break;

            default:
                break;
        }
    });

    return publishProducerTransport;
}
async function addLocalStream() {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        const trackParams = { track: videoTrack };
        videoProducer = await producerTransport.produce(trackParams);
    }

    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        const trackParams = { track: audioTrack };
        audioProducer = await producerTransport.produce(trackParams);
    }
}

async function createDataProducer(label) {
    const dataProducer = await producerTransport.produceData({
        sctpStreamParameters: {
            streamId: 4,
            ordered: true
        },
        label: label
    });
    dataProducer.on("transportclose", () => {
        console.log("Transport close");
    });
    dataProducer.on('error', () => {
        console.log("Erro occured");
    });
    return dataProducer;
}
async function join() {
    await connect();
    producerTransport = await publish();
    messageProducer = await createDataProducer('message');
    fileProducer = await createDataProducer('file')
    await addLocalStream();
    enableElement();
    showToast("welcome", "Your are connected")
}

async function screenShare() {
    if (screenStream) {
        screenvideoProducer.close();
        setStopScreenShareButton();
        screenvideoProducer = null;
        screenStream = null;
    } else {
        navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }).then(async(stream) => {
            screenStream = stream;
            const videoTrack = screenStream.getVideoTracks()[0];
            const trackParams = { track: videoTrack };
            screenvideoProducer = await producerTransport.produce(trackParams);
            setScreenShareButton();
            screenvideoProducer.observer.on('trackended', () => {
                console.log("Track ended");
            });
            screenvideoProducer.observer.on('close', () => {
                console.log("Track close");
            })
        }).catch(err => {
            console.log(err.message);
        })
    }

}

async function subscribe() {
    if (!isSocketConnected()) {
        await connectSocket().catch(err => {
            console.error(err);
            return;
        });

        // --- get capabilities --
        const data = await sendRequest('getRouterRtpCapabilities', {});
        console.log('getRouterRtpCapabilities:', data);
        await loadDevice(data);
    }

    // --- prepare transport ---
    console.log('--- createConsumerTransport --');
    if (!consumerTransport) {
        const params = await sendRequest('createConsumerTransport', {});
        console.log('transport params:', params);
        consumerTransport = device.createRecvTransport(params);
        console.log('createConsumerTransport:', consumerTransport);

        // --- join & start publish --
        consumerTransport.on('connect', async({ dtlsParameters }, callback, errback) => {
            console.log('--consumer trasnport connect');
            sendRequest('connectConsumerTransport', { dtlsParameters: dtlsParameters })
                .then(callback)
                .catch(errback);
        });

        consumerTransport.on('connectionstatechange', (state) => {
            switch (state) {
                case 'connecting':
                    console.log('subscribing...');
                    break;

                case 'connected':
                    console.log('subscribed');
                    break;

                case 'failed':
                    console.log('failed');
                    producerTransport.close();
                    break;

                default:
                    break;
            }
        });

        consumeCurrentProducers(clientId);
    }
}

async function consumeCurrentProducers(clientId) {
    console.log('-- try consuleAll() --');
    const remoteInfo = await sendRequest('getCurrentProducers', { localId: clientId })
        .catch(err => {
            console.error('getCurrentProducers ERROR:', err);
            return;
        });
    console.log('remoteInfo.remoteVideoIds:', remoteInfo.remoteVideoIds);
    console.log('remoteInfo.remoteAudioIds:', remoteInfo.remoteAudioIds);
    console.log('remoteInfo.remoteMessage:', remoteInfo.remoteMessageIds);
    console.log('remoteInfo.remoteFileIds:', remoteInfo.remoteFileIds);
    consumeAll(consumerTransport, remoteInfo.remoteVideoIds, remoteInfo.remoteAudioIds, remoteInfo.remoteMessageIds, remoteInfo.remoteFileIds);
}

function disconnect() {
    if (localStream) {
        pauseVideo(localVideo);
        stopLocalStream(localStream);
        localStream = null;
    }
    if (videoProducer) {
        videoProducer.close(); // localStream will stop
        videoProducer = null;
    }
    if (screenvideoProducer) {
        screenvideoProducer.close(); // localStream will stop
        screenvideoProducer = null;
    }
    if (audioProducer) {
        audioProducer.close(); // localStream will stop
        audioProducer = null;
    }
    if (messageProducer) {
        messageProducer.close(); // localStream will stop
        messageProducer = null;
    }
    if (fileProducer) {
        fileProducer.close(); // localStream will stop
        fileProducer = null;
    }
    if (producerTransport) {
        producerTransport.close(); // localStream will stop
        producerTransport = null;
    }

    for (const key in videoConsumers) {
        const consumer = videoConsumers[key];
        consumer.close();
        delete videoConsumers[key];
    }
    for (const key in audioConsumers) {
        const consumer = audioConsumers[key];
        consumer.close();
        delete audioConsumers[key];
    }
    for (const key in messageConsumers) {
        const consumer = messageConsumers[key];
        consumer.close();
        delete messageConsumers[key];
    }
    for (const key in fileConsumers) {
        const consumer = fileConsumers[key];
        consumer.close();
        delete fileConsumers[key];
    }

    if (consumerTransport) {
        consumerTransport.close();
        consumerTransport = null;
    }

    removeAllRemoteVideo();

    disconnectSocket();
}

async function loadDevice(routerRtpCapabilities) {
    try {
        device = new MediasoupClient.Device();
    } catch (error) {
        if (error.name === 'UnsupportedError') {
            console.error('browser not supported');
        }
    }
    await device.load({ routerRtpCapabilities });
}

function consumeAll(transport, remoteVideoIds, remotAudioIds, remoteMessageIds, remoteFileIds) {
    console.log('----- consumeAll() -----')
    remoteVideoIds.forEach(rId => {
        consumeAdd(transport, rId, null, 'video');
        console.log("video consume");
    });
    console.log("After video consume");
    remotAudioIds.forEach(rId => {
        consumeAdd(transport, rId, null, 'audio');
        console.log("Audio consume");
    });
    console.log("After audio consume");
    remoteMessageIds.forEach(rId => {
        consumeDataAdd(transport, rId, null, 'message');
        console.log("Message consume");
    });
    remoteFileIds.forEach(rId => {
        consumeDataAdd(transport, rId, null, 'file');
        console.log("File consume");
    });
};

async function consumeAdd(transport, remoteSocketId, prdId, trackKind) {
    console.log('--start of consumeAdd -- kind=%s', trackKind);
    const { rtpCapabilities } = device;
    const data = await sendRequest('consumeAdd', { rtpCapabilities: rtpCapabilities, remoteId: remoteSocketId, kind: trackKind })
        .catch(err => {
            console.error('consumeAdd ERROR:', err);
        });
    const {
        producerId,
        id,
        kind,
        rtpParameters,
    } = data;
    if (prdId && (prdId !== producerId)) {
        console.warn('producerID NOT MATCH');
    }

    let codecOptions = {};
    const consumer = await transport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        codecOptions,
    });

    addRemoteTrack(remoteSocketId, consumer.track, kind);
    addConsumer(remoteSocketId, consumer, kind);
    consumer.remoteId = remoteSocketId;
    consumer.on("transportclose", () => {
        console.log('--consumer transport closed. remoteId=' + consumer.remoteId);
    });
    consumer.on("producerclose", () => {
        console.log('--consumer producer closed. remoteId=' + consumer.remoteId);
        consumer.close();
        removeConsumer(remoteId, kind);
        removeRemoteVideo(consumer.remoteId);
    });
    consumer.on('trackended', () => {
        console.log('--consumer trackended. remoteId=' + consumer.remoteId);
    });
    console.log('--end of consumeAdd');

    if (kind === 'video') {
        console.log('--try resumeAdd --');
        sendRequest('resumeAdd', { remoteId: remoteSocketId, kind: kind })
            .then(() => {
                console.log('resumeAdd OK');
            })
            .catch(err => {
                console.error('resumeAdd ERROR:', err);
            });
    }
}

async function consumeDataAdd(transport, remoteSocketId, prdId, plabel) {
    console.log('--start of consumeDataAdd -- label=%s', plabel);
    const { rtpCapabilities } = device;
    console.log({ remoteId: remoteSocketId, label: plabel })
    const data = await sendRequest('consumeDataAdd', { remoteId: remoteSocketId, label: plabel })
        .catch(err => {
            console.error('consumeDataAdd ERROR:', err);
        });
    const {
        producerId,
        id,
        label,
        sctpStreamParameters,
        protocol
    } = data;
    if (prdId && (prdId !== producerId)) {
        console.warn('producerID NOT MATCH');
    }
    const consumer = await transport.consumeData({
        id,
        dataProducerId: producerId,
        label,
        sctpStreamParameters,
        protocol,
    });
    addConsumer(remoteSocketId, consumer, label);
    consumer.remoteId = remoteSocketId;
    consumer.on("transportclose", () => {
        console.log('--consumer transport closed. remoteId=' + consumer.remoteId);
    });
    consumer.on("dataproducerclose", () => {
        console.log('--consumer producer closed. remoteId=' + consumer.remoteId);
        consumer.close();
        removeConsumer(remoteId, kind);
        removeRemoteVideo(consumer.remoteId);
    });
    consumer.on('message', (message) => {
        let li = document.createElement("li");
        if (message.user != clientId) {
            li.classList.add("otherUser");
            li.innerHTML = `<span> <b> ${ members[consumer.remoteId] }: </b>${message}</span>`;
        } else {
            li.innerHTML = `<span> <b> Me: </b>${message}</span>`;

        }
        all_messages.append(li);
        main__chat__window.scrollTop = main__chat__window.scrollHeight;
        if (consumer.remoteId != clientId && document.body.classList.contains('showChat')) {
            pendingMessage++;
            document.getElementById("chat__Btn").classList.add("has__new");
            document.getElementById("chat__Btn").children[1].innerHTML = `Chat(${pendingMessage})`;
        }
    });
    console.log('--end of consumeAdd');

}

function getConsumer(id, kind) {
    if (kind === 'video') {
        return videoConsumers[id];
    } else if (kind === 'audio') {
        return audioConsumers[id];
    } else {
        console.warn('UNKNOWN consumer kind=' + kind);
    }
}

function addConsumer(id, consumer, kind) {
    if (kind === 'video') {
        videoConsumers[id] = consumer;
        console.log('videoConsumers count=' + Object.keys(videoConsumers).length);
    } else if (kind === 'audio') {
        audioConsumers[id] = consumer;
        console.log('audioConsumers count=' + Object.keys(audioConsumers).length);
    } else if (kind === 'message') {
        messageConsumers[id] = consumer;
        console.log('messageConsumers count=' + Object.keys(messageConsumers).length);
    } else if (kind === 'file') {
        fileConsumers[id] = consumer;
        console.log('audioConsumers count=' + Object.keys(fileConsumers).length);
    } else {
        console.warn('UNKNOWN consumer kind=' + kind);
    }
}

function removeConsumer(id, kind) {
    if (kind === 'video') {
        delete videoConsumers[id];
        console.log('videoConsumers count=' + Object.keys(videoConsumers).length);
    } else if (kind === 'audio') {
        delete audioConsumers[id];
        console.log('audioConsumers count=' + Object.keys(audioConsumers).length);
    } else if (kind === 'message') {
        delete messageConsumers[id];
        console.log('messageConsumers count=' + Object.keys(messageConsumers).length);
    } else if (kind === 'file') {
        delete fileConsumers[id];
        console.log('fileConsumers count=' + Object.keys(fileConsumers).length);
    } else {
        console.warn('UNKNOWN consumer kind=' + kind);
    }
}

function addMember(id, name) {
    participants = document.getElementById('all_participants')
    element = document.createElement('li');
    element.id = '' + id;
    element.innerHTML = `<span>${name}</span>`;

    participants.appendChild(element);
    members[id] = name;
    console.log(name + " has joinned meeting");
}

function removeMember(id) {
    participants = document.getElementById('all_participants');
    participants.removeChild(document.getElementById('' + id))
    console.log(members[id] + " has left meeting");
    delete members[id];

}