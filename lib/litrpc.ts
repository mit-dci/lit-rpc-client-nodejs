export class NoArgs {

}

export class ListenArgs {
    Port? : string
}

export class ListeningPortsReply {
    LisIpPorts? : string[]
	Adr?        : string
}

export class TxidsReply {
	Txids? : string[]
}
export class StatusReply {
	Status? : string
}

export class CoinArgs {
	CoinType? : number
}

export class ConnectArgs {
	LNAddr? : string
}

/**
 * Describes the information of a connected peer
 */
export class PeerInfo {
    /**
     * The (unique) peer number for this peer
     */
    PeerNumber? : number
    /**
     * The remote endpoint we connected to
     */
    RemoteHost? : string
    /**
     * The nickname for this peer
     */
	Nickname?  : string
}

export class ListConnectionsReply {
	Connections? : PeerInfo[]
	MyPKH?       : string
}

export class AssignNicknameArgs {
	Peer?     : number
	Nickname? : string
}

export class CoinBalReply {
	CoinType?    : number
	SyncHeight?  : number
	ChanTotal?   : number
	TxoTotal?    : number
	MatureWitty? : number
	FeeRate?     : number
}

export class BalanceReply {
	Balances? : CoinBalReply[]
}

export class TxoInfo  {
	OutPoint?   : string
	Am?         : number
	Height?     : number
	Delay?      : number
	CoinType?   : string
	Witty?      : boolean
	KeyPath?    : string
}
export class TxoListReply  {
	Txos?       : TxoInfo[]
}

export class SendArgs {
	DestAddrs? : string[]
	Amts?      : number[]
}

export class  SetFeeArgs {
	Fee? : number
	CoinType? : number
}

export class GetFeeArgs {
	CoinType? : number
}
export class FeeReply {
	CurrentFee? : number
}

export class AddressArgs {
	NumToMake? : number
	CoinType?  : number
}

export class AddressReply {
	WitAddresses?    : string[]
	LegacyAddresses? : string[]
}

export class ChannelInfo {
	OutPoint?       :   string
	CoinType?       :   number
	Closed?         :   boolean
	Capacity?       :   number
	MyBalance?      :   number
	Height?         :   number
	StateNum?       :   number 
    PeerIdx?        :   number
    CIdx?           :   number
	PeerID?         :   string
	Data?           :   number[]
	Pkh?            :   number[]
}

export class ChannelListReply {
	Channels? : ChannelInfo[]
}

// ------------------------- fund
export class FundArgs {
	Peer? : number
	CoinType? : number
	Capacity? : number
	Roundup? : number
	InitialSend? : number
	Data? : number[]
}

export class JusticeTx {
	Sig?  :   number[]
	Txid? :   number[]
	Amt? :   number
	Data? :   number[]
	Pkh?  :   number[]
	Idx?  :   number
}

export class ChannelState {
    SignatureHex? : string
    TxIDHex? : string
    Amount? : number
    DataHex? : string
    PkhHex? : string
    Index? : number
}

export class StateDumpReply {
	Txs? : JusticeTx[]
}

export class PushArgs {
	ChanIdx? : number
	Amt? : number
	Data ? : number[]
}
export class PushReply {
	StateIndex? : number
}

export class ChanArgs {
	ChanIdx? : number
}

export class DlcOracle {
    /**
     * Index of the oracle for refencing in commands
     */
    Idx?  : number
    
    /**
     * Public key of the oracle
     */
    A?  :  number[]
    
    /**
     * Name of the oracle for display purposes
     */
    Name? : string 
    
    /**
     * Base URL of the oracle, if its REST based (optional)
     */
	Url? : string   
}

export class ImportOracleArgs {
	Url? :  string
	Name? : string
}

export class AddOrImportOracleReply {
	Oracle? : DlcOracle
}

export class AddOracleArgs {
	Key? :  string
	Name? : string
}

export class ListOraclesReply {
	Oracles? : DlcOracle[]
}

export class DlcContractDivision {
	OracleValue? : number
	ValueOurs?   : number
}

/**
 * DlcFwdOffer is an offer for a specific contract template: it is 
 * a bitcoin (or other coin) settled forward, which is symmetrically 
 * funded
 */
export class DlcFwdOffer {
	/**
     * Convenience definition for serialization from RPC
     */
	OType? : number
	/**
     * Index of the offer
     */
	OIdx? : number
	/**
     * Index of the offer on the other peer
     */
	TheirOIdx? : number
	/**
     * Index of the peer offering to / from
     */
	PeerIdx? : number
	/**
     * Coin type
     */
	CoinType? : number
	/**
     * Pub key of the oracle used in the contract
     */
    OracleA? : number[]
    /**
     * Pub key of the R point (one-time signing key) used in the contract
     */
    OracleR? : number[]
    /**
     * Time of expected settlement
     */
	SettlementTime? : number
	/**
     * Amount of funding (in satoshi) each party contributes
     */
	FundAmt? : number
	/**
     * Slice of my payouts for given oracle values
     */
	Payouts? : DlcContractDivision[]
	/**
     * If true, I'm the 'buyer' of the foward asset (and I'm short bitcoin)
     */
	ImBuyer? : boolean
	/**
     * Amount of asset to be delivered at settlement time.
     * Note that initial price is FundAmt / AssetQuantity
     */
	AssetQuantity? : number

