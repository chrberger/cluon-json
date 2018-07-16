/*
Copyright (c) 2018  Christian Berger <christian.berger@gu.se>

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
*/

// Get data from OD4Session: curl http://localhost:3000
// Send data to OD4Session: curl -X POST -d 'dataType=2222&senderStamp=0&message={"text":"test reply from curl","number":123}' http://localhost:3000/sendToOD4Session

const fs = require('fs');
const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');
const libcluon = require('./libcluon-0.0.104');

var g_receivedMessage = "";
var g_libcluon = libcluon();
const g_app = express();

// Load data from message specification.
try {
    var odvdMessageSpecificationFile = fs.readFileSync(__dirname + '/example.odvd', 'utf-8');
    console.log("Loaded " + g_libcluon.setMessageSpecification(odvdMessageSpecificationFile) + " messages from specification.");
}
catch(e) {
    console.log('Error:', e.stack);
}

// Get connection to OD4Session's websocket bridge.
var g_ws = new WebSocket("ws://localhost:8082/", "od4");
g_ws.binaryType = 'arraybuffer';

// Decode incoming Envelopes.
g_ws.on('message', function incoming(data) {
    g_receivedMessage = JSON.parse(g_libcluon.decodeEnvelopeToJSON(data));
});

g_app.use(bodyParser.urlencoded({ extended: false }));
g_app.use(bodyParser.json());
g_app.post('/sendToOD4Session', function(req, res) {
    console.log('dataType=',req.body.dataType);
    console.log('senderStamp=',req.body.senderStamp);
    console.log('message=',req.body.messageAsJSON);

    // Transform JSON response into binary Protobuf-encoded data...
    const MESSAGE_ID = parseInt(req.body.dataType, 10);
    const SENDER_STAMP = parseInt(req.body.senderStamp, 10);

    var replyInProtobuf = g_libcluon.encodeEnvelopeFromJSONWithoutTimeStamps(req.body.messageAsJSON, MESSAGE_ID, SENDER_STAMP);
    if (replyInProtobuf.length > 0) {
        // convert into uint8 array buffer...
        strToAB = str =>
         new Uint8Array(str.split('')
           .map(c => c.charCodeAt(0))).buffer;

        // and send via the websocket.
        var d = strToAB(replyInProtobuf);
        g_ws.send(d, { binary: true });

        res.send("OK");
    }
    else {
        res.send("Failed: Protobuf object could not be created.");
    }
});

g_app.get('/', (request, response) => response.send(g_receivedMessage));

g_app.listen(3000, () => console.log('Listening on port 3000'));

