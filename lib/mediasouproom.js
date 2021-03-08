const mongoose = require('mongoose');
const Meetings = mongoose.model('Meetings');
// ========= mediasoup ===========
const mediasoup = require("mediasoup");
const Process = require("child_process");
const FFmpegStatic = require("ffmpeg-static");
const mediasoupOptions = {
    // Worker settings
    worker: {
        rtcMinPort: 10000,
        rtcMaxPort: 10100,
        logLevel: 'warn',
        logTags: [
            'info',
            'ice',
            'dtls',
            'rtp',
            'srtp',
            'rtcp',
            // 'rtx',
            // 'bwe',
            // 'score',
            // 'simulcast',
            // 'svc'
        ],
    },
    // Router settings
    router: {
        mediaCodecs: [{
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                preferredPayloadType: 111,
                channels: 2,
                parameters: {
                    minptime: 10,
                    useinbandfec: 1,
                },
            },
            {
                kind: 'video',
                mimeType: 'video/VP8',
                preferredPayloadType: 96,
                clockRate: 90000,
                parameters: {
                    'x-google-start-bitrate': 1000
                }
            },
        ]
    },
    // WebRtcTransport settings
    webRtcTransport: {
        listenIps: [
            { ip: '127.0.0.1', announcedIp: null }
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        enableSctp: true,
        maxIncomingBitrate: 1500000,
        initialAvailableOutgoingBitrate: 1000000,
    },
    plainTransport: {
        listenIp: { ip: '127.0.0.1', announcedIp: null },
        comedia: false,
        rtcpMux: false,
    },
    recording: {
        ip: "127.0.0.1",

        // GStreamer's sdpdemux only supports RTCP = RTP + 1
        audioPort: 5004,
        audioPortRtcp: 5005,
        videoPort: 5006,
        videoPortRtcp: 5007,
    },
    recProcess: null,
};

let worker = null;

exports.startWorker = async function(roomId, clientId) {
    const mediaCodecs = mediasoupOptions.router.mediaCodecs;
    worker = await mediasoup.createWorker();
    await setupRoom(roomId, clientId);
    console.log('-- mediasoup worker start. -- room:');
    return worker;
}
class Room {
    constructor(name) {
        this.name = name;
        this.locked = false;
        this.host = null;
        this.producerTransports = {};
        this.videoProducers = {};
        this.audioProducers = {};
        this.messageProducers = {};
        this.fileProducers = {};
        this.consumerTransports = {};
        this.videoConsumerSets = {};
        this.audioConsumerSets = {};
        this.messageConsumerSets = {};
        this.fileConsumerSets = {};
        this.member = {};
        this.router = null;
        this.audioObserver = null;
        this.resumedProducer = null;
        this.videoTransport = null;
        this.audioTransport = null;
        this.audioConsumer = null;
        this.videoConsumer = null;
    }
    getRoomname() {
        return this.name;
    }
    addMember(id, name) {
        this.member[id] = name
    }
    removeMember(id) {
        delete this.member[id]
    }
    is_locked() {
        return this.locked;
    }
    lock() {
        this.locked = true;
    }
    unlocked() {
        this.locked = false;
    }
    createTransport(id, type) {
        const transport = await this.router.createWebRtcTransport({
            listenIps: [
                { ip: '127.0.0.1', announcedIp: null }
            ],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            enableSctp: true,
            maxIncomingBitrate: 1500000,
            initialAvailableOutgoingBitrate: 1000000,
        });
        console.log('-- create transport room=%s id=%s', roomname, transport.id);
        if (type === 'producer') {
            this.addProducerTrasnport(id, transport);
        } else {
            addConsumerTrasport(id, transport);
        }

        return {
            transport: transport,
            params: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
                sctpParameters: transport.sctpParameters
            }
        };
    }

    produce(data, id) {
        const { kind, rtpParameters } = data;
        console.log('-- produce --- kind=' + kind);
        const transport = this.producerTransports[id];
        if (!transport) {
            console.error('transport NOT EXIST for id=' + id);
            return;
        }
        const producer = await transport.produce({ kind, rtpParameters });
        if (kind === "audio") {
            this.audioLevelObserver.addProducer({ producerId: producer.id });
        } else {
            // producer.pause();
        }
        addProducer(id, producer, kind);
        producer.observer.on('close', () => {
            console.log('producer closed --- kind=' + kind);
        })
    }

    produceData(data, id) {
        const { sctpStreamParameters, label } = data;
        console.log('-- produce --- label=' + label);
        const transport = this.producerTransports[id];
        if (!transport) {
            console.error('transport NOT EXIST for id=' + id);
            return;
        }
        const dataProducer = await transport.produceData({ sctpStreamParameters, label });
        addProducer(id, dataProducer, label);
        dataProducer.observer.on('close', () => {
            console.log('data producer closed --- kind=' + label);
        })
        dataProducer.on('message', (message, ppid) => {
            console.log("message:", message)
        })
    }
    addProducerTrasnport(id, transport) {
        this.producerTransports[id] = transport;
        transport.observer.on('close', () => {
            const videoProducer = this.videoProducers[id];
            if (videoProducer) {
                videoProducer.close();
                delete this.videoProducers[id];
            }
            const audioProducer = this.audioProducers[id];
            if (audioProducer) {
                this.audioLevelObserver.removeProducer({ producerId: audioProducer.id });
                audioProducer.close();
                delete this.audioProducers[id];
            }
            const messageProducer = this.messageProducers[id];
            if (messageProducer) {
                messageProducer.close();
                delete this.messageProducers[id];
            }
            const fileProducer = this.fileProducers[id];
            if (fileProducer) {
                fileProducer.close();
                delete this.fileProducers[id];
            }
            delete this.producerTransports[id];
        });
    }
    getProducerTrasnport(id) {
        return this.producerTransports[id];
    }

    removeProducerTransport(id) {
        delete this.producerTransports[id];
        console.log('room=%s producerTransports count=%d', this.name, Object.keys(this.producerTransports).length);
    }

    getProducer(id, kind) {
        if (kind === 'video') {
            return this.videoProducers[id];
        } else if (kind === 'audio') {
            return this.audioProducers[id];
        } else if (kind === 'message') {
            return this.messageProducers[id];
        } else if (kind === 'file') {
            return this.fileProducers[id];
        } else {
            console.warn('UNKNOWN producer kind=' + kind);
        }
    }

    getRemoteIds(clientId, kind) {
        let remoteIds = [];
        if (kind === 'video') {
            for (const key in this.videoProducers) {
                if (key !== clientId) {
                    remoteIds.push(key);
                }
            }
        } else if (kind === 'audio') {
            for (const key in this.audioProducers) {
                if (key !== clientId) {
                    remoteIds.push(key);
                }
            }
        } else if (kind === 'message') {
            for (const key in this.messageProducers) {
                if (key !== clientId) {
                    remoteIds.push(key);
                }
            }
        } else if (kind === 'file') {
            for (const key in this.fileProducers) {
                if (key !== clientId) {
                    remoteIds.push(key);
                }
            }
        }
        return remoteIds;
    }

    addProducer(id, producer, kind) {
        if (kind === 'video') {
            this.videoProducers[id] = producer;
            console.log('room=%s videoProducers count=%d', this.name, Object.keys(this.videoProducers).length);
        } else if (kind === 'audio') {
            this.audioProducers[id] = producer;
            console.log('room=%s videoProducers count=%d', this.name, Object.keys(this.audioProducers).length);
        } else if (kind === 'message') {
            this.messageProducers[id] = producer;
            console.log('room=%s meaageoProducers count=%d', this.name, Object.keys(this.messageProducers).length);
        } else if (kind === 'file') {
            this.fileProducers[id] = producer;
            console.log('room=%s fileProducers count=%d', this.name, Object.keys(this.fileProducers).length);
        } else {
            console.warn('UNKNOWN producer kind=' + kind);
        }
    }

    removeProducer(id, kind) {
        if (kind === 'video') {
            delete this.videoProducers[id];
            console.log('videoProducers count=' + Object.keys(this.videoProducers).length);
        } else if (kind === 'audio') {
            delete this.audioProducers[id];
            console.log('audioProducers count=' + Object.keys(this.audioProducers).length);
        } else if (kind === 'message') {
            delete this.videoProducers[id];
            console.log('messageProducers count=' + Object.keys(this.messageProducers).length);
        } else if (kind === 'audio') {
            delete this.audioProducers[id];
            console.log('fileProducers count=' + Object.keys(this.fileProducers).length);
        } else {
            console.warn('UNKNOWN producer kind=' + kind);
        }
    }

    createConsumer(transport, producer, rtpCapabilities) {
        if (!this.router.canConsume({
                producerId: producer.id,
                rtpCapabilities,
            })) {
            console.error('can not consume');
            return;
        }

        let consumer = null;
        consumer = await transport.consume({ // OK
            producerId: producer.id,
            rtpCapabilities,
            paused: producer.kind === 'video',
        }).catch(err => {
            console.error('consume failed', err);
            return;
        });
        //if (consumer.type === 'simulcast') {
        //  await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 });
        //}
        return {
            consumer: consumer,
            params: {
                producerId: producer.id,
                id: consumer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                type: consumer.type,
                producerPaused: consumer.producerPaused
            }
        };
    }

    createDataConsumer(transport, producer) {
        let consumer = null;
        consumer = await transport.consumeData({ // OK
            dataProducerId: producer.id,
        }).catch(err => {
            console.error('consume failed', err);
            return;
        });

        return {
            consumer: consumer,
            params: {
                producerId: producer.id,
                id: consumer.id,
                label: consumer.label,
                sctpStreamParameters: consumer.sctpStreamParameters,
                type: consumer.type,
                protocol: consumer.protocol
            }
        };
    }
    getConsumerTrasnport(id) {
        return this.consumerTransports[id];
    }

    addConsumerTrasport(id, transport) {
        this.consumerTransports[id] = transport;
        transport.observer.on('close', () => {
            this.removeConsumerSetDeep(id);
            this.removeConsumerTransport(id);
        });
        console.log('room=%s add consumerTransports count=%d', this.name, Object.keys(this.consumerTransports).length);
    }

    connect(id) {
        let transport = this.consumerTransports[id];
        if (!transport) {
            console.error('transport NOT EXIST for id=' + functions.getId(socket));
            return;
        }
        await transport.connect({ dtlsParameters: data.dtlsParameters });
    }
    currentProducer(id) {
        const remoteVideoIds = this.getRemoteIds(id, 'video');
        console.log('-- remoteVideoIds:', remoteVideoIds);
        const remoteAudioIds = this.getRemoteIds(id, 'audio');
        console.log('-- remoteAudioIds:', remoteAudioIds);
        const remoteMessageIds = this.getRemoteIds(id, 'message');
        console.log('-- remoteMessageIds:', remoteMessageIds);
        const remotefileIds = this.getRemoteIds(id, 'file');
        console.log('-- remoteFileIds:', remotefileIds);
        return { remoteVideoIds: remoteVideoIds, remoteAudioIds: remoteAudioIds, remoteMessageIds: remoteMessageIds, remoteFileIds: remotefileIds }
    }
    consumeAdd(data, id) {
        const kind = data.kind;
        console.log('-- consumeAdd -- localId=%s kind=%s', id, kind);

        let transport = this.getConsumerTrasnport(id);
        if (!transport) {
            console.error('transport NOT EXIST for id=' + id);
            return;
        }
        const rtpCapabilities = data.rtpCapabilities;
        const remoteId = data.remoteId;
        console.log('-- consumeAdd - localId=' + id + ' remoteId=' + remoteId + ' kind=' + kind);
        const producer = this.getProducer(remoteId, kind);
        if (!producer) {
            console.error('producer NOT EXIST for remoteId=%s kind=%s', remoteId, kind);
            return;
        }
        const { consumer, params } = await functions.createConsumer(roomName, transport, producer, rtpCapabilities); // producer must exist before consume
        //subscribeConsumer = consumer;
        functions.addConsumer(roomName, localId, remoteId, consumer, kind); // TODO: MUST comination of  local/remote id
        console.log('addConsumer localId=%s, remoteId=%s, kind=%s', localId, remoteId, kind);
        consumer.observer.on('close', () => {
            console.log('consumer closed ---');
        })
        consumer.on('producerclose', () => {
            console.log('consumer -- on.producerclose');
            consumer.close();
            functions.removeConsumer(roomName, localId, remoteId, kind);

            // -- notify to client ---
            socket.emit('producerClosed', { localId: localId, remoteId: remoteId, kind: kind });
        });
    }

    removeConsumerTransport(id) {
        delete this.consumerTransports[id];
        console.log('room=%s remove consumerTransports count=%d', this.name, Object.keys(this.consumerTransports).length);
    }

    getConsumerSet(localId, kind) {
        if (kind === 'video') {
            return this.videoConsumerSets[localId];
        } else if (kind === 'audio') {
            return this.audioConsumerSets[localId];
        } else if (kind === 'message') {
            return this.messageConsumerSets[localId];
        } else if (kind === 'file') {
            return this.fileConsumerSets[localId];
        } else {
            console.warn('WARN: getConsumerSet() UNKNWON kind=%s', kind);
        }
    }

    addConsumerSet(localId, set, kind) {
        if (kind === 'video') {
            this.videoConsumerSets[localId] = set;
        } else if (kind === 'audio') {
            this.audioConsumerSets[localId] = set;
        } else if (kind === 'message') {
            this.messageConsumerSets[localId] = set;
        } else if (kind === 'file') {
            this.fileConsumerSets[localId] = set;
        } else {
            console.warn('WARN: addConsumerSet() UNKNWON kind=%s', kind);
        }
    }

    removeConsumerSetDeep(localId) {
        const videoSet = this.getConsumerSet(localId, 'video');
        delete this.videoConsumerSets[localId];
        if (videoSet) {
            for (const key in videoSet) {
                const consumer = videoSet[key];
                consumer.close();
                delete videoSet[key];
            }

            console.log('room=%s removeConsumerSetDeep video consumers count=%d', this.name, Object.keys(videoSet).length);
        }

        const audioSet = this.getConsumerSet(localId, 'audio');
        delete this.audioConsumerSets[localId];
        if (audioSet) {
            for (const key in audioSet) {
                const consumer = audioSet[key];
                consumer.close();
                delete audioSet[key];
            }

            console.log('room=%s removeConsumerSetDeep audio consumers count=%d', this.name, Object.keys(audioSet).length);
        }

        const messageSet = this.getConsumerSet(localId, 'message');
        delete this.messageConsumerSets[localId];
        if (messageSet) {
            for (const key in messageSet) {
                const consumer = messageSet[key];
                consumer.close();
                delete messageSet[key];
            }

            console.log('room=%s removeConsumerSetDeep message consumers count=%d', this.name, Object.keys(messageSet).length);
        }

        const fileSet = this.getConsumerSet(localId, 'file');
        delete this.fileConsumerSets[localId];
        if (fileSet) {
            for (const key in fileSet) {
                const consumer = fileSet[key];
                consumer.close();
                delete fileSet[key];
            }

            console.log('room=%s removeConsumerSetDeep file consumers count=%d', this.name, Object.keys(fileSet).length);
        }
    }

    getConsumer(localId, remoteId, kind) {
        const set = this.getConsumerSet(localId, kind);
        if (set) {
            return set[remoteId];
        } else {
            return null;
        }
    }


    addConsumer(localId, remoteId, consumer, kind) {
        const set = this.getConsumerSet(localId, kind);
        if (set) {
            set[remoteId] = consumer;
            console.log('room=%s consumers kind=%s count=%d', this.name, kind, Object.keys(set).length);
        } else {
            console.log('room=%s new set for kind=%s, localId=%s', this.name, kind, localId);
            const newSet = {};
            newSet[remoteId] = consumer;
            this.addConsumerSet(localId, newSet, kind);
            console.log('room=%s consumers kind=%s count=%d', this.name, kind, Object.keys(newSet).length);
        }
    }

    removeConsumer(localId, remoteId, kind) {
        const set = this.getConsumerSet(localId, kind);
        if (set) {
            delete set[remoteId];
            console.log('room=%s consumers kind=%s count=%d', this.name, kind, Object.keys(set).length);
        } else {
            console.log('NO set for room=%s kind=%s, localId=%s', this.name, kind, localId);
        }
    }

    // --- static methtod ---
    static staticInit() {
        rooms = {};
    }

    static addRoom(room, name) {
        Room.rooms[name] = room;
        console.log('static addRoom. name=%s', room.name);
        //console.log('static addRoom. name=%s, rooms:%O', room.name, room);
    }

    static getRoom(name) {
        return Room.rooms[name];
    }

    static removeRoom(name) {
        delete Room.rooms[name];
    }
}

