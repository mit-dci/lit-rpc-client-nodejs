import * as litrpc from './litrpc';
import WebSocket from 'ws';

enum ListeningStatus {
    Unknown = 0,
    Listening,
    NotListening,
}

class LitClient {
    private rpccon? : WebSocket;
    private callbacks : Map<number, {resolve: (value:any) => void, reject: (reason:any) => void}>;
    private requestNonce : number = 0;

    private listeningStatus : ListeningStatus = ListeningStatus.Unknown;
    /**
     * Constructs a new LitClient
     * @param host The RPC host to connect to (default: localhost)
     * @param port The RPC port to connect to (default: 8001)
     */
    constructor(private host : string = "localhost", private port : number = 8001) {
        this.callbacks = new Map<number, {resolve: (value:any) => void, reject: (reason:any) => void}>();
    }

    /**
     * Connects to the LIT node
     */
    open() : Promise<void> {
        return new Promise((resolve, reject) => {

            this.rpccon = new WebSocket('ws://' + this.host + ':' + this.port + '/ws', 'echo-protocol', { origin: "http://localhost/" })    
            this.rpccon.onopen = () => {
                resolve();
            }
            this.rpccon.onerror = (error) => {
                reject(error);
            }
            this.rpccon.onmessage = (message) => {
                let data = JSON.parse(message.data.toString());
                let callback = this.callbacks.get(data.id);
                if(callback === undefined) {
                    return;
                }
                if(data.error !== null) {
                    callback.reject(data.error);
                } else {
                    callback.resolve(data.result);
                }
                this.callbacks.delete(data.id);
            }
            
        });        
    }

    /**
     * Disconnects from the LIT node
     */
    close() : Promise<void> {
        return new Promise((resolve, reject) => {
            if(this.rpccon === undefined) {
                reject(new Error("Connection not open. Open connection first using open()"))
                return;
            }

            this.rpccon.onclose = () => {
                resolve();
            }
            this.rpccon.onerror = (error) => {
                reject(error);
            }

            this.rpccon.close();
        });
    }

