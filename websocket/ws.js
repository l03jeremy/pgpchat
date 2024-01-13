const WebSocket = require('ws');
const openpgp = require('openpgp');

const wss = new WebSocket.Server({ port: 8088 });

const pubkeys = new Map();

function isJson(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}
function msgjson(content) {
    return JSON.stringify({"type" : "message", "content" : content});
}

wss.getUniqueID = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4();
};

wss.on("listening", () => {
    console.log("Listening")
})

wss.on('connection', (ws, req) => {
  ws.id = wss.getUniqueID();
  let serverprivkey;
  var clientid = ws.id;
  ws.on('message', (omessage) => {
    (async () => {
        if(isJson(omessage)) {
            if(JSON.parse(omessage).type == "keyexchange") {
                let clientpubkey = JSON.parse(omessage).pubkey;
                pubkeys.set(ws.id, clientpubkey);
                const {privateKey, publicKey} = await openpgp.generateKey({
                    userIDs: [{ name: 'server', email: 'serverkey@nottgh.xyz' }],
                    type: 'rsa',
                    format: 'armored',
                    date: new Date(Date.now() - 3600000)
                });
                //console.log("Generated key pair");
                serverprivkey = privateKey;
                //console.log(serverprivkey);
                var escapestring = publicKey.replace(/\\n/g, "\\n")
                .replace(/\\'/g, "\\'")
                .replace(/\\"/g, '\\"')
                .replace(/\\&/g, "\\&")
                .replace(/\\r/g, "\\r")
                .replace(/\\t/g, "\\t")
                .replace(/\\b/g, "\\b")
                .replace(/\\f/g, "\\f");
                var jsonmsg = JSON.stringify({"pubkey" : escapestring, "clientid" : ws.id, "type": "keyexchange"});
                
                const pgpmsg = await openpgp.encrypt({
                    message: await openpgp.createMessage({ text: jsonmsg }), // input as Message object
                    encryptionKeys: await openpgp.readKey({ armoredKey: clientpubkey }),
                    //signingKeys: privateKey // optional
                });
                //ws.send(pgpmsg);
                wss.clients.forEach(async (client) => {
                    //var jsonmsg = JSON.stringify({"type" : "message", "content" : `Server: ${ws.id == client.id? "You":clientid} joined, ${wss.clients.size} in room`});
                    const pgpmsg = await openpgp.encrypt({
                        message: await openpgp.createMessage({ text: msgjson(`Server: ${ws.id == client.id? "You":clientid} joined, ${wss.clients.size} in room`) }).catch(console.log), // input as Message object
                        encryptionKeys: await openpgp.readKey({ armoredKey: pubkeys.get(client.id) }).catch(console.log),
                        //signingKeys: privateKey // optional
                    }).catch((e) => {
                        console.log(e);
                    });
                    client.send(pgpmsg);
                })
                ws.send(pgpmsg);
            } else {
                ws.send("Unknown type");
            }
            
        } else {
            //ws.send("Error: content is not a json");
            //let rmessage = JSON.parse(omessage).content;
            const privateKey = await openpgp.readPrivateKey({
                armoredKey: serverprivkey
            }).catch((e) => {
                console.log(e);
            });
            //console.log(omessage.toString());
            const message = await openpgp.readMessage({
                armoredMessage: omessage.toString() // parse armored message
            }).catch((e) => {
                console.log(e);
            });
            /*const result = await openpgp.decrypt({
                message,
                decryptionKeys: privateKey
            }).then(async (r) => {
                
            }).catch((e) => {
                console.log(e);
            });*/
            const result = await openpgp.decrypt({
                message,
                decryptionKeys: privateKey
            }).catch((e) => {
                console.log(e);
            });
            var dmessage = JSON.parse(result.data);
            switch(dmessage.type) {
                /*case "keyexchange": {
                    break;
                }*/
                case "message": {
                    try {
                        wss.clients.forEach(async (client) => {
                            //var jsonmsg = JSON.stringify({"type" : "message", "content" : `${ws.id == client.id? "You": clientid} : ${r.data.replace(/ /g, '\u00a0').replace(/</g,'&lt;').replace(/>/g,'&gt;')}`});
                            const pgpmsg = await openpgp.encrypt({
                                message: await openpgp.createMessage({ text: msgjson(`${ws.id == client.id? "You": clientid} : ${dmessage.content.replace(/ /g, '\u00a0').replace(/</g,'&lt;').replace(/>/g,'&gt;')}`) }).catch(console.log), // input as Message object
                                encryptionKeys: await openpgp.readKey({ armoredKey: pubkeys.get(client.id) }).catch(console.log),
                                //signingKeys: privateKey // optional
                            }).catch((e) => {
                                console.log(e);
                            });
                            client.send(pgpmsg);
                        })
                    } catch(e) {
                        ws.send("Error: " + e.message);
                    }
                    break;
                }
                default: {
                    console.log("default");
                }
            }
        }
    })();
  });

  ws.on('close', () => {

    wss.clients.forEach(async (client) => {
        const pgpmsg = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: msgjson(`Server: ${clientid} disconnected, ${wss.clients.size} in room`) }).catch(console.log), // input as Message object
            encryptionKeys: await openpgp.readKey({ armoredKey: pubkeys.get(client.id) }).catch(console.log),
            //signingKeys: privateKey // optional
        }).catch((e) => {
            console.log(e);
        });
        client.send(pgpmsg);
    });
    pubkeys.delete(clientid);
  });
  ws.on('error', (e) => {
    console.log("Error: " + e);
  })
});