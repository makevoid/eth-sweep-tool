require('es6-promise').polyfill()
require('isomorphic-fetch')
const c = console
const BitcoreMnemonic = require('bitcore-mnemonic')
const Web3 = require('web3')
const web3 = new Web3("https://mainnet.infura.io")
const Tx = require('ethereumjs-tx')
const numberToHex = web3.utils.numberToHex
const toWei       = web3.utils.toWei
const isNode = typeof process === 'object'
let txEmitter
if (isNode) {
  const EventEmitter = require('events')
  class TXEmitter extends EventEmitter {}
  txEmitter = new TXEmitter()
} else {
  const ever = require('ever')
  txEmitter = ever(document.body)
}

const updateDomStatus(message) {
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
  if (evt.stopPropagation) evt.stopPropagation()
  c.log('transaction submitted')
  c.log('evt', evt)


})

const data = { status: "ok" }
// const data = { status: "error" }

txEmitter.emit('tx', data)

// ARGS
const recipient = "0x91bd87eb44223e77625aa3cb61c43c38d899494e" // local - antani
const mnemonic = "title middle final artist fancy step clip front purity pupil ghost basket"
const from = 0
const number = 3
const gas = "34000" // wei
// const gasPrice = "21" // gwei
const gasPrice = "4" // gwei

const mnemonicToHdKey = (mnemonic) => {
  return new BitcoreMnemonic(mnemonic).toHDPrivateKey()
}

const getPrivateKeys = ({hdKey, from, number}) => {
  const privateKeys = []
  let address
  c.log(from)
  for (var idx = from; idx < number; idx++) {
    // console.log("range", idx)
    privateKey = hdKey.derive(idx)
    privateKeys.push(privateKey.privateKey.toString())
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
  const account = web3.eth.accounts.privateKeyToAccount(privateKey)
  return account
}

const sweepAddress = async ({recipient, privateKey, gas, gasPrice}) => {
  const account = keyToAccount(privateKey)
  const address = account.address
  c.log("address", address)
  const balance = await getBalance(address)
  let result
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