Room.rooms = {};
exports.cleanUpPeer = function(roomname, socket) {
    const id = getId(socket);
    removeConsumerSetDeep(roomname, id);
    const room = Room.getRoom(roomname);
    const transport = room.getConsumerTrasnport(id);
    if (transport) {
        transport.close();
        room.removeConsumerTransport(id);
    }

    const videoProducer = room.getProducer(id, 'video');
    if (videoProducer) {
        videoProducer.close();
        room.removeProducer(id, 'video');
    }
    const audioProducer = room.getProducer(id, 'audio');
    if (audioProducer) {
        audioProducer.close();
        room.removeProducer(id, 'audio');
    }

    const producerTransport = room.getProducerTrasnport(roomname, id);
    if (producerTransport) {
        producerTransport.close();
        room.removeProducerTransport(id);
    }
}
exports.sendResponse = function(response, callback) {
    callback(null, response);
}
exports.sendReject = function(error, callback) {
    callback(error.toString(), null);
}
exports.sendback = function(socket, message) {
    socket.emit('message', message);
}
exports.setRoomname = function(room) {
    socket.roomname = room;
}
exports.getRoomname = function() {
    const room = socket.roomname;
    return room;
}
exports.getId = function(socket) {
    return socket.id;
}
const getId = function(socket) {
    return socket.id;
}

