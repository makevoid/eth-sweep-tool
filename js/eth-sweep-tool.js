require('es6-promise').polyfill()
require('isomorphic-fetch')
const c = console
const BitcoreMnemonic = require('bitcore-mnemonic')
const Web3 = require('web3')
const web3 = new Web3()

const recipient = "0x91bd87eb44223e77625aa3cb61c43c38d899494e" // local - antani
const mnemonic = "title middle final artist fancy step clip front purity pupil ghost basket"
const from = 0
const number = 3
const gas = 34000 // wei
const gasPrice = 21 // gwei

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
  const gasPriceWei = web3.utils.toWei(gasPrice, "gwei")
  const fees = gas * gasPriceWei
  const netBalance = balance - fees
  const txData = {
    value: netBalance,
    to: recipient,
    gas: gas,
    gasPrice: gasPrice,
    // from: account.address,
  }
  c.log("Sign transaction", JSON.stringify(txData, nil, 2))
  const tx = await account.signTransaction(txData)
  const rawTx = tx
  return rawTX
}

const broadcastTransaction = async (rawTx) => {
  let rawTxHex = rawTX

  const broadcastUrl = `https://api.etherscan.io/api?module=proxy&action=eth_sendRawTransaction&hex=${rawTxHex}`
  let resp = await fetch(broadcastUrl, {
    method: "POST",
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  })
  resp = await resp.json()
  return resp
}

const keyToAccount = (privateKey) => {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey)
  return account
}

const sweepAddress = async ({recipient, privateKey, gas, gasPrice}) => {
  const account = keyToAccount(privateKey)
  const address = account.address
  const balance = await getBalance(address)
  let result
  if (balance <= 0) {
    result = {
      address: address,
      status: "balanceZero",
    }
  } else {
    const rawTX = await signRawTransaction({recipient, account, balance, gas, gasPrice})
    const response = await broadcastTransaction(rawTX)
    result = {
      address: address,
      status: "success",
      response: response,
    }
  }
  return result
}

const sweepAddresses = async ({mnemonic, from, number, gas, gasPrice}) => {
  const hdKey = mnemonicToHdKey(mnemonic)
  const privateKeys = getPrivateKeys({
    hdKey:  hdKey,
    from:   from,
    number: number,
  })
  return await privateKeys.map(async (privateKey) => {
    return await sweepAddress({
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
}).then(console.log)
