import Web3 from 'web3';
import React, { Component } from 'react';
import ChatApp from '../abis/ChatApp.json'
import mainLogo from './arrow.png'

class Chat extends Component {

    async componentWillMount() {
        await this.loadWeb3()
        await this.loadBlockchainData()
        await this.listenToMessages()
        await this.listenToEther()
        await this.listenToFetchAllMsg()
        await this.listenToBoardMessages()
        await this.listenToFetchAllBoardMessages()
        // await this.fetchAllBoardMsg()
        await this.fetchAllMsg()
        // await this.fetchWholeMsg()
        await this.updateUIData()
    }

    constructor(props) {
        super(props)
        let chats = [
            {
                msg: "This is a blockchain demo, try to tap in!",
                response: true
            },
            {
                msg: "Enter \"send_ether: 0.0001\" to send some tokens to your recipient 😃",
                response: false
            }
        ]
        this.state = {
            fixedChats: chats,
            chats: [],
            inputValue: '',
            accounts: [],
            account: '',
            nbBlocks: 0,
            otherAccount: '',
            accountNbTransactions: 0,
            otherAccountNbTransactions: 0,
            accountBalance: 0,
            otherAccountBalance: 0,
            lastGas: 0,
            blockHash: '',
            didATransaction: false,
            isLastTransactionSuccess: false,
            forChat: true,
            boardMessages: [],
            boardAccount: '',
        }
    }

    // ------- init ------
    async loadWeb3() {
        if (window.ethereum) {
    
          // Need to put ws:// instead of http:// because of web sockets.
          // Web sockets are mandatory to listen to events.
          window.web3 = new Web3(Web3.providers.WebsocketProvider("ws://localhost:7545"))
          await window.ethereum.enable()
        }
        else if (window.web3) {
          window.web3 = new Web3(window.web3.currentProvider)
        }
        else {
          window.alert('Non-Ethereum browser detected. You should consider trying MetaMask!')
        }
      }

    async loadBlockchainData()  {
        const web3 = window.web3
    
        const accounts = await web3.eth.getAccounts()
        this.setState({ 
            accounts: accounts,
            account: accounts[0],
            otherAccount: accounts[1],
            boardAccount: accounts[0],
         })
        console.log(accounts)
    
        const ethBalance = await web3.eth.getBalance(this.state.account)
        this.setState({ ethBalance })
    
        // Load smart contract
        const networkId =  await web3.eth.net.getId()
        const chatAppData = ChatApp.networks[networkId]
        const abi = ChatApp.abi
        if(chatAppData) {
          const chatContract = new web3.eth.Contract(abi, chatAppData.address)
          this.setState({ chatContract: chatContract })
        }
        else {
            window.alert('Chat contract not deployed to detected network.')
        }
    }

    // ------- listeners ------
    async listenToMessages() {
        var binded = this.didReceiveMessageBinded.bind(this)
        this.state.chatContract.events.messageSentEvent({})
        .on('data', binded)
        .on('error', console.error);
    }

    async listenToEther() {
        var binded = this.didReceiveEtherBinded.bind(this)
        this.state.chatContract.events.etherSentEvent({})
        .on('data', binded)
        .on('error', console.error);
    }

    async listenToFetchAllMsg() {
        var binded = this.didReceiveAllMsgBinded.bind(this)
        this.state.chatContract.events.messagesFetchedEvent({})
        .on('data', binded)
        .on('error', console.error);
    }


    // ------- handlers ------
    async didReceiveMessageBinded(event){
        const message = event.returnValues.message
        if (event.returnValues.from === this.state.account){
            this.didReceiveMessage(message, true)
        }
        if (event.returnValues.to === this.state.account){
            this.didReceiveMessage(message, false)
        }
        this.setState({
            didATransaction: false,
        })
        await this.updateUIData()
    }

    async didReceiveEtherBinded(event){
        this.setState({
            didATransaction: true,
            isLastTransactionSuccess: event.returnValues.success
        })
        await this.updateUIData()
    }

    async didReceiveAllMsgBinded(event){
        let allMsg = []

        event.returnValues.messages.forEach((message) => {
            allMsg.push({
                msg: message['message'],
                response: message['from'] === this.state.account
            })
        })
        if (allMsg.length === 0)
            allMsg = this.state.fixedChats

        this.setState({
            chats: allMsg
        })
        await this.updateUIData()
    }

    async didReceiveMessage(message, isResponse) {
        let chats = this.state.chats
        chats.push(
            {
                msg: message,
                response: isResponse
            }
        )
        this.setState({
            chats: chats,
            inputValue: ''
        })
    }

    async didSendMessage(message) {
        const didSendEther = await this.sendEtherIfAsked()
        
        if (!didSendEther) {
            await this.state.chatContract.methods.sendMsg(this.state.otherAccount, message).send({ 
                from: this.state.account, 
                gas: 1500000 
            })
        }
    }