exports.getClientCount = function(io) {
    // WARN: undocumented method to get clients number
    return io.eio.clientsCount;
}

exports.record = function(roomId) {
    const router = Room.rooms[roomId].router;
    const transport = router.createPlainTransport({ ip: '127.0.0.1', port: 3030 })
    consume = transport.consume
}

async function setupRoom(name, host) {
    const room = new Room(name);
    const mediaCodecs = mediasoupOptions.router.mediaCodecs;
    const router = await worker.createRouter({ mediaCodecs });
    router.roomname = name;

    router.observer.on('close', () => {
        console.log('-- router closed. room=%s', name);
    });
    router.observer.on('newtransport', transport => {
        console.log('-- router newtransport. room=%s', name);
    });
    room.host = host;
    room.router = router;
    const audioLevelObserver = await router.createAudioLevelObserver({
        maxEntries: 1,
        threshold: -70,
        interval: 2000
    });
    audioLevelObserver.on("volumes", async(volumes) => {
        // const key = Object.keys(room.audioProducers)[Object.values(room.audioProducers).indexOf(volumes[0].producer)];
        // const videoProducer = room.videoProducers[key];
        // if (room.resumedProducer) {
        //     room.resumedProducer.pause()
        //     room.resumedProducer = videoProducer;
        //     room.resumedProducer.resume();
        // } else {
        //     console.log("else")
        //     room.resumedProducer = videoProducer;
        //     //room.resumedProducer.resume();
        // }
    })
    room.audioLevelObserver = audioLevelObserver;
    Room.addRoom(room, name);
    return room;
}