	/**
     * Stores if the offer was accepted. When receiving a matching
	 * Contract draft, it will be automatically accepted
     */
	Accepted? : boolean
}

export enum DlcContractStatus
{
    ContractStatusDraft         = 0,
    ContractStatusOfferedByMe   = 1,
    ContractStatusOfferedToMe   = 2,
    ContractStatusDeclined      = 3,
    ContractStatusAccepted      = 4,
    ContractStatusAcknowledged  = 5,
    ContractStatusActive        = 6,
    ContractStatusSettling      = 7,
    ContractStatusClosed        = 8
}

/**
 * DlcContract is a struct containing all elements to work with a Discreet 
 * Log Contract. This struct is stored in the database of LIT
 */
export class DlcContract {
	/**
     * Index of the contract for referencing in commands
     */
	Idx?: number
	/**
     * Index of the contract on the other peer (so we can reference it in
	 * messages)
     */
	TheirIdx?: number
	/**
     * Index of the peer we've offered the contract to or received the contract 
     * from
     */
	PeerIdx?: number
	/**
     * Coin type
     */
    CoinType?: number
	/**
     * Pub key of the oracle used in the contract
     */
    OracleA? : number[]
    /**
     * Pub key of the R point (one-time signing key) used in the contract
     */
    OracleR? : number[]
	/** 
     * The time we expect the oracle to publish
     */
	OracleTimestamp?: number
	/** 
     * The payout specification
     */
	Division? : DlcContractDivision[]
	/**
     * The amount (in satoshi) we are funding
     */
    OurFundingAmount? : number
    /**
     * The amount (in satoshi) our counter party is funding
     */
    TheirFundingAmount? : number
	/**
     * PKH to which our part of the contracts funding change should go
     */
    OurChangePKH? : number[]
    /**
     * PKH to which the counter party's part of the contracts funding change should go
     */
    TheirChangePKH? : number[]
	/**
     * Our Pubkey used in the funding multisig output
     */
    OurFundMultisigPub? : number[]
    /**
     * Counter party's pubkey used in the funding multisig output
     */
    TheirFundMultisigPub? : number[]
	/**
     * Our pubkey to be used in the commit script (combined with oracle pubkey or CSV timeout)
     */
    OurPayoutBase? : number[]
    /**
     * Our pubkey to be used in the commit script (combined with oracle pubkey or CSV timeout)
     */
    TheirPayoutBase? : number[]
	/**
     * Our Pubkeyhash to which the contract pays out (directly)
     */
    OurPayoutPKH? : number[]
	/**
     * Counterparty's Pubkeyhash to which the contract pays out (directly)
     */  
    TheirPayoutPKH? : number[]
	/**
     * Status of the contract
     */
	Status? : DlcContractStatus
	/** 
     * Our outpoints used to fund the contract
     */
    OurFundingInputs? : DlcContractFundingInput[]
    /** 
     * Counter party's outpoints used to fund the contract
     */
    TheirFundingInputs? : DlcContractFundingInput[]
	/**
     * Signatures for the settlement transactions
     */
	TheirSettlementSignatures? : DlcContractSettlementSignature[]
	/**
     * The outpoint of the funding TX we want to spend in the settlement
	 * for easier monitoring
     */
	FundingOutpoint? : OutPoint
}

/**
 * DlcContractFundingInput describes a UTXO that is offered to fund the
 * contract with
 */
export class DlcContractFundingInput {
    /**
     * The outpoint used for funding
     */
    Outpoint? : OutPoint
    /**
     * The value of the outpoint (in satoshi)
     */
	Value? : number
}

export class OutPoint {
	Hash?  : number[]
	Index? : number
}

export class DlcContractSettlementSignature {
	/**
     * The oracle value for which transaction these are the signatures
     */
	Outcome? : number
	/**
     * The signature for the transaction
     */
	Signature? : number[]
}


export class NewForwardOfferArgs {
	Offer? : DlcFwdOffer
}

export class NewForwardOfferReply {
	Offer? : DlcFwdOffer
}

export class ListOffersReply {
	Offers? : DlcFwdOffer[]
}

export class AcceptDeclineOfferArgs {
	OIdx? : number
}

export class SuccessReply {
	Success? : boolean
}

export class OfferContractArgs {
	CIdx? : number
	PeerIdx? : number
}

export class NewGetContractReply {
	Contract? : DlcContract
}

export class ListContractsReply {
	Contracts? : DlcContract[]
}

export class GetContractArgs {
	Idx? : number
}

export class AcceptOrDeclineContractArgs {
    CIdx? : number
}

export class SettleContractArgs {
	CIdx?    : number
	OracleValue? : number
	OracleSig? : number[]
}

export class SettleContractReply {
	Success?   :   boolean
	SettleTxHash? : number[]
	ClaimTxHash? : number[]
}

export class SetContractFundingArgs {
	CIdx?         : number
	OurAmount?    : number
	TheirAmount?  : number
}

export class SetContractDivisionArgs {
	CIdx?              : number
	ValueFullyOurs?    : number
	ValueFullyTheirs?  : number
}

export class SetContractCoinTypeArgs {
	CIdx?      : number
	CoinType?  : number
}

export class SetContractSettlementTimeArgs {
	CIdx?  : number
	Time?  : number
}

export class SetContractRPointArgs {
	CIdx?    : number
	RPoint?  : number[]
}

export class SetContractOracleArgs {
	CIdx? : number
	OIdx? : number
}