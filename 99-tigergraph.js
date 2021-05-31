
module.exports = function(RED) {
    "use strict";
    var reconnect = RED.settings.tigergraphReconnectTime || 3000;
    var tgs = require("./tgdroid.js");

    function TigerGraphNode(n) {
        RED.nodes.createNode(this,n);
        this.host = n.host;
        this.port = n.port;
        this.secret = n.secret;

        // Vertex et List
        
        

        this.cert = n.cert;
        this.connected = false;
        this.connecting = false;

        this.graph = n.graph;
        this.setMaxListeners(0);
        var node = this;

        function checkVer() {
            node.pool.version();
        }

        function doConnect() {
            node.connecting = true;
            node.emit("state","connecting");
            if (!node.pool) {
                // node.vertex,node.inList,node.outList
                node.pool = new tgs(node.host,node.graph,node.credentials.user,node.credentials.password,node.secret,"",n.cert ); // ToDo : Cert
                if (node.pool.TOKEN == ''){
                    let res =  node.pool.getToken();
                    res.then(function(result) {
                        node.pool.TOKEN = result;
                    })
                }
            }

            let res=  node.pool.echo();
            res.then(function(result) {
                let err = result["error"];
                node.connecting = false;
                if (err) {
                    node.emit("state",err.code);
                    node.error(err);
                    node.tick = setTimeout(doConnect, reconnect);
                } else {
                    node.connection = node.pool;
                    node.connected = true;
                    node.emit("state","connected");
                    if (!node.check) { node.check = setInterval(checkVer, 290000); }
                }

             })
            
         
        }

        this.connect = function() {
            if (!this.connected && !this.connecting) {
                doConnect();
            }
        }

        this.on('close', function (done) {
            if (this.tick) { clearTimeout(this.tick); }
            if (this.check) { clearInterval(this.check); }
            node.connected = false;
            node.connection.release();
            node.emit("state"," ");
            node.pool.end(function (err) { done(); });
        });
    }
    RED.nodes.registerType("TigerGraphDatabase",TigerGraphNode, {
        credentials: {
            user: {type: "text"},
            password: {type: "password"}
        }
    });


    function TigerGraphQuery(n) {
        RED.nodes.createNode(this,n);
        this.graph = n.graph;
        this.graphConfig = RED.nodes.getNode(this.graph);

        this.query = n.query;
        this.params = n.params;
        this.vals = n.vals;


        this.status({});

        if (this.graphConfig) {
            this.graphConfig.connect();
            var node = this;
            var busy = false;
            var status = {};
            node.graphConfig.on("state", function(info) {
                
                if (info === "connecting") { node.status({fill:"grey",shape:"ring",text:info}); }
                else if (info === "connected") { node.status({fill:"green",shape:"dot",text:info}); }
                else {
                    if (info === "ECONNREFUSED") { info = "connection refused"; }
                    if (info === "PROTOCOL_CONNECTION_LOST") { info = "connection lost"; }
                    node.status({fill:"red",shape:"ring",text:info});
                }
            });

            node.on("input", function(msg) {
                if (node.graphConfig.connected) {
                    try { 
                            var objs = {}
                            if (typeof this.params !== 'undefined'){
                            var paramsList = JSON.parse(this.params); // graphConfig.
                            var valsList = JSON.parse(this.vals); // graphConfig.
                            paramsList.forEach(element => { 
                                objs[element] = valsList[paramsList.indexOf(element)];
                              }); 
                            
                            }
                            let resQuery = node.graphConfig.connection.runQuery(this.query,objs)
                            resQuery.then(function(result) {
                                let err = result["error"];
                                if (err) {
                                    status = {fill:"red",shape:"ring",text:"Error: "+ result["message"]};
                                    node.status(status);
                                    // node.error(err,msg);
                                    node.send(msg);
                                }
                                else {
                                    msg["output"] = result;
                                    node.send(msg);
                                    status = {fill:"green",shape:"dot",text:"OK"};
                                    node.status(status);
                                }
                        })
                    }
                    catch(e) {
                    console.log(e);
                       node.error("V0.1 : Exception"); 
                    }
                }
                else {
                    node.error("Database not connected",msg);
                    status = {fill:"red",shape:"ring",text:"not yet connected"};
                }
                if (!busy) {
                    busy = true;
                    node.status(status);
                    node.tout = setTimeout(function() { busy = false; node.status(status); },500);
                }
            });

            node.on('close', function () {
                if (node.tout) { clearTimeout(node.tout); }
                node.graphConfig.removeAllListeners();
                node.status({});
            });
        }
        else {
            this.error("TigerGraph not configured");
        }
    }

    
    function TigerGraphGSQL(n) {
        RED.nodes.createNode(this,n);
        this.graph = n.graph;
        this.graphConfig = RED.nodes.getNode(this.graph);

        this.gsql = n.gsql;
        this.gsPort = n.gsPort;
        this.endpoint = n.endpoint;


        this.status({});

        if (this.graphConfig) {
            this.graphConfig.connect();
            var node = this;
            var busy = false;
            var status = {};
            node.graphConfig.on("state", function(info) {
                
                if (info === "connecting") { node.status({fill:"grey",shape:"ring",text:info}); }
                else if (info === "connected") { node.status({fill:"green",shape:"dot",text:info}); }
                else {
                    if (info === "ECONNREFUSED") { info = "connection refused"; }
                    if (info === "PROTOCOL_CONNECTION_LOST") { info = "connection lost"; }
                    node.status({fill:"red",shape:"ring",text:info});
                }
            });
            node.on("input", function(msg) {
                if (node.graphConfig.connected) {
                    try { 
                            let resGsql = node.graphConfig.connection.runGSQL(this.gsql, this.gsPort, this.endpoint)
                            resGsql.then(function(result) {
                                let err = result["error"];
                                if (err) {
                                    status = {fill:"red",shape:"ring",text:"Error: "+ result["message"]};
                                    node.status(status);
                                    // node.error(err,msg);
                                    node.send(msg);
                                }
                                else {
                                    msg["output"] = result;
                                    node.send(msg);
                                    status = {fill:"green",shape:"dot",text:"OK"};
                                    node.status(status);
                                }
                        })
                    }
                    catch(e) {
                    console.log(e);
                       node.error("V0.1 : Exception"); 
                    }
                }
                else {
                    node.error("Database not connected",msg);
                    status = {fill:"red",shape:"ring",text:"not yet connected"};
                }
                if (!busy) {
                    busy = true;
                    node.status(status);
                    node.tout = setTimeout(function() { busy = false; node.status(status); },500);
                }
            });

            node.on('close', function () {
                if (node.tout) { clearTimeout(node.tout); }
                node.graphConfig.removeAllListeners();
                node.status({});
            });
        }
        else {
            this.error("TigerGraph not configured");
        }
    }
    

    function TigerGraphVertex(n) {
        RED.nodes.createNode(this,n);
        this.graph = n.graph;
        this.graphConfig = RED.nodes.getNode(this.graph);

        this.vertex = n.vertex;
        this.inList = n.inList;
        this.outList = n.outList;


        this.status({});

        if (this.graphConfig) {
            this.graphConfig.connect();
            var node = this;
            var busy = false;
            var status = {};
            node.graphConfig.on("state", function(info) {
                
                if (info === "connecting") { node.status({fill:"grey",shape:"ring",text:info}); }
                else if (info === "connected") { node.status({fill:"green",shape:"dot",text:info}); }
                else {
                    if (info === "ECONNREFUSED") { info = "connection refused"; }
                    if (info === "PROTOCOL_CONNECTION_LOST") { info = "connection lost"; }
                    node.status({fill:"red",shape:"ring",text:info});
                }
            });

            node.on("input", function(msg) {
                if (node.graphConfig.connected) {
                    try { 
                            var objs = {}
                            var inputList = JSON.parse(this.inList); // graphConfig.
                            var OutputList = JSON.parse(this.outList); // graphConfig.
                            inputList.forEach(element => { 
                                objs[element] = {"value":escape(String(msg[OutputList[inputList.indexOf(element)]]))};
                              }); 

                            let res1 = node.graphConfig.connection.upsertVertex(this.vertex,String(msg[inputList[0]]), objs)
                            res1.then(function(result) {
                                let err = result["error"];
                                console.log("++++++++++++++*******+++++++++++");
                                console.log(objs);
                                console.log(result);
                                console.log("++++++++++++++*******+++++++++++");
                                if (err) {
                                    status = {fill:"red",shape:"ring",text:"Error: "+ result["message"]};
                                    node.status(status);
                                    // node.error(err,msg);
                                    node.send(msg);
                                }
                                else {
                                    node.send(msg);
                                    status = {fill:"green",shape:"dot",text:"OK"};
                                    node.status(status);
                                }
                        })
                    }
                    catch(e) {
                       node.error("V0.1 : Exception"); 
                    }
                }
                else {
                    node.error("Database not connected",msg);
                    status = {fill:"red",shape:"ring",text:"not yet connected"};
                }
                if (!busy) {
                    busy = true;
                    node.status(status);
                    node.tout = setTimeout(function() { busy = false; node.status(status); },500);
                }
            });

            node.on('close', function () {
                if (node.tout) { clearTimeout(node.tout); }
                node.graphConfig.removeAllListeners();
                node.status({});
            });
        }
        else {
            this.error("TigerGraph not configured");
        }
    }
    

    function TigerGraphEdge(n) {
        RED.nodes.createNode(this,n);
        this.graph = n.graph;
        this.graphConfig = RED.nodes.getNode(this.graph);

        this.vertexSource = n.vertexSource;
        this.vertexDestination = n.vertexDestination;
        this.edge = n.edge
        this.inList = n.inList;
        this.outList = n.outList;


        this.status({});

        if (this.graphConfig) {
            this.graphConfig.connect();
            var node = this;
            var busy = false;
            var status = {};
            node.graphConfig.on("state", function(info) {
                
                if (info === "connecting") { node.status({fill:"grey",shape:"ring",text:info}); }
                else if (info === "connected") { node.status({fill:"green",shape:"dot",text:info}); }
                else {
                    if (info === "ECONNREFUSED") { info = "connection refused"; }
                    if (info === "PROTOCOL_CONNECTION_LOST") { info = "connection lost"; }
                    node.status({fill:"red",shape:"ring",text:info});
                }
            });

            node.on("input", function(msg) {
                if (node.graphConfig.connected) {
                    try { 

                            var objs = {}
                            var inputList = JSON.parse(this.inList); // graphConfig.
                            var OutputList = JSON.parse(this.outList); // graphConfig.

                            inputList.forEach(element => { 
                                objs[element] = {"value":escape(String(msg[OutputList[inputList.indexOf(element)]]))};
                              }); 


                              
                            let res1 = node.graphConfig.connection.upsertEdge(this.vertexSource,objs[inputList[0]]["value"],this.edge,this.vertexDestination,objs[inputList[1]]["value"] )
                            res1.then(function(result) {
                                let err = result["error"];
                                if (err) {
                                    status = {fill:"red",shape:"ring",text:"Error: "+ result["message"]};
                                    node.status(status);
                                    // node.error(err,msg);
                                    node.send(msg);
                                }
                                else {
                                    node.send(msg);
                                    status = {fill:"green",shape:"dot",text:"OK"};
                                    node.status(status);
                                }
                        })
                    }
                    catch(e) {
                       node.error("V0.1 : Exception in Edge"); 
                    }
                }
                else {
                    node.error("Database not connected",msg);
                    status = {fill:"red",shape:"ring",text:"not yet connected"};
                }
                if (!busy) {
                    busy = true;
                    node.status(status);
                    node.tout = setTimeout(function() { busy = false; node.status(status); },500);
                }
            });

            node.on('close', function () {
                if (node.tout) { clearTimeout(node.tout); }
                node.graphConfig.removeAllListeners();
                node.status({});
            });
        }
        else {
            this.error("TigerGraph not configured");
        }
    }
    RED.nodes.registerType("TigerGraphVertex",TigerGraphVertex);
    RED.nodes.registerType("TigerGraphQuery",TigerGraphQuery);
    RED.nodes.registerType("TigerGraphEdge",TigerGraphEdge);
    RED.nodes.registerType("TigerGraphGSQL",TigerGraphGSQL);
    
}
