require('es6-promise').polyfill()
require('isomorphic-fetch')
const c = console
// const EthereumBip44 = require('ethereum-bip44')
const BitcoreMnemonic = require('bitcore-mnemonic')
const Web3 = require('web3')
const web3 = new Web3("https://mainnet.infura.io")
const Tx = require('ethereumjs-tx')
const numberToHex = web3.utils.numberToHex
const toWei       = web3.utils.toWei
const isNode = (typeof process === 'object' && typeof process.node === 'string' && typeof process.version === 'string')
let txEmitter
if (isNode) {
  const EventEmitter = require('events')
  class TXEmitter extends EventEmitter {}
  txEmitter = new TXEmitter()
} else {
  const ever = require('ever')
  txEmitter = ever(document.body)
}

const updateDomStatus = (message) => {
  const elem = document.querySelector(".status")
  elem.innerHTML = `${message}\n${elem.innerHTML}`
}

const logStatus = (message) => {
  if (!isNode) {
    updateDomStatus(message)
  } {
    console.log(message)
  }
}

txEmitter.on('tx', (evt) => {
  // if (evt.stopPropagation) evt.stopPropagation()
  // logStatus(JSON.stringify(evt))
  logStatus(evt.status)
})

const data = { status: "ok" }
// const data = { status: "error" }

txEmitter.emit('tx', { status: "initializing" })

const mnemonicToHdKey = (mnemonic) => {
  return new BitcoreMnemonic(mnemonic).toHDPrivateKey()
}

const getPrivateKeys = ({hdKey, from, number}) => {
  const privateKeys = []
  let address
  const masterKey = hdKey.derive("m/44'/60'/0'/0")
  for (var idx = from; idx < number; idx++) {
    privateKey = masterKey.derive(Number(idx))
    const key = privateKey.privateKey.toString()
    c.log(key)
    privateKeys.push(key)
  }
  return privateKeys
}

// etherchain
//
// const getBalance = async (address) => {
//   const balanceUrl = `https://www.etherchain.org/api/account/${address}`
//   let resp = await fetch(balanceUrl)
//   resp = await resp.json()
//   return Number(resp['balance'] || 0)
// }

// etherscan
//
const getBalance = async (address) => {
  const balanceUrl = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest`
  let resp = await fetch(balanceUrl)
  resp = await resp.json()
  return Number(resp['result'] || 0)
}

const signRawTransaction = async ({recipient, account, balance, gas, gasPrice}) => {
  // ETH 0.000714
  // 714000000000000 wei
  const gasPriceWei = toWei(gasPrice, "gwei")
  const fees = Number(gas) * Number(gasPriceWei)
  c.log("fees    ", fees)
  c.log("bal     ", balance)
  const netBalance = balance - fees
  // const value = netBalance
  const value = 10000000000
  c.log("bal Net ", netBalance)
  c.log("value   ", value + fees)
  const txData = {
    value: numberToHex(value),
    to: recipient,
    gas: numberToHex(Number(gas)),
    gasPrice: numberToHex(Number(gasPriceWei)),
    from: account.address,
    nonce: 7,
  }

  c.log(account)

  const transaction = await account.signTransaction(txData)
  const txRaw = transaction.rawTransaction
  c.log("TX RAW", txRaw)
  const tx = txRaw.slice(2, txRaw.length) // remove 0x
  const txBuffer = new Buffer(tx, "hex")
  return txBuffer

  // NOT WORKING (outdated doc or outdated method probably)
  //
  // const privateKey = new Buffer(account.privateKey, 'hex')
  // c.log("Sign transaction", JSON.stringify(txData, null, 2))
  //
  // const tx = new Tx(txData)
  // tx.sign(privateKey)
  // const serializedTx = tx.serialize()
  // return serializedTx
}

const broadcastTransaction = async (rawTx) => {
  let rawTxHex = rawTx.toString("hex")
  // rawTxHex = `0x${rawTxHex}`
  c.log("rawTxHex", rawTxHex)


  // dunno why this doesn't works dammit
  const broadcastUrl = `https://api.etherscan.io/api?module=proxy&action=eth_sendRawTransaction&hex=${rawTxHex}`
  let resp = await fetch(broadcastUrl, {
    method: "POST",
    headers: new Headers({
      'Content-Type': 'application/json'
    }),
  })
  resp = await resp.json()


  // const broadcastUrl = "https://api.blockcypher.com/v1/eth/main/txs/push"
  // const data = {
  //   tx: rawTxHex
  // }
  // let resp = await fetch(broadcastUrl, {
  //   method: "POST",
  //   body: JSON.stringify(data),
  //   headers: new Headers({
  //     'Content-Type': 'application/json'
  //   })
  // })
  // resp = await resp.json()

  c.log("broadcast:", resp)
  return resp
}

