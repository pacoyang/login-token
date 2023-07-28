import { LitElement, css, html } from 'lit'
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'
import { options, OnChainRegistry, signCertificate, PinkContractPromise } from '@phala/sdk'
import { stringToHex } from "@polkadot/util"

import * as abi from './token.json'

export class LoginButton extends LitElement {
  static get properties() {
    return {
      loginApiUrl: { type: String, attribute: 'login-api-url' },
      redirectUrl: { type: String, attribute: 'redirect-url' },
      _loading: { attribute: false },
    }
  }

  constructor() {
    super()
    this._loading = false
  }

  render() {
    return html`
      <button @click=${this._onClick} .disabled=${this._loading}>
        ${this._loading ? 'Loading...' : 'Login'}
      </button>
    `
  }

  async _onClick() {
    try {
      this._loading = true
      const apiPromise = await ApiPromise.create(options({
        provider: new WsProvider('wss://poc5.phala.network/ws'),
        noInitWarn: true,
      }))
      const provider = 'polkadot-js'
      const injector = window.injectedWeb3[provider]
      const extension = await injector.enable('Login Token')
      const accounts = await extension.accounts.get(true)
      const account = accounts[0]
      const signer = extension.signer
      const cert = await signCertificate({ api: apiPromise, signer, account })
      const contractId = '0xc111903770fd1072cb36c56435f2abc9f5d0cc144e557b1e85800e40e87e0ed6'
      const phatRegistry = await OnChainRegistry.create(apiPromise)
      const contractKey = await phatRegistry.getContractKeyOrFail(contractId)
      const contractPromise = new PinkContractPromise(apiPromise, phatRegistry, abi, contractId, contractKey)
      const r = await contractPromise.query.createToken(cert.address, { cert }, cert.address)
      if (!r.output || !r.output.isOk) {
        console.log('error', r)
      } else {
        const token = r.output.toJSON()['ok']
        const { signature } = await signer.signRaw({
          address: account.address,
          data: stringToHex(token),
          type: 'bytes'
        })
        console.info(token, signature)
        const res = await fetch(this.loginApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, signature, address: cert.address }),
        })
        if (res.status == 200) {
          window.location.href = this.redirectUrl
        }
      }
    } finally {
      this._loading = false
    }
  }

  static get styles() {
    return css`
      button {
        border-radius: 8px;
        border: 1px solid transparent;
        padding: 0.6em 1.2em;
        font-size: 1em;
        font-weight: 500;
        font-family: inherit;
        background-color: #1a1a1a;
        cursor: pointer;
        transition: border-color 0.25s;
      }
      button:hover {
        border-color: #9DC431;
      }
      button:focus,
      button:focus-visible {
        outline: 4px auto -webkit-focus-ring-color;
      }
      @media (prefers-color-scheme: light) {
        button {
          background-color: #f9f9f9;
        }
      }
    `
  }
}

window.customElements.define('login-button', LoginButton)