    async sendEtherIfAsked() {
        let splitted = this.state.inputValue.split(':')
        if (splitted.length !== 2)
            return false

        if (splitted[0] == "send_ether" && this.isNumeric(splitted[1])) {
            var asWei = parseFloat(splitted[1]) * 1e18
            await this.state.chatContract.methods.sendEther(this.state.otherAccount).send({
                from: this.state.account,
                value: asWei
            })
            return true
        }
        return false
    }

    async fetchAllMsg() {
        await this.state.chatContract.methods.getAllMsg(this.state.otherAccount).send({ 
            from: this.state.account 
        })
    }

    // ------- 留言板 MessageBoard ------
    async changeState() {
        let chatorboard;
        if(this.state.forChat) {
            chatorboard = false;
        } else {
            chatorboard = true;
        }
        
        this.setState({
            forChat: chatorboard,
        })

        await this.fetchAllBoardMsg()
    }

    async listenToBoardMessages() {
        var binded = this.didReceiveBoardMessageBinded.bind(this)
        this.state.chatContract.events.boardMessageSentEvent({})
        .on('data', binded)
        .on('error', console.error);
    }

    async didReceiveBoardMessageBinded(event){
        const message = event.returnValues.message
        const sender = event.returnValues.from
        this.didReceiveBoardMessage(message, sender)
    }

    async didReceiveBoardMessage(message, from) {
        let boardMessages = this.state.boardMessages;
        boardMessages.push(
            {
                msg: message,
                from: from,
            }
        )
        this.setState({
            boardMessages: boardMessages,
            inputValue: ''
        })
    }

    async didSendBoardMessage(message) {
        await this.state.chatContract.methods.sendBoardMsg(this.state.boardAccount, message).send({ 
            from: this.state.boardAccount, 
            gas: 1500000 
        })
    }

    async listenToFetchAllBoardMessages() {
        var binded = this.didReceiveAllBoardMsgBinded.bind(this)
        this.state.chatContract.events.boardMessagesFetchedEvent({})
        .on('data', binded)
        .on('error', console.error);
    }

    async didReceiveAllBoardMsgBinded(event){
        let allMsg = []

        event.returnValues.messages.forEach((message) => {
            allMsg.push({
                msg: message['message'],
                from: message['from']
            })
        })
    
        this.setState({
            boardMessages: allMsg
        })
        // await this.updateUIData()
    }

    async updateBoardAddressSelect(newValue) {
        this.setState({
            boardAccount: newValue,
        })
        
        await this.wait()
        await this.fetchAllBoardMsg()
    }

    async fetchAllBoardMsg() {
        await this.state.chatContract.methods.getAllBoardMsg().send({ 
            from: this.state.boardAccount
        })
    }

    // ------- UI state updaters ------
    async updateUIData() {
        // await this.wait()
        await this.updateNbTransactions()
        await this.updateBalances()
        await this.updateBlocks()
        await this.updateLastGas()
    }

    updateInputValue(evt) {
        this.setState({
          inputValue: evt.target.value
        });
      }

    async updateAddressSelect(newValue, isOtherAccount) {
        if (isOtherAccount) {
            this.setState({
                otherAccount: newValue,
                chats: this.state.fixedChats
            })
        }
        else {
            this.setState({
                account: newValue,
                chats: this.state.fixedChats
            })
        }
        await this.wait()
        await this.fetchAllMsg()
        await this.updateUIData()
    }

    async updateNbTransactions() {
        let accountNbTransactions = await window.web3.eth.getTransactionCount(this.state.account)
        let otherAccountNbTransactions = await window.web3.eth.getTransactionCount(this.state.otherAccount)
        this.setState({
            accountNbTransactions: accountNbTransactions,
            otherAccountNbTransactions: otherAccountNbTransactions
        })
    }

    async updateBalances() {
        let accountBalance = await window.web3.eth.getBalance(this.state.account)
        let otherAccountBalance = await window.web3.eth.getBalance(this.state.otherAccount)
        this.setState({
            accountBalance: window.web3.utils.fromWei(accountBalance, 'ether'),
            otherAccountBalance: window.web3.utils.fromWei(otherAccountBalance, 'ether')
        })
    }

    async updateBlocks() {
        const latest = await window.web3.eth.getBlockNumber()
        this.setState({
            nbBlocks: latest
        })
    }

    async updateLastGas() {
        const lastBlockNumber = await window.web3.eth.getBlockNumber();
        let block = await window.web3.eth.getBlock(lastBlockNumber);
        block = await window.web3.eth.getBlock(lastBlockNumber);

        const lastTransaction = block.transactions[block.transactions.length - 1];
        const transaction = await window.web3.eth.getTransaction(lastTransaction);

        this.setState({
            blockHash: transaction["blockHash"],
            lastGas: transaction["gas"],
        })
    }

    // ------- UI ------
    getChatMessagesAsDivs() {
        let chatDivs = this.state.chats.map(x => x.response ? 
            <div class="message text-only">
                <div class="response">
                    <p class="text"> {x.msg} </p>
                    </div>
                </div> :
            <div class="message text-only">
                <p class="text"> {x.msg} </p>
            </div>
        )
        return chatDivs.reverse()
    }

