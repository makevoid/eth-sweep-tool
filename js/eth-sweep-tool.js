require('es6-promise').polyfill()
require('isomorphic-fetch')
const c = console
const BitcoreMnemonic = require('bitcore-mnemonic')
const bitcore = require('bitcore-lib')
const HDPublicKey = bitcore.HDPublicKey
const Web3 = require('web3')
const web3 = new Web3("https://mainnet.infura.io")
const Tx = require('ethereumjs-tx')
const numberToHex = web3.utils.numberToHex
const toWei       = web3.utils.toWei
const isNode = (typeof process === 'object' && typeof process.version === 'string')
const _ = require('lodash')
let txEmitter
let readFile
if (isNode) {
  const EventEmitter = require('events')
  class TXEmitter extends EventEmitter {}
  txEmitter = new TXEmitter()

  const fs = require('fs')
  readFile = fs.readFileSync
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
  logStatus(evt.status)
})

const data = { status: "ok" }

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

// etherscan
//
const getBalance = async (address) => {
  const balanceUrl = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest`
  let resp = await fetch(balanceUrl)
  resp = await resp.json()
  return Number(resp['result'] || 0)
}

const signRawTransaction = async ({recipient, account, balance, gas, gasPrice}) => {
  const gasPriceWei = toWei(gasPrice, "gwei")
  const fees = Number(gas) * Number(gasPriceWei)
  c.log("fees    ", fees)
  c.log("bal     ", balance)
  const netBalance = balance - fees
  const value = netBalance
  c.log("bal Net ", netBalance)
  c.log("value   ", value + fees)
  const txData = {
    value: numberToHex(value),
    to: recipient,
    gas: numberToHex(Number(gas)),
    gasPrice: numberToHex(Number(gasPriceWei)),
    from: account.address,
    // nonce: 1,
  }

  const transaction = await account.signTransaction(txData)
  const txRaw = transaction.rawTransaction
  c.log("address", account.address)
  c.log("TX RAW", txRaw)

  return txRaw
}

const broadcastTransaction = async (rawTx) => {

  const broadcastUrl = "https://api.etherscan.io/api"

  const data = new FormData()
  data.append('module', 'proxy')
  data.append('action', 'eth_sendRawTransaction')
  data.append('hex', rawTx)
  data.append('apikey', '3DQFQQZ51G4M18SW8RDKHIMERD79GYTVEA') // TODO: please fork and use your own APi key

  let resp = await fetch(broadcastUrl, {
    method: "post",
    body: data,
  })
  resp = await resp.json()
  c.log("etherscan broadcast:", resp)

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
    c.log(response)

    const error = response.error
    if (error) {
      if (error.message) {
        txEmitter.emit('tx', { status: `Sweeping ${address} - ERROR: ${error.message} - code: ${error.code}` })
      } else {
        txEmitter.emit('tx', { status: `Sweeping ${address} - ERROR: ${error}\nTry manual push via:\n https://etherscan.io/pushTx?hex=${rawTx}\n` })
      }

    } else {
      txEmitter.emit('tx', { status: `Sweeping ${address} - OK: ${response.result}` })
    }

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

  for (let privateKey of privateKeys) {
    const value = await sweepAddress({
      recipient: recipient,
      privateKey: privateKey,
      gas: gas,
      gasPrice: gasPrice,
    })
    value
  }
}


// ------------------------------------------------------------------

// UI - TODO: separate view from core - TODO: reimplement in riot.js/vue/react/hyperhtml

if (isNode) {
  // console.log("This is a browser build - exiting Node...")
  // process.exit()
}

const main = async ({recipient, mnemonic, from, number, gas, gasPrice}) => {
  if (!recipient || recipient == "" || recipient == "0x") {
    txEmitter.emit('tx', { status: "recipient blank, aborting!" })
    return
  }

  if (!mnemonic || mnemonic == "") {
    txEmitter.emit('tx', { status: "mnemonic blank, aborting!" })
    return
  }
  const mnemonicLen = mnemonic.split(" ").length
  if (mnemonicLen != 12 && mnemonicLen != 24) {
    txEmitter.emit('tx', { status: "mnemonic length is wrong, check that you entered all 12 or 24 words!" })
    return
  }
  txEmitter.emit('tx', { status: `mnemonic: ${mnemonic}` })
  txEmitter.emit('tx', { status: `recipient: ${recipient}` })

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

// browser

if (!isNode) {

  document.addEventListener("DOMContentLoaded", function(event) {

    const recipient = document.querySelector("input[name='recipient']")
    const mnemonic  = document.querySelector("input[name='mnemonic']")
    const from      = document.querySelector("input[name='from']")
    const number    = document.querySelector("input[name='number']")
    const gas       = document.querySelector("input[name='gas']")
    const gasPrice  = document.querySelector("input[name='gasPrice']")
    const submitBtn = document.querySelector("button.submit")

    // placeholder values
    if (location.search == "?mkv=true") {
      recipient.value = "0x91bd87eb44223e77625aa3cb61c43c38d899494e"
      mnemonic.value = "title middle final artist fancy step clip front purity pupil ghost basket"
    }
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

}



// node run

if (isNode) {

  const hdPublicKeyString = readFile(".hdpubkey").toString().trim()
  var hdPublicKeyRoot = new HDPublicKey(hdPublicKeyString)

  // const fromIdx = 0    // First
  const fromIdx = 100     // Second
  const num = 100
  console.log(_.range(fromIdx, fromIdx+num))
  const indices = _.range(fromIdx, fromIdx+num)

  indices.forEach((idx) => {
    const hdPublicKey = hdPublicKeyRoot.derive(idx)
    let publicKey = hdPublicKey.publicKey.toString()
    publicKey = `0x${publicKey}`
    // console.log(publicKey)

    const ethJs = require('ethereumjs-wallet')
    const account = ethJs.fromPublicKey(publicKey, true)
    // console.log(account)
    let address = account.getAddress()
    address = `0x${address.toString('hex')}`
    // console.log(address)

    console.log(`${_.padStart(idx, 3, '0')}, m/60'/0'/${idx}, ${address}`)
  })
  process.exit()

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