    /**
     * Instructs LIT to listen for incoming connections. By default, LIT will not
     * listen. If LIT was already listening for incoming connections, this method 
     * will just resolve.
     * @param port The port number to listen on (default: 2448)
     * @returns True on success, false on failure
     */
    listen(port : number = 2448) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.ListenArgs();
            args.Port = ":" + port.toString();
            this.call<litrpc.ListenArgs,litrpc.ListeningPortsReply>("LitRPC.Listen", args)
            .catch((reason) => { 
                if(reason.indexOf('bind: address already in use') == -1) {
                    reject(reason)
                }
            })
            .then((reply) => {
                this.listeningStatus = ListeningStatus.Listening;
                resolve();
            });
        });
    }

    /**
     * Checks if LIT is currently listening on any port.
     * @returns true when listening, false when not listening
     */
    isListening() : Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            if(this.listeningStatus !== ListeningStatus.Unknown) { 
                resolve(this.listeningStatus === ListeningStatus.Listening);
                return;
            }

            this.call<litrpc.NoArgs,litrpc.ListeningPortsReply>("LitRPC.GetListeningPorts", {})
            .catch((reason) => { 
                reject(reason)
            })
            .then((reply) => {
                reply = reply as litrpc.ListeningPortsReply;
                this.listeningStatus = (reply.LisIpPorts === null) ? ListeningStatus.NotListening : ListeningStatus.Listening;
                resolve(this.listeningStatus === ListeningStatus.Listening);
            });
        });
    }

    /**
     * Returns the LN address for this node
     * @returns LN address of the node
     */
    getLNAddress() : Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.call<litrpc.NoArgs,litrpc.ListeningPortsReply>("LitRPC.GetListeningPorts", {})
            .catch((reason) => { 
                reject(reason)
            })
            .then((reply) => {
                reply = reply as litrpc.ListeningPortsReply;
                resolve(reply.Adr);
            });
        });
    }


    /**
     * Connects to another LIT node
     * @param address LN address for the node to connect to
     * @param host The host to connect to. If omitted, LIT will use a node tracker to find the correct host
     * @param port The port to connect to. If omitted, LIT will use the default port (2448)
     */
    connect(address : string, host : string = "", port : number = 2448) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.ConnectArgs();
            args.LNAddr = address;
            if(host !== "") {
                args.LNAddr += "@" + host;
                if(port !== 2448) {
                    args.LNAddr += ":" + port.toString();
                }
            }
            this.call<litrpc.ConnectArgs,litrpc.StatusReply>("LitRPC.Connect", args)
            .then((reply) => {
                reply = reply as litrpc.StatusReply;
                if(reply.Status === undefined || reply.Status.indexOf("connected to peer") !== 0)  {
                    reject(new Error("Unexpected reply from server: " + reply.Status));
                    return;
                }
                resolve();
            })
            .catch((reason) => { 
                reject(reason)
            })
            
        });
    }

    /**
     * Returns a list of currently connected nodes
     */
    listConnections() : Promise<litrpc.PeerInfo[]> {
        return new Promise<litrpc.PeerInfo[]>((resolve, reject) => {
            this.call<litrpc.NoArgs,litrpc.ListConnectionsReply>("LitRPC.ListConnections",{})
            .then((reply) => {
                reply = reply as litrpc.ListConnectionsReply;
                if(reply.Connections === undefined) resolve([]);
                else resolve(reply.Connections);
            })
            .catch(reason => reject(reason))
        });
    }

    /**
     * Assigns a nickname to a connected peer
     * @param peerIndex Numeric index of the peer
     * @param nickname Nickname to assign
     */
    assignNickname(peerIndex : number, nickname : string) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.AssignNicknameArgs();
            args.Peer = peerIndex;
            args.Nickname = nickname;
            this.call<litrpc.AssignNicknameArgs,litrpc.StatusReply>("LitRPC.AssignNickname", args)
            .then((reply) => {
                reply = reply as litrpc.StatusReply;
                if(reply.Status === undefined || reply.Status.indexOf("changed nickname") !== 0)  {
                    reject(new Error("Unexpected reply from server: " + reply.Status));
                    return;
                }
                resolve();
            })
            .catch(reason => reject(reason))
        });
    }

    /**
     * Stops the LIT node. This means you'll have to restart it manually.
     * After stopping the node you can no longer connect to it via RPC.
     */
    stop() : Promise<void> {
        return new Promise((resolve, reject) => {
            this.call<litrpc.NoArgs,litrpc.StatusReply>("LitRPC.Stop", {})
            .then((reply) => {
                reply = reply as litrpc.StatusReply;
                if(reply.Status === undefined || reply.Status.indexOf("Stopping lit node") !== 0)  {
                    reject(new Error("Unexpected reply from server: " + reply.Status));
                    return;
                }
                resolve();
            })
            .catch(reason => reject(reason))
        });
    }

    /**
     * Returns a list of balances from the LIT node's wallet
     * @returns a promise to a list of coin balances. One object for each coin supported by the LIT node
     */
    listBalances() : Promise<litrpc.CoinBalReply[]> {
        return new Promise<litrpc.CoinBalReply[]>((resolve, reject) => {
            this.call<litrpc.NoArgs,litrpc.BalanceReply>("LitRPC.Balance", {})
            .then((reply) => {
                reply = reply as litrpc.BalanceReply;
                if(reply.Balances === undefined) {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.Balances);
            })
            .catch(reason => reject(reason))
        });
    }

    /**
     * Returns a list of all unspent transaction outputs, that are not part of a channel
     * @returns List of unspent outputs not part of a channel in an array of @see litrpc.TxoInfo objects
     */
    listUtxos() : Promise<litrpc.TxoInfo[]> {
        return new Promise<litrpc.TxoInfo[]>((resolve, reject) => {
            this.call<litrpc.NoArgs,litrpc.TxoListReply>("LitRPC.TxoList", {})
            .then((reply) => {
                reply = reply as litrpc.TxoListReply;
                if(reply.Txos === undefined) {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.Txos);
            })
            .catch(reason => reject(reason))
        });
    }

    /**
     * Sends coins from LIT's wallet using a normal on-chain transaction
     * @param address The address to send the coins to
     * @param amount The amount (in satoshi) to send
     * @returns The transaction ID for the on-chain transaction
     */
    send(address : string, amount : number) : Promise<string> {
        return new Promise<string>((resolve, reject) => {
            let args = new litrpc.SendArgs();
            args.DestAddrs = [address];
            args.Amts = [amount];
            this.call<litrpc.SendArgs,litrpc.TxidsReply>("LitRPC.Send", args)
            .then((reply) => {
                reply = reply as litrpc.TxidsReply;
                if(reply.Txids === undefined) {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.Txids[0]);
            })
            .catch(reason => reject(reason))
        });
    }

    /**
     * Allows you to configure the fee rate for a particular coin type
     * @param coinType Numeric coin type
     * @param feePerByte The amount of satoshi per byte to use as fee
     */
    setFee(coinType : number, feePerByte : number) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.SetFeeArgs();
            args.CoinType = coinType;
            args.Fee = feePerByte;
            this.call<litrpc.SetFeeArgs,litrpc.FeeReply>("LitRPC.SetFee", args)
            .then((reply) => {
                reply = reply as litrpc.FeeReply;
                if(reply.CurrentFee === undefined) {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                if(reply.CurrentFee !== feePerByte) {
                    reject(new Error("Fee was not set"));
                    return;
                }
                resolve();
            })
            .catch(reason => reject(reason))
        });
    }

     /**
     * Allows you to retrieve the fee rate for a particular coin type
     * @param coinType Numeric coin type
     */
    getFee(coinType : number) : Promise<number> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.GetFeeArgs();
            args.CoinType = coinType;
            this.call<litrpc.GetFeeArgs,litrpc.FeeReply>("LitRPC.GetFee", args)
            .then((reply) => {
                reply = reply as litrpc.FeeReply;
                if(reply.CurrentFee === undefined) {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.CurrentFee);
            })
            .catch(reason => reject(reason))
        });
    }

    /**
     * Returns a list of (newly generated or existing) addresses. Returns bech32 by default.
     * @param coinType Coin type the addresses should be returned for
     * @param numberToMake The number of new addresses to make. Passing 0 will return all known addresses
     * @param legacy Return legacy addresses (default: false)
     * @returns A string array with the generated or retrieved addresses
     */
    getAddresses(coinType : number, numberToMake : number, legacy : boolean = false) : Promise<string[]> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.AddressArgs();
            args.CoinType = coinType;
            args.NumToMake = numberToMake;
            this.call<litrpc.AddressArgs,litrpc.AddressReply>("LitRPC.Address", args)
            .then((reply) => {
                reply = reply as litrpc.AddressReply;
                if(reply.LegacyAddresses === undefined || reply.WitAddresses === undefined) {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }

                if(legacy)
                    resolve(reply.LegacyAddresses);
                else
                    resolve(reply.WitAddresses);
            })
            .catch(reason => reject(reason))
        });
    }

    /**
     * Returns a list of channels (both active and closed)
     * @returns Array of @see litrpc.ChannelInfo objects containing the known channels 
     */
    listChannels() : Promise<litrpc.ChannelInfo[]> {
        return new Promise<litrpc.ChannelInfo[]> ((resolve, reject) => {
            this.call<litrpc.NoArgs,litrpc.ChannelListReply>("LitRPC.ChannelList", {})
            .then((reply) => {
                reply = reply as litrpc.ChannelListReply;
                if(reply.Channels === undefined) {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.Channels);
            })
            .catch(reason => reject(reason))
        });
    }

    /**
     * Creates a new payment channel by funding a multi-sig output and exchanging the initial state 
     * between peers. After the channel exists, funds can freely be exchanged between peers without
     * using the blockchain.
     * @param peerIndex The peer to create the channel with
     * @param coinType Coin type of the channel
     * @param amount Amount (in satoshi) to fund the channel with
     * @param initialSend Send this amount over to the peer upon funding
     * @param data Arbitrary data to attach to the initial channel state. Can be used for referencing payments
     */
    fundChannel(peerIndex : number, coinType : number, amount : number, initialSend : number, data : Uint8Array = new Uint8Array([])) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.FundArgs();
            args.Peer = peerIndex;
            args.CoinType = coinType;
            args.Capacity = amount;
            args.InitialSend = initialSend;
            args.Data = this.toNumberArray(this.pad(data,32));
            this.call<litrpc.FundArgs,litrpc.StatusReply>("LitRPC.FundChannel", args)
            .then((reply) => {
                reply = reply as litrpc.StatusReply;
                if(reply.Status === undefined || reply.Status.indexOf("funded channel") !== 0)  {
                    reject(new Error("Unexpected reply from server: " + reply.Status));
                    return;
                }
                resolve();
            })
            .catch(reason => reject(reason))
        });
    }

    /**
     * Dumps all the known (previous) states to channels. This can be useful when
     * analyzing payment references periodically. The data of each individual state
     * is returned in the array of @see litrpc.ChannelState objects.
     */
    stateDump() : Promise<litrpc.ChannelState[]> {
        return new Promise<litrpc.ChannelState[]>((resolve, reject) => {
            this.call<litrpc.NoArgs,litrpc.StateDumpReply>("LitRPC.StateDump", {})
            .then((reply) => {
                reply = reply as litrpc.StateDumpReply;
                if(reply.Txs === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.Txs.map(jtx => {
                    let state = new litrpc.ChannelState();
                    state.Amount = jtx.Amt;
                    state.DataHex = Buffer.from(jtx.Data == null ? [] : jtx.Data).toString('hex');
                    state.TxIDHex = Buffer.from(jtx.Txid == null ? [] : jtx.Txid).toString('hex');
                    state.SignatureHex = Buffer.from(jtx.Sig == null ? [] : jtx.Sig).toString('hex');
                    state.Index = jtx.Idx;
                    state.PkhHex = Buffer.from(jtx.Pkh == null ? [] : jtx.Pkh).toString('hex');
                    return state;
                }));
            })
            .catch(reason => reject(reason));
        })
    }

    /**
     * Pushes funds through the channel to the other peer
     * @param channelIndex Index of the channel to push funds through
     * @param amount Amount (in satoshi) to push
     * @param data Arbitrary data to attach to the channel state. Can, for instance, be used for referencing payments
     */
    push(channelIndex : number, amount : number, data : Uint8Array = new Uint8Array([])) : Promise<number> {
        return new Promise<number>((resolve, reject) => {
            let args = new litrpc.PushArgs();
            args.ChanIdx = channelIndex;
            args.Amt = amount;
            args.Data = this.toNumberArray(this.pad(data,32));
            this.call<litrpc.PushArgs,litrpc.PushReply>("LitRPC.Push", args)
            .then((reply) => {
                reply = reply as litrpc.PushReply;
                if(reply.StateIndex === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.StateIndex);
            })
            .catch(reason => reject(reason));
        });      
    }

    /**
     * Collaboratively closes a channel and returns the funds to the wallet
     * @param channelIndex The index of the channel to close
     */
    closeChannel(channelIndex : number) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.ChanArgs();
            args.ChanIdx = channelIndex;
            this.call<litrpc.ChanArgs,litrpc.StatusReply>("LitRPC.CloseChannel", args)
            .then((reply) => {
                reply = reply as litrpc.StatusReply;
                if(reply.Status === undefined || reply.Status.indexOf("OK closed") !== 0)  {
                    reject(new Error("Unexpected reply from server: " + reply.Status));
                    return;
                }
                resolve();
            })
            .catch(reason => reject(reason))
        });
    }

    /**
     * Breaks a channel and claims the funds back to our wallet
     * @param channelIndex The index of the channel to break
     */
    breakChannel(channelIndex : number) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.ChanArgs();
            args.ChanIdx = channelIndex;
            this.call<litrpc.ChanArgs,litrpc.StatusReply>("LitRPC.BreakChannel", args)
            .then((reply) => {
                reply = reply as litrpc.StatusReply;
                if(reply.Status === undefined || reply.Status !== "")  {
                    reject(new Error("Unexpected reply from server: " + reply.Status));
                    return;
                }
                resolve();
            })
            .catch(reason => reject(reason))
        });
    }

    /**
     * Imports an oracle that exposes a REST API
     * @param url The REST endpoint of the oracle
     * @param name The display name to give the oracle
     */
    importOracle(url : string, name : string) : Promise<litrpc.DlcOracle> {
        return new Promise<litrpc.DlcOracle>((resolve, reject) => {
            let args = new litrpc.ImportOracleArgs();
            args.Name = name;
            args.Url = url;
            this.call<litrpc.ImportOracleArgs,litrpc.AddOrImportOracleReply>("LitRPC.ImportOracle", args)
            .then((reply) => {
                reply = reply as litrpc.AddOrImportOracleReply;
                if(reply.Oracle === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.Oracle);
            })
            .catch(reason => reject(reason));
        });    
    } 

    /**
     * Adds a new oracle by specifying its public key
     * @param pubKeyHex The public key of the oracle, 33 bytes hex
     * @param name The display name to give the oracle
     */
    addOracle(pubKeyHex : string, name : string) : Promise<litrpc.DlcOracle> {
        return new Promise<litrpc.DlcOracle>((resolve, reject) => {
            let args = new litrpc.AddOracleArgs();
            args.Name = name;
            args.Key = pubKeyHex;
            this.call<litrpc.AddOracleArgs,litrpc.AddOrImportOracleReply>("LitRPC.ImportOracle", args)
            .then((reply) => {
                reply = reply as litrpc.AddOrImportOracleReply;
                if(reply.Oracle === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.Oracle);
            })
            .catch(reason => reject(reason));
        });    
    } 

    /**
     * Returns a list of known oracles
     */
    listOracles() : Promise<litrpc.DlcOracle[]> {
        return new Promise<litrpc.DlcOracle[]>((resolve, reject) => {
            this.call<litrpc.NoArgs,litrpc.ListOraclesReply>("LitRPC.ListOracles", {})
            .then((reply) => {
                reply = reply as litrpc.ListOraclesReply;
                if(reply.Oracles === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.Oracles);
            })
            .catch(reason => reject(reason));
        });  
    }

    /**
     * Creates an offer for a new asset forward contract.
     * @param offer The parameters to create a new forward offer
     * @returns The stored forward offer, including its ID
     */
    newForwardOffer(offer : litrpc.DlcFwdOffer) : Promise<litrpc.DlcFwdOffer> {
        return new Promise<litrpc.DlcFwdOffer>((resolve, reject) => {
            let args = new litrpc.NewForwardOfferArgs();
            args.Offer = offer;
            this.call<litrpc.NewForwardOfferArgs,litrpc.NewForwardOfferReply>("LitRPC.NewForwardOffer", args)
            .then((reply) => {
                reply = reply as litrpc.NewForwardOfferReply;
                if(reply.Offer === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.Offer);
            })
            .catch(reason => reject(reason));
        });  
    }

    /**
     * Returns a list of current offers
     */
    listOffers() : Promise<litrpc.DlcFwdOffer[]> {
        return new Promise<litrpc.DlcFwdOffer[]>((resolve, reject) => {
            this.call<litrpc.NoArgs,litrpc.ListOffersReply>("LitRPC.ListOffers", {})
            .then((reply) => {
                reply = reply as litrpc.ListOffersReply;
                if(reply.Offers === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.Offers);
            })
            .catch(reason => reject(reason));
        });  
    }

    /**
     * Accepts an offer that was sent to us
     * @param offerIndex The index of the offer to accept
     */
    acceptOffer(offerIndex : number) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.AcceptDeclineOfferArgs();
            args.OIdx = offerIndex;
            this.call<litrpc.AcceptDeclineOfferArgs,litrpc.SuccessReply>("LitRPC.AcceptOffer", args)
            .then((reply) => {
                reply = reply as litrpc.SuccessReply;
                if(reply.Success === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                if(reply.Success) resolve();
                else reject(new Error("Server returned success=false"));
            })
            .catch(reason => reject(reason));
        }); 
    }

    /**
     * Declines an offer that was sent to us
     * @param offerIndex The index of the offer to decline
     */
    declineOffer(offerIndex : number) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.AcceptDeclineOfferArgs();
            args.OIdx = offerIndex;
            this.call<litrpc.AcceptDeclineOfferArgs,litrpc.SuccessReply>("LitRPC.DeclineOffer", args)
            .then((reply) => {
                reply = reply as litrpc.SuccessReply;
                if(reply.Success === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                if(reply.Success) resolve();
                else reject(new Error("Server returned success=false"));
            })
            .catch(reason => reject(reason));
        }); 
    }

    /**
     * Creates a new, empty draft contract
     * @returns The created contract
     */
    newContract() : Promise<litrpc.DlcContract> {
        return new Promise<litrpc.DlcContract>((resolve, reject) => {
            this.call<litrpc.NoArgs,litrpc.NewGetContractReply>("LitRPC.NewContract", {})
            .then((reply) => {
                reply = reply as litrpc.NewGetContractReply;
                if(reply.Contract === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.Contract);
            })
            .catch(reason => reject(reason));
        });
    }

    /**
     * Retrieves an existing contract
     * @param contractIndex The index of the contract to retrieve
     * @returns The contract
     */
    getContract(contractIndex : number) : Promise<litrpc.DlcContract> {
        return new Promise<litrpc.DlcContract>((resolve, reject) => {
            let args = new litrpc.GetContractArgs();
            args.Idx = contractIndex;
            this.call<litrpc.NoArgs,litrpc.NewGetContractReply>("LitRPC.GetContract", args)
            .then((reply) => {
                reply = reply as litrpc.NewGetContractReply;
                if(reply.Contract === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.Contract);
            })
            .catch(reason => reject(reason));
        });
    }

    /**
     * Returns all known contracts
     * @returns A list of all the contracts
     */
    listContracts() : Promise<litrpc.DlcContract[]> {
        return new Promise<litrpc.DlcContract[]>((resolve, reject) => {
            this.call<litrpc.NoArgs,litrpc.ListContractsReply>("LitRPC.ListContracts", {})
            .then((reply) => {
                reply = reply as litrpc.ListContractsReply;
                if(reply.Contracts === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                resolve(reply.Contracts);
            })
            .catch(reason => reject(reason));
        });
    }

    /**
     * Offers a contract to another peer. Contract has to be in draft state
     * @param contractIndex The contract to offer
     * @param peerIndex The peer to offer the contract to
     */
    offerContract(contractIndex : number, peerIndex : number) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.OfferContractArgs();
            args.CIdx = contractIndex;
            args.PeerIdx = peerIndex;
            this.call<litrpc.OfferContractArgs,litrpc.SuccessReply>("LitRPC.OfferContract", args)
            .then((reply) => {
                reply = reply as litrpc.SuccessReply;
                if(reply.Success === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                if(reply.Success) resolve();
                else reject(new Error("Server returned success=false"));
            })
            .catch(reason => reject(reason));
        });
    }

    /**
     * Accepts a contract 
     * @param contractIndex Index of the contract to accept
     */
    acceptContract(contractIndex : number) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.AcceptOrDeclineContractArgs();
            args.CIdx = contractIndex;
            this.call<litrpc.AcceptOrDeclineContractArgs,litrpc.SuccessReply>("LitRPC.AcceptContract", args)
            .then((reply) => {
                reply = reply as litrpc.SuccessReply;
                if(reply.Success === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                if(reply.Success) resolve();
                else reject(new Error("Server returned success=false"));
            })
            .catch(reason => reject(reason));
        });
    }

    /**
     * Declines a contract
     * @param contractIndex Index of the contract to decline
     */
    declineContract(contractIndex : number) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.AcceptOrDeclineContractArgs();
            args.CIdx = contractIndex;
            this.call<litrpc.AcceptOrDeclineContractArgs,litrpc.SuccessReply>("LitRPC.DeclineContract", args)
            .then((reply) => {
                reply = reply as litrpc.SuccessReply;
                if(reply.Success === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                if(reply.Success) resolve();
                else reject(new Error("Server returned success=false"));
            })
            .catch(reason => reject(reason));
        });
    }

    /**
     * Settles the contract and claims the funds back to the wallet
     * @param contractIndex Index of the contract to settle
     * @param oracleValue Oracle value to settle the contract on
     * @param oracleSignature Signature from the oracle for the value 
     */
    settleContract(contractIndex : number, oracleValue: number, oracleSignature : number[]) : Promise<litrpc.SettleContractReply> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.SettleContractArgs();
            args.CIdx = contractIndex;
            args.OracleSig = oracleSignature;
            args.OracleValue = oracleValue;
            this.call<litrpc.SettleContractArgs,litrpc.SettleContractReply>("LitRPC.SettleContract", args)
            .then((reply) => {
                reply = reply as litrpc.SettleContractReply;
                if(reply.Success === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                if(reply.Success) resolve(reply);
                else reject(new Error("Server returned success=false"));
            })
            .catch(reason => reject(reason));
        });
    }

    /**
     * Defines how the funds are divided based on the oracle's value, following a linear divison.
     * @param contractIndex The index of the contract to specify the division for
     * @param valueFullyOurs The value (threshold) at which all the money in the contract is for us
     * @param valueFullyTheirs The value (threshold) at which all the money in the contract is for our counter party
     */
    setContractDivision(contractIndex : number, valueFullyOurs : number, valueFullyTheirs : number) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.SetContractDivisionArgs();
            args.CIdx = contractIndex;
            args.ValueFullyOurs = valueFullyOurs;
            args.ValueFullyTheirs = valueFullyTheirs;
            this.call<litrpc.SetContractDivisionArgs,litrpc.SuccessReply>("LitRPC.SetContractDivision", args)
            .then((reply) => {
                reply = reply as litrpc.SuccessReply;
                if(reply.Success === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                if(reply.Success) resolve();
                else reject(new Error("Server returned success=false"));
            })
            .catch(reason => reject(reason));
        })
    }

    /**
     * Specifies which coin type to use for the contract. This cointype must be available or the server will return an error.
     * @param contractIndex The index of the contract to specify the coin type for
     * @param coinType The coin type to use for the contract
     */
    setContractCoinType(contractIndex : number, coinType : number)  : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.SetContractCoinTypeArgs();
            args.CIdx = contractIndex;
            args.CoinType = coinType;
            this.call<litrpc.SetContractCoinTypeArgs,litrpc.SuccessReply>("LitRPC.SetContractCoinType", args)
            .then((reply) => {
                reply = reply as litrpc.SuccessReply;
                if(reply.Success === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                if(reply.Success) resolve();
                else reject(new Error("Server returned success=false"));
            })
            .catch(reason => reject(reason));
        })
    }

    /**
     * Describes how the funding of the contract is supposed to happen
     * @param contractIndex The index of the contract to define the funding for
     * @param ourAmount The amount we are going to fund
     * @param theirAmount The amount we expect our counter party to fund
     */
    setContractFunding(contractIndex : number, ourAmount : number, theirAmount : number)  : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.SetContractFundingArgs();
            args.CIdx = contractIndex;
            args.OurAmount = ourAmount;
            args.TheirAmount = theirAmount;
            this.call<litrpc.SetContractFundingArgs,litrpc.SuccessReply>("LitRPC.SetContractCoinType", args)
            .then((reply) => {
                reply = reply as litrpc.SuccessReply;
                if(reply.Success === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                if(reply.Success) resolve();
                else reject(new Error("Server returned success=false"));
            })
            .catch(reason => reject(reason));
        })
    }

    /**
     * Sets the time the contract is supposed to settle
     * @param contractIndex The index of the contract to set the settlement time for
     * @param settlementTime The time (unix timestamp) when the contract is supposed to settle
     */
    setContractSettlementTime(contractIndex : number, settlementTime : number) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.SetContractSettlementTimeArgs();
            args.CIdx = contractIndex;
            args.Time = settlementTime;
            this.call<litrpc.SetContractSettlementTimeArgs,litrpc.SuccessReply>("LitRPC.SetContractSettlementTime", args)
            .then((reply) => {
                reply = reply as litrpc.SuccessReply;
                if(reply.Success === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                if(reply.Success) resolve();
                else reject(new Error("Server returned success=false"));
            })
            .catch(reason => reject(reason));
        })
    }

    /**
     * Set the public key of the R-point the oracle will use to sign the message with that is used
     * to divide the funds in this contract
     * @param contractIndex The index of the contract to set the R-point for
     * @param rPoint The public key of the R-Point
     */
    setContractRPoint(contractIndex : number, rPoint : number[]) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.SetContractRPointArgs();
            args.CIdx = contractIndex;
            args.RPoint = rPoint;
            this.call<litrpc.SetContractRPointArgs,litrpc.SuccessReply>("LitRPC.SetContractRPoint", args)
            .then((reply) => {
                reply = reply as litrpc.SuccessReply;
                if(reply.Success === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                if(reply.Success) resolve();
                else reject(new Error("Server returned success=false"));
            })
            .catch(reason => reject(reason));
        })
    }

    /**
     * Configures a contract to use a specific oracle. You need to import the oracle first.
     * @param contractIndex The index of the contract to set the oracle for
     * @param oracleIndex The index of the oracle to use 
     */
    setContractOracle(contractIndex : number, oracleIndex : number) : Promise<void> {
        return new Promise((resolve, reject) => {
            let args = new litrpc.SetContractOracleArgs();
            args.CIdx = contractIndex;
            args.OIdx = oracleIndex;
            this.call<litrpc.SetContractOracleArgs,litrpc.SuccessReply>("LitRPC.SetContractOracle", args)
            .then((reply) => {
                reply = reply as litrpc.SuccessReply;
                if(reply.Success === undefined)  {
                    reject(new Error("Unexpected reply from server"));
                    return;
                }
                if(reply.Success) resolve();
                else reject(new Error("Server returned success=false"));
            })
            .catch(reason => reject(reason));
        })
    }


    private toNumberArray(array : Uint8Array) : number[] {
        var numberArray : number[] = [];
        for (var i = 0; i < array.length; i++) numberArray[i] = array[i];
        return numberArray;
    }

    private pad(byteArray : Uint8Array, length : number) : Uint8Array {

        if(byteArray.length >= length) {
            return byteArray;
        }

        var newArray = new Uint8Array(length);
        for(var i = 0; i < byteArray.length; i++) {
            newArray[i] = byteArray[i];
        }
        return newArray;
    }

    private call<TRequest,TReply>(method : string, request : TRequest) : Promise<TReply> {
        let id = this.requestNonce++;
        return new Promise<TReply>((resolve, reject) => {
            if(this.rpccon === undefined) {
                reject(new Error("Connection not open. Open connection first using open()"))
                return;
            }
            this.callbacks.set(id, {resolve:resolve,reject:reject});
            this.rpccon.send(JSON.stringify({'method': method, 'params': [request], 'id': id}), (err) => {
                if(err !== undefined) { 
                    reject(err);
                    this.callbacks.delete(id);
                }
            });
        });
    }
}

export default LitClient;