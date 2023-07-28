const fastify = require('fastify')({ logger: true })
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api')
const { stringToU8a }= require('@polkadot/util')
const { signatureVerify } = require('@polkadot/util-crypto')
const { options, OnChainRegistry, signCertificate, PinkContractPromise } = require('@phala/sdk')
const fs = require('fs')
const abi = JSON.parse(fs.readFileSync('token.json', 'utf-8'))

fastify.register(require('@fastify/cookie'), {
  secret: 'my-secret',
  parseOptions: {}
})

const verifyToken = async (token, address) => {
  const apiPromise = await ApiPromise.create(options({
    provider: new WsProvider('wss://poc5.phala.network/ws'),
    noInitWarn: true,
  }))
  const contractId = '0x845dea27f7984ff19b6db5f78550da6e4299665b3a02b15f6e0132956136f50d'
  const phatRegistry = await OnChainRegistry.create(apiPromise)
  const contractKey = await phatRegistry.getContractKeyOrFail(contractId)
  const contractPromise = new PinkContractPromise(apiPromise, phatRegistry, abi, contractId, contractKey)
  const keyring = new Keyring({ type: 'sr25519' })
  const pair = keyring.addFromUri('//Alice')
  const cert = await signCertificate({ pair, api: apiPromise })
  const r = await contractPromise.query.verifyToken(cert.address, { cert }, token, address)
  return !!r.output.toJSON()['ok']
}

fastify.post('/api/login', async function handler (request, reply) {
  const { token, signature, address } = request.body
  const { isValid } = signatureVerify(stringToU8a(token), signature, address)
  if (!isValid) {
    return reply.code(401).send({ error: 'unauthorized' })
  }
  if (!(await verifyToken(token, address))) {
    return reply.code(401).send({ error: 'unauthorized' })
  }
  return reply
    .setCookie('token', token, { path: '/' })
    .setCookie('address', address, { path: '/' })
    .send({ status: 'ok' })
})

fastify.get('/auth', async function handler (request, reply) {
  const { token, address } = request.cookies
  if (!token || !address || !(await verifyToken(token, address))) {
    return reply.code(403).send({ error: 'unauthorized' })
  }
  return { status: 'ok' }
})

fastify.get('/', async function handler (request, reply) {
  return { status: 'ok' }
})

fastify.listen({ port: 3000 }, (err) => {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})
