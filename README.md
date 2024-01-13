# PGP chat
simple chat using websocket, secured end to end using PGP encryption. 

# Usage
requires ws and openpgp package in nodejs, install them and then run ws.js
- change the ip and port to the ws server. Default port used is 8088.
- open wstest.html on a browser and make sure js is enabled
- click start to initiate a connection
- connect multiple clients (different browsers, different device on the same local network will work too)
- start chatting
- if needed, you can delete the current key pair used and generate a new one

# Info
- this app generates pgp keys individually, locally and on the server. slower harddware may take much longer to generate
- pgp keys are stored in the session. clearing cookies will clear the keys and requires generating a new one
- public keys stored on the server for each client are deleted when said client disconnects.
