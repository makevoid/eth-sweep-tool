const mnemonic = "title middle final artist fancy step clip front purity pupil ghost basket"
const from = 0
const number = 3

const mnemonicToHdKey = (mnemonic) => {
  return new BitcoreMnemonic(mnemonic).toHDKey()
}

const getAddresses = ({hdKey, from, number}) => {
  const addresses
  let address
  for (var idx = from; idx < number; idx++) {
    console.log("range", idx)
    address = hdKey.derive(idx)
    addresses.push(address)
  }
  return addresses
}

const getBalance = async (address) => {
  const balanceUrl = `https://www.etherchain.org/api/account/${address}`
  let resp = await fetch(balanceUrl)
  resp = await resp.json()
  return Number(resp['balance'] || 0)
}

const signRawTransaction = ({address, gas, gasPrice}) => {
  web3.eth.accounts.signTransaction(tx, privateKey [, callback]);
}

const broadcastTransaction = (rawTx) => {
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

const keyToAddress = (privateKey) => {
  //
  return address
}

const sweepAddress = ({privateKey, gas, gasPrice}) => {
  const address = keyToAddress(privateKey)
  const balance = await getBalance(address)
  const rawTX = signRawTransaction({address, gas, gasPrice})
  return await broadcastTransaction(rawTX)
}

const sweepAddresses = ({mnemonic, from, number, gas, gasPrice}) => {
  const hdKey = mnemonicToHdKey(mnemonic)
  const privateKeys = getPrivateKeys(hdKey)
  return privateKeys.map((privateKey) => {
    sweepAddress({privateKey, gas, gasPrice})
  })
}

const main = async () => {
  const outcome = sweepAddresses({
    mnemonic: mnemonic,
    from:     from,
    number:   number,
  })
  return outcome
}

main.then(console.log)