const keyToAccount = (privateKey) => {
  const account = web3.eth.accounts.privateKeyToAccount(`0x${privateKey}`)
  return account
}

const sweepAddress = async ({recipient, privateKey, gas, gasPrice}) => {
  const account = keyToAccount(privateKey)
  const address = account.address
  const balance = await getBalance(address)
  let result
  txEmitter.emit('tx', { status: `address: ${address} - balance: ${balance}` })
  if (balance <= 0) {
    result = {
      address: address,
      status: "balanceZero",
    }
  } else {
    const rawTx = await signRawTransaction({recipient, account, balance, gas, gasPrice})
    const response = await broadcastTransaction(rawTx)
    result = {
      address: address,
      status: "success",
      response: response,
    }
    txEmitter.emit('tx', { status: `Sweeping response: ${JSON.stringify(response)}` })
  }
  return result
}

const sweepAddresses = async ({recipient, mnemonic, from, number, gas, gasPrice}) => {
  const hdKey = mnemonicToHdKey(mnemonic)
  const privateKeys = getPrivateKeys({
    hdKey:  hdKey,
    from:   from,
    number: number,
  })
  return await privateKeys.map(async (privateKey) => {
    return await sweepAddress({
      recipient: recipient,
      privateKey: privateKey,
      gas: gas,
      gasPrice: gasPrice,
    })
  })
}



// test

if (isNode) {
  console.log("Running test build in Node")
  const main = async ({recipient, mnemonic, from, number, gas, gasPrice}) => {
    const outcome = await sweepAddresses({
      recipient:  recipient,
      mnemonic:   mnemonic,
      from:       from,
      number:     number,
      gas:        gas,
      gasPrice:   gasPrice,
    })
    return outcome
  }

  // ARGS
  const recipient = "0x91bd87eb44223e77625aa3cb61c43c38d899494e" // local - antani
  const mnemonic = "title middle final artist fancy step clip front purity pupil ghost basket"
  const from = 0
  const number = 3
  const gas = "34000" // wei
  // const gasPrice = "21" // gwei
  const gasPrice = "4" // gwei

  main({
    recipient:  recipient,
    mnemonic:   mnemonic,
    from:       from,
    number:     number,
    gas:        gas,
    gasPrice:   gasPrice,
  }).then((results) => {
    console.log(results)
  })

}

// ------------------------------------------------------------------

// UI - TODO: separate view from core - TODO: reimplement in riot.js/vue/react/hyperhtml

if (isNode) {
  console.log("This is a browser build - exiting Node...")
  process.exit()
}

const main = async ({recipient, mnemonic, from, number, gas, gasPrice}) => {
  if (!recipient || recipient == "" || recipient == "0x") {
    txEmitter.emit('tx', { status: "recipient blank, aborting!" })
    return
  }
  const outcome = await sweepAddresses({
    recipient:  recipient,
    mnemonic:   mnemonic,
    from:       from,
    number:     number,
    gas:        gas,
    gasPrice:   gasPrice,
  })
  return outcome
}

// elements
document.addEventListener("DOMContentLoaded", function(event) {

  const recipient = document.querySelector("input[name='recipient']")
  const mnemonic  = document.querySelector("input[name='mnemonic']")
  const from      = document.querySelector("input[name='from']")
  const number    = document.querySelector("input[name='number']")
  const gas       = document.querySelector("input[name='gas']")
  const gasPrice  = document.querySelector("input[name='gasPrice']")
  const submitBtn = document.querySelector("button.submit")

  // placeholder values
  recipient.value = "0x91bd87eb44223e77625aa3cb61c43c38d899494e"
  mnemonic.value = "title middle final artist fancy step clip front purity pupil ghost basket"
  number.value = "3"

  submitBtn.addEventListener("click", () => {
    txEmitter.emit('tx', { status: "sweep started" })
    main({
      recipient: recipient.value,
      mnemonic: mnemonic.value,
      from: from.value,
      number: number.value,
      gas: gas.value,
      gasPrice: gasPrice.value
    }).then((results) => {
      console.log(results)
    })
  })
  txEmitter.emit('tx', { status: "initialized" })

})