function h264Enabled(router) {
    const codec = router.rtpCapabilities.codecs.find(
        (c) => c.mimeType === "video/H264"
    );
    return codec !== undefined;
}
exports.startRecording = async function(roomId, id) {
    const router = Room.rooms[roomId].router;
    const room = Room.getRoom(roomId)
    const useAudio = true
    const useVideo = true

    // Start mediasoup's RTP consumer(s)

    if (useAudio) {
        console.log("First Plain transport")
        const rtpTransport = await router.createPlainTransport(mediasoupOptions.plainTransport);
        room.audioTransport = rtpTransport;
        console.log("First Plain connect")
        await rtpTransport.connect({
            ip: mediasoupOptions.recording.ip,
            port: mediasoupOptions.recording.audioPort,
            rtcpPort: mediasoupOptions.recording.audioPortRtcp,
        });

        console.log("mediasoup AUDIO RTP SEND transport connected: %s:%d <--> %s:%d (%s)", rtpTransport.tuple.localIp, rtpTransport.tuple.localPort, rtpTransport.tuple.remoteIp, rtpTransport.tuple.remotePort, rtpTransport.tuple.protocol);

        console.log("mediasoup AUDIO RTCP SEND transport connected: %s:%d <--> %s:%d (%s)", rtpTransport.rtcpTuple.localIp, rtpTransport.rtcpTuple.localPort, rtpTransport.rtcpTuple.remoteIp, rtpTransport.rtcpTuple.remotePort, rtpTransport.rtcpTuple.protocol);
        const audioProducer = room.getProducer(id, 'audio');
        console.log("First Plain consumer")
        const rtpConsumer = await rtpTransport.consume({
            producerId: audioProducer.id,
            rtpCapabilities: router.rtpCapabilities, // Assume the recorder supports same formats as mediasoup's router
            paused: true,
        });
        room.audioConsumer = rtpConsumer;

        console.log("mediasoup AUDIO RTP SEND consumer created, kind: %s, type: %s, paused: %s, SSRC: %s CNAME: %s", rtpConsumer.kind, rtpConsumer.type, rtpConsumer.paused, rtpConsumer.rtpParameters.encodings[0].ssrc, rtpConsumer.rtpParameters.rtcp.cname);
    }

    if (useVideo) {
        console.log("Second Plain transport")
        const rtpTransport = await router.createPlainTransport(mediasoupOptions.plainTransport);
        room.videoTransport = rtpTransport;
        console.log("Second Plain connect")
        await rtpTransport.connect({
            ip: mediasoupOptions.recording.ip,
            port: mediasoupOptions.recording.videoPort,
            rtcpPort: mediasoupOptions.recording.videoPortRtcp,
        });

        console.log(
            "mediasoup VIDEO RTP SEND transport connected: %s:%d <--> %s:%d (%s)",
            rtpTransport.tuple.localIp, rtpTransport.tuple.localPort, rtpTransport.tuple.remoteIp, rtpTransport.tuple.remotePort, rtpTransport.tuple.protocol
        );

        console.log(
            "mediasoup VIDEO RTCP SEND transport connected: %s:%d <--> %s:%d (%s)",
            rtpTransport.rtcpTuple.localIp, rtpTransport.rtcpTuple.localPort, rtpTransport.rtcpTuple.remoteIp, rtpTransport.rtcpTuple.remotePort, rtpTransport.rtcpTuple.protocol
        );
        const videoProducer = room.getProducer(id, 'video');
        console.log("Second Plain consumer")
        const rtpConsumer = await rtpTransport.consume({
            producerId: videoProducer.id,
            rtpCapabilities: router.rtpCapabilities, // Assume the recorder supports same formats as mediasoup's router
            paused: true,
        });
        room.videoConsumer = rtpConsumer;

        console.log("mediasoup VIDEO RTP SEND consumer created, kind: %s, type: %s, paused: %s, SSRC: %s CNAME: %s", rtpConsumer.kind, rtpConsumer.type, rtpConsumer.paused, rtpConsumer.rtpParameters.encodings[0].ssrc, rtpConsumer.rtpParameters.rtcp.cname);
    }

    // ----
    await startRecordingFfmpeg(roomId, router);
    //==========


    if (useAudio) {
        const consumer = room.audioConsumer;
        console.log(
            "Resume mediasoup RTP consumer, kind: %s, type: %s",
            consumer.kind,
            consumer.type
        );
        consumer.resume();
    }
    if (useVideo) {
        const consumer = room.videoConsumer;
        console.log(
            "Resume mediasoup RTP consumer, kind: %s, type: %s",
            consumer.kind,
            consumer.type
        );
        consumer.resume();
    }
}