    getBoardMessagesAsDivs() {
        let boardMessageDivs = this.state.boardMessages.map(x =>
            <div class="message text-only">
                <div class="board">
                <p class="text"> {x.from}  留言:   {x.msg}</p>
                </div>
            </div>
        )
        return boardMessageDivs.reverse()
    }

    getToggleAdresses(isOtherAccount) {
        var addresses = []
        for (var i = 0; i < this.state.accounts.length; i++) {
            let account = this.state.accounts[i]
            if (isOtherAccount && account == this.state.otherAccount
                || !isOtherAccount && account == this.state.account)
                addresses.push(<option value={account} selected>{account}</option>)
            else {
                addresses.push(<option value={account}>{account}</option>)
            }
        }
        return addresses
    }

    displayEtherTransactionStatus() {
        if (!this.state.didATransaction)
            return

        if (this.state.isLastTransactionSuccess)
            return <div style={{color: "green"}}>ETH transaction succeeded!</div>
        else
            return <div>error</div>
    }

    // ------- helpers ------
    isNumeric(str) {
        if (typeof str != "string") return false
        return !isNaN(str) &&
               !isNaN(parseFloat(str))
      }

    async wait() {
        const noop = ()=>{};
        for (var i = 0; i < 10000; i++)
            noop()
    }

    // ------- rendering ------
    render() {
        let renderInfo;
        if (this.state.forChat) {
            renderInfo = (
                <body>
                <div class="block-container">
                    <div class="row">
                        <div class="col-7 left-block">
                            <section class="chat">
                                <div class="header-chat">
                                    <div class="left">
                                        <img src={mainLogo} class="arrow"/>
                                        <select class="custom-select" onChange={e => this.updateAddressSelect(e.target.value, false)} >
                                            { this.getToggleAdresses(false) }
                                        </select>     
                                    </div>
                                    <div class="right">
                                        <select class="custom-select" onChange={e => this.updateAddressSelect(e.target.value, true)} >
                                            { this.getToggleAdresses(true) }
                                        </select>  
                                    </div>
                                </div>
                                <div class="messages-chat">
                                { this.getChatMessagesAsDivs() }
                                </div>
                            </section>
                            <div class="footer-chat">
                                <i class="icon fa fa-smile-o clickable" style={{fontSize: "25pt"}} aria-hidden="true"></i>
                                <input value={this.state.inputValue} onChange={evt => this.updateInputValue(evt)} type="text" class="write-message" placeholder="Type your message here"></input>
                                <i class="icon send fa fa-paper-plane-o clickable" aria-hidden="true"></i>
                                <button class="btn btn-success send-btn" onClick={() => this.didSendMessage(this.state.inputValue)}>Send</button>
                            </div>
                        </div>
                        <div class="col-5 right-block">
                            <h3>Blockchain state</h3>
                            <p>Number of blocks: { this.state.nbBlocks }</p>
                            <p>Last transaction gas: { this.state.lastGas }</p>
                            <div class="sender-block blockchain-block">
                                <p><b>Sender address:</b></p>
                                <p>{ this.state.account }</p>
                                <p>Number of transactions: { this.state.accountNbTransactions }</p>
                                <p>Wallet balance: { this.state.accountBalance } ETH</p>
                            </div>
                            <div class="recip-block blockchain-block">
                                <p><b>Recipient address:</b></p>
                                <p>{ this.state.otherAccount }</p>
                                <p>Number of transactions: { this.state.otherAccountNbTransactions }</p>
                                <p>Wallet balance: { this.state.otherAccountBalance } ETH</p>
                            </div>

                            <div class="alert-transac">
                                { this.displayEtherTransactionStatus() }
                            </div>
                            
                        </div>
                    </div>
                    
                    </div>
            </body>
            )
        } else {
            renderInfo = (
                <body>
                    <div class="block-container">
                    <div class="row">
                        <div class="col-12 left-block">
                            <section class="chat">
                                <div class="header-chat">
                                    <div class="left">
                                        选择留言者:  
                                        <select class="custom-select" onChange={e => this.updateBoardAddressSelect(e.target.value)}>
                                            {this.getToggleAdresses(false) }
                                        </select> 
                                    </div>
                                </div>
                                <div class="messages-chat">
                                    { this.getBoardMessagesAsDivs() }
                                </div>
                            </section>
                            <div class="footer-chat">
                                <i class="icon fa fa-smile-o clickable" style={{fontSize: "25pt"}} aria-hidden="true"></i>
                                <input value={this.state.inputValue} onChange={evt => this.updateInputValue(evt)} type="text" class="write-message" placeholder="Write your message here"></input>
                                <i class="icon send fa fa-paper-plane-o clickable" aria-hidden="true"></i>
                                <button class="btn btn-success send-btn" onClick={() => this.didSendBoardMessage(this.state.inputValue)}>Write</button>
                            </div>
                        </div>
                    </div>
                    </div>
                </body>
            )
        }
        return (
            <div>
                <button class="btn btn-success send-btn" onClick={() => this.changeState()}>切换聊天与留言板</button>
                {renderInfo}
            </div>
            
        )
    }

}

export default Chat;