function startRecordingFfmpeg(roomId, router) {
    // Return a Promise that can be awaited
    let recResolve;
    const promise = new Promise((res, _rej) => {
        recResolve = res;
    });

    const useAudio = true
    const useVideo = true
    const useH264 = h264Enabled(router);

    //const cmdProgram = "ffmpeg"; // Found through $PATH
    const cmdProgram = FFmpegStatic; // From package "ffmpeg-static"

    let cmdInputPath = `${__dirname}/recording/input-vp8.sdp`;
    let cmdOutputPath = `${__dirname}/recording/${roomId}.webm`;
    let cmdCodec = "";
    let cmdFormat = "-f webm -flags +global_header";

    // Ensure correct FFmpeg version is installed
    const ffmpegOut = Process.execSync(cmdProgram + " -version", {
        encoding: "utf8",
    });
    const ffmpegVerMatch = /ffmpeg version (\d+)\.(\d+)/.exec(ffmpegOut);
    let ffmpegOk = false;
    if (ffmpegOut.startsWith("ffmpeg version git")) {
        // Accept any Git build (it's up to the developer to ensure that a recent
        // enough version of the FFmpeg source code has been built)
        ffmpegOk = true;
    } else if (ffmpegVerMatch) {

        const ffmpegVerMajor = parseInt(ffmpegVerMatch[1], 10);
        if (ffmpegVerMajor >= 4) {
            ffmpegOk = true;
        }
    }

    if (!ffmpegOk) {
        console.error("FFmpeg >= 4.0.0 not found in $PATH; please install it");
        console.log(ffmpegOut);
        process.exit(1);
    }

    if (useAudio) {
        cmdCodec += " -map 0:a:0 -c:a copy";
    }
    if (useVideo) {
        cmdCodec += " -map 0:v:0 -c:v copy";

        if (useH264) {
            cmdInputPath = `${__dirname}/recording/input-h264.sdp`;
            cmdOutputPath = `${__dirname}/recording/output-ffmpeg-h264.mp4`;

            cmdFormat = "-f mp4 -strict experimental";
        }
    }

    // Run process
    const cmdArgStr = [
            "-nostdin",
            "-protocol_whitelist file,rtp,udp",
            "-fflags +genpts",
            `-i ${cmdInputPath}`,
            cmdCodec,
            cmdFormat,
            `-y ${cmdOutputPath}`,
        ]
        .join(" ")
        .trim();

    console.log(`Run command: ${cmdProgram} ${cmdArgStr}`);

    let recProcess = Process.spawn(cmdProgram, cmdArgStr.split(/\s+/));
    mediasoupOptions.recProcess = recProcess;

    recProcess.on("error", (err) => {
        console.error("Recording process error:", err);
    });

    recProcess.on("exit", (code, signal) => {
        console.log("Recording process exit, code: %d, signal: %s", code, signal);

        mediasoupOptions.recProcess = null;
        stopMediasoupRtp(roomId);

        if (!signal || signal === "SIGINT") {
            console.log("Recording stopped");
        } else {
            console.warn(
                "Recording process didn't exit cleanly, output file might be corrupt"
            );
        }
    });

    // FFmpeg writes its logs to stderr
    recProcess.stderr.on("data", (chunk) => {
        chunk.toString()
            .split(/\r?\n/g)
            .filter(Boolean)
            .forEach((line) => {
                console.log(line);
                if (line.startsWith("ffmpeg version")) {
                    setTimeout(() => {
                        recResolve();
                    }, 1000);
                }
            });
    });

    return promise;
}

exports.stopRecording = async function(roomId) {
    if (mediasoupOptions.recProcess) {
        mediasoupOptions.recProcess.kill("SIGINT");
    } else {
        stopMediasoupRtp(roomId);
    }
}

function stopMediasoupRtp(roomId) {
    console.log("Stop mediasoup RTP transport and consumer");
    const room = Room.getRoom(roomId)

    if (room.audioConsumer) {
        room.audioConsumer.close();
        room.audioTransport.close();
    }

    if (room.videoConsumer) {
        room.videoConsumer.close();
        room.videoTransport.close();
    }
